# Tho'am — local food ordering platform

A black-and-white, mobile-first Next.js PWA starter for the Tho'am concept: customer ordering, restaurant partner portal, super-admin console, and table QR menu routes. The ZIP contains a substantial application foundation, SQL schema, auth screens, install prompts for customer and owner experiences, restaurant/product/order views, and deployment notes.

> **Important production status:** This is a runnable starter scaffold, not a fully verified live-commerce system yet. Supabase credentials, Google OAuth configuration, admin role assignment, checkout migration, server credentials, Google OAuth configuration, owner/admin provisioning, phone verification, delivery workflows, legal policies, and end-to-end testing must be completed before accepting real orders.

## Stack
- Next.js App Router + TypeScript
- Supabase Auth and PostgreSQL
- Tailwind CSS v4 import + custom responsive CSS
- Customer PWA manifest and a separate partner PWA manifest/scope
- Cash on delivery for delivery orders; restaurant-managed delivery
- QR table menus at `/qr/[restaurantSlug]/[tableCode]` (guest browsing, no login/signup requirement)

## Run locally
1. Install Node.js 20.9+ (Node 22 recommended).
2. Extract the ZIP and open the project folder in a terminal.
3. Run `npm install`.
4. Copy `.env.example` to `.env.local` and fill in the Supabase project URL and anon/publishable key. Add `SUPABASE_SERVICE_ROLE_KEY` as a server-only environment variable (never expose it to the browser).
5. In Supabase SQL Editor, run `sql/schema.sql` on a fresh project. Review the SQL before applying it to an existing project. Then run `sql/fix-checkout-and-images.sql` to enable atomic COD checkout.
6. Configure Authentication → URL Configuration: Site URL `http://localhost:3000`; add `http://localhost:3000/auth/callback` to allowed redirect URLs.
7. Configure Google provider in Supabase Auth and add the Google OAuth client ID/secret and authorized redirect URL shown by Supabase.
8. For product images, create a Cloudinary account, set an unsigned upload preset restricted to JPG/PNG/WebP and a 5 MB max file size, then set `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`. Product image files go to Cloudinary; only the hosted image URL is saved in Supabase.
9. Run `npm run dev` and open `http://localhost:3000`.
10. Run `npm run build` before deployment.
8. Run `npm run dev` and open `http://localhost:3000`.
9. Run `npm run build` before deployment.

## Roles and access
- Customer accounts are created by Supabase Auth and the SQL trigger assigns `customer` by default.
- Owner signup requests do **not** grant owner privileges from client metadata. A trusted admin process must create/approve a restaurant and set the profile role to `restaurant_owner` with its `restaurant_id`.
- The first admin role must be assigned securely through the Supabase SQL editor after verifying the exact user UUID. Never expose a Supabase service-role key in client code or a `NEXT_PUBLIC_` variable.
- RLS is enabled in the included schema. Review/test every policy in a staging project. Public order creation is intentionally not enabled because it must be an atomic server-side operation that validates current prices, product availability, restaurant approval, table ownership, COD totals, platform fee, and stock.

## App areas
- `/` — customer landing page; customer install prompt includes “Install app” and “Continue on web”.
- `/restaurants` — restaurant search/listing.
- `/restaurants/[slug]` — restaurant menu and cart preview.
- `/auth` — email/password and Google OAuth UI, with customer/owner intent in query parameters.
- `/my-orders` — authenticated customer order history.
- `/owner` — partner portal; separate partner install prompt with “Install app” and “Continue on web”.
- `/restaurant-admin` — partner overview, product/order/QR links.
- `/restaurant-admin/products` — product add, availability toggle, delete.
- `/restaurant-admin/orders` — order listing and status update.
- `/restaurant-admin/qr` — table records and QR image link.
- `/thoam-admin` — super-admin overview, restaurant approval/suspension and platform order view.
- `/qr/[restaurantSlug]/[tableCode]` — public guest QR menu; no login/signup requirement for viewing. Secure guest order submission is not active until an atomic server endpoint is implemented.
- `/api/health` — basic health/config check.

## Separate PWAs
The customer app uses `/manifest.webmanifest` with start URL `/`. The partner portal uses `/owner/manifest.webmanifest` with start URL and scope `/owner`. Browser install support varies by browser/device. The prompt offers “Install app” and “Continue on web”; if the browser does not expose a native install prompt, the user sees instructions to use the browser menu.

## Revenue and business rules
- Proposed platform fee is ₹1 per eligible order, but the payer and exact fee treatment must be explicitly agreed and configured. The starter schema stores `platform_fee` per order; it does not automatically collect or settle it.
- Delivery is handled by the restaurant. Delivery fee is configured per restaurant.
- QR dine-in orders should normally be paid at the restaurant; configure this as an explicit business rule before launch.
- Cancelled/rejected orders should not count as completed-order platform revenue. Add a tested accounting/settlement report before using revenue figures operationally.

## Before real launch — required engineering work
1. Implement a secure server-side order endpoint (e.g. Next.js Route Handler using server-only Supabase service role, or a carefully designed Postgres RPC) with transaction/atomicity. Validate user/guest data, approved restaurant, product ownership and prices, availability, quantities, table code, order type, delivery area, delivery fee, platform fee, and stock. Never trust client-supplied totals.
2. For QR guest orders, use a public but unguessable or signed table token and rate limiting; do not expose privileged order writes through RLS.
3. Correct and test OAuth callback/session handling with `@supabase/ssr` cookie-based clients before deployment. This starter auth UI uses the Supabase browser client and requires provider configuration; use a tested SSR auth setup for a hardened production release.
4. Add customer address book, phone verification, delivery instructions, order cancellation rules, and order notifications.
5. Add owner registration form for restaurant details, admin approval UI, owner-to-restaurant linking workflow, and audit logging.
6. Add image upload flow and Storage bucket policies.
7. Add proper edit form for products, category management, order item details, notification delivery, analytics charts, and admin filters/export.
8. Implement platform-fee accounting, COD collection/settlement reconciliation, refunds, privacy policy, terms, cancellation policy, and retention rules.
9. Test RLS with customer, owner A, owner B, and admin test accounts. Verify owners cannot read/update another restaurant's records and customers cannot see others' orders.
10. Test install prompts on Android Chrome and iOS Safari; iOS often requires Share → Add to Home Screen rather than a native `beforeinstallprompt` event.
11. Deploy to Vercel, set environment variables, update Supabase redirect URLs, add custom domain and production monitoring.

## Admin bootstrap (use carefully)
After signing up the account that should be admin, find its UUID in Supabase Authentication → Users, then run this exact UUID only after verifying it:

```sql
update public.profiles set role = 'admin', restaurant_id = null where id = 'REPLACE_WITH_VERIFIED_AUTH_USER_UUID';
```

Do not expose service-role keys. Do not promote users based on query parameters or signup metadata.

## Visual design
Minimal black-and-white visual system, large bold typography, restrained cards, responsive layouts, clear hierarchy, no religious imagery/theme. Logo is a clean `T.` placeholder mark and wordmark; replace `public/icon.svg` and the wordmark with the final approved Tho'am logo if desired.
