import { prisma } from '../db'
import { seededShuffle } from '../utils/shuffle'

export async function getDailyArticles(dateStr: string) {
  const articles = await prisma.article.findMany()
  return seededShuffle(articles, dateStr).slice(0, 4)
}
