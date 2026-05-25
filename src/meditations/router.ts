import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler'
import { assertOneOf } from '../utils/validation'
import { getMeditationSessions } from './service'

const router = Router()

const VALID_CATEGORIES = ['morning', 'focus', 'anxiety', 'sleep'] as const

router.get('/', asyncHandler(async (req, res) => {
  const category = req.query.category !== undefined
    ? assertOneOf(req.query.category, VALID_CATEGORIES, 'category')
    : undefined
  res.json(await getMeditationSessions(category))
}))

export default router
