import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler'
import { httpError } from '../utils/httpError'
import { assertPositiveInt } from '../utils/validation'
import { getAffirmationBatch } from './service'

const router = Router()

const VALID_CATEGORIES = ['confidence', 'health', 'relationships', 'mindfulness', 'career', 'resilience']

function parseBatchQuery(query: any): { categories: string[]; count: number } {
  const rawCategories = typeof query.categories === 'string' ? query.categories : ''
  if (rawCategories.trim() === '') {
    throw httpError(400, `categories is required. Valid values: ${VALID_CATEGORIES.join(', ')}`)
  }
  const categories = rawCategories.split(',').map((c: string) => c.trim())
  const invalid = categories.filter((c: string) => !VALID_CATEGORIES.includes(c))
  if (invalid.length > 0) {
    throw httpError(400, `Invalid categories: ${invalid.join(', ')}. Valid values: ${VALID_CATEGORIES.join(', ')}`)
  }
  return { categories, count: assertPositiveInt(query.count, 'count') }
}

router.get('/batch', asyncHandler(async (req, res) => {
  const { categories, count } = parseBatchQuery(req.query)
  res.json(await getAffirmationBatch(categories, count))
}))

export default router
