# BALAJI AUTOMOBILES — Sales Enquiry & Customer CRM

Hero MotoCorp showroom CRM for enquiries, follow-ups, staff assignment, reports and audit history.

## What you get

- **Owner** and **Staff** roles
- Secure sign-in (Google, X, or email/password)
- Server-side permission checks on every query (staff cannot see another salesperson’s customers by changing a URL or API call)
- Enquiry + follow-up workflow
- Owner dashboards, reports, CSV export, staff management, audit log
- Mobile-first layout, installable as a PWA

This app does **not** use Supabase. It uses Postgres plus Better Auth. The browser never receives a database key. That is the security boundary.

## How to start (this preview)

1. Sign in with **Google**. The first Google login becomes **Owner**. Sample (demo) enquiries load automatically.
2. Open **Staff** and create salespeople. Copy the one-time password and share it with them.
3. Staff sign in with that email and password. They only see enquiries they created or were assigned.

Demo rows are labelled **Demo**. Do not treat them as real customers.

## Run on your computer

You need Node.js 22+.

```bash
unzip balaji-automobiles-crm.zip
cd balaji-automobiles-crm
npm install
npm run dev
```

Open the URL shown in the terminal.

- Without `DATABASE_URL`, it uses a local Postgres (PGLite). Data resets when the process stops.
- For a real shared database, set `DATABASE_URL` to a Postgres connection string (Neon works), then run `npm run build`.

### Environment (production)

Set these when you host the app:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (required for a shared cloud database) |
| `VITE_AUTH_ENABLED` | `true` |
| `BETTER_AUTH_URL` | Public HTTPS URL of the app |
| `GROK_AUTH_ISSUER` / `GROK_AUTH_CLIENT_ID` / `GROK_AUTH_CLIENT_SECRET` | Injected automatically when you publish from Grok |

Email/password staff logins work without extra setup. Google/X sign-in needs the published Grok auth client.

## Daily workflow

Customer walks in → staff creates enquiry → owner sees it on the dashboard → staff logs follow-ups → status moves to Booked / Sold → owner reads it in reports → every important action is written to audit history.

## Roles

**Owner** — all enquiries, dashboards, reports, exports, audit, staff accounts, settings.

**Staff** — add enquiries, work their own assigned/created records, log follow-ups, mark Sold/Lost on those records. They cannot open reports, audit, staff admin, or another person’s book.

Deactivating a staff account immediately invalidates their sessions.

## Data

Customer records live in Postgres. Access is checked on the server using the signed-in user id from the session — not from anything the browser claims.

SQL schema:

- `migrations/0001_auth.sql` — users, sessions, accounts
- `migrations/0002_crm.sql` — profiles, enquiries, follow-ups, audit, settings

## PWA

Use the browser install / Add to Home Screen action. Offline use does not unlock customer data; the app still needs a signed-in session and the server to read records.
