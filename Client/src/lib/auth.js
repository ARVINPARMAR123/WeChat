function normalizeBase64Url(value) {
  return value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=')
}

export function decodeToken(token) {
  if (!token) {
    return null
  }

  try {
    const [, payload] = token.split('.')

    if (!payload) {
      return null
    }

    return JSON.parse(atob(normalizeBase64Url(payload)))
  } catch {
    return null
  }
}