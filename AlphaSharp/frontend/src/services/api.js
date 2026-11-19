import axios from 'axios';
import { API_BASE_URL, API_TIMEOUT } from '../utils/constants';

// The demo gate is intentionally local-only. API calls carry no hosted auth token.
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT.DEFAULT,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => Promise.reject(error)
);

export default api;
