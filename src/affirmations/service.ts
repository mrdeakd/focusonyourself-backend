import { prisma } from '../db'
import { seededShuffle } from '../utils/shuffle'

export async function getAffirmationBatch(categories: string[], count: number) {
  const affirmations = await prisma.affirmation.findMany({
    where: { category: { in: categories } },
  })
  return seededShuffle(affirmations, Date.now().toString())
    .slice(0, count)
    .map(({ quote, category }) => ({ quote, category }))
}
