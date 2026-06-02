import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { api, type ApiGesture } from '@/lib/api'

export default function Dashboard() {
  const { user } = useAuthStore()
  const [gestures, setGestures] = useState<ApiGesture[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.gestures.list().then(setGestures).finally(() => setLoading(false))
  }, [])

  if (!user) return null

  const totalSamples = gestures.reduce((sum, g) => sum + g.sample_count, 0)

  return (
    <div className="min-h-screen" style={{ background: 'var(--brand-bg)' }}>
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-10">

        {/* Boas-vindas */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#1B3A6B]">
            Olá, {user.name.split(' ')[0]}!
          </h1>
          <p className="text-gray-500 text-sm mt-1">Bem-vindo ao painel de contribuição do LibrARs</p>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
          {[
            { label: 'Gestos treinados', value: loading ? '—' : String(gestures.length), color: '#2E75B6' },
            { label: 'Total de amostras', value: loading ? '—' : totalSamples.toLocaleString('pt-BR'), color: '#1E5631' },
            { label: 'Média por gesto', value: loading || !gestures.length ? '—' : String(Math.round(totalSamples / gestures.length)), color: '#1B3A6B' },
          ].map((c, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm p-4 md:p-5 border border-gray-100">
              <p className="text-gray-500 text-xs font-medium leading-tight">{c.label}</p>
              <p className="text-2xl md:text-3xl font-extrabold mt-1" style={{ color: c.color }}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Ações */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
          {[
            { to: '/traduzir',   emoji: '🎯', title: 'Traduzir',   desc: 'Reconheça gestos em tempo real',      accent: '#2E75B6' },
            { to: '/treinar',    emoji: '🏋️', title: 'Treinar',    desc: 'Contribua com novos gestos',           accent: '#1E5631' },
            { to: '/biblioteca', emoji: '📚', title: 'Biblioteca', desc: 'Gerencie seus gestos',                 accent: '#7C3AED' },
          ].map(item => (
            <Link
              key={item.to}
              to={item.to}
              className="group bg-white rounded-2xl shadow-sm p-5 md:p-6 border border-gray-100 hover:shadow-md transition-all flex sm:flex-col items-center sm:items-start gap-4 sm:gap-0"
              style={{ '--accent': item.accent } as React.CSSProperties}
            >
              <span className="text-3xl">{item.emoji}</span>
              <div>
                <h3 className="font-bold text-gray-900 text-sm sm:mt-3 group-hover:transition-colors" style={{ color: 'inherit' }}>
                  {item.title}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Lista de gestos */}
        {!loading && gestures.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex justify-between items-center">
              <h2 className="font-bold text-gray-900 text-sm">Meus gestos</h2>
              <Link to="/biblioteca" className="text-xs text-[#2E75B6] hover:underline font-medium">
                Ver todos →
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {gestures.slice(0, 8).map(g => (
                <div key={g.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <span className="text-sm font-semibold text-gray-800">{g.name}</span>
                  <span className="text-xs text-gray-400 font-mono bg-gray-100 px-2 py-0.5 rounded-md">
                    {g.sample_count} amostras
                  </span>
                </div>
              ))}
            </div>
            {gestures.length > 8 && (
              <div className="px-5 py-3 border-t border-gray-50 text-center">
                <Link to="/biblioteca" className="text-xs text-[#2E75B6] hover:underline">
                  + {gestures.length - 8} gestos a mais
                </Link>
              </div>
            )}
          </div>
        )}

        {!loading && gestures.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
            <div className="text-5xl mb-3">🤚</div>
            <h3 className="font-bold text-gray-900 mb-1">Nenhum gesto treinado ainda</h3>
            <p className="text-sm text-gray-500 mb-5">Comece contribuindo com gestos para a base de dados da pesquisa</p>
            <Link
              to="/treinar"
              className="inline-block bg-[#2E75B6] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-[#1B3A6B] transition-colors text-sm shadow-md shadow-blue-100"
            >
              Começar a treinar
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
