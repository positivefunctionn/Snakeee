# Mìrì — 秘日 · Secret Days

Mìrì is a private, single-person digital diary built with React, TypeScript, Vite, Supabase Auth, PostgreSQL, and Supabase Storage. It never contains or creates a password; authentication is handled by Supabase.

## Local setup

1. Create a Supabase project and enable Email/Password sign-in in **Authentication**.
2. In the Supabase SQL Editor, run `supabase/migrations/20260917000000_miri.sql`.
3. Create a **private** Storage bucket called `diary-photos`. Do not mark it public.
4. Copy `.env.example` to `.env` and add your project URL and anon/publishable key. Never add a service-role key to this app.
5. Run `npm install` and `npm run dev` from this directory.
6. Create your personal account in Supabase Auth (Dashboard → Users → Add user), entering your chosen password privately, then use it at Mìrì’s unlock screen.

## Security model

- Supabase Auth owns password handling and sessions. Passwords are not stored, logged, or compared by this application.
- Every diary table has Row Level Security, with policies tied to `auth.uid()`.
- `user_id` defaults to `auth.uid()` and RLS rejects records owned by someone else.
- Photo paths are scoped to the authenticated user and the Storage bucket is private. Images are opened using short-lived signed URLs after authenticated database access.
- The frontend uses only the Supabase anon/publishable key. Never expose a service-role key in a `VITE_` variable.

## Deployment

Deploy with Vercel, Netlify, or Cloudflare Pages. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the hosting provider’s encrypted environment-variable settings, then configure your deployed URL in Supabase Auth redirect URLs.

## Notes

The core diary, secure login, timeline, calendar, search, important memories, soundtrack, automatic lock, dark theme, RLS schema, and private gallery are ready. Before storing personal photos, configure the bucket above and verify the storage policies in your own Supabase project. Database-level RLS is the authorization boundary; client route hiding alone is never relied upon.
