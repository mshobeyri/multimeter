# Deploying mmt.dev

## Overview

| Service | Purpose | Cost |
|---|---|---|
| Cloudflare DNS | DNS for mmt.dev | Free |
| Cloudflare Pages | Host website (mmt.dev) | Free |
| Cloudflare Email Routing | Email forwarding (@mmt.dev) | Free |
| Cloudflare Workers | Reflect API (reflect.mmt.dev) | Free |

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

## DNS Records Summary

After setup, your Cloudflare DNS should look like this (most are auto-created):

| Type | Name | Content | Proxy |
|---|---|---|---|
| CNAME | `mmt.dev` | `<pages-project>.pages.dev` | ✅ Proxied |
| CNAME | `www` | `<pages-project>.pages.dev` | ✅ Proxied |
| CNAME | `reflect` | (auto by Worker custom domain) | ✅ Proxied |
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
