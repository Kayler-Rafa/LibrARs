import { Router } from 'express'
import { query } from '../db'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(requireAuth)

interface GestureRow {
  id: string
  user_id: string
  name: string
  samples: number[][]
  sample_count: number
  created_at: string
  updated_at: string
}

// GET /api/gestures — todos os gestos do usuário autenticado
router.get('/', async (req: AuthRequest, res) => {
  try {
    const gestures = await query<GestureRow>(
      `SELECT id, name, samples, sample_count, created_at, updated_at
       FROM gestures WHERE user_id = $1 ORDER BY created_at ASC`,
      [req.userId]
    )
    res.json(gestures)
  } catch (e) {
    console.error('list gestures error:', e)
    res.status(500).json({ error: 'Erro interno' })
  }
})

// GET /api/gestures/user/:userId — gestos de outro usuário (para chamadas)
router.get('/user/:userId', async (req: AuthRequest, res) => {
  try {
    const gestures = await query<GestureRow>(
      `SELECT id, name, samples, sample_count FROM gestures
       WHERE user_id = $1 ORDER BY created_at ASC`,
      [req.params.userId]
    )
    res.json(gestures)
  } catch (e) {
    console.error('list user gestures error:', e)
    res.status(500).json({ error: 'Erro interno' })
  }
})

// POST /api/gestures — criar ou atualizar gesto (upsert por id)
router.post('/', async (req: AuthRequest, res) => {
  const { id, name, samples } = req.body as {
    id?: string
    name?: string
    samples?: number[][]
  }

  if (!name?.trim() || !Array.isArray(samples) || samples.length === 0) {
    res.status(400).json({ error: 'name e samples são obrigatórios' })
    return
  }

  try {
    const [gesture] = await query<GestureRow>(
      `INSERT INTO gestures (id, user_id, name, samples, sample_count)
       VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4::jsonb, $5)
       ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name,
             samples = EXCLUDED.samples,
             sample_count = EXCLUDED.sample_count,
             updated_at = now()
       RETURNING id, name, samples, sample_count, created_at, updated_at`,
      [id || null, req.userId, name.trim().toUpperCase(), JSON.stringify(samples), samples.length]
    )
    res.status(201).json(gesture)
  } catch (e) {
    console.error('upsert gesture error:', e)
    res.status(500).json({ error: 'Erro interno' })
  }
})

// DELETE /api/gestures/:id
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const rows = await query(
      'DELETE FROM gestures WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    )
    if (rows.length === 0) {
      res.status(404).json({ error: 'Gesto não encontrado' })
      return
    }
    res.json({ ok: true })
  } catch (e) {
    console.error('delete gesture error:', e)
    res.status(500).json({ error: 'Erro interno' })
  }
})

export default router
