import 'dotenv/config'
import express, { Request, Response, NextFunction } from 'express'
import morgan from 'morgan'
import articleRoutes from './articles/router'
import meditationRoutes from './meditations/router'
import affirmationRoutes from './affirmations/router'
import narrationMapRoutes from './narration/router'
import authRoutes from './auth/router'
import checkInRoutes from './checkins/router'

const app = express()
const PORT = Number(process.env.PORT) || 3005

app.use(morgan('tiny'))
app.use(express.json())

app.get('/health', (_req, res) => { res.sendStatus(200) })

app.use('/api/articles', articleRoutes)
app.use('/api/meditations', meditationRoutes)
app.use('/api/affirmations', affirmationRoutes)
app.use('/api/narration-map', narrationMapRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/checkins', checkInRoutes)

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err)
  res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`FocusOnYourself backend running on http://localhost:${PORT}`)
})
