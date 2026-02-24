import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Toast from '../components/Toast'

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

export default function PublicArticles() {
  const [articles, setArticles] = useState([])
  const [savedIds, setSavedIds] = useState(new Set())
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // remember this public listing path so detail pages can return here
    try { sessionStorage.setItem('lastPublicPath', '/public-articles') } catch (e) {}

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        // try the dedicated published endpoint first
        let res = null
        try {
          res = await apiFetch('/api/articles/published?page=1&pageSize=1000')
        } catch (e) {
          // published endpoint may not exist on some backends — we'll fall back below
          console.debug('published endpoint failed, will fallback to paged articles', e.message)
        }

        let list = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []

        // if published endpoint returned nothing, fall back to paged all-articles and filter
        if (!list || list.length === 0) {
          try {
            const all = await apiFetch('/api/articles?page=1&pageSize=1000')
            const allList = Array.isArray(all?.items) ? all.items : Array.isArray(all) ? all : Array.isArray(all?.data) ? all.data : []
            const isPublished = a => !!(a.publishedAt ?? a.PublishedAt) || /publish/i.test((a.status ?? a.Status ?? '') + '')
            list = allList.filter(isPublished)
          } catch (e) {
            throw e
          }
        }

        setArticles(list)
      } catch (e) {
        setError(e.message || 'Failed to load public articles')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div style={{ padding: 24, minHeight: '100vh', background: '#f7fbff' }}>
      <Link to="/MemberLogin" style={{ position: 'fixed', top: 16, left: 16, zIndex: 1100, background: 'white', color: '#b91c1c', padding: '8px 10px', borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.12)', textDecoration: 'none', fontWeight: 700 }}>
        ← Back to Login
      </Link>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h1 style={{ color: '#b91c1c', fontSize: 32, marginBottom: 8 }}>Public Articles</h1>
        <p style={{ color: '#6b7280', marginBottom: 20 }}>Browse all published articles. Click any item to view the full article.</p>

        {loading && <div style={{ color: '#6b7280' }}>Loading articles…</div>}
        {error && <div style={{ padding: 12, background: '#fee2e2', color: '#991b1b', borderRadius: 8 }}>{error}</div>}

        {!loading && !error && articles.length === 0 && (
          <div style={{ padding: 20, background: 'white', borderRadius: 8 }}>No published articles found.</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {!loading && !error && articles.map((a, idx) => renderArticleCard(a, idx))}
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}

function renderArticleCard(article, idx) {
  const id = article.articleId ?? article.ArticleId ?? article.newsArticleId ?? article.NewsArticleId ?? idx
  const title = article.title ?? article.Title ?? article.titleEN ?? article.TitleEN ?? article.titleZH ?? article.TitleZH ?? 'Untitled'
  const summary = article.summary ?? article.Summary ?? article.summaryEN ?? article.SummaryEN ?? article.summaryZH ?? article.SummaryZH
  const publishedAt = article.publishedAt ?? article.PublishedAt
  const image = article.imageUrl ?? article.ImageUrl ?? article.image ?? article.Image
  const language = article.language ?? article.Language ?? 'English'

  return (
    <Link to={`/member/articles/${id}`} state={{ fromPath: '/public-articles' }} style={{ textDecoration: 'none', color: 'inherit' }} key={id}>
      <div style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', background: 'white', transition: 'all 0.3s ease', cursor: 'pointer', display: 'flex', flexDirection: 'column', height: '100%' }}>
        {image && (
          <div style={{ width: '100%', height: 160, overflow: 'hidden', background: '#e5e7eb' }}>
            <img src={image} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontSize: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {publishedAt && (
                <span style={{ color: '#9ca3af' }}>{new Date(publishedAt).toLocaleDateString()}</span>
              )}
            </div>
            <span style={{ padding: '4px 8px', background: '#e5e7eb', color: '#374151', borderRadius: 4, fontWeight: 600 }}>{language === 'ZH' || language === 'Chinese' ? 'Chinese' : 'English'}</span>
          </div>

          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 8, lineHeight: 1.4, minHeight: 45 }}>{title}</div>

          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12, minHeight: 36, lineHeight: 1.4, flex: 1 }}>{summary ? (summary.length > 90 ? summary.substring(0, 90) + '...' : summary) : 'No summary available.'}</div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
            <div />
            <Link to={`/member/articles/${id}`} state={{ fromPath: '/public-articles' }} style={{ padding: '8px 12px', background: '#b91c1c', color: 'white', borderRadius: 6, textDecoration: 'none', fontWeight: 600 }}>View</Link>
          </div>
        </div>
      </div>
    </Link>
  )
}