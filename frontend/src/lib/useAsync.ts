import { useCallback, useEffect, useState } from 'react';

/** Carrega dados de forma assíncrona com estado de loading/erro e reload(). */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  const reload = useCallback(async () => {
    try {
      setError(null);
      setData(await run());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [run]);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  return { data, setData, error, loading, reload };
}
