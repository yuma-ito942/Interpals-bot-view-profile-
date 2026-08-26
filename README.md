# InterPals Profile Viewer

Chrome extension that filters InterPals pen pals by **age** and **country**, then **views matching profiles automatically**. It does **not** send messages.

## Features

- **Age filter** — set min/max age range (18+)
- **Country filter** — pick specific countries (or leave empty for all)
- **Page filter** — hide profiles that do not match while browsing InterPals
- **Auto-view profiles** — search, then open each matching profile in the InterPals tab
- **Limits** — delay between profiles, max profiles per run, skip already-viewed users

## Install (Chrome / Edge / Brave)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder (`second`)
5. Sign in to [interpals.net](https://www.interpals.net) in the same browser

## How to use

1. Click the extension icon in the toolbar
2. Set age range, gender, and countries
3. Click **Start**
4. Keep the InterPals tab open — the bot views matching profiles one by one
5. Watch status in the popup (viewed / skipped / errors)
6. Click **Stop** anytime

## Important notes

- You must be **logged in** to InterPals before starting the bot
- The bot only views profiles for users **18 or older**
- This extension never sends messages
- This extension uses your existing browser session; it does not store your password

## Troubleshooting

| Problem | Fix |
|--------|-----|
| "Not logged in", "Could not reach InterPals", or tab request errors | Reload the extension, refresh the InterPals tab, stay signed in, keep that tab open, then press Start |
| No search results | Widen age range or remove country filter |
| Bot stops early | Reached max profiles limit in settings |
