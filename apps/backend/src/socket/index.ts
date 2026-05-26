import { Server } from 'socket.io'

interface RoomMember {
  socketId: string
  userId?: string
  userName?: string
}

// rooms: code → members (max 2)
const rooms = new Map<string, RoomMember[]>()

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export function setupSocket(io: Server): void {
  io.on('connection', (socket) => {
    console.log(`[ws] connected  ${socket.id}`)

    // ── CREATE ROOM ──────────────────────────────────────────────────────────
    socket.on(
      'create-room',
      (data: { userId?: string; userName?: string }, cb: (r: { code: string }) => void) => {
        let code = generateCode()
        while (rooms.has(code)) code = generateCode() // evita colisão rara

        rooms.set(code, [{ socketId: socket.id, userId: data?.userId, userName: data?.userName }])
        socket.join(code)
        ;(socket as unknown as Record<string, unknown>)['currentRoom'] = code

        console.log(`[ws] room created  ${code}`)
        cb({ code })
      }
    )

    // ── JOIN ROOM ─────────────────────────────────────────────────────────────
    socket.on(
      'join-room',
      (
        data: { code: string; userId?: string; userName?: string },
        cb: (r: { ok?: boolean; error?: string; peerUserId?: string; peerUserName?: string }) => void
      ) => {
        const code = (data.code || '').toUpperCase().trim()
        const room = rooms.get(code)

        if (!room) {
          cb({ error: 'Sala não encontrada' })
          return
        }
        if (room.length >= 2) {
          cb({ error: 'Sala cheia (máximo 2 pessoas)' })
          return
        }

        const peer = room[0]
        room.push({ socketId: socket.id, userId: data?.userId, userName: data?.userName })
        socket.join(code)
        ;(socket as unknown as Record<string, unknown>)['currentRoom'] = code

        // Avisa quem criou a sala
        io.to(peer.socketId).emit('peer-joined', {
          userId: data?.userId,
          userName: data?.userName,
        })

        console.log(`[ws] user joined room  ${code}`)
        cb({ ok: true, peerUserId: peer.userId, peerUserName: peer.userName })
      }
    )

    // ── WEBRTC SIGNALING ──────────────────────────────────────────────────────
    socket.on('webrtc-offer', (d: { code: string; sdp: unknown }) =>
      socket.to(d.code).emit('webrtc-offer', { sdp: d.sdp })
    )

    socket.on('webrtc-answer', (d: { code: string; sdp: unknown }) =>
      socket.to(d.code).emit('webrtc-answer', { sdp: d.sdp })
    )

    socket.on('webrtc-ice', (d: { code: string; candidate: unknown }) =>
      socket.to(d.code).emit('webrtc-ice', { candidate: d.candidate })
    )

    // ── GESTURE RELAY ─────────────────────────────────────────────────────────
    // User A envia gesto classificado → backend repassa para User B
    socket.on('gesture', (d: { code: string; gesture: string; confidence: number }) => {
      socket.to(d.code).emit('peer-gesture', {
        gesture: d.gesture,
        confidence: d.confidence,
      })
    })

    // ── DISCONNECT ────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`[ws] disconnected  ${socket.id}`)

      rooms.forEach((members, code) => {
        const idx = members.findIndex((m) => m.socketId === socket.id)
        if (idx === -1) return

        members.splice(idx, 1)
        socket.to(code).emit('peer-left')

        if (members.length === 0) {
          rooms.delete(code)
          console.log(`[ws] room deleted  ${code}`)
        }
      })
    })
  })
}
