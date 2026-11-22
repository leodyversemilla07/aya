'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Reads and writes one URL search parameter, so list filters survive reloads
 * and can be shared as links. The fallback value removes the parameter to
 * keep URLs clean. Updates replace history instead of pushing entries.
 */
export function useUrlFilterState(
  key: string,
  fallback: string,
): [string, (value: string) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const value = searchParams.get(key) ?? fallback;

  const setValue = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === fallback) {
        params.delete(key);
      } else {
        params.set(key, next);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname, key, fallback],
  );

  return [value, setValue];
}

/**
 * Same as {@link useUrlFilterState} but keeps a local input value that is
 * written to the URL after a short delay, so text search does not churn the
 * router on every keystroke. External URL changes (back/forward) still sync.
 */
export function useDebouncedUrlFilterState(
  key: string,
  fallback: string,
  delay = 300,
): [string, (value: string) => void] {
  const [value, setValue] = useUrlFilterState(key, fallback);
  const [input, setInput] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Follow external URL changes (browser navigation), not our own debounced writes.
  useEffect(() => {
    setInput(value);
  }, [value]);

  const setBoth = useCallback(
    (next: string) => {
      setInput(next);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setValue(next), delay);
    },
    [setValue, delay],
  );

  return [input, setBoth];
}
