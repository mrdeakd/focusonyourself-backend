import express from 'express'
import morgan from 'morgan'
import articleRoutes from './routes/articles'
import meditationRoutes from './routes/meditations'
import affirmationRoutes from './routes/affirmations'
import narrationMapRoutes from './routes/narrationMap'

const app = express()
const PORT = Number(process.env.PORT) || 3005

app.use(morgan('tiny'))
app.use(express.json())

app.get('/health', (_req, res) => { res.sendStatus(200) })

app.use('/api/articles', articleRoutes)
app.use('/api/meditations', meditationRoutes)
app.use('/api/affirmations', affirmationRoutes)
app.use('/api/narration-map', narrationMapRoutes)

app.listen(PORT, '0.0.0.0', () => {
  console.log(`FocusOnYourself backend running on http://localhost:${PORT}`)
})
