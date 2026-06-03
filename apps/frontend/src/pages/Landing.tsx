import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { useGestureStore } from '@/stores/gestureStore'

const FORMS_URL = 'https://forms.gle/b2QQvNKTUgY7BH9s8'

export default function Landing() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const loadFromApi = useGestureStore(s => s.loadFromApi)

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.auth.login(email, password)
      setAuth(res.token, res.user)
      loadFromApi().catch(() => null)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao autenticar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">

      {/* ══════════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════════ */}
      <section className="relative bg-gradient-to-br from-[#1B3A6B] via-[#2457A0] to-[#2E75B6] text-white overflow-hidden">
        {/* Fundo decorativo */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
          <svg className="absolute right-0 top-0 w-full h-full opacity-[0.04]" viewBox="0 0 700 500" fill="none">
            <circle cx="580" cy="60"  r="5" fill="white"/><circle cx="630" cy="130" r="3" fill="white"/>
            <circle cx="560" cy="200" r="6" fill="white"/><circle cx="650" cy="260" r="3" fill="white"/>
            <circle cx="600" cy="340" r="4" fill="white"/><circle cx="540" cy="420" r="5" fill="white"/>
            <line x1="580" y1="60"  x2="630" y2="130" stroke="white" strokeWidth="1.5"/>
            <line x1="630" y1="130" x2="560" y2="200" stroke="white" strokeWidth="1.5"/>
            <line x1="560" y1="200" x2="650" y2="260" stroke="white" strokeWidth="1.5"/>
            <line x1="650" y1="260" x2="600" y2="340" stroke="white" strokeWidth="1.5"/>
            <line x1="600" y1="340" x2="540" y2="420" stroke="white" strokeWidth="1.5"/>
          </svg>
        </div>

        <div className="relative max-w-6xl mx-auto px-4 md:px-8 pt-12 pb-14 md:pt-20 md:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

            {/* Texto */}
            <div className="space-y-6 text-center lg:text-left">
              <span className="inline-block bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase">
                Pesquisa Acadêmica · Artigo Científico
              </span>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight">
                Comunicação sem barreiras entre surdos e ouvintes,{' '}
                <span className="text-[#4A9FD4]">em tempo real</span>
              </h1>

              <p className="text-blue-100 text-base md:text-lg max-w-lg mx-auto lg:mx-0 leading-relaxed">
                O LibrARs usa inteligência artificial e visão computacional para traduzir gestos de Libras em texto e voz — direto no navegador, sem instalação.
              </p>

              <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                {['✅ 100% gratuito', '✅ Sem instalação', '✅ Privacidade local', '✅ Open source'].map(t => (
                  <span key={t} className="text-xs text-blue-100 bg-white/10 px-3 py-1.5 rounded-full font-medium">{t}</span>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start pt-2">
                <a
                  href={FORMS_URL}
                  target="_blank" rel="noopener noreferrer"
                  className="bg-white text-[#1B3A6B] px-6 py-3 rounded-xl font-bold hover:bg-blue-50 transition-colors text-sm shadow-lg text-center"
                >
                  Participar da pesquisa
                </a>
                <a
                  href="#como-funciona"
                  className="bg-white/10 border border-white/30 text-white px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-colors text-sm text-center"
                >
                  Como funciona
                </a>
              </div>
            </div>

            {/* Formulário de acesso — somente login */}
            <div id="auth-form" className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 text-gray-900 w-full max-w-md mx-auto lg:mx-0">
              <h2 className="text-lg font-extrabold text-[#1B3A6B] mb-1">Acessar a plataforma</h2>
              <p className="text-xs text-gray-400 mb-5">Acesso exclusivo para participantes convidados</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Email</label>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    required placeholder="seu@email.com"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E75B6] focus:border-transparent transition bg-gray-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Senha</label>
                  <input
                    type="password" value={password} onChange={e => setPassword(e.target.value)}
                    required minLength={6} placeholder="••••••••"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E75B6] focus:border-transparent transition bg-gray-50 focus:bg-white"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
                )}

                <button
                  type="submit" disabled={loading}
                  className="w-full bg-[#2E75B6] hover:bg-[#1B3A6B] text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-60 text-sm shadow-md shadow-blue-100"
                >
                  {loading ? 'Aguarde...' : 'Entrar na plataforma'}
                </button>
              </form>

              <div className="mt-5 border-t border-gray-100 pt-4 text-center">
                <p className="text-xs text-gray-400 mb-3">Ainda não participa da pesquisa?</p>
                <a
                  href={FORMS_URL}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-block w-full bg-[#F4F7FC] border border-gray-200 text-[#1B3A6B] font-bold py-3 rounded-xl text-sm hover:bg-blue-50 hover:border-[#2E75B6] transition-colors text-center"
                >
                  Quero me inscrever
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          NÚMEROS (dados reais)
      ══════════════════════════════════════════════════════════════ */}
      <section className="bg-white border-b border-gray-100 py-10 md:py-14">
        <div className="max-w-5xl mx-auto px-4 md:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { n: '10M+',       label: 'Brasileiros com deficiência auditiva', src: 'IBGE, 2023' },
              { n: 'Lei 10.436', label: 'Reconhece Libras como língua oficial', src: 'desde 2002' },
              { n: '150+',       label: 'Amostras mínimas por gesto coletadas', src: 'por participante' },
              { n: '0',          label: 'Bases de dados públicas de Libras no Brasil', src: 'até agora' },
            ].map((s, i) => (
              <div key={i} className="space-y-1">
                <div className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#1B3A6B]">{s.n}</div>
                <p className="text-xs sm:text-sm text-gray-600 leading-snug">{s.label}</p>
                <p className="text-xs text-gray-400 italic">{s.src}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          PROBLEMA E JUSTIFICATIVA
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-14 md:py-20 bg-[#F4F7FC]">
        <div className="max-w-5xl mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div>
              <span className="text-xs font-bold text-[#2E75B6] uppercase tracking-widest">Problema e Justificativa</span>
              <h2 className="text-2xl md:text-3xl font-extrabold text-[#1B3A6B] mt-2 mb-4 leading-tight">
                A barreira que separa surdos do mundo
              </h2>
              <div className="space-y-4 text-gray-600 text-sm md:text-base leading-relaxed">
                <p>
                  No Brasil, mais de <strong className="text-[#1B3A6B]">10 milhões de pessoas</strong> possuem algum grau de deficiência auditiva (IBGE, 2023). A Libras é reconhecida pela <strong>Lei nº 10.436/2002</strong> e o Decreto nº 5.626/2005 exige sua inclusão em serviços públicos, educação e saúde.
                </p>
                <p>
                  Na prática, essa exigência raramente é cumprida. O número de intérpretes qualificados é muito inferior à demanda real — tornando hospitais, bancos, repartições públicas e escolas <strong className="text-[#1B3A6B]">ambientes inacessíveis</strong> para a pessoa surda.
                </p>
                <p>
                  A comunicação entre surdos e ouvintes depende quase exclusivamente da <strong>presença física de um intérprete humano</strong>. O LibrARs existe para mudar isso.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {[
                { icon: '🏥', title: 'Hospitais', desc: 'Atendimentos emergenciais sem comunicação adequada colocam vidas em risco.' },
                { icon: '🏦', title: 'Bancos e serviços', desc: 'Transações simples tornam-se barreiras insuperáveis sem intérprete.' },
                { icon: '🏫', title: 'Educação', desc: 'Estudantes surdos enfrentam exclusão em ambientes sem suporte em Libras.' },
              ].map((c, i) => (
                <div key={i} className="bg-white rounded-2xl p-5 flex gap-4 items-start shadow-sm border border-gray-100">
                  <span className="text-2xl mt-0.5">{c.icon}</span>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">{c.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{c.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          COMO FUNCIONA
      ══════════════════════════════════════════════════════════════ */}
      <section id="como-funciona" className="py-14 md:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 md:px-8">
          <div className="text-center mb-10 md:mb-14">
            <span className="text-xs font-bold text-[#2E75B6] uppercase tracking-widest">Como Funciona</span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#1B3A6B] mt-2">Tradução bidirecional em tempo real</h2>
            <p className="text-gray-500 text-sm mt-2 max-w-xl mx-auto">
              O LibrARs funciona nos dois sentidos — da Libras para a fala, e da fala para Libras.
            </p>
          </div>

          {/* Dois fluxos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <div className="bg-gradient-to-br from-[#1B3A6B] to-[#2E75B6] rounded-2xl p-6 text-white">
              <div className="text-3xl mb-3">🤟 → 💬</div>
              <h3 className="font-bold text-lg mb-2">Libras → Texto e Voz</h3>
              <p className="text-blue-100 text-sm leading-relaxed">
                A câmera captura os gestos, a IA identifica os sinais em tempo real e converte automaticamente em texto e áudio para o interlocutor ouvinte.
              </p>
            </div>
            <div className="bg-[#F4F7FC] rounded-2xl p-6 border border-gray-200">
              <div className="text-3xl mb-3">🎤 → 🤟</div>
              <h3 className="font-bold text-lg text-[#1B3A6B] mb-2">Voz → Libras</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                O interlocutor ouvinte fala normalmente. O sistema reconhece a fala e a traduz para Libras, permitindo que a pessoa surda acompanhe a conversa.
                <span className="inline-block mt-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">Em desenvolvimento</span>
              </p>
            </div>
          </div>

          {/* Pipeline técnico */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { n: '1', emoji: '📹', title: 'Câmera captura', desc: 'Qualquer webcam ou câmera de celular' },
              { n: '2', emoji: '🎯', title: '21 landmarks', desc: 'MediaPipe detecta pontos da mão em tempo real' },
              { n: '3', emoji: '🤖', title: 'IA classifica', desc: 'Algoritmo KNN alimentado pelo dataset coletado' },
              { n: '4', emoji: '✨', title: 'Texto e voz', desc: 'Saída instantânea — sem servidor, sem latência' },
            ].map((step, idx) => (
              <div key={idx} className="relative bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#2E75B6] text-white w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold shadow">
                  {step.n}
                </div>
                <div className="text-2xl mt-2 mb-2">{step.emoji}</div>
                <h3 className="font-bold text-gray-900 text-xs mb-1">{step.title}</h3>
                <p className="text-xs text-gray-400 leading-tight">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          DATASET — CHAMADA PARA PARTICIPAR
      ══════════════════════════════════════════════════════════════ */}
      <section id="participar" className="py-14 md:py-20 bg-[#1B3A6B] text-white">
        <div className="max-w-5xl mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div>
              <span className="text-xs font-bold text-[#4A9FD4] uppercase tracking-widest">Pesquisa Aberta</span>
              <h2 className="text-2xl md:text-3xl font-extrabold mt-2 mb-4 leading-tight">
                Ajude a construir a primeira base de dados de Libras do Brasil
              </h2>
              <p className="text-blue-100 text-sm md:text-base leading-relaxed mb-6">
                O LibrARs é uma plataforma colaborativa. Quanto mais pessoas contribuírem com seus gestos, mais precisa a IA se torna — e mais pessoas surdas são beneficiadas. Cada amostra que você grava alimenta diretamente o modelo.
              </p>
              <div className="space-y-3">
                {[
                  { icon: '🎯', text: 'Mínimo de 150 amostras por gesto — sem limite máximo' },
                  { icon: '⏱', text: 'Leva menos de 5 minutos por gesto para contribuir' },
                  { icon: '🔒', text: 'Seus dados são processados 100% localmente — privacidade total' },
                  { icon: '📄', text: 'Contribuição reconhecida no artigo científico em desenvolvimento' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm text-blue-100">
                    <span className="text-base mt-0.5 shrink-0">{item.icon}</span>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card de inscrição */}
            <div className="bg-white/10 border border-white/20 rounded-2xl p-6 md:p-8 text-center space-y-5">
              <div className="text-5xl">🤝</div>
              <h3 className="text-xl font-extrabold">Quero participar</h3>
              <p className="text-blue-100 text-sm leading-relaxed">
                Preencha o formulário de inscrição. Após a análise, você receberá seu link de acesso por email para começar a contribuir com a pesquisa.
              </p>
              <div className="bg-white/10 rounded-xl p-4 text-left space-y-2">
                <p className="text-xs font-bold text-blue-200 uppercase tracking-wide">Pesquisadores responsáveis</p>
                <p className="text-sm font-semibold">Labelle Candido</p>
                <p className="text-sm font-semibold">Rafael Diniz</p>
              </div>
              <a
                href={FORMS_URL}
                target="_blank" rel="noopener noreferrer"
                className="block w-full bg-white text-[#1B3A6B] py-3.5 rounded-xl font-bold hover:bg-blue-50 transition-colors text-sm shadow-lg"
              >
                Preencher formulário de inscrição →
              </a>
              <a
                href="#auth-form"
                className="block w-full bg-white/10 border border-white/30 text-white py-3 rounded-xl font-semibold hover:bg-white/20 transition-colors text-sm"
              >
                Já tenho acesso — Entrar
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          TECNOLOGIA
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-14 md:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 md:px-8">
          <div className="text-center mb-10">
            <span className="text-xs font-bold text-[#2E75B6] uppercase tracking-widest">Tecnologia</span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#1B3A6B] mt-2">Construído sobre IA e Realidade Aumentada</h2>
            <p className="text-gray-500 text-sm mt-2 max-w-lg mx-auto">
              Toda a computação acontece no seu dispositivo. Nenhum dado de vídeo é enviado para servidores.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: '⚛️', name: 'React',       desc: 'Interface responsiva e em tempo real' },
              { icon: '🎯', name: 'MediaPipe',   desc: 'Detecção de 21 landmarks da mão' },
              { icon: '🧠', name: 'KNN / ML',    desc: 'Classificação por aprendizado de máquina' },
              { icon: '🗄️', name: 'PostgreSQL',  desc: 'Banco de dados da pesquisa com dados brutos' },
            ].map(t => (
              <div key={t.name} className="bg-[#F4F7FC] rounded-2xl p-5 text-center hover:shadow-md transition-shadow border border-gray-100">
                <div className="text-3xl mb-2">{t.icon}</div>
                <p className="font-bold text-gray-900 text-sm">{t.name}</p>
                <p className="text-xs text-gray-500 mt-1 leading-tight">{t.desc}</p>
              </div>
            ))}
          </div>

          {/* Status do projeto */}
          <div className="mt-10 bg-[#F4F7FC] rounded-2xl p-6 border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4 text-sm uppercase tracking-wide">Status do Projeto</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { status: '✅', label: 'Coleta de dados', desc: 'Funcionando — participantes já podem contribuir' },
                { status: '✅', label: 'Tradução Libras → texto', desc: 'Funcionando em tempo real via câmera' },
                { status: '🔄', label: 'Voz → Libras', desc: 'Em desenvolvimento' },
              ].map((item, i) => (
                <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                  <div className="text-xl mb-1">{item.status}</div>
                  <p className="font-bold text-gray-900 text-xs">{item.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          SOBRE / CRÉDITOS
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-14 md:py-16 bg-[#F4F7FC] border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-4 md:px-8 text-center">
          <span className="text-xs font-bold text-[#2E75B6] uppercase tracking-widest">Sobre o Projeto</span>
          <h2 className="text-2xl font-extrabold text-[#1B3A6B] mt-2 mb-3">Pesquisa acadêmica em andamento</h2>
          <p className="text-gray-500 text-sm max-w-2xl mx-auto mb-8 leading-relaxed">
            O LibrARs é desenvolvido como projeto acadêmico com publicação científica em desenvolvimento.
            O objetivo é contribuir com a comunidade surda brasileira e com a comunidade científica
            através de uma base de dados inédita de gestos Libras coletada colaborativamente.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {[
              { name: 'Labelle Candido', role: 'Desenvolvedora & Pesquisadora' },
              { name: 'Rafael Diniz',    role: 'Desenvolvedor & Pesquisador' },
            ].map(p => (
              <div key={p.name} className="bg-white rounded-2xl px-8 py-5 shadow-sm border border-gray-100 text-left min-w-[200px]">
                <div className="w-10 h-10 bg-[#2E75B6] rounded-full flex items-center justify-center text-white font-extrabold text-sm mb-3">
                  {p.name.charAt(0)}
                </div>
                <p className="font-bold text-gray-900 text-sm">{p.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{p.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════════════ */}
      <footer className="bg-[#0F2747] text-gray-400 py-10">
        <div className="max-w-5xl mx-auto px-4 md:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <span className="font-extrabold text-lg">
                <span className="text-gray-200">Libr</span>
                <span className="text-[#4A9FD4]">AR</span>
                <span className="text-gray-200">s</span>
              </span>
              <p className="text-xs text-gray-500 mt-1">Reconhecimento Inteligente de Libras em Tempo Real</p>
            </div>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs">
              <a
                href={FORMS_URL}
                target="_blank" rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                Inscrever-se na pesquisa
              </a>
              <a
                href="https://github.com/Kayler-Rafa/LibrARs"
                target="_blank" rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                GitHub
              </a>
              <span className="text-gray-600">Lei 10.436/2002</span>
              <span className="text-gray-600">Decreto 5.626/2005</span>
              <span>© {new Date().getFullYear()} Labelle Candido & Rafael Diniz</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
