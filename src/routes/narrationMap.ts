import { Router, Request, Response } from 'express'
import { prisma } from '../db'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  const entries = await prisma.narrationEntry.findMany()
  const map = Object.fromEntries(entries.map(e => [e.instruction, e.audioUrl]))
  res.json(map)
})

export default router
