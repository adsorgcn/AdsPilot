# Local authorization

AdsPilot authorizes with your own Google Ads account using the RFC 8252 loopback flow with
RFC 7636 PKCE. Authorization happens in your own browser, and the resulting refresh token is
stored only on your machine. It is never sent to any server.

*中文: [local-auth.md](local-auth.md)*

## Prerequisites

1. **A Desktop-type OAuth client.** Create a "Desktop app" OAuth client in your Google Cloud
   project. Desktop clients need no pre-registered redirect URI and accept any loopback port
   with PKCE. Do not use a "Web application" client; it causes `redirect_uri_mismatch`.

2. **Environment variables** (in `.env`):

   | Variable | Description |
   |---|---|
   | `GOOGLE_ADS_OAUTH_CLIENT_ID` | Client ID of the Desktop client |
   | `GOOGLE_ADS_OAUTH_CLIENT_SECRET` | Client secret of the Desktop client |
   | `GOOGLE_ADS_DEVELOPER_TOKEN` | Your Google Ads developer token |
   | `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | Your MCC / login customer ID |
   | `ADSPILOT_OAUTH_REDIRECT_URI` | Loopback callback, default `http://127.0.0.1:8080/api/v1/adscenter/oauth/callback`; the port must match where adscenter listens |
   | `ADSPILOT_CREDENTIALS_PATH` | Optional credential file path, default `~/.adspilot/credentials.json` |

3. **Set the OAuth consent screen to "In production".** If it stays in "Testing", the refresh
   token expires after 7 days.

## Authorization flow

1. Start adscenter locally (in the local model it binds to a loopback address).

2. Request the authorization URL:

   ```bash
   curl http://127.0.0.1:8080/api/v1/adscenter/oauth/url
   ```

   Returns JSON:

   ```json
   {"url": "https://accounts.google.com/o/oauth2/v2/auth?...", "state": "..."}
   ```

3. Open the returned `url` in a browser, sign in with the Google account that manages your
   Google Ads, then consent.

4. Google redirects to `/api/v1/adscenter/oauth/callback`. adscenter exchanges the code for
   tokens, stores the refresh token on your machine, and shows a success page.

5. Confirm the credential was written:

   ```bash
   ls -l ~/.adspilot/credentials.json
   ```

   The mode should be `-rw-------` (0600). It holds the refresh token and metadata, local to
   your machine only.

## Revoke

```bash
curl -X POST http://127.0.0.1:8080/api/v1/adscenter/oauth/revoke
```

This revokes the token at Google and deletes the local credential file.

## Credential storage and security

- The refresh token is stored at `~/.adspilot/credentials.json` (or the path in
  `ADSPILOT_CREDENTIALS_PATH`), mode 0600.
- Zero server retention: the token is never uploaded or stored on any server.
- The three OAuth endpoints (url / callback / revoke) require no login token in the local
  single-user model. This relies on adscenter being bound to a loopback address, reachable
  only by local processes.

## Troubleshooting

- **`redirect_uri_mismatch` in the browser.** Your OAuth client is a Web type. Use a Desktop
  type instead.
- **No refresh token returned.** This Google account already authorized the app. Revoke the
  app's access at https://myaccount.google.com/permissions and run the flow again.
- **Refresh token expires after 7 days.** The OAuth consent screen is still in "Testing"; set
  it to "In production".
