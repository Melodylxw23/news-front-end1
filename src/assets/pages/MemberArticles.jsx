import React, { useEffect, useState, useRef } from 'react'
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

export default function MemberArticles() {
  const [articles, setArticles] = useState([])
  const [savedIds, setSavedIds] = useState(new Set())
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [hoverSortOption, setHoverSortOption] = useState(null)
  const sortRef = useRef(null)
  const [currentLanguage, setCurrentLanguage] = useState('EN')
  const [interestTagsMap, setInterestTagsMap] = useState({})
  const [interestTagsList, setInterestTagsList] = useState([])
  const [selectedInterests, setSelectedInterests] = useState(() => {
    try {
      const stored = localStorage.getItem('pendingTopicSelections')
      if (stored) {
        const parsed = JSON.parse(stored)
        return parsed.InterestTagIds || []
      }
    } catch (e) {
      console.error('Error parsing pending interests init:', e)
    }
    return []
  })
  const [selectedIndustryId, setSelectedIndustryId] = useState(null)
  const [industryTagsMap, setIndustryTagsMap] = useState({})
  const [industryMatchExact, setIndustryMatchExact] = useState(() => {
    try {
      return localStorage.getItem('industryMatchExact') === 'true'
    } catch (e) {
      return false
    }
  })

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

  // legacy: getPendingInterests kept for compatibility but not used below
  const pendingInterestIds = getPendingInterests()

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        // Load member profile to get current industry
        let memberIndustryId = null
        try {
          const profileRes = await apiFetch('/api/UserControllers/me')
          if (profileRes) {
            const member = profileRes.member || profileRes.Member || profileRes
            const industryTagsArray = member.industryTags || member.IndustryTags || []
            const industryTag = industryTagsArray[0] || member.industryTag || member.IndustryTag || member.industry || member.Industry
            if (industryTag && typeof industryTag === 'object') {
              const id = industryTag.industryTagId ?? industryTag.IndustryTagId
              if (id) memberIndustryId = id
            }
          }
        } catch (err) {
          // profile unavailable, continue without industry filter
        }
        if (memberIndustryId) {
          setSelectedIndustryId(memberIndustryId)
        } else {
          localStorage.removeItem('selectedIndustryTagId')
        }

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
        setInterestTagsList(tagsList)

        // Load industry tags to map IDs to names
        const industryRes = await apiFetch('/api/IndustryTags')
        const industryList = Array.isArray(industryRes)
          ? industryRes
          : Array.isArray(industryRes?.data)
            ? industryRes.data
            : []
        const industryMap = {}
        industryList.forEach(tag => {
          const id = tag.industryTagId ?? tag.IndustryTagId
          const nameEN = tag.nameEN ?? tag.NameEN ?? tag.name ?? tag.Name
          if (id && nameEN) industryMap[id] = nameEN
        })
        setIndustryTagsMap(industryMap)

        // Load articles using the same published endpoint as PublicArticles
        let res = null
        try {
          res = await apiFetch('/api/articles/published?page=1&pageSize=1000')
        } catch (e) {
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
        setError(e.message || 'Failed to load articles')
      } finally {
        setLoading(false)
      }
    }
    load()
    // load saved ids for this user (try API, fallback to localStorage)
    const loadSaved = async () => {
      try {
        const res = await apiFetch('/api/UserControllers/saved-articles')
        // res may be array of article objects or array of ids
        if (Array.isArray(res)) {
          const ids = res.map(item => {
            if (item == null) return null
            if (typeof item === 'object') return Number(item.articleId ?? item.ArticleId ?? item.newsArticleId ?? item.NewsArticleId ?? item.id ?? null)
            return Number(item)
          }).filter(Boolean)
          setSavedIds(new Set(ids))
          return
        }
      } catch (err) {
        // API not available, fall back to localStorage
      }
      try {
        const stored = localStorage.getItem('savedArticleIds')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed)) setSavedIds(new Set(parsed.map(Number).filter(Boolean)))
        }
      } catch (e) {}
    }
    loadSaved()
    // close sort menu on outside click
    const onDocClick = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setShowSortMenu(false)
      }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  // Filter and sort articles
  const getFilteredArticles = (section) => {
    let filtered = articles
    // Filter by section
    if (section === 'industry') {
      // only include articles that match the member's selected industry
      filtered = filtered.filter(a => {
        if (!selectedIndustryId) return false

        const selRaw = selectedIndustryId
        const selNum = Number(selRaw)
        const isSelNumeric = !Number.isNaN(selNum) && String(selRaw).trim() !== ''
        const selName = !isSelNumeric
          ? String(selRaw)
          : (industryTagsMap[selNum] ?? industryTagsMap[String(selNum)] ?? null)
        const selStr = (selName ?? selRaw ?? '').toString().toLowerCase().trim()

        console.log('[DEBUG] selectedIndustryId:', selectedIndustryId, 'selStr:', selStr, 'isSelNumeric:', isSelNumeric, 'industryTagsMap:', industryTagsMap)

        const indObj = a.industryTag ?? a.industry ?? a.Industry ?? null
        let articleIndustryId = null
        let articleIndustryName = null

        if (indObj && typeof indObj === 'object') {
          articleIndustryId = indObj.industryTagId ?? indObj.IndustryTagId ?? indObj.id ?? indObj.industryId ?? indObj.Id
          articleIndustryName = indObj.nameEN ?? indObj.NameEN ?? indObj.name ?? indObj.Name ?? indObj.industryName
        } else if (typeof indObj === 'string') {
          articleIndustryName = indObj
        }

        if (!articleIndustryId) {
          articleIndustryId = a.industryTagId ?? a.industryTagID ?? a.industryId ?? null
        }
        if (!articleIndustryName) {
          articleIndustryName = a.industry ?? a.Industry ?? a.industryName ?? a.IndustryName ?? null
        }

        console.log('[DEBUG] Article:', a.articleId, 'indObj:', indObj, 'extracted articleIndustryName:', articleIndustryName)

        if (isSelNumeric && articleIndustryId) {
          return Number(articleIndustryId) === selNum
        }
        if (articleIndustryName && selStr) {
          const artName = String(articleIndustryName).toLowerCase().trim()
          console.log('[DEBUG] Comparing article industry:', artName, 'vs member:', selStr, 'match:', artName === selStr || artName.includes(selStr))
          if (industryMatchExact) return artName === selStr
          return artName.includes(selStr)
        }
        console.log('[DEBUG] No article industry name or selStr')
        return false
      })
    } else if (section === 'topics') {
      // Check if article relates to user's selected interests (match by interest tag IDs)
      if (!selectedInterests || selectedInterests.length === 0) {
        filtered = filtered
      } else {
        filtered = filtered.filter(a => {
          const interestTagsArray = a.interestTags ?? a.InterestTags ?? []
          const articleTagIds = Array.isArray(interestTagsArray)
            ? interestTagsArray.map(t => t.interestTagId ?? t.InterestTagId).filter(Boolean)
            : []
          return articleTagIds.some(id => selectedInterests.includes(Number(id)))
        })
      }
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(a => {
        const title = (a.titleEN ?? a.titleZH ?? a.title ?? a.Title ?? '').toLowerCase()
        const summary = (a.summaryEN ?? a.summaryZH ?? a.summary ?? a.Summary ?? '').toLowerCase()
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

  const topicArticles = getFilteredArticles('topics')
  const allArticles = getFilteredArticles()

  // topic icon helper
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
      ? interestTagsArray.map(tag => ({ id: tag.interestTagId ?? tag.InterestTagId, name: tag.nameEN ?? tag.NameEN ?? tag.name ?? tag.Name })).filter(Boolean)
      : []

    // Extract industry name for this article (could be object or string)
    const indObj = article.industryTag ?? article.industry ?? article.Industry ?? null
    let articleIndustryName = null
    if (indObj && typeof indObj === 'object') {
      articleIndustryName = indObj.nameEN ?? indObj.NameEN ?? indObj.name ?? indObj.Name ?? indObj.industryName
    } else if (typeof indObj === 'string') {
      articleIndustryName = indObj
    }
    if (!articleIndustryName) {
      articleIndustryName = article.industryName ?? article.IndustryName ?? article.industry ?? article.Industry ?? null
    }

    const isSaved = savedIds.has(Number(id))

    return (
      <Link key={id} to={`/member/articles/${id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <div style={{ 
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
              {(language === 'ZH' || language === 'Chinese') && (
                <span style={{ padding: '4px 8px', background: '#e5e7eb', color: '#374151', borderRadius: 4, fontWeight: 600 }}>
                  {'Chinese'}
                </span>
              )}
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
            {/* Industry Badge */}
            {articleIndustryName && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <span style={{
                  fontSize: 11,
                  padding: '6px 12px',
                  background: '#7f1d1d',
                  color: 'white',
                  borderRadius: 16,
                  fontWeight: 700
                }}>
                  {articleIndustryName}
                </span>
              </div>
            )}

            {articleInterests.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {articleInterests.map((interest, tagIdx) => (
                  <span key={interest.id ?? tagIdx} style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 11, 
                    padding: '4px 10px', 
                    background: '#b91c1c', 
                    color: 'white', 
                    borderRadius: 16, 
                    fontWeight: 600
                  }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>{getTopicIcon(interest.name, interest.id)}</span>
                    <span>{interest.name}</span>
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
              <button
                onClick={async (e) => {
                  e.preventDefault(); e.stopPropagation();
                  const currentlySaved = savedIds.has(Number(id))
                  // optimistic update
                  const next = new Set(savedIds)
                  if (currentlySaved) next.delete(Number(id))
                  else next.add(Number(id))
                  setSavedIds(next)
                  setToast({ message: currentlySaved ? 'Article removed from Saved' : 'Article saved', type: 'success' })
                  // try API then fallback to localStorage
                  try {
                    if (!currentlySaved) {
                      await apiFetch('/api/UserControllers/saved-articles', { method: 'POST', body: JSON.stringify({ articleId: id }) })
                    } else {
                      await apiFetch(`/api/UserControllers/saved-articles/${id}`, { method: 'DELETE' })
                    }
                    // success
                  } catch (err) {
                    console.warn('[MemberArticles] save API failed, storing locally')
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
            <div style={{ position: 'relative' }} ref={sortRef}>
              <button
                onClick={() => setShowSortMenu(s => !s)}
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
                Sort By ▾
              </button>
              {showSortMenu && (
                <div style={{ position: 'absolute', top: '46px', right: 0, width: 160, background: 'white', border: '1px solid #e5e7eb', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', zIndex: 2000 }}>
                  <div
                    onMouseEnter={() => setHoverSortOption('newest')}
                    onMouseLeave={() => setHoverSortOption(null)}
                    onClick={() => { setSortBy('newest'); setShowSortMenu(false) }}
                    style={{ padding: '10px 14px', cursor: 'pointer', background: hoverSortOption === 'newest' ? '#4b5563' : 'white', color: hoverSortOption === 'newest' ? 'white' : '#111827' }}
                  >
                    Newest First
                  </div>
                  <div
                    onMouseEnter={() => setHoverSortOption('oldest')}
                    onMouseLeave={() => setHoverSortOption(null)}
                    onClick={() => { setSortBy('oldest'); setShowSortMenu(false) }}
                    style={{ padding: '10px 14px', cursor: 'pointer', background: hoverSortOption === 'oldest' ? '#4b5563' : 'white', color: hoverSortOption === 'oldest' ? 'white' : '#111827' }}
                  >
                    Oldest First
                  </div>
                </div>
              )}
            </div>
          {/* Topics of Interest selector (moved below article sections) */}
          </div>

          {/* Language and sort options */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f3f4f6', paddingBottom: 12 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                

                
              </div>
            
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
            {/* All Articles (single combined list) */}
            {allArticles.length > 0 ? (
              <div style={{ marginBottom: 48 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1f2a37', marginBottom: 20, borderBottom: '2px solid #b91c1c', paddingBottom: 10 }}>
                  All Articles
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                  {allArticles.map((article, idx) => renderArticleCard(article, idx))}
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1f2a37', marginBottom: 12 }}>
                  All Articles
                </h2>
                <div style={{ color: '#6b7280', marginBottom: 24 }}>No articles found.</div>
              </div>
            )}

            {/* Topics selector will render under the Topics header */}

            {/* From Your Topics Section */}
            {topicArticles.length > 0 && (
              <div style={{ marginBottom: 48 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1f2a37', marginBottom: 20, borderBottom: '2px solid #b91c1c', paddingBottom: 10 }}>
                  From Your Topics of Interest
                </h2>

                {/* Topics of Interest selector (moved below the red divider) */}
                <div style={{ color: '#6b7280', marginBottom: 8, fontSize: 14, fontWeight: 600 }}>Select the topic of interest</div>
                {interestTagsList.length > 0 && (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', overflowX: 'auto', padding: '12px 0', marginBottom: 32 }}>
                    {interestTagsList.map((tag) => {
                      const id = tag.interestTagId ?? tag.InterestTagId
                      const name = tag.nameEN ?? tag.NameEN ?? tag.name ?? tag.Name
                      const selected = selectedInterests.map(String).includes(String(id))
                      return (
                        <button
                          key={id}
                          onClick={() => {
                            let next = Array.from(selectedInterests)
                            if (next.map(String).includes(String(id))) next = next.filter(x => String(x) !== String(id))
                            else next.push(Number(id))
                            setSelectedInterests(next)
                            try { localStorage.setItem('pendingTopicSelections', JSON.stringify({ InterestTagIds: next })) } catch(e) {}
                          }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 12px',
                            borderRadius: 8,
                            border: selected ? '2px solid #b91c1c' : '1px solid #e5e7eb',
                            background: selected ? '#fff1f1' : 'white',
                            cursor: 'pointer',
                            minWidth: 90,
                            outline: 'none',
                            boxShadow: selected ? '0 0 0 3px rgba(185,28,28,0.06)' : 'none'
                          }}
                        >
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #f3f4f6' }}>
                            {getTopicIcon(name, id)}
                          </div>
                          <div style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{name}</div>
                        </button>
                      )
                    })}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                  {topicArticles.map((article, idx) => renderArticleCard(article, idx))}
                </div>
              </div>
            )}

            {/* No articles state */}
            {allArticles.length === 0 && topicArticles.length === 0 && (
              <div style={{ padding: 48, textAlign: 'center', color: '#6b7280' }}>
                <p style={{ fontSize: 16 }}>No articles found matching your search.</p>
              </div>
            )}
          </>
        )}
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}