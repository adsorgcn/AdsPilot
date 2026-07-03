#!/usr/bin/env node
// Generate a Firebase ID token via Custom Token exchange using firebase-admin service account.
// Env:
//  FIREBASE_ADMIN_JSON_PATH (default: secrets/firebase-adminsdk.json)
//  FIREBASE_API_KEY (required) - Web API Key
//  UID (default: test-user)

import fs from 'fs';
import crypto from 'crypto';

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}

function signRS256(privateKeyPem, data) {
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(data);
  signer.end();
  return signer.sign(privateKeyPem);
}

async function main(){
  const adminPath = process.env.FIREBASE_ADMIN_JSON_PATH || 'secrets/firebase-adminsdk.json';
  const apiKey = process.env.FIREBASE_API_KEY;
  const uid = process.env.UID || 'test-user';
  if (!apiKey) {
    console.error('FIREBASE_API_KEY required');
    process.exit(2);
  }
  const admin = JSON.parse(fs.readFileSync(adminPath, 'utf8'));
  const now = Math.floor(Date.now()/1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: admin.client_email,
    sub: admin.client_email,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    uid,
    iat: now,
    exp: now + 60*5
  };
  const tokenUnsigned = b64url(JSON.stringify(header)) + '.' + b64url(JSON.stringify(payload));
  const signature = signRS256(admin.private_key, tokenUnsigned);
  const customToken = tokenUnsigned + '.' + b64url(signature);
  // Exchange for ID token
  const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: customToken, returnSecureToken: true })
  });
  const j = await resp.json();
  if (!resp.ok) { console.error('Exchange failed:', j); process.exit(3); }
  console.log(j.idToken);
}

main().catch(e=>{ console.error(e); process.exit(1); });

