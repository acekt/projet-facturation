"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { motion, AnimatePresence } from "framer-motion"
import { Moon, Sun, Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button 
        variant="ghost" 
        size="icon" 
        className="w-9 h-9 rounded-xl"
      >
        <div className="w-5 h-5 bg-muted rounded animate-pulse" />
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="w-9 h-9 rounded-xl bg-secondary/50 hover:bg-secondary text-foreground border border-border"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={resolvedTheme}
              initial={{ scale: 0, rotate: -90, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0, rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {resolvedTheme === "dark" ? (
                <Moon className="w-[18px] h-[18px]" />
              ) : (
                <Sun className="w-[18px] h-[18px]" />
              )}
            </motion.div>
          </AnimatePresence>
          <span className="sr-only">Basculer le theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem 
          onClick={() => setTheme("light")}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Sun className="w-4 h-4" />
          <span>Clair</span>
          {theme === "light" && (
            <motion.div 
              layoutId="activeTheme"
              className="ml-auto w-2 h-2 rounded-full bg-primary"
            />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme("dark")}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Moon className="w-4 h-4" />
          <span>Sombre</span>
          {theme === "dark" && (
            <motion.div 
              layoutId="activeTheme"
              className="ml-auto w-2 h-2 rounded-full bg-primary"
            />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme("system")}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Monitor className="w-4 h-4" />
          <span>Systeme</span>
          {theme === "system" && (
            <motion.div 
              layoutId="activeTheme"
              className="ml-auto w-2 h-2 rounded-full bg-primary"
            />
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
