const API_BASE = import.meta.env.VITE_API_BASE || ''

const buildHeaders = () => {
  const token = localStorage.getItem('token')
  const h = { 'Content-Type': 'application/json' }
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

const join = (path) => path.startsWith('http') ? path : `${API_BASE}${path}`

// Generate Text Summary
export async function generateSummary(newsId, customPrompt = null) {
  const body = { newsId }
  if (customPrompt) body.customPrompt = customPrompt
  
  const res = await fetch(join('/api/contentcreation/generate-summary'), {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// Generate PDF Poster
export async function generatePDF(newsId, template = null, customPrompt = null) {
  const body = { newsId }
  if (template) body.template = template
  if (customPrompt) body.customPrompt = customPrompt
  
  const res = await fetch(join('/api/contentcreation/generate-pdf'), {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// Generate PPT Slides
export async function generatePPT(newsId, numberOfSlides = null, template = null, customPrompt = null) {
  const body = { newsId }
  if (numberOfSlides) body.numberOfSlides = numberOfSlides
  if (template) body.template = template
  if (customPrompt) body.customPrompt = customPrompt
  
  const res = await fetch(join('/api/contentcreation/generate-ppt'), {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// Get Active Articles (translated, ready for content creation)
export async function getActiveArticles() {
  const res = await fetch(join('/api/contentcreation/active'), {
    headers: buildHeaders()
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// Get Completed Articles (all assets generated)
export async function getCompletedArticles() {
  const res = await fetch(join('/api/contentcreation/completed'), {
    headers: buildHeaders()
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// Get saved summary for an article
export async function getSummary(newsId) {
  const res = await fetch(join(`/api/contentcreation/summary/${newsId}`), {
    headers: buildHeaders()
  })
  if (!res.ok) {
    if (res.status === 404) return null // No saved summary yet
    throw new Error(await res.text())
  }
  return res.json()
}

// Save/update summary for an article
export async function saveSummary(summaryId, summaryText, editNotes = null) {
  const body = { summaryId, summaryText }
  if (editNotes) body.editNotes = editNotes
  
  const res = await fetch(join('/api/contentcreation/edit-summary'), {
    method: 'PUT',
    headers: buildHeaders(),
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// Delete summary for an article
export async function deleteSummary(newsId) {
  const res = await fetch(join(`/api/contentcreation/summary/${newsId}`), {
    method: 'DELETE',
    headers: buildHeaders()
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// Delete poster for an article
export async function deletePoster(newsId) {
  const res = await fetch(join(`/api/contentcreation/poster/${newsId}`), {
    method: 'DELETE',
    headers: buildHeaders()
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// Delete PPT for an article
export async function deletePPT(newsId) {
  const res = await fetch(join(`/api/contentcreation/ppt/${newsId}`), {
    method: 'DELETE',
    headers: buildHeaders()
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// Get saved poster for an article
export async function getPoster(newsId) {
  const res = await fetch(join(`/api/contentcreation/poster/${newsId}`), {
    headers: buildHeaders()
  })
  if (!res.ok) {
    if (res.status === 404) return null // No saved poster yet
    throw new Error(await res.text())
  }
  return res.json()
}

// Save poster for an article
export async function savePoster(newsId, pdfPath) {
  const body = { newsId, pdfPath }
  
  const res = await fetch(join('/api/contentcreation/save-poster'), {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export default {
  generateSummary,
  generatePDF,
  generatePPT,
  getActiveArticles,
  getCompletedArticles,
  getSummary,
  saveSummary,
  deleteSummary,
  getPoster,
  savePoster,
  deletePoster,
  deletePPT
}
