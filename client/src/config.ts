// The backend base URL. In development this is http://localhost:5000 (from .env).
// In production (Netlify) we'll set VITE_API_URL to the Render backend URL.
export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";