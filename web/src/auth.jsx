import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { getToken, setToken } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!getToken());
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!getToken()) return;
    api.get('/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    const out = () => setUser(null);
    window.addEventListener('moormove:signed-out', out);
    return () => window.removeEventListener('moormove:signed-out', out);
  }, []);

  // The bell's number, kept fresh while signed in.
  const refreshUnread = useCallback(() => {
    api.get('/notifications/unread-count').then((d) => setUnread(d.count)).catch(() => {});
  }, []);
  useEffect(() => {
    if (!user) {
      setUnread(0);
      return undefined;
    }
    refreshUnread();
    const timer = setInterval(() => document.visibilityState === 'visible' && refreshUnread(), 20000);
    return () => clearInterval(timer);
  }, [user, refreshUnread]);

  const signIn = useCallback(({ token, user: signedIn }) => {
    setToken(token);
    setUser(signedIn);
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, setUser, ready, signIn, signOut, unread, refreshUnread }),
    [user, ready, signIn, signOut, unread, refreshUnread],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
