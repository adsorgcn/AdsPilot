#!/usr/bin/env node
// Generate a Firebase ID token using Admin SDK custom token + REST exchange.
// Usage:
//   FIREBASE_CREDENTIALS_FILE=secrets/firebase-adminsdk.json \
//   FIREBASE_API_KEY=<web_api_key> \
//   node scripts/tests/mint-idtoken.mjs <uid> <email>

import app, { auth } from '../../secrets/firebase_admin_sdk.js'

function log(...args){ console.log('[mint-idtoken]', ...args) }

const key = process.env.FIREBASE_API_KEY
if(!key){
  console.error('FIREBASE_API_KEY is required');
  process.exit(2)
}

const uid = process.argv[2] || 'test-user'
const email = process.argv[3] || `${uid}@example.com`

async function ensureUser(uid, email){
  try { return await auth.getUser(uid) } catch {
    try { return await auth.createUser({ uid, email, emailVerified: true, disabled: false }) } catch (e){
      try { const u = await auth.getUserByEmail(email); return u } catch {}
      throw e
    }
  }
}

async function exchangeCustomToken(customToken){
  const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(key)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true })
  })
  if(!resp.ok){
    const txt = await resp.text();
    throw new Error(`exchange failed: ${resp.status} ${txt}`)
  }
  return resp.json()
}

async function main(){
  log('project:', app.options?.projectId)
  await ensureUser(uid, email)
  const custom = await auth.createCustomToken(uid, { role: 'ADMIN', email })
  const data = await exchangeCustomToken(custom)
  const idToken = data.idToken
  if(!idToken) throw new Error('no idToken in response')
  console.log(idToken)
}

main().catch(e=>{ console.error(e); process.exit(1) })

