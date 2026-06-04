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
                Projeto de Pesquisa Científica · 
              </span>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight">
                Traduz Libras em texto.{' '}
                <span className="text-[#4A9FD4]">Na hora. Pela câmera.</span>
              </h1>

              <p className="text-blue-100 text-base md:text-lg max-w-lg mx-auto lg:mx-0 leading-relaxed">
                A pessoa surda faz o gesto com a mão. A câmera do celular ou computador enxerga. A inteligência artificial traduz. O texto aparece na tela — tudo em segundos, sem instalar nada.
              </p>

              <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                {['✅ Funciona no celular', '✅ Sem instalar nada', '✅ Totalmente gratuito', '✅ Sem enviar vídeo'].map(t => (
                  <span key={t} className="text-xs text-blue-100 bg-white/10 px-3 py-1.5 rounded-full font-medium">{t}</span>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start pt-2">
                <a
                  href={FORMS_URL}
                  target="_blank" rel="noopener noreferrer"
                  className="bg-white text-[#1B3A6B] px-6 py-3 rounded-xl font-bold hover:bg-blue-50 transition-colors text-sm shadow-lg text-center"
                >
                  Quero participar da pesquisa
                </a>
                <a
                  href="#como-funciona"
                  className="bg-white/10 border border-white/30 text-white px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-colors text-sm text-center"
                >
                  Entender como funciona
                </a>
              </div>
            </div>

            {/* Formulário de acesso — somente login */}
            <div id="auth-form" className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 text-gray-900 w-full max-w-md mx-auto lg:mx-0">
              <h2 className="text-lg font-extrabold text-[#1B3A6B] mb-1">Entrar na plataforma</h2>
              <p className="text-xs text-gray-400 mb-5">Somente para participantes que já receberam convite</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">E-mail</label>
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
                  {loading ? 'Aguarde...' : 'Entrar'}
                </button>
              </form>

              <div className="mt-5 border-t border-gray-100 pt-4 text-center">
                <p className="text-xs text-gray-400 mb-3">Ainda não recebeu convite?</p>
                <a
                  href={FORMS_URL}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-block w-full bg-[#F4F7FC] border border-gray-200 text-[#1B3A6B] font-bold py-3 rounded-xl text-sm hover:bg-blue-50 hover:border-[#2E75B6] transition-colors text-center"
                >
                  Quero me inscrever na pesquisa
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          NÚMEROS
      ══════════════════════════════════════════════════════════════ */}
      <section className="bg-white border-b border-gray-100 py-10 md:py-14">
        <div className="max-w-5xl mx-auto px-4 md:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { n: '10 milhões',  label: 'de brasileiros com algum grau de surdez', src: 'IBGE, 2023' },
              { n: 'Lei 10.436', label: 'garante Libras como língua oficial desde', src: '2002' },
              { n: 'menos de 5min', label: 'para gravar cada gesto e contribuir', src: 'por gesto' },
              { n: 'Nenhum',     label: 'banco de dados público de Libras existe no Brasil', src: 'até agora' },
            ].map((s, i) => (
              <div key={i} className="space-y-1">
                <div className="text-xl sm:text-2xl md:text-3xl font-extrabold text-[#1B3A6B] leading-tight">{s.n}</div>
                <p className="text-xs sm:text-sm text-gray-600 leading-snug">{s.label}</p>
                <p className="text-xs text-gray-400 italic">{s.src}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          O PROBLEMA
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-14 md:py-20 bg-[#F4F7FC]">
        <div className="max-w-5xl mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div>
              <span className="text-xs font-bold text-[#2E75B6] uppercase tracking-widest">Por que isso importa</span>
              <h2 className="text-2xl md:text-3xl font-extrabold text-[#1B3A6B] mt-2 mb-4 leading-tight">
                Mais de 10 milhões de brasileiros não conseguem se comunicar em muitos lugares
              </h2>
              <div className="space-y-4 text-gray-600 text-sm md:text-base leading-relaxed">
                <p>
                  A <strong className="text-[#1B3A6B]">Língua Brasileira de Sinais (Libras)</strong> é a língua materna da comunidade surda no Brasil. A lei obriga hospitais, escolas e serviços públicos a oferecerem atendimento em Libras — mas na prática isso raramente acontece.
                </p>
                <p>
                  O motivo é simples: não há intérpretes suficientes. Hoje, uma pessoa surda que vai ao médico, ao banco ou à escola depende de ter alguém disponível para interpretar presencialmente. Se não tem, fica sem comunicação.
                </p>
                <p>
                  O LibrARs está construindo uma solução que funciona pelo celular, sem precisar de intérprete. Mas para a inteligência artificial aprender Libras, ela precisa ver exemplos reais — e é aí que você entra.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {[
                { icon: '🏥', title: 'No hospital', desc: 'Uma emergência médica sem comunicação pode custar uma vida. A pessoa surda muitas vezes não consegue explicar o que sente.' },
                { icon: '🏦', title: 'No banco ou cartório', desc: 'Abrir uma conta, assinar um contrato ou resolver qualquer pendência vira uma tarefa impossível sem intérprete.' },
                { icon: '🏫', title: 'Na escola', desc: 'Alunos surdos passam anos em salas sem nenhum suporte em Libras — ficando para trás não por falta de capacidade, mas de acesso.' },
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
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#1B3A6B] mt-2">Quatro passos. Sem instalar nada.</h2>
            <p className="text-gray-500 text-sm mt-2 max-w-xl mx-auto">
              Tudo roda direto no navegador do celular ou computador — não precisa baixar nenhum aplicativo.
            </p>
          </div>

          {/* Dois sentidos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <div className="bg-gradient-to-br from-[#1B3A6B] to-[#2E75B6] rounded-2xl p-6 text-white">
              <div className="text-3xl mb-3">🤟 → 💬</div>
              <h3 className="font-bold text-lg mb-2">Gesto vira texto</h3>
              <p className="text-blue-100 text-sm leading-relaxed">
                A pessoa surda faz o sinal com a mão na frente da câmera. O sistema reconhece e exibe o texto em tempo real para quem está do outro lado. Sem esperar. Sem intérprete.
              </p>
            </div>
            <div className="bg-[#F4F7FC] rounded-2xl p-6 border border-gray-200">
              <div className="text-3xl mb-3">🎤 → 🤟</div>
              <h3 className="font-bold text-lg text-[#1B3A6B] mb-2">Voz vira sinal</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                O ouvinte fala normalmente e o sistema converte a fala em Libras, para que a pessoa surda acompanhe a conversa.
                <span className="inline-block mt-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">Em breve</span>
              </p>
            </div>
          </div>

          {/* Passos do usuário */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { n: '1', emoji: '🌐', title: 'Abra o navegador', desc: 'Funciona no Chrome, Safari ou Firefox — no celular ou no computador' },
              { n: '2', emoji: '📷', title: 'Ligue a câmera', desc: 'O sistema enxerga as suas mãos automaticamente, sem precisar configurar nada' },
              { n: '3', emoji: '🤟', title: 'Faça o gesto', desc: 'A inteligência artificial reconhece qual sinal de Libras está sendo feito' },
              { n: '4', emoji: '💬', title: 'Leia o texto', desc: 'A tradução aparece na tela em tempo real — letra por letra, palavra por palavra' },
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
          CHAMADA PARA PARTICIPAR
      ══════════════════════════════════════════════════════════════ */}
      <section id="participar" className="py-14 md:py-20 bg-[#1B3A6B] text-white">
        <div className="max-w-5xl mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div>
              <span className="text-xs font-bold text-[#4A9FD4] uppercase tracking-widest">Você pode ajudar</span>
              <h2 className="text-2xl md:text-3xl font-extrabold mt-2 mb-4 leading-tight">
                A IA aprende vendo gestos reais. Grave os seus e faça parte da pesquisa.
              </h2>
              <p className="text-blue-100 text-sm md:text-base leading-relaxed mb-6">
                Para que o sistema reconheça Libras com precisão, ele precisa ser treinado com gravações de pessoas reais fazendo os gestos. Quanto mais pessoas participam, melhor ele fica — e mais surdos são beneficiados.
              </p>
              <div className="space-y-3 mb-6">
                {[
                  { icon: '⏱', text: 'Cada gesto leva menos de 5 minutos para gravar' },
                  { icon: '📱', text: 'Tudo pelo navegador — sem baixar aplicativo' },
                  { icon: '🔒', text: 'Nenhuma imagem ou vídeo sai do seu dispositivo' },
                  { icon: '📄', text: 'Seu nome aparece como colaborador no artigo científico' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm text-blue-100">
                    <span className="text-base mt-0.5 shrink-0">{item.icon}</span>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card de inscrição com passo a passo */}
            <div className="bg-white/10 border border-white/20 rounded-2xl p-6 md:p-8 space-y-5">
              <h3 className="text-xl font-extrabold text-center">Como participar</h3>

              <div className="space-y-3">
                {[
                  { n: '1', title: 'Preencha o formulário', desc: 'Leva 2 minutos.' },
                  { n: '2', title: 'Receba o convite por e-mail', desc: 'Após análise pela equipe, você recebe um link de acesso.' },
                  { n: '3', title: 'Acesse a plataforma', desc: 'Pelo navegador, sem instalar nada.' },
                  { n: '4', title: 'Grave os gestos', desc: 'Siga as instruções na tela. Cada gesto leva ~5 minutos.' },
                ].map((step) => (
                  <div key={step.n} className="flex gap-3 items-start">
                    <span className="w-6 h-6 rounded-full bg-white/20 text-white text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                      {step.n}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{step.title}</p>
                      <p className="text-xs text-blue-200 mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <a
                href={FORMS_URL}
                target="_blank" rel="noopener noreferrer"
                className="block w-full bg-white text-[#1B3A6B] py-3.5 rounded-xl font-bold hover:bg-blue-50 transition-colors text-sm shadow-lg text-center"
              >
                Preencher formulário de inscrição →
              </a>
              <a
                href="#auth-form"
                className="block w-full bg-white/10 border border-white/30 text-white py-3 rounded-xl font-semibold hover:bg-white/20 transition-colors text-sm text-center"
              >
                Já tenho acesso — Entrar
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          POR QUE CONFIAR
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-14 md:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 md:px-8">
          <div className="text-center mb-10">
            <span className="text-xs font-bold text-[#2E75B6] uppercase tracking-widest">Transparência</span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#1B3A6B] mt-2">Seguro, gratuito e sem pegadinha</h2>
            <p className="text-gray-500 text-sm mt-2 max-w-lg mx-auto">
              O LibrARs é um projeto de pesquisa sem fins lucrativos. Nenhum dado seu é vendido ou compartilhado.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {[
              { icon: '📵', name: 'Sem vídeo enviado',  desc: 'A câmera funciona só no seu aparelho. Nenhuma imagem vai para nenhum servidor.' },
              { icon: '🆓', name: 'Completamente grátis', desc: 'Não tem plano pago, não tem cobrança, não vai ter. É pesquisa acadêmica.' },
              { icon: '🔓', name: 'Código aberto',      desc: 'Qualquer pessoa pode ver e verificar o que o sistema faz. Sem segredos.' },
              { icon: '🎓', name: 'Projeto universitário', desc: 'Desenvolvido como pesquisa científica com publicação em artigo acadêmico.' },
            ].map(t => (
              <div key={t.name} className="bg-[#F4F7FC] rounded-2xl p-5 text-center hover:shadow-md transition-shadow border border-gray-100">
                <div className="text-3xl mb-2">{t.icon}</div>
                <p className="font-bold text-gray-900 text-sm">{t.name}</p>
                <p className="text-xs text-gray-500 mt-1 leading-tight">{t.desc}</p>
              </div>
            ))}
          </div>

          {/* O que já funciona */}
          <div className="bg-[#F4F7FC] rounded-2xl p-6 border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4 text-sm uppercase tracking-wide">O que já funciona hoje</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { status: '✅', label: 'Gravação de gestos', desc: 'Participantes já podem entrar e contribuir com seus gestos' },
                { status: '✅', label: 'Tradução de Libras para texto', desc: 'A câmera reconhece gestos e exibe o texto em tempo real' },
                { status: '🔄', label: 'Voz para Libras', desc: 'Em desenvolvimento — chegará em breve' },
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
          <span className="text-xs font-bold text-[#2E75B6] uppercase tracking-widest">Quem faz</span>
          <h2 className="text-2xl font-extrabold text-[#1B3A6B] mt-2 mb-3">Uma pesquisa feita por pessoas que acreditam na mudança</h2>
          <p className="text-gray-500 text-sm max-w-2xl mx-auto mb-8 leading-relaxed">
            O LibrARs nasceu da vontade de resolver um problema real. É desenvolvido como projeto de pesquisa acadêmica, com o objetivo de criar o primeiro banco de gestos de Libras do Brasil — de forma colaborativa, aberta e gratuita.
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
              <p className="text-xs text-gray-500 mt-1">Tradução de Libras em tempo real — pelo navegador</p>
            </div>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs">
              <a
                href={FORMS_URL}
                target="_blank" rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                Quero participar
              </a>
              <a
                href="https://github.com/Kayler-Rafa/LibrARs"
                target="_blank" rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                Código no GitHub
              </a>
              <span className="text-gray-600">Lei de Libras 10.436/2002</span>
              <span>© {new Date().getFullYear()} Labelle Candido & Rafael Diniz</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
