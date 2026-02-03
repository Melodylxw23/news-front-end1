import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

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

export default function MemberArticles() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [currentLanguage, setCurrentLanguage] = useState('EN')
  const [interestTagsMap, setInterestTagsMap] = useState({})

  // Get pending interests from localStorage
  const getPendingInterests = () => {
    try {
      const stored = localStorage.getItem('pendingTopicSelections')
      if (stored) {
        const parsed = JSON.parse(stored)
        return parsed.InterestTagIds || []
      }
    } catch (e) {
      console.error('Error parsing pending interests:', e)
    }
    return []
  }

  const pendingInterestIds = getPendingInterests()

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        // Load interest tags to map IDs to names
        const tagsRes = await apiFetch('/api/InterestTags')
        const tagsList = Array.isArray(tagsRes) ? tagsRes : Array.isArray(tagsRes?.data) ? tagsRes.data : []
        const tagsMap = {}
        tagsList.forEach(tag => {
          const id = tag.interestTagId ?? tag.InterestTagId
          const nameEN = tag.nameEN ?? tag.NameEN ?? tag.name ?? tag.Name
          if (id && nameEN) {
            tagsMap[id] = nameEN
          }
        })
        setInterestTagsMap(tagsMap)
        console.log('[MemberArticles] Interest Tags Map:', tagsMap)

        // Load articles
        const res = await apiFetch('/api/articles/published')
        const list = Array.isArray(res)
          ? res
          : Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res?.items)
              ? res.items
              : []
        console.log('[MemberArticles] Sample Article:', list[0])
        setArticles(list)
      } catch (e) {
        setError(e.message || 'Failed to load articles')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Filter and sort articles
  const getFilteredArticles = (section) => {
    let filtered = articles

    // Filter by section
    if (section === 'industry') {
      filtered = filtered.filter(a => a.category !== 'topics' && a.category !== 'interest')
    } else if (section === 'topics') {
      // Check if article relates to user's selected interests
      filtered = filtered.filter(a => {
        const articleCategories = [a.category, a.industry, a.topic].filter(Boolean)
        return articleCategories.some(cat => pendingInterestIds.includes(cat)) ||
               pendingInterestIds.length === 0 // Show all if no interests selected
      })
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(a => {
        const title = (a.title ?? a.Title ?? '').toLowerCase()
        const summary = (a.summary ?? a.Summary ?? '').toLowerCase()
        const category = (a.category ?? a.Category ?? '').toLowerCase()
        const industry = (a.industry ?? a.Industry ?? '').toLowerCase()
        const topic = (a.topic ?? a.Topic ?? '').toLowerCase()
        const tags = (a.tags ?? a.Tags ?? '').toString().toLowerCase()
        const source = (a.source ?? a.Source ?? '').toLowerCase()
        
        return (
          title.includes(query) || 
          summary.includes(query) || 
          category.includes(query) || 
          industry.includes(query) || 
          topic.includes(query) ||
          tags.includes(query) ||
          source.includes(query)
        )
      })
    }

    // Sort
    if (sortBy === 'newest') {
      filtered.sort((a, b) => new Date(b.publishedAt ?? b.PublishedAt ?? 0) - new Date(a.publishedAt ?? a.PublishedAt ?? 0))
    } else if (sortBy === 'oldest') {
      filtered.sort((a, b) => new Date(a.publishedAt ?? a.PublishedAt ?? 0) - new Date(b.publishedAt ?? b.PublishedAt ?? 0))
    }

    return filtered
  }

  const industryArticles = getFilteredArticles('industry')
  const topicArticles = getFilteredArticles('topics')

  const renderArticleCard = (article, idx) => {
    const id = article.articleId ?? article.ArticleId ?? article.newsArticleId ?? article.NewsArticleId ?? idx
    const title = article.title ?? article.Title ?? article.titleEN ?? article.TitleEN ?? article.titleZH ?? article.TitleZH ?? 'Untitled'
    const summary = article.summary ?? article.Summary ?? article.summaryEN ?? article.SummaryEN ?? article.summaryZH ?? article.SummaryZH
    const publishedAt = article.publishedAt ?? article.PublishedAt
    const image = article.imageUrl ?? article.ImageUrl ?? article.image ?? article.Image
    const language = article.language ?? article.Language ?? 'English'
    const isTranslated = article.isTranslated ?? article.IsTranslated ?? false
    const source = article.source ?? article.Source ?? ''
    
    // Get article's assigned interest tags - they come as objects, not IDs
    const interestTagsArray = article.interestTags ?? article.InterestTags ?? []
    
    // Extract interest names from the tag objects
    const articleInterests = Array.isArray(interestTagsArray)
      ? interestTagsArray.map(tag => tag.nameEN ?? tag.NameEN ?? tag.name ?? tag.Name).filter(Boolean)
      : []

    return (
      <Link to={`/member/articles/${id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <div key={id} style={{ 
          borderRadius: 12, 
          overflow: 'hidden', 
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)', 
          background: 'white', 
          transition: 'all 0.3s ease', 
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          height: '100%'
        }}>
          {/* Image */}
          {image && (
            <div style={{ width: '100%', height: 160, overflow: 'hidden', background: '#e5e7eb' }}>
              <img src={image} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}

          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', flex: 1 }}>
            {/* Source and Date and Language */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontSize: 12 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {source && (
                  <span style={{ color: '#6b7280', fontWeight: 600 }}>
                    {source}
                  </span>
                )}
                {publishedAt && (
                  <span style={{ color: '#9ca3af' }}>
                    {new Date(publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                  </span>
                )}
              </div>
              <span style={{ padding: '4px 8px', background: '#e5e7eb', color: '#374151', borderRadius: 4, fontWeight: 600 }}>
                {language === 'ZH' || language === 'Chinese' ? 'Chinese' : 'English'}
              </span>
            </div>

            {/* Title */}
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 8, lineHeight: 1.4, minHeight: 45 }}>
              {title}
            </div>

            {/* Summary */}
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12, minHeight: 36, lineHeight: 1.4, flex: 1 }}>
              {summary ? (summary.length > 90 ? summary.substring(0, 90) + '...' : summary) : 'No summary available.'}
            </div>

            {/* Interest Tags */}
            {articleInterests.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {articleInterests.map((interest, tagIdx) => (
                  <span key={tagIdx} style={{ 
                    fontSize: 11, 
                    padding: '4px 10px', 
                    background: '#b91c1c', 
                    color: 'white', 
                    borderRadius: 16, 
                    fontWeight: 600
                  }}>
                    {interest}
                  </span>
                ))}
              </div>
            )}

            {/* Footer with translated badge and actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {isTranslated && (
                  <span style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center' }}>
                    🌐 Translated
                  </span>
                )}
              </div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#d1d5db' }} onClick={(e) => e.preventDefault()}>
                🔖
              </button>
            </div>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div style={{ padding: '24px 40px', minHeight: '100vh', background: '#ffffff' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header with search and controls */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Search articles, topics, or sources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                padding: '10px 16px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14,
                fontFamily: 'inherit',
              }}
            />
            <button
              style={{
                padding: '10px 20px',
                background: '#b91c1c',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Sort By ▼
            </button>
          </div>

          {/* Language and sort options */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f3f4f6', paddingBottom: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#374151' }}>Current Language: <strong>{currentLanguage === 'EN' ? 'English' : 'Chinese'}</strong></span>
              <button
                onClick={() => setCurrentLanguage(currentLanguage === 'EN' ? 'ZH' : 'EN')}
                style={{
                  padding: '4px 8px',
                  background: 'transparent',
                  color: '#b91c1c',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                Switch to {currentLanguage === 'EN' ? 'Chinese' : 'English'}
              </button>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: '6px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>

        {error && (
          <div style={{ padding: 16, background: '#fee2e2', color: '#991b1b', borderRadius: 8, marginBottom: 24 }}>
            {error}
          </div>
        )}

        {loading && (
          <div style={{ padding: 32, color: '#6b7280', textAlign: 'center' }}>Loading articles…</div>
        )}

        {!loading && !error && (
          <>
            {/* From Your Industry Section */}
            {industryArticles.length > 0 && (
              <div style={{ marginBottom: 48 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1f2a37', marginBottom: 20, borderBottom: '2px solid #b91c1c', paddingBottom: 10 }}>
                  From Your Industry
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                  {industryArticles.map((article, idx) => renderArticleCard(article, idx))}
                </div>
              </div>
            )}

            {/* From Your Topics Section */}
            {topicArticles.length > 0 && (
              <div style={{ marginBottom: 48 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1f2a37', marginBottom: 20, borderBottom: '2px solid #b91c1c', paddingBottom: 10 }}>
                  From Your Topics of Interest
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                  {topicArticles.map((article, idx) => renderArticleCard(article, idx))}
                </div>
              </div>
            )}

            {/* No articles state */}
            {industryArticles.length === 0 && topicArticles.length === 0 && (
              <div style={{ padding: 48, textAlign: 'center', color: '#6b7280' }}>
                <p style={{ fontSize: 16 }}>No articles found matching your search.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
