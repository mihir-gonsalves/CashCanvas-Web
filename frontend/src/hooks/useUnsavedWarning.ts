// frontend/src/hooks/useUnsavedChangesWarning.ts
import { useEffect } from 'react';

/**
 * Displays browser warning when user attempts to close/reload tab with unsaved data
 * 
 * Checks sessionStorage for any CashCanvas data and triggers the browser's native
 * "unsaved changes" dialog. Note: Modern browsers show generic messages only;
 * custom text is ignored for security reasons.
 * 
 * Warning appears when:
 * - User closes tab, reloads page, or navigates away
 * - sessionStorage contains any keys prefixed with 'cashcanvas_'
 */
export function useUnsavedChangesWarning() {
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Check if any CashCanvas data exists in sessionStorage
      const hasData = Object.keys(sessionStorage).some((key) =>
        key.startsWith('cashcanvas_')
      );

      if (hasData) {
        // Trigger browser's native warning dialog
        // Modern browsers ignore custom messages, but this is required
        e.preventDefault();
        e.returnValue = ''; // Chrome requires this
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
}