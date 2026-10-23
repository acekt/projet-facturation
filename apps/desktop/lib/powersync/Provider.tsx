'use client';

import React, { ReactNode, useEffect } from 'react';
import { PowerSyncDatabase } from '@powersync/web';
import { PowerSyncContext } from '@powersync/react';
import { AppSchema } from './AppSchema';
import { SupabaseConnector } from './SupabaseConnector';


// Initialisation de la base de données locale PowerSync
export const powerSync = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    dbFilename: 'facturier-local.sqlite'
  }
});

// Initialisation du connecteur Supabase (utilisé par CloudSyncRunner pour la session JWT)
export const connector = new SupabaseConnector();

export const PowerSyncProvider = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    const hasPowerSyncEndpoint = Boolean(process.env.NEXT_PUBLIC_POWERSYNC_URL);

    const initPowerSync = async () => {
      try {
        // 1. Initialiser le connecteur Supabase (récupère la session persistée pour CloudSyncRunner)
        await connector.init();

        // 2. N'initialiser le moteur WASM PowerSync que si une URL PowerSync dédiée est configurée.
        // Par défaut, la synchronisation bidirectionnelle passe par CloudSyncService (better-sqlite3 <-> Supabase).
        if (!hasPowerSyncEndpoint) {
          return;
        }

        await powerSync.init();

        unsubscribe = connector.registerListener({
          sessionStarted: () => {
            powerSync.connect(connector).catch((err) => {
              console.warn('[PowerSync] Connexion asynchrone:', err);
            });
          },
          sessionEnded: () => {
            powerSync.disconnect().catch((err) => {
              console.warn('[PowerSync] Déconnexion asynchrone:', err);
            });
          }
        });

        if (connector.isAuthenticated) {
          powerSync.connect(connector).catch((err) => {
            console.warn('[PowerSync] Connexion initiale:', err);
          });
        }
      } catch (error) {
        console.warn('[PowerSync] Initialisation locale:', error);
      }
    };

    initPowerSync();

    return () => {
      if (unsubscribe) unsubscribe();
      if (hasPowerSyncEndpoint) {
        powerSync.disconnect().catch(() => {});
      }
    };
  }, []);

  return (
    <PowerSyncContext.Provider value={powerSync}>
      {children}
    </PowerSyncContext.Provider>
  );
};
