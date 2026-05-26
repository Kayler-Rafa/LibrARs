import { useState, useRef, useEffect, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { Link } from 'react-router-dom'
import { CameraFeed } from '@/components/camera/CameraFeed'
import { ARDisplay } from '@/components/camera/ARDisplay'
import { useGestureClassifier } from '@/hooks/useGestureClassifier'
import { useAuthStore } from '@/stores/authStore'
import { useGestureStore } from '@/stores/gestureStore'
import type { Landmark } from '@/types'

const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) ?? ''

// ─────────────────────────────────────────────────────────────────────────────

type Status = 'idle' | 'waiting' | 'connected'

export default function Call() {
  const { user, isAuthenticated } = useAuthStore()
  const gestureCount = useGestureStore((s) => s.gestures.length)

  // ── Estado da chamada ──────────────────────────────────────────────────────
  const [status, setStatus] = useState<Status>('idle')
  const [roomCode, setRoomCode] = useState('')
  const [inputCode, setInputCode] = useState('')
  const [peerName, setPeerName] = useState('')
  const [callError, setCallError] = useState('')

  // ── Gesto do par ──────────────────────────────────────────────────────────
  const [peerGesture, setPeerGesture] = useState<string | null>(null)
  const [peerConfidence, setPeerConfidence] = useState(0)
  const peerGestureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Refs ───────────────────────────────────────────────────────────────────
  const socketRef = useRef<Socket | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const currentRoomRef = useRef('')

  // ── Gesture classifier (local) ─────────────────────────────────────────────
  const [landmarks, setLandmarks] = useState<Landmark[] | null>(null)
  const handleLandmarks = useCallback((lms: Landmark[] | null) => setLandmarks(lms), [])
  const { currentGesture, confidence, isDetecting } = useGestureClassifier(landmarks)

  // Envia gesto confirmado para o room
  useEffect(() => {
    if (currentGesture && socketRef.current && currentRoomRef.current) {
      socketRef.current.emit('gesture', {
        code: currentRoomRef.current,
        gesture: currentGesture,
        confidence,
      })
    }
  }, [currentGesture, confidence])

  // ── Socket.io setup ────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(WS_URL, { autoConnect: true, transports: ['websocket', 'polling'] })
    socketRef.current = socket

    // Gesto do par chegou
    socket.on('peer-gesture', (d: { gesture: string; confidence: number }) => {
      setPeerGesture(d.gesture)
      setPeerConfidence(d.confidence)

      // Limpa exibição após 3s sem novo gesto
      if (peerGestureTimerRef.current) clearTimeout(peerGestureTimerRef.current)
      peerGestureTimerRef.current = setTimeout(() => setPeerGesture(null), 3000)
    })

    // Signaling WebRTC
    socket.on('webrtc-offer', async (d: { sdp: RTCSessionDescriptionInit }) => {
      const pc = ensurePeerConnection()
      await pc.setRemoteDescription(d.sdp)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      socket.emit('webrtc-answer', { code: currentRoomRef.current, sdp: answer })
    })

    socket.on('webrtc-answer', async (d: { sdp: RTCSessionDescriptionInit }) => {
      await pcRef.current?.setRemoteDescription(d.sdp)
    })

    socket.on('webrtc-ice', async (d: { candidate: RTCIceCandidateInit }) => {
      try {
        await pcRef.current?.addIceCandidate(d.candidate)
      } catch {
        // ignora erros de ICE tardio
      }
    })

    // Par entrou na sala → quem criou inicia WebRTC como ofertante
    socket.on('peer-joined', (d: { userId?: string; userName?: string }) => {
      setPeerName(d.userName || d.userId?.slice(0, 8) || 'Anônimo')
      setStatus('connected')
      initiateWebRTC()
    })

    socket.on('peer-left', () => {
      setPeerName('')
      setPeerGesture(null)
      setStatus('waiting')
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
      pcRef.current?.close()
      pcRef.current = null
    })

    return () => {
      socket.disconnect()
      pcRef.current?.close()
      localStreamRef.current?.getTracks().forEach((t) => t.stop())
      if (peerGestureTimerRef.current) clearTimeout(peerGestureTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── WebRTC helpers ─────────────────────────────────────────────────────────
  function ensurePeerConnection(): RTCPeerConnection {
    if (pcRef.current && pcRef.current.connectionState !== 'closed') return pcRef.current

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    })

    pc.ontrack = (e) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0]
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current?.emit('webrtc-ice', {
          code: currentRoomRef.current,
          candidate: e.candidate,
        })
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setStatus('connected')
    }

    pcRef.current = pc
    return pc
  }

  async function addLocalTracks(pc: RTCPeerConnection) {
    if (!localStreamRef.current) {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      })
    }
    localStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current!))
  }

  async function initiateWebRTC() {
    const pc = ensurePeerConnection()
    await addLocalTracks(pc)
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    socketRef.current?.emit('webrtc-offer', { code: currentRoomRef.current, sdp: offer })
  }

  // ── Criar sala ─────────────────────────────────────────────────────────────
  async function createRoom() {
    setCallError('')
    socketRef.current?.emit(
      'create-room',
      { userId: user?.id, userName: user?.name },
      (res: { code: string }) => {
        currentRoomRef.current = res.code
        setRoomCode(res.code)
        setStatus('waiting')
      }
    )
  }

  // ── Entrar numa sala ───────────────────────────────────────────────────────
  async function joinRoom() {
    const code = inputCode.trim().toUpperCase()
    if (!code) return
    setCallError('')

    socketRef.current?.emit(
      'join-room',
      { code, userId: user?.id, userName: user?.name },
      async (res: {
        ok?: boolean
        error?: string
        peerUserId?: string
        peerUserName?: string
      }) => {
        if (res.error) {
          setCallError(res.error)
          return
        }
        currentRoomRef.current = code
        setRoomCode(code)
        setPeerName(res.peerUserName || res.peerUserId?.slice(0, 8) || 'Anônimo')
        setStatus('connected')

        // Quem entra na sala é o "answerer" — inicia WebRTC também (ofertante é o criador)
        // Só adiciona tracks locais aqui; o criador da sala enviará a offer
        const pc = ensurePeerConnection()
        await addLocalTracks(pc)
      }
    )
  }

  function endCall() {
    pcRef.current?.close()
    pcRef.current = null
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
    currentRoomRef.current = ''
    setRoomCode('')
    setInputCode('')
    setPeerName('')
    setPeerGesture(null)
    setStatus('idle')
    socketRef.current?.disconnect()
    socketRef.current?.connect()
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────

  // Guard: precisa estar autenticado
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center flex flex-col items-center gap-4">
        <div className="text-4xl">🔒</div>
        <h1 className="text-xl font-bold text-gray-900">Chamada em Tempo Real</h1>
        <p className="text-sm text-gray-500">
          Faça login para iniciar ou entrar em uma chamada e traduzir gestos ao vivo.
        </p>
        <Link
          to="/conta"
          className="mt-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          Ir para Conta
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-5">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Chamada em Tempo Real</h1>
        <p className="text-sm text-gray-500">
          Os gestos de cada participante são traduzidos para o outro ao vivo
        </p>
      </div>

      {/* Aviso sem gestos */}
      {gestureCount === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 text-center">
          Você não tem gestos cadastrados.{' '}
          <Link to="/treinar" className="font-semibold underline hover:text-amber-900">
            Treine gestos
          </Link>{' '}
          para que o outro participante veja suas traduções.
        </div>
      )}

      {/* ── IDLE: criar ou entrar ── */}
      {status === 'idle' && (
        <div className="flex flex-col gap-4">
          <button
            onClick={createRoom}
            className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            + Criar nova sala
          </button>

          <div className="flex items-center gap-3 text-gray-400 text-sm">
            <div className="flex-1 h-px bg-gray-200" />
            ou entre com um código
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <div className="flex gap-2">
            <input
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder="CÓDIGO DA SALA"
              maxLength={6}
              className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-mono uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={joinRoom}
              disabled={inputCode.length < 4}
              className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              Entrar
            </button>
          </div>

          {callError && (
            <p className="text-sm text-red-600 text-center bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {callError}
            </p>
          )}
        </div>
      )}

      {/* ── WAITING: aguardando par ── */}
      {status === 'waiting' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-6 text-center flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
          <div>
            <p className="text-sm font-medium text-blue-800">Aguardando outro participante…</p>
            <p className="text-xs text-blue-600 mt-1">Compartilhe o código abaixo</p>
          </div>
          <div className="bg-white border border-blue-300 rounded-xl px-6 py-3 font-mono text-2xl font-bold tracking-widest text-blue-700">
            {roomCode}
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(roomCode)}
            className="text-xs text-blue-600 underline hover:text-blue-800"
          >
            Copiar código
          </button>
          <button
            onClick={endCall}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* ── CONNECTED: chamada ativa ── */}
      {status === 'connected' && (
        <>
          {/* Info da chamada */}
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-2">
            <div className="flex items-center gap-2 text-sm text-green-800">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="font-medium">Conectado{peerName ? ` com ${peerName}` : ''}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-green-600 font-mono">{roomCode}</span>
              <button
                onClick={endCall}
                className="text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-lg hover:bg-red-200 font-medium transition-colors"
              >
                Encerrar
              </button>
            </div>
          </div>

          {/* Vídeo do par (remoto) */}
          <div className="relative bg-black rounded-2xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              aria-label="Vídeo do participante remoto"
            />
            {/* AR overlay com gesto do PAR sobre o vídeo DELE */}
            {peerGesture && (
              <div className="absolute inset-0 pointer-events-none">
                <ARDisplay
                  gesture={peerGesture}
                  confidence={peerConfidence}
                  isDetecting={false}
                />
              </div>
            )}
            {!peerGesture && (
              <div className="absolute top-3 left-3 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-sm">
                👁 Gestos do par aparecerão aqui
              </div>
            )}
          </div>

          {/* Câmera local com detecção (miniatura no canto) */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Sua câmera — gestos são enviados ao vivo
            </p>
            <CameraFeed onLandmarks={handleLandmarks}>
              <ARDisplay
                gesture={currentGesture}
                confidence={confidence}
                isDetecting={isDetecting}
              />
            </CameraFeed>
          </div>
        </>
      )}
    </div>
  )
}
