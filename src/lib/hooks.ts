import { useCallback, useEffect, useRef, useState } from "react";

export function useResource<T>(loader: () => Promise<T>, dependencies: unknown[] = []) {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const dependencyKey = JSON.stringify(dependencies);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    try { setData(await loaderRef.current()); setError(null); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo cargar la información."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [dependencyKey, refresh]);
  return { data, loading, error, refresh, setData };
}
