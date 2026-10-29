'use client';

import { useEffect, useState, useCallback } from 'react';

export interface UnsavedChangesGuardOptions {
  isDirty: boolean;
  message?: string;
}

export interface UnsavedChangesGuardResult {
  showPrompt: boolean;
  confirmLeave: () => void;
  cancelLeave: () => void;
  guardNavigation: (proceed: () => void) => void;
}

/**
 * Garde-fou Poka-Yoke contre la perte accidentelle de données non sauvegardées.
 * - Intercepte `beforeunload` du navigateur / de la fenêtre Electron.
 * - Fournit un intercepteur d'action locale pour confirmer la sortie si `isDirty === true`.
 */
export function useUnsavedChangesGuard({
  isDirty,
  message = 'Vous avez des modifications non enregistrées. Voulez-vous vraiment quitter ?',
}: UnsavedChangesGuardOptions): UnsavedChangesGuardResult {
  const [showPrompt, setShowPrompt] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Avertissement natif si rechargement de fenêtre
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty, message]);

  const guardNavigation = useCallback(
    (proceed: () => void) => {
      if (isDirty) {
        setPendingAction(() => proceed);
        setShowPrompt(true);
      } else {
        proceed();
      }
    },
    [isDirty]
  );

  const confirmLeave = useCallback(() => {
    setShowPrompt(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }, [pendingAction]);

  const cancelLeave = useCallback(() => {
    setShowPrompt(false);
    setPendingAction(null);
  }, []);

  return {
    showPrompt,
    confirmLeave,
    cancelLeave,
    guardNavigation,
  };
}

