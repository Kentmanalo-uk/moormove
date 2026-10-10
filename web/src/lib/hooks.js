import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api';

/**
 * Load `url` and keep it fresh every `every` ms while the page is visible.
 * @returns {{ data, error, loading, reload, setData }}
 */
export function useLive(url, { every = 0, params, skip = false } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!skip);
  const key = JSON.stringify([url, params]);
  const alive = useRef(true);

  const reload = useCallback(async ({ quiet = false } = {}) => {
    if (!url || skip) return;
    if (!quiet) setLoading(true);
    try {
      const next = await api.get(url, { params });
      if (alive.current) {
        setData(next);
        setError('');
      }
    } catch (err) {
      if (alive.current && !quiet) setError(err.message);
    } finally {
      if (alive.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, skip]);

  useEffect(() => {
    alive.current = true;
    reload();
    if (!every) return () => { alive.current = false; };
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') reload({ quiet: true });
    }, every);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, [reload, every]);

  return { data, error, loading, reload, setData };
}

/**
 * While `on`, report the phone's position to the server about every 20 s.
 * @returns {{ position, problem }}
 */
export function useShareLocation(on) {
  const [position, setPosition] = useState(null);
  const [problem, setProblem] = useState('');
  const lastSent = useRef(0);

  useEffect(() => {
    if (!on) return undefined;
    if (!('geolocation' in navigator)) {
      setProblem('This phone cannot share its location.');
      return undefined;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(p);
        setProblem('');
        if (Date.now() - lastSent.current > 20000) {
          lastSent.current = Date.now();
          api.post('/rider/location', p).catch(() => {});
        }
      },
      (err) => setProblem(err.code === 1 ? 'Allow location so customers can follow you.' : 'Looking for your location…'),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [on]);

  return { position, problem };
}

/** The current position once (for "Use my location"). */
export const locateOnce = () => new Promise((resolve, reject) => {
  if (!('geolocation' in navigator)) {
    reject(new Error('This device cannot share its location'));
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    (err) => reject(new Error(err.code === 1 ? 'Allow location access to use this' : 'Could not find your location')),
    { enableHighAccuracy: true, timeout: 15000 },
  );
});

// /info hardly changes: fetched once per visit and shared by every page.
let infoCache = null;
let infoRequest = null;

/**
 * MoorMove's public info (support contacts, fares from, and whether people
 * can book deliveries here: `publicBooking`). Null until loaded.
 */
export function useInfo() {
  const [info, setInfo] = useState(infoCache);
  useEffect(() => {
    if (infoCache) return undefined;
    let live = true;
    infoRequest = infoRequest || api.get('/info').then((d) => { infoCache = d; return d; }).catch(() => { infoRequest = null; return null; });
    infoRequest.then((d) => live && d && setInfo(d));
    return () => { live = false; };
  }, []);
  return info;
}
