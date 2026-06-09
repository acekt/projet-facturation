"use client"

/**
 * AppErrorBoundary — Mur de protection contre les crashes React
 * ==============================================================
 * En contexte Electron/Desktop, un crash React sans Error Boundary
 * produit un écran BLANC TOTAL — sans message, sans possibilité de
 * récupération. L'utilisateur pense que l'application est gelée.
 *
 * Ce composant intercepte toute exception non gérée dans l'arbre
 * de composants enfants et affiche un écran de récupération propre
 * avec un bouton "Recharger" et les détails de l'erreur.
 */

import * as React from "react"
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react"

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
  showDetails: boolean
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  /** Message de fallback personnalisé (optionnel) */
  fallbackMessage?: string
}

export class AppErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo })
    // En production Electron, loguer vers le fichier de logs
    console.error('[AppErrorBoundary] Crash capturé:', error.message, errorInfo.componentStack)
  }

  handleReload = () => {
    // Réinitialiser l'état de l'Error Boundary
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false })
    // Forcer un rechargement de la fenêtre si la réinitialisation de l'état ne suffit pas
    window.location.reload()
  }

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }))
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="max-w-lg w-full">
          {/* Icône d'alerte */}
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>

          {/* Titre */}
          <h1 className="text-xl font-semibold text-foreground text-center tracking-tight mb-2">
            Une erreur inattendue s'est produite
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-8 leading-relaxed">
            {this.props.fallbackMessage ||
              "L'application a rencontré un problème. Vos données sont en sécurité — la base de données n'a pas été affectée."}
          </p>

          {/* Résumé de l'erreur */}
          {this.state.error && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 mb-6">
              <p className="text-xs font-mono text-destructive break-all">
                {this.state.error.name}: {this.state.error.message}
              </p>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="flex gap-3 mb-4">
            <button
              onClick={this.handleReload}
              className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Recharger l'application
            </button>
          </div>

          {/* Détails techniques (repliés par défaut) */}
          {this.state.errorInfo && (
            <div>
              <button
                onClick={this.toggleDetails}
                className="w-full flex items-center justify-between p-3 rounded-xl text-xs text-muted-foreground hover:bg-secondary transition-colors"
              >
                <span className="font-bold uppercase tracking-widest">Détails techniques</span>
                {this.state.showDetails
                  ? <ChevronUp className="w-4 h-4" />
                  : <ChevronDown className="w-4 h-4" />
                }
              </button>
              {this.state.showDetails && (
                <div className="mt-2 bg-secondary rounded-xl p-4 overflow-auto max-h-48">
                  <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap break-all">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }
}
