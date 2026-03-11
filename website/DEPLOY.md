# Deploying mmt.dev

## Overview

| Service | Purpose | Cost |
|---|---|---|
| Cloudflare DNS | DNS for mmt.dev | Free |
| Cloudflare Pages | Host website (mmt.dev) | Free |
| Cloudflare Email Routing | Email forwarding (@mmt.dev) | Free |
| Cloudflare Workers | Reflect API (reflect.mmt.dev) | Free |
| Cloudflare Workers | Test Server (test.mmt.dev) | Free |

---

## Step 1: Move DNS to Cloudflare

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Add a site** → enter `mmt.dev`
2. Choose the **Free** plan
3. Cloudflare will give you two nameservers, e.g.:
   - `anna.ns.cloudflare.com`
   - `bob.ns.cloudflare.com`
4. Log in to **GoDaddy** → Domain Settings for `mmt.dev` → **Nameservers** → Change to **Custom** → paste the two Cloudflare nameservers
5. Wait for propagation (usually 5–30 minutes, can take up to 24 hours)
6. Cloudflare dashboard will show ✅ when active

---

## Step 2: Deploy Website to Cloudflare Pages

### Option A: Connect GitHub (recommended — auto-deploys on push)

1. In Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. Select the `mmt` repository, branch `main` (or `dev`)
3. Build settings:
   - **Framework preset**: None
   - **Root directory**: `website`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. Click **Save and Deploy**
5. After first deploy → **Custom domains** → add `mmt.dev` and `www.mmt.dev`

### Option B: Direct Upload (manual)

```bash
cd website
npm run build
npx wrangler pages deploy dist --project-name=mmt-website
```

Then add custom domain in the dashboard.

---

## Step 3: Set Up Email Routing

1. Cloudflare dashboard → **Email** → **Email Routing** → **Get started**
2. Add destination addresses (your personal Gmail, etc.) and verify them
3. Create routing rules:

| From | Forward to |
|---|---|
| `hello@mmt.dev` | your-email@gmail.com |
| `support@mmt.dev` | your-email@gmail.com |
| Catch-all (`*@mmt.dev`) | your-email@gmail.com |

4. Cloudflare will automatically add the required MX and TXT DNS records

### Send emails AS your @mmt.dev address from Gmail

1. In Gmail → Settings → **Accounts and Import** → **Send mail as** → **Add another email address**
2. Enter: `hello@mmt.dev`
3. SMTP server: `smtp.gmail.com`, port 587
4. Username: your Gmail address
5. Password: generate an **App Password** at https://myaccount.google.com/apppasswords
6. Now you can compose emails in Gmail and choose `hello@mmt.dev` as the "From" address

---

## Step 4: Deploy Reflect Worker

### First-time setup

```bash
# Install wrangler if needed
npm install -g wrangler

# Log in to Cloudflare
wrangler login

# Deploy the reflect worker
cd website
npx wrangler deploy
```

### Add custom domain

1. Cloudflare dashboard → **Workers & Pages** → `mmt-reflect` worker → **Settings** → **Triggers**
2. Add **Custom Domain**: `reflect.mmt.dev`
3. Cloudflare auto-creates the DNS record

### Test it

```bash
# GET request
curl https://reflect.mmt.dev/hello?name=world

# POST with JSON
curl -X POST https://reflect.mmt.dev/api/test \
  -H "Content-Type: application/json" \
  -d '{"message": "hello from multimeter"}'
```

---

## Step 5: Deploy Test Server Worker

### First-time setup

```bash
cd website
npx wrangler deploy -c wrangler-testserver.toml
```

### Add custom domain

1. Cloudflare dashboard → **Workers & Pages** → `mmt-testserver` worker → **Settings** → **Triggers**
2. Add **Custom Domain**: `test.mmt.dev`
3. Cloudflare auto-creates the DNS record

### Test it

```bash
# Echo
curl https://test.mmt.dev/echo

# Status code
curl https://test.mmt.dev/status/201

# Delay
curl https://test.mmt.dev/delay/2000

# JSON sample
curl https://test.mmt.dev/json

# Basic auth
curl -u user:pass https://test.mmt.dev/auth/basic

# All endpoints
curl https://test.mmt.dev/
```

### Available endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | Help page listing all endpoints |
| `/echo` | ANY | Echo back request details |
| `/anything` | ANY | Alias for `/echo` |
| `/status/:code` | GET | Respond with given HTTP status (100-599) |
| `/delay/:ms` | ANY | Delay response up to 10000ms |
| `/headers` | GET | Return request headers as JSON |
| `/ip` | GET | Return client IP address |
| `/method/:method` | ANY | 200 if method matches, 405 otherwise |
| `/redirect/:n` | GET | Redirect n times (max 20), then 200 |
| `/json` | GET | Sample JSON response |
| `/xml` | GET | Sample XML response |
| `/html` | GET | Sample HTML response |
| `/bytes/:n` | GET | Random bytes (max 100KB) |
| `/auth/basic` | GET | Basic auth check (user: `user`, pass: `pass`) |
| `/auth/bearer` | GET | Bearer token check (token: `testtoken`) |
| `/cookies` | GET | Return cookies sent |
| `/cookies/set?k=v` | GET | Set cookies via query params |
| `/cache/:seconds` | GET | Set Cache-Control max-age (max 86400) |

---

## DNS Records Summary

After setup, your Cloudflare DNS should look like this (most are auto-created):

| Type | Name | Content | Proxy |
|---|---|---|---|
| CNAME | `mmt.dev` | `<pages-project>.pages.dev` | ✅ Proxied |
| CNAME | `www` | `<pages-project>.pages.dev` | ✅ Proxied |
| CNAME | `reflect` | (auto by Worker custom domain) | ✅ Proxied |
| CNAME | `test` | (auto by Worker custom domain) | ✅ Proxied |
| MX | `mmt.dev` | (auto by Email Routing) | — |
| TXT | `mmt.dev` | (auto by Email Routing — SPF) | — |

---

## Updating the Website

With GitHub integration (Option A), just push to your branch:

```bash
git push origin main
```

Cloudflare Pages will auto-build and deploy in ~30 seconds.

---

## Cost Summary

| Item | Cost |
|---|---|
| Cloudflare DNS + Pages + Workers + Email | **$0/month** |
| GoDaddy domain renewal (mmt.dev) | ~$15/year |
| **Total** | **~$1.25/month** |
