# MoorMove — plan

Local delivery by riders from our own towns (tricycle, motorcycle,
bicycle/e-bike): the idea of Lalamove/Grab, kept simple and built for
Oriental Mindoro's towns and barangays. Made by the E-MOORM team, but a
**separate application**: its own backend, its own web app, its own database,
its own accounts and its own admin.

**Status:** experimental. Phases 1–3 are built and tested (see section 6). Customers, riders and admins have the full app; [README.md](README.md) lists what is in it.

---

## 1. How it sits next to E-MOORM

```
emoorm/
  backend/   web/   apk/        E-MOORM (the shop). MoorMove changes nothing here.
  moormove/
    backend/                    MoorMove API: Express + Prisma, port 4000
    web/                        MoorMove app (riders) + admin: React + Vite, port 5174
```

- **Database:** `moormove_db` (MySQL, `localhost:3306`), MoorMove's alone. It
  never connects to E-MOORM's database.
- **Accounts:** MoorMove's own riders and admins. An E-MOORM login doesn't
  sign anyone in here.
- **E-MOORM data comes only through E-MOORM's API, read only.** Today that is
  its public list of towns (`GET /api/municipalities`), copied into MoorMove so
  riders choose the town they work in. Town ids are E-MOORM's, so E-MOORM
  orders match up with MoorMove riders later.
- **Deploying E-MOORM is unaffected:** its build only builds `web/` and
  `backend/` and never looks inside `moormove/`.

### E-MOORM's deliveries (built)
MoorMove has a small **partner API** (`/api/partner`) that only E-MOORM's
server calls, with one shared secret. A shop taps "Call a rider" on an
E-MOORM order; E-MOORM books a MoorMove job with only what a rider needs
(shop and pickup pin, buyer's name, phone, address and pin, COD and fee).
Every step of the job is sent back to E-MOORM, signed with the same secret
(picked up → *Out for delivery*, delivered + photo → *Delivered*). Details in
README.md, "E-MOORM link".

---

## 2. Who uses it

| Who | Where | What they do |
|---|---|---|
| **Rider** | MoorMove app (phone) | Signs up, applies with documents, (later) goes online, accepts jobs, picks up, delivers with photo proof, collects COD, sees earnings |
| **MoorMove admin** | MoorMove admin (`/admin`, phone or desktop) | Reviews applications, approves / asks for changes / rejects / suspends riders, copies towns from E-MOORM, (later) watches deliveries and settles cash |
| **Shops & buyers** | E-MOORM (later, through the partner API) | Shops choose MoorMove for delivery; buyers see the rider and follow the delivery |

---

## 3. Rider features

### Applying (built)
- An account with name, mobile number, email and password.
- Where they ride: town (from E-MOORM's towns) and barangay.
- Vehicle: tricycle, motorcycle, or bicycle/e-bike.
  - Motorised vehicles: plate number, driver's license number, photos of the
    license and the OR/CR.
  - Tricycles: also their **TODA** and **franchise (MTOP) number**.
- Photos for everyone: a selfie, a valid ID, and the vehicle.
- An emergency contact.
- **Save for later**, then **Send application**. Anything missing is marked
  field by field.
- Statuses the rider sees: *Not sent yet → Under review → Approved*. Or
  *Needs changes*, with the admin's note, and they fix it and send it again.
  Or *Not approved* / *Suspended*, with the reason.
- Document photos are private: the server keeps them outside any public
  folder and shows them only to the rider and MoorMove's admins.

### Working (next)
- An **Online / Offline** switch. While online, the app shares the rider's
  location every ~30 s (only while online).
- **Job list:** open jobs in the rider's town. Each shows:
  - the pickup and drop-off barangays;
  - the fee the rider earns;
  - the COD cash to collect;
  - the package size.

  The first rider to accept gets the job.
- **Active job:** one big next-step button at a time.
  1. Heading to pickup → **Arrived**
  2. **Picked up** (photo)
  3. **Arrived at drop-off**
  4. **Delivered** (photo + "COD collected ₱___")

  At any step, **Can't deliver** (a reason is required). Shortcuts: call or
  text the customer, *Open in Google Maps*.
- **Earnings** (today, this week, per job), **cash on hand** (COD still to hand
  over), history and ratings.

---

## 4. Admin features

- **Built:**
  - an overview with how many riders are in each state;
  - copying towns from E-MOORM;
  - a rider list by state, with search (name, email, phone, plate);
  - each rider's details and documents (tap to enlarge);
  - Approve / Ask for changes / Reject / Suspend / Reinstate, with a note the
    rider sees where needed. A decision only applies if the rider is still in
    the expected state, so two admins can't decide twice.
- **Next:**
  - jobs (create by hand, or from E-MOORM through the partner API);
  - live deliveries with rider positions;
  - COD settlement;
  - fare rules per town;
  - turning MoorMove on per town;
  - more admin accounts.

---

## 5. Data (moormove_db)

| Table | Holds | Built |
|---|---|---|
| `users` | MoorMove accounts: riders and admins (role) | ✅ |
| `towns` | Towns copied from E-MOORM (E-MOORM's ids) | ✅ |
| `riders` | Application and profile: status, town, barangay, vehicle, plate, TODA, MTOP, license no., document photo ids, emergency contact, review (who, when, note), online flag | ✅ |
| `uploads` | Private photos: owner, file, type, size | ✅ |
| `jobs` | Pickup and drop-off, customer contact, fee, COD, status, rider, proof photos, step times, cancel reason, E-MOORM order id (when it came from E-MOORM) | next |
| `job_events` | Every step: who, when, where | next |
| `rider_locations` | Recent positions while online (deleted after 30 days) | next |
| `ratings`, `remittances` | Ratings; COD handed over | later |

---

## 6. Phases

| # | Phase | State |
|---|---|---|
| 1 | **Foundation and applying:** own backend, web, database; rider sign-up and application with private document photos; MoorMove admin reviews riders; towns from E-MOORM's API | ✅ Built |
| 2 | **Deliveries, run by MoorMove alone:** customers book (map pins, live prices, COD); riders go online, accept and do each step with photo proof; live tracking; admin assigns, books for callers, cancels | ✅ Built |
| 3 | **Money and trust:** fares per vehicle, commission, cash owed and recorded payments, earnings, history, ratings, notifications | ✅ Built |
| 4 | **Phone app:** an Android app like E-MOORM's `apk/`, with background location while online and push alerts for new jobs | |
| 5 | **Connecting E-MOORM:** shops call a MoorMove rider from E-MOORM; MoorMove's partner API takes the job and sends every step back, signed (see README, "E-MOORM link") | ✅ Built |
| 6 | **Later:** anyone books a *Padala/Pabili* (A to B); fare calculator; offering each job to the nearest rider with a countdown; scheduled and multi-stop deliveries | |

---

## 7. Decisions (built with these defaults; all can be changed in Fares & settings)

1. **Rider pay:** does the rider keep the whole delivery fee, or does MoorMove
   take a cut?
2. **COD:** do riders collect cash and hand the item price back the same day,
   or start with prepaid jobs only?
3. **Documents:** the application currently requires the following. Keep, add
   (barangay clearance, NBI?) or drop?
   - for everyone: selfie, valid ID, vehicle photo;
   - motorised vehicles: license and OR/CR too;
   - tricycles: TODA and MTOP too.
4. **Pilot:** which town(s) first?
5. **Hosting**, when it goes beyond this PC: its own subdomain (e.g.
   `moormove.emoorm.shop`) with its own database on Hostinger?

---

## 8. Things to keep in mind

- **Privacy (Data Privacy Act):**
  - IDs and licenses stay private;
  - location is collected only while online and kept 30 days at most;
  - riders agree to this when applying.
- **Riders are independent partners, not employees.** The terms must say so,
  plus what happens with lost or damaged items.
- **Tricycles stay in their franchised town.** Cross-town jobs are only for
  motorcycles, if allowed at all.
