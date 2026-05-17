import { Router, Request, Response } from 'express'
import { asyncHandler } from '../utils/asyncHandler'
import { getMeditationSessions } from './service'

const router = Router()

const VALID_CATEGORIES = ['morning', 'focus', 'anxiety', 'sleep']

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const category = req.query.category as string | undefined

  if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
    res.status(400).json({
      error: `Invalid category. Valid values: ${VALID_CATEGORIES.join(', ')}`,
    })
    return
  }

  res.json(await getMeditationSessions(category))
}))

export default router
