// lib/demo/generator.ts
import { db } from '@/lib/db/database';
import type { CreateTransactionData } from '@/types';

const COST_CENTER_TO_CATEGORIES: Record<string, string[]> = {
  'Living Expenses': ['Rent', 'Utilities'],
  'Car': ['Gas', 'Maintenance'],
  'Meals': ['Groceries', 'Restaurant'],
  'Health': ['Gym', 'Supplements'],
  'Media': ['Movies', 'Music'],
  'Gifts': ['Birthday', 'Donations'],
};

const COST_CENTERS = Object.keys(COST_CENTER_TO_CATEGORIES);

const ACCOUNTS = ['Schwab Checking', 'Discover Card'];

function randomDate(start: Date, end: Date): string {
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString().split('T')[0];
}

function randomAmount(min: number, max: number): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomChoices<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

export async function generateDemoData(count: number = 200): Promise<void> {
  const transactions: CreateTransactionData[] = [];

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const today = new Date();

  // Generate expenses
  for (let i = 0; i < count * 0.95; i++) { // 90% expenses
    const costCenter = randomChoice(COST_CENTERS);
    const allowedCategories = COST_CENTER_TO_CATEGORIES[costCenter];

    const categoryCount =
      allowedCategories.length > 1 && Math.random() > 0.7 ? 2 : 1;

    const categories = randomChoices(allowedCategories, categoryCount);

    transactions.push({
      date: randomDate(oneYearAgo, today),
      description: `${costCenter} purchase ${i + 1}`,
      amount: -randomAmount(5, 150),
      account: randomChoice(ACCOUNTS),
      cost_center_name: costCenter,
      spend_category_names: categories,
      notes: 'Demo transaction',
    });
  }

  // Generate income
  for (let i = 0; i < count * 0.05; i++) { // 10% income
    transactions.push({
      date: randomDate(oneYearAgo, today),
      description: `Paycheck ${i + 1}`,
      amount: randomAmount(1000, 3000),
      account: 'Schwab Checking',
      cost_center_name: 'Income',
      spend_category_names: ['Salary'],
      notes: null,
    });
  }

  // Bulk insert
  await db.bulkCreateTransactions(transactions);
}

export async function isDemoDataLoaded(): Promise<boolean> {
  const { total } = await db.getFilteredTransactions({}, 1, 1);
  return total > 0;
}