'use client';

import { useEffect } from 'react';

export interface KeyboardShortcutHandlers {
  onSave?: () => void | Promise<void>;
  onNew?: () => void | Promise<void>;
  onEscape?: () => void;
  enabled?: boolean;
}

/**
 * Hook ergonomique de raccourcis clavier applicatifs (Loi de Fitts & Efficacité Métier).
 * - Ctrl+S / Cmd+S : Enregistrer le formulaire actif ou déclencher l'action de sauvegarde.
 * - Ctrl+N / Cmd+N : Créer un nouvel élément (nouvelle facture, nouveau devis, etc.).
 * - Échap : Fermer ou annuler l'action en cours.
 */
export function useKeyboardShortcuts({
  onSave,
  onNew,
  onEscape,
  enabled = true,
}: KeyboardShortcutHandlers): void {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const isModifierPressed = event.ctrlKey || event.metaKey;

      if (isModifierPressed && event.key.toLowerCase() === 's') {
        if (onSave) {
          event.preventDefault();
          event.stopPropagation();
          void onSave();
        }
      } else if (isModifierPressed && event.key.toLowerCase() === 'n') {
        if (onNew) {
          event.preventDefault();
          event.stopPropagation();
          void onNew();
        }
      } else if (event.key === 'Escape') {
        if (onEscape) {
          event.preventDefault();
          onEscape();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onSave, onNew, onEscape, enabled]);
}

