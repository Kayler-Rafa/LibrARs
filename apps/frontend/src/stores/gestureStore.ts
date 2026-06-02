import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GestureEntry } from '@/types'
import { generateId } from '@/lib/utils'
import { api } from '@/lib/api'

interface GestureStore {
  gestures: GestureEntry[]
  pendingSync: boolean  // true se há algum gesto com erro de sync

  addGesture: (name: string, samples: number[][]) => Promise<GestureEntry>
  updateGesture: (id: string, updates: Partial<GestureEntry>) => void
  deleteGesture: (id: string) => Promise<void>
  retrySync: (id: string) => Promise<void>
  clearAll: () => void
  exportAsJson: () => string
  importFromJson: (json: string) => void

  loadFromApi: () => Promise<void>
  mergeFromApi: (apiGestures: { id: string; name: string; samples: number[][];
    sample_count: number; created_at: string; updated_at?: string }[]) => void
}

function isAuthed(): boolean {
  return !!localStorage.getItem('libras-ar-token')
}

export const useGestureStore = create<GestureStore>()(
  persist(
    (set, get) => ({
      gestures: [],
      pendingSync: false,

      // ── addGesture ──────────────────────────────────────────────────────────
      // Salva localmente como 'syncing', envia para API e confirma.
      // Lança erro se a API falhar — o chamador deve tratar.
      addGesture: async (name, samples) => {
        const id = generateId()
        const now = new Date().toISOString()
        const entry: GestureEntry = {
          id,
          name,
          samples,
          sampleCount: samples.length,
          createdAt: now,
          updatedAt: now,
          isPublic: false,
          syncStatus: 'syncing',
        }

        // Salva localmente imediatamente (backup local)
        set(state => ({ gestures: [...state.gestures, entry] }))

        if (!isAuthed()) return entry

        try {
          const saved = await api.gestures.upsert({ id, name, samples })
          // Atualiza com o ID e amostras confirmados pelo servidor
          set(state => ({
            gestures: state.gestures.map(g =>
              g.id === id
                ? { ...g, id: saved.id, samples: saved.samples, sampleCount: saved.sample_count, syncStatus: 'synced' }
                : g
            ),
            pendingSync: state.gestures.some(g => g.id !== id && g.syncStatus === 'error'),
          }))
          return { ...entry, id: saved.id, syncStatus: 'synced' }
        } catch (err) {
          // Marca como erro — dado fica no localStorage, usuário é avisado
          set(state => ({
            gestures: state.gestures.map(g =>
              g.id === id ? { ...g, syncStatus: 'error' } : g
            ),
            pendingSync: true,
          }))
          throw new Error('Dado salvo localmente, mas falhou ao enviar ao servidor. Tente novamente.')
        }
      },

      // ── retrySync — reenvia gestos com erro ─────────────────────────────────
      retrySync: async (id) => {
        const gesture = get().gestures.find(g => g.id === id)
        if (!gesture || !isAuthed()) return

        set(state => ({
          gestures: state.gestures.map(g => g.id === id ? { ...g, syncStatus: 'syncing' } : g),
        }))

        try {
          const saved = await api.gestures.upsert({ id, name: gesture.name, samples: gesture.samples })
          set(state => ({
            gestures: state.gestures.map(g =>
              g.id === id ? { ...g, id: saved.id, syncStatus: 'synced' } : g
            ),
            pendingSync: state.gestures.some(g => g.id !== id && g.syncStatus === 'error'),
          }))
        } catch {
          set(state => ({
            gestures: state.gestures.map(g => g.id === id ? { ...g, syncStatus: 'error' } : g),
          }))
        }
      },

      // ── updateGesture ───────────────────────────────────────────────────────
      updateGesture: (id, updates) => {
        set(state => ({
          gestures: state.gestures.map(g =>
            g.id === id ? { ...g, ...updates, updatedAt: new Date().toISOString() } : g
          ),
        }))
      },

      // ── deleteGesture ───────────────────────────────────────────────────────
      deleteGesture: async (id) => {
        set(state => ({ gestures: state.gestures.filter(g => g.id !== id) }))
        if (isAuthed()) {
          api.gestures.delete(id).catch(e => console.warn('[gestureStore] delete failed:', e))
        }
      },

      // ── clearAll ────────────────────────────────────────────────────────────
      clearAll: () => set({ gestures: [], pendingSync: false }),

      // ── exportAsJson ────────────────────────────────────────────────────────
      exportAsJson: () => JSON.stringify(get().gestures, null, 2),

      // ── importFromJson ──────────────────────────────────────────────────────
      importFromJson: (json) => {
        try {
          const imported = JSON.parse(json) as GestureEntry[]
          if (!Array.isArray(imported)) throw new Error('Formato inválido')
          set(state => {
            const existingIds = new Set(state.gestures.map(g => g.id))
            const newGestures = imported.filter(g => !existingIds.has(g.id))
            return { gestures: [...state.gestures, ...newGestures] }
          })
          if (isAuthed()) {
            const existingIds = new Set(get().gestures.map(g => g.id))
            imported
              .filter(g => !existingIds.has(g.id))
              .forEach(g =>
                api.gestures.upsert({ id: g.id, name: g.name, samples: g.samples }).catch(() => null)
              )
          }
        } catch {
          console.error('[gestureStore] importFromJson failed')
        }
      },

      // ── loadFromApi ─────────────────────────────────────────────────────────
      // Deve ser chamado logo após o login para sincronizar dados do servidor.
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
      // O servidor tem prioridade quando o dado é mais recente (por updatedAt).
      // Isso garante que trocar de dispositivo não perde dados do banco.
      mergeFromApi: (apiGestures) => {
        set(state => {
          const localMap = new Map(state.gestures.map(g => [g.id, g]))

          for (const ag of apiGestures) {
            const existing = localMap.get(ag.id)
            if (!existing) {
              // Gesto existe no banco mas não localmente — adiciona
              localMap.set(ag.id, {
                id: ag.id,
                name: ag.name,
                samples: ag.samples,
                sampleCount: ag.sample_count,
                createdAt: ag.created_at,
                updatedAt: ag.updated_at ?? ag.created_at,
                isPublic: false,
                syncStatus: 'synced',
              })
            } else {
              // Existe nos dois — usa o mais recente
              const serverTime = new Date(ag.updated_at ?? ag.created_at).getTime()
              const localTime = new Date(existing.updatedAt).getTime()
              if (serverTime > localTime) {
                localMap.set(ag.id, {
                  ...existing,
                  samples: ag.samples,
                  sampleCount: ag.sample_count,
                  updatedAt: ag.updated_at ?? ag.created_at,
                  syncStatus: 'synced',
                })
              } else {
                // Local é mais recente — marca como synced se não tiver erro
                if (existing.syncStatus !== 'error') {
                  localMap.set(ag.id, { ...existing, syncStatus: 'synced' })
                }
              }
            }
          }

          const merged = Array.from(localMap.values())
          return {
            gestures: merged,
            pendingSync: merged.some(g => g.syncStatus === 'error'),
          }
        })
      },
    }),
    { name: 'libras-ar-gestures' }
  )
)
