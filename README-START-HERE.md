# Tho'am — clean project package

## Before running

1. Extract this ZIP.
2. Open a terminal in the `thoam-platform` directory (the folder containing `package.json`).
3. Confirm the location with `pwd`.
4. Create `.env.local` from `.env.example` and fill in your own Supabase values. The original `.env.local` was intentionally excluded from this ZIP for security. Never share service-role keys.

## Install and run (one command at a time)

```bash
npm ci
npm run dev
```

Open `http://localhost:3000` in your browser. Stop the dev server with `Ctrl+C` before running a production build.

For production checks, run these separately:

```bash
npm run lint
npm run build
```

If `npm ci` appears stuck, wait briefly, then check the terminal's network/error output. Do not run `cd ...` and `npm ...` joined together on one line unless separated with `&&`.

## Notes

- `next.config.ts` explicitly sets `outputFileTracingRoot` to the project folder to address the parent-lockfile workspace warning. Next.js may still print an informational workspace warning depending on its version and local lockfiles.
- `.next/` and `node_modules/` are build/install artifacts and are intentionally not included; they should be regenerated locally.
- `.env.local` is intentionally excluded. Use `.env.example` as the template.
- Existing UI styles in `app/globals.css` have been preserved to avoid visual changes.
