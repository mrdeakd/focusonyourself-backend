import jwt, { JwtPayload, TokenExpiredError } from 'jsonwebtoken'
import { prisma } from '../db'
import { asyncHandler } from '../utils/asyncHandler'
import { httpError } from '../utils/httpError'

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-jwt-secret'

export const authenticate = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw httpError(401, 'Authorization header required')
  }

  const token = authHeader.split(' ')[1]
  let payload: JwtPayload
  try {
    payload = jwt.verify(token, JWT_SECRET) as JwtPayload
  } catch (err) {
    if (err instanceof TokenExpiredError) throw httpError(401, 'Token expired')
    throw httpError(401, 'Invalid token')
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub as string },
    select: { id: true, email: true },
  })
  if (!user) throw httpError(401, 'User not found')

  req.user = user
  next()
})
