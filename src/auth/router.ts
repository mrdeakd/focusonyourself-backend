import { Router } from 'express'
import { authenticate } from '../middleware/authenticate'
import { registerLimiter, loginLimiter, refreshLimiter } from '../middleware/rateLimit'
import { asyncHandler } from '../utils/asyncHandler'
import { getAuthedUser } from '../utils/authedRequest'
import { httpError } from '../utils/httpError'
import { registerUser, loginUser, rotateRefreshToken, logoutUser } from './service'
import { userProSnapshot } from '../subscriptions/service'

const router = Router()

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function parseCredentials(body: any): { email: string; password: string } {
  const { email, password } = body ?? {}
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) throw httpError(400, 'Invalid email')
  if (typeof password !== 'string' || password.length < 8) throw httpError(400, 'Password must be at least 8 characters')
  return { email, password }
}

function parseRefreshToken(body: any): string {
  const { refreshToken } = body ?? {}
  if (typeof refreshToken !== 'string' || refreshToken.length === 0) throw httpError(400, 'Refresh token required')
  return refreshToken
}

router.post('/register', registerLimiter, asyncHandler(async (req, res) => {
  const { email, password } = parseCredentials(req.body)
  res.status(201).json(await registerUser(email, password))
}))

router.post('/login', ...loginLimiter, asyncHandler(async (req, res) => {
  const { email, password } = parseCredentials(req.body)
  res.json(await loginUser(email, password))
}))

router.post('/refresh', refreshLimiter, asyncHandler(async (req, res) => {
  res.json(await rotateRefreshToken(parseRefreshToken(req.body)))
}))

router.post('/logout', asyncHandler(async (req, res) => {
  await logoutUser(req.body?.refreshToken)
  res.sendStatus(204)
}))

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = getAuthedUser(req)
  const pro = await userProSnapshot(user.id)
  res.json({ ...user, isPro: pro.isPro, proExpiresAt: pro.expiresAt })
}))

export default router
