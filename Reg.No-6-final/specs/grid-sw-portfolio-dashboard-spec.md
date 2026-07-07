# Grid SW Project Portfolio Dashboard — Functional Specification

## 1) Objective
Build a simple web application to digitize management of the Grid SW project portfolio using data from Excel sheet **"Program 2026"**.

## 2) Scope (Phase 1)
- Import portfolio records from the Excel source (sheet: `Program 2026`).
- Persist normalized data in JSON datastore.
- Render an interactive dashboard with grouping, filtering, and charts.
- Replicate workbook validations in app-level validations.

## 3) Architecture and Constraints
### 3.1 Mandatory Principles
- Business logic must live in `/services` layer.
- JSON is the datastore.
- No hardcoded API endpoints; endpoints/config must come from environment variables (`process.env` equivalent runtime config).
- Brand colors must follow `2025_GEVernova_BrandGuidelines_Color.pdf` only.

### 3.2 Proposed Layering
- `/services`
  - `ingestionService`: read/transform Excel sheet to JSON model.
  - `validationService`: enforce extracted + explicit business rules.
  - `portfolioService`: query/filter/group/summarize records.
  - `chartService`: compute chart-ready aggregates.
- `/data`
  - `portfolio.json` (primary records)
  - `validations.json` (validation metadata extracted from Excel)
  - `lookups.json` (LOVs such as DT Team accountable leaders)

## 4) Data Source and Ingestion
### 4.1 Source
- Excel file (user-provided), worksheet: `Program 2026`.

### 4.2 Ingestion Rules
- Read only used rows in `Program 2026`.
- Normalize headers to exact dashboard column names.
- Preserve date fidelity for `Estd. End Date` (ISO date in store).
- Convert blank cells to `null`.
- Maintain a stable `project_id` (hash of key fields or source row id).

## 5) Dashboard Columns (Display Contract)
The dashboard must expose these columns exactly:
1. `Project Status`
2. `Project Name`
3. `Description`
4. `DT Team Accountable`
5. `OTD Status`
6. `State`
7. `Phase`
8. `Estd. End Date`
9. `Category`
10. `Business Unit`
11. `Primary Function`
12. `Region`
13. `Executive Sponsor`
14. `2026 budget & benefits`
15. `DT Teams Involved & Lead`
16. `Level of Effort`
17. `Technology`
18. `Budget`
19. `Audit Trail`

## 6) Grouping and Row Behavior
1. Group rows by `Initiative Name`.
2. Group title format: `(<project_count>) <Initiative Name>`.
3. Each group behaves as accordion row:
   - Expanded: all projects under initiative visible.
   - Collapsed: all child projects hidden.
4. Global controls:
   - `Expand All`
   - `Collapse All`
5. Default state on initial load: all groups expanded.

## 7) Description Truncation / Expansion
- `Description` cell is truncated with ellipsis when above threshold.
- Clicking ellipsis or toggle expands text inline (same row).
- Clicking again collapses.
- Expansion state does not break current filters/group state.

## 8) Multi-Filter Requirements
- Each column supports multi-select filtering.
- Filters are combinational (`AND` across columns, `OR` within selected values in same column).
- Filtered result updates in real time:
  - group counts,
  - visible rows,
  - chart aggregates.

## 9) Charting Requirements
Use a best-fit mix of charts with live updates from filtered dataset:
- Bar chart: projects by `Project Status`.
- Pie chart: projects by `Category` (or `Business Unit` if higher signal).
- Line chart: trend by `Estd. End Date` month/quarter.
- Optional stacked bar: `Region` by `Project Status`.

## 10) Special Column Display Rules

### 10.1 Project Status (with inline Update button)
Display `Project Status` value with an "Update" button:
- **Display:** Show current project status value (G, A, or R)
- **Update Button:**
  - Visible on row hover only (hidden by default)
  - Clicking opens an inline status selector or modal
  - User can select new status (G, A, R) and confirm
  - On confirm, status is updated and audit trail entry is created
  - Button disappears after successful update or user cancels

### 10.2 DT Team Accountable (2-line display)
Display `DT Team Accountable` as two lines:
- Line 1: source value from `DT Team Accountable` field.
- Line 2: leader from LOV mapping:
  - `Data & AI` → `Minal <MINAL.Merchant@gevernova.com>`
  - `Enterprise Applications` → `Karthik <AnilKumar.Karthik@gevernova.com>`
  - `Technology Enablement & Transformation` → `Taufan <Taufan.Tjioe@gevernova.com>`
  - `Product Tech Solutions & Operations` → `Steven <stevensmith@gevernova.com>`

If no match in LOV, show `Leader Not Mapped`.

### 10.3 OTD Status (single-line display with color-coded background)
Display `OTD Status` as a single value with full-cell background color:
- **Background Color** (based on `OTD Status` value):
  - `On-Track` → **Green** (GE Vernova brand green from guideline PDF)
  - `Adjusted Plan` → **Orange** (GE Vernova brand orange from guideline PDF)
  - `Slip` → **Red** (GE Vernova brand red from guideline PDF)

### 10.4 State (single-line display with full-cell color)
Display `State` in its own column with full-cell color based on value.

### 10.5 Phase (single-line display with full-cell color)
Display `Phase` in its own column with full-cell color based on value.

### 10.6 Estd. End Date (2-line display with conditional grey color)
Display `Estd. End Date` as two lines:
- **Line 1:** `Adjusted End Date` (if available)
  - If `Adjusted End Date` exists, display it on Line 1.
  - When `Adjusted End Date` is shown, apply **grey color** to Line 2.
- **Line 2:** `Estd. End Date` (always shown)
  - If no `Adjusted End Date` exists, Line 2 displays in default/normal color.
  - If `Adjusted End Date` exists, Line 2 displays in grey to indicate it has been superseded.

### 10.7 2026 budget & benefits (2-line display with status colors)
Display `2026 budget & benefits` as two lines:
- **Line 1:** value in `2026 budget?`
  - `Y` → **Green**
  - `N` → **Red**
- **Line 2:** value in `2026 Benefits Plan`
  - `Y` → **Green**
  - `N` → **Red**
  - if source contains other values such as `N/A`, display the literal source value with default text color unless a separate rule is approved.

### 10.8 DT Teams Involved & Lead (3-line display)
Display `DT Teams Involved & Lead` as three lines:
- **Line 1:** value in `DT Teams Involved`
- **Line 2:** `DT Lead: ` prefixed with value in `DT lead`
- **Line 3:** `Business Project Lead: ` prefixed with value in `Business Project Lead`

### 10.9 Audit Trail (expandable list with View All modal)
Display `Audit Trail` as a condensed list:
- **Display:** Show the most recent 1–2 audit entries (latest timestamp first)
  - Each entry shows: `<field_name> changed from '<old_value>' to '<new_value>' by <user> on <timestamp>`
- **If 1 entry:** Display in full in the cell
- **If 2+ entries:** Display most recent 1–2 entries with truncation, followed by "View All" button
- **View All Button:**
  - Clicking opens a modal dialog
  - Modal displays complete audit trail for that project in newest-first order by default
  - Modal includes a user filter/toggle to switch sort order to oldest-first
  - Each entry includes: field name, old value, new value, user who made change, timestamp (ISO format)
  - Modal has close button
- **Audit Trail Tracking:**
  - All field updates logged with before/after values
  - Project creation (initial insert) logged as first entry
  - User context and timestamp always captured
  - System-generated updates (OTD Status, Adjusted End Date, etc.) noted as "System"

### 10.10 Default rule for all other dashboard columns
For every dashboard column that does not have an explicit visual/display rule above:
- show the value exactly as sourced from Excel,
- keep a 1:1 mapping with the Excel column of the same name,
- apply no additional line splitting, prefixes, suffixes, badges, or color formatting.

## 11) Validation Replication (Excel parity)
### 11.1 Validation Types to Replicate
- Required fields
- List/dropdown constraints
- Date constraints
- Numeric range/format constraints
- Text length constraints

### 11.2 Validation Source
- Parse workbook data validation rules from `Program 2026`.
- Persist extracted rules in `data/validations.json`.
- Enforce:
  - at import time,
  - on manual edits (if edit feature enabled).

### 11.3 Validation UX
- Invalid fields highlighted inline.
- Error messages should identify field + violated rule.
- Invalid records excluded from published dashboard until resolved (or shown with warning flag based on mode).

## 12) JSON Data Contracts
### 12.1 Project Record (example shape)
```json
{
  "project_id": "PRJ-0001",
  "initiative_name": "Grid Reliability",
  "project_status": "On Track",
  "project_name": "Substation Telemetry Upgrade",
  "description": "...",
  "dt_team_accountable": "Data & AI",
  "project_otd_status": "On-Track",
  "project_otd_state": "On-Track",
  "project_otd_phase": "Build",
  "estd_end_date": "2026-09-30",
  "adjusted_end_date": "2026-10-15",
  "category": "Digital",
  "business_unit": "Grid Solutions",
  "primary_function": "Operations",
  "region": "NAM",
  "executive_sponsor": "...",
  "budget_2026_flag": "Y",
  "benefits_plan_2026": "N",
  "dt_teams_involved": "Enterprise Applications",
  "dt_lead": "Seshu Kilaru",
  "business_project_lead": "Tucker King",
  "level_of_effort": "L",
  "technology": "Azure",
  "budget": 1200000
}
```

### 12.2 LOV Contract (example)
```json
{
  "dt_team_accountable_leaders": {
    "Data & AI": "Minal <MINAL.Merchant@gevernova.com>",
    "Enterprise Applications": "Karthik <AnilKumar.Karthik@gevernova.com>",
    "Technology Enablement & Transformation": "Taufan <Taufan.Tjioe@gevernova.com>",
    "Product Tech Solutions & Operations": "Steven <stevensmith@gevernova.com>"
  }
}
```

## 13) API/Config Requirements
- Endpoint URLs must be runtime-configured by environment variables.
- No endpoint strings hardcoded in client code.
- Environment/config variables documented in README.

## 14) Acceptance Criteria
1. App can ingest `Program 2026` worksheet and store normalized JSON.
2. Dashboard renders all required columns exactly.
3. Grouping by `Initiative Name` works with per-group accordion.
4. `Expand All` / `Collapse All` works for all groups.
5. `Description` truncates with ellipsis and expands inline on click.
6. Multi-filter works for every column.
7. Charts update immediately to match current filter set.
8. DT Team Accountable renders with leader on second line per LOV mapping.
9. Excel validation rules are replicated and enforced.
10. Branding colors are compliant with GE Vernova guideline document.

## 15) Open Items / Inputs Needed
1. Provide the Excel workbook containing sheet `Program 2026`.
2. Confirm target framework for UI (Flask templates vs React front-end).
3. Confirm approved brand color tokens/hex values from the guideline PDF for implementation.
4. Confirm behavior for invalid imported rows:
   - reject import,
   - partial import with error report,
   - import with warning state.
5. Confirm preferred default chart set if multiple are equally valid.

## 16) Add Project Page (Form)

### 16.1 Overview
The Add Project page allows users to create new projects in the portfolio with a structured form. All fields follow the datasheet column ordering. Form includes required fields, optional fields, conditional visibility, defaults, and comprehensive validation.

### 16.2 Form Sections and Field Organization
Fields are organized in sections below, in datasheet order:

#### Section 1: Basic Information
- **Project Name** (required) – 1–255 chars
- **Initiative Name** (required) – 1–255 chars  
- **Description** (optional) – 0–2000 chars

#### Section 2: Status & Phase
- **OTD Status** (system-generated) – Default: "On-Track" – Enum: On-Track, Adjusted Plan, Slip
  - Value is `null` when `State` = `Funnel` | `Evaluation` | `Hold`
- **State** (required) – Default: "Evaluation" – Enum: Funnel, Evaluation, Hold, Active, Closure
- **Phase** (defaulted) – Default: "Discovery" – Enum: Discovery, Initiate, Plan, Build, Deploy, Verify, Post-Launch, Close
  - Optional when `State` = `Funnel`
- **Project Status** (optional) – Enum: G, A, R
  - Value is blank (`""`) when `State` = `Funnel` | `Evaluation` | `Hold` | `Closure`

#### Section 3: Classification & Organization
- **DT Team Accountable** (required) – LOV from data: Data & AI, Enterprise Applications, Technology Enablement & Transformation, Product Tech Solutions & Operations
- **Category** (conditional required if State = "Funnel") – LOV: MustDo, Strategic/LTGrowth, Digital
- **Business Unit** (optional) – LOV: All, Grid, PERS
- **Primary Function** (optional) – LOV: All, Operations, Customer Success, Finance, M&A, DT
- **Region** (optional) – LOV: Global, NAM, EMEA, APAC

#### Section 4: Scheduling
- **Estd. End Date** (optional) – Date field, future dates only, format YYYY-MM-DD
- **Adjusted End Date** (conditional field) – Default: blank (`""`)
  - Visible only when `OTD Status` = `Adjusted Plan`
  - Required when visible
  - Allowed values: current date or future date only

#### Section 5: Stakeholders
- **Executive Sponsor** (optional) – 0–255 chars
- **DT Teams Involved** (optional) – 0–500 chars
- **DT Lead** (optional) – 0–255 chars
- **Business Project Lead** (optional) – 0–255 chars

#### Section 6: Effort & Resources
- **Level of Effort** (optional) – LOV: S, M, L, XL, Small, Medium, Large, XLarge
- **Technology** (optional) – 0–255 chars
- **Budget** (optional) – Non-negative number

#### Section 7: Financial Planning
- **2026 Budget?** (optional) – Enum: Y, N, N/A
- **2026 Benefits Plan** (optional) – Enum: Y, N, N/A

#### Section 8: Filtering & Search (System)
- **For Filter Purposes** (system-generated, read-only) – Auto-concatenated from DT Team Accountable + Primary Function

### 16.3 Required vs. Optional Fields
**Required (user must provide):**
1. Project Name
2. Initiative Name
3. DT Team Accountable
4. State (with default "Evaluation")
5. Phase (with default "Discovery")

**Conditionally Required:**
- Category: required if State = "Funnel"; otherwise optional

**Optional (can be left blank):**
- Description
- Estd. End Date
- Business Unit
- Primary Function
- Region
- Executive Sponsor
- 2026 Budget?
- 2026 Benefits Plan
- DT Teams Involved
- DT Lead
- Business Project Lead
- Level of Effort
- Technology
- Budget
- Project Status
- Adjusted End Date (unless `OTD Status` = `Adjusted Plan`)

### 16.4 Field Defaults
- **OTD Status:** "On-Track" (system-generated)
  - forced to `null` when `State` = `Funnel` | `Evaluation` | `Hold`
- **State:** "Evaluation"
- **Phase:** "Discovery"
- **Project Status:** blank (`""`) when `State` = `Funnel` | `Evaluation` | `Hold` | `Closure`
- **Adjusted End Date:** blank (`""`) until required by `OTD Status` = `Adjusted Plan`

### 16.5 Validation Rules

#### Text Validation
- Project Name: 1–255 characters, required
- Initiative Name: 1–255 characters, required
- Description: 0–2000 characters, optional
- Executive Sponsor: 0–255 characters, optional
- DT Teams Involved: 0–500 characters, optional
- DT Lead: 0–255 characters, optional
- Business Project Lead: 0–255 characters, optional
- Technology: 0–255 characters, optional

#### Date Validation
- **Estd. End Date:** must be a valid future date in format YYYY-MM-DD
- **Adjusted End Date:** must be a valid date; if both dates provided, Adjusted End Date ≥ Estd. End Date
- **Adjusted End Date Required Rule:** must be provided when `OTD Status` = `Adjusted Plan`
- **Adjusted End Date Range Rule:** when provided, must be current date or future date (not past)
- **Format:** YYYY-MM-DD

#### Enum Validation
- **State:** must match one of: Funnel, Evaluation, Hold, Active, Closure
- **OTD Status:** must match one of: On-Track, Adjusted Plan, Slip
- **Phase:** must match one of: Discovery, Initiate, Plan, Build, Deploy, Verify, Post-Launch, Close
- **DT Team Accountable:** must match one of: Data & AI, Enterprise Applications, Technology Enablement & Transformation, Product Tech Solutions & Operations
- **Category:** must match one of: MustDo, Strategic/LTGrowth, Digital
- **Business Unit:** must match one of: All, Grid, PERS
- **Primary Function:** must match one of: All, Operations, Customer Success, Finance, M&A, DT
- **Region:** must match one of: Global, NAM, EMEA, APAC
- **Level of Effort:** must match one of: S, M, L, XL, Small, Medium, Large, XLarge
- **2026 Budget?:** must match one of: Y, N, N/A
- **2026 Benefits Plan:** must match one of: Y, N, N/A
- **Project Status:** must match one of: G, A, R

#### Numeric Validation
- **Budget:** must be a non-negative number (≥ 0)

#### Cross-Field Rules
- **Conditional Category:** If State = "Funnel", Category is required
- **Date Ordering:** If both Estd. End Date and Adjusted End Date are provided, Adjusted End Date must be ≥ Estd. End Date
- **Project Status State Rule:** Project Status must be blank when State = `Funnel` | `Evaluation` | `Hold` | `Closure`
- **OTD Status State Rule:** OTD Status must be null when State = `Funnel` | `Evaluation` | `Hold`
- **Phase State Rule:** Phase is optional only when State = `Funnel`
- **Adjusted End Date Visibility Rule:** Adjusted End Date is visible and required only when OTD Status = `Adjusted Plan`

#### System-Generated Fields
- **OTD Status:** Always set to "On-Track" on project creation
- **Adjusted End Date:** Always set to blank (`""`) on creation; updated later if needed
- **Filter Key:** Auto-populated as concatenation of DT Team Accountable + Primary Function; used for internal filtering

### 16.6 Form Submission & Response

#### Success Response
- Project created with unique project_id (e.g., PRJ-XXXXXXXX)
- Timestamps set: created_at, updated_at (ISO format)
- Project record persisted to data/portfolio.json
- User redirected to project detail view or dashboard

#### Error Response
- List of validation errors with field name and error message
- Form remains pre-populated with user input (except system fields)
- User can correct and resubmit

### 16.7 Data Persistence
- All submitted projects stored in JSON format in `data/portfolio.json`
- Each project record includes all normalized fields plus metadata (project_id, created_at, updated_at)

## 17) Next Step (after input file is shared)
- Implement ingestion + validation extraction service.
- Generate `portfolio.json` and `validations.json`.
- Build dashboard UI with grouping, filters, and live charts.
- Build Add Project form UI and API endpoints.

## 18) Additional Requirements

### 18.1 Test User with Admin Permissions + Login Page
- Create a seeded user account:
  - **Username:** `TestUser`
  - **Role:** `Admin`
  - **Permissions:** full create/update/read + **delete project** rights
- Credentials should be seeded but loaded from environment variables to allow future change.
- Only `Admin` role is required for current scope.
- Add login page with Basic Auth flow and server-side session handling.
- Store user role/permissions in JSON datastore and enforce authorization checks server-side.
- Delete project action must be visible/enabled only for authorized admin users.

### 18.2 Duplicate Project Detection on Add Project
- On Add Project submission, system must detect duplicates before save.
- Duplicate check keys (minimum):
  - `Project Name` + `Initiative Name`
  - comparison is case-insensitive and ignores extra spaces
- If duplicate found:
  - block insert,
  - show user-friendly duplicate warning when user clicks Add Project,
  - provide reference to existing project id/name.

### 18.3 Monthly Reminder Notification (Every 4th Week)
- App must trigger reminder notifications to DT owners every 28 days from month start.
- Recipient source:
  - `DT Team Accountable` mapped to accountable leader/owner lookup.
- Notification channel: Email.
- Notification message requests project status update.
- Log all reminders in JSON notification log with timestamp, recipient, project, status.

### 18.4 Robust Global Search with Suggestions
- Add global search that works across dashboard data.
- Search scope must include at minimum:
  - Initiative Name,
  - Project Name,
  - Description,
  - DT Team Accountable,
  - State,
  - Phase,
  - Category,
  - Region,
  - Executive Sponsor.
- Provide live suggestions while typing (typeahead/autocomplete).
- Matching must support partial/fuzzy search.
- Suggestions list is a flat list (not grouped by field).
- Max suggestions per keystroke: 6.

### 18.5 Proactive Breach Notifications
- If project is approaching or breaching deadline, proactive notifications must be sent to DT Team Accountable Leader.
- Deadline logic:
  - use `Adjusted End Date` when available,
  - else use `Estd. End Date`.
- Notification channel: Email.
- Warning threshold: 28 days before deadline.
- Proactive reminder cadence during warning window: every 5 days.
- Minimum alert stages:
  - warning threshold (pre-breach),
  - breach threshold (past deadline).
- Log alerts in JSON notification log with reason and trigger date.

### 18.6 Variable Pagination in Dashboard
- Implement pagination controls with variable page size `N`.
- Allowed page sizes:
  - 10, 20, 30, ..., 100
- Default page size = 10.
- Pagination applies after filters/search are applied.
- If grouped view is active, paginate by initiative groups.
- If flat list view is active, paginate by project rows.
- Page size selection does not need to persist across sessions.
- Group/accordion behavior must remain consistent when paginated.

## 19) Clarifications Finalized (June 8, 2026)
- Access/Login:
  - Seeded `TestUser` with env-configurable credentials.
  - Admin-only role for current release.
  - Basic Auth with server-side session handling.
- Duplicate policy:
  - Hard-block duplicates on `Project Name` + `Initiative Name`.
  - Matching ignores case and extra spaces.
- Status/phase rules:
  - `Project Status` shown blank for `Funnel|Evaluation|Hold|Closure`.
  - `OTD Status` null for `Funnel|Evaluation|Hold`.
  - `Phase` optional only for `Funnel`.
  - `Adjusted End Date` visible/required for `Adjusted Plan`; date must be today or future.
- Notifications:
  - Email channel.
  - Monthly status reminder: every 28 days from month start.
  - Deadline warning: 28-day threshold with proactive reminder every 5 days.
- Search:
  - Partial/fuzzy search with flat suggestion list.
  - Max 6 suggestions.
- Pagination:
  - Grouped view paginates groups; flat view paginates rows.
  - Page-size persistence not required.
- Audit trail:
  - Permanent retention.
  - View All default newest-first with user sort toggle to oldest-first.

## 20) Implementation Plan (/speckit.plan)

### 20.1 Chosen Tech Stack
- Backend: Python + Flask
- Frontend: Flask templates + HTML/CSS + Vanilla JavaScript
- Charts: Chart.js (bar, pie, line)
- Datastore: JSON files under `data/`
- Excel ingestion: `openpyxl`
- Auth: Basic Auth + server-side session handling

### 20.2 Data Bootstrap Strategy (Dummy Data from Excel)
- Source workbook: `data/Worksheet PMO App Hackathon  1 1.xlsx`
- Source sheet: `Program 2026`
- Bootstrap file to be used for development/testing dashboard:
  - `data/portfolio_dummy.json`
- Dummy records are sampled from real rows in the provided Excel sheet and normalized to app field names.

### 20.3 Planned JSON Stores
- `data/portfolio.json` → primary working dataset (created/updated projects)
- `data/portfolio_dummy.json` → initial seed for development and demos
- `data/audit_log.json` → immutable audit events
- `data/notification_log.json` → reminders and breach alerts
- `data/users.json` → seeded `TestUser` admin account metadata

### 20.4 Delivery Phases

#### Phase 1 — Core App Skeleton
1. Initialize Flask app structure:
  - `/services` for business logic
  - `/templates` for pages
  - `/static` for JS/CSS
2. Add environment-driven config for credentials and runtime settings.
3. Add login page and admin-only delete authorization gates.

#### Phase 2 — Data and Services
1. Build ingestion/normalization service for Excel-to-JSON.
2. Load `portfolio_dummy.json` by default when `portfolio.json` is absent.
3. Implement duplicate detection:
  - key = normalized (`Project Name`, `Initiative Name`)
  - case-insensitive, trim-insensitive, hard-block insert.

#### Phase 3 — Dashboard UI
1. Render grouped accordion dashboard by Initiative Name.
2. Add per-column multi-filters with real-time updates.
3. Add global fuzzy search with max 6 flat suggestions.
4. Add variable pagination (10..100 step 10), after filters/search.
5. Add charts (status/category/date trend) bound to filtered dataset.

#### Phase 4 — Add Project + Status Dialog
1. Implement Add Project form with required/default/conditional rules.
2. Implement status update dialog launched from hover `Update` button.
3. Enforce state-driven behavior:
  - `Project Status` blank for `Funnel|Evaluation|Hold|Closure`
  - `OTD Status` null for `Funnel|Evaluation|Hold`
  - `Phase` optional for `Funnel`
  - `Adjusted End Date` visible+required only for `Adjusted Plan`

#### Phase 5 — Audit Trail + Notifications
1. Log create/update/delete/system changes to `audit_log.json`.
2. Implement Audit Trail cell + `View All` modal (newest first + sort toggle).
3. Add scheduled notifications:
  - monthly reminder every 28 days from month start,
  - proactive deadline notifications 28 days pre-deadline, repeated every 5 days,
  - breach alerts after deadline.
4. Send notifications via email channel and write to `notification_log.json`.

### 20.5 Acceptance Checkpoints
- Login works for env-configured `TestUser` admin.
- Duplicate prevention blocks inserts and shows clear message.
- Dashboard renders all required columns including Audit Trail.
- Search suggestions (6 max) and pagination behavior match clarified rules.
- Status dialog and Add Project validations match finalized state logic.
- Audit and notification logs are produced for all required events.