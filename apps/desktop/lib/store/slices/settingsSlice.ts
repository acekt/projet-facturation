"use client";

import { StateCreator } from "zustand";
import { Settings, ViewFormat, DEFAULT_SETTINGS } from "../types";

export interface SettingsSlice {
  settings: Settings;
  viewFormat: ViewFormat;
  setSettings: (settings: Settings) => void;
  updateSettings: (updates: Partial<Settings>) => void;
  setViewFormat: (
    page: keyof ViewFormat,
    format: ViewFormat[keyof ViewFormat]
  ) => void;
}

export const createSettingsSlice: StateCreator<SettingsSlice, [], [], SettingsSlice> = (set) => ({
  settings: DEFAULT_SETTINGS,
  viewFormat: {
    quotes: "table",
    invoices: "table",
    clients: "block",
    services: "block",
    creditNotes: "horizontal",
  },

  setSettings: (settings) => set({ settings }),

  updateSettings: (updates) =>
    set((state) => ({ settings: { ...state.settings, ...updates } })),

  setViewFormat: (page, format) =>
    set((state) => ({
      viewFormat: { ...state.viewFormat, [page]: format },
    })),
});
