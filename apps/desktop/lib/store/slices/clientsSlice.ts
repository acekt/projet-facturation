"use client";

import { StateCreator } from "zustand";
import { Client } from "../types";

export interface ClientsSlice {
  clients: Client[];
  setClients: (clients: Client[]) => void;
  addClient: (client: Client) => void;
  removeClient: (id: string) => void;
  updateClient: (id: string, data: Partial<Client>) => void;
  replaceClient: (tempId: string, confirmed: Client) => void;
}

export const createClientsSlice: StateCreator<ClientsSlice, [], [], ClientsSlice> = (set) => ({
  clients: [],

  setClients: (clients) => set({ clients }),

  addClient: (client) =>
    set((state) => ({ clients: [...state.clients, client] })),

  removeClient: (id) =>
    set((state) => ({ clients: state.clients.filter((c) => c.id !== id) })),

  updateClient: (id, data) =>
    set((state) => ({
      clients: state.clients.map((c) => (c.id === id ? { ...c, ...data } : c)),
    })),

  replaceClient: (tempId, confirmed) =>
    set((state) => ({
      clients: state.clients.map((c) => (c.id === tempId ? confirmed : c)),
    })),
});
