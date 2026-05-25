// ─────────────────────────────────────────────────────────────────────────────
//  API client — wrapper sobre fetch para o backend REST
// ─────────────────────────────────────────────────────────────────────────────

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

function token(): string | null {
  return localStorage.getItem('libras-ar-token')
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const t = token()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(init?.headers ?? {}),
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((body as { error?: string }).error ?? res.statusText)
  }

  return res.json() as Promise<T>
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  name: string
}

export interface ApiGesture {
  id: string
  name: string
  samples: number[][]
  sample_count: number
  created_at: string
  updated_at?: string
}

export interface AuthResponse {
  token: string
  user: User
}

// ── API ───────────────────────────────────────────────────────────────────────

export const api = {
  auth: {
    register: (email: string, password: string, name?: string) =>
      req<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      }),

    login: (email: string, password: string) =>
      req<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    me: () => req<User>('/api/auth/me'),
  },

  gestures: {
    list: () => req<ApiGesture[]>('/api/gestures'),

    upsert: (g: { id: string; name: string; samples: number[][] }) =>
      req<ApiGesture>('/api/gestures', {
        method: 'POST',
        body: JSON.stringify(g),
      }),

    delete: (id: string) =>
      req<{ ok: boolean }>(`/api/gestures/${id}`, { method: 'DELETE' }),

    listByUser: (userId: string) =>
      req<ApiGesture[]>(`/api/gestures/user/${userId}`),
  },
}
