# Premium Catering Service

This is a [Next.js](https://nextjs.org) project built using React, Drizzle ORM, Supabase, and tRPC.

---

## Prerequisites

- **Node.js**: Version `>= 20.9.0` is required for Next.js 16.
- **Database**: PostgreSQL (Supabase/Neon). Make sure your `DATABASE_URL` is set in the `.env` file.

---

## Getting Started

### 1. Setup Environment Variables
Create a `.env` file at the root level of the project:
```bash
cp .env.example .env
```
Ensure you update the database and provider credentials inside `.env`.

---

## Database Migrations & Schema Push

This project uses **Drizzle ORM** for schema and database management.

### Option A: Schema Push (Direct Sync for Development)
To sync your database tables directly with your TS schema (`src/db/schema/index.ts`) without generating SQL migration files:
```bash
npx drizzle-kit push
```

### Option B: Generate and Apply Migrations (Production-safe)
1. **Generate migration SQL files**:
   ```bash
   npx drizzle-kit generate
   ```
2. **Apply migrations to the database**:
   ```bash
   npx drizzle-kit migrate
   ```

---

## Running the Application

### Under Windows Host (Recommended Node >= 20)
Start the development server:
```powershell
npm run dev
```

*Note: If you run into UNC path errors when using a WSL network share (`\\wsl.localhost\...`), launch the development server directly:*
```powershell
node node_modules/next/dist/bin/next dev
```

### Under WSL (Ubuntu)
Ensure your WSL environment is running Node.js `>= 20.9.0`, then run:
```bash
npm run dev
```

---

## Git Ignore Policies
Both `node_modules/` and `.env*` files are already configured and ignored inside our `.gitignore` to prevent committing sensitive keys or package binaries.
