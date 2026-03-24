import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export function authConfig(token) {
  if (!token) {
    return {}
  }

  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
}

export function getErrorMessage(error, fallback = 'Something went wrong.') {
  return error?.response?.data?.message || error?.message || fallback
}