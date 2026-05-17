import { Request, Response, NextFunction } from 'express'
import jwt, { JwtPayload, TokenExpiredError } from 'jsonwebtoken'
import { prisma } from '../db'

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-jwt-secret'

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization header required' })
    return
  }

  const token = authHeader.split(' ')[1]

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload
    const userId = payload.sub as string

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } })
    if (!user) {
      res.status(401).json({ error: 'User not found' })
      return
    }

    req.user = user
    next()
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' })
    } else {
      res.status(401).json({ error: 'Invalid token' })
    }
  }
}
