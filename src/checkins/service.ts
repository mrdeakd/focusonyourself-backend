import { prisma } from '../db'

export interface CheckInInput {
  dateString: string
  mood: string
  feelingsDescription?: string
  sleepQuality?: number
  stressLevel?: number
  exercised?: boolean
  socialQuality?: number
}

export async function upsertCheckIn(userId: string, data: CheckInInput) {
  return prisma.checkIn.upsert({
    where: { userId_dateString: { userId, dateString: data.dateString } },
    create: { userId, ...data },
    update: {
      mood: data.mood,
      feelingsDescription: data.feelingsDescription ?? null,
      sleepQuality: data.sleepQuality ?? null,
      stressLevel: data.stressLevel ?? null,
      exercised: data.exercised ?? null,
      socialQuality: data.socialQuality ?? null,
    },
  })
}

export async function getCheckIns(userId: string, from?: string, to?: string) {
  return prisma.checkIn.findMany({
    where: {
      userId,
      ...(from || to ? {
        dateString: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        },
      } : {}),
    },
    orderBy: { dateString: 'desc' },
  })
}

export async function deleteCheckIn(userId: string, dateString: string): Promise<boolean> {
  const result = await prisma.checkIn.deleteMany({
    where: { userId, dateString },
  })
  return result.count > 0
}

export async function importCheckIns(userId: string, items: CheckInInput[]): Promise<void> {
  for (const item of items) {
    await upsertCheckIn(userId, item)
  }
}
