"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Users, UserPlus, Shield, ShieldCheck, Mail, MoreVertical, Trash2, Key } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function UsersPage() {
  const [users, setUsers] = React.useState<any[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    // Note: We need an API for this. For now, we'll fetch from a generic endpoint or mock if not available.
    // In L'Étoile, we added the users table in lib/db.ts
    fetch('/api/auth/me') // Just a placeholder to see if we are auth
      .then(() => {
        // Mocking for UI dev since specific list API might be missing
        setUsers([
          { id: '1', name: 'Administrateur Système', username: 'admin@letoile.ga', role: 'admin' },
          { id: '2', name: 'Opérateur Service Client', username: 'user@letoile.ga', role: 'user' }
        ])
        setIsLoading(false)
      })
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Gestion des Utilisateurs</h1>
          <p className="text-muted-foreground mt-1">Gérez les accès et les permissions de votre équipe</p>
        </div>
        <Button className="gap-2 bg-primary">
          <UserPlus className="w-4 h-4" />
          Ajouter un utilisateur
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((user) => (
          <Card key={user.id} className="bg-card border-border hover:border-primary/20 transition-all">
            <CardHeader className="flex flex-row items-center gap-4 pb-4">
              <Avatar className="h-12 w-12 border-2 border-border">
                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                  {user.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base truncate">{user.name}</CardTitle>
                <CardDescription className="truncate">{user.username}</CardDescription>
              </div>
              {user.role === 'admin' ? (
                <ShieldCheck className="w-5 h-5 text-indigo-500" />
              ) : (
                <Shield className="w-5 h-5 text-muted-foreground" />
              )}
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between pt-2">
                <Badge variant="outline" className={user.role === 'admin' ? "bg-indigo-500/10 text-indigo-500" : "bg-secondary text-muted-foreground"}>
                  {user.role === 'admin' ? 'Administrateur' : 'Opérateur'}
                </Badge>
                <div className="flex gap-2">
                   <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                      <Key className="w-4 h-4" />
                   </Button>
                   <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                   </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
