import { Request } from 'express'
import { httpError } from './httpError'

export function getAuthedUser(req: Request): { id: string; email: string } {
  if (!req.user) throw httpError(401, 'Not authenticated')
  return req.user
}

export function getUserId(req: Request): string {
  return getAuthedUser(req).id
}
