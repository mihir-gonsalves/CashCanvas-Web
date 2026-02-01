// lib/db/database.ts -- published version, uses sessionStorage instead of indexedDB so users perceive data to never be stored online.
import type {
  Transaction,
  CostCenter,
  SpendCategory,
  CreateTransactionData,
  UpdateTransactionData,
  TransactionFilters,
  PaginatedResponse,
  Analytics,
  MonthlySpending,
  CostCenterSpending,
  SpendCategoryStats,
  BalanceTimelinePoint,
} from '@/types';

const STORAGE_KEYS = {
  TRANSACTIONS: 'cashcanvas_transactions',
  COST_CENTERS: 'cashcanvas_cost_centers',
  SPEND_CATEGORIES: 'cashcanvas_spend_categories',
  NEXT_TX_ID: 'cashcanvas_next_tx_id',
  NEXT_CC_ID: 'cashcanvas_next_cc_id',
  NEXT_SC_ID: 'cashcanvas_next_sc_id',
};

class Database {
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    
    // Initialize empty arrays if not present
    if (!sessionStorage.getItem(STORAGE_KEYS.TRANSACTIONS)) {
      sessionStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify([]));
      sessionStorage.setItem(STORAGE_KEYS.COST_CENTERS, JSON.stringify([]));
      sessionStorage.setItem(STORAGE_KEYS.SPEND_CATEGORIES, JSON.stringify([]));
      sessionStorage.setItem(STORAGE_KEYS.NEXT_TX_ID, '1');
      sessionStorage.setItem(STORAGE_KEYS.NEXT_CC_ID, '1');
      sessionStorage.setItem(STORAGE_KEYS.NEXT_SC_ID, '1');
    }
    
    this.initialized = true;
  }

  private async getDB(): Promise<void> {
    if (!this.initialized) await this.init();
  }

  // ============================================
  // STORAGE HELPERS
  // ============================================

  private getTransactions(): Transaction[] {
    const data = sessionStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    return data ? JSON.parse(data) : [];
  }

  private setTransactions(transactions: Transaction[]): void {
    sessionStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  }

  private getCostCentersRaw(): CostCenter[] {
    const data = sessionStorage.getItem(STORAGE_KEYS.COST_CENTERS);
    return data ? JSON.parse(data) : [];
  }

  private setCostCenters(centers: CostCenter[]): void {
    sessionStorage.setItem(STORAGE_KEYS.COST_CENTERS, JSON.stringify(centers));
  }

  private getSpendCategoriesRaw(): SpendCategory[] {
    const data = sessionStorage.getItem(STORAGE_KEYS.SPEND_CATEGORIES);
    return data ? JSON.parse(data) : [];
  }

  private setSpendCategories(categories: SpendCategory[]): void {
    sessionStorage.setItem(STORAGE_KEYS.SPEND_CATEGORIES, JSON.stringify(categories));
  }

  private getNextId(key: string): number {
    const id = parseInt(sessionStorage.getItem(key) || '1');
    sessionStorage.setItem(key, String(id + 1));
    return id;
  }

  // ============================================
  // TRANSACTIONS
  // ============================================

  async createTransaction(data: CreateTransactionData): Promise<Transaction> {
    await this.getDB();
    
    // Get or create cost center
    const costCenter = await this.getOrCreateCostCenter(
      data.cost_center_name || 'Uncategorized'
    );
    
    // Get or create spend categories
    const spendCategories = await this.getOrCreateSpendCategories(
      data.spend_category_names?.length ? data.spend_category_names : ['Uncategorized']
    );

    // Create transaction
    const transaction: Transaction = {
      id: this.getNextId(STORAGE_KEYS.NEXT_TX_ID),
      date: data.date,
      description: data.description,
      amount: data.amount,
      account: data.account,
      cost_center_id: costCenter.id,
      spend_category_ids: spendCategories.map(sc => sc.id),
      notes: data.notes || null,
    };

    const transactions = this.getTransactions();
    transactions.push(transaction);
    this.setTransactions(transactions);

    return transaction;
  }

  async updateTransaction(id: number, updates: UpdateTransactionData): Promise<Transaction> {
    await this.getDB();
    
    const transactions = this.getTransactions();
    const existing = transactions.find(tx => tx.id === id);
    
    if (!existing) {
      throw new Error('Transaction not found');
    }

    // Track old relationships for cleanup
    const oldCostCenterId = existing.cost_center_id;
    const oldSpendCategoryIds = [...existing.spend_category_ids];

    // Update cost center if provided
    if (updates.cost_center_name !== undefined) {
      const costCenter = await this.getOrCreateCostCenter(
        updates.cost_center_name || 'Uncategorized'
      );
      existing.cost_center_id = costCenter.id;
    }

    // Update spend categories if provided
    if (updates.spend_category_names !== undefined) {
      const spendCategories = await this.getOrCreateSpendCategories(
        updates.spend_category_names.length ? updates.spend_category_names : ['Uncategorized']
      );
      existing.spend_category_ids = spendCategories.map(sc => sc.id);
    }

    // Update scalar fields
    if (updates.date) existing.date = updates.date;
    if (updates.description) existing.description = updates.description;
    if (updates.amount !== undefined) existing.amount = updates.amount;
    if (updates.account) existing.account = updates.account;
    if (updates.notes !== undefined) existing.notes = updates.notes;

    this.setTransactions(transactions);

    // Cleanup orphaned relationships
    if (oldCostCenterId !== existing.cost_center_id) {
      await this.cleanupOrphanedCostCenter(oldCostCenterId);
    }
    await this.cleanupOrphanedSpendCategories(oldSpendCategoryIds);

    return existing;
  }

  async deleteTransaction(id: number): Promise<void> {
    await this.getDB();
    
    const transactions = this.getTransactions();
    const transaction = transactions.find(tx => tx.id === id);
    
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // Store relationships before deletion
    const costCenterId = transaction.cost_center_id;
    const spendCategoryIds = [...transaction.spend_category_ids];

    // Delete transaction
    const filtered = transactions.filter(tx => tx.id !== id);
    this.setTransactions(filtered);

    // Cleanup orphaned relationships
    await this.cleanupOrphanedCostCenter(costCenterId);
    await this.cleanupOrphanedSpendCategories(spendCategoryIds);
  }

  async getFilteredTransactions(
    filters: TransactionFilters,
    page: number,
    pageSize: number
  ): Promise<PaginatedResponse<Transaction>> {
    await this.getDB();
    
    // Get all transactions
    let transactions = this.getTransactions();
    
    // Apply filters in JavaScript
    transactions = this.applyFilters(transactions, filters);
    
    // Sort by date DESC, id DESC (newest first)
    transactions.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      return dateCompare !== 0 ? dateCompare : b.id - a.id;
    });
    
    // Pagination
    const total = transactions.length;
    const start = (page - 1) * pageSize;
    const paginatedTransactions = transactions.slice(start, start + pageSize);
    
    // Get metadata
    const costCenters = await this.getAllCostCenters();
    const spendCategories = await this.getAllSpendCategories();
    
    return {
      transactions: paginatedTransactions,
      cost_centers: costCenters,
      spend_categories: spendCategories,
      page,
      page_size: pageSize,
      total,
      total_pages: Math.ceil(total / pageSize),
    };
  }

  // ============================================
  // ANALYTICS
  // ============================================

  async getAnalytics(filters: TransactionFilters): Promise<Analytics> {
    await this.getDB();
    
    // Get all filtered transactions
    let transactions = this.getTransactions();
    transactions = this.applyFilters(transactions, filters);
    
    // Get metadata for enrichment
    const costCenters = await this.getAllCostCenters();
    const spendCategories = await this.getAllSpendCategories();
    
    // Compute analytics (same logic as backend)
    return this.computeAnalytics(transactions, costCenters, spendCategories);
  }

  // ============================================
  // COST CENTERS
  // ============================================

  async getAllCostCenters(): Promise<CostCenter[]> {
    await this.getDB();
    const costCenters = this.getCostCentersRaw();
    return costCenters.sort((a, b) => a.name.localeCompare(b.name));
  }

  private async getOrCreateCostCenter(name: string): Promise<CostCenter> {
    await this.getDB();
    const cleanName = name.trim() || 'Uncategorized';
    
    // Check if exists
    const costCenters = this.getCostCentersRaw();
    const existing = costCenters.find(cc => cc.name === cleanName);
    if (existing) return existing;
    
    // Create new
    const newCostCenter: CostCenter = {
      id: this.getNextId(STORAGE_KEYS.NEXT_CC_ID),
      name: cleanName,
    };
    
    costCenters.push(newCostCenter);
    this.setCostCenters(costCenters);
    
    return newCostCenter;
  }

  private async cleanupOrphanedCostCenter(costCenterId: number): Promise<void> {
    await this.getDB();
    
    const costCenters = this.getCostCentersRaw();
    const costCenter = costCenters.find(cc => cc.id === costCenterId);
    
    if (!costCenter) {
      return; // Already deleted
    }
    
    // Check if any transaction still uses this cost center
    const transactions = this.getTransactions();
    const inUse = transactions.some(tx => tx.cost_center_id === costCenterId);
    
    if (!inUse) {
      const filtered = costCenters.filter(cc => cc.id !== costCenterId);
      this.setCostCenters(filtered);
    }
  }

  // ============================================
  // SPEND CATEGORIES
  // ============================================

  async getAllSpendCategories(): Promise<SpendCategory[]> {
    await this.getDB();
    const categories = this.getSpendCategoriesRaw();
    return categories.sort((a, b) => a.name.localeCompare(b.name));
  }

  private async getOrCreateSpendCategories(names: string[]): Promise<SpendCategory[]> {
    const cleanNames = [...new Set(names.map(n => n.trim()).filter(Boolean))];
    if (!cleanNames.length) cleanNames.push('Uncategorized');
    
    const categories: SpendCategory[] = [];
    for (const name of cleanNames) {
      const category = await this.getOrCreateSpendCategory(name);
      categories.push(category);
    }
    return categories;
  }

  private async getOrCreateSpendCategory(name: string): Promise<SpendCategory> {
    await this.getDB();
    const cleanName = name.trim() || 'Uncategorized';
    
    // Check if exists
    const categories = this.getSpendCategoriesRaw();
    const existing = categories.find(sc => sc.name === cleanName);
    if (existing) return existing;
    
    // Create new
    const newCategory: SpendCategory = {
      id: this.getNextId(STORAGE_KEYS.NEXT_SC_ID),
      name: cleanName,
    };
    
    categories.push(newCategory);
    this.setSpendCategories(categories);
    
    return newCategory;
  }

  private async cleanupOrphanedSpendCategories(categoryIds: number[]): Promise<void> {
    await this.getDB();
    
    const transactions = this.getTransactions();
    const categories = this.getSpendCategoriesRaw();
    
    for (const categoryId of categoryIds) {
      // Check if category still exists
      const category = categories.find(sc => sc.id === categoryId);
      if (!category) {
        continue; // Already deleted
      }
      
      // Check if any transaction still uses this category
      const inUse = transactions.some(tx => tx.spend_category_ids.includes(categoryId));
      
      if (!inUse) {
        const filtered = categories.filter(sc => sc.id !== categoryId);
        this.setSpendCategories(filtered);
      }
    }
  }

  // ============================================
  // ACCOUNTS
  // ============================================

  async getUniqueAccounts(): Promise<string[]> {
    await this.getDB();
    const transactions = this.getTransactions();
    const accounts = [...new Set(transactions.map(tx => tx.account))];
    return accounts.sort();
  }

  // ============================================
  // FILTERING HELPER
  // ============================================

  private applyFilters(
    transactions: Transaction[],
    filters: TransactionFilters
  ): Transaction[] {
    return transactions.filter(tx => {
      // Search
      if (filters.search && !tx.description.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      
      // Date range
      if (filters.start_date && tx.date < filters.start_date) return false;
      if (filters.end_date && tx.date > filters.end_date) return false;
      
      // Amount range
      if (filters.min_amount !== undefined && tx.amount < filters.min_amount) return false;
      if (filters.max_amount !== undefined && tx.amount > filters.max_amount) return false;
      
      // Cost center
      if (filters.cost_center_ids?.length && !filters.cost_center_ids.includes(tx.cost_center_id)) {
        return false;
      }
      
      // Spend categories (any match)
      if (filters.spend_category_ids?.length) {
        const hasMatch = filters.spend_category_ids.some(id => tx.spend_category_ids.includes(id));
        if (!hasMatch) return false;
      }
      
      // Account
      if (filters.account?.length && !filters.account.includes(tx.account)) {
        return false;
      }
      
      return true;
    });
  }

  // ============================================
  // ANALYTICS COMPUTATION
  // ============================================

  private computeAnalytics(
    transactions: Transaction[],
    costCenters: CostCenter[],
    spendCategories: SpendCategory[]
  ): Analytics {
    if (!transactions.length) {
      return {
        total_spent: 0,
        total_income: 0,
        total_cash: 0,
        total_transactions: 0,
        total_cost_centers: 0,
        total_spend_categories: 0,
        avg_expense: 0,
        avg_income: 0,
        monthly_spending: [],
        cost_center_spending: [],
        spend_category_stats: [],
        balance_timeline: [],
      };
    }

    // Calculate totals
    const expenses = transactions.filter(tx => tx.amount < 0);
    const incomes = transactions.filter(tx => tx.amount > 0);
    const totalSpent = expenses.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const totalIncome = incomes.reduce((sum, tx) => sum + tx.amount, 0);

    // Monthly spending with cost center breakdown
    const monthlyMap = new Map<string, {
      total: number;
      expenses: number;
      income: number;
      count: number;
      by_cost_center: Map<string, number>;
    }>();

    transactions.forEach(tx => {
      const month = tx.date.slice(0, 7); // "2026-01"
      
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, {
          total: 0,
          expenses: 0,
          income: 0,
          count: 0,
          by_cost_center: new Map(),
        });
      }
      
      const data = monthlyMap.get(month)!;
      data.total += tx.amount;
      data.count += 1;
      
      if (tx.amount < 0) {
        data.expenses += tx.amount;
        // Track by cost center for tooltips
        const ccName = costCenters.find(cc => cc.id === tx.cost_center_id)?.name ?? 'Uncategorized';
        data.by_cost_center.set(ccName, (data.by_cost_center.get(ccName) || 0) + tx.amount);
      } else {
        data.income += tx.amount;
      }
    });

    const monthlySpending: MonthlySpending[] = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        total: data.total,
        expense_total: data.expenses,
        income_total: data.income,
        transaction_count: data.count,
        by_cost_center: Object.fromEntries(data.by_cost_center),
      }))
      .sort((a, b) => a.month.localeCompare(b.month)); // Sort by month ASC

    // Cost center spending
    const costCenterMap = new Map<number, {
      id: number;
      name: string;
      total: number;
      expenses: number;
      income: number;
      count: number;
    }>();

    transactions.forEach(tx => {
      const ccId = tx.cost_center_id;
      
      if (!costCenterMap.has(ccId)) {
        const cc = costCenters.find(c => c.id === ccId);
        costCenterMap.set(ccId, {
          id: ccId,
          name: cc?.name ?? 'Uncategorized',
          total: 0,
          expenses: 0,
          income: 0,
          count: 0,
        });
      }
      
      const data = costCenterMap.get(ccId)!;
      data.total += tx.amount;
      data.count += 1;
      
      if (tx.amount < 0) {
        data.expenses += tx.amount;
      } else {
        data.income += tx.amount;
      }
    });

    const costCenterSpending: CostCenterSpending[] = Array.from(costCenterMap.values())
      .map(data => ({
        cost_center_id: data.id,
        cost_center_name: data.name,
        total: data.total,
        expense_total: data.expenses,
        income_total: data.income,
        transaction_count: data.count,
      }))
      .sort((a, b) => a.expense_total - b.expense_total); // Sort by expense ASC (biggest spending first)

    // Spend category stats
    const categoryMap = new Map<number, {
      id: number;
      name: string;
      total: number;
      expenses: number;
      income: number;
      count: number;
    }>();

    transactions.forEach(tx => {
      tx.spend_category_ids.forEach(catId => {
        if (!categoryMap.has(catId)) {
          const cat = spendCategories.find(c => c.id === catId);
          categoryMap.set(catId, {
            id: catId,
            name: cat?.name ?? 'Uncategorized',
            total: 0,
            expenses: 0,
            income: 0,
            count: 0,
          });
        }
        
        const data = categoryMap.get(catId)!;
        data.total += tx.amount;
        data.count += 1;
        
        if (tx.amount < 0) {
          data.expenses += tx.amount;
        } else {
          data.income += tx.amount;
        }
      });
    });

    const spendCategoryStats: SpendCategoryStats[] = Array.from(categoryMap.values())
      .map(data => ({
        spend_category_id: data.id,
        spend_category_name: data.name,
        total: data.total,
        expense_total: data.expenses,
        income_total: data.income,
        transaction_count: data.count,
      }))
      .sort((a, b) => a.expense_total - b.expense_total); // Sort by expense ASC

    // Balance timeline
    const sortedTransactions = [...transactions].sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      return dateCompare !== 0 ? dateCompare : a.id - b.id;
    });

    let balance = 0;
    const balanceTimeline: BalanceTimelinePoint[] = sortedTransactions.map(tx => {
      balance += tx.amount;
      const cc = costCenters.find(c => c.id === tx.cost_center_id);
      
      return {
        date: tx.date,
        balance,
        description: tx.description,
        amount: tx.amount,
        cost_center_name: cc?.name ?? 'Uncategorized',
      };
    });

    // Unique cost centers and categories in filtered set
    const uniqueCostCenters = new Set(transactions.map(tx => tx.cost_center_id));
    const uniqueSpendCategories = new Set(
      transactions.flatMap(tx => tx.spend_category_ids)
    );

    return {
      total_spent: totalSpent,
      total_income: totalIncome,
      total_cash: balance,
      total_transactions: transactions.length,
      total_cost_centers: uniqueCostCenters.size,
      total_spend_categories: uniqueSpendCategories.size,
      avg_expense: expenses.length ? totalSpent / expenses.length : 0,
      avg_income: incomes.length ? totalIncome / incomes.length : 0,
      monthly_spending: monthlySpending,
      cost_center_spending: costCenterSpending,
      spend_category_stats: spendCategoryStats,
      balance_timeline: balanceTimeline,
    };
  }

  // ============================================
  // BULK OPERATIONS
  // ============================================

  async bulkCreateTransactions(transactions: CreateTransactionData[]): Promise<void> {
    // Process each transaction individually
    for (const data of transactions) {
      await this.createTransaction(data);
    }
  }

  async clearAllData(): Promise<void> {
    await this.getDB();
    
    sessionStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify([]));
    sessionStorage.setItem(STORAGE_KEYS.COST_CENTERS, JSON.stringify([]));
    sessionStorage.setItem(STORAGE_KEYS.SPEND_CATEGORIES, JSON.stringify([]));
    sessionStorage.setItem(STORAGE_KEYS.NEXT_TX_ID, '1');
    sessionStorage.setItem(STORAGE_KEYS.NEXT_CC_ID, '1');
    sessionStorage.setItem(STORAGE_KEYS.NEXT_SC_ID, '1');
  }
}

// Export singleton instance
export const db = new Database();