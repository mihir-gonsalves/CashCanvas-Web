# CashCanvas-Web

## Project Overview

**Pure client-side personal expense tracker** using sessionStorage for ephemeral data persistence, deployable to Vercel as a static site. Based on CashCanvas.

### Migration Goals
1. ✅ **Eliminate backend** - All logic moved to browser
2. ✅ **Zero hosting costs** - Deploy as static site to Vercel
3. ✅ **Instant demo** - Recruiters can load data instantaneously
4. ✅ **Preserve functionality** - Same features, different persistence layer
5. ✅ **Maintain data contracts** - Keep existing component interfaces intact
6. ✅ **Ephemeral data** - Data clears on tab close (browser warns on navigation)

### Core User Workflow
1. Download CSVs from financial institutions
2. Upload via web app (stores in sessionStorage)
3. View/edit/delete transactions in paginated table
4. Visualize spending with charts and analytics
5. Apply filters consistently across all views
6. Export transactions to CSV (respects active filters)
7. **Data is lost when tab closes** - Browser prompts user to save changes

### Key Architectural Shift
```
BEFORE: React → API (FastAPI) → SQLite
AFTER:  React → sessionStorage Wrapper → sessionStorage
```

---

## Architecture Overview

### What Was Replaced

| Component | Old (Backend) | New (Client-Side) |
|-----------|---------------|-------------------|
| **Database** | SQLite file | sessionStorage (per-tab) |
| **ORM** | SQLAlchemy | Simple JSON wrapper |
| **CSV Parsing** | Python parsers | Browser `papaparse` |
| **Aggregations** | SQL GROUP BY | JavaScript reduce/map |
| **API Layer** | FastAPI endpoints | sessionStorage operations |
| **Validation** | Pydantic schemas | Zod schemas |
| **Persistence** | File-based (permanent) | Tab-scoped (ephemeral) |

### What Was Preserved

- **Frontend components** - Zero changes to UI components
- **Tanstack Query** - Still manages state (now "sessionStorage state")
- **Filter system** - Same filter logic, applied client-side
- **Data contracts** - Types remain identical for components
- **Enrichment pattern** - Still join transactions with metadata
- **All features** - CRUD, CSV upload, analytics, filtering, export

---

## File Structure

```
frontend/src/
├── lib/                        # Client-side logic
│   ├── db/
│   │   ├── schema.ts           # TypeScript types (kept for reference)
│   │   ├── database.ts         # sessionStorage wrapper (FINAL)
│   │   ├── indexeddb.ts        # IndexedDB implementation (UNUSED - available for forking)
│   │   └── index.ts            # Barrel export
│   ├── csv/
│   │   ├── parsers.ts          # CSV parsing with Zod validation
│   │   └── index.ts
│   └── demo/
│       ├── generator.ts        # Demo data generation
│       └── index.ts
├── api/
│   └── client.ts               # Calls sessionStorage wrapper
├── types/
│   └── index.ts                # UNCHANGED
├── hooks/                      # UNCHANGED (still use Tanstack Query)
│   ├── useTransactions.ts
│   ├── useAnalytics.ts
│   ├── useUnsavedWarning.ts    # NEW - Browser close warning hook
│   ├── useLoadDemo.ts          # NEW - Demo data mutation hook
│   └── ...
├── components/                 # UNCHANGED
│   ├── charts/             
│   ├── layout/
│   │   ├── AppHeader.tsx       # Added "Try Demo" button
│   │   └── ...
│   ├── filters/
│   ├── transactions/
│   └── upload/
├── utils/                      # UNCHANGED
│   ├── formatters.ts
│   ├── enrichment.ts
│   ├── errors.ts
│   ├── exportUtils.ts
│   └── chartHelpers.ts
├── App.tsx                     # MODIFIED - Added browser warning when closing tab
└── main.tsx                    # UNCHANGED
```

**Key Points**: 
- Only `api/client.ts`, `lib/` directory, and `AppHeader.tsx` changed
- All UI components remain identical
- IndexedDB implementation preserved in `lib/db/indexeddb.ts` for reference/forking

---

## sessionStorage Implementation

### Why sessionStorage Instead of IndexedDB?

**Benefits:**
1. **Simpler implementation** - No async complexity, no schema migrations
2. **Ephemeral by design** - Data clears on tab close (aligns with demo use case)
3. **Browser warnings** - Browser automatically prompts "unsaved changes" on navigation
4. **Perfect for demos** - Forces users to export data, demonstrating the app's export feature
5. **Zero dependencies** - No `idb` library needed

**Tradeoffs:**
1. ❌ No persistence across sessions (intentional - see benefits above)
2. ❌ Storage limits (~5-10MB, sufficient for 10k+ transactions)
3. ✅ Synchronous operations (simpler than IndexedDB promises)
4. ✅ Tab-scoped (multiple tabs don't interfere)

### Storage Keys
```typescript
const STORAGE_KEYS = {
  TRANSACTIONS: 'cashcanvas_transactions',
  COST_CENTERS: 'cashcanvas_cost_centers',
  SPEND_CATEGORIES: 'cashcanvas_spend_categories',
  NEXT_TX_ID: 'cashcanvas_next_tx_id',
  NEXT_CC_ID: 'cashcanvas_next_cc_id',
  NEXT_SC_ID: 'cashcanvas_next_sc_id',
};
```

### Data Storage Format
All data stored as JSON strings:
```typescript
// Transactions
sessionStorage.setItem('cashcanvas_transactions', JSON.stringify([
  { id: 1, date: '2026-01-15', description: 'Groceries', ... },
  { id: 2, date: '2026-01-16', description: 'Gas', ... }
]));

// Cost Centers
sessionStorage.setItem('cashcanvas_cost_centers', JSON.stringify([
  { id: 1, name: 'Meals' },
  { id: 2, name: 'Transportation' }
]));

// Auto-increment IDs
sessionStorage.setItem('cashcanvas_next_tx_id', '3');
```

---

## Backend Architecture (Original - Deprecated)

**Note**: The FastAPI backend is no longer needed but remains in the codebase for reference.

### Tech Stack (Original)
- **FastAPI** at `http://localhost:8000`
- **SQLite** (file-based database)
- **SQLAlchemy** (ORM)
- **Pydantic** (validation)

### Data Model (Preserved in Frontend)
```typescript
Transaction:
  - id, date, description, amount, account, notes
  - cost_center_id (FK, required)
  - spend_category_ids (M2M, required)
  # Auto-creates "Uncategorized" if missing

CostCenter: Top-level buckets (e.g., "Meals", "Gifts")
SpendCategory: Granular tags (e.g., "Restaurant", "Girlfriend")
```

---

## Frontend Architecture

### Tech Stack
- **React 18** with **TypeScript**
- **Vite** (dev server at `http://localhost:5173`)
- **Material UI (MUI) v7** for UI components
- **MUI X Data Grid** (MIT version, 100 row limit)
- **MUI X Charts v8** for bar/donut charts
- **Lightweight Charts** (TradingView) for balance timeline
- **Tanstack Query** for state management
- **Axios** for HTTP (only used for type compatibility)
- **date-fns** for date formatting
- **react-error-boundary** for error handling
- **papaparse** for CSV parsing
- **zod** for validation

### UI Layout
```
┌─────────────────────────────────────────┐
│ Header: "CashCanvas" | [Try Demo]  [?]  │
├─────────────────────────────────────────┤
│ Filters Panel (collapsible, pushes down)│
├─────────────────────────────────────────┤
│  Main Workspace (2/3)  │ Analytics (1/3)│
│  - Table View          │ - Cost Centers │
│  - Timeline View       │ - Categories   │
│  - Monthly View        │ - Quick Stats  │
└─────────────────────────────────────────┘
```

**Layout Rules:**
- Filters push content down (no overlay)
- Main: 2/3 width, Analytics: 1/3 width
- Grid layout: `gridTemplateColumns: '2fr 1fr'`
- All styles inline, no separate CSS files
- Desktop-only (no mobile optimizations)

---

## Data Fetching Strategy

### Two Separate Queries
1. **`useTransactions(filters, page, pageSize)`** → DataGrid only
   - Client-side pagination (25/50/100 rows)
   - Compact transactions + metadata
   - Query key: `['transactions', filters, page, pageSize]`

2. **`useAnalytics(filters)`** → Charts + Analytics Sidebar
   - Client-side aggregated data
   - Includes balance timeline, monthly spending, cost center/category breakdowns
   - Query key: `['analytics', filters]`

### Why Two Queries?
- DataGrid: Paginated data (respects 100 row MIT limit)
- Charts: Pre-aggregated data (no redundant computation)
- Each fetches exactly what it needs
- Client does aggregation (JavaScript reduce/map)

### Per Filter Change
- 2 sessionStorage reads: transactions + analytics
- Changing pages only re-reads transactions
- **Zero additional reads on hover/tooltips**

---

## State Management

### Server State (Tanstack Query)
```typescript
// Queries
useTransactions(filters, page, pageSize) // DataGrid
useAnalytics(filters)                    // Charts/sidebar
useCostCenters()                         // Metadata
useSpendCategories()                     // Metadata
useAccounts()                            // Metadata

// Mutations
useCreateTransaction()
useUpdateTransaction()
useDeleteTransaction()
useUploadCSV()
useLoadDemo()  // NEW - Loads demo data
```

**Invalidation**: After mutations, invalidate `['transactions']` and `['analytics']`

**Caching**:
```typescript
// main.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 60 * 5,  // 5 min
      gcTime: 1000 * 60 * 10,    // 10 min
      refetchOnMount: true,
    },
  },
});
```

### UI State (React useState)
```typescript
// App.tsx
const [appliedFilters, setAppliedFilters] = useState<TransactionFilters>({});
const [filtersOpen, setFiltersOpen] = useState(false);
const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('table');
const [analyticsPanelView, setAnalyticsPanelView] = useState<AnalyticsPanelView>('cost-center-overview');

// TransactionWorkspace.tsx (owns its pagination)
const [page, setPage] = useState(1);
const [pageSize, setPageSize] = useState(100);
```

### Enrichment Pattern
```typescript
// Frontend joins compact transactions with metadata once per query
const enrichedRows = useMemo(
  () => enrichTransactions(data.transactions, data.cost_centers, data.spend_categories),
  [data.transactions, data.cost_centers, data.spend_categories]
);
```

---

## Implementation Status

### ✅ Phase 0-3: Foundation & Transaction Grid (COMPLETE)
- Type definitions and API client
- Tanstack Query setup with proper caching
- Layout components (header, filters, workspace, analytics panel)
- Complete filter system with 4-column grid
- Transaction CRUD with MUI DataGrid
- Dialog state management using discriminated unions
- Analytics foundation with data contracts locked down

### ✅ Phase 4: Charts & Analytics (COMPLETE)
- QuickStats summary cards
- SpendCategoryChart with MUI Linear Progress bars
- CostCenterChart with MUI Pie Chart
- MonthlySpendingChart with MUI Bar Chart
- BalanceTimeline with Lightweight Charts

### ✅ Phase 5: CSV Upload & Export (COMPLETE)
- CSVUploadDialog with institution selector
- useUploadCSV mutation hook
- Export CSV button in workspace header
- Integration with existing filter state

### ✅ Phase 6: Migration to Client-Side (COMPLETE)
- sessionStorage database wrapper
- CSV parsers ported to TypeScript with Zod validation
- Demo data generation system
- useLoadDemo mutation hook
- Zero-dependency deployment

---

## Performance Expectations

### Client-Side Operations

**Filtering Performance:**
- **< 1000 transactions**: Instant (<50ms)
- **1000-5000 transactions**: Fast (<200ms)
- **5000+ transactions**: Acceptable (<500ms)

**CSV Upload Performance:**
- 100 transactions: ~200ms
- 500 transactions: ~800ms
- 1000 transactions: ~1.5s

**Analytics Computation:**
- Client-side aggregation using JavaScript reduce/map
- Negligible overhead for <5000 transactions
- All tooltip data pre-computed (no hover-triggered operations)

### Storage Limits
- **sessionStorage limit**: ~5-10MB (browser-dependent)
- **Practical limit**: ~10,000 transactions with full metadata
- **Recommended**: Export to CSV for large datasets

---

## Key Technical Decisions

1. **sessionStorage over IndexedDB** - Simpler, ephemeral, browser-managed warnings
2. **Two separate queries** - Pagination for grid, pre-aggregation for charts
3. **Client-side sorting** - Data always pre-sorted for consumption
4. **Pre-loaded tooltips** - No hover-triggered operations
5. **Compact transactions** - IDs only, metadata separate (~40% smaller payload)
6. **Discriminated unions for dialogs** - Eliminates impossible states
7. **Desktop-only** - No mobile optimizations needed
8. **Fixed DataGrid row height** - Enables virtualization (critical for 1000+ rows)
9. **Memoized enrichment** - Specific dependencies prevent unnecessary re-computation
10. **No over-engineering** - Skip optimistic updates, keyboard shortcuts (not needed for personal project)

---

## Demo Data System

### Purpose
Allows recruiters and users to instantly see the app in action without uploading CSV files.

### Implementation
```typescript
// lib/demo/generator.ts
export async function generateDemoData(count: number = 200): Promise<void> {
  // Generates realistic transactions:
  // - 95% expenses (random amounts, descriptions, cost centers)
  // - 5% income (paychecks)
  // - Distributed over past year
  // - Multiple cost centers and spend categories
}
```

### Usage
```typescript
// hooks/useLoadDemo.ts
export function useLoadDemo() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (count: number = 200) => generateDemoData(count),
    onSuccess: () => {
      // Invalidate all queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      // ... etc
    },
  });
}
```

---

## CSV Parsing

### Supported Institutions

| Institution | Format | Notes |
|------------|--------|-------|
| `discover` | Discover credit card | MM/DD/YYYY dates, includes categories |
| `schwab` | Schwab checking | Separate Withdrawal/Deposit columns |
| `cashcanvas` | CashCanvas export | ISO dates, full categorization |

### Validation (Zod)
```typescript
const TransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1).max(200),
  amount: z.number(),
  account: z.string().min(1).max(50),
  cost_center_name: z.string().optional(),
  spend_category_names: z.array(z.string()).optional(),
  notes: z.string().max(200).nullable().optional(),
});
```

### Error Handling
- **Header validation**: Ensures all required columns present
- **Row-by-row validation**: Collects all errors before rejecting
- **Detailed error messages**: Shows row numbers and specific issues
- **All-or-nothing**: Entire upload rejected if any row fails

---

## Deployment to Vercel

### Configuration
```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

**Build Settings:**
- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

### Browser Compatibility
sessionStorage is universally supported:
- Chrome (all versions)
- Firefox (all versions)
- Safari (all versions)
- Edge (all versions)

---

## IndexedDB Reference Implementation

The codebase includes a complete IndexedDB implementation in `lib/db/indexeddb.ts` for reference. This is **unused** in the current build but available for developers who want to fork and experiment with:

- Persistent storage across sessions
- Advanced indexing for large datasets
- Async operations for heavy workloads
- Service worker integration

To use IndexedDB instead of sessionStorage:
1. Swap imports in `api/client.ts`
2. Update `lib/db/index.ts` to export IndexedDB database
3. Install `idb` dependency: `npm install idb`

---

## Common Patterns

```typescript
// Fetching data
const { data, isLoading, isError, error } = useAnalytics(filters);
if (isLoading) return <CircularProgress />;
if (isError) return <Alert severity="error">{getErrorMessage(error)}</Alert>;

// Enriching transactions
const enriched = useMemo(
  () => enrichTransactions(data.transactions, data.cost_centers, data.spend_categories),
  [data.transactions, data.cost_centers, data.spend_categories]
);

// Formatting values
import { formatDate, formatCurrency } from '@/utils/formatters';
const display = { date: formatDate(txn.date), amount: formatCurrency(txn.amount) };

// Loading demo data
const { mutate: loadDemo, isPending } = useLoadDemo();
<Button onClick={() => loadDemo()} disabled={isPending}>
  {isPending ? 'Loading...' : 'Try Demo'}
</Button>
```

---

## Resources

- [MUI Documentation](https://mui.com/material-ui/)
- [MUI X Charts](https://mui.com/x/react-charts/)
- [Lightweight Charts](https://tradingview.github.io/lightweight-charts/)
- [Tanstack Query](https://tanstack.com/query/latest)
- [date-fns](https://date-fns.org/)
- [PapaParse](https://www.papaparse.com/)
- [Zod](https://zod.dev/)

---

## Migration Notes

### What Changed
1. **Database**: SQLite → sessionStorage
2. **Parsing**: Python → TypeScript + PapaParse
3. **Validation**: Pydantic → Zod
4. **Aggregation**: SQL → JavaScript reduce/map
5. **Persistence**: File-based → Tab-scoped (ephemeral)

### What Stayed the Same
1. **All UI components** - Zero changes
2. **Data contracts** - Types unchanged
3. **Feature set** - 100% functionality preserved
4. **User workflow** - Identical experience

### Why It Works
- Modern browsers are fast enough for client-side operations
- sessionStorage is simpler than IndexedDB for ephemeral demos
- CSV export/import maintains data portability
- Browser warnings prompt users to save data

---

## Success Criteria

**Migration complete when:**

1. ✅ All existing features work without backend
2. ✅ Data clears on tab close (browser warns on navigation)
3. ✅ CSV uploads parse correctly
4. ✅ Filters and analytics match backend behavior
5. ✅ Demo data loads instantly
6. ✅ Deployed to Vercel and accessible via URL
7. ✅ No console errors in production build

**Portfolio Ready:**

- ✅ README explains architecture
- ✅ Demo data loads with one click
- ✅ Desktop-optimized UI
- ✅ Clean codebase (no TODOs)
- ✅ IndexedDB reference for advanced users