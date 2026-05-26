import 'dotenv/config'
import express from 'express'
import http from 'http'
import cors from 'cors'
import { Server as SocketIO } from 'socket.io'
import authRoutes from './routes/auth'
import gestureRoutes from './routes/gestures'
import { setupSocket } from './socket'

const app = express()
const server = http.createServer(app)

const CORS_ORIGIN = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',')

const io = new SocketIO(server, {
  cors: { origin: CORS_ORIGIN, methods: ['GET', 'POST'] },
})

app.use(cors({ origin: CORS_ORIGIN, credentials: true }))
app.use(express.json({ limit: '20mb' }))

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() })
})

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/gestures', gestureRoutes)

// ── Socket.io ─────────────────────────────────────────────────────────────────
setupSocket(io)

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 3001
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀  Backend listening on http://0.0.0.0:${PORT}`)
  console.log(`    CORS origin(s): ${CORS_ORIGIN.join(', ')}`)
})
