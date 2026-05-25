import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import {
  SignedDataVerifier,
  Environment,
  JWSTransactionDecodedPayload,
  ResponseBodyV2DecodedPayload,
} from '@apple/app-store-server-library'

const BUNDLE_ID = process.env.APPLE_BUNDLE_ID ?? ''
const ROOTS_DIR = process.env.APPLE_ROOT_CERTS_DIR ?? join(__dirname, '..', '..', 'certs', 'apple-roots')

function loadRootCertificates(): Buffer[] {
  if (!existsSync(ROOTS_DIR)) {
    throw new Error(
      `Apple root certificates directory not found at ${ROOTS_DIR}. ` +
        `Download Apple Inc. Root CAs from https://www.apple.com/certificateauthority/ ` +
        `(AppleIncRootCertificate.cer, AppleRootCA-G2.cer, AppleRootCA-G3.cer) and place them there.`,
    )
  }
  const allFiles = readdirSync(ROOTS_DIR)
  const files = allFiles.filter((f) => f.endsWith('.cer') || f.endsWith('.der'))
  console.log(`[appleVerifier] ROOTS_DIR=${ROOTS_DIR} all=${JSON.stringify(allFiles)} matched=${JSON.stringify(files)}`)
  if (files.length === 0) {
    throw new Error(`No .cer/.der files found in ${ROOTS_DIR}`)
  }
  return files.map((f) => readFileSync(join(ROOTS_DIR, f)))
}

const verifierCache = new Map<Environment, SignedDataVerifier>()
let cachedRoots: Buffer[] | undefined

function getVerifier(environment: Environment): SignedDataVerifier {
  const cached = verifierCache.get(environment)
  if (cached) return cached
  if (!BUNDLE_ID) throw new Error('APPLE_BUNDLE_ID env var is required')
  if (!cachedRoots) cachedRoots = loadRootCertificates()
  const verifier = new SignedDataVerifier(cachedRoots, false, environment, BUNDLE_ID)
  verifierCache.set(environment, verifier)
  return verifier
}

// Peek the JWS payload (middle base64url segment) to determine the App Store environment
// before signature verification. Production is the safe default — a tampered or malformed
// payload that misses peeking will subsequently fail the cryptographic verify anyway.
function peekEnvironment(jws: string): Environment {
  const segments = jws.split('.')
  if (segments.length < 2) return Environment.PRODUCTION
  try {
    const json = Buffer.from(segments[1], 'base64url').toString('utf8')
    const payload = JSON.parse(json) as { environment?: string; data?: { environment?: string } }
    const raw = payload.environment ?? payload.data?.environment
    switch (raw) {
      case 'Sandbox':       return Environment.SANDBOX
      case 'Xcode':         return Environment.XCODE
      case 'LocalTesting':  return Environment.LOCAL_TESTING
      case 'Production':    return Environment.PRODUCTION
      default:              return Environment.PRODUCTION
    }
  } catch {
    return Environment.PRODUCTION
  }
}

export async function verifyTransaction(jws: string): Promise<JWSTransactionDecodedPayload> {
  return getVerifier(peekEnvironment(jws)).verifyAndDecodeTransaction(jws)
}

export async function verifyNotification(jws: string): Promise<ResponseBodyV2DecodedPayload> {
  return getVerifier(peekEnvironment(jws)).verifyAndDecodeNotification(jws)
}

export function expectedBundleId(): string {
  return BUNDLE_ID
}
