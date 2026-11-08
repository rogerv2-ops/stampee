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
- Vercel Analytics
- Vercel deployment config via [`vercel.json`](vercel.json)

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
   supabase/seed.sql             -> optional, for the local/dev demo admin
   ```

   Notes:
   - [`supabase/migration.sql`](supabase/migration.sql) creates the base schema. [`supabase/multi_business.sql`](supabase/multi_business.sql) is required for the multi-workspace feature; it backfills existing owners and data, then adds business-scoped RLS, relationships, and RPCs.
   - Apply the multi-business migration in a development or preview Supabase project first. Back up an existing database before applying it; the migration makes `business_id` required and fails rather than silently assigning orphaned rows.
   - The smaller SQL files in [`supabase/legacy-patches/`](supabase/legacy-patches/) are upgrade or repair scripts for older or existing projects and are not part of the default new-project setup.
   - [`supabase/seed.sql`](supabase/seed.sql) is for local or development environments only because it creates a known demo account.

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

The i18n checks are focused unit/static checks, not a replacement for authenticated business-isolation or end-to-end tests. Run `npm run build` as well before deploying.

## Interface Languages

The public pages and application UI support Spanish and English. Use the persistent language selector on any page. The initial language follows the browser unless a prior choice is saved; the choice is stored locally under `stampee.ui.language`, applies across business workspaces, and does not reload the app or change the active session. If local storage is unavailable, switching still works for the current page session.

Translations are rendered from React source through `useI18n()` and the domain catalogs in `lib/i18n/catalogs/`; there is no DOM text-replacement layer or external translation service. English source messages are the catalog keys, and variables use `{name}` placeholders. Dates and numbers use the selected locale where rendered. Business/customer names, entered campaign content, links, IDs, database enums, and stored transaction data are not translated or rewritten when the interface language changes.

## Product Notes

- Multiple independent business workspaces per owner, managed from `/businesses`
- Customers, campaigns, cards, staff membership, settings, and public slugs are isolated by business
- Owners create workspaces; the product is not a marketplace
- Staff accounts are created by the owner from `Settings -> Staff`
- Public customer-facing routes are supported for viewing issued cards and joining enabled campaigns

## Deploy

You can deploy the app anywhere that serves a Vite SPA, including Vercel.

1. Add the same `VITE_...` environment variables to your deployment platform.
2. If you use Vercel, you can optionally enable Vercel Web Analytics.
3. [`vercel.json`](vercel.json) already rewrites client-side routes to `index.html`.
4. Make sure your Supabase project has been initialized with [`supabase/migration.sql`](supabase/migration.sql), then apply [`supabase/multi_business.sql`](supabase/multi_business.sql) in the same preview or deployment project.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for contribution guidelines.

## License

[MIT](LICENSE)
