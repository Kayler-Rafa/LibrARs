import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GestureEntry } from '@/types'
import { generateId } from '@/lib/utils'
import { api } from '@/lib/api'

interface GestureStore {
  gestures: GestureEntry[]

  // Ações locais (localStorage)
  addGesture: (name: string, samples: number[][]) => Promise<GestureEntry>
  updateGesture: (id: string, updates: Partial<GestureEntry>) => void
  deleteGesture: (id: string) => Promise<void>
  clearAll: () => void
  exportAsJson: () => string
  importFromJson: (json: string) => void

  // Sincronização com backend
  loadFromApi: () => Promise<void>
  mergeFromApi: (apiGestures: { id: string; name: string; samples: number[][];
    sample_count: number; created_at: string }[]) => void
}

function isAuthed(): boolean {
  return !!localStorage.getItem('libras-ar-token')
}

export const useGestureStore = create<GestureStore>()(
  persist(
    (set, get) => ({
      gestures: [],

      // ── addGesture ──────────────────────────────────────────────────────────
      addGesture: async (name, samples) => {
        const entry: GestureEntry = {
          id: generateId(),
          name,
          samples,
          sampleCount: samples.length,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isPublic: false,
        }
        set((state) => ({ gestures: [...state.gestures, entry] }))

        // Sync para API em background (não bloqueia UI)
        if (isAuthed()) {
          api.gestures
            .upsert({ id: entry.id, name: entry.name, samples: entry.samples })
            .catch((e) => console.warn('[gestureStore] sync add failed:', e))
        }

        return entry
      },

      // ── updateGesture ───────────────────────────────────────────────────────
      updateGesture: (id, updates) => {
        set((state) => ({
          gestures: state.gestures.map((g) =>
            g.id === id ? { ...g, ...updates, updatedAt: new Date().toISOString() } : g
          ),
        }))
      },

      // ── deleteGesture ───────────────────────────────────────────────────────
      deleteGesture: async (id) => {
        set((state) => ({ gestures: state.gestures.filter((g) => g.id !== id) }))

        if (isAuthed()) {
          api.gestures
            .delete(id)
            .catch((e) => console.warn('[gestureStore] sync delete failed:', e))
        }
      },

      // ── clearAll ────────────────────────────────────────────────────────────
      clearAll: () => set({ gestures: [] }),

      // ── exportAsJson ────────────────────────────────────────────────────────
      exportAsJson: () => JSON.stringify(get().gestures, null, 2),

      // ── importFromJson ──────────────────────────────────────────────────────
      importFromJson: (json) => {
        try {
          const imported = JSON.parse(json) as GestureEntry[]
          if (!Array.isArray(imported)) throw new Error('Formato inválido')
          set((state) => {
            const existingIds = new Set(state.gestures.map((g) => g.id))
            const newGestures = imported.filter((g) => !existingIds.has(g.id))
            return { gestures: [...state.gestures, ...newGestures] }
          })

          // Sync novos gestos para API
          if (isAuthed()) {
            const existingIds = new Set(get().gestures.map((g) => g.id))
            const toSync = imported.filter((g) => !existingIds.has(g.id))
            toSync.forEach((g) =>
              api.gestures
                .upsert({ id: g.id, name: g.name, samples: g.samples })
                .catch(() => null)
            )
          }
        } catch {
          console.error('[gestureStore] importFromJson failed')
        }
      },

      // ── loadFromApi ─────────────────────────────────────────────────────────
      // Chamado após login: busca gestos do servidor e faz merge
      loadFromApi: async () => {
        if (!isAuthed()) return
        try {
          const remote = await api.gestures.list()
          get().mergeFromApi(remote)
        } catch (e) {
          console.warn('[gestureStore] loadFromApi failed:', e)
        }
      },

      // ── mergeFromApi ────────────────────────────────────────────────────────
      mergeFromApi: (apiGestures) => {
        set((state) => {
          const localMap = new Map(state.gestures.map((g) => [g.id, g]))

          for (const ag of apiGestures) {
            const existing = localMap.get(ag.id)
            if (!existing) {
              // Novo gesto vindo da API
              localMap.set(ag.id, {
                id: ag.id,
                name: ag.name,
                samples: ag.samples,
                sampleCount: ag.sample_count,
                createdAt: ag.created_at,
                updatedAt: ag.created_at,
                isPublic: false,
              })
            }
            // Se já existe localmente, mantém o local (local has priority)
          }

          return { gestures: Array.from(localMap.values()) }
        })
      },
    }),
    { name: 'libras-ar-gestures' }
  )
)
