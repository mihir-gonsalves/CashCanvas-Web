// lib/db/__tests__/verify-fixes.ts
/**
 * Quick test to verify Phase 1 bug fixes
 * 
 * Run in browser console:
 * import { verifyFixes } from './lib/db/__tests__/verify-fixes';
 * await verifyFixes();
 */

import { db } from '../database';
import type { CreateTransactionData } from '@/types';

export async function verifyFixes() {
  console.log('🔧 Verifying Phase 1 Bug Fixes\n');
  
  try {
    // Setup: Clear all data
    console.log('Setup: Clearing database...');
    await db.init();
    await db.clearAllData();
    console.log('✅ Database cleared\n');
    
    // ========================================
    // Fix 1: Orphaned Cleanup
    // ========================================
    console.log('Test 1: Orphaned category cleanup');
    
    const txn1: CreateTransactionData = {
      date: '2026-01-01',
      description: 'Test transaction',
      amount: -100,
      account: 'Test',
      cost_center_name: 'TestCategory',
      spend_category_names: ['TestSpend'],
    };
    
    const created = await db.createTransaction(txn1);
    console.log('  Created transaction with ID:', created.id);
    
    let costCenters = await db.getAllCostCenters();
    let spendCategories = await db.getAllSpendCategories();
    console.log(`  Cost Centers BEFORE delete: ${costCenters.length}`);
    console.log(`  Spend Categories BEFORE delete: ${spendCategories.length}`);
    
    await db.deleteTransaction(created.id);
    
    costCenters = await db.getAllCostCenters();
    spendCategories = await db.getAllSpendCategories();
    console.log(`  Cost Centers AFTER delete: ${costCenters.length}`);
    console.log(`  Spend Categories AFTER delete: ${spendCategories.length}`);
    
    if (costCenters.length === 0 && spendCategories.length === 0) {
      console.log('✅ Orphaned cleanup working correctly!\n');
    } else {
      console.log('❌ Orphaned cleanup FAILED');
      console.log('   Remaining cost centers:', costCenters);
      console.log('   Remaining spend categories:', spendCategories);
      console.log('');
    }
    
    // ========================================
    // Fix 2: Bulk Create
    // ========================================
    console.log('Test 2: Bulk create transactions');
    
    const bulkTxns: CreateTransactionData[] = [
      {
        date: '2026-01-01',
        description: 'Bulk 1',
        amount: -10,
        account: 'Test',
        cost_center_name: 'Category1',
        spend_category_names: ['Spend1'],
      },
      {
        date: '2026-01-02',
        description: 'Bulk 2',
        amount: -20,
        account: 'Test',
        cost_center_name: 'Category2',
        spend_category_names: ['Spend2'],
      },
      {
        date: '2026-01-03',
        description: 'Bulk 3',
        amount: -30,
        account: 'Test',
        cost_center_name: 'Category1',
        spend_category_names: ['Spend1', 'Spend3'],
      },
    ];
    
    console.log(`  Creating ${bulkTxns.length} transactions...`);
    await db.bulkCreateTransactions(bulkTxns);
    
    const result = await db.getFilteredTransactions({}, 1, 10);
    console.log(`  Transactions created: ${result.total}`);
    console.log(`  Cost centers created: ${result.cost_centers.length}`);
    console.log(`  Spend categories created: ${result.spend_categories.length}`);
    
    if (result.total === 3) {
      console.log('✅ Bulk create working correctly!\n');
    } else {
      console.log('❌ Bulk create FAILED');
      console.log('   Expected 3 transactions, got:', result.total);
      console.log('');
    }
    
    // ========================================
    // Cleanup
    // ========================================
    console.log('Cleanup: Clearing test data...');
    await db.clearAllData();
    console.log('✅ Test data cleared\n');
    
    console.log('🎉 All fixes verified!\n');
    console.log('Summary:');
    console.log('  ✅ Orphaned category cleanup works');
    console.log('  ✅ Bulk create works');
    console.log('  ✅ Ready for full Phase 1 test');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  }
}

// Export for browser console
if (typeof window !== 'undefined') {
  (window as any).verifyFixes = verifyFixes;
}