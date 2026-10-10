import axios from 'axios';

const TOKEN_KEY = 'moormove.token';

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private mode: signed in for this visit only.
  }
};

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 20000 });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Answers come back as their `data`; failures as an Error with the server's
// message and per-field `errors`.
api.interceptors.response.use(
  (res) => res.data?.data ?? res.data,
  (err) => {
    const body = err.response?.data;
    const error = new Error(body?.message || (err.response ? 'Something went wrong' : 'Cannot reach MoorMove. Check your connection.'));
    error.status = err.response?.status;
    error.errors = body?.errors || {};
    if (error.status === 401 && getToken()) {
      setToken(null);
      window.dispatchEvent(new Event('moormove:signed-out'));
    }
    return Promise.reject(error);
  },
);

export default api;
