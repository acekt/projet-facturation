import { createClient, type SupabaseClient, type Session, type User } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Client Supabase autonome pour l'application Desktop.
 * Remplace l'ancien SupabaseConnector lié au moteur PowerSync (Lot G / Z4).
 */
export const supabaseClient: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true },
});

export class SupabaseSessionManager {
  readonly client: SupabaseClient = supabaseClient;
  private currentSession: Session | null = null;
  private listeners = new Set<(session: Session | null) => void>();
  private initialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.client.auth.onAuthStateChange((_event, session) => {
        this.currentSession = session;
        this.listeners.forEach((cb) => cb(session));
      });
      this.client.auth.getSession().then(({ data }) => {
        this.currentSession = data.session;
        this.initialized = true;
        this.listeners.forEach((cb) => cb(data.session));
      });
    }
  }

  get session(): Session | null {
    return this.currentSession;
  }

  get user(): User | null {
    return this.currentSession?.user ?? null;
  }

  get isAuthenticated(): boolean {
    return !!this.currentSession;
  }

  get isReady(): boolean {
    return this.initialized;
  }

  async login(email: string, password: string) {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.currentSession = data.session;
    this.listeners.forEach((cb) => cb(data.session));
    return data;
  }

  async logout(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) {
      console.warn('[SupabaseSession] Erreur lors de la déconnexion Supabase:', error.message);
    }
    this.currentSession = null;
    this.listeners.forEach((cb) => cb(null));
  }

  onSessionChange(cb: (session: Session | null) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}

export const supabaseSession = new SupabaseSessionManager();
