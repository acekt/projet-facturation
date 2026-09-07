import { describe, it, expect } from 'vitest';
import { useStore } from '@/lib/store';

describe('Ghost Data Lifecycle - Quote Draft', () => {
  it('clearQuoteDraft should correctly reset the global draft state', () => {
    // 1. Initial setup - Set some ghost data in the store
    const store = useStore.getState();
    store.setQuoteDraft({
      subject: 'Ghost Subject',
      discount: 500,
      items: [
        { id: 'ghost-1', description: 'Ghost Item', quantity: 2, unitPrice: 1000, total: 2000 }
      ]
    });

    // Verify it was set
    let currentDraft = useStore.getState().quoteDraft;
    expect(currentDraft.subject).toBe('Ghost Subject');
    expect(currentDraft.discount).toBe(500);
    expect(currentDraft.items.length).toBe(1);

    // 2. Action - Call clearQuoteDraft (which quote-editor.tsx calls on mount/unmount when isNew)
    useStore.getState().clearQuoteDraft();

    // 3. Assertion - Verify it's purged and set to fresh draft
    currentDraft = useStore.getState().quoteDraft;
    expect(currentDraft.subject).toBe('');
    expect(currentDraft.discount).toBe(0);
    expect(currentDraft.selectedClient).toBeNull();

    // Items should be reset to one empty item
    expect(currentDraft.items.length).toBe(1);
    expect(currentDraft.items[0].description).toBe('');
    expect(currentDraft.items[0].quantity).toBe(1);
    expect(currentDraft.items[0].unitPrice).toBe(0);

    // The status should be reset to EN_ATTENTE
    expect(currentDraft.status).toBe('EN_ATTENTE');

    // Dates should be set
    expect(currentDraft.quoteDate).toBeDefined();
    expect(currentDraft.validUntil).toBeDefined();
  });
});
