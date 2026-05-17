import { prisma } from '../db'

export async function getMeditationSessions(category?: string) {
  return prisma.meditationSession.findMany({
    where: category ? { category } : undefined,
    include: { steps: { orderBy: { order: 'asc' } } },
  })
}
