import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || ''

const apiFetch = async (path, opts = {}) => {
  const token = localStorage.getItem('token')
  const headers = { 'Content-Type': 'application/json', ...opts.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const fullPath = path.startsWith('http') ? path : `${API_BASE.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(fullPath, { ...opts, headers })
  const text = await res.text().catch(() => '')
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`)
  try { return text ? JSON.parse(text) : null } catch (e) { return text }
}

export default function MemberArticleDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [article, setArticle] = useState(null)
  const [payload, setPayload] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await apiFetch(`/api/articles/${id}`)
        setPayload(res)
        const a = res?.article || res?.Article || res
        setArticle(a)
      } catch (e) {
        setError(e.message || 'Failed to load article')
      } finally {
        setLoading(false)
      }
    }
    if (id) load()
  }, [id])

  const title =
    article?.title ?? article?.Title ??
    article?.titleEN ?? article?.TitleEN ??
    article?.titleZH ?? article?.TitleZH ??
    'Untitled'

  const publishedAt = article?.publishedAt ?? article?.PublishedAt
  const author = article?.author ?? article?.Author

  const content =
    article?.fullContentEN ?? article?.fullContentEn ?? article?.FullContentEN ??
    article?.fullContentZH ?? article?.fullContentZh ?? article?.FullContentZH ??
    article?.fullContent ?? article?.FullContent ??
    payload?.translatedContent ?? payload?.TranslatedContent ??
    payload?.originalContent ?? payload?.OriginalContent ??
    payload?.Translated ?? payload?.Original ??
    article?.summary ?? article?.Summary ??
    article?.summaryEN ?? article?.SummaryEN ??
    article?.summaryZH ?? article?.SummaryZH ??
    ''

  return (
    <div style={{ padding: '32px 40px', minHeight: '100vh', background: '#f7fbff' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <button
          onClick={() => navigate('/member/articles')}
          style={{
            marginBottom: 16,
            background: 'transparent',
            border: 'none',
            color: '#b91c1c',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          ← Back to Articles
        </button>

        {loading && <div style={{ color: '#6b7280' }}>Loading article…</div>}
        {error && <div style={{ padding: 16, background: '#fee2e2', color: '#991b1b', borderRadius: 8 }}>{error}</div>}

        {!loading && !error && (
          <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 6px 18px rgba(0,0,0,0.06)' }}>
            <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 8 }}>
              {publishedAt ? new Date(publishedAt).toLocaleString() : 'Published'}
            </div>
            <h1 style={{ margin: '0 0 12px', fontSize: 28, fontWeight: 800, color: '#111827' }}>{title}</h1>
            {author && <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>By {author}</div>}
            <div style={{ color: '#374151', fontSize: 15, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {content || 'No content available.'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
