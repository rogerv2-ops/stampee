<div align="center">
<img width="1200" alt="Stampee preview" src="public/image_1.jpg" />
</div>

# Stampee

Stampee is a digital loyalty card and stamp card app. An owner can manage multiple independent business workspaces from a central hub; each workspace has its own slug, campaigns, customers, cards, staff, and settings. You can self-host the frontend and connect it to your own Supabase project.

After signing in, owners can open `/businesses` to create or select a workspace. Public customer routes remain scoped to the selected business's slug. This is not a marketplace: each business is an independent Stampee workspace.

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Radix UI primitives
- React Router
- Supabase Auth, Postgres, Storage, and RPC functions
- Vercel deployment config via [`vercel.json`](vercel.json)

This version does not load Vercel Analytics or another external web-tracking provider. Necessary browser storage supports the Supabase session, language selection, and interface preferences; it is not optional analytics or marketing tracking. The in-product `AnalyticsPage` remains available for operational business metrics such as customers, cards, stamps, and redemptions.

## Prerequisites

- Node.js
- A Supabase project

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the environment template:
   ```bash
   cp .env.example .env.local
   ```

3. Configure `.env.local`:

   Required:
   - `VITE_APP_URL`: your app URL, for example `http://localhost:5173`
   - `VITE_SUPABASE_URL`: your [Supabase](https://supabase.com) project URL
   - `VITE_SUPABASE_ANON_KEY`: your Supabase anon key

   Optional:
   - `VITE_ENABLE_DEMO_WORKSPACE`: set to `true` to enable the demo workspace in development
   - `VITE_SUPPORT_EMAIL`: support email shown in the app

4. Set up the database in the Supabase SQL Editor:
   ```text
   supabase/migration.sql        -> run first for a fresh install
   supabase/multi_business.sql   -> run second to enable independent workspaces
   supabase/card_codes.sql       -> add server-owned short card codes
   supabase/staff_pin_fix.sql    -> repair provisioned staff Auth rows and PIN resets
   supabase/seed.sql             -> optional, for the local/dev demo admin
   ```

   Notes:
   - [`supabase/migration.sql`](supabase/migration.sql) creates the base schema. [`supabase/multi_business.sql`](supabase/multi_business.sql) is required for the multi-workspace feature; it backfills existing owners and data, then adds business-scoped RLS, relationships, and RPCs.
   - Apply the multi-business migration in a development or preview Supabase project first. Back up an existing database before applying it; the migration makes `business_id` required and fails rather than silently assigning orphaned rows.
   - The smaller SQL files in [`supabase/legacy-patches/`](supabase/legacy-patches/) are upgrade or repair scripts for older or existing projects and are not part of the default new-project setup.
   - [`supabase/seed.sql`](supabase/seed.sql) is for local or development environments only because it creates a known demo account.
   - On an existing multi-workspace installation, apply only the new additive `card_codes.sql` and `staff_pin_fix.sql` migrations; do not rerun the fresh-install schema. The PIN repair preserves owner credentials and repairs NULL Auth fields only on matching provisioned staff accounts.

5. Start the dev server:
   ```bash
   npm run dev
   ```

## Demo Admin Seed

If you run [`supabase/seed.sql`](supabase/seed.sql), it creates this development-only owner account:

| Field | Value |
|---|---|
| Email | `admin@stampee.local` |
| Password | `Admin1234` |
| Slug | `demo` |

Change the password after first login in `Settings -> Account`.

Do not use the demo seed account as-is in production.

## Available Scripts

- `npm run dev`: start the Vite development server
- `npm run generate:sitemap`: regenerate `public/sitemap.xml`
- `npm run build`: regenerate the sitemap, then build the production bundle
- `npm run preview`: preview the production build locally
- `npm run test:i18n`: validate language resolution, interpolation, catalog placeholder parity, and literal translation-call coverage
- `npm run test:no-tracking`: verify the SDK, custom telemetry calls and obsolete analytics-consent UI are absent from runtime source and dependency manifests
- `npm run test:no-tracking:build`: run the same checks against the compiled output after `npm run build`
- `npm run test:card-codes`: validate manual short-code normalization and legacy UUID/URL parsing
- `npm run test:db:local`: run the canonical migrations and SQL regressions against disposable local PostgreSQL databases (Linux/PostgreSQL, local `sudo -u postgres` access required)

The i18n checks are focused unit/static checks, not a replacement for authenticated business-isolation or end-to-end tests. Run `npm run build` as well before deploying.

The SQL runner recreates **only** `stampee_release_test` and `stampee_card_codes_test` through `/var/run/postgresql`, then removes them. Do not use these names for anything persistent. It does not accept a remote database URL, reads copied fixtures from a temporary directory, and does not change repository permissions. Synthetic fixtures are created before the additive migrations, so the tests exercise actual backfills, RLS, public signup, collision retry, immutable codes, PIN rotation, session revocation, and owner/tenant protection. Managed Supabase public-table defaults are modeled locally; `auth.users` and the private code registry remain unreadable to API roles. These tests do not replace a real GoTrue password-grant smoke test.

## Interface Languages

The public pages and application UI support Spanish and English. Use the persistent language selector on any page. The initial language follows the browser unless a prior choice is saved; the choice is stored locally under `stampee.ui.language`, applies across business workspaces, and does not reload the app or change the active session. If local storage is unavailable, switching still works for the current page session.

Translations are rendered from React source through `useI18n()` and the domain catalogs in `lib/i18n/catalogs/`; there is no DOM text-replacement layer or external translation service. English source messages are the catalog keys, and variables use `{name}` placeholders. Dates and numbers use the selected locale where rendered. Business/customer names, entered campaign content, links, IDs, database enums, and stored transaction data are not translated or rewritten when the interface language changes.

## Product Notes

- Multiple independent business workspaces per owner, managed from `/businesses`
- Customers, campaigns, cards, staff membership, settings, and public slugs are isolated by business
- Owners create workspaces; the product is not a marketplace
- Staff accounts are created by the owner from `Settings -> Staff`
- Public customer-facing routes are supported for viewing issued cards and joining enabled campaigns

### Short card codes

Each issued card receives a database-generated, immutable code such as `547a-s5a7`: eight lowercase letters/digits, grouped 4–4. The private registry reserves codes permanently, including after a card is deleted; a conflict is retried atomically. Neither `issued_cards.id` nor existing public `unique_id` UUIDs are rewritten by the backfill.

Manual staff lookup accepts case-insensitive codes with or without spaces/hyphens and is restricted to an active membership in the selected business. A code is not authorization. The public card URLs, QR codes, and legacy staff scan URLs keep their UUID tokens; short codes are not new public URLs. Clients must omit `card_code` on insert and use the value returned by the database.

### Staff PIN authentication

Staff PINs remain strings of 4–6 digits, including leading zeroes. The additive repair completes required Auth token fields on app-provisioned staff rows, so a successful PIN reset is not masked by a GoTrue schema-query error. Owners can reset only their own provisioned staff accounts; old PIN verifiers and refresh sessions are invalidated. An already-issued access JWT can remain valid until its expiry, while business membership/access checks still apply. Network, rate-limit, and internal Auth failures are not presented as an incorrect PIN.

## Deploy

You can deploy the app anywhere that serves a Vite SPA, including Vercel.

1. Add the same `VITE_...` environment variables to your deployment platform.
2. [`vercel.json`](vercel.json) rewrites client-side routes to `index.html`; no Vercel Analytics provider is required or enabled by this project.
3. Initialize a fresh project with [`supabase/migration.sql`](supabase/migration.sql), then apply [`supabase/multi_business.sql`](supabase/multi_business.sql), [`supabase/card_codes.sql`](supabase/card_codes.sql), and [`supabase/staff_pin_fix.sql`](supabase/staff_pin_fix.sql) in that same project.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for contribution guidelines.

## License

[MIT](LICENSE)
