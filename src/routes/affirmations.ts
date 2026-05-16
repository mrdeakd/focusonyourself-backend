import { Router, Request, Response } from 'express'
import { prisma } from '../db'
import { seededShuffle } from '../utils/shuffle'

const router = Router()

const VALID_CATEGORIES = ['confidence', 'health', 'relationships', 'mindfulness', 'career', 'resilience']

router.get('/batch', async (req: Request, res: Response) => {
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

  const affirmations = await prisma.affirmation.findMany({
    where: { category: { in: categories } },
  })

  const shuffled = seededShuffle(affirmations, Date.now().toString())

  res.json(shuffled.slice(0, count).map(({ quote, category }) => ({ quote, category })))
})

export default router
