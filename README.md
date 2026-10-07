This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Backend (Supabase)

The app needs a Supabase project for two separate things: **auth** (sign in / sign
up) and the **Postgres database** (analysis cache, search history, rate limits).
Both live under the same project ref, so losing the project breaks both at once.

Check whether the backend is reachable before debugging anything else:

```bash
npm run check:backend
```

It reports env vars, the Auth host, and the database (connection + tables), and
tells you which one is broken. `DNS ... does not resolve` means the Supabase
project no longer exists.

### Rebuilding after a lost or new project

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, paste all of `prisma/bootstrap.sql` and run it once. That
   file is every migration in `prisma/migrations/` concatenated in order —
   regenerate it with `./scripts/build-bootstrap-sql.sh` after adding a migration.
3. Update the credentials: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`,
   and `DATABASE_URL` (pooler, port 6543) + `DIRECT_URL` (direct, 5432) in `.env`.
   Mirror the same values in the Vercel project settings.
4. Re-run `npm run check:backend` — it should print `Backend is healthy.`

Migrations are applied **by hand** in the SQL Editor, not with `prisma migrate
deploy`: the pooler isn't reachable over IPv6 from the dev machine.

### When the database is down

The rate limiters deliberately **fail closed** — with no way to count usage, a
metered AI call could otherwise run uncapped and drain the free provider budget.
Those routes answer `503 {"error":"service_unavailable"}`, never a `429`: a 429
would tell users they spent a quota they never touched and push them toward a
signup that is equally down.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
