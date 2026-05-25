import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Translate from '@/pages/Translate'
import Train from '@/pages/Train'
import Library from '@/pages/Library'
import Speech from '@/pages/Speech'
import Auth from '@/pages/Auth'
import Call from '@/pages/Call'
import { useAuthStore } from '@/stores/authStore'
import './index.css'

const navItems = [
  { to: '/', label: 'Traduzir', end: true },
  { to: '/treinar', label: 'Treinar' },
  { to: '/biblioteca', label: 'Biblioteca' },
  { to: '/chamada', label: 'Chamada' },
  { to: '/fala', label: 'Fala' },
  { to: '/conta', label: 'Conta' },
]

function App() {
  const { isAuthenticated, user } = useAuthStore()

  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-screen-lg mx-auto px-4 py-3 flex items-center justify-between">
            <span className="font-bold text-lg text-blue-600">Libras AR</span>
            <nav className="flex gap-1 text-sm flex-wrap" aria-label="Navegação principal">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-md transition-colors ${
                      isActive
                        ? 'bg-blue-100 text-blue-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`
                  }
                  aria-label={item.label}
                >
                  {item.label}
                </NavLink>
              ))}

              {/* Indicador de usuário logado */}
              {isAuthenticated && user && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-700 bg-green-50 rounded-md">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  {user.name.split(' ')[0]}
                </span>
              )}
            </nav>
          </div>
        </header>

        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Translate />} />
            <Route path="/treinar" element={<Train />} />
            <Route path="/biblioteca" element={<Library />} />
            <Route path="/chamada" element={<Call />} />
            <Route path="/fala" element={<Speech />} />
            <Route path="/conta" element={<Auth />} />
          </Routes>
        </main>

        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-100">
          Libras AR © {new Date().getFullYear()} — Comunicação sem barreiras
        </footer>
      </div>
    </BrowserRouter>
  )
}

export default App
