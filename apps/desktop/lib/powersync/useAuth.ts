'use client';

import { useState, useEffect } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { connector } from './Provider';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(connector.session);
  const [user, setUser] = useState<User | null>(connector.user);
  const [isLoading, setIsLoading] = useState(!connector.ready);

  useEffect(() => {
    setSession(connector.session);
    setUser(connector.user);
    if (connector.ready) {
      setIsLoading(false);
    }

    const unsubscribe = connector.registerListener({
      initialized: () => {
        setSession(connector.session);
        setUser(connector.user);
        setIsLoading(false);
      },
      sessionStarted: (newSession: Session) => {
        setSession(newSession);
        setUser(newSession.user);
        setIsLoading(false);
      },
      sessionEnded: () => {
        setSession(null);
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    return await connector.login(email, password);
  };

  const logout = async () => {
    return await connector.logout();
  };

  return {
    session,
    user,
    isAuthenticated: !!session,
    isLoading,
    login,
    logout
  };
}
