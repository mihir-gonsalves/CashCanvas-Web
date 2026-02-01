// api/client.ts
import { db } from '@/lib/db/database';
import { parseCSVFile } from '@/lib/csv/parsers';
import type {
  Analytics,
  CostCenter,
  CreateTransactionData,
  PaginatedResponse,
  SpendCategory,
  Transaction,
  TransactionFilters,
  UpdateTransactionData,
  UploadResponse,
} from '@/types';

// Initialize database on app start
let dbInitialized = false;
async function ensureDB() {
  if (!dbInitialized) {
    await db.init();
    dbInitialized = true;
  }
}

export const api = {
  // --------------------------------------------------------------------------
  // Transactions
  // --------------------------------------------------------------------------

  async getFilteredTransactions(
    filters: TransactionFilters = {},
    page: number = 1,
    pageSize: number = 100
  ): Promise<PaginatedResponse<Transaction>> {
    await ensureDB();
    return db.getFilteredTransactions(filters, page, pageSize);
  },

  async getAnalytics(filters: TransactionFilters = {}): Promise<Analytics> {
    await ensureDB();
    return db.getAnalytics(filters);
  },

  async createTransaction(txn: CreateTransactionData): Promise<Transaction> {
    await ensureDB();
    return db.createTransaction(txn);
  },

  async updateTransaction(
    id: number,
    updates: UpdateTransactionData
  ): Promise<Transaction> {
    await ensureDB();
    return db.updateTransaction(id, updates);
  },

  async deleteTransaction(id: number): Promise<void> {
    await ensureDB();
    await db.deleteTransaction(id);
  },

  // --------------------------------------------------------------------------
  // Metadata
  // --------------------------------------------------------------------------

  async getCostCenters(): Promise<CostCenter[]> {
    await ensureDB();
    return db.getAllCostCenters();
  },

  async getSpendCategories(): Promise<SpendCategory[]> {
    await ensureDB();
    return db.getAllSpendCategories();
  },

  async getAccounts(): Promise<string[]> {
    await ensureDB();
    return db.getUniqueAccounts();
  },

  // --------------------------------------------------------------------------
  // CSV Upload (Client-Side Parsing)
  // --------------------------------------------------------------------------

  async uploadCSV(institution: string, file: File): Promise<UploadResponse> {
    await ensureDB();
    
    // Parse CSV client-side
    const transactions = await parseCSVFile(file, institution);
    
    // Bulk insert
    await db.bulkCreateTransactions(transactions);
    
    return {
      message: `Successfully loaded ${transactions.length} transactions`,
      count: transactions.length,
      institution,
    };
  },
};