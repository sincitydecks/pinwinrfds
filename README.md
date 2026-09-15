# RFDS PIN TO WIN — Final Deployment

This is the final self-contained PIN TO WIN project with:

- the Flight Crew Challenge game in `index.html`
- EOI/name/email capture to Supabase via `api/eoi.js`
- staff admin dashboard at `/admin.html`
- CSV export of captured names/emails
- iPad-local EOI backup if conference Wi-Fi temporarily fails
- leaderboard backup export from the existing `rfds_demo_board` localStorage key

## Critical leaderboard rule

The game deliberately continues to use the existing browser storage key:

`rfds_demo_board`

Do not rename it, clear it, or run `localStorage.clear()` on the conference iPad. Deploying a new version at the same origin does not by itself erase that local leaderboard.

## Supabase

Run `supabase/pin_to_win_eois.sql` in the Supabase SQL Editor.

Project URL:

`https://pzpymyhudenvdfvqkebg.supabase.co`

## Vercel Environment Variables

Set these variables in the Vercel project:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `PIN_TO_WIN_ADMIN_PASSWORD` = `1928`
- `PIN_TO_WIN_ADMIN_SESSION_SECRET` = a long random secret

Never put the Supabase secret key in `index.html` or `admin.html`.

## Vercel settings

This is a plain static HTML site with Vercel serverless functions in `/api`.

- Framework Preset: Other
- Root Directory: repository root (`.`)
- Build Command: empty
- Output Directory: empty

Vercel should automatically deploy `api/eoi.js` as `/api/eoi` and `api/eoi-admin.js` as `/api/eoi-admin`.

## URLs

Game: `/`

Admin: `/admin.html`

Admin password: `1928`

## How EOI capture works

When the player starts a game, the entered name/email are immediately copied to a new localStorage safety-backup key:

`rfds_pin_to_win_eois`

The browser then sends the same record to `/api/eoi`, which stores it in Supabase. The admin page combines server records with any local iPad backup records and removes duplicates using the submission ID.
