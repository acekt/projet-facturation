import { NextResponse } from 'next/server';

/**
 * Checks if the current user owns the document or is an admin.
 * If the user does not have permission, returns a 403 Forbidden response.
 * Otherwise, returns null, indicating the request can proceed.
 */
export function verifyDocumentOwnership(
  documentOwnerId: string | undefined,
  sessionUserId: string,
  sessionRole: string,
  action: 'access' | 'update' | 'delete' = 'access'
): NextResponse | null {
  if (sessionRole !== 'admin' && documentOwnerId !== sessionUserId) {
    return NextResponse.json(
      { error: `Forbidden: You can only ${action} your own documents` },
      { status: 403 }
    );
  }
  return null;
}
