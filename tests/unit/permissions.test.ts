import { describe, it, expect } from 'vitest';
import { verifyDocumentOwnership } from '@/lib/api/permissions';

describe('verifyDocumentOwnership', () => {
  it('should return null (allow access) for admin even if document is owned by someone else', () => {
    const result = verifyDocumentOwnership('user-1', 'admin-1', 'admin', 'access');
    expect(result).toBeNull();
  });

  it('should return null (allow access) for user if they own the document', () => {
    const result = verifyDocumentOwnership('user-1', 'user-1', 'user', 'update');
    expect(result).toBeNull();
  });

  it('should return 403 Forbidden for user if they do not own the document', async () => {
    const result = verifyDocumentOwnership('user-2', 'user-1', 'user', 'delete');
    expect(result).not.toBeNull();
    const json = await result?.json();
    expect(result?.status).toBe(403);
    expect(json.error).toBe('Forbidden: You can only delete your own documents');
  });

  it('should return 403 Forbidden for user if document has no owner (undefined)', async () => {
    const result = verifyDocumentOwnership(undefined, 'user-1', 'user', 'update');
    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
  });
});
