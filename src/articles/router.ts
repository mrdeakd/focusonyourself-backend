import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler'
import { assertDateString } from '../utils/validation'
import { getDailyArticles } from './service'

const router = Router()

router.get('/daily', asyncHandler(async (req, res) => {
  const rawDate = typeof req.query.date === 'string' ? req.query.date : undefined
  const dateStr = rawDate ?? new Date().toISOString().slice(0, 10)
  assertDateString(dateStr, 'date')
  res.json(await getDailyArticles(dateStr))
}))

export default router
