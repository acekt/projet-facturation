import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ClientsPage } from '@/components/pages/clients'
import { useStore } from '@/lib/store'
import '@testing-library/jest-dom'
import React from 'react'

// Mock des composants UI pour simplifier
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
}))
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled }: any) => (
    <button data-testid="button" onClick={onClick} disabled={disabled}>{children}</button>
  ),
}))
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div data-testid="dropdown-trigger" onClick={(e) => { e.currentTarget.nextElementSibling?.classList.toggle('hidden') }}>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content" className="hidden">{children}</div>,
  DropdownMenuItem: ({ children, onClick, className }: any) => <div data-testid={className?.includes('text-destructive') ? 'dropdown-item-delete' : 'dropdown-item'} onClick={onClick}>{children}</div>,
}))
vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open, onOpenChange }: any) => (open ? <div data-testid="alert-dialog">{children}</div> : null),
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: any) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogCancel: ({ children, disabled }: any) => <button disabled={disabled}>{children}</button>,
  AlertDialogAction: ({ children, onClick, disabled, className }: any) => (
    <button data-testid="alert-dialog-action" onClick={onClick} disabled={disabled} className={className}>{children}</button>
  ),
}))

vi.mock('@/lib/store', () => ({
  useStore: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  }
}))

vi.mock('@/components/ui/pagination-custom', () => ({
  Pagination: () => <div data-testid="pagination">Pagination</div>
}))

vi.mock('@/components/ui/empty-state', () => ({
  EmptyState: ({ title }: any) => <div data-testid="empty-state">{title}</div>
}))

// Fix ResizeObserver not being defined in jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const mockStore = (state: any) => {
  return vi.mocked(useStore).mockImplementation((selector: any) => selector(state))
}

describe('ClientsPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
    )
  })

  it('prevents double submission when deleting client', async () => {
    const user = userEvent.setup()
    const removeClientMock = vi.fn()

    mockStore({
      clients: [{ id: '1', name: 'Client 1', email: 'test@example.com', phone: '', address: '', createdAt: new Date().toISOString() }],
      invoices: [],
      user: { role: 'admin' },
      viewFormat: { clients: 'table' }, // Force view format that reveals the dropdown
      isDataLoaded: true,
      setClients: vi.fn(),
      addClient: vi.fn(),
      removeClient: removeClientMock,
      updateClient: vi.fn(),
      replaceClient: vi.fn(),
      setViewFormat: vi.fn(),
    })

    // Deliberate delay to test double submission
    global.fetch = vi.fn().mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      }), 100))
    )

    render(<ClientsPage />)

    const dropdownTrigger = screen.getAllByTestId('dropdown-trigger')[0]
    await user.click(dropdownTrigger)

    const deleteOption = screen.getByTestId('dropdown-item-delete')
    await user.click(deleteOption)

    const confirmButton = screen.getByTestId('alert-dialog-action')
    expect(confirmButton).toBeInTheDocument()

    // Click multiple times
    fireEvent.click(confirmButton)
    fireEvent.click(confirmButton)
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(removeClientMock).toHaveBeenCalledTimes(1)
    })
  })

  it('hides sensitive buttons for non-admin users (Visual RBAC)', async () => {
    const user = userEvent.setup()
    mockStore({
      clients: [{ id: '1', name: 'Client 1', email: 'test@example.com', phone: '', address: '', createdAt: new Date().toISOString() }],
      invoices: [],
      user: { role: 'user' }, // Not admin
      viewFormat: { clients: 'table' },
      isDataLoaded: true,
      setClients: vi.fn(),
      addClient: vi.fn(),
      removeClient: vi.fn(),
      updateClient: vi.fn(),
      replaceClient: vi.fn(),
      setViewFormat: vi.fn(),
    })

    render(<ClientsPage />)

    // New Client button should not exist
    expect(screen.queryByText('Nouveau client')).not.toBeInTheDocument()

    // Dropdown should not have edit/delete for non-admin
    const dropdownTrigger = screen.getAllByTestId('dropdown-trigger')[0]
    await user.click(dropdownTrigger)

    expect(screen.queryByTestId('dropdown-item-delete')).not.toBeInTheDocument()
    expect(screen.queryByText('Modifier')).not.toBeInTheDocument()
  })

  it('renders 2000 clients efficiently (Performance)', async () => {
    const clients = Array.from({ length: 2000 }, (_, i) => ({
      id: `client-${i}`,
      name: `Client ${i}`,
      email: `client${i}@example.com`,
      phone: '',
      address: '',
      createdAt: new Date().toISOString()
    }))

    mockStore({
      clients,
      invoices: [],
      user: { role: 'admin' },
      viewFormat: { clients: 'table' },
      isDataLoaded: true,
      setClients: vi.fn(),
      addClient: vi.fn(),
      removeClient: vi.fn(),
      updateClient: vi.fn(),
      replaceClient: vi.fn(),
      setViewFormat: vi.fn(),
    })

    const start = performance.now()
    render(<ClientsPage />)
    const end = performance.now()

    // The pagination should kick in and only render the first page
    // So the render time should be fast even with 2000 items in store
    expect(end - start).toBeLessThan(300) // Render should take less than 300ms
    expect(screen.getByText('Client 0')).toBeInTheDocument()

    // Verify it only renders a page size of items (assuming page size is e.g., 20 or similar, not 2000)
    // The items shown will be limited by pagination
    const displayedItems = screen.getAllByTestId('dropdown-trigger')
    expect(displayedItems.length).toBeLessThan(2000)
  })
})
