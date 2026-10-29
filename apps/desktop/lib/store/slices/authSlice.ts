"use client";

import { StateCreator } from "zustand";
import type { DashboardMetricsResponse } from "@/lib/types/api";
import { User, RolePermissions, getPermissionsForRole } from "../types";

export interface AuthSlice {
  user: User | null;
  permissions: RolePermissions | null;
  isAuthenticated: boolean;
  isDataLoaded: boolean;
  dashboardMetrics: DashboardMetricsResponse | null;

  setIsDataLoaded: (isDataLoaded: boolean) => void;
  setDashboardMetrics: (dashboardMetrics: DashboardMetricsResponse | null) => void;
  setUser: (user: User | null) => void;
}

export const createAuthSlice: StateCreator<AuthSlice, [], [], AuthSlice> = (set) => ({
  user: null,
  permissions: null,
  isAuthenticated: false,
  isDataLoaded: false,
  dashboardMetrics: null,

  setIsDataLoaded: (isDataLoaded) => set({ isDataLoaded }),
  setDashboardMetrics: (dashboardMetrics) => set({ dashboardMetrics }),
  setUser: (user) => {
    const permissions = user ? getPermissionsForRole(user.role) : null;
    set({ user, permissions, isAuthenticated: !!user });
  },
});
