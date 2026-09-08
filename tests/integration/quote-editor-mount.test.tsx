import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import { useStore } from '@/lib/store';
import { QuoteEditor } from '@/components/pages/quote-editor';

// Mock matchMedia for Radix UI dialogs/tooltips
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('QuoteEditor Integration - Ghost Data Purge', () => {
  beforeEach(() => {
    // Populate the store with ghost data
    useStore.setState({
      quoteDraft: {
        id: 'ghost-draft-id',
        quoteDate: '2023-01-01',
        validUntil: '2023-01-31',
        subject: 'Ghost Subject Data',
        status: 'EN_ATTENTE',
        selectedClient: null,
        items: [
          {
            id: 'ghost-item-1',
            description: 'Ghost Item Description',
            quantity: 5,
            unitPrice: 1000,
            total: 5000,
          },
        ],
        subtotal: 5000,
        discount: 100,
        taxBase: 4900,
        tvaAmount: 0,
        tpsAmount: 0,
        cssAmount: 0,
        total: 4900,
        notes: 'Ghost Notes',
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should purge ghost data and initialize a clean draft when isNew is true on mount and unmount', async () => {
    // Verify ghost data is in the store initially
    expect(useStore.getState().quoteDraft.subject).toBe('Ghost Subject Data');
    expect(useStore.getState().quoteDraft.items[0].description).toBe('Ghost Item Description');

    let unmountComponent: () => void;
    // Render the component as a new quote
    await act(async () => {
      const { unmount } = render(<QuoteEditor onBack={vi.fn()} />); // isNew is inferred to be true if editingId is not provided
      unmountComponent = unmount;
    });

    // Wait for the component to mount and run its useEffect to purge the draft
    await waitFor(() => {
      const draft = useStore.getState().quoteDraft;
      // Should be purged and reset to default
      expect(draft.subject).toBe('');
      expect(draft.discount).toBe(0);
      expect(draft.items.length).toBe(1);
      expect(draft.items[0].description).toBe('');
      expect(draft.items[0].unitPrice).toBe(0);
    });

    // Check UI to see if it renders clean state
    // We expect the subject input to be empty, not showing "Ghost Subject Data"
    const subjectInput = screen.getByPlaceholderText("Ex: Développement de l'application mobile") as HTMLInputElement;
    expect(subjectInput.value).toBe('');

    // Fill in some temporary data to check unmount purge
    useStore.setState({
        quoteDraft: {
            ...useStore.getState().quoteDraft,
            subject: 'Temporary Subject Before Unmount'
        }
    });

    // Unmount the component to trigger the cleanup useEffect
    act(() => {
      unmountComponent();
    });

    // Verify draft was cleared again on unmount
    await waitFor(() => {
        const draftAfterUnmount = useStore.getState().quoteDraft;
        expect(draftAfterUnmount.subject).toBe('');
        expect(draftAfterUnmount.discount).toBe(0);
        expect(draftAfterUnmount.items.length).toBe(1);
        expect(draftAfterUnmount.items[0].description).toBe('');
    });
  });

  it('should NOT purge data if loading an existing quote (editingId provided)', async () => {
    // Mock the fetch call so it doesn't try to load and fail (which calls onBack and changes state)
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        clientId: 'client-1',
        clientName: 'Test Client', // Add client name to prevent split of undefined error
        items: [],
        date: '2023-01-01',
        validUntil: '2023-01-31',
        subject: 'Ghost Subject Data', // keep same as draft to verify it's the fetched data or at least not wiped
        discount: 100,
        notes: 'Loaded notes',
        status: 'EN_ATTENTE'
      }),
    });

    // Render the component as an existing quote
    await act(async () => {
      render(<QuoteEditor onBack={vi.fn()} editingId="some-quote-id" />);
    });

    // Give some time for useEffect to potentially run (it shouldn't purge)
    await new Promise((resolve) => setTimeout(resolve, 100));

    const draft = useStore.getState().quoteDraft;
    // Data should still be there because we are not in 'New' mode
    expect(draft.subject).toBe('Ghost Subject Data');
    expect(draft.items[0].description).toBe('Ghost Item Description');
  });
});
