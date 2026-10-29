/**
 * Utilitaire centralisé de gestion et formatage des erreurs d'actions serveur et services.
 * Éradique l'usage de `catch (err: any)` au profit d'un typage sûr `catch (err: unknown)`.
 */
export function getErrorMessage(err: unknown, fallback: string = 'Une erreur inattendue est survenue'): string {
  if (!err) {
    return fallback;
  }

  if (typeof err === 'string') {
    return err;
  }

  if (err instanceof Error) {
    return err.message || fallback;
  }

  if (typeof err === 'object' && err !== null) {
    if ('message' in err && typeof (err as { message: unknown }).message === 'string') {
      return (err as { message: string }).message;
    }
    if ('error' in err && typeof (err as { error: unknown }).error === 'string') {
      return (err as { error: string }).error;
    }
  }

  return fallback;
}

/**
 * Standardise le retour d'une action serveur sous forme de résultat typé `{ success: boolean; data?: T; error?: string }`.
 */
export type ActionResult<T = void> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: string };

export function actionSuccess<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function actionFailure(err: unknown, fallback?: string): ActionResult<never> {
  return { success: false, error: getErrorMessage(err, fallback) };
}

