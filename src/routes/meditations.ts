import { Router, Request, Response } from 'express'
import { prisma } from '../db'

const router = Router()

const VALID_CATEGORIES = ['morning', 'focus', 'anxiety', 'sleep']

router.get('/', async (req: Request, res: Response) => {
  const category = req.query.category as string | undefined

  if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
    res.status(400).json({
      error: `Invalid category. Valid values: ${VALID_CATEGORIES.join(', ')}`,
    })
    return
  }

  const sessions = await prisma.meditationSession.findMany({
    where: category ? { category } : undefined,
    include: {
      steps: { orderBy: { order: 'asc' } },
    },
  })

  res.json(sessions)
})

export default router
