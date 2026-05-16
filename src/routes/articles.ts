import { Router, Request, Response } from 'express'
import seedrandom from 'seedrandom'
import { prisma } from '../db'

const router = Router()

function seededShuffle<T>(items: T[], date: string): T[] {
  const rng = seedrandom(date)
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

router.get('/daily', async (req: Request, res: Response) => {
  const rawDate = req.query.date as string | undefined
  const dateStr = rawDate ?? new Date().toISOString().slice(0, 10)

  if (!DATE_REGEX.test(dateStr)) {
    res.status(400).json({ error: 'Invalid date. Use YYYY-MM-DD format.' })
    return
  }

  const articles = await prisma.article.findMany()
  const shuffled = seededShuffle(articles, dateStr)

  res.json(shuffled.slice(0, 4))
})

export default router
