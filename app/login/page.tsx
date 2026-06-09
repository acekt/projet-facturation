"use client"

import React from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Lock } from "lucide-react"
import { useStore } from "@/lib/store"

export default function LoginPage() {
  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const router = useRouter()
  const setUser = useStore((state) => state.setUser)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("Bienvenue dans L'Étoile")
        setUser(data.user)
        router.push('/')
        router.refresh()
      } else {
        toast.error(data.error || "Erreur de connexion")
      }
    } catch (err) {
      toast.error("Impossible de joindre le serveur local")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-2xl border-primary/10">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-2">
            <Lock className="w-8 h-8" />
          </div>
          <CardTitle className="text-3xl font-semibold text-primary tracking-tighter">L'ÉTOILE</CardTitle>
          <CardDescription>
            Gestion Commerciale & Facturation (Gabon)
            <br />
            <span className="text-xs italic text-muted-foreground mt-1 block">Accès sécurisé local</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Identifiant</Label>
              <Input
                id="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={loading}>
              {loading ? "Vérification..." : "Se connecter"}
            </Button>
          </form>
          <p className="mt-8 text-center text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
            Logiciel de Facturation Conforme DGI-Gabon
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
