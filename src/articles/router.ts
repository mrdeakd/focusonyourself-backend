import { Router, Request, Response } from 'express'
import { asyncHandler } from '../utils/asyncHandler'
import { getDailyArticles } from './service'

const router = Router()

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

router.get('/daily', asyncHandler(async (req: Request, res: Response) => {
  const rawDate = req.query.date as string | undefined
  const dateStr = rawDate ?? new Date().toISOString().slice(0, 10)

  if (!DATE_REGEX.test(dateStr)) {
    res.status(400).json({ error: 'Invalid date. Use YYYY-MM-DD format.' })
    return
  }

  res.json(await getDailyArticles(dateStr))
}))

export default router
