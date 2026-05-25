import rateLimit from 'express-rate-limit'
import type { Request, Response, NextFunction } from 'express'
import { httpError } from '../utils/httpError'

const FIFTEEN_MINUTES = 15 * 60 * 1000
const ONE_HOUR = 60 * 60 * 1000

function tooManyRequests(_req: Request, _res: Response, next: NextFunction): void {
  next(httpError(429, 'Too many requests, try again later'))
}

const skipInTests = (): boolean => process.env.NODE_ENV === 'test'

export const registerLimiter = rateLimit({
  windowMs: ONE_HOUR,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipInTests,
  handler: tooManyRequests,
})

const loginByIp = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipInTests,
  skipSuccessfulRequests: true,
  handler: tooManyRequests,
})

const loginByEmail = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipInTests,
  skipSuccessfulRequests: true,
  keyGenerator: (req: Request): string =>
    typeof req.body?.email === 'string' ? req.body.email : 'unknown',
  handler: tooManyRequests,
})

export const loginLimiter = [loginByIp, loginByEmail]

export const refreshLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipInTests,
  handler: tooManyRequests,
})
