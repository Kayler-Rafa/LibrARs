import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { query } from '../db'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me-in-production'

interface UserRow {
  id: string
  email: string
  name: string
  password_hash: string
}

function makeToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '30d' })
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body as {
    email?: string
    password?: string
    name?: string
  }

  if (!email || !password) {
    res.status(400).json({ error: 'Email e senha são obrigatórios' })
    return
  }

  try {
    const existing = await query('SELECT id FROM users WHERE email = $1', [email])
    if (existing.length > 0) {
      res.status(409).json({ error: 'Este email já está cadastrado' })
      return
    }

    const hash = await bcrypt.hash(password, 12)
    const displayName = name?.trim() || email.split('@')[0]

    const [user] = await query<UserRow>(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email.toLowerCase().trim(), hash, displayName]
    )

    res.status(201).json({
      token: makeToken(user.id, user.email),
      user: { id: user.id, email: user.email, name: user.name },
    })
  } catch (e) {
    console.error('register error:', e)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string }

  if (!email || !password) {
    res.status(400).json({ error: 'Email e senha são obrigatórios' })
    return
  }

  try {
    const [user] = await query<UserRow>(
      'SELECT id, email, name, password_hash FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    )

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      res.status(401).json({ error: 'Email ou senha incorretos' })
      return
    }

    res.json({
      token: makeToken(user.id, user.email),
      user: { id: user.id, email: user.email, name: user.name },
    })
  } catch (e) {
    console.error('login error:', e)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await query<UserRow>(
      'SELECT id, email, name FROM users WHERE id = $1',
      [req.userId]
    )
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado' })
      return
    }
    res.json({ id: user.id, email: user.email, name: user.name })
  } catch (e) {
    console.error('me error:', e)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router
