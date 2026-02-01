// lib/csv/parsers.ts
import Papa from 'papaparse';
import { z } from 'zod';
import type { CreateTransactionData } from '@/types';

// ============================================
// VALIDATION SCHEMA (replaces Pydantic)
// ============================================

const TransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  description: z.string().min(1, 'Description cannot be empty').max(200),
  amount: z.number(),
  account: z.string().min(1, 'Account cannot be empty').max(50),
  cost_center_name: z.string().optional(),
  spend_category_names: z.array(z.string()).optional(),
  notes: z.string().max(200).nullable().optional(),
});

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Clean header string by removing whitespace, BOM, and special characters.
 * Mirrors Python's clean_header function.
 */
function cleanHeader(header: string): string {
  if (!header) return '';
  
  // Remove BOM characters
  let cleaned = header.replace(/[\ufeff\ufffe]/g, '');
  
  // Remove all whitespace (spaces, newlines, tabs, etc.)
  cleaned = cleaned.replace(/\s+/g, '');
  
  return cleaned.trim();
}

/**
 * Remove currency symbols, commas, and whitespace from monetary values.
 * Mirrors Python's clean_currency_string function.
 */
function cleanCurrency(value: string, rowNum?: number): number {
  if (!value || value.trim() === '') {
    const error = rowNum 
      ? `Row ${rowNum}: Empty or invalid currency value: '${value}'`
      : `Empty or invalid currency value: '${value}'`;
    throw new Error(error);
  }
  
  // Remove dollar signs, commas, and whitespace
  const cleaned = value.replace(/[$,\s]/g, '');
  
  if (!cleaned) {
    const error = rowNum
      ? `Row ${rowNum}: Empty or invalid currency value: '${value}'`
      : `Empty or invalid currency value: '${value}'`;
    throw new Error(error);
  }
  
  const num = parseFloat(cleaned);
  if (isNaN(num)) {
    const error = rowNum
      ? `Row ${rowNum}: Invalid currency value: '${value}'. Expected a number.`
      : `Invalid currency value: '${value}'. Expected a number.`;
    throw new Error(error);
  }
  
  return num;
}

/**
 * Parse date string and convert to ISO format (YYYY-MM-DD).
 */
function parseDate(dateStr: string, format: 'MM/DD/YYYY' | 'YYYY-MM-DD', rowNum?: number): string {
  if (!dateStr || !dateStr.trim()) {
    const error = rowNum ? `Row ${rowNum}: Date is empty` : 'Date is empty';
    throw new Error(error);
  }
  
  if (format === 'YYYY-MM-DD') {
    // Already ISO format, validate it
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const error = rowNum
        ? `Row ${rowNum}: Invalid date format: '${dateStr}'. Expected YYYY-MM-DD.`
        : `Invalid date format: '${dateStr}'. Expected YYYY-MM-DD.`;
      throw new Error(error);
    }
    return dateStr;
  }
  
  // Convert MM/DD/YYYY to YYYY-MM-DD
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) {
    const error = rowNum
      ? `Row ${rowNum}: Invalid date format: '${dateStr}'. Expected MM/DD/YYYY.`
      : `Invalid date format: '${dateStr}'. Expected MM/DD/YYYY.`;
    throw new Error(error);
  }
  
  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Validate transaction data with Zod schema.
 */
function validateTransaction(txnData: CreateTransactionData, rowNum: number): void {
  try {
    TransactionSchema.parse(txnData);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues.map((err: z.ZodIssue) => {
        const field = err.path.join('.');
        return `${field}: ${err.message}`;
      });
      throw new Error(`Row ${rowNum} validation failed: ${errors.join('; ')}`);
    }
    throw error;
  }
}

/**
 * Validate that expected headers are present in CSV.
 */
function validateHeaders(
  expectedHeaders: Record<string, string>,
  actualHeaders: string[],
  sourceName: string
): void {
  // Normalize actual headers
  const normalizedActual = new Map<string, string>();
  actualHeaders.forEach(header => {
    if (header) {
      normalizedActual.set(cleanHeader(header), header);
    }
  });
  
  // Check if all expected headers exist
  const missing: string[] = [];
  Object.entries(expectedHeaders).forEach(([, displayName]) => {
    const normalizedExpected = cleanHeader(displayName);
    if (!normalizedActual.has(normalizedExpected)) {
      missing.push(displayName);
    }
  });
  
  if (missing.length > 0) {
    throw new Error(
      `CSV file does not look like a ${sourceName} export. ` +
      `Missing columns: ${missing.join(', ')}. ` +
      `Found columns: ${actualHeaders.join(', ')}`
    );
  }
}

/**
 * Parse CSV headers and return mapping of clean names to actual header names.
 */
function parseHeaders(
  fieldnames: string[] | undefined,
  expectedHeadersMap: Record<string, string>,
  institutionName: string
): Record<string, string> {
  if (!fieldnames || fieldnames.length === 0) {
    throw new Error('CSV file appears to be empty');
  }
  
  const originalHeaders = fieldnames.map(h => h.trim());
  
  // Create mapping: cleanHeader -> original header
  const headerMapping = new Map<string, string>();
  originalHeaders.forEach(h => {
    headerMapping.set(cleanHeader(h), h);
  });
  
  // Validate headers
  validateHeaders(expectedHeadersMap, originalHeaders, institutionName);
  
  // Return mapping: clean key -> actual CSV header name
  const result: Record<string, string> = {};
  Object.entries(expectedHeadersMap).forEach(([cleanKey, displayName]) => {
    const cleanDisplayName = cleanHeader(displayName);
    const actualHeader = headerMapping.get(cleanDisplayName);
    if (actualHeader) {
      result[cleanKey] = actualHeader;
    }
  });
  
  return result;
}

// ============================================
// DISCOVER PARSER
// ============================================

/**
 * Parse Discover credit card CSV export.
 * 
 * Expected columns:
 * - Trans. Date: Transaction date (MM/DD/YYYY)
 * - Description: Transaction description
 * - Amount: Transaction amount (positive = expense, negative = credit)
 * - Category: Discover's category (maps to cost_center)
 */
function parseDiscover(rows: any[], fieldnames: string[]): CreateTransactionData[] {
  const transactions: CreateTransactionData[] = [];
  const errors: string[] = [];
  
  // Parse headers
  const headers = parseHeaders(
    fieldnames,
    {
      date: 'Trans. Date',
      description: 'Description',
      amount: 'Amount',
      category: 'Category',
    },
    'Discover'
  );
  
  rows.forEach((row, index) => {
    const rowNum = index + 2; // CSV row number (1-indexed, +1 for header)
    
    try {
      // Parse date
      const dateStr = row[headers.date]?.trim();
      const date = parseDate(dateStr, 'MM/DD/YYYY', rowNum);
      
      // Validate description
      const description = row[headers.description]?.trim();
      if (!description) {
        throw new Error('Description is empty');
      }
      
      // Parse amount
      const rawAmountStr = row[headers.amount]?.trim();
      if (!rawAmountStr) {
        throw new Error('Amount is empty');
      }
      const rawAmount = cleanCurrency(rawAmountStr, rowNum);
      
      // Get cost center (category)
      const category = row[headers.category]?.trim() || 'Uncategorized';
      
      // For Discover: positive amounts in CSV = expenses (negative in ledger)
      //               negative amounts in CSV = credits (positive in ledger)
      const amount = -rawAmount;
      
      const txn: CreateTransactionData = {
        date,
        description,
        amount,
        account: 'Discover',
        cost_center_name: category,
        spend_category_names: [],
        notes: null,
      };
      
      // Validate with Zod
      validateTransaction(txn, rowNum);
      
      transactions.push(txn);
      
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Row ${rowNum}: ${message}`);
    }
  });
  
  if (errors.length > 0) {
    throw new Error(
      `CSV validation failed (${errors.length} error(s)):\n` +
      errors.slice(0, 20).join('\n') // Limit to first 20 errors
    );
  }
  
  return transactions;
}

// ============================================
// SCHWAB PARSER
// ============================================

/**
 * Parse Schwab checking account CSV export.
 * 
 * Expected columns:
 * - Date: Transaction date (MM/DD/YYYY)
 * - Status: Transaction status (ignored)
 * - Type: Transaction type (ignored)
 * - CheckNumber: Check number if applicable (ignored)
 * - Description: Transaction description
 * - Withdrawal: Withdrawal amount (expenses - will be negative in DB)
 * - Deposit: Deposit amount (income - will be positive in DB)
 * - RunningBalance: Running balance (ignored)
 */
function parseSchwab(rows: any[], fieldnames: string[]): CreateTransactionData[] {
  const transactions: CreateTransactionData[] = [];
  const errors: string[] = [];
  
  // Parse headers
  const headers = parseHeaders(
    fieldnames,
    {
      date: 'Date',
      description: 'Description',
      withdrawal: 'Withdrawal',
      deposit: 'Deposit',
    },
    'Schwab Checking'
  );
  
  rows.forEach((row, index) => {
    const rowNum = index + 2;
    
    try {
      // Parse date
      const dateStr = row[headers.date]?.trim();
      const date = parseDate(dateStr, 'MM/DD/YYYY', rowNum);
      
      // Validate description
      const description = row[headers.description]?.trim();
      if (!description) {
        throw new Error('Description is empty');
      }
      
      // Process amounts
      const withdrawalStr = row[headers.withdrawal]?.trim() || '';
      const depositStr = row[headers.deposit]?.trim() || '';
      
      let amount: number;
      if (withdrawalStr && withdrawalStr !== '') {
        amount = -cleanCurrency(withdrawalStr, rowNum);
      } else if (depositStr && depositStr !== '') {
        amount = cleanCurrency(depositStr, rowNum);
      } else {
        throw new Error('Both Withdrawal and Deposit are empty');
      }
      
      const txn: CreateTransactionData = {
        date,
        description,
        amount,
        account: 'Schwab Checking',
        cost_center_name: 'Uncategorized',
        spend_category_names: [],
        notes: null,
      };
      
      // Validate with Zod
      validateTransaction(txn, rowNum);
      
      transactions.push(txn);
      
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Row ${rowNum}: ${message}`);
    }
  });
  
  if (errors.length > 0) {
    throw new Error(
      `CSV validation failed (${errors.length} error(s)):\n` +
      errors.slice(0, 20).join('\n')
    );
  }
  
  return transactions;
}

// ============================================
// CASHCANVAS CUSTOM PARSER
// ============================================

/**
 * Parse custom CashCanvas export CSV format.
 * 
 * Expected columns:
 * - Date: Transaction date (YYYY-MM-DD or MM/DD/YYYY)
 * - Description: Transaction description
 * - Amount: Transaction amount (negative = expense, positive = income)
 * - Account: Account name
 * - Cost Center: Cost center name
 * - Spend Categories: Comma-separated list of spend category names
 * - Notes: Optional notes field
 */
function parseCashCanvas(rows: any[], fieldnames: string[]): CreateTransactionData[] {
  const transactions: CreateTransactionData[] = [];
  const errors: string[] = [];
  
  // Parse headers
  const headers = parseHeaders(
    fieldnames,
    {
      date: 'Date',
      description: 'Description',
      amount: 'Amount',
      account: 'Account',
      cost_center: 'Cost Center',
      spend_categories: 'Spend Categories',
      notes: 'Notes',
    },
    'CashCanvas Export'
  );
  
  rows.forEach((row, index) => {
    const rowNum = index + 2;
    
    try {
      // Parse date (supports both formats)
      const dateStr = row[headers.date]?.trim();
      let date: string;
      
      try {
        // Try ISO format first
        date = parseDate(dateStr, 'YYYY-MM-DD', rowNum);
      } catch {
        // Fall back to MM/DD/YYYY
        date = parseDate(dateStr, 'MM/DD/YYYY', rowNum);
      }
      
      // Validate description
      const description = row[headers.description]?.trim();
      if (!description) {
        throw new Error('Description is empty');
      }
      
      // Parse amount
      const amountStr = row[headers.amount]?.trim();
      if (!amountStr) {
        throw new Error('Amount is empty');
      }
      const amount = cleanCurrency(amountStr, rowNum);
      
      // Validate account
      const account = row[headers.account]?.trim();
      if (!account) {
        throw new Error('Account is empty');
      }
      
      // Parse cost center
      let costCenter = row[headers.cost_center]?.trim() || null;
      if (costCenter && costCenter.toLowerCase() === 'uncategorized') {
        costCenter = null;
      }
      
      // Parse spend categories
      const spendCategoriesStr = row[headers.spend_categories]?.trim() || '';
      const spendCategories: string[] = [];
      
      if (spendCategoriesStr && spendCategoriesStr.toLowerCase() !== 'uncategorized') {
        // Split by comma and clean each category
        const rawCategories = spendCategoriesStr.split(',');
        rawCategories.forEach((cat: string) => {
          const cleaned = cat.trim();
          if (cleaned) {
            spendCategories.push(cleaned);
          }
        });
      }
      
      // Parse notes
      const notesStr = row[headers.notes]?.trim() || '';
      const notes = notesStr ? notesStr : null;
      
      const txn: CreateTransactionData = {
        date,
        description,
        amount,
        account,
        cost_center_name: costCenter || undefined,
        spend_category_names: spendCategories.length > 0 ? spendCategories : undefined,
        notes,
      };
      
      // Validate with Zod
      validateTransaction(txn, rowNum);
      
      transactions.push(txn);
      
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Row ${rowNum}: ${message}`);
    }
  });
  
  if (errors.length > 0) {
    throw new Error(
      `CSV validation failed (${errors.length} error(s)):\n` +
      errors.slice(0, 20).join('\n')
    );
  }
  
  return transactions;
}

// ============================================
// MAIN PARSER FUNCTION
// ============================================

/**
 * Parse CSV file and return array of validated transactions.
 * 
 * @param file - The CSV file to parse
 * @param institution - Institution name ('discover', 'schwab', or 'cashcanvas')
 * @returns Promise resolving to array of CreateTransactionData
 * @throws Error if CSV validation fails or institution is unknown
 */
export async function parseCSVFile(
  file: File,
  institution: string
): Promise<CreateTransactionData[]> {
  const text = await file.text();
  
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header, // Keep original headers for validation
      complete: (results) => {
        try {
          const institutionLower = institution.toLowerCase().trim();
          let transactions: CreateTransactionData[];
          
          switch (institutionLower) {
            case 'discover':
              transactions = parseDiscover(
                results.data as any[],
                results.meta.fields || []
              );
              break;
            
            case 'schwab':
            case 'schwab checking':
              transactions = parseSchwab(
                results.data as any[],
                results.meta.fields || []
              );
              break;
            
            case 'cashcanvas':
              transactions = parseCashCanvas(
                results.data as any[],
                results.meta.fields || []
              );
              break;
            
            default:
              throw new Error(
                `Unknown institution: '${institution}'. ` +
                `Supported institutions: 'discover', 'schwab', 'cashcanvas'`
              );
          }
          
          resolve(transactions);
        } catch (error) {
          reject(error);
        }
      },
      error: (error: Error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`));
      },
    });
  });
}