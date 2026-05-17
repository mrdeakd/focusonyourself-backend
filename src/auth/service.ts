import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../db'

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-jwt-secret'
const REFRESH_SECRET = process.env.REFRESH_SECRET ?? 'dev-refresh-secret'

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12)
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '15m' })
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId }, REFRESH_SECRET, { expiresIn: '30d' })
}

export async function storeRefreshToken(token: string, userId: string, expiresAt: Date): Promise<void> {
  await prisma.refreshToken.create({ data: { token, userId, expiresAt } })
}

export async function rotateRefreshToken(oldToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  const existing = await prisma.refreshToken.findUnique({ where: { token: oldToken } })

  if (!existing) {
    throw Object.assign(new Error('Invalid refresh token'), { status: 401 })
  }

  if (existing.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { token: oldToken } })
    throw Object.assign(new Error('Refresh token expired'), { status: 401 })
  }

  await prisma.refreshToken.delete({ where: { token: oldToken } })

  const accessToken = signAccessToken(existing.userId)
  const refreshToken = signRefreshToken(existing.userId)
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  await storeRefreshToken(refreshToken, existing.userId, expiresAt)

  return { accessToken, refreshToken }
}

export function issueTokenPair(userId: string): { accessToken: string; refreshToken: string; expiresAt: Date } {
  const accessToken = signAccessToken(userId)
  const refreshToken = signRefreshToken(userId)
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  return { accessToken, refreshToken, expiresAt }
}
