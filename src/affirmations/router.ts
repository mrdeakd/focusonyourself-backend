import { Router, Request, Response } from 'express'
import { asyncHandler } from '../utils/asyncHandler'
import { getAffirmationBatch } from './service'

const router = Router()

const VALID_CATEGORIES = ['confidence', 'health', 'relationships', 'mindfulness', 'career', 'resilience']

router.get('/batch', asyncHandler(async (req: Request, res: Response) => {
  const rawCategories = req.query.categories as string | undefined
  const rawCount = req.query.count as string | undefined

  if (!rawCategories || rawCategories.trim() === '') {
    res.status(400).json({ error: 'categories is required. Valid values: ' + VALID_CATEGORIES.join(', ') })
    return
  }

  const categories = rawCategories.split(',').map(c => c.trim())
  const invalid = categories.filter(c => !VALID_CATEGORIES.includes(c))
  if (invalid.length > 0) {
    res.status(400).json({ error: `Invalid categories: ${invalid.join(', ')}. Valid values: ${VALID_CATEGORIES.join(', ')}` })
    return
  }

  const count = parseInt(rawCount ?? '', 10)
  if (!rawCount || isNaN(count) || count <= 0) {
    res.status(400).json({ error: 'count is required and must be a positive integer.' })
    return
  }

  res.json(await getAffirmationBatch(categories, count))
}))

export default router
