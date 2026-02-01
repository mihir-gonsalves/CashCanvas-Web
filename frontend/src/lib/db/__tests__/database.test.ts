// lib/db/__tests__/database.test.ts
/**
 * Phase 1 Verification Tests
 * 
 * Run these tests in browser console to verify database functionality:
 * 
 * 1. Open your app in browser
 * 2. Open DevTools console
 * 3. Copy and paste test functions below
 * 4. Run: await testPhase1()
 */

import { db } from '../database';
import type { CreateTransactionData } from '@/types';

export async function testPhase1() {
  console.log('🧪 Phase 1: Database Foundation Tests\n');
  
  try {
    // Test 1: Initialize database
    console.log('Test 1: Initialize database...');
    await db.init();
    console.log('✅ Database initialized\n');
    
    // Test 2: Create cost center
    console.log('Test 2: Create cost center...');
    const sampleTxn: CreateTransactionData = {
      date: '2026-01-15',
      description: 'Test grocery purchase',
      amount: -45.67,
      account: 'Test Card',
      cost_center_name: 'Meals',
      spend_category_names: ['Groceries'],
      notes: 'Test note',
    };
    
    const created = await db.createTransaction(sampleTxn);
    console.log('✅ Transaction created:', created);
    console.log(`   ID: ${created.id}`);
    console.log(`   Cost Center ID: ${created.cost_center_id}`);
    console.log(`   Spend Category IDs: ${created.spend_category_ids}\n`);
    
    // Test 3: Verify metadata created
    console.log('Test 3: Verify metadata...');
    const costCenters = await db.getAllCostCenters();
    const spendCategories = await db.getAllSpendCategories();
    console.log('✅ Cost Centers:', costCenters);
    console.log('✅ Spend Categories:', spendCategories);
    console.log('');
    
    // Test 4: Create another transaction with same categories
    console.log('Test 4: Reuse existing categories...');
    const sampleTxn2: CreateTransactionData = {
      date: '2026-01-16',
      description: 'Another grocery purchase',
      amount: -32.10,
      account: 'Test Card',
      cost_center_name: 'Meals',
      spend_category_names: ['Groceries'],
      notes: null,
    };
    
    const created2 = await db.createTransaction(sampleTxn2);
    console.log('✅ Second transaction created:', created2);
    
    // Verify no duplicate categories
    const costCentersAfter = await db.getAllCostCenters();
    const spendCategoriesAfter = await db.getAllSpendCategories();
    console.log(`   Cost Centers count (should still be 1): ${costCentersAfter.length}`);
    console.log(`   Spend Categories count (should still be 1): ${spendCategoriesAfter.length}\n`);
    
    // Test 5: Update transaction
    console.log('Test 5: Update transaction...');
    const updated = await db.updateTransaction(created.id, {
      description: 'Updated description',
      amount: -50.00,
    });
    console.log('✅ Transaction updated:', updated);
    console.log('');
    
    // Test 6: Filter transactions
    console.log('Test 6: Filter transactions...');
    const filtered = await db.getFilteredTransactions({
      cost_center_ids: [created.cost_center_id],
    }, 1, 10);
    console.log('✅ Filtered transactions:', filtered);
    console.log(`   Total: ${filtered.total}`);
    console.log(`   Transactions: ${filtered.transactions.length}\n`);
    
    // Test 7: Get analytics
    console.log('Test 7: Compute analytics...');
    const analytics = await db.getAnalytics({});
    console.log('✅ Analytics computed:', {
      total_spent: analytics.total_spent,
      total_income: analytics.total_income,
      total_cash: analytics.total_cash,
      total_transactions: analytics.total_transactions,
    });
    console.log('');
    
    // Test 8: Delete transaction
    console.log('Test 8: Delete transaction...');
    await db.deleteTransaction(created.id);
    console.log('✅ Transaction deleted\n');
    
    // Test 9: Verify orphaned category cleanup
    console.log('Test 9: Verify category cleanup...');
    await db.deleteTransaction(created2.id);
    const finalCostCenters = await db.getAllCostCenters();
    const finalSpendCategories = await db.getAllSpendCategories();
    console.log(`✅ Cost Centers after cleanup: ${finalCostCenters.length} (should be 0)`);
    console.log(`✅ Spend Categories after cleanup: ${finalSpendCategories.length} (should be 0)\n`);
    
    // Test 10: Bulk create
    console.log('Test 10: Bulk create transactions...');
    const bulkTxns: CreateTransactionData[] = [
      {
        date: '2026-01-01',
        description: 'Bulk transaction 1',
        amount: -100,
        account: 'Test',
        cost_center_name: 'Shopping',
        spend_category_names: ['Clothing'],
      },
      {
        date: '2026-01-02',
        description: 'Bulk transaction 2',
        amount: -200,
        account: 'Test',
        cost_center_name: 'Shopping',
        spend_category_names: ['Electronics'],
      },
    ];
    
    await db.bulkCreateTransactions(bulkTxns);
    const afterBulk = await db.getFilteredTransactions({}, 1, 10);
    console.log(`✅ Bulk created ${bulkTxns.length} transactions`);
    console.log(`   Total transactions in DB: ${afterBulk.total}\n`);
    
    // Cleanup
    console.log('Cleaning up test data...');
    await db.clearAllData();
    console.log('✅ All test data cleared\n');
    
    console.log('🎉 Phase 1 tests completed successfully!\n');
    console.log('Next steps:');
    console.log('1. Review test results above');
    console.log('2. Check IndexedDB in DevTools (Application > Storage > IndexedDB)');
    console.log('3. Proceed to Phase 2 (CSV Parsing) when ready');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Export for browser console testing
if (typeof window !== 'undefined') {
  (window as any).testPhase1 = testPhase1;
}