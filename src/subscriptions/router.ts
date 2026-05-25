import { Router } from 'express'
import { NotificationTypeV2 } from '@apple/app-store-server-library'
import { authenticate } from '../middleware/authenticate'
import { asyncHandler } from '../utils/asyncHandler'
import { getUserId } from '../utils/authedRequest'
import { httpError } from '../utils/httpError'
import { expectedBundleId, verifyNotification, verifyTransaction } from './appleVerifier'
import {
  applyNotificationToSubscription,
  SubscriptionStatus,
  upsertSubscription,
  userProSnapshot,
} from './service'

const router = Router()

function parseSignedTransaction(body: any): string {
  const value = body?.signedTransaction
  if (typeof value !== 'string' || value.length === 0) {
    throw httpError(400, 'signedTransaction must be a non-empty string')
  }
  return value
}

function parseSignedPayload(body: any): string {
  const value = body?.signedPayload
  if (typeof value !== 'string' || value.length === 0) {
    throw httpError(400, 'signedPayload must be a non-empty string')
  }
  return value
}

function statusFromPayload(expiresAt: Date, revocationDate?: number): SubscriptionStatus {
  if (revocationDate) return 'revoked'
  return expiresAt.getTime() > Date.now() ? 'active' : 'expired'
}

router.post(
  '/verify',
  authenticate,
  asyncHandler(async (req, res) => {
    const signedTransaction = parseSignedTransaction(req.body)

    let payload
    try {
      payload = await verifyTransaction(signedTransaction)
    } catch {
      throw httpError(400, 'signedTransaction failed verification')
    }

    if (!payload.bundleId || payload.bundleId !== expectedBundleId()) {
      throw httpError(400, 'bundleId mismatch')
    }
    if (!payload.originalTransactionId || !payload.productId || !payload.expiresDate) {
      throw httpError(400, 'signedTransaction missing required fields')
    }

    const expiresAt = new Date(payload.expiresDate)
    await upsertSubscription({
      userId: getUserId(req),
      productId: payload.productId,
      originalTransactionId: payload.originalTransactionId,
      expiresAt,
      status: statusFromPayload(expiresAt, payload.revocationDate),
      environment: typeof payload.environment === 'string' ? payload.environment : String(payload.environment ?? ''),
    })

    res.json(await userProSnapshot(getUserId(req)))
  }),
)

router.post(
  '/notifications',
  asyncHandler(async (req, res) => {
    const signedPayload = parseSignedPayload(req.body)

    let envelope
    try {
      envelope = await verifyNotification(signedPayload)
    } catch {
      throw httpError(401, 'notification failed verification')
    }

    const signedTransactionInfo = envelope.data?.signedTransactionInfo
    if (!signedTransactionInfo) {
      // TEST or non-transaction notifications — accept and exit
      res.sendStatus(200)
      return
    }

    let tx
    try {
      tx = await verifyTransaction(signedTransactionInfo)
    } catch {
      throw httpError(401, 'embedded transaction failed verification')
    }
    if (!tx.originalTransactionId) {
      res.sendStatus(200)
      return
    }

    const type = envelope.notificationType
    const newExpiresAt = tx.expiresDate ? new Date(tx.expiresDate) : undefined

    let nextStatus: SubscriptionStatus | undefined
    switch (type) {
      case NotificationTypeV2.REFUND:
      case NotificationTypeV2.REVOKE:
        nextStatus = 'revoked'
        break
      case NotificationTypeV2.EXPIRED:
      case NotificationTypeV2.GRACE_PERIOD_EXPIRED:
        nextStatus = 'expired'
        break
      case NotificationTypeV2.DID_RENEW:
      case NotificationTypeV2.SUBSCRIBED:
      case NotificationTypeV2.REFUND_REVERSED:
        nextStatus = 'active'
        break
      default:
        // Unknown / non-state-changing types — log and ack
        console.log(`[subscriptions] notification ${type} for ${tx.originalTransactionId} (no-op)`)
        res.sendStatus(200)
        return
    }

    const applied = await applyNotificationToSubscription(tx.originalTransactionId, {
      status: nextStatus,
      ...(newExpiresAt ? { expiresAt: newExpiresAt } : {}),
      ...(tx.productId ? { productId: tx.productId } : {}),
    })
    if (!applied) {
      console.log(`[subscriptions] notification ${type} for unknown originalTransactionId ${tx.originalTransactionId}`)
    }
    res.sendStatus(200)
  }),
)

export default router
