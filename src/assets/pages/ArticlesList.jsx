import React, { useEffect, useState } from 'react'
import { listArticles, stats, deleteArticle } from '../../api/articles'
import { Link, useNavigate } from 'react-router-dom'
import { getRoleFromToken, parseJwt } from '../../utils/auth'
import { text } from 'framer-motion/client'

const palette = {
  bg: '#fbf8f6',
  card: '#ffffff',
  primary: '#1e73d1',
  accent: '#e07a16',
  success: '#1e7a3a',
  muted: '#666'
}

const styles = {
  page: { padding: '24px 32px', background: 'transparent', minHeight: '100vh', boxSizing: 'border-box' },
  statCard: { background: palette.card, padding: 20, borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', flex: 1, minWidth: 200 },
  controls: { display: 'flex', gap: 8, alignItems: 'center' },
  input: { padding: '6px 10px', borderRadius: 6, border: '1px solid #e6e6e6', minWidth: 140, maxWidth: 220 },
  select: { padding: '6px 10px', borderRadius: 6, border: '1px solid #e6e6e6', minWidth: 140 },
  tableCard: { background: palette.card, padding: 18, borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.06)', width: '100%', boxSizing: 'border-box', margin: 0 },
  translateBtn: { background: '#c92b2b', color: 'white', padding: '8px 12px', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 700 },
  pill: { padding: '6px 8px', borderRadius: 10, fontWeight: 600, fontSize: 11 },
  sourceCell: { padding: 10, color: '#333', fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px', verticalAlign: 'middle' },
  titleCell: { padding: 10, color: '#111', fontSize: 16, lineHeight: '1.35', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', verticalAlign: 'middle' },
  dateCell: { padding: 10, fontSize: 13, verticalAlign: 'middle'},
  statusCell: { padding: 8 },
  actionsCell: { padding: 8 }
}

export default function ArticlesList() {
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const navigate = useNavigate()
  const [sourcesMap, setSourcesMap] = useState({})
  const [globalCounts, setGlobalCounts] = useState(null)
  const [initialized, setInitialized] = useState(false)
  const [activeTab, setActiveTab] = useState('active') // 'active' or 'translated'
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState('default') // default | pending | inProgress | idAsc
  const [showDebug, setShowDebug] = useState(false)

  useEffect(() => { if (initialized) loadPage(page) }, [page, initialized])
  // reload when other pages signal that articles changed (save/approve)
  useEffect(() => {
    const handler = () => { if (initialized) loadPage(page) }
    window.addEventListener('articles:changed', handler)
    return () => window.removeEventListener('articles:changed', handler)
  }, [page])
  // reset to page 1 when switching tabs
  useEffect(() => {
    setPage(1)
  }, [activeTab])
  useEffect(() => {
    (async () => {
      try {
        await loadStats()
      } catch (e) { /* ignore */ }
      try {
        await loadSources()
      } catch (e) { /* ignore */ }
      setInitialized(true)
      // load first page now that global stats are available
      try { await loadPage(page) } catch (e) { /* ignore */ }
    })()
  }, [])

  // Load a single page from the backend (server-side pagination).
  const loadPage = async (pageToLoad = 1) => {
    setLoading(true)
    try {
      // Ensure we have a sources map fetched from the server before showing articles.
      // If sourcesMap is empty, attempt to load sources now so we can resolve labels.
      if (!sourcesMap || Object.keys(sourcesMap).length === 0) {
        try { await loadSources() } catch (e) { /* ignore - we'll still attempt to show items */ }
      }
      const res = await listArticles(pageToLoad, pageSize)
      const itemsPage = (res && (res.Items || res.items)) ? (res.Items || res.items) : []
      const totalCount = (res && (res.Total || res.total)) ? (res.Total || res.total) : itemsPage.length
      // Use only server-provided articles. Client-side `recentArticles` merge
      // was removed to ensure the UI strictly reflects database state.
      let merged = [...itemsPage]

      // Don't filter out articles - show all articles from server
      // Source label resolution will fall back to extracting from title if needed
      console.log(`Page ${pageToLoad}: Loaded ${merged.length} articles from server`)

      setItems(merged)
      setTotal(Number(totalCount) || 0)
      // global stats are loaded once on mount; do not refresh here to avoid
      // changing stat cards when navigating pages.
    } catch (e) {
      alert('Failed to load articles: ' + (e.message || e))
    } finally { setLoading(false) }
  }

  const loadStats = async () => {
    try {
      const res = await stats()
      if (!res) return
      // defensive parsing of possible shapes
      const totalCount = res.Total ?? res.total ?? res.totalCount ?? res.count ?? null
      const pending = res.Pending ?? res.pending ?? res.pendingCount ?? res.toTranslate ?? null
      const inProgress = res.InProgress ?? res.inProgress ?? res.inprogress ?? res.inProgressCount ?? null
      const translated = res.Translated ?? res.translated ?? res.translatedCount ?? null
      setGlobalCounts({ total: totalCount, pending, inProgress, translated })
    } catch (e) { /* ignore */ }
  }

  const getSourceLabel = (a) => {
    if (!a) return '-'
    // prefer a mapping from SourceId -> Name fetched from /api/sources
    const sid = a.SourceId ?? a.sourceId ?? a.SourceId ?? a.sourceId ?? null
    if (sid && sourcesMap && sourcesMap[sid]) return sourcesMap[sid]
    // if item has a SourceName from other shapes, use it
    const candidates = [a.SourceName, a.sourceName, a.Source?.Name, a.Source?.name]
    for (const c of candidates) if (c) return c
    return '-'
  }

  const showToast = (message, type = 'success') => {
    try {
      setToast({ message, type })
      setTimeout(() => setToast(null), 3000)
    } catch (e) { /* ignore */ }
  }

  async function loadSources() {
    try {
      const token = localStorage.getItem('token')
      const headers = Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: `Bearer ${token}` } : {})
      const res = await fetch((import.meta.env.VITE_API_BASE || '') + '/api/sources', { headers })
      if (!res.ok) return
      const arr = await res.json()
      const map = {}
      if (Array.isArray(arr)) {
        for (const s of arr) {
          const id = s.SourceId ?? s.sourceId ?? s.id
          const name = s.Name ?? s.name
          if (id != null) map[id] = name
        }
      }
      setSourcesMap(map)
    } catch (e) { /* ignore */ }
  }

  const extractSourceFromTitle = (title) => {
    if (!title) return null
    // normalize hyphens and em-dashes
    const separators = [' - ', ' — ', ' —', '–', '—', '\u2014', ' -', '- ', '·', '•']
    for (const sep of separators) {
      const idx = title.lastIndexOf(sep)
      if (idx > 0 && idx < title.length - 1) {
        const suffix = title.substring(idx + sep.length).trim()
        // ignore suffixes that look like dates or long clauses
        if (suffix && suffix.length <= 60) {
          // basic heuristic: if suffix contains non-letter characters but also Chinese chars or letters, accept
          const hasChinese = /[\u4e00-\u9fff]/.test(suffix)
          const hasAlpha = /[A-Za-z]/.test(suffix)
          if (hasChinese || hasAlpha) return suffix
        }
      }
    }
    return null
  }

  const getTitleLabel = (a) => {
    const rawTitle = a.Title ?? a.title ?? a.snippet ?? ''
    const extracted = extractSourceFromTitle(rawTitle)
    if (!extracted) return rawTitle
    // remove the trailing separator+source from title
    // find last occurrence of the extracted suffix and trim that part
    const pos = rawTitle.lastIndexOf(extracted)
    if (pos > 0) {
      const before = rawTitle.substring(0, pos)
      // strip trailing hyphen/separators
      return before.replace(/[\-—–·•\s]+$/,'').trim()
    }
    return rawTitle
  }

  const _roleRaw = getRoleFromToken(localStorage.getItem('token'))
  const role = _roleRaw ? _roleRaw.toString().toLowerCase() : _roleRaw
  if (role !== 'admin' && role !== 'consultant') return <div style={{ padding: 24 }}><strong>Permission denied</strong></div>
  const canDelete = role === 'admin' || role === 'consultant'

  // status counts: `total` is overall total from server; other counts are computed from current page
  const isTranslated = (it) => {
    const s = (it.TranslationStatus || it.translationStatus || '').toString().toLowerCase()
    const saved = it.TranslationSavedAt ?? it.translationSavedAt ?? null
    
    // Backend considers translated if: saved timestamp exists OR status is Translated
    // This matches the stats endpoint logic
    if (saved) return true
    if (s.includes('translated')) return true
    
    // Everything else (Pending, InProgress, etc) is NOT translated
    return false
  }

  const pageCounts = items.reduce((acc, it) => {
    const s = (it.TranslationStatus || it.translationStatus || '').toString().toLowerCase()
    const saved = it.TranslationSavedAt ?? it.translationSavedAt ?? null
    acc.page += 1
    
    // Match backend stats logic:
    // InProgress: status is InProgress (being actively translated or needing review)
    if (s.includes('inprogress') || s.includes('in progress')) acc.inProgress += 1
    // Translated: has saved timestamp OR status is Translated
    else if (saved || s.includes('translated')) acc.translated += 1
    // Pending: everything else (not started, no saved translation)
    else acc.pending += 1
    
    return acc
  }, { page: 0, pending: 0, inProgress: 0, translated: 0 })

  const statusCounts = { total: total || pageCounts.page, pending: pageCounts.pending, inProgress: pageCounts.inProgress, translated: pageCounts.translated }

  // Prefer global counts from the server when available so stats reflect all articles
  // rather than only the current page.
  const displayCounts = globalCounts && (globalCounts.total != null || globalCounts.pending != null) ? {
    total: Number(globalCounts.total ?? total ?? pageCounts.page) || 0,
    pending: Number(globalCounts.pending ?? pageCounts.pending) || 0,
    inProgress: Number(globalCounts.inProgress ?? pageCounts.inProgress) || 0,
    translated: Number(globalCounts.translated ?? pageCounts.translated) || 0
  } : statusCounts

  const renderBadge = (item) => {
    const s = ((item && (item.TranslationStatus || item.translationStatus)) || '').toString().toLowerCase()
    const saved = item && (item.TranslationSavedAt || item.translationSavedAt)
    const base = { padding: '6px 10px', borderRadius: 12, fontWeight: 600, fontSize: 12 }
    
    // InProgress: being actively translated (by user or needs review after crawler)
    if (s.includes('inprogress') || s.includes('in progress')) {
      return <span style={{ ...base, background: '#fff4e6', color: '#e07a16' }}>In Progress</span>
    }
    
    // Translated: has saved translation timestamp OR status is Translated
    if (saved || s.includes('translated')) {
      return <span style={{ ...base, background: '#e8f9ee', color: '#1e7a3a' }}>Translated</span>
    }
    
    // Pending: not started (no saved translation, not in progress)
    if (!s || s === 'pending' || s.includes('pending')) {
      return <span style={{ ...base, background: '#e6f0ff', color: '#1e73d1' }}>Pending</span>
    }
    
    // Fallback for any other status
    return <span style={{ ...base, background: '#f3f4f6', color: '#444' }}>{item.TranslationStatus || item.translationStatus || 'Unknown'}</span>
  }

  // server-side pagination: `items` holds the current page
  // Use the same `pageSize` for server requests and UI pagination to avoid
  // duplicated items across pages when sizes differ.
  const viewPageSize = pageSize
  const totalPages = Math.max(1, Math.ceil((total || 0) / viewPageSize))

  const filtered = items.filter(it => {
    // active: exclude translated items
    if (activeTab === 'active' && isTranslated(it)) return false
    // translated: include only translated items (saved or explicitly translated/approved)
    if (activeTab === 'translated' && !isTranslated(it)) return false
    if (query) {
      const q = query.toLowerCase()
      const title = (it.Title || it.title || it.title || '').toString().toLowerCase()
      const src = (getSourceLabel(it) || '').toString().toLowerCase()
      return title.includes(q) || src.includes(q)
    }
    return true
  })

  console.log(`Active tab: ${activeTab}, Items: ${items.length}, Filtered: ${filtered.length}`)

  const getStatusCategory = (it) => {
    const s = (it.TranslationStatus || it.translationStatus || '').toString().toLowerCase()
    const saved = it.TranslationSavedAt ?? it.translationSavedAt ?? null
    
    // Match backend logic
    if (s.includes('inprogress') || s.includes('in progress')) return 'inProgress'
    if (saved || s.includes('translated')) return 'translated'
    return 'pending'
  }

  const sorted = (() => {
    const arr = filtered.slice()
    if (sortBy === 'idAsc') return arr.sort((a,b) => (Number(a.NewsArticleId ?? a.newsArticleId ?? a.ArticleId ?? a.articleId ?? a.id ?? 0) - Number(b.NewsArticleId ?? b.newsArticleId ?? b.ArticleId ?? b.articleId ?? b.id ?? 0)))
    const priority = (cat) => {
      if (sortBy === 'pending') {
        if (cat === 'pending') return 0
        if (cat === 'inProgress') return 1
        return 2
      }
      if (sortBy === 'inProgress') {
        if (cat === 'inProgress') return 0
        if (cat === 'pending') return 1
        return 2
      }
      return 1 // default keep stable
    }
    return arr.sort((a,b) => {
      const pa = priority(getStatusCategory(a))
      const pb = priority(getStatusCategory(b))
      if (pa !== pb) return pa - pb
      return Number(a.NewsArticleId ?? a.newsArticleId ?? a.ArticleId ?? a.articleId ?? a.id ?? 0) - Number(b.NewsArticleId ?? b.newsArticleId ?? b.ArticleId ?? b.articleId ?? b.id ?? 0)
    })
  })()

  return (
    <div className="content-full">
      <div className="page-inner">
        <div style={styles.page}>
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: '#888', marginBottom: 8 }}>Incoming Articles</h1>
            <p style={{ fontSize: 15, color: '#999', margin: 0 }}>Manage all fetched Chinese articles to be translated into English</p>
          </div>

          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <div style={styles.statCard}>
              <div style={{ color: palette.muted, fontSize: 13, fontWeight: 600 }}>Total Articles</div>
              <div style={{ fontSize: 36, fontWeight: 700, marginTop: 6, color: '#7a7a7a' }}>{displayCounts.total}</div>
              <div style={{ color: '#999', fontSize: 12, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 18 }}>📄</span>
                All articles in workspace
              </div>
            </div>
            <div style={styles.statCard}>
              <div style={{ color: palette.primary, fontSize: 13, fontWeight: 700 }}>Pending Translation</div>
              <div style={{ fontSize: 36, fontWeight: 700, marginTop: 6, color: palette.primary }}>{displayCounts.pending}</div>
              <div style={{ color: '#999', fontSize: 12, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 18 }}>⏳</span>
                To be translated
              </div>
            </div>
            <div style={styles.statCard}>
              <div style={{ color: palette.accent, fontSize: 13, fontWeight: 700 }}>In Progress</div>
              <div style={{ fontSize: 36, fontWeight: 700, marginTop: 6, color: palette.accent }}>{displayCounts.inProgress}</div>
              <div style={{ color: '#999', fontSize: 12, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 18 }}>▶️</span>
                Actively translating
              </div>
            </div>
            <div style={styles.statCard}>
              <div style={{ color: palette.success, fontSize: 13, fontWeight: 700 }}>Translated</div>
              <div style={{ fontSize: 36, fontWeight: 700, marginTop: 6, color: palette.success }}>{displayCounts.translated}</div>
              <div style={{ color: '#999', fontSize: 12, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 18 }}>📋</span>
                All translated articles
              </div>
            </div>
          </div>

          <div>
            <div style={styles.tableCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 0, alignItems: 'center', borderBottom: '2px solid #e8e8e8' }}>
                  <button onClick={() => setActiveTab('active')} style={{ padding: '10px 16px', borderRadius: 0, background: 'transparent', border: 'none', borderBottom: activeTab === 'active' ? '3px solid #333' : '3px solid transparent', fontWeight: activeTab === 'active' ? 600 : 400, color: activeTab === 'active' ? '#333' : '#999', cursor: 'pointer' }}>Active Articles</button>
                  <button onClick={() => setActiveTab('translated')} style={{ padding: '10px 16px', borderRadius: 0, background: 'transparent', border: 'none', borderBottom: activeTab === 'translated' ? '3px solid #333' : '3px solid transparent', fontWeight: activeTab === 'translated' ? 600 : 400, color: activeTab === 'translated' ? '#333' : '#999', cursor: 'pointer' }}>Translated Articles</button>
                </div>

                <div style={{ ...styles.controls, marginLeft: 'auto' }}>
                  <input placeholder="🔍 Search" value={query} onChange={e => setQuery(e.target.value)} style={styles.input} />
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ ...styles.select, background: '#f5f5f5', padding: '8px 12px', cursor: 'pointer' }}>
                    <option value="default">Sort By ▼</option>
                    <option value="pending">Sort: Pending First</option>
                    <option value="inProgress">Sort: In Progress First</option>
                    <option value="idAsc">Sort: ID Asc</option>
                  </select>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #e8e8e8', background: 'transparent' }}>
                    <th style={{ padding: '12px 8px', width: '15%', fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Source</th>
                    <th style={{ padding: '12px 8px', width: '35%', fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Article Title</th>
                    <th style={{ padding: '12px 8px', width: '15%', fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date Published</th>
                    <th style={{ padding: '12px 8px', width: '15%', fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                    <th style={{ padding: '12px 8px', width: '20%', fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actions</th>
                  </tr>
                </thead>
                  <tbody>
                    {sorted.map((a, i) => (
                      <tr key={a.NewsArticleId ?? a.newsArticleId ?? a.ArticleId ?? a.articleId ?? a.id ?? i} style={{ borderBottom: '1px solid #f2f2f2', transition: 'background 150ms', cursor: 'default' }} onMouseEnter={e => e.currentTarget.style.background = '#fbfcff'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={styles.sourceCell}>{getSourceLabel(a) === '-' ? (extractSourceFromTitle(a.Title ?? a.title ?? a.snippet) || getSourceLabel(a)) : getSourceLabel(a)}</td>
                        <td style={styles.titleCell}>{getTitleLabel(a) || (a.Title ?? a.title ?? '-')}</td>
                        <td style={styles.dateCell}>{(a.PublishedAt || a.publishedAt || a.fetchedAt || a.crawledAt) ? new Date(a.PublishedAt || a.publishedAt || a.fetchedAt || a.crawledAt).toLocaleDateString() : '-'}</td>
                        <td style={styles.statusCell}>{renderBadge(a)}</td>
                        <td style={styles.actionsCell}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              style={{ ...styles.translateBtn, padding: '6px 8px', fontSize: 13 }}
                              onClick={() => {
                                const nid = a.NewsArticleId ?? a.newsArticleId ?? a.id ?? a.ArticleId ?? a.articleId ?? null
                                if (!nid) { alert('Cannot open translator: article id is missing for this item.'); return }
                                navigate(`/consultant/articles/${nid}`)
                              }}
                            >Translate</button>
                            {canDelete && (
                              <button
                                title="Delete"
                                style={{ background: 'transparent', border: 'none', color: '#c92b2b', fontSize: 16, cursor: 'pointer', paddingLeft: 6 }}
                                onClick={async () => {
                                  const nid = a.NewsArticleId ?? a.newsArticleId ?? a.id ?? a.ArticleId ?? a.articleId ?? null
                                  if (!nid) { showToast('Cannot delete: id missing', 'error'); return }
                                  if (!window.confirm('Delete this article? This cannot be undone.')) return
                                  try {
                                    await deleteArticle(nid)
                                    showToast('Article deleted', 'success')
                                    try { await loadPage(page) } catch (e) { /* ignore */ }
                                    window.dispatchEvent(new Event('articles:changed'))
                                  } catch (err) {
                                    showToast('Failed to delete: ' + (err.message || err), 'error')
                                  }
                                }}
                              >🗑️</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24, gap: 8 }}>
              <div style={{ background: 'white', padding: 8, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => setPage(Math.max(1, page - 1))} style={{ background: 'transparent', border: 'none', padding: '8px 12px', cursor: 'pointer', color: '#999', fontSize: 18 }}>◀</button>
                <button style={{ background: '#c92b2b', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 600, minWidth: 40, cursor: 'default', fontSize: 14 }}>{page}</button>
                <button onClick={() => setPage(Math.min(totalPages, page + 1))} style={{ background: 'transparent', border: 'none', padding: '8px 12px', cursor: 'pointer', color: '#999', fontSize: 18 }}>▶</button>
              </div>
            </div>

            {showDebug && (
                <div style={{ marginTop: 16, background: '#fffef6', padding: 12, borderRadius: 8 }}>
                  <h4>Debug</h4>
                  <div style={{ marginBottom: 8 }}>
                    <strong>Token Claims:</strong>
                    <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(parseJwt(localStorage.getItem('token')), null, 2)}</pre>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong>Current Page Items ({items.length}):</strong>
                    <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 240, overflow: 'auto' }}>{JSON.stringify(items, null, 2)}</pre>
                  </div>
                  <div>
                    <strong>In-Progress Count:</strong> {items.filter(it => { const s = (it.TranslationStatus || it.translationStatus || '').toString().toLowerCase(); return s.includes('progress') || s.includes('inprogress') || s.includes('review') }).length}
                  </div>
              </div>
            )}

            {toast && (
              <div style={{ position: 'fixed', right: 20, bottom: 20, background: toast.type === 'error' ? '#fff4f4' : '#e8f9ee', color: toast.type === 'error' ? '#a00' : '#0a6', padding: '10px 14px', borderRadius: 8, boxShadow: '0 8px 30px rgba(0,0,0,0.08)', zIndex: 9999 }}>
                {toast.message}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
