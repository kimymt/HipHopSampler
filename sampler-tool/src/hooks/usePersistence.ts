import { useEffect, useState } from 'react';

const KEY = 'sampler.session.v1';

export const loadSession = () => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const saveSession = (data) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to save session:', err);
  }
};

export const usePersistedState = (key, initial) => {
  const [state, setState] = useState(() => {
    const session = loadSession();
    return session && key in session ? session[key] : initial;
  });

  useEffect(() => {
    const session = loadSession() || {};
    saveSession({ ...session, [key]: state });
  }, [key, state]);

  return [state, setState];
};
