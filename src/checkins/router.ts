import { Router } from 'express'
import { authenticate } from '../middleware/authenticate'
import { asyncHandler } from '../utils/asyncHandler'
import { getUserId } from '../utils/authedRequest'
import { httpError } from '../utils/httpError'
import { assertDateString, assertOneOf, assertOptionalIntInRange } from '../utils/validation'
import { upsertCheckIn, getCheckIns, deleteCheckIn, importCheckIns, CheckInInput } from './service'

const router = Router()

const VALID_MOODS = ['rough', 'low', 'okay', 'good', 'great'] as const

function parseCheckInBody(body: any): CheckInInput {
  const b = body ?? {}
  return {
    dateString: assertDateString(b.dateString, 'dateString'),
    mood: assertOneOf(b.mood, VALID_MOODS, 'mood'),
    feelingsDescription: typeof b.feelingsDescription === 'string' ? b.feelingsDescription : undefined,
    sleepQuality: assertOptionalIntInRange(b.sleepQuality, 1, 5, 'sleepQuality'),
    stressLevel: assertOptionalIntInRange(b.stressLevel, 1, 5, 'stressLevel'),
    socialQuality: assertOptionalIntInRange(b.socialQuality, 1, 5, 'socialQuality'),
    exercised: typeof b.exercised === 'boolean' ? b.exercised : undefined,
  }
}

function parseDateRangeQuery(query: any): { from?: string; to?: string } {
  return {
    from: query.from !== undefined ? assertDateString(query.from, 'from') : undefined,
    to: query.to !== undefined ? assertDateString(query.to, 'to') : undefined,
  }
}

// POST /api/checkins — create or update a check-in for a given date
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const data = parseCheckInBody(req.body)
  res.status(201).json(await upsertCheckIn(getUserId(req), data))
}))

// GET /api/checkins?from=YYYY-MM-DD&to=YYYY-MM-DD — list all check-ins for the user
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { from, to } = parseDateRangeQuery(req.query)
  res.json(await getCheckIns(getUserId(req), from, to))
}))

// DELETE /api/checkins/:dateString — remove a specific check-in
router.delete('/:dateString', authenticate, asyncHandler(async (req, res) => {
  const dateString = assertDateString(req.params.dateString, 'dateString')
  const deleted = await deleteCheckIn(getUserId(req), dateString)
  res.sendStatus(deleted ? 204 : 404)
}))

// POST /api/checkins/import — bulk upsert (used on register to migrate local history)
router.post('/import', authenticate, asyncHandler(async (req, res) => {
  const { checkIns } = req.body ?? {}
  if (!Array.isArray(checkIns)) throw httpError(400, 'checkIns must be an array')
  const validated = checkIns.map(parseCheckInBody)
  await importCheckIns(getUserId(req), validated)
  res.sendStatus(204)
}))

export default router
