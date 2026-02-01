// lib/csv/__tests__/parsers.test.ts
/**
 * Phase 2: CSV Parsing Tests
 * 
 * These tests verify that CSV parsing works correctly for all three supported formats.
 * 
 * To run in browser:
 * 1. Import test functions
 * 2. Use the file input helpers to load test CSVs
 * 3. Run: await testPhase2()
 */

import { parseCSVFile } from '../parsers';
import type { CreateTransactionData } from '@/types';

/**
 * Helper function to create a File object from text content.
 * Used for testing without actual file uploads.
 */
function createTestFile(content: string, filename: string): File {
  const blob = new Blob([content], { type: 'text/csv' });
  return new File([blob], filename, { type: 'text/csv' });
}

// ============================================
// TEST DATA
// ============================================

const DISCOVER_CSV = `Trans. Date,Post Date,Description,Amount,Category
01/15/2026,01/16/2026,WHOLE FOODS MARKET,45.67,Groceries
01/14/2026,01/15/2026,SHELL OIL,32.10,Gas/Automotive
01/13/2026,01/14/2026,NETFLIX.COM,-15.99,Services
01/12/2026,01/13/2026,AMAZON.COM,127.50,Merchandise
01/11/2026,01/12/2026,STARBUCKS,5.75,Restaurants`;

const SCHWAB_CSV = `Date,Status,Type,CheckNumber,Description,Withdrawal,Deposit,RunningBalance
01/15/2026,Posted,CHECK,,Check #1234,500.00,,2500.00
01/14/2026,Posted,ACH,,PAYCHECK DEPOSIT,,3000.00,3000.00
01/13/2026,Posted,DEBIT,,ATM WITHDRAWAL,100.00,,0.00
01/12/2026,Posted,DEBIT,,GROCERY STORE,75.50,,100.00
01/11/2026,Posted,TRANSFER,,TRANSFER FROM SAVINGS,,200.00,175.50`;

const CASHCANVAS_CSV = `Date,Description,Amount,Account,Cost Center,Spend Categories,Notes
2026-01-15,Grocery shopping,-45.67,Discover,Meals,Groceries,Weekly groceries
2026-01-14,Gas station,-32.10,Discover,Transportation,Gas,
2026-01-13,Netflix subscription,-15.99,Discover,Entertainment,"Streaming, Subscriptions",Monthly subscription
2026-01-12,Amazon purchase,-127.50,Discover,Shopping,"Electronics, Books",
2026-01-11,Paycheck,3000.00,Schwab Checking,Income,Salary,Bi-weekly paycheck`;

const INVALID_CSV = `Not,A,Valid,CSV
This,Will,Fail,Parsing`;

const MALFORMED_DISCOVER_CSV = `Trans. Date,Post Date,Description,Amount,Category
,01/16/2026,MISSING DATE,45.67,Groceries
01/14/2026,01/15/2026,,32.10,Gas
01/13/2026,01/14/2026,INVALID AMOUNT,not-a-number,Services`;

// ============================================
// TESTS
// ============================================

export async function testPhase2() {
  console.log('🧪 Phase 2: CSV Parsing Tests\n');
  
  let passedTests = 0;
  let failedTests = 0;
  
  try {
    // ========================================
    // Test 1: Discover Parser
    // ========================================
    console.log('Test 1: Parse Discover CSV');
    try {
      const file = createTestFile(DISCOVER_CSV, 'discover.csv');
      const transactions = await parseCSVFile(file, 'discover');
      
      console.log(`  ✅ Parsed ${transactions.length} transactions`);
      
      // Verify first transaction
      const first = transactions[0];
      console.log('  First transaction:');
      console.log(`    Date: ${first.date} (expected: 2026-01-15)`);
      console.log(`    Description: ${first.description}`);
      console.log(`    Amount: ${first.amount} (expected: -45.67, negative = expense)`);
      console.log(`    Account: ${first.account} (expected: Discover)`);
      console.log(`    Cost Center: ${first.cost_center_name} (expected: Groceries)`);
      
      // Verify amount sign conversion
      // Discover CSV: positive = expense (should become negative in DB)
      // Discover CSV: negative = credit (should become positive in DB)
      const expense = transactions.find(t => t.description === 'WHOLE FOODS MARKET');
      const credit = transactions.find(t => t.description === 'NETFLIX.COM');
      
      if (expense && expense.amount === -45.67) {
        console.log('  ✅ Expense amount correctly negated');
      } else {
        console.log('  ❌ Expense amount incorrect:', expense?.amount);
        failedTests++;
      }
      
      if (credit && credit.amount === 15.99) {
        console.log('  ✅ Credit amount correctly converted to positive');
      } else {
        console.log('  ❌ Credit amount incorrect:', credit?.amount);
        failedTests++;
      }
      
      passedTests++;
      console.log('');
    } catch (error) {
      console.error('  ❌ Test failed:', error);
      failedTests++;
      console.log('');
    }
    
    // ========================================
    // Test 2: Schwab Parser
    // ========================================
    console.log('Test 2: Parse Schwab CSV');
    try {
      const file = createTestFile(SCHWAB_CSV, 'schwab.csv');
      const transactions = await parseCSVFile(file, 'schwab');
      
      console.log(`  ✅ Parsed ${transactions.length} transactions`);
      
      // Verify withdrawal vs deposit
      const withdrawal = transactions.find(t => t.description === 'Check #1234');
      const deposit = transactions.find(t => t.description === 'PAYCHECK DEPOSIT');
      
      console.log('  Withdrawal transaction:');
      console.log(`    Amount: ${withdrawal?.amount} (expected: -500.00)`);
      
      console.log('  Deposit transaction:');
      console.log(`    Amount: ${deposit?.amount} (expected: 3000.00)`);
      
      if (withdrawal?.amount === -500 && deposit?.amount === 3000) {
        console.log('  ✅ Withdrawal and deposit amounts correct');
        passedTests++;
      } else {
        console.log('  ❌ Amount conversion incorrect');
        failedTests++;
      }
      
      console.log('');
    } catch (error) {
      console.error('  ❌ Test failed:', error);
      failedTests++;
      console.log('');
    }
    
    // ========================================
    // Test 3: CashCanvas Parser
    // ========================================
    console.log('Test 3: Parse CashCanvas CSV');
    try {
      const file = createTestFile(CASHCANVAS_CSV, 'cashcanvas.csv');
      const transactions = await parseCSVFile(file, 'cashcanvas');
      
      console.log(`  ✅ Parsed ${transactions.length} transactions`);
      
      // Verify multi-category parsing
      const netflix = transactions.find(t => t.description === 'Netflix subscription');
      const amazon = transactions.find(t => t.description === 'Amazon purchase');
      
      console.log('  Multi-category transaction:');
      console.log(`    Netflix categories: ${netflix?.spend_category_names?.join(', ')}`);
      console.log(`    Expected: Streaming, Subscriptions`);
      
      console.log('  Another multi-category transaction:');
      console.log(`    Amazon categories: ${amazon?.spend_category_names?.join(', ')}`);
      console.log(`    Expected: Electronics, Books`);
      
      if (
        netflix?.spend_category_names?.length === 2 &&
        amazon?.spend_category_names?.length === 2
      ) {
        console.log('  ✅ Multiple categories parsed correctly');
        passedTests++;
      } else {
        console.log('  ❌ Category parsing incorrect');
        failedTests++;
      }
      
      console.log('');
    } catch (error) {
      console.error('  ❌ Test failed:', error);
      failedTests++;
      console.log('');
    }
    
    // ========================================
    // Test 4: Invalid Institution
    // ========================================
    console.log('Test 4: Invalid institution name');
    try {
      const file = createTestFile(DISCOVER_CSV, 'test.csv');
      await parseCSVFile(file, 'invalid-bank');
      console.log('  ❌ Should have thrown error for invalid institution');
      failedTests++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('Unknown institution')) {
        console.log('  ✅ Correctly rejected invalid institution');
        console.log(`     Error: ${message}`);
        passedTests++;
      } else {
        console.log('  ❌ Wrong error message:', message);
        failedTests++;
      }
    }
    console.log('');
    
    // ========================================
    // Test 5: Malformed CSV
    // ========================================
    console.log('Test 5: Malformed CSV (missing data)');
    try {
      const file = createTestFile(MALFORMED_DISCOVER_CSV, 'malformed.csv');
      await parseCSVFile(file, 'discover');
      console.log('  ❌ Should have thrown validation error');
      failedTests++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('validation failed')) {
        console.log('  ✅ Correctly rejected malformed CSV');
        console.log(`     Error: ${message.slice(0, 100)}...`);
        passedTests++;
      } else {
        console.log('  ❌ Wrong error type:', message);
        failedTests++;
      }
    }
    console.log('');
    
    // ========================================
    // Test 6: Header Validation
    // ========================================
    console.log('Test 6: CSV with wrong headers');
    try {
      const file = createTestFile(INVALID_CSV, 'wrong-headers.csv');
      await parseCSVFile(file, 'discover');
      console.log('  ❌ Should have thrown header validation error');
      failedTests++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('Missing columns')) {
        console.log('  ✅ Correctly rejected CSV with wrong headers');
        console.log(`     Error: ${message.slice(0, 100)}...`);
        passedTests++;
      } else {
        console.log('  ❌ Wrong error type:', message);
        failedTests++;
      }
    }
    console.log('');
    
    // ========================================
    // Test 7: Empty/Whitespace Handling
    // ========================================
    console.log('Test 7: Handle empty values and whitespace');
    try {
      const csvWithSpaces = `Trans. Date,Post Date,Description,Amount,Category
01/15/2026,01/16/2026,  PADDED DESCRIPTION  ,45.67,  Groceries  
01/14/2026,01/15/2026,NORMAL,32.10,`;
      
      const file = createTestFile(csvWithSpaces, 'spaces.csv');
      const transactions = await parseCSVFile(file, 'discover');
      
      const padded = transactions[0];
      console.log(`  Description (trimmed): "${padded.description}"`);
      console.log(`  Cost center (defaulted): "${padded.cost_center_name}"`);
      
      if (
        padded.description === 'PADDED DESCRIPTION' &&
        padded.cost_center_name === 'Groceries' &&
        transactions[1].cost_center_name === 'Uncategorized'
      ) {
        console.log('  ✅ Whitespace trimmed and empty values handled');
        passedTests++;
      } else {
        console.log('  ❌ Whitespace/empty handling incorrect');
        failedTests++;
      }
    } catch (error) {
      console.error('  ❌ Test failed:', error);
      failedTests++;
    }
    console.log('');
    
    // ========================================
    // Test 8: Date Format Validation
    // ========================================
    console.log('Test 8: Date format validation');
    try {
      const invalidDateCSV = `Trans. Date,Post Date,Description,Amount,Category
invalid-date,01/16/2026,TEST,45.67,Groceries`;
      
      const file = createTestFile(invalidDateCSV, 'bad-date.csv');
      await parseCSVFile(file, 'discover');
      console.log('  ❌ Should have rejected invalid date');
      failedTests++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('date')) {
        console.log('  ✅ Correctly rejected invalid date format');
        passedTests++;
      } else {
        console.log('  ❌ Wrong error:', message);
        failedTests++;
      }
    }
    console.log('');
    
    // ========================================
    // Summary
    // ========================================
    console.log('═'.repeat(60));
    console.log('Phase 2 Test Summary');
    console.log('═'.repeat(60));
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`📊 Total:  ${passedTests + failedTests}`);
    console.log('');
    
    if (failedTests === 0) {
      console.log('🎉 All Phase 2 tests passed!\n');
      console.log('Next steps:');
      console.log('1. Test with real CSV files from your bank');
      console.log('2. Verify CSV upload in the UI');
      console.log('3. Proceed to Phase 3 (Demo Data) when ready');
    } else {
      console.log('⚠️  Some tests failed. Review errors above.\n');
    }
    
  } catch (error) {
    console.error('❌ Test suite crashed:', error);
    throw error;
  }
}

// Export for browser console
if (typeof window !== 'undefined') {
  (window as any).testPhase2 = testPhase2;
}

// ============================================
// Manual Testing Helper
// ============================================

/**
 * Helper for testing with actual file uploads in the browser.
 * 
 * Usage:
 * 1. Create file input: <input type="file" id="csvInput" accept=".csv" />
 * 2. In console: await testRealFile('discover')
 */
export async function testRealFile(institution: string): Promise<CreateTransactionData[]> {
  const input = document.getElementById('csvInput') as HTMLInputElement;
  
  if (!input || !input.files || input.files.length === 0) {
    throw new Error('No file selected. Create an input element: <input type="file" id="csvInput" accept=".csv" />');
  }
  
  const file = input.files[0];
  console.log(`Parsing ${file.name} as ${institution}...`);
  
  const transactions = await parseCSVFile(file, institution);
  
  console.log(`✅ Successfully parsed ${transactions.length} transactions`);
  console.log('First 3 transactions:', transactions.slice(0, 3));
  
  return transactions;
}

if (typeof window !== 'undefined') {
  (window as any).testRealFile = testRealFile;
}