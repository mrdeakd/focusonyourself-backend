import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db',
})
const prisma = new PrismaClient({ adapter })

interface RawArticle {
  id: string
  title: string
  topic: string
  readTimeMinutes: number
  body: string
}

interface RawMeditationStep {
  instruction?: string
  silenceDurationSeconds?: number
}

interface RawMeditationSession {
  id: string
  title: string
  category: string
  durationMinutes: number
  isPro: boolean
  steps: RawMeditationStep[]
}

async function seedArticles() {
  const count = await prisma.article.count()
  if (count > 0) {
    console.log(`Database already has ${count} articles, skipping seed.`)
    return
  }

  const jsonPath = path.join(process.cwd(), 'prisma', 'articles.json')
  const articles: RawArticle[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))

  for (const article of articles) {
    await prisma.article.upsert({
      where: { id: article.id },
      update: {},
      create: {
        id: article.id,
        title: article.title,
        topic: article.topic,
        readTimeMinutes: article.readTimeMinutes,
        body: article.body,
      },
    })
  }

  console.log(`Seeded ${articles.length} articles.`)
}

async function seedMeditations() {
  const count = await prisma.meditationSession.count()
  if (count > 0) {
    console.log(`Database already has ${count} meditation sessions, skipping seed.`)
    return
  }

  const jsonPath = path.join(process.cwd(), 'prisma', 'meditations.json')
  const sessions: RawMeditationSession[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))

  for (const session of sessions) {
    await prisma.meditationSession.create({
      data: {
        id: session.id,
        title: session.title,
        category: session.category,
        durationMinutes: session.durationMinutes,
        isPro: session.isPro,
        steps: {
          create: session.steps.map((step, index) => ({
            order: index,
            instruction: step.instruction ?? null,
            silenceDurationSeconds: step.silenceDurationSeconds ?? null,
          })),
        },
      },
    })
  }

  console.log(`Seeded ${sessions.length} meditation sessions.`)
}

async function seedAffirmations() {
  const count = await prisma.affirmation.count()
  if (count > 0) {
    console.log(`Database already has ${count} affirmations, skipping seed.`)
    return
  }

  const jsonPath = path.join(process.cwd(), 'prisma', 'affirmations.json')
  const raw: { quote: string; category: string }[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))

  await prisma.affirmation.createMany({
    data: raw.map(({ quote, category }) => ({ quote, category })),
  })

  console.log(`Seeded ${raw.length} affirmations.`)
}

async function seedNarrationEntries() {
  const count = await prisma.narrationEntry.count()
  if (count > 0) {
    console.log(`Database already has ${count} narration entries, skipping seed.`)
    return
  }

  const baseUrl = process.env.SUPABASE_AUDIO_URL ?? ''
  const jsonPath = path.join(process.cwd(), 'prisma', 'narration_map.json')
  const raw: Record<string, string> = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))

  await prisma.narrationEntry.createMany({
    data: Object.entries(raw).map(([instruction, filename]) => ({
      instruction,
      audioUrl: `${baseUrl}/${filename}.mp3`,
    })),
  })

  console.log(`Seeded ${Object.keys(raw).length} narration entries.`)
}

async function seedDevUser() {
  const email = 'dev@test.com'
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log('Dev user already exists, skipping.')
    return
  }
  const bcrypt = await import('bcryptjs')
  const passwordHash = await bcrypt.hash('password123', 12)
  await prisma.user.create({ data: { email, passwordHash } })
  console.log(`Seeded dev user: ${email}`)
}

async function main() {
  await seedArticles()
  await seedMeditations()
  await seedAffirmations()
  await seedNarrationEntries()
  await seedDevUser()
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
