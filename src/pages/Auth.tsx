import { useState } from 'react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { useGestureStore } from '@/stores/gestureStore'

type Tab = 'login' | 'register'

export default function Auth() {
  const { user, isAuthenticated, setAuth, clearAuth } = useAuthStore()
  const loadFromApi = useGestureStore((s) => s.loadFromApi)

  const [tab, setTab] = useState<Tab>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      let result
      if (tab === 'login') {
        result = await api.auth.login(email, password)
      } else {
        result = await api.auth.register(email, password, name || undefined)
      }

      setAuth(result.token, result.user)
      setSuccess(`Bem-vindo, ${result.user.name}!`)

      // Sincroniza gestos do servidor após login
      await loadFromApi()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  // ── Usuário já autenticado ────────────────────────────────────────────────
  if (isAuthenticated && user) {
    return (
      <div className="max-w-md mx-auto px-4 py-10 flex flex-col items-center gap-6">
        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-2xl font-bold text-blue-600">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
          <p className="text-sm text-gray-500 mt-1">{user.email}</p>
        </div>

        <div className="w-full bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800 text-center">
          ✅ Conta conectada — seus gestos são sincronizados com o servidor
        </div>

        <button
          onClick={clearAuth}
          className="px-5 py-2.5 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors"
        >
          Sair da conta
        </button>
      </div>
    )
  }

  // ── Formulário ────────────────────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Conta</h1>
        <p className="text-sm text-gray-500 mt-1">
          Entre para sincronizar seus gestos e usar chamadas em tempo real
        </p>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl border border-gray-200 p-1 mb-6 bg-gray-50">
        {(['login', 'register'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setError(''); setSuccess('') }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {tab === 'register' && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
            className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
            className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2 rounded-lg">
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Aguarde…' : tab === 'login' ? 'Entrar' : 'Criar conta'}
        </button>
      </form>

      <p className="text-center text-xs text-gray-400 mt-6">
        Sem conta? Todos os gestos são salvos localmente mesmo sem login.
      </p>
    </div>
  )
}
