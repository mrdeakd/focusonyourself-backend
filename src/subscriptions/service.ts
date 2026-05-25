import { prisma } from '../db'

export type SubscriptionStatus = 'active' | 'expired' | 'revoked' | 'in_grace_period'

export interface SubscriptionSnapshot {
  isPro: boolean
  expiresAt: Date | null
  productId: string | null
}

export interface UpsertSubscriptionInput {
  userId: string
  productId: string
  originalTransactionId: string
  expiresAt: Date
  status: SubscriptionStatus
  environment: string
}

export async function upsertSubscription(input: UpsertSubscriptionInput): Promise<void> {
  await prisma.subscription.upsert({
    where: { originalTransactionId: input.originalTransactionId },
    create: {
      userId: input.userId,
      productId: input.productId,
      originalTransactionId: input.originalTransactionId,
      expiresAt: input.expiresAt,
      status: input.status,
      environment: input.environment,
    },
    update: {
      productId: input.productId,
      expiresAt: input.expiresAt,
      status: input.status,
      environment: input.environment,
      lastVerifiedAt: new Date(),
    },
  })
}

export async function userProSnapshot(userId: string): Promise<SubscriptionSnapshot> {
  const now = new Date()
  const active = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ['active', 'in_grace_period'] },
      expiresAt: { gt: now },
    },
    orderBy: { expiresAt: 'desc' },
  })
  if (!active) return { isPro: false, expiresAt: null, productId: null }
  return { isPro: true, expiresAt: active.expiresAt, productId: active.productId }
}

export async function applyNotificationToSubscription(
  originalTransactionId: string,
  patch: Partial<Pick<UpsertSubscriptionInput, 'expiresAt' | 'status' | 'productId'>>,
): Promise<boolean> {
  const existing = await prisma.subscription.findUnique({ where: { originalTransactionId } })
  if (!existing) return false
  await prisma.subscription.update({
    where: { originalTransactionId },
    data: { ...patch, lastVerifiedAt: new Date() },
  })
  return true
}
