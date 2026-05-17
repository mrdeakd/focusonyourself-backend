import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import {
  hashPassword,
  comparePassword,
  issueTokenPair,
  storeRefreshToken,
  rotateRefreshToken,
} from './service'

const router = Router()

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next)
}

// POST /api/auth/register
router.post('/register', asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Invalid email' })
    return
  }

  if (!password || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' })
    return
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    res.status(409).json({ error: 'Email already in use' })
    return
  }

  const passwordHash = await hashPassword(password)
  const user = await prisma.user.create({ data: { email, passwordHash } })
  const { accessToken, refreshToken, expiresAt } = issueTokenPair(user.id)
  await storeRefreshToken(refreshToken, user.id, expiresAt)

  res.status(201).json({ accessToken, refreshToken, user: { id: user.id, email: user.email } })
}))

// POST /api/auth/login
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const valid = await comparePassword(password, user.passwordHash)
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const { accessToken, refreshToken, expiresAt } = issueTokenPair(user.id)
  await storeRefreshToken(refreshToken, user.id, expiresAt)

  res.json({ accessToken, refreshToken, user: { id: user.id, email: user.email } })
}))

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body

  if (!refreshToken || typeof refreshToken !== 'string') {
    res.status(400).json({ error: 'Refresh token required' })
    return
  }

  try {
    const tokens = await rotateRefreshToken(refreshToken)
    res.json(tokens)
  } catch (err: any) {
    res.status(err.status ?? 401).json({ error: err.message })
  }
})

// POST /api/auth/logout
router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body

  if (refreshToken && typeof refreshToken === 'string') {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } })
  }

  res.sendStatus(204)
}))

// GET /api/auth/me
router.get('/me', authenticate, (req: Request, res: Response) => {
  res.json(req.user)
})

export default router
