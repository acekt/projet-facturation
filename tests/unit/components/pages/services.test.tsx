import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ServicesPage } from '@/components/pages/services'
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

describe('ServicesPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
    )
  })

  it('prevents double submission when deleting service', async () => {
    const user = userEvent.setup()
    const removeServiceMock = vi.fn()

    mockStore({
      services: [{ id: '1', name: 'Service 1', description: 'Desc 1', unitPrice: 100, category: 'Cat 1' }],
      user: { role: 'admin' },
      viewFormat: { services: 'table' }, // Force view format that reveals the dropdown
      isDataLoaded: true,
      setServices: vi.fn(),
      addService: vi.fn(),
      removeService: removeServiceMock,
      updateService: vi.fn(),
      replaceService: vi.fn(),
      setViewFormat: vi.fn(),
    })

    // Deliberate delay to test double submission
    global.fetch = vi.fn().mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      }), 100))
    )

    render(<ServicesPage />)

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
      expect(removeServiceMock).toHaveBeenCalledTimes(1)
    })
  })

  it('hides sensitive buttons for non-admin users (Visual RBAC)', async () => {
    const user = userEvent.setup()
    mockStore({
      services: [{ id: '1', name: 'Service 1', description: 'Desc 1', unitPrice: 100, category: 'Cat 1' }],
      user: { role: 'user' }, // Not admin
      viewFormat: { services: 'table' },
      isDataLoaded: true,
      setServices: vi.fn(),
      addService: vi.fn(),
      removeService: vi.fn(),
      updateService: vi.fn(),
      replaceService: vi.fn(),
      setViewFormat: vi.fn(),
    })

    render(<ServicesPage />)

    // Nouveau service button should not exist
    expect(screen.queryByText('Nouveau service')).not.toBeInTheDocument()

    // Dropdown should not have edit/delete for non-admin
    const dropdownTrigger = screen.getAllByTestId('dropdown-trigger')[0]
    await user.click(dropdownTrigger)

    expect(screen.queryByTestId('dropdown-item-delete')).not.toBeInTheDocument()
    expect(screen.queryByText('Modifier')).not.toBeInTheDocument()
  })

  it('renders 2000 services efficiently (Performance)', async () => {
    const services = Array.from({ length: 2000 }, (_, i) => ({
      id: `service-${i}`,
      name: `Service ${i}`,
      description: `Desc ${i}`,
      unitPrice: 100,
      category: 'Cat 1'
    }))

    mockStore({
      services,
      user: { role: 'admin' },
      viewFormat: { services: 'table' },
      isDataLoaded: true,
      setServices: vi.fn(),
      addService: vi.fn(),
      removeService: vi.fn(),
      updateService: vi.fn(),
      replaceService: vi.fn(),
      setViewFormat: vi.fn(),
    })

    const start = performance.now()
    render(<ServicesPage />)
    const end = performance.now()

    // The pagination should kick in and only render the first page
    // So the render time should be fast even with 2000 items in store
    expect(end - start).toBeLessThan(300) // Render should take less than 300ms
    expect(screen.getByText('Service 0')).toBeInTheDocument()

    // Verify it only renders a page size of items
    const displayedItems = screen.getAllByTestId('dropdown-trigger')
    expect(displayedItems.length).toBeLessThan(2000)
  })
})
