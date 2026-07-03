#!/usr/bin/env node
// Minimal & safe Firebase Admin SDK smoke test (no writes)
// Usage:
//   export FIREBASE_CREDENTIALS_FILE=secrets/firebase-adminsdk.json
//   node scripts/tests/admin-sdk-smoke.mjs

import app, { auth, db } from '../../secrets/firebase_admin_sdk.js'

function log(...args) {
  // avoid bundler coloring; keep plain text
  console.log('[admin-sdk-smoke]', ...args)
}

async function main() {
  log('App name:', app.name)

  // Auth check (safe, read-only). If Auth is not enabled, we continue with Firestore check.
  try {
    const res = await auth.listUsers(1)
    log(`Auth listUsers OK, count=${res.users?.length ?? 0}`)
  } catch (e) {
    log('Auth check skipped/failed (non-fatal):', e?.message || e)
  }

  // Firestore check: read a non-existent doc (no write)
  try {
    const snap = await db.collection('integration_smoke').doc('noop').get()
    log('Firestore get OK, exists =', snap.exists)
  } catch (e) {
    log('Firestore read failed:', e?.message || e)
    process.exitCode = 2
    return
  }

  log('Done')
}

main().catch((e) => {
  log('Unexpected error:', e?.message || e)
  process.exitCode = 1
})

