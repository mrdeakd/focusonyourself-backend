import { Router, Request, Response } from 'express'
import { asyncHandler } from '../utils/asyncHandler'
import { getNarrationMap } from './service'

const router = Router()

router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  res.json(await getNarrationMap())
}))

export default router
