# ESP Display Portal

A web portal that drives ESP32 "Cheap Yellow Display" boards (ST7789, 320×240 TFT) without reflashing them. You build a screen as a **Service**: a little server-side JavaScript that fetches data, plus a list of TFT_eSPI draw commands that use it. Each **Device** has a key and subscribes to one Service. It polls the portal, gets back a JSON list of draw ops and draws them. To change what a board shows, edit the Service or switch the device to another one; the firmware stays the same.

## How it works

```
 Browser ──► Portal (Next.js on Vercel) ──► Supabase (Postgres + Auth, RLS)
                       ▲                      services, devices, secrets, polls
                       │
   GET /api/device/frame              1. look up the device by its hashed key
   Authorization: Bearer esk_...      2. run the Service's Data code in a QuickJS sandbox
                       │              3. fill {variables} into the Draw rows
                       │              4. reply with JSON draw ops (or 304 if unchanged)
                       ▼
 ESP32 + TFT ◄── {"v":1,"id":"…","next":30,"ops":[["fillScreen","#000000"],…]}
   plays each op with TFT_eSPI, then polls again after "next" seconds
```

## Features

- **Services** with a **Data** section (sandboxed JavaScript run on the server) and a **Draw** section (TFT_eSPI commands edited as cards or as JSON, with a live preview you can click and drag to move and resize shapes).
- **Devices** owned by users, each with its own key and poll interval. A device can switch Services from the portal, no reflash needed.
- **Firmware generated per device**: view the Arduino sketch files or download them as a zip, optionally with your WiFi details filled in (done in the browser).
- **Templates gallery** of ready-made Services.
- **Sharing** a Service with other users by email.
- **Activity stats** for each Service, and a **Devices** page with every device's status.
- **Overview** with usage and an estimate against the Vercel Hobby invocation budget.
- **Secrets** (API keys used as `secrets.NAME`), **Settings** (account and timezone), and in-app **Docs**.
- **AI helper** that builds a prompt to have ChatGPT or Claude write a Service for you.

## Getting started

### Prerequisites

- Node.js 20.9 or later, and npm
- A [Supabase](https://supabase.com) project (the free tier is fine)
- For devices: the Arduino IDE and an ESP32 Cheap Yellow Display (see [Setting up a device](#setting-up-a-device))

### 1. Install

```bash
git clone <this repo>
cd esp-display-online-portal
npm install
```

### 2. Set up the database

In the Supabase dashboard, open **SQL Editor → New query**, paste each file from `supabase/migrations/` and click **Run**. Run them once each, **in order**:

| File | What it does |
| --- | --- |
| `001_initial.sql` | Services, devices, row-level security |
| `002_sharing_and_polls.sql` | Sharing Services, the device poll log |
| `003_secrets_and_settings.sql` | Per-user secrets and settings |
| `004_fix_service_insert.sql` | Fixes an RLS error when creating a Service |
| `005_poll_frequency.sql` | Per-Service poll interval (superseded by 006, harmless to run) |
| `006_poll_frequency_per_device.sql` | Moves the poll interval to each device |
| `007_devices_owned_by_users.sql` | Devices belong to users and can switch Services |
| `008_restrict_update_columns.sql` | Limits which columns signed-in users can update |

There is no migration runner; new migrations are applied the same way.

### 3. Create users

Sign-in is email and password, and there is no sign-up page. In Supabase go to **Authentication → Sign In / Providers** and turn off **Allow new users to sign up**, then add each user under **Authentication → Users → Add user**.

### 4. Environment variables

```bash
cp .env.example .env.local
```

Fill in the three values from the Supabase dashboard (**Project Settings → API Keys**, and the project URL from **Project Settings → Data API** or the Connect dialog):

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL, `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_...`) |
| `SUPABASE_SECRET_KEY` | Secret key (`sb_secret_...`). Server only: the device endpoint uses it. Never expose it to the browser. |

### 5. Run

```bash
npm run dev
```

Open <http://localhost:3000> and sign in with a user you created.

## Deploying to Vercel

1. Import the repo into Vercel (it is detected as Next.js; no extra settings).
2. Add the same three environment variables under **Project Settings → Environment Variables**.
3. Deploy, and download device firmware from the deployed portal: the generated `config.h` points at the URL you downloaded it from (`https://<your-app>/api/device/frame`).

**Hobby plan budget:** every device poll is one function invocation, and Hobby includes about **1,000,000 invocations a month**. A device polling every 30 s uses about 86,400 a month, so the portal supports about **11 always-on devices** at 30 s. Poll less often to run more. The Overview page shows your current usage against this limit.

## Setting up a device

The portal generates the firmware for each device: open the device on the **Devices** page and choose its setup files. The sketch is the same for every device; only `config.h` differs.

1. Install the [Arduino IDE](https://www.arduino.cc/en/software) (2.x).
2. **Tools → Board → Boards Manager**: install **esp32 by Espressif Systems**.
3. **Tools → Manage Libraries**: install **TFT_eSPI** (Bodmer) and **ArduinoJson** (Benoit Blanchon) **7.x**.
4. Copy `User_Setup.h` from the downloaded `EspDisplay` folder over `Arduino/libraries/TFT_eSPI/User_Setup.h` (on Windows: `Documents\Arduino\libraries\TFT_eSPI\`). TFT_eSPI only reads its own folder, and updating the library overwrites the file, so copy it again after an update. The sketch fails to build with a clear error if you skip this.
5. Open `EspDisplay/EspDisplay.ino` and fill in `config.h`: WiFi name and password (2.4 GHz only) and the device key. The key is filled in when you download the files right after creating the device (it is only shown once); otherwise paste it over `PASTE_DEVICE_KEY_HERE`. If you added WiFi details when downloading, those are filled in too.
6. Select **Tools → Board → esp32 → ESP32 Dev Module** and the port, then **Upload**. If the upload doesn't start, hold the BOOT button while it connects.

Open **Tools → Serial Monitor** at 115200 baud to see what the device is doing.

**Troubleshooting**

- **Colours look like a photo negative:** in `setup()`, change `tft.invertDisplay(false)` to `true`.
- **Red and blue are swapped:** in `User_Setup.h`, change `TFT_RGB_ORDER` to `TFT_RGB`.
- **TFT_eSPI doesn't compile:** it can break on some ESP32 core versions. Install esp32 core **2.0.17** in the Boards Manager.
- **"Device key rejected":** the key in `config.h` is wrong, or was regenerated or deleted in the portal.
- **Small red dot in the top-right corner:** the last poll failed. The last screen stays up and the device keeps retrying.

## Writing a Service

**Data** is an ES module run on the server in a QuickJS sandbox (`src/lib/data/run.ts`). Every `export const` that is a string, number or boolean becomes a variable for the Draw section. It can use:

- `await get(url, { cache: seconds })`: HTTP GET, returns parsed JSON (or text). Cached 30 s by default.
- `now(format)`: the time in your timezone, with tokens `HH mm ss DD MM YYYY ddd`.
- `secrets.NAME`: your saved Secrets. Their values are redacted from errors, logs and output.

```js
const prices = await get("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd", { cache: 60 });
export const btc = "$" + Math.round(prices.bitcoin.usd).toLocaleString("en-US");
export const time = now("HH:mm");
```

**Draw** is a list of TFT_eSPI commands, applied in order on a 320×240 screen. Any value can use `{variable}`. In the JSON view each row is `[op, ...args]` in TFT_eSPI argument order; `text` takes text, x, y, font, size, anchor, colour and an optional background:

```json
[
  ["fillScreen", "#000000"],
  ["text", "Bitcoin", 160, 60, 4, 1, "TC", "#F7931A"],
  ["text", "{btc}", 160, 120, 4, 2, "MC", "#FFFFFF"],
  ["text", "Updated {time}", 160, 220, 2, 1, "BC", "#808080"]
]
```

Click **Refresh data** to check the preview, then **Save & deploy**. The in-app **Docs** page covers every op, the sandbox limits and sharing. The **AI helper** button in the editor copies a prompt (or a `SKILL.md`) that teaches ChatGPT or Claude to write the Data and Draw sections for you.

## Templates

Each template is one file in `src/lib/templates/catalog/templates/<id>.ts` whose default export is a `Template` (see `catalog/types.ts`): name, description, category, the Data code, Draw rows and sample variables for the gallery preview. `scripts/gen-templates.mjs` finds every file in that folder and writes `catalog/generated.ts` (gitignored), so adding a template means adding a file. To add one, copy an existing template, give it a new kebab-case id that matches the file name, and fill `sampleVars` with real output of its Data code.

## Project structure

```
src/
  proxy.ts                 session refresh (Next 16's middleware); skips /api/device
  app/
    api/device/frame/      the endpoint devices poll
    services/ devices/ templates/ shared/ overview/ secrets/ settings/ docs/ login/
  components/              UI by feature (draw editor, devices, stats, ...)
  lib/
    data/run.ts            QuickJS sandbox for Data code
    draw/                  op catalogue, wire format, preview renderer
    firmware/              generated Arduino sketch and zip
    templates/catalog/     template gallery (one file per template)
    supabase/              browser, server and admin clients
supabase/migrations/       SQL, run by hand in order
scripts/gen-templates.mjs  template index generator
```

This is Next.js 16, which differs from older versions in places (for example, middleware is `src/proxy.ts`). See `AGENTS.md`.

## Notes

- The repo has no tests and no linting, by choice.
- Database migrations are run by hand in the Supabase SQL Editor; there is no migration tool.
- Device keys (`esk_...`) are shown once and stored only as SHA-256 hashes.
- A Service's Data code runs with its owner's secrets, even on a shared member's device. Secret values are redacted from errors, console output and exported variables, so they never reach the browser or the device.
- The device talks HTTPS but doesn't verify the server certificate (`setInsecure()`), to avoid keeping a root certificate up to date on the board.
