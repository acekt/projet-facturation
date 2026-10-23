import {
  BaseObserver,
  UpdateType,
  type CommonPowerSyncDatabase,
  type CrudEntry,
  type PowerSyncBackendConnector,
  type PowerSyncCredentials
} from '@powersync/web';
import { Session, SupabaseClient, createClient } from '@supabase/supabase-js';

const FATAL_RESPONSE_CODES = [
  /^22...$/, // Class 22 — Data Exception
  /^23...$/, // Class 23 — Integrity Constraint Violation
  /^42501$/  // INSUFFICIENT PRIVILEGE
];

export type SupabaseConnectorListener = {
  initialized?: () => void;
  sessionStarted?: (session: Session) => void;
  sessionEnded?: () => void;
};

export class SupabaseConnector extends BaseObserver<SupabaseConnectorListener> implements PowerSyncBackendConnector {
  readonly client: SupabaseClient;
  ready: boolean;
  currentSession: Session | null;

  constructor() {
    super();
    // Nous utilisons process.env.NEXT_PUBLIC car l'application est en Next.js
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    this.client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true }
    });
    this.currentSession = null;
    this.ready = false;
  }

  async init() {
    if (this.ready) return;

    // Écoute réactive des changements d'état d'authentification Supabase
    this.client.auth.onAuthStateChange((_event, session) => {
      this.updateSession(session);
    });

    const sessionResponse = await this.client.auth.getSession();
    this.updateSession(sessionResponse.data.session);
    this.ready = true;
    this.iterateListeners((cb) => cb.initialized?.());
  }

  updateSession(session: Session | null) {
    this.currentSession = session;
    if (!session) {
      this.iterateListeners((cb) => cb.sessionEnded?.());
      return;
    }
    this.iterateListeners((cb) => cb.sessionStarted?.(session));
  }

  async login(email: string, password: string) {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password
    });
    if (error) {
      throw error;
    }
    this.updateSession(data.session);
    return data;
  }

  async logout() {
    const { error } = await this.client.auth.signOut();
    if (error) {
      console.error('Erreur lors de la déconnexion Supabase:', error);
    }
    this.updateSession(null);
  }

  get session(): Session | null {
    return this.currentSession;
  }

  get user() {
    return this.currentSession?.user ?? null;
  }

  get isAuthenticated(): boolean {
    return !!this.currentSession;
  }

  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    const { data: { session }, error } = await this.client.auth.getSession();
    if (!session || error) {
      return null;
    }
    return {
      endpoint: process.env.NEXT_PUBLIC_POWERSYNC_URL || '',
      token: session.access_token ?? ''
    };
  }

  async uploadData(database: CommonPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    // OPTIMISATION CONTEXT7: Sequential Merge Strategy
    const MERGE_BATCH_LIMIT = 100;
    let batchedOps: CrudEntry[] = [];

    try {
      for (let i = 0; i < transaction.crud.length; i++) {
        const cruds = transaction.crud;
        const op = cruds[i];
        const table = this.client.from(op.table);
        batchedOps.push(op);

        let result: any;
        let batched = 1;

        switch (op.op) {
          case UpdateType.PUT:
            const records = [{ ...(cruds[i].opData || {}), id: cruds[i].id }];
            while (
              i + 1 < cruds.length &&
              cruds[i + 1].op === op.op &&
              cruds[i + 1].table === op.table &&
              batched < MERGE_BATCH_LIMIT
            ) {
              i++;
              records.push({ ...(cruds[i].opData || {}), id: cruds[i].id });
              batchedOps.push(cruds[i]);
              batched++;
            }
            result = await table.upsert(records);
            break;
          case UpdateType.PATCH:
            batchedOps = [op];
            result = await table.update(op.opData || {}).eq('id', op.id);
            break;
          case UpdateType.DELETE:
            batchedOps = [op];
            const ids = [op.id];
            while (
              i + 1 < cruds.length &&
              cruds[i + 1].op === op.op &&
              cruds[i + 1].table === op.table &&
              batched < MERGE_BATCH_LIMIT
            ) {
              i++;
              ids.push(cruds[i].id);
              batchedOps.push(cruds[i]);
              batched++;
            }
            result = await table.delete().in('id', ids);
            break;
        }

        if (result?.error) {
          throw result.error;
        }
      }
      await transaction.complete();
    } catch (ex: any) {
      if (typeof ex.code === 'string' && FATAL_RESPONSE_CODES.some((regex) => regex.test(ex.code))) {
        console.error('Data upload error - discarding:', ex);
        await transaction.complete();
      } else {
        throw ex;
      }
    }
  }
}
