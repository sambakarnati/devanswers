import axios from 'axios';

// Configurable via VITE_API_BASE_URL (see .env.example); falls back to the
// backend's local dev default (devanswers-backend/.env PORT=5011).
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5011/api',
});

export default axiosInstance;
