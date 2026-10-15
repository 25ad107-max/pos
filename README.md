.# Maruthi Transport

Operations workspace for Maruthi Transport, a construction-material supply and transport business serving Chennai.

## Current working scope

- PostgreSQL-backed staff sign-in with salted password hashes, revocable and expiring sessions, HTTP-only cookies, and server-side role checks.
- Responsive dashboard with real order, payment, driver, vehicle, and delivery metrics.
- Manager-only order entry for customer/site, material and quantity, charges/discounts, scheduled delivery, and initial payments, with an order register.
- Editable driver profiles, licence details, salary settings, vehicle records, document-expiry dates, driver assignments, search, and archive actions.
- A separate driver portal for assigned deliveries, with manager-provisioned driver logins and controlled delivery status updates.
- Driver and vehicle changes are recorded in an append-only audit log. Fleet records are archived, not hard-deleted.
- Relational data models are prepared for customers, materials, orders, loads, payments, expenses, advances, and salary periods.

Customer/POS order entry, salary processing, and invoice/PDF/printing workflows from the original specification are not implemented in this initial working release.

### Driver accounts

Managers can create a driver profile, then choose **Set up login** in the Drivers list. Set a unique email and an initial password of at least 12 characters, and share those credentials with the driver through a private channel. The driver signs in through the same login page and is shown only their own assigned deliveries. Driver accounts must be linked to an active driver profile; public account registration is not available.

## Requirements

- Node.js 20.9 or later
- Docker Desktop (for the included local PostgreSQL service), or a PostgreSQL 14+ server

## Local setup (Windows PowerShell)

`.env` is a configuration file, not a command. Do not type `.env` at the terminal prompt; the app and Prisma load it automatically. It is already created locally from the administrator details you provided and is excluded from source control. Do not copy credentials into `.env.example` or share `.env`.

Run these commands one at a time in **Windows PowerShell**, from the project folder:

1. Start Docker Desktop and ensure it is using the WSL 2 engine, then start the local database: `docker compose up -d postgres`.
2. Install packages: `npm.cmd install`.
3. Generate the Prisma client and create the database schema: `npm.cmd run db:generate` then `npm.cmd run db:migrate`.
4. Create the first super-admin and default material/service list: `npm.cmd run db:seed`.
5. Start the app: `npm.cmd run dev`, then open `http://localhost:3000`.

### If Docker says WSL is not installed

Docker Desktop uses WSL 2 to run the included Linux PostgreSQL container. The `asusprashanth_...:/mnt/c/...$` prompt is the Linux/WSL terminal; `wsl --update` is a **Windows** command and will not run there. Type `exit` to leave that terminal, open **Windows PowerShell as Administrator** from the Start menu, and run:

```powershell
wsl --install
```

Restart Windows if prompted. Then, in **Windows PowerShell** (not the Ubuntu/WSL terminal), run `wsl --update`. Start Docker Desktop and retry `docker compose up -d postgres` from Windows PowerShell in the project folder. If `wsl --install` is unavailable or blocked by your organization, ask your administrator to enable WSL 2, or use a separately installed PostgreSQL 14+ server and configure `DATABASE_URL` in `.env` to connect to it.

If `wsl --update` reports **Forbidden (403)**, try `wsl --update --web-download` from Windows PowerShell. If that is also blocked, update **Windows Subsystem for Linux** through the Microsoft Store, or ask your network/IT administrator whether Store or WSL update downloads are blocked by a proxy or organization policy. You can check WSL's current state with `wsl --status`; updating WSL is not required to run the project directly against a separately installed PostgreSQL server.

The seed operation does not reset an existing account password. To change an administrator password, use a controlled account-management procedure; do not re-run the seed expecting it to update an existing account. The supplied password has been entered into this chat; rotate it to a fresh, unique password before production use.

## Production deployment

For Vercel, import the GitHub repository and add the production environment variables in **Project Settings → Environment Variables**. Set `DATABASE_URL` to the Supabase PostgreSQL connection string appropriate for the Vercel runtime, and add unique `ADMIN_EMAIL`, `ADMIN_PASSWORD` (at least 12 characters), and optional `ADMIN_NAME` values. Never commit these values, paste them into source files, or put them in `NEXT_PUBLIC_*` variables. Supabase and Vercel should both use production-only credentials, and the Supabase database should not be exposed with permissive public access.

Before the first production deployment, apply the Prisma schema with `npm run db:deploy` using the production database configuration, then deploy the application. Vercel can automatically deploy future commits pushed to the connected GitHub branch. Use HTTPS, apply login rate limits at the trusted ingress, keep encrypted database backups, test restores, and create staff accounts through the manager-only provisioning flow; do not enable public sign-up.

Fleet management endpoints are restricted to super-admins and managers. Other role-specific workflows listed in the supplied product specification are not part of this release.
