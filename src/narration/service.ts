import { prisma } from '../db'

export async function getNarrationMap(): Promise<Record<string, string>> {
  const entries = await prisma.narrationEntry.findMany()
  return Object.fromEntries(entries.map(e => [e.instruction, e.audioUrl]))
}
