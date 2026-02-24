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

export default function SavedArticles() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [articles, setArticles] = useState([])
  const [savedIds, setSavedIds] = useState(new Set())
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        // Try API for saved articles
        let res = null
        try {
          res = await apiFetch('/api/UserControllers/saved-articles')
        } catch (err) {
          console.warn('[SavedArticles] saved-articles API not available', err)
        }

        if (Array.isArray(res) && res.length > 0) {
          // If items look like article objects
          const first = res[0]
          if (first && typeof first === 'object' && (first.articleId || first.newsArticleId || first.title)) {
            setArticles(res)
            // also set saved ids from returned objects
            const ids = res.map(item => Number(item.articleId ?? item.ArticleId ?? item.newsArticleId ?? item.NewsArticleId ?? item.id ?? null)).filter(Boolean)
            setSavedIds(new Set(ids))
            return
          }
          // else assume array of ids
          const ids = res.map(x => Number(x)).filter(Boolean)
          setSavedIds(new Set(ids))
          // fetch published articles and filter
          const all = await apiFetch('/api/articles/published')
          const list = Array.isArray(all) ? all : Array.isArray(all?.data) ? all.data : Array.isArray(all?.items) ? all.items : []
          const filtered = list.filter(a => {
            const aid = a.articleId ?? a.ArticleId ?? a.newsArticleId ?? a.NewsArticleId
            return aid && ids.includes(Number(aid))
          })
          setArticles(filtered)
          return
        }

        // fallback to localStorage
        const stored = localStorage.getItem('savedArticleIds')
        const ids = stored ? (JSON.parse(stored) || []) : []
        setSavedIds(new Set((ids || []).map(Number).filter(Boolean)))
        if (ids.length === 0) {
          setArticles([])
          return
        }
        const all = await apiFetch('/api/articles/published')
        const list = Array.isArray(all) ? all : Array.isArray(all?.data) ? all.data : Array.isArray(all?.items) ? all.items : []
        const filtered = list.filter(a => {
          const aid = a.articleId ?? a.ArticleId ?? a.newsArticleId ?? a.NewsArticleId
          return aid && ids.includes(Number(aid))
        })
        setArticles(filtered)
      } catch (err) {
        setError(err.message || 'Failed to load saved articles')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <div style={{ padding: 24, color: '#6b7280' }}>Loading saved articles…</div>
  if (error) return <div style={{ padding: 24, background: '#fee2e2', color: '#991b1b' }}>{error}</div>

  const getTopicIcon = (name, id) => {
    const key = (name || '').toString().toLowerCase()
    const map = {
      'investment': '💰',
      'taxation': '🧾',
      'trade': '⚖️',
      'technology & innovation': '💡',
      'manufacturing': '🏭',
      'finance & banking': '🏦',
      'healthcare': '🩺',
      'investment news': '📈'
    }
    return <span style={{ fontSize: 16 }}>{map[key] ?? (map[id] ?? '🏷️')}</span>
  }

  const renderArticleCard = (article, idx) => {
    const id = article.articleId ?? article.ArticleId ?? article.newsArticleId ?? article.NewsArticleId ?? idx
    const title = article.title ?? article.Title ?? article.titleEN ?? article.TitleEN ?? 'Untitled'
    const summary = article.summary ?? article.Summary ?? article.summaryEN ?? article.SummaryEN
    const publishedAt = article.publishedAt ?? article.PublishedAt
    const image = article.imageUrl ?? article.ImageUrl ?? article.image ?? article.Image
    const language = article.language ?? article.Language ?? 'English'
    const isTranslated = article.isTranslated ?? article.IsTranslated ?? false

    const interestTagsArray = article.interestTags ?? article.InterestTags ?? []
    const articleInterests = Array.isArray(interestTagsArray)
      ? interestTagsArray.map(tag => ({ id: tag.interestTagId ?? tag.InterestTagId, name: tag.nameEN ?? tag.NameEN ?? tag.name ?? tag.Name })).filter(Boolean)
      : []

    const indObj = article.industryTag ?? article.industry ?? article.Industry ?? null
    let articleIndustryName = null
    if (indObj && typeof indObj === 'object') {
      articleIndustryName = indObj.nameEN ?? indObj.NameEN ?? indObj.name ?? indObj.Name ?? indObj.industryName
    } else if (typeof indObj === 'string') {
      articleIndustryName = indObj
    }
    if (!articleIndustryName) articleIndustryName = article.industryName ?? article.IndustryName ?? article.industry ?? article.Industry ?? null

    const isSaved = savedIds.has(Number(id))

    return (
      <Link to={`/member/articles/${id}`} state={{ fromSaved: true }} style={{ textDecoration: 'none', color: 'inherit' }} key={id}>
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

            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12, minHeight: 36, lineHeight: 1.4, flex: 1 }}>{summary ? (summary.length > 120 ? summary.substring(0, 120) + '...' : summary) : 'No summary.'}</div>

            {articleIndustryName && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <span style={{ fontSize: 11, padding: '6px 12px', background: '#7f1d1d', color: 'white', borderRadius: 16, fontWeight: 700 }}>{articleIndustryName}</span>
              </div>
            )}

            {articleInterests.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {articleInterests.map((interest, tagIdx) => (
                  <span key={interest.id ?? tagIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, padding: '4px 10px', background: '#b91c1c', color: 'white', borderRadius: 16, fontWeight: 600 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>{getTopicIcon(interest.name, interest.id)}</span>
                    <span>{interest.name}</span>
                  </span>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
              <div />
              <button
                onClick={async (e) => {
                  e.preventDefault(); e.stopPropagation()
                  const currentlySaved = savedIds.has(Number(id))
                  // optimistic update for savedIds
                  const next = new Set(savedIds)
                  if (currentlySaved) next.delete(Number(id))
                  else next.add(Number(id))
                  setSavedIds(next)

                  // show toast for immediate feedback
                  setToast({ message: currentlySaved ? 'Article removed from Saved' : 'Article saved', type: 'success' })

                  // if unsaving, immediately remove from displayed articles for instant feedback
                  if (currentlySaved) {
                    setArticles(prev => (Array.isArray(prev) ? prev.filter(x => {
                      const aid = x.articleId ?? x.ArticleId ?? x.newsArticleId ?? x.NewsArticleId
                      return String(aid) !== String(id)
                    }) : prev))
                  }

                  try {
                    if (!currentlySaved) {
                      await apiFetch('/api/UserControllers/saved-articles', { method: 'POST', body: JSON.stringify({ articleId: id }) })
                    } else {
                      await apiFetch(`/api/UserControllers/saved-articles/${id}`, { method: 'DELETE' })
                    }
                  } catch (err) {
                    console.warn('[SavedArticles] save API failed, storing locally')
                    try {
                      const stored = localStorage.getItem('savedArticleIds')
                      const arr = stored ? JSON.parse(stored) : []
                      let newArr = Array.isArray(arr) ? arr.map(Number).filter(Boolean) : []
                      if (!currentlySaved) newArr.push(Number(id))
                      else newArr = newArr.filter(x => Number(x) !== Number(id))
                      localStorage.setItem('savedArticleIds', JSON.stringify(Array.from(new Set(newArr))))
                    } catch (e) {}
                  }
                }}
                title={isSaved ? 'Unsave' : 'Save'}
                aria-pressed={isSaved}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: isSaved ? '1px solid #b91c1c' : '1px solid #e5e7eb',
                  background: isSaved ? '#b91c1c' : 'white',
                  color: isSaved ? 'white' : '#b91c1c',
                  fontWeight: 600,
                  cursor: 'pointer',
                  outline: 'none',
                  boxShadow: 'none'
                }}
              >
                <span style={{ fontSize: 16 }}>{isSaved ? '📌' : '🔖'}</span>
                <span>{isSaved ? 'Unsave' : 'Save'}</span>
              </button>
            </div>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div style={{ padding: '24px 40px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827' }}>Saved Articles</h1>
        {articles.length === 0 ? (
          <div style={{ marginTop: 24, color: '#6b7280' }}>You have no saved articles.</div>
        ) : (
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {articles.map((a, idx) => renderArticleCard(a, idx))}
          </div>
        )}
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}