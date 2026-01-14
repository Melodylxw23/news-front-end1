const API_BASE = import.meta.env.VITE_API_BASE || ''

const buildHeaders = () => {
  const token = localStorage.getItem('token')
  const h = { 'Content-Type': 'application/json' }
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
  if (!res.ok) throw new Error(await res.text())
  return res.status === 204 ? null : res.json()
}

export default { listArticles, getArticle, translatePreview, translateAndSave, approveTranslation, searchArticles, stats, deleteArticle }
