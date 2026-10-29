"use client";

import * as React from "react";
import { AlertCircle, AlertTriangle, Info, Wrench, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getDesktopAnnouncementsAction } from "@/app/actions/hub.actions";
import type { HubAnnouncement } from "@/lib/api/hub-cache";

const LEVEL_STYLES: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
  critical: {
    bg: "bg-red-600/90 text-white",
    text: "text-white",
    border: "border-red-700",
    icon: <AlertCircle className="w-5 h-5 flex-shrink-0" />,
  },
  warning: {
    bg: "bg-amber-500/90 text-slate-950",
    text: "text-slate-950",
    border: "border-amber-600",
    icon: <AlertTriangle className="w-5 h-5 flex-shrink-0" />,
  },
  maintenance: {
    bg: "bg-blue-600/90 text-white",
    text: "text-white",
    border: "border-blue-700",
    icon: <Wrench className="w-5 h-5 flex-shrink-0" />,
  },
  info: {
    bg: "bg-slate-800/90 text-white",
    text: "text-white",
    border: "border-slate-700",
    icon: <Info className="w-5 h-5 flex-shrink-0" />,
  },
};

export function AnnouncementBanner() {
  const [announcements, setAnnouncements] = React.useState<HubAnnouncement[]>([]);
  const [dismissedIds, setDismissedIds] = React.useState<Set<string>>(new Set());

  const refreshAnnouncements = React.useCallback(async () => {
    try {
      const res = await getDesktopAnnouncementsAction();
      if (res.success && Array.isArray(res.data)) {
        setAnnouncements(res.data);
      }
    } catch (err) {
      console.warn("[AnnouncementBanner] Erreur chargement annonces:", err);
    }
  }, []);

  React.useEffect(() => {
    refreshAnnouncements();
    const onRefresh = () => refreshAnnouncements();
    window.addEventListener("facturier:data-refresh", onRefresh);
    return () => window.removeEventListener("facturier:data-refresh", onRefresh);
  }, [refreshAnnouncements]);

  const activeAnnouncement = announcements.find((a) => !dismissedIds.has(a.id));

  if (!activeAnnouncement) return null;

  const style = LEVEL_STYLES[activeAnnouncement.level] || LEVEL_STYLES.info;

  return (
    <AnimatePresence>
      <motion.aside
        role="alert"
        aria-live="polite"
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className={`w-full ${style.bg} border-b ${style.border} px-4 py-2.5 z-40 backdrop-blur-md transition-all shadow-sm`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {style.icon}
            <div className="flex-1 truncate">
              <strong className="font-semibold tracking-wide mr-2">{activeAnnouncement.title}</strong>
              <span className="opacity-95 text-xs sm:text-sm">{activeAnnouncement.body}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDismissedIds((prev) => new Set([...prev, activeAnnouncement.id]))}
            className="p-1 rounded-md hover:bg-black/10 focus:outline-none transition-colors"
            aria-label="Fermer l'annonce"
          >
            <X className="w-4 h-4 opacity-80 hover:opacity-100" />
          </button>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}
