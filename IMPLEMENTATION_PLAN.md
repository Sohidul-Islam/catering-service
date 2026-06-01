# Premium Catering Service — Full Implementation Plan

> **Status:** Living document. Commit this file alongside each feature branch.  
> **Stack:** Next.js 14 (App Router) · TypeScript · Drizzle ORM · Supabase Auth/DB · tRPC · Chart.js

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Database Architecture](#2-database-architecture)
3. [Authentication — Login & Register](#3-authentication--login--register)
4. [Role Architecture](#4-role-architecture)
5. [API Endpoints (tRPC Routers)](#5-api-endpoints-trpc-routers)
6. [View Specifications — Admin Role](#6-view-specifications--admin-role)
7. [View Specifications — Employee Role](#7-view-specifications--employee-role)
8. [Shared Components](#8-shared-components)
9. [Date Filter System](#9-date-filter-system)
10. [Pages & Routes Map](#10-pages--routes-map)
11. [Implementation Task Checklist](#11-implementation-task-checklist)
12. [Verification Plan](#12-verification-plan)

---

## 1. System Overview

**Premium Catering Service / MealHub** is a multi-tenant corporate meal management SaaS.

```
Organizations (Tenants)
  └── Profiles (Users, seeded via Supabase Auth)
       ├── org_admin  → full dashboard access
       └── org_member → employee portal access
```

### Key Flows
| Flow | Who | Description |
|------|-----|-------------|
| Register | Admin | Creates org + admin account |
| Login | All | Supabase email/password |
| Confirm Meal | Employee | Daily RSVP per slot |
| Bulk Override | Admin | Change statuses in bulk |
| Reports | Admin | View date-filtered analytics |
| Billing | Admin | Generate monthly invoices |
| Settings | Admin | Org config, slots, rules |

---

## 2. Database Architecture

### 2.1 Entity Relationship Diagram (Drizzle / PostgreSQL)

```
organizations
  id (uuid, PK)
  name (text)
  billingEmail (text)
  timezone (text, default 'UTC')
  logoUrl (text, nullable)
  isApproved (boolean)
  createdAt / updatedAt (timestamp)

profiles                            ← mirrors Supabase auth.users
  id (text, PK)                     ← = Supabase auth.users.id
  email (text, unique)
  fullName (text)
  phoneNumber (text)
  role: 'super_admin' | 'org_admin' | 'org_member'
  organizationId (uuid → organizations.id, nullable)
  mealBehaviorType: 'recurring' | 'flexible'
  departmentId (uuid → departments.id, soft ref)
  officeLocationId (uuid → office_locations.id, soft ref)
  isActive (boolean)
  joinedAt / leftAt / createdAt / updatedAt

organization_members                ← many-to-many (user ↔ org)
  profileId (text → profiles.id)
  organizationId (uuid → organizations.id)
  role: 'org_admin' | 'org_member'
  [PK: (profileId, organizationId)]

meal_slots
  id (uuid, PK)
  organizationId (uuid → organizations.id)
  name (text)                       ← e.g. "Lunch", "Dinner"
  startTime (text)                  ← HH:MM 24h format
  endTime (text)
  confirmationDeadline (text)       ← e.g. "22:00"
  deadlineDaysAhead (integer)
  price (numeric 10,2)
  capacity (integer, nullable)
  isActive (boolean)
  createdAt / updatedAt

recurring_preferences               ← for 'recurring' type employees
  id (uuid, PK)
  memberId (text → profiles.id)
  mealSlotId (uuid → meal_slots.id)
  dayOfWeek (integer 0–6)           ← 0=Sunday, 1=Monday...
  quantity (integer)

meal_confirmations
  id (uuid, PK)
  memberId (text → profiles.id)
  mealSlotId (uuid → meal_slots.id)
  date (text, YYYY-MM-DD)
  status: 'confirmed' | 'skipped' | 'pending'
  quantity (integer)
  price (numeric, nullable)         ← snapshotted at booking time
  isOverridden (boolean)
  overriddenById (text → profiles.id, nullable)
  createdAt / updatedAt

invoices
  id (uuid, PK)
  organizationId (uuid → organizations.id)
  billingPeriodStart (text, YYYY-MM-DD)
  billingPeriodEnd (text, YYYY-MM-DD)
  totalAmount (numeric)
  status: 'draft' | 'sent' | 'paid' | 'overdue'
  pdfUrl (text, nullable)
  createdAt / updatedAt

billing_adjustments
  id (uuid, PK)
  invoiceId (uuid → invoices.id)
  memberId (text → profiles.id)
  amount (numeric)                  ← positive = surcharge, negative = credit
  reason (text)
  createdAt

billing_snapshots
  id (uuid, PK)
  organizationId (uuid → organizations.id)
  memberId (text → profiles.id)
  mealSlotId (uuid → meal_slots.id)
  date (text, YYYY-MM-DD)
  confirmedCount (integer)
  totalAmount (numeric)
  createdAt

departments
  id (uuid, PK)
  organizationId (uuid → organizations.id)
  name (text)
  createdAt

office_locations
  id (uuid, PK)
  organizationId (uuid → organizations.id)
  name (text)
  address (text, nullable)
  createdAt

holidays
  id (uuid, PK)
  organizationId (uuid → organizations.id)
  date (text, YYYY-MM-DD)
  name (text)
  createdAt

member_leaves
  id (uuid, PK)
  organizationId (uuid → organizations.id)
  memberId (text → profiles.id)
  startDate (text, YYYY-MM-DD)
  endDate (text, YYYY-MM-DD)
  reason (text, nullable)
  createdAt

invitations
  id (uuid, PK)
  organizationId (uuid → organizations.id)
  email (text)
  role: 'org_admin' | 'org_member'
  status: 'pending' | 'accepted' | 'declined'
  createdAt

notifications
  id (uuid, PK)
  recipientId (text → profiles.id)
  type (text)                       ← 'reminder', 'skip_alert', 'invoice_ready'...
  message (text)
  isRead (boolean)
  createdAt

logs (audit trail)
  id (uuid, PK)
  organizationId (uuid → organizations.id)
  performedById (text → profiles.id)
  action (text)
  targetType (text)
  targetId (text)
  meta (jsonb, nullable)
  createdAt
```

### 2.2 Indexes Required
```sql
CREATE INDEX ON meal_confirmations (date, meal_slot_id);
CREATE INDEX ON meal_confirmations (member_id, date);
CREATE INDEX ON profiles (organization_id, is_active);
CREATE INDEX ON recurring_preferences (member_id, day_of_week);
CREATE INDEX ON logs (organization_id, created_at DESC);
```

### 2.3 Row Level Security (Supabase RLS)
```sql
-- profiles: users can only see own profile or same-org profiles
-- meal_confirmations: org members can only see/write own rows
-- Admin routes are enforced at tRPC procedure level (not RLS)
-- Service role key used only in server-side tRPC context
```

---

## 3. Authentication — Login & Register

### 3.1 Login Page — `/login`
**File:** `src/app/(auth)/login/page.tsx`  
**Status:** ✅ Exists (functional)

| Field | Type | Validation |
|-------|------|------------|
| Email | `<input type="email">` | Required, valid email |
| Password | `<input type="password">` | Required, min 6 chars |

**Flow:**
1. `supabase.auth.signInWithPassword({ email, password })`
2. On success → `router.push('/dashboard')`
3. On error → display inline error message

**Improvements needed:**
- [ ] Add "Forgot password" link → `/forgot-password`
- [ ] Add `loading` spinner inside button
- [ ] Show org name in welcome message if user already logged in
- [ ] Auto-redirect if already logged in (check session on mount)

### 3.2 Register Page — `/register`
**File:** `src/app/(auth)/register/page.tsx`  
**Status:** ⚠️ Page exists, needs wiring to `organization.register` tRPC endpoint

**Fields:**
| Field | Type | Notes |
|-------|------|-------|
| Organization Name | text | Required |
| Your Name | text | Admin's full name |
| Work Email | email | Admin login email |
| Password | password | min 8 chars |
| Confirm Password | password | must match |
| Timezone | select | Default `Asia/Kolkata` |

**Flow:**
1. Call `trpc.organization.register.mutate({ name, billingEmail, adminEmail, adminPassword, adminName, timezone })`
2. Backend: creates Supabase auth user + organization + profile (isApproved: false)
3. Show "Pending approval" page or redirect to `/dashboard` if auto-approved
4. Middleware protects `/dashboard` — redirect to `/login` if unauthenticated

### 3.3 Middleware (`src/middleware.ts`)
**Status:** ✅ Exists

| Route | Unauthenticated | Authenticated |
|-------|-----------------|---------------|
| `/dashboard/*` | Redirect → `/login` | Allow |
| `/admin/*` | Redirect → `/login` | Allow |
| `/login`, `/register` | Allow | Allow (no auto-redirect yet) |

**Improvement needed:**
- [ ] Redirect already-authenticated users away from `/login` → `/dashboard`

---

## 4. Role Architecture

### Role Hierarchy
```
super_admin       ← Platform owner (can manage all orgs)
  └── org_admin   ← Organization admin (full dashboard)
        └── org_member ← Employee (meal portal only)
```

### UI Routing by Role
| Role | Landing Page | Sidebar |
|------|-------------|---------|
| `super_admin` | `/admin` | Super admin panel |
| `org_admin` | `/dashboard?role=admin` | Full admin sidebar |
| `org_member` | `/dashboard?role=employee` | Employee portal only |

### Role Sandbox (dev only)
The floating "Role Workspace Sandbox" widget in the bottom-right allows switching views during development. In production this should be hidden unless `role=super_admin`.

---

## 5. API Endpoints (tRPC Routers)

All routes are in `src/server/routers/app.ts` and exposed via `src/app/api/trpc/[trpc]/route.ts`.

### 5.1 `organization.*` Router

| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `organization.register` | mutation | public | Create org + admin user |
| `organization.getDetails` | query | org_member | Get current org info |
| `organization.updateSettings` | mutation | org_admin | Update org name/timezone/billing |
| `organization.getMembers` | query | org_admin | List all active members |
| `organization.addMember` | mutation | org_admin | Add member directly |
| `organization.inviteMember` | mutation | org_admin | Invite via email |
| `organization.deactivateMember` | mutation | org_admin | Soft-delete member |
| `organization.reactivateMember` | mutation | org_admin | Re-enable member |
| `organization.toggleMemberBehavior` | mutation | org_admin | Switch recurring↔flexible |
| `organization.getSlots` | query | org_member | List meal slots |
| `organization.createSlot` | mutation | org_admin | Add meal slot |
| `organization.updateSlot` | mutation | org_admin | Edit meal slot |
| `organization.deleteSlot` | mutation | org_admin | Remove meal slot |
| `organization.getHolidays` | query | org_member | List org holidays |
| `organization.addHoliday` | mutation | org_admin | Add holiday |
| `organization.deleteHoliday` | mutation | org_admin | Remove holiday |
| `organization.getDepartments` | query | org_member | List departments |
| `organization.addDepartment` | mutation | org_admin | Add department |
| `organization.deleteDepartment` | mutation | org_admin | Remove department |
| `organization.getOfficeLocations` | query | org_member | List locations |
| `organization.addOfficeLocation` | mutation | org_admin | Add location |
| `organization.getMemberLeaves` | query | org_admin | All leaves |
| `organization.getMyLeaves` | query | org_member | Own leaves |
| `organization.addMemberLeave` | mutation | org_admin | Record leave |
| `organization.getCurrentProfile` | query | protected | Get logged-in user profile |
| `organization.getSentInvitations` | query | org_admin | All sent invites |
| `organization.getPendingInvitations` | query | protected | My pending invites |
| `organization.acceptInvitation` | mutation | protected | Accept invite |
| `organization.declineInvitation` | mutation | protected | Decline invite |
| `organization.switchOrganization` | mutation | protected | Change active org |

### 5.2 `meal.*` Router

| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `meal.getConfirmations` | query | org_member | Get confirmations for date range |
| `meal.confirmMeal` | mutation | org_member | Submit RSVP (confirmed/skipped) |
| `meal.adminOverride` | mutation | org_admin | Override any member status |
| `meal.getDailyStats` | query | org_admin | Per-slot stats for a date |
| `meal.saveRecurringPreferences` | mutation | org_member | Set weekly defaults |
| `meal.getRecurringPreferences` | query | org_member | Get weekly defaults |
| `meal.getKitchenDashboard` | query | super_admin | All-org confirmed counts |

### 5.3 `billing.*` Router — **TO IMPLEMENT**

| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `billing.getInvoices` | query | org_admin | List invoices by date range |
| `billing.generateInvoice` | mutation | org_admin | Create billing snapshot + invoice |
| `billing.getInvoiceDetail` | query | org_admin | Full invoice with employee rows |
| `billing.addAdjustment` | mutation | org_admin | Add credit/surcharge to line |
| `billing.markPaid` | mutation | org_admin | Mark invoice as paid |
| `billing.exportCSV` | query | org_admin | Generate CSV download URL |
| `billing.getEmployeeSummary` | query | org_admin | Per-employee meal counts for range |

**Input schema for `billing.getEmployeeSummary`:**
```ts
z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealSlotId: z.string().uuid().optional(),
})
```

### 5.4 `reports.*` Router — **TO IMPLEMENT**

| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `reports.getDailyConsumption` | query | org_admin | Daily meal counts for bar chart |
| `reports.getTopConsumers` | query | org_admin | Ranked member list by meal count |
| `reports.getMealTypeBreakdown` | query | org_admin | Recurring vs Flexible % |
| `reports.getSkipRate` | query | org_admin | Skip % per slot per date range |
| `reports.getSavedReports` | query | org_admin | List saved report snapshots |
| `reports.saveReport` | mutation | org_admin | Snapshot current report |
| `reports.deleteReport` | mutation | org_admin | Remove saved report |

**Common input:**
```ts
z.object({
  startDate: z.string(),
  endDate: z.string(),
  mealSlotId: z.string().uuid().optional(),
})
```

---

## 6. View Specifications — Admin Role

> Access via `/dashboard?role=admin&tab=<tabname>`

### 6.1 Dashboard Overview Tab (`tab=dashboard`)

**Components:**
- `DashboardOverview.tsx` ← extracted, rendered inline
- 4 KPI cards: Today Confirmed / Skipped / Pending / Rate %
- Trend line chart (Mon–Fri, last 5 days)
- Confirmation breakdown donut (Recurring vs Flexible vs Pending)
- Recent activity feed

**Live API wiring needed:**
```ts
// Replace mock data with:
const dailyStats = trpc.meal.getDailyStats.useQuery({ date: todayStr });
```

### 6.2 Confirmations Tab (`tab=confirmations`)

**Components:**
- `ConfirmationsTab.tsx` ← extracted component
- `DateRangePicker` ← filters which day/range is shown ✅ Done
- Slot selector (Lunch / Dinner)
- Status filter (All / Confirmed / Pending / Skipped)
- Member list table with inline status toggle

**Live API wiring needed:**
```ts
// Currently uses mock confirmationsList state.
// Replace with:
const confirmations = trpc.meal.getConfirmations.useQuery({
  startDate: confirmDateRange.startDate,
  endDate: confirmDateRange.endDate,
});
```

### 6.3 Employees Tab (`tab=employees`)

**Components:**
- Member list table (avatar, name, email, dept, type, status)
- Add Employee modal (invite by email)
- Toggle active/inactive per row
- Toggle behavior type (recurring ↔ flexible)

**Live API wiring needed:**
```ts
const members = trpc.organization.getMembers.useQuery();
const inviteMember = trpc.organization.inviteMember.useMutation();
const deactivate = trpc.organization.deactivateMember.useMutation();
const toggleBehavior = trpc.organization.toggleMemberBehavior.useMutation();
```

### 6.4 Reports Tab (`tab=reports`)

**Components:**
- `DateRangePicker` (date range) ✅ Done
- Meal Slot selector
- Report Type selector (Daily / Weekly / Monthly)
- Bar chart — daily meal consumption
- Donut chart — meal type distribution
- Top Consumers leaderboard
- Saved Reports list

**Live API wiring needed:**
```ts
const barData = trpc.reports.getDailyConsumption.useQuery({
  startDate: reportsDateRange.startDate,
  endDate: reportsDateRange.endDate,
});
const topConsumers = trpc.reports.getTopConsumers.useQuery({
  startDate: reportsDateRange.startDate,
  endDate: reportsDateRange.endDate,
});
```

### 6.5 Billing Tab (`tab=billing`)

**Components:**
- `DateRangePicker` (billing period) ✅ Done
- 4 summary cards (Total Meals, Amount Due, Paid, Pending)
- Employee-wise meal table with inline adjustment inputs
- Generate Invoice button
- Export CSV button

**Live API wiring needed:**
```ts
const summary = trpc.billing.getEmployeeSummary.useQuery({
  startDate: billingDateRange.startDate,
  endDate: billingDateRange.endDate,
});
const generateInvoice = trpc.billing.generateInvoice.useMutation();
```

### 6.6 Settings Tab (`tab=settings`)

**Sub-tabs:** General | Meal Slots | Rules | Notifications | Billing Config | Roles | Integrations | Audit Log

| Sub-tab | Key Features |
|---------|-------------|
| General | Org name, timezone, date format, deadline |
| Meal Slots | CRUD for lunch/dinner/breakfast slots, price, capacity |
| Rules | Confirmation deadline, advance booking, auto-confirm |
| Notifications | Toggle per-event notifications, channels (email/SMS/in-app) |
| Billing Config | Cycle, invoice day, payment terms, tax rate, subsidy % |
| Roles | Manage member roles (promote/demote) |
| Audit Log | Full action log with date filter |

**All settings wired to:**
```ts
const updateSettings = trpc.organization.updateSettings.useMutation();
const createSlot = trpc.organization.createSlot.useMutation();
const updateSlot = trpc.organization.updateSlot.useMutation();
const deleteSlot = trpc.organization.deleteSlot.useMutation();
```

---

## 7. View Specifications — Employee Role

> Access via `/dashboard?role=employee`

### 7.1 Employee Portal

**Sections:**
| Section | Description |
|---------|-------------|
| Greeting + My Meals | Today & Tomorrow RSVP cards |
| Alert Banner | Pending confirmation warning |
| Meal History Table | Last 30 days with status badges |
| Monthly Summary | Totals card + progress bar |

**Live API wiring needed:**
```ts
const myConfirmations = trpc.meal.getConfirmations.useQuery({
  startDate: monthStart,
  endDate: todayStr,
});
const confirmMeal = trpc.meal.confirmMeal.useMutation();
```

**Navigation:**
- No sidebar — simplified top nav with logout
- Meal history uses `DateRangePicker` to filter past confirmations (to implement)

---

## 8. Shared Components

| Component | Path | Status |
|-----------|------|--------|
| `DateRangePicker` | `dashboard/components/DateRangePicker.tsx` | ✅ Done |
| `DashboardOverview` | `dashboard/components/DashboardOverview.tsx` | ✅ Done |
| `ConfirmationsTab` | `dashboard/components/ConfirmationsTab.tsx` | ✅ Done |
| `DashboardClient` | `dashboard/components/DashboardClient.tsx` | ✅ Done |
| `LoadingSpinner` | `components/shared/LoadingSpinner.tsx` | ⬜ Needed |
| `ToastNotification` | `components/shared/Toast.tsx` | ⬜ Extract from DashboardClient |
| `StatusBadge` | `components/shared/StatusBadge.tsx` | ⬜ Needed |
| `ConfirmModal` | `components/shared/ConfirmModal.tsx` | ⬜ Needed |
| `EmptyState` | `components/shared/EmptyState.tsx` | ⬜ Needed |
| `DataTable` | `components/shared/DataTable.tsx` | ⬜ Needed |

---

## 9. Date Filter System

### Component: `DateRangePicker`

**Path:** `src/app/dashboard/components/DateRangePicker.tsx`  
**Status:** ✅ Implemented

**Presets:**
| Label | Range |
|-------|-------|
| Today | `startDate = endDate = today` |
| Yesterday | `startDate = endDate = yesterday` |
| This Week | `startDate = Mon of current week, endDate = today` |
| Last Week | `startDate = Mon of prev week, endDate = Sun of prev week` |
| This Month | `startDate = 1st of current month, endDate = today` |
| Last Month | `startDate = 1st of prev month, endDate = last day of prev month` |
| Custom Range | Two date inputs with Apply button |

### Date Filter Usage by Tab

| Tab | State Variable | Default |
|-----|---------------|---------|
| Confirmations | `confirmDateRange` | Today |
| Reports | `reportsDateRange` | This Month |
| Billing | `billingDateRange` | This Month |
| Employee Meal History | *(to implement)* | This Month |

---

## 10. Pages & Routes Map

```
/                          → Public landing page
/login                     → Login page (Supabase email/password)
/register                  → Register org + admin account
/forgot-password           → [TO CREATE] Password reset
/dashboard                 → Main dashboard (admin or employee view based on DB role)
  ?role=admin              → Admin console
  ?role=employee           → Employee portal
  ?tab=dashboard           → Admin: Overview
  ?tab=confirmations       → Admin: Meal Confirmations
  ?tab=employees           → Admin: Employee Management
  ?tab=reports             → Admin: Reports & Analytics
  ?tab=billing             → Admin: Billing & Invoices
  ?tab=settings            → Admin: Settings (with sub-tabs)
/admin                     → Super admin panel (all orgs)
```

---

## 11. Implementation Task Checklist

### Phase 1: Foundation (Done)
- [x] Project scaffolding (Next.js 14 + Drizzle + Supabase)
- [x] Database schema (all 17 tables)
- [x] tRPC setup (`organization.*` and `meal.*` routers)
- [x] Auth middleware (protect `/dashboard`, `/admin`)
- [x] Login page (functional)
- [x] Dashboard page → isolated `DashboardClient.tsx` + Suspense shell
- [x] DashboardOverview component extracted
- [x] ConfirmationsTab component extracted
- [x] URL-based tab/role state (survives reload)
- [x] Date range picker component (DateRangePicker.tsx)
- [x] Date filter wired into: Confirmations, Reports, Billing tabs

### Phase 2: Auth UX (Priority)
- [ ] Register page — wire to `organization.register` tRPC mutation
- [ ] Show error/success messages on register
- [ ] Auto-redirect logged-in users from `/login` → `/dashboard`
- [ ] Forgot password page (`/forgot-password`) using Supabase resetPasswordForEmail
- [ ] Post-login role detection: set `?role=admin` or `?role=employee` from DB profile
- [ ] Session expiry handling (redirect to `/login` gracefully)

### Phase 3: Live Data Wiring
- [ ] Confirmations tab → replace mock list with `trpc.meal.getConfirmations`
- [ ] Dashboard overview → replace mocks with `trpc.meal.getDailyStats`
- [ ] Employee list → replace mock with `trpc.organization.getMembers`
- [ ] Employee portal meals → replace mock with `trpc.meal.getConfirmations`
- [ ] Settings → fully wire all mutation forms to tRPC

### Phase 4: Billing Router
- [ ] Implement `billing.getEmployeeSummary` (query with date range)
- [ ] Implement `billing.generateInvoice` (create billing snapshot + invoice row)
- [ ] Implement `billing.addAdjustment`
- [ ] Implement `billing.markPaid`
- [ ] Implement `billing.exportCSV` (generate signed download URL)
- [ ] Wire billing tab UI to live API

### Phase 5: Reports Router
- [ ] Implement `reports.getDailyConsumption`
- [ ] Implement `reports.getTopConsumers`
- [ ] Implement `reports.getMealTypeBreakdown`
- [ ] Implement `reports.getSkipRate`
- [ ] Wire reports tab charts to live API
- [ ] Saved reports CRUD (save/list/delete)

### Phase 6: Employee Portal Enhancements
- [ ] Recurring meal preference form (day × slot grid)
- [ ] Employee meal history with DateRangePicker filter
- [ ] Employee leave request form
- [ ] Upcoming meals for next 7 days view
- [ ] Profile page (`/profile`) — update name, phone, behavior type

### Phase 7: Settings
- [ ] General settings — save org name, timezone, billing email
- [ ] Meal slots management — full CRUD UI with live sync
- [ ] Departments CRUD
- [ ] Office Locations CRUD
- [ ] Holiday calendar management
- [ ] Member leave management
- [ ] Notification preference toggles (store in org settings JSON)
- [ ] Audit log tab — live feed from `logs` table with date filter

### Phase 8: Super Admin Panel (`/admin`)
- [ ] All organizations list with approval status
- [ ] Approve/reject org registration
- [ ] Kitchen dashboard — all-org confirmed counts for today
- [ ] Global member search

### Phase 9: Polish & Production
- [ ] Extract `ToastNotification` into reusable component
- [ ] Extract `StatusBadge` component
- [ ] Extract `ConfirmModal` component
- [ ] Add `EmptyState` for tables with no data
- [ ] Loading skeletons for all data-fetched sections
- [ ] Error boundaries per tab
- [ ] Mobile responsive: hamburger sidebar on mobile
- [ ] SEO meta tags on all pages
- [ ] Environment variable validation on startup
- [ ] Rate limiting on tRPC mutations
- [ ] Email delivery (Resend / SendGrid) for invitations

---

## 12. Verification Plan

### Automated Checks
```bash
# TypeScript — run after every change
cd "Premium Catering Service"
./node_modules/.bin/tsc --noEmit

# Build check (catches tree-shaking errors)
npm run build

# DB migration dry-run
npx drizzle-kit push:pg --dry-run
```

### Manual Test Scenarios

#### Auth
- [ ] Register new org → see dashboard as admin
- [ ] Login as invited employee → see employee portal only
- [ ] Logout and verify redirect to `/login`
- [ ] Reload on `/dashboard?tab=confirmations` → stays on confirmations tab ✅
- [ ] Reload on `/dashboard?tab=reports` → stays on reports tab ✅

#### Admin — Confirmations
- [ ] Select "Today" preset → shows today's list
- [ ] Select "This Week" → shows date range banner
- [ ] Override a pending meal → status changes immediately
- [ ] Bulk confirm all pending → all turn Confirmed

#### Admin — Reports
- [ ] Select "Last Month" preset → charts update labels
- [ ] Select custom range → bar chart reflects custom period

#### Admin — Billing
- [ ] Change billing period with picker → "Showing: X – Y" label updates
- [ ] Enter adjustment on employee row → Final Amount recalculates
- [ ] Click "Generate Invoice" → toast appears

#### Employee Portal
- [ ] Click "Confirm" on today's meal → button turns green
- [ ] Click "Skip" → button turns red + badge updates
- [ ] Meal history table shows last month's records

---

*Last updated: 2026-06-01 · Maintained by the development team*
