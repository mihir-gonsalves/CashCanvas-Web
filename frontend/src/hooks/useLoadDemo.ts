// frontend/src/hooks/useLoadDemo.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { generateDemoData } from '@/lib/demo/generator';

/**
 * Mutation hook for loading demo data
 * 
 * Invalidates all queries on success to refresh all views
 * with newly generated demo transactions.
 */
export function useLoadDemo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (count: number = 200) => generateDemoData(count),
    onSuccess: () => {
      // Invalidate all queries to show demo data
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['cost-centers'] });
      queryClient.invalidateQueries({ queryKey: ['spend-categories'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}