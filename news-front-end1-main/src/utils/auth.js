export function parseJwt(token) {
  if (!token) return null
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const payload = parts[1]
    // base64url -> base64
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(b64)
        .split('')
        .map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        })
        .join('')
    )
    return JSON.parse(json)
  } catch (e) {
    return null
  }
}

function firstMatching(values) {
  for (const v of values) if (v !== undefined && v !== null) return v
  return undefined
}

export function getRoleFromToken(token) {
  const payload = parseJwt(token)
  if (!payload) return null
  // common claim names
  const roleCandidates = [
    payload.role,
    payload.roles,
    payload.Roles,
    payload.Role,
    payload.roles || payload.role,
    payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'],
    payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role'],
    payload['roles']
  ]
  const found = firstMatching(roleCandidates)
  if (!found) return null
  if (Array.isArray(found)) return String(found[0]).toLowerCase()
  if (typeof found === 'string') return found.toLowerCase()
  return String(found).toLowerCase()
}

export function getNameFromToken(token) {
  const payload = parseJwt(token)
  if (!payload) return null
  const nameCandidates = [
    payload.name,
    payload.unique_name,
    payload.given_name,
    payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name']
  ]
  const found = firstMatching(nameCandidates)
  return found ? String(found) : null
}
