// lib/db/schema.ts
import type { DBSchema } from 'idb';

export interface CashCanvasDB extends DBSchema {
  transactions: {
    key: number;
    value: {
      id: number;                    // Auto-increment
      date: string;                  // ISO format: YYYY-MM-DD
      description: string;
      cost_center_id: number;
      spend_category_ids: number[];  // Array of IDs
      amount: number;
      account: string;
      notes: string | null;
    };
    indexes: {
      'by-date': string;  // Only index we need
    };
  };

  cost_centers: {
    key: number;
    value: {
      id: number;
      name: string;
    };
    indexes: {
      'by-name': string;  // For uniqueness checks
    };
  };

  spend_categories: {
    key: number;
    value: {
      id: number;
      name: string;
    };
    indexes: {
      'by-name': string;
    };
  };
}