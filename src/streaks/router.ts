import { Router } from 'express'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { asyncHandler } from '../utils/asyncHandler'
import { getUserId } from '../utils/authedRequest'
import { computeStreaks, parseTz } from './calculator'

const router = Router()

function toIsoDay(dateString: string | null): string | null {
  return dateString ? `${dateString}T00:00:00Z` : null
}

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const tz = parseTz(req.query.tz) ?? 'UTC'
    const today = new Date().toLocaleDateString('en-CA', { timeZone: tz })

    const rows = await prisma.checkIn.findMany({
      where: { userId: getUserId(req) },
      select: { dateString: true },
    })
    const result = computeStreaks(
      rows.map((r) => r.dateString),
      today,
    )

    res.json({
      currentStreak: result.current,
      longestStreak: result.longest,
      streakStartDate: toIsoDay(result.startDate),
      lastCheckInDate: toIsoDay(result.lastCheckIn),
    })
  }),
)

export default router
