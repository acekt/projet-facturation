import * as React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Sidebar } from '@/components/layout/navigation'
import { useStore } from '@/lib/store'

describe('Composant UI Sidebar & Navigation RBAC', () => {
  beforeEach(() => {
    // Réinitialiser le store Zustand avant chaque test
    useStore.setState({
      user: null,
      isAuthenticated: false
    })
  })

  it('devrait afficher les onglets opérationnels si l\'utilisateur a le rôle USER', () => {
    // Définir un utilisateur de rôle USER dans le Store
    useStore.setState({
      user: { id: 'u1', name: 'Alice Opératrice', role: 'user' },
      isAuthenticated: true
    })

    const onPageChangeMock = vi.fn()
    const onToggleMock = vi.fn()

    render(
      <Sidebar
        currentPage="dashboard"
        onPageChange={onPageChangeMock}
        collapsed={false}
        onToggle={onToggleMock}
      />
    )

    // Vérifier la présence des boutons opérationnels
    expect(screen.getByText('Devis')).toBeInTheDocument()
    expect(screen.getByText('Factures')).toBeInTheDocument()
    expect(screen.getByText('Clients')).toBeInTheDocument()
    expect(screen.getByText('Paiements')).toBeInTheDocument()

    // Vérifier l'absence des boutons administratifs exclusifs
    expect(screen.queryByText('Journal Audit')).not.toBeInTheDocument()
    expect(screen.queryByText('Utilisateurs')).not.toBeInTheDocument()
  })

  it('devrait afficher uniquement les onglets administratifs si l\'utilisateur a le rôle ADMIN', () => {
    // Définir un administrateur dans le Store
    useStore.setState({
      user: { id: 'a1', name: 'Marc Directeur', role: 'admin' },
      isAuthenticated: true
    })

    const onPageChangeMock = vi.fn()
    const onToggleMock = vi.fn()

    render(
      <Sidebar
        currentPage="dashboard"
        onPageChange={onPageChangeMock}
        collapsed={false}
        onToggle={onToggleMock}
      />
    )

    // Vérifier la présence des boutons d'administration
    expect(screen.getByText('Journal Audit')).toBeInTheDocument()
    expect(screen.getByText('Utilisateurs')).toBeInTheDocument()

    // Vérifier que les onglets opérationnels de facturation sont masqués (étanchéité absolue)
    expect(screen.queryByText('Devis')).not.toBeInTheDocument()
    expect(screen.queryByText('Factures')).not.toBeInTheDocument()
  })

  it('devrait appeler onPageChange avec l\'ID correct lors du clic sur un onglet de navigation', () => {
    useStore.setState({
      user: { id: 'u1', name: 'Alice Opératrice', role: 'user' },
      isAuthenticated: true
    })

    const onPageChangeMock = vi.fn()
    const onToggleMock = vi.fn()

    render(
      <Sidebar
        currentPage="dashboard"
        onPageChange={onPageChangeMock}
        collapsed={false}
        onToggle={onToggleMock}
      />
    )

    // Clic sur l'onglet Devis
    const devisTab = screen.getByText('Devis')
    fireEvent.click(devisTab)

    // Vérifier le déclenchement de la redirection/changement de page
    expect(onPageChangeMock).toHaveBeenCalledWith('quotes')
  })

  it('devrait appeler onPageChange avec "new-quote" lors du clic sur le bouton d\'action "Nouveau devis"', () => {
    useStore.setState({
      user: { id: 'u1', name: 'Alice Opératrice', role: 'user' },
      isAuthenticated: true
    })

    const onPageChangeMock = vi.fn()
    const onToggleMock = vi.fn()

    render(
      <Sidebar
        currentPage="dashboard"
        onPageChange={onPageChangeMock}
        collapsed={false}
        onToggle={onToggleMock}
      />
    )

    // Clic sur le bouton d'action "Nouveau devis"
    const newQuoteBtn = screen.getByText('Nouveau devis')
    fireEvent.click(newQuoteBtn)

    // Vérifier la transition vers la page de création
    expect(onPageChangeMock).toHaveBeenCalledWith('new-quote')
  })
})
