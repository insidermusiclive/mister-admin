# 3. Setting up Mister Admin on Cloudflare (step by step)

Time: about 15 minutes. Cost: €0 on the free plan.
You need: a Cloudflare account (free), Node.js 18+ on your computer, and this repository.

Anyone can do this in their own Cloudflare account to get their own independent Mister Admin.

## Step 1 – Get the code and install wrangler

```bash
git clone https://github.com/insidermusiclive/mister-admin.git
cd mister-admin
npm install
npx wrangler login
```

`wrangler login` opens a browser window; approve it.

## Step 2 – Create the database (D1)

```bash
npx wrangler d1 create mister-admin
```

The output shows a `database_id`. Open `wrangler.toml` and replace
`REPLACE_WITH_YOUR_D1_DATABASE_ID` with it.

Then create the tables:

```bash
npm run db:migrate:remote
```

## Step 3 – Create the photo storage (R2)

```bash
npx wrangler r2 bucket create mister-admin-media
```

(R2 needs to be enabled once in the Cloudflare dashboard → R2. The free tier needs no card
for the first 10 GB, but Cloudflare may ask you to add a payment method to enable R2.
You will not be charged while under the free limits.)

## Step 4 – Create the Pages project and deploy

```bash
npx wrangler pages project create mister-admin --production-branch main
npm run deploy
```

The output ends with a URL like `https://mister-admin-xyz.pages.dev`. That is your admin.

## Step 5 – Connect the bindings (one time)

Deploying from the command line reads `wrangler.toml`, so the D1 and R2 bindings are applied
automatically. Verify in the Cloudflare dashboard → Workers & Pages → mister-admin →
Settings → Bindings: you should see `DB` (D1) and `MEDIA` (R2). If they are missing, add them
there with exactly those names.

## Step 6 – First login

Open your admin URL. Because the database is empty you get the **Welcome** screen.
Create the first administrator (your own email and a password of 10+ characters).

Then:
1. **+ New site** → name, slug, website address. It starts with a starter schema.
2. Open the site → **Settings → Schema** to adapt the sections to your website
   (see [04-schema-format.md](04-schema-format.md)).
3. Fill in content, upload photos, press **Publish**.
4. Put the script in your website: [05-connecting-a-site.md](05-connecting-a-site.md).

## Optional: a nicer address

Dashboard → Workers & Pages → mister-admin → Custom domains → add `admin.yourdomain.com`.

## Optional: serve photos from your own domain

Dashboard → R2 → mister-admin-media → Settings → Custom domains → add `media.yourdomain.com`.
Then set `MEDIA_BASE_URL = "https://media.yourdomain.com"` in `wrangler.toml` and redeploy.
Not required; by default photos are served through the admin at `/media/...`.

## Updating later

```bash
git pull
npm run db:migrate:remote   # only if the migrations/ folder gained new files
npm run deploy
```

## Local development (no Cloudflare account needed)

```bash
npm install
npm run db:migrate:local
npm run dev
```

Open http://localhost:8788. Data is stored in `.wrangler/state/` on your computer.

## Giving the app to someone else

Two options:

- **Share your instance.** Create a user for them (Users → New user), then give them a role on
  their site (site → People). They log in at your admin URL. Nothing to install.
- **Their own instance.** They follow this document in their own Cloudflare account.
  Fully independent, their own data, still free.
