# MoorMove

Local delivery by riders from your own town (tricycle, motorcycle, bike). A
separate app from E-MOORM by the same team: its own backend, web app,
database (`moormove_db`), accounts and admin. E-MOORM shops call MoorMove
riders for their orders through a small partner API (below); MoorMove never
touches E-MOORM's database. The plan: [PLAN.md](PLAN.md).

## What's in it

- **E-MOORM orders:** a shop taps "Call a rider" on E-MOORM after packing; the
  order becomes a MoorMove job ("E-MOORM order #EM-…" for the rider). Any
  online rider in the shop's town whose vehicle carries the parcel may take
  it. COD: the rider collects the order total from the buyer, keeps the fee
  and brings the item money back to the shop, who confirms it on E-MOORM.
  Every step is sent back to E-MOORM.
- **Customers** (only while *Let people book deliveries on MoorMove* is on in
  Fares & settings; off by default, so sign-up is for riders):
  - sign up;
  - book a delivery in four steps (pickup pin, drop-off pin, package and
    vehicle with live prices, review), with optional COD;
  - follow it live on a map (rider position, progress, timeline, photos);
  - cancel before pickup;
  - rate the rider;
  - confirm they got the COD money back.
- **Riders:**
  - sign up and apply (town, vehicle, plate, license, TODA/MTOP, photos of
    selfie, ID, license, OR/CR and vehicle);
  - once approved, go online (sharing their location);
  - see open jobs in their town for their vehicle (nearest first), and accept;
  - do each step with photo proof at pickup and delivery, and a COD check;
  - give a job back before pickup, or report "can't deliver" after;
  - see earnings (today, 7 days, month, all time, daily chart), the
    commission they owe, and their history.
- **Admin:**
  - overview (live numbers, today, 7-day chart, waiting applications, latest
    deliveries);
  - deliveries (filter, search, details with a live map, give to a rider,
    cancel, book for callers);
  - riders (review, approve, ask for changes, reject, suspend, reinstate,
    documents, stats);
  - customers;
  - cash (collect commission from riders);
  - towns (copy from E-MOORM, open or close each town);
  - fares and settings (per vehicle, size surcharges, commission, distance
    and COD limits, pause bookings, support contacts).
- **Everyone:** notifications with an unread badge, profile, edit profile,
  change password, help center, terms, privacy and about. The look matches
  E-MOORM: grey page, white cards, its greens, and the phone bottom bar.

## Run it on this PC

Needs Laragon's MySQL running (database `moormove_db`, user `root`, no
password) and Node 20+.

```sh
# API: http://localhost:4000/api
cd moormove/backend
npm install
cp .env.example .env        # then set JWT_SECRET (the command is in the file)
npx prisma migrate deploy   # creates the tables in moormove_db
npm run dev

# Web app: http://localhost:5174
cd moormove/web
npm install
npm run dev
```

### First admin

```sh
cd moormove/backend
npm run create-admin -- --email you@example.com --name "Your Name" --phone 09171234567
```

It asks for the password on screen. Sign in at http://localhost:5174.
- **Towns:** under **Towns**, click **Update from E-MOORM** to copy the towns
  if the list is empty. It reads E-MOORM's public API at `EMOORM_API_URL`
  (the local E-MOORM on :3000 by default).
- **Fares:** set them under **Fares & settings**.

To try a whole delivery, use two browsers (or a private window): one signed
up as a customer, one as a rider that the admin has approved.

## E-MOORM link

The two servers share one secret: MoorMove's `PARTNER_SECRET` equals
E-MOORM's `MOORMOVE_SECRET` (and E-MOORM's `MOORMOVE_API_URL` points at this
API). Without it the partner API answers 503 and nothing is sent.

- **E-MOORM → MoorMove** (`/api/partner`, `Authorization: Bearer <secret>`):
  `GET /status`, `POST /quote`, `POST /jobs` (one open job per order: the
  same order again returns that job), `GET /jobs/:id`, `POST /jobs/:id/cancel`
  (before pickup), `POST /jobs/:id/cod-returned`, `GET /uploads/:id` (proof
  photos).
- **MoorMove → E-MOORM:** every change to an E-MOORM job is saved in
  `partner_events` and posted to `EMOORM_API_URL/partner/moormove/events`,
  signed (`X-MoorMove-Signature: sha256=HMAC(secret, timestamp + "." + body)`).
  Failed sends are retried (10 s, 30 s, 1 min, 5 min, 15 min, then every
  30 min) for a day; then the admins get a notification. Sent updates are
  kept 7 days. Fares & settings shows whether the link works.

## Deploy on Hostinger (move.emoorm.shop)

One Node.js app serves both the API and the web app.

1. **Database:** create a MySQL database and user in hPanel.
2. **Subdomain:** add `move.emoorm.shop` and create a Node.js app on it
   (Node 20+), from this folder's own Git repository (MoorMove is not part of
   E-MOORM's repository).
3. **Build and start:**
   - Build command: `npm run build` (installs the backend and the web app,
     builds `web/dist`, generates the Prisma client).
   - Start command: `npm start`; entry file: `server.js` (it starts
     `backend/server.js`). The
     server starts listening first, then runs `prisma migrate deploy` in the
     background.
4. **Environment variables** (hPanel, never in Git):
   - `NODE_ENV=production` (serves `web/dist` and migrates on start)
   - `DATABASE_URL=mysql://USER:PASSWORD@localhost:3306/DATABASE`
   - `JWT_SECRET` (48+ random characters)
   - `WEB_ORIGIN=https://move.emoorm.shop`
   - `EMOORM_API_URL=https://emoorm.shop/api`
   - `PARTNER_SECRET` = the same value as E-MOORM's `MOORMOVE_SECRET`; on
     E-MOORM set `MOORMOVE_API_URL=https://move.emoorm.shop/api`.
   - `UPLOAD_DIR=/home/<your-user>/moormove-data/uploads` (outside the app
     folder, so a redeploy keeps riders' documents and proof photos).
5. **First admin:** in the app's terminal, `cd backend && npm run
   create-admin -- --email … --name … --phone …`, then sign in, open
   **Towns → Update from E-MOORM**, and check **Fares & settings**.
6. **Photos:** riders' documents and proof photos are kept in `UPLOAD_DIR`
   (default `backend/uploads/`). On Hostinger point it outside the app folder
   and back it up with the database.

## Rules

- MoorMove never connects to E-MOORM's database. It reads E-MOORM's public
  town list and talks to E-MOORM's server only through the signed link above.
- Riders' documents and delivery photos live in `backend/uploads/` (not in
  git). They are served only to their owner, admins, and (for proof photos)
  the customer of that delivery.
- Payment is cash to the rider. MoorMove's commission (10% by default) is
  owed by the rider and recorded under Cash when paid.
