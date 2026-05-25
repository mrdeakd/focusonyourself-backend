import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../db'
import { httpError } from '../utils/httpError'

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-jwt-secret'
const REFRESH_SECRET = process.env.REFRESH_SECRET ?? 'dev-refresh-secret'
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000

export interface AuthResult {
  accessToken: string
  refreshToken: string
  user: { id: string; email: string }
}

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12)
}

async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId, jti: randomUUID() }, JWT_SECRET, { expiresIn: '15m' })
}

function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, jti: randomUUID() }, REFRESH_SECRET, { expiresIn: '30d' })
}

async function issueAuthResult(user: { id: string; email: string }): Promise<AuthResult> {
  const accessToken = signAccessToken(user.id)
  const refreshToken = signRefreshToken(user.id)
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS)
  await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt } })
  return { accessToken, refreshToken, user }
}

export async function registerUser(email: string, password: string): Promise<AuthResult> {
  if (await prisma.user.findUnique({ where: { email } })) {
    throw httpError(409, 'Email already in use')
  }
  const passwordHash = await hashPassword(password)
  const user = await prisma.user.create({ data: { email, passwordHash }, select: { id: true, email: true } })
  return issueAuthResult(user)
}

export async function loginUser(email: string, password: string): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !(await comparePassword(password, user.passwordHash))) {
    throw httpError(401, 'Invalid credentials')
  }
  return issueAuthResult({ id: user.id, email: user.email })
}

export async function rotateRefreshToken(oldToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  const existing = await prisma.refreshToken.findUnique({ where: { token: oldToken } })
  if (!existing) throw httpError(401, 'Invalid refresh token')

  if (existing.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { token: oldToken } })
    throw httpError(401, 'Refresh token expired')
  }

  await prisma.refreshToken.delete({ where: { token: oldToken } })

  const accessToken = signAccessToken(existing.userId)
  const refreshToken = signRefreshToken(existing.userId)
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS)
  await prisma.refreshToken.create({ data: { token: refreshToken, userId: existing.userId, expiresAt } })

  return { accessToken, refreshToken }
}

export async function logoutUser(refreshToken: string | undefined): Promise<void> {
  if (refreshToken && typeof refreshToken === 'string') {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } })
  }
}
