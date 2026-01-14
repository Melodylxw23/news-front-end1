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
  const [pageSize] = useState(5)
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
  const [sortBy, setSortBy] = useState('default') // default | pendingOnly | inProgressOnly | pendingFirst | inProgressFirst
  const [showDebug, setShowDebug] = useState(false)
  const [pageJump, setPageJump] = useState('')

  useEffect(() => { if (initialized) loadPage(page) }, [page, initialized, activeTab, sortBy])
  // reload when other pages signal that articles changed (save/approve)
  useEffect(() => {
    const handler = () => { if (initialized) loadPage(page) }
    window.addEventListener('articles:changed', handler)
    return () => window.removeEventListener('articles:changed', handler)
  }, [page, initialized, activeTab, sortBy])
  // reset to page 1 when switching tabs
  useEffect(() => {
    setPage(1)
  }, [activeTab])
  // reset to page 1 when using status-only filters
  useEffect(() => {
    if ((sortBy === 'pendingOnly' || sortBy === 'inProgressOnly') && page !== 1) {
      setPage(1)
    }
  }, [sortBy])
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
      // Determine status filter based on active tab and sortBy
      let statusFilter = null
      if (activeTab === 'translated') {
        statusFilter = 'translated'
      } else if (activeTab === 'active') {
        if (sortBy === 'pendingOnly') statusFilter = 'pending'
        else if (sortBy === 'inProgressOnly') statusFilter = 'inProgress'
        // For 'default', 'pendingFirst', 'inProgressFirst', don't filter by status on backend
        // Backend should return both pending and inProgress when status is null or 'active'
      }
      const res = await listArticles(pageToLoad, pageSize, statusFilter)
      // Normalize multiple possible response shapes
      const itemsPage = Array.isArray(res)
        ? res
        : Array.isArray(res?.Items)
          ? res.Items
          : Array.isArray(res?.items)
            ? res.items
            : Array.isArray(res?.Data)
              ? res.Data
              : Array.isArray(res?.data)
                ? res.data
                : []
      const totalCount = res?.Total ?? res?.total ?? res?.Count ?? res?.count ?? itemsPage.length
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
    const approved = it.TranslationApprovedAt ?? it.translationApprovedAt ?? null

    // Consider translated only when approved or explicitly marked translated/approved
    if (approved) return true
    if (s.includes('approved')) return true
    if (s.includes('translated')) return true

    // Pending / In Progress are not translated
    return false
  }

  const pageCounts = items.reduce((acc, it) => {
    const s = (it.TranslationStatus || it.translationStatus || '').toString().toLowerCase()
    acc.page += 1

    // InProgress: status is InProgress (being actively translated or needing review)
    if (s.includes('inprogress') || s.includes('in progress')) acc.inProgress += 1
    // Translated: only when approved/translated per isTranslated
    else if (isTranslated(it)) acc.translated += 1
    // Pending: everything else
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
    const base = { padding: '6px 10px', borderRadius: 12, fontWeight: 600, fontSize: 12 }

    // InProgress: being actively translated (by user or needs review after crawler)
    if (s.includes('inprogress') || s.includes('in progress')) {
      return <span style={{ ...base, background: '#fff4e6', color: '#e07a16' }}>In Progress</span>
    }

    // Translated: only when approved/translated per new rule
    if (isTranslated(item)) {
      return <span style={{ ...base, background: '#e8f9ee', color: '#1e7a3a' }}>Translated</span>
    }

    // Pending: not started (no approval yet)
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
  
  // Adjust total count based on active filter AND active tab
  let effectiveTotal = total
  if (sortBy === 'pendingOnly') {
    effectiveTotal = displayCounts.pending
  } else if (sortBy === 'inProgressOnly') {
    effectiveTotal = displayCounts.inProgress
  } else {
    // When no status filter is selected, use tab-appropriate totals
    if (activeTab === 'active') {
      // Active tab excludes translated articles
      effectiveTotal = displayCounts.pending + displayCounts.inProgress
    } else if (activeTab === 'translated') {
      // Translated tab shows only translated articles
      effectiveTotal = displayCounts.translated
    }
    // else use total for any other tab
  }
  const totalPages = Math.max(1, Math.ceil((effectiveTotal || 0) / viewPageSize))

  const getStatusCategory = (it) => {
    const s = (it.TranslationStatus || it.translationStatus || '').toString().toLowerCase()
    if (s.includes('inprogress') || s.includes('in progress')) return 'inProgress'
    if (isTranslated(it)) return 'translated'
    return 'pending'
  }

  // Apply status-only filters BEFORE tab filtering so they work independently
  let statusFiltered = items.slice()
  if (sortBy === 'pendingOnly') {
    statusFiltered = statusFiltered.filter(it => getStatusCategory(it) === 'pending')
  } else if (sortBy === 'inProgressOnly') {
    statusFiltered = statusFiltered.filter(it => getStatusCategory(it) === 'inProgress')
  }

  const filtered = statusFiltered.filter(it => {
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

  const sorted = (() => {
    const arr = filtered.slice()

    // "First" sorts: prioritize status but show all (status-only filters already applied above)
    if (sortBy === 'pendingFirst') {
      return arr.sort((a, b) => {
        const aCat = getStatusCategory(a)
        const bCat = getStatusCategory(b)
        if (aCat === 'pending' && bCat !== 'pending') return -1
        if (aCat !== 'pending' && bCat === 'pending') return 1
        return 0
      })
    }
    if (sortBy === 'inProgressFirst') {
      return arr.sort((a, b) => {
        const aCat = getStatusCategory(a)
        const bCat = getStatusCategory(b)
        if (aCat === 'inProgress' && bCat !== 'inProgress') return -1
        if (aCat !== 'inProgress' && bCat === 'inProgress') return 1
        return 0
      })
    }

    return arr
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
                    <option value="default">Filter By ▼</option>
                    <option value="pendingOnly">Pending Only</option>
                    <option value="inProgressOnly">In Progress Only</option>
                    <option value="pendingFirst">Pending First</option>
                    <option value="inProgressFirst">In Progress First</option>
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

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24, gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ background: 'white', padding: 10, borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  style={{ background: 'transparent', border: 'none', padding: '8px 10px', cursor: page <= 1 ? 'default' : 'pointer', color: page <= 1 ? '#ccc' : '#999', fontSize: 18 }}
                >◀</button>

                {(() => {
                  const windowSize = 1
                  const pages = new Set()
                  pages.add(1)
                  pages.add(totalPages)
                  for (let p = page - windowSize; p <= page + windowSize; p += 1) {
                    if (p >= 1 && p <= totalPages) pages.add(p)
                  }
                  const sortedPages = Array.from(pages).sort((a, b) => a - b)

                  const buttons = []
                  sortedPages.forEach((p, idx) => {
                    const prev = sortedPages[idx - 1]
                    if (idx > 0 && p - prev > 1) {
                      buttons.push(<span key={`gap-${p}`} style={{ padding: '0 4px', color: '#999' }}>…</span>)
                    }
                    const isActive = p === page
                    buttons.push(
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        style={{
                          background: isActive ? '#c92b2b' : '#f5f5f5',
                          color: isActive ? 'white' : '#555',
                          border: 'none',
                          padding: '8px 12px',
                          borderRadius: 8,
                          fontWeight: 600,
                          minWidth: 36,
                          cursor: isActive ? 'default' : 'pointer',
                          fontSize: 14
                        }}
                      >{p}</button>
                    )
                  })
                  return buttons
                })()}

                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  style={{ background: 'transparent', border: 'none', padding: '8px 10px', cursor: page >= totalPages ? 'default' : 'pointer', color: page >= totalPages ? '#ccc' : '#999', fontSize: 18 }}
                >▶</button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  min="1"
                  value={pageJump}
                  onChange={(e) => setPageJump(e.target.value)}
                  placeholder="Go to page"
                  style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e2e2', width: 110 }}
                />
                <button
                  onClick={() => {
                    const num = Number(pageJump)
                    if (!num || Number.isNaN(num) || num < 1) {
                      alert('Enter a valid page number (1 or higher).')
                      return
                    }
                    if (num > totalPages) {
                      alert(`Maximum page is ${totalPages}.`)
                      return
                    }
                    setPage(num)
                  }}
                  style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#c92b2b', color: 'white', fontWeight: 600, cursor: 'pointer' }}
                >Go</button>
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
