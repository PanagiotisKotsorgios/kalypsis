import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export const api = axios.create({ baseURL, withCredentials: true });

api.interceptors.request.use((config) => {
  const raw = localStorage.getItem("kalypsis_auth");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { accessToken?: string };
      if (parsed.accessToken) {
        config.headers.Authorization = `Bearer ${parsed.accessToken}`;
      }
    } catch {
      /* ignore */
    }
  }
  return config;
});
