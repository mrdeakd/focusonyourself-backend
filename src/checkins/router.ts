import { Router, Request, Response } from 'express'
import { authenticate } from '../middleware/authenticate'
import { asyncHandler } from '../utils/asyncHandler'
import { upsertCheckIn, getCheckIns, deleteCheckIn, importCheckIns, CheckInInput } from './service'

const router = Router()

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const VALID_MOODS = ['rough', 'low', 'okay', 'good', 'great']

function validateCheckInInput(body: any): { error?: string; data?: CheckInInput } {
  const { dateString, mood, feelingsDescription, sleepQuality, stressLevel, exercised, socialQuality } = body

  if (!dateString || !DATE_REGEX.test(dateString)) {
    return { error: 'dateString is required and must be YYYY-MM-DD' }
  }
  if (!mood || !VALID_MOODS.includes(mood)) {
    return { error: `mood is required. Valid values: ${VALID_MOODS.join(', ')}` }
  }

  const numericFields = { sleepQuality, stressLevel, socialQuality }
  for (const [key, val] of Object.entries(numericFields)) {
    if (val !== undefined && (!Number.isInteger(val) || val < 1 || val > 5)) {
      return { error: `${key} must be an integer between 1 and 5` }
    }
  }

  return { data: { dateString, mood, feelingsDescription, sleepQuality, stressLevel, exercised, socialQuality } }
}

// POST /api/checkins — create or update a check-in for a given date
router.post('/', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { error, data } = validateCheckInInput(req.body)
  if (error) {
    res.status(400).json({ error })
    return
  }
  const checkIn = await upsertCheckIn(req.user!.id, data!)
  res.status(201).json(checkIn)
}))

// GET /api/checkins?from=YYYY-MM-DD&to=YYYY-MM-DD — list all check-ins for the user
router.get('/', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const from = typeof req.query.from === 'string' ? req.query.from : undefined
  const to = typeof req.query.to === 'string' ? req.query.to : undefined

  if (from && !DATE_REGEX.test(from)) {
    res.status(400).json({ error: 'from must be YYYY-MM-DD' })
    return
  }
  if (to && !DATE_REGEX.test(to)) {
    res.status(400).json({ error: 'to must be YYYY-MM-DD' })
    return
  }

  res.json(await getCheckIns(req.user!.id, from, to))
}))

// DELETE /api/checkins/:dateString — remove a specific check-in
router.delete('/:dateString', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const dateString = req.params.dateString as string

  if (!DATE_REGEX.test(dateString)) {
    res.status(400).json({ error: 'dateString must be YYYY-MM-DD' })
    return
  }

  const deleted = await deleteCheckIn(req.user!.id, dateString)
  res.sendStatus(deleted ? 204 : 404)
}))

// POST /api/checkins/import — bulk upsert (used on register to migrate local history)
router.post('/import', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { checkIns } = req.body

  if (!Array.isArray(checkIns)) {
    res.status(400).json({ error: 'checkIns must be an array' })
    return
  }

  const validated: CheckInInput[] = []
  for (const item of checkIns) {
    const { error, data } = validateCheckInInput(item)
    if (error) {
      res.status(400).json({ error: `Invalid check-in: ${error}` })
      return
    }
    validated.push(data!)
  }

  await importCheckIns(req.user!.id, validated)
  res.sendStatus(204)
}))

export default router
