import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

// Reloads a list when its screen comes back into focus, such as after a create
// or edit screen closes. The first focus is skipped because the query already loads.
export function useRefetchOnFocus(refetch: () => void): void {
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      refetch();
    }, [refetch]),
  );
}
