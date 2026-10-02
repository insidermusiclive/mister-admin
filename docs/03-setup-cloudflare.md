# 3. Installing Mister Admin in your own Cloudflare account

Every person installs their **own** Mister Admin. It lives in their Cloudflare account, costs
nothing on the free plan, and works from any computer or phone once installed.

You need a Cloudflare account: https://dash.cloudflare.com/sign-up (free, takes a minute).

Pick one of the three ways below.

---

## Way 1 – The "Deploy to Cloudflare" button (easiest, needs a GitHub account)

1. Open https://github.com/insidermusiclive/mister-admin and click the **Deploy to Cloudflare** button.
2. Log into Cloudflare. Connect your GitHub account when asked (Cloudflare makes a private copy of
   the code in your GitHub, so you receive updates later).
3. Cloudflare shows the resources it will create: a D1 database and an R2 bucket. Click **Create and deploy**.
4. After about two minutes you get an address like `https://mister-admin.YOURNAME.workers.dev`.
5. Open it, create your administrator account on the Welcome screen. Done.

If Cloudflare says R2 must be enabled first: in the dashboard click **R2** → enable it
(free up to 10 GB; a card may be requested but nothing is charged within the free limits), then retry.

## Way 2 – Zip file with a double-click installer (no GitHub needed)

1. Install Node.js from https://nodejs.org (choose LTS). Next, next, finish.
2. Download the zip from https://github.com/insidermusiclive/mister-admin/releases and unzip it.
3. Open the `install` folder.
   - **Mac:** double-click `install-mac.command`.
     If macOS refuses, right-click it → **Open** → **Open**.
   - **Windows:** double-click `install-windows.bat`.
4. A browser window opens for the Cloudflare login. Click **Allow**.
5. The installer creates the database and photo storage, deploys, and prints your admin address.
   It opens it for you. Create your administrator account on the Welcome screen. Done.

The installer is safe to run again (for updates or if something was interrupted).
What it does is written in plain language at the top of `install/install.mjs`.

## Way 3 – Command line (developers)

```bash
git clone https://github.com/insidermusiclive/mister-admin.git
cd mister-admin
npm install
npx wrangler login
node install/install.mjs
```

Or by hand: `wrangler d1 create mister-admin` → put the id in `wrangler.toml` →
`wrangler r2 bucket create mister-admin-media` → `wrangler deploy`.
Tables are created automatically on the first request, so no migration command is needed.

---

## After installing

1. Open your admin address and create the administrator account (first screen).
2. **+ New site** → name, slug, website address.
3. Site → **Settings → Schema**: describe the sections of your website ([04-schema-format.md](04-schema-format.md)).
4. Fill in content, upload photos, press **Publish**.
5. Add one script line to your website ([05-connecting-a-site.md](05-connecting-a-site.md)).

## Does it work from my other computer / phone?

Yes. Mister Admin runs in Cloudflare. Once installed from any computer, the address works from
every device with your email and password. The files on your computer are only needed to
install updates.

## Optional extras

- **Nicer address:** dashboard → Workers & Pages → mister-admin → Settings → Domains & Routes →
  add `admin.yourdomain.com`.
- **Photos from your own domain:** dashboard → R2 → mister-admin-media → Settings → Custom domains,
  then set `MEDIA_BASE_URL` in `wrangler.toml` and deploy again.

## Updating later

- Button users: Cloudflare redeploys when the copy in your GitHub gets new commits (pull the
  upstream changes into it, or press Retry deployment).
- Zip users: unzip the new version over the old folder and run the installer again.
- Developers: `git pull && npx wrangler deploy`.

Your data lives in Cloudflare, so updates never touch content or photos.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:8788. Data is stored in `.wrangler/state/` on your computer.
