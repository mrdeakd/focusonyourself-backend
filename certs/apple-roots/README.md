# Apple Root Certificates

This directory is read at runtime by `src/subscriptions/appleVerifier.ts`. Place Apple's DER-encoded root CA certificates here.

Download from <https://www.apple.com/certificateauthority/>:
- `AppleIncRootCertificate.cer` (G1, required for production)
- `AppleRootCA-G2.cer`
- `AppleRootCA-G3.cer`

Both `.cer` and `.der` extensions are accepted. The verifier loads every matching file in this directory and passes them to `SignedDataVerifier`.

This directory is gitignored — each environment provides its own copy.
