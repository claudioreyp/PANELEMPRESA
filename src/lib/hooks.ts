import { useCallback, useEffect, useRef, useState } from "react";

export function useResource<T>(loader: () => Promise<T>, dependencies: unknown[] = []) {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const dependencyKey = JSON.stringify(dependencies);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++request.current;
    setLoading(true);
    try { const next = await loaderRef.current(); if (version === request.current) { setData(next); setError(null); } }
    catch (caught) { if (version === request.current) setError(caught instanceof Error ? caught.message : "No se pudo cargar la información."); }
    finally { if (version === request.current) setLoading(false); }
  }, []);
  useEffect(() => {
    const requests = request;
    setData(null);
    void refresh();
    return () => { requests.current++; };
  }, [dependencyKey, refresh]);
  return { data, loading, error, refresh, setData };
}
