# CashCanvas-Web

A local-first, client-side finance dashboard for visualizing and analyzing spending habits from bank CSV exports.

## Overview

This application helps you track and visualize your personal finances by:
- Importing CSV files from your financial institutions (Discover, Schwab)
- Normalizing transactions into a unified format
- Providing analytics and visualizations of your spending patterns
- Allowing manual categorization and editing of transactions
- Exporting data back to CSV for bulk edits

**Key Philosophy**: This is a **visualization and light editing tool**, not a replacement for spreadsheets. The app maintains high user agency over financial data by keeping all processing client-side with ephemeral storage.

## Live Demo

**Try it now**: [CashCanvas-Web on Vercel](https://your-app.vercel.app)

Click **"Try Demo"** to load 200 sample transactions instantly. No signup, no backend, no data ever leaves your browser.

## Features

### Data Management
- Upload CSVs from Discover credit card and Schwab checking
- Upload CashCanvas-Web CSV exports (from this app or manual edits)
- Automatic transaction normalization across institutions
- Manual categorization with cost centers and spend categories
- Individual transaction editing (no bulk edits in UI)
- Export to custom CashCanvas-Web CSV format

### Analytics & Visualization
- Monthly spending bar chart with cost center breakdowns
- Spending by cost center (donut chart)
- Spending by category (linear progress bars)
- Balance timeline (line chart)
- Quick stats: total spent, income, cash flow, averages
- All analytics respond to active filters

### Filtering
- Keyword search (description field only)
- Date range filtering
- Amount range filtering
- Filter by cost centers, spend categories, accounts
- Mix and match any combination of filters
- Pagination support (100 items per page, configurable)

## Tech Stack

### Architecture
**100% Client-Side** - No backend required
- Data stored in browser's `sessionStorage` (clears on tab close)
- CSV parsing with `papaparse`
- Data validation with `zod`
- All aggregations computed in-browser

### Frontend Stack
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Material UI (MUI) v7** - UI components
- **MUI X Charts v8** - Bar/donut charts
- **Lightweight Charts** - Balance timeline chart
- **Tanstack Query** - State management
- **PapaParse** - CSV parsing
- **Zod** - Schema validation
- **date-fns** - Date formatting

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone <repo-url>
cd CashCanvas-Web/frontend
```

2. **Install dependencies**
```bash
npm install
```

3. **Start development server**
```bash
npm run dev
```

Frontend runs at: `http://localhost:5173`

### Building for Production

```bash
npm run build
```

Output in `dist/` folder, ready for deployment to Vercel/Netlify/etc.

## How It Works

### Data Storage
All data is stored in `sessionStorage`, which means:
- ✅ **Private**: Data never leaves your browser
- ✅ **Fast**: No network latency
- ✅ **Simple**: No authentication or accounts
- ⚠️ **Ephemeral**: Data clears when you close the tab
- ⚠️ **Tab-scoped**: Each tab has independent data

**Why sessionStorage?**
- Perfect for demos and portfolio pieces
- Forces users to export data (demonstrates export feature)
- Browser automatically warns "unsaved changes" on navigation
- Zero backend costs

### Workflow
1. **Load demo data** OR **upload CSV**
2. **Categorize and edit** transactions as needed
3. **Visualize** spending patterns with charts
4. **Apply filters** to drill into specific periods/categories
5. **Export to CSV** before closing tab (browser will warn you!)

## CSV Upload Formats

### Supported Institutions

| Institution Code  | Description                   | Notes                         |
|-------------------|-------------------------------|-------------------------------|
| `discover`        | Discover credit card          | Includes default categories   |
| `schwab`          | Schwab checking account       | No categories provided        |
| `cashcanvas`      | Re-importing from this app    | Fully normalized format       |

### Discover Format

**Expected Columns**: `Trans. Date`, `Description`, `Amount`, `Category`

**Example**:
```csv
Trans. Date,Description,Amount,Category
01/15/2026,WHOLE FOODS MARKET,45.23,Groceries
01/16/2026,SHELL OIL,52.00,Gas/Automotive
01/17/2026,NETFLIX.COM,-15.99,Entertainment
```

**Notes**:
- Date format: `MM/DD/YYYY`
- Amount: Positive = expense, Negative = credit/refund
- Category: Maps to Cost Center in database

### Schwab Checking Format

**Expected Columns**: `Date`, `Description`, `Withdrawal`, `Deposit`

**Example**:
```csv
Date,Description,Withdrawal,Deposit
01/15/2026,ACH WITHDRAWAL VENMO,25.00,
01/16/2026,PAYCHECK DEPOSIT,,2500.00
01/17/2026,CHECK 1234,100.00,
```

**Notes**:
- Date format: `MM/DD/YYYY`
- Withdrawal/Deposit: Leave empty if not applicable
- No categories provided (defaults to "Uncategorized")

### Custom CashCanvas Export Format

**Expected Columns**: `Date`, `Description`, `Amount`, `Account`, `Cost Center`, `Spend Categories`, `Notes`

**Example**:
```csv
Date,Description,Amount,Account,Cost Center,Spend Categories,Notes
2026-01-15,Whole Foods Market,-45.23,Discover,Meals,Groceries,Weekly shopping
2026-01-16,Dinner with Sarah,-85.00,Discover,Meals,"Restaurant, Girlfriend",Date night
2026-01-17,Paycheck,2500.00,Schwab Checking,Income,Salary,Biweekly salary
```

**Notes**:
- Date format: `YYYY-MM-DD` (ISO format) or `MM/DD/YYYY`
- Amount: Negative = expense, Positive = income
- Spend Categories: Comma-separated list (e.g., `"Restaurant, Girlfriend"`)
- Empty Cost Center or Spend Categories default to "Uncategorized"

## Data Model

### Transaction
Core entity representing a financial transaction.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | Integer | Auto | Auto-increment |
| date | String | Yes | ISO format (YYYY-MM-DD) |
| description | String | Yes | Transaction description (max 200 chars) |
| amount | Number | Yes | Negative = expense, Positive = income |
| account | String | Yes | Account name (e.g., "Discover", "Schwab Checking") |
| notes | String | No | Optional user notes (max 200 chars) |
| cost_center_id | Integer | Yes | Foreign key to Cost Center |
| spend_category_ids | Integer[] | Yes | Array of Spend Category IDs |

**Relationships**:
- Belongs to one **Cost Center** (required)
- Has many **Spend Categories** (many-to-many)

### Cost Center
Top-level spending bucket (e.g., "Meals", "Transportation", "Entertainment").

| Field | Type | Notes |
|-------|------|-------|
| id | Integer | Auto-increment |
| name | String | Unique, max 50 chars |

**Examples**: Meals, Gifts, Entertainment, Income, Health & Wellness

### Spend Category
Granular tags for transactions (e.g., "Restaurant", "Groceries", "Nightlife").

| Field | Type | Notes |
|-------|------|-------|
| id | Integer | Auto-increment |
| name | String | Unique, max 50 chars |

**Examples**: Restaurant, Groceries, Girlfriend, Flowers, Drinks, Friend

### Categorization Examples

**Example 1**: Dinner date
- Description: "The Capital Grille"
- Cost Center: `Meals`
- Spend Categories: `Restaurant`, `Girlfriend`

**Example 2**: Grocery shopping
- Description: "Whole Foods Market"
- Cost Center: `Meals`
- Spend Categories: `Groceries`

**Example 3**: Birthday gift
- Description: "Target"
- Cost Center: `Gifts`
- Spend Categories: `Friend`

**Example 4**: Drinks with friends
- Description: "The Social House"
- Cost Center: `Entertainment`
- Spend Categories: `Drinks`, `Nightlife`

## Architecture

### Client-Side Only
No backend required. All operations happen in the browser:

```
┌─────────────────────────────────────────┐
│         React Components (UI)           │
├─────────────────────────────────────────┤
│      Tanstack Query (State Mgmt)        │
├─────────────────────────────────────────┤
│     API Client (sessionStorage Ops)     │
├─────────────────────────────────────────┤
│        sessionStorage (Browser)         │
└─────────────────────────────────────────┘
```

### Key Design Decisions

**Why sessionStorage over IndexedDB?**
1. **Simpler**: No async complexity, no schema migrations
2. **Ephemeral**: Data clears on tab close (perfect for demos)
3. **Browser warnings**: Automatic "unsaved changes" prompt
4. **Zero dependencies**: No extra libraries needed

**Alternative: IndexedDB**
The codebase includes a reference IndexedDB implementation in `lib/db/indexeddb.ts`. If you fork this repo and want persistent storage:
1. Install `idb` dependency: `npm install idb`
2. Update `lib/db/index.ts` to export IndexedDB database
3. Swap imports in `api/client.ts`

### File Structure
```
frontend/src/
├── lib/                        # Client-side logic
│   ├── db/
│   │   ├── schema.ts           # TypeScript types
│   │   ├── database.ts         # sessionStorage wrapper (ACTIVE)
│   │   ├── indexeddb.ts        # IndexedDB implementation (REFERENCE)
│   │   └── index.ts            # Barrel export
│   ├── csv/
│   │   ├── parsers.ts          # CSV parsing with Zod validation
│   │   └── index.ts
│   └── demo/
│       ├── generator.ts        # Demo data generation
│       └── index.ts
├── api/
│   └── client.ts               # API client (calls sessionStorage)
├── types/
│   └── index.ts                # TypeScript types
├── hooks/                      # Tanstack Query hooks
│   ├── useTransactions.ts
│   ├── useAnalytics.ts
│   ├── useUnsavedWarning.ts    # NEW - Browser close warning hook
│   ├── useLoadDemo.ts
│   └── ...
├── components/                 # React components
│   ├── charts/
│   ├── layout/
│   ├── filters/
│   ├── transactions/
│   └── upload/
├── utils/                      # Utility functions
│   ├── formatters.ts
│   ├── enrichment.ts
│   ├── errors.ts
│   ├── exportUtils.ts
│   └── chartHelpers.ts
├── App.tsx                     # Main app component
└── main.tsx                    # Entry point
```

## Design Decisions

### Why Local-First?
- **Privacy**: Financial data never leaves your machine
- **Simplicity**: No server infrastructure, no authentication, no cloud costs
- **Control**: You own your data and can export it at any time
- **Performance**: No network latency, instant filtering and analytics

### Why Ephemeral Storage?
- **Demo-friendly**: Perfect for portfolio pieces and recruiter demos
- **Data safety**: Forces users to export important data
- **Browser integration**: Automatic "unsaved changes" warnings
- **Simplicity**: No database migrations or schema management

### Why No Bulk Edits in UI?
- **Scope control**: Complex bulk operations are better in Excel
- **User agency**: Users should maintain control over their financial data
- **Export workflow**: Export to CSV → Edit in Excel → Re-import

### Auto-Cleanup of Orphaned Categories
When you delete/update a transaction, unused cost centers and spend categories are automatically removed.

**Why?**: Keeps the database clean and dropdown menus uncluttered.

**Note**: Since data is ephemeral, losing categories on accidental deletion is acceptable—just reload demo data or re-import CSV.

### CSV Upload Validation
If **any** row in a CSV file fails validation, the **entire upload is rejected**. Nothing is saved to sessionStorage.

**Why?**: Prevents partial imports and data corruption.

**User Experience**: You get a detailed error message showing exactly which rows failed and why.

## Performance

### Expected Performance
- **< 1000 transactions**: Instant filtering (<50ms)
- **1000-5000 transactions**: Fast filtering (<200ms)
- **5000+ transactions**: Still acceptable (<500ms)

### Storage Limits
- **sessionStorage limit**: ~5-10MB (browser-dependent)
- **Practical limit**: ~10,000 transactions with full metadata
- **Recommendation**: Export to CSV for datasets >5000 transactions

### Optimization Notes
Modern browsers are highly optimized for:
- JSON parsing/stringifying
- Array filtering and mapping
- sessionStorage read/write operations

Client-side filtering of 10,000 transactions is trivial for modern JavaScript engines.

## Deployment

### Vercel (Recommended)

1. **Push to GitHub**
```bash
git push origin main
```

2. **Import to Vercel**
- Go to [vercel.com](https://vercel.com)
- Import your GitHub repository
- Framework: Vite
- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`

3. **Deploy**
- Click "Deploy"
- Your app is live!

### Alternative Platforms
- **Netlify**: Drag and drop `dist/` folder
- **GitHub Pages**: Use `gh-pages` package
- **Any static host**: Just serve the `dist/` folder

## Browser Compatibility

**Supported Browsers:**
- Chrome 24+ ✅
- Firefox 16+ ✅
- Safari 10+ ✅
- Edge 79+ ✅

**Note**: Private browsing modes may have stricter sessionStorage limits. Data will still work but may clear more aggressively.

## Error Handling

### CSV Upload Errors

**Invalid Institution**:
```
Unknown institution: 'chase'. 
Supported institutions: 'discover', 'schwab', 'cashcanvas'
```

**Validation Errors**:
```
CSV validation failed (3 error(s)):
Row 2: Date is empty
Row 5: Invalid currency value: 'abc'
Row 7: Description is empty
```

**Missing Columns**:
```
CSV file does not look like a Discover export. 
Missing columns: ['Amount', 'Category']. 
Found columns: ['Date', 'Desc', 'Total']
```

## Development

### Key Principles
1. **Minimalism**: Only build what's needed, avoid feature creep
2. **DRY**: Don't repeat yourself - extract common patterns
3. **Clear boundaries**: Each module has one responsibility
4. **Fail fast**: Validate early, provide clear error messages
5. **User agency**: Users maintain control over their financial data

### Adding a New Institution

1. **Create parser in `lib/csv/parsers.ts`**:
```typescript
function parseNewBank(rows: any[], fieldnames: string[]): CreateTransactionData[] {
  // Your parsing logic here
  return transactions;
}
```

2. **Update router in `parseCSVFile()`**:
```typescript
case 'newbank':
  transactions = parseNewBank(results.data, results.meta.fields || []);
  break;
```

3. **Update documentation** in this README

## Backup & Data Export

### Exporting Your Data
1. Click "Export CSV" button in the workspace header
2. Save the file to your computer
3. This file can be re-imported anytime using the "cashcanvas" institution

### Recommended Workflow
1. Work with data in CashCanvas-Web
2. Export to CSV before closing tab
3. For bulk edits, open CSV in Excel
4. Re-import edited CSV into CashCanvas-Web
5. Continue visualizing and analyzing

## Troubleshooting

### Data disappeared after closing tab
This is expected behavior! sessionStorage clears when the tab closes. Always export to CSV before closing.

### CSV upload fails
- Verify institution code: must be exactly "discover", "schwab", or "cashcanvas"
- Check CSV format: headers must match expected format exactly
- Look at error message: shows which rows failed and why

### Browser shows "unsaved changes" warning
This is intentional! It reminds you to export your data before leaving.

### Charts not updating
- Try clicking "Try Demo" to reload sample data
- Check browser console for errors
- Ensure you're using a modern browser (Chrome/Firefox/Safari/Edge)

## Contributing

This is a personal project, but feedback and suggestions are welcome!

### Code Style
- TypeScript: Use Prettier for formatting
- React: Functional components with hooks
- Comments: Explain "why", not "what"

## License

MIT License - See LICENSE file for details

## Roadmap

### Completed ✅
- CSV import from Discover and Schwab
- Transaction CRUD operations
- Filtering with pagination
- Analytics computation
- Auto-cleanup of orphaned categories
- Client-side architecture (no backend)
- Demo data system
- Export to CSV

### Future Enhancements
- Additional bank CSV parsers (Chase, Bank of America, etc.)
- Recurring transaction detection
- Budget tracking and alerts
- Multi-currency support
- Mobile-responsive design
- IndexedDB option for persistent storage

## Credits

Built with:
- [React](https://react.dev/)
- [Material UI](https://mui.com/)
- [Tanstack Query](https://tanstack.com/query)
- [Lightweight Charts](https://tradingview.github.io/lightweight-charts/)
- [PapaParse](https://www.papaparse.com/)
- [Zod](https://zod.dev/)

## Support

For issues, questions, or suggestions:
1. Check this README first
2. Review error messages carefully
3. Open an issue on GitHub

---

**Remember**: This app uses ephemeral storage. Always export your data to CSV before closing the tab!