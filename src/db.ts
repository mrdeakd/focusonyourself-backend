import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from '@prisma/client'

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL ?? 'file:/app/data/dev.db',
})

export const prisma = new PrismaClient({ adapter })
