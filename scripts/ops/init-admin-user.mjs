#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import url from 'url'
import process from 'process'
import admin from 'firebase-admin'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

async function main() {
  const email = process.env.ADMIN_EMAIL || ''
  const passwordRaw = process.env.ADMIN_PASSWORD || ''
  if (!email || !passwordRaw) {
    console.error('[init-admin-user] ADMIN_EMAIL/ADMIN_PASSWORD required')
    process.exit(1)
  }
  // Use password exactly as provided (no decoding)
  const password = passwordRaw
  const credFile = process.env.FIREBASE_CREDENTIALS_FILE || path.join(__dirname, '../../secrets/firebase-adminsdk.json')
  if (!fs.existsSync(credFile)) {
    console.error('[init-admin-user] credentials file not found:', credFile)
    process.exit(2)
  }
  const sa = JSON.parse(fs.readFileSync(credFile, 'utf8'))
  if (admin.apps.length === 0) {
    admin.initializeApp({ credential: admin.credential.cert(sa) })
  }
  const auth = admin.auth()
  let user
  try {
    user = await auth.getUserByEmail(email)
    console.log('[init-admin-user] user exists:', user.uid)
    // Ensure password (best-effort)
    await auth.updateUser(user.uid, { password })
  } catch {
    user = await auth.createUser({ email, password, emailVerified: true, disabled: false })
    console.log('[init-admin-user] created user:', user.uid)
  }
  // Set custom claims role=ADMIN
  await auth.setCustomUserClaims(user.uid, { role: 'ADMIN' })
  console.log('[init-admin-user] set custom claims role=ADMIN')
}

main().catch((e)=>{ console.error(e); process.exit(1) })
