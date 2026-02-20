const API_BASE = import.meta.env.VITE_API_BASE || ''

const buildHeaders = () => {
  const token = localStorage.getItem('token')
  const h = { 'Content-Type': 'application/json', 'Accept': 'application/json' }
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

const join = (path) => path.startsWith('http') ? path : `${API_BASE}${path}`


export async function listArticles(page = 1, pageSize = 20, status = null) {
  let url = `/api/articles?page=${page}&pageSize=${pageSize}`
  if (status) url += `&status=${encodeURIComponent(status)}`
  const res = await fetch(join(url), { headers: buildHeaders() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getArticle(id, lang) {
  const url = join(`/api/articles/${id}${lang ? `?lang=${encodeURIComponent(lang)}` : ''}`)
  const res = await fetch(url, { headers: buildHeaders() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function translatePreview(id, target = 'en', text = null) {
  const res = await fetch(join(`/api/articles/${id}/translate-preview`), { method: 'POST', headers: buildHeaders(), body: JSON.stringify({ TargetLanguage: target, Text: text }) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function translateAndSave(id, { TargetLanguage = 'en', EditedTranslation = null, AutoTranslateIfNoEdit = true, Text = null } = {}) {
  const body = { TargetLanguage, EditedTranslation, AutoTranslateIfNoEdit, Text }
  const res = await fetch(join(`/api/articles/${id}/translate-and-save`), { method: 'POST', headers: buildHeaders(), body: JSON.stringify(body) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function approveTranslation(id) {
  const res = await fetch(join(`/api/articles/${id}/translation/approve`), { method: 'POST', headers: buildHeaders() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function searchArticles(q, page = 1, pageSize = 20) {
  const url = join(`/api/articles/search?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`)
  const res = await fetch(url, { headers: buildHeaders() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function stats() {
  const res = await fetch(join('/api/articles/stats'), { headers: buildHeaders() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function deleteArticle(id) {
  if (!id) throw new Error('id required')
  const res = await fetch(join(`/api/articles/${id}`), { method: 'DELETE', headers: buildHeaders() })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    const msg = txt || res.statusText || `HTTP ${res.status}`
    throw new Error(msg)
  }
  const text = await res.text().catch(() => '')
  try { return text ? JSON.parse(text) : null } catch { return text }
}

export async function publishArticles(ids = []) {
  if (!Array.isArray(ids) || ids.length === 0) throw new Error('ids required')
  // legacy single-endpoint — prefer server's /api/publish batch endpoints
  const res = await fetch(join(`/api/articles/publish`), { method: 'POST', headers: buildHeaders(), body: JSON.stringify({ ids }) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// Batch publish using backend /api/publish/batch/publish
export async function batchPublish(articleIds = [], scheduledAt = null) {
  if (!Array.isArray(articleIds) || articleIds.length === 0) throw new Error('articleIds required')
  const body = { articleIds, scheduledAt }
  const res = await fetch(join(`/api/publish/batch/publish`), { method: 'POST', headers: buildHeaders(), body: JSON.stringify(body) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// Batch save drafts using /api/publish/batch/save
export async function batchSaveDrafts(dtos = []) {
  if (!Array.isArray(dtos) || dtos.length === 0) throw new Error('body required')
  const res = await fetch(join(`/api/publish/batch/save`), { method: 'POST', headers: buildHeaders(), body: JSON.stringify(dtos) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// POST /api/publish/suggest - ask server to run AI analysis and return suggestions
export async function suggestPublish(articleIds = []) {
  if (!Array.isArray(articleIds) || articleIds.length === 0) throw new Error('articleIds required')
  const res = await fetch(join(`/api/publish/suggest`), { method: 'POST', headers: buildHeaders(), body: JSON.stringify({ articleIds }) })
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`)
  try { return JSON.parse(text) } catch (e) { return text }
}

// Batch unpublish using /api/publish/batch/unpublish
export async function batchUnpublish(articleIds = []) {
  if (!Array.isArray(articleIds) || articleIds.length === 0) throw new Error('articleIds required')
  const res = await fetch(join(`/api/publish/batch/unpublish`), { method: 'POST', headers: buildHeaders(), body: JSON.stringify({ articleIds }) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// GET /api/publish/{id} - load article + draft + tag lists
export async function getPublishDraft(id) {
  if (!id) throw new Error('id required')
  try {
    const res = await fetch(join(`/api/publish/${id}`), { headers: buildHeaders() })
    const text = await res.text()
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`)
    try { return JSON.parse(text) } catch (e) { return text }
  } catch (e) {
    // Network / protocol errors (HTTP/2 stream resets, etc.) can surface here.
    // Return null so callers can gracefully fallback to client-side payloads.
    try { console.debug('[api] getPublishDraft error', e) } catch (ignored) {}
    return null
  }
}

// GET /api/IndustryTags
export async function getIndustryTags() {
  const res = await fetch(join('/api/IndustryTags'), { headers: buildHeaders() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// GET /api/InterestTags
export async function getInterestTags() {
  const res = await fetch(join('/api/InterestTags'), { headers: buildHeaders() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// PATCH /api/publish/{id} - save single draft
export async function patchPublishDraft(id, dto) {
  if (!id) throw new Error('id required')
  const res = await fetch(join(`/api/publish/${id}`), { method: 'PATCH', headers: buildHeaders(), body: JSON.stringify(dto) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// POST /api/publish/{id}/generate-hero - request hero image generation
export async function generateHeroImage(id, body = {}) {
  if (!id) throw new Error('id required')
  const res = await fetch(join(`/api/publish/${id}/generate-hero`), { method: 'POST', headers: buildHeaders(), body: JSON.stringify(body) })
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`)
  try {
    return JSON.parse(text)
  } catch (e) {
    return text
  }
}

// POST /api/publish/{id}/publish - single publish/unpublish action
export async function publishAction(id, actionBody = {}) {
  if (!id) throw new Error('id required')
  // log request for easier debugging of 400s
  try {
    // eslint-disable-next-line no-console
    console.debug('[api] publishAction request:', { url: join(`/api/publish/${id}/publish`), body: actionBody })
  } catch (e) {}
  const res = await fetch(join(`/api/publish/${id}/publish`), { method: 'POST', headers: buildHeaders(), body: JSON.stringify(actionBody) })
  const text = await res.text()
  let parsedBody = null
  try { parsedBody = JSON.parse(text) } catch (e) { parsedBody = null }
  if (!res.ok) {
    try { console.debug('[api] publishAction response headers:', Object.fromEntries(res.headers.entries())) } catch (e) {}
    try { console.debug('[api] publishAction response body:', parsedBody ?? text) } catch (e) {}
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`)
  }
  return parsedBody !== null ? parsedBody : text
}

export default { listArticles, getArticle, translatePreview, translateAndSave, approveTranslation, searchArticles, stats, deleteArticle, publishArticles, batchPublish, batchSaveDrafts, batchUnpublish, getPublishDraft }