import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GestureEntry } from '@/types'
import { generateId } from '@/lib/utils'

interface GestureStore {
  gestures: GestureEntry[]
  addGesture: (name: string, samples: number[][]) => GestureEntry
  updateGesture: (id: string, updates: Partial<GestureEntry>) => void
  deleteGesture: (id: string) => void
  clearAll: () => void
  exportAsJson: () => string
  importFromJson: (json: string) => void
}

export const useGestureStore = create<GestureStore>()(
  persist(
    (set, get) => ({
      gestures: [],

      addGesture: (name, samples) => {
        const entry: GestureEntry = {
          id: generateId(),
          name,
          samples,
          sampleCount: samples.length,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isPublic: false,
        }
        set(state => ({ gestures: [...state.gestures, entry] }))
        return entry
      },

      updateGesture: (id, updates) => {
        set(state => ({
          gestures: state.gestures.map(g =>
            g.id === id ? { ...g, ...updates, updatedAt: new Date().toISOString() } : g
          ),
        }))
      },

      deleteGesture: id => {
        set(state => ({ gestures: state.gestures.filter(g => g.id !== id) }))
      },

      clearAll: () => set({ gestures: [] }),

      exportAsJson: () => JSON.stringify(get().gestures, null, 2),

      importFromJson: json => {
        try {
          const imported = JSON.parse(json) as GestureEntry[]
          if (!Array.isArray(imported)) throw new Error('Invalid format')
          set(state => {
            const existingIds = new Set(state.gestures.map(g => g.id))
            const newGestures = imported.filter(g => !existingIds.has(g.id))
            return { gestures: [...state.gestures, ...newGestures] }
          })
        } catch {
          console.error('Failed to import gestures')
        }
      },
    }),
    { name: 'libras-ar-gestures' }
  )
)
