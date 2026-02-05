// lib/demo/generator.ts
import { db } from '@/lib/db/database';
import type { CreateTransactionData } from '@/types';

  // ========================================================================
  // Types
  // ========================================================================

type CostCenter =
  | 'Living Expenses'
  | 'Car'
  | 'Meals'
  | 'Health'
  | 'Media'
  | 'Gifts'
  | 'Miscellaneous';

  // ========================================================================
  // Constants
  // ========================================================================

const COST_CENTER_WEIGHTS: Record<CostCenter, number> = {
  'Living Expenses': 30,
  'Car': 15,
  'Meals': 12,
  'Health': 4,
  'Media': 3,
  'Gifts': 3,
  'Miscellaneous': 5,
};

const COST_CENTER_TO_CATEGORIES: Record<CostCenter, string[]> = {
  'Living Expenses': ['Rent', 'Utilities'],
  'Car': ['Gas', 'Maintenance'],
  'Meals': ['Groceries', 'Restaurant'],
  'Health': ['Gym', 'Supplements'],
  'Media': ['Movies', 'Music'],
  'Gifts': ['Birthday', 'Donations'],
  'Miscellaneous': ['Other', 'Random'],
};

const CATEGORY_WEIGHTS: Record<CostCenter, Record<string, number>> = {
  'Living Expenses': { 'Rent': 95, 'Utilities': 5 },
  'Car': { 'Gas': 90, 'Maintenance': 10 },
  'Meals': { 'Groceries': 40, 'Restaurant': 60 },
  'Health': { 'Gym': 80, 'Supplements': 20 },
  'Media': { 'Movies': 70, 'Music': 30 },
  'Gifts': { 'Birthday': 75, 'Donations': 25 },
  'Miscellaneous': { 'Other': 50, 'Random': 50 },
};

const ACCOUNTS = ['Schwab Checking', 'Discover Card'] as const;

const MAX_TRANSACTIONS = 200;
const MONTHS_OF_HISTORY = 8;

  // ========================================================================
  // Helper Functions
  // ========================================================================

function randomDate(start: Date, end: Date): string {
  const date = new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
  return date.toISOString().split('T')[0];
}

function randomAmount(min: number, max: number): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

function randomChoice<T>(array: readonly T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function weightedCategoryChoice(costCenter: CostCenter): string {
  const weights = CATEGORY_WEIGHTS[costCenter];
  const categories = Object.keys(weights);
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
  
  let random = Math.random() * totalWeight;
  
  for (const category of categories) {
    random -= weights[category];
    if (random <= 0) {
      return category;
    }
  }
  
  return categories[categories.length - 1];
}

function getMonthlyDates(
  startDate: Date,
  endDate: Date,
  dayOfMonth: number
): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const date = new Date(
      current.getFullYear(),
      current.getMonth(),
      dayOfMonth
    );

    if (date >= startDate && date <= endDate) {
      dates.push(date.toISOString().split('T')[0]);
    }

    current.setMonth(current.getMonth() + 1);
  }

  return dates;
}

function getBiweeklyDates(startDate: Date, endDate: Date): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);

  // Start on a Friday (typical payday)
  while (current.getDay() !== 5) {
    current.setDate(current.getDate() + 1);
  }

  while (current <= endDate) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 14);
  }

  return dates;
}

  // ========================================================================
  // Demo Generation
  // ========================================================================

export async function generateDemoData(): Promise<void> {
  const transactions: CreateTransactionData[] = [];

  const today = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - MONTHS_OF_HISTORY);

  // ~$4000/month for expenses (66% of income)
  const monthlyExpenseBudget = 6000 * 0.66;

  // -----------------------------------------------------------------------------
  // Paychecks (skip first 2 months)
  // -----------------------------------------------------------------------------

  const paycheckStartDate = new Date(startDate);
  paycheckStartDate.setMonth(paycheckStartDate.getMonth() + 2);

  const paycheckDates = getBiweeklyDates(paycheckStartDate, today);

  paycheckDates.forEach(date => {
    transactions.push({
      date,
      description: 'Paycheck - Direct Deposit',
      amount: randomAmount(2900, 3100),
      account: 'Schwab Checking',
      cost_center_name: 'Income',
      spend_category_names: ['Salary'],
      notes: 'demo income txn',
    });
  });

  // -----------------------------------------------------------------------------
  // Living Expenses
  // -----------------------------------------------------------------------------

  const livingExpensesDates = getMonthlyDates(startDate, today, 3);
  const livingExpensesMonthly =
    monthlyExpenseBudget *
    (COST_CENTER_WEIGHTS['Living Expenses'] / 100);

  livingExpensesDates.forEach(date => {
    const rentAmount = livingExpensesMonthly * 0.95;
    const utilitiesAmount = livingExpensesMonthly * 0.05;
    
    transactions.push({
      date,
      description: 'Rent Payment',
      amount: -randomAmount(rentAmount * 0.98, rentAmount * 1.02),
      account: 'Schwab Checking',
      cost_center_name: 'Living Expenses',
      spend_category_names: ['Rent'],
      notes: 'demo expense txn',
    });
    
    transactions.push({
      date,
      description: 'Utilities Payment',
      amount: -randomAmount(utilitiesAmount * 0.8, utilitiesAmount * 1.2),
      account: 'Schwab Checking',
      cost_center_name: 'Living Expenses',
      spend_category_names: ['Utilities'],
      notes: 'demo expense txn',
    });
  });

  // -----------------------------------------------------------------------------
  // Other Expenses
  // -----------------------------------------------------------------------------

  const costCenters = (Object.keys(
    COST_CENTER_WEIGHTS
  ) as CostCenter[]).filter(cc => cc !== 'Living Expenses');

  // Calculate how many expense transactions we can generate
  const usedTransactions = paycheckDates.length + (livingExpensesDates.length * 2); // *2 for rent + utilities
  const remainingTransactions = MAX_TRANSACTIONS - usedTransactions;

  // Distribute remaining transactions across cost centers by weight
  const totalWeight = costCenters.reduce(
    (sum, cc) => sum + COST_CENTER_WEIGHTS[cc],
    0
  );

  costCenters.forEach(costCenter => {
    const weight = COST_CENTER_WEIGHTS[costCenter];
    const numTransactions = Math.floor(
      (weight / totalWeight) * remainingTransactions
    );

    for (let i = 0; i < numTransactions; i++) {
      let categories: string[];
      
      if (costCenter === 'Miscellaneous') {
        // Always use both categories for Miscellaneous
        categories = ['Other', 'Random'];
      } else {
        categories = [weightedCategoryChoice(costCenter)];
      }

      transactions.push({
        date: randomDate(startDate, today),
        description: `${costCenter} purchase`,
        amount: -randomAmount(10, 150),
        account: randomChoice(ACCOUNTS),
        cost_center_name: costCenter,
        spend_category_names: categories,
        notes: 'demo expense txn',
      });
    }
  });

  await db.bulkCreateTransactions(transactions);
}

  // ========================================================================
  // Demo Check
  // ========================================================================

export async function isDemoDataLoaded(): Promise<boolean> {
  const { total } = await db.getFilteredTransactions({}, 1, 1);
  return total > 0;
}