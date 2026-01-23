import React, { Component, useEffect, useState } from 'react'
import { listArticles, stats, deleteArticle, publishArticles } from '../../api/articles'
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

function ArticlesListInner() {
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
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  // Always show translated articles only
  const activeTab = 'translated'
  const [showDebug, setShowDebug] = useState(false)
  const [pageJump, setPageJump] = useState('')

  useEffect(() => { if (initialized) loadPage(page) }, [page, initialized])
  // reload when other pages signal that articles changed (save/approve)
  useEffect(() => {
    const handler = () => { if (initialized) loadPage(page) }
    window.addEventListener('articles:changed', handler)
    return () => window.removeEventListener('articles:changed', handler)
  }, [page, initialized])
  // always show translated articles; no tab switching or status filters
  useEffect(() => {
    (async () => {
      try {
        await loadStats()
      } catch (e) { /* ignore */ }
      try {
        await loadSources()
      } catch (e) { /* ignore */ }
      setInitialized(true)
      // load first page (translated only)
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
      // Request translated articles only
      const res = await listArticles(pageToLoad, pageSize, 'translated')
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
      // normalize title fields: prefer Chinese `TitleZH`/`titleZh`, check nested `Article` objects,
      // then fall back to English/title/snippet/summary/fullContent variants.
      const normalizeTitle = (it) => {
        if (!it) return ''
        const firstString = (v) => (v === null || typeof v === 'undefined') ? null : (typeof v === 'string' ? v : String(v))
        const candidates = [
          // nested article objects (various casings)
          it.Article && (it.Article.TitleZH ?? it.Article.titleZH ?? it.Article.titleZh),
          it.article && (it.article.TitleZH ?? it.article.titleZH ?? it.article.titleZh),
          // direct fields (preferred Chinese)
          it.TitleZH, it.titleZH, it.titleZh, it.TitleZh,
          // english fallbacks
          it.TitleEN, it.titleEN, it.Title, it.title, it.headline, it.Headline,
          // snippets and summaries
          it.TitleSnippet, it.titleSnippet, it.Snippet, it.snippet, it.Summary, it.summary,
          // content fallbacks
          it.fullContentZH, it.fullContentZh, it.fullContent, it.fullContentEN,
          it.summaryZH, it.summaryZh, it.summaryEN
        ].map(firstString).filter(Boolean)
        return (candidates.length > 0 ? candidates[0].trim() : '')
      }

      const normalized = merged.map(it => ({ ...it, title: normalizeTitle(it) }))

      // Don't filter out articles - show all articles from server
      // Source label resolution will fall back to extracting from title if needed
      console.log(`Page ${pageToLoad}: Loaded ${normalized.length} articles from server`)

      setItems(normalized)
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

  const getArticleId = (a) => a.NewsArticleId ?? a.newsArticleId ?? a.id ?? a.ArticleId ?? a.articleId ?? null

  const toggleSelect = (id) => {
    if (!id) return
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  // Consider translated only when approved or explicitly marked translated/approved
  const isTranslated = (it) => {
    const s = (it.TranslationStatus || it.translationStatus || '').toString().toLowerCase()
    const approved = it.TranslationApprovedAt ?? it.translationApprovedAt ?? null
    if (approved) return true
    if (s.includes('approved')) return true
    if (s.includes('translated')) return true
    return false
  }

  const isAllSelected = (() => {
    if (!Array.isArray(items) || items.length === 0) return false
    // compute visible ids from current items (same filtering as `filtered` below)
    const visibleIds = items
      .filter(it => {
        if (activeTab === 'active' && isTranslated(it)) return false
        if (activeTab === 'translated' && !isTranslated(it)) return false
        if (query) {
          const q = query.toLowerCase()
          const title = (it.title || '').toString().toLowerCase()
          const src = (getSourceLabel(it) || '').toString().toLowerCase()
          return title.includes(q) || src.includes(q)
        }
        return true
      })
      .map(it => getArticleId(it)).filter(Boolean)
    if (visibleIds.length === 0) return false
    return visibleIds.every(id => selectedIds.includes(id))
  })()

  const toggleSelectAll = () => {
    const visibleIds = items
      .filter(it => {
        if (activeTab === 'active' && isTranslated(it)) return false
        if (activeTab === 'translated' && !isTranslated(it)) return false
        if (query) {
          const q = query.toLowerCase()
          const title = (it.title || '').toString().toLowerCase()
          const src = (getSourceLabel(it) || '').toString().toLowerCase()
          return title.includes(q) || src.includes(q)
        }
        return true
      })
      .map(it => getArticleId(it)).filter(Boolean)
    if (visibleIds.length === 0) return
    if (visibleIds.every(id => selectedIds.includes(id))) {
      // unselect visible
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)))
    } else {
      // add visible ids
      setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])))
    }
  }

  const publishSelected = async () => {
    if (!selectedIds || selectedIds.length === 0) { alert('No articles selected'); return }
    if (!window.confirm(`Publish ${selectedIds.length} selected article(s)?`)) return
    try {
      setLoading(true)
      await publishArticles(selectedIds)
      showToast('Publish request sent', 'success')
      setSelectedIds([])
      try { await loadPage(page) } catch (e) { /* ignore */ }
      window.dispatchEvent(new Event('articles:changed'))
    } catch (err) {
      showToast('Publish failed: ' + (err.message || err), 'error')
    } finally { setLoading(false) }
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
    const rawTitle = a.title ?? a.TitleZH ?? a.titleZh ?? a.Title ?? a.snippet ?? ''
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
  
  // We only show translated articles; use translated count for pagination total if available
  const effectiveTotal = Number(displayCounts.translated ?? total ?? 0) || 0
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / viewPageSize))

  // Filter items: include only translated articles and apply search
  const filtered = items.filter(it => {
    // active: exclude translated items
    if (activeTab === 'active' && isTranslated(it)) return false
    // translated: include only translated items (saved or explicitly translated/approved)
    if (activeTab === 'translated' && !isTranslated(it)) return false
    if (query) {
      const q = query.toLowerCase()
      const title = (it.title || '').toString().toLowerCase()
      const src = (getSourceLabel(it) || '').toString().toLowerCase()
      return title.includes(q) || src.includes(q)
    }
    return true
  })

  console.log(`Active tab: ${activeTab}, Items: ${items.length}, Filtered: ${filtered.length}`)

  const sorted = filtered.slice()

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
                <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>Translated Articles</div>
                </div>

                <div style={{ ...styles.controls, marginLeft: 'auto' }}>
                  <button
                    onClick={publishSelected}
                    disabled={selectedIds.length === 0}
                    style={{ marginRight: 8, background: selectedIds.length === 0 ? '#f3f3f3' : '#1e73d1', color: selectedIds.length === 0 ? '#999' : 'white', padding: '8px 12px', borderRadius: 8, border: 'none', cursor: selectedIds.length === 0 ? 'default' : 'pointer', fontWeight: 700 }}
                  >Publish Selected</button>
                  <input placeholder="🔍 Search" value={query} onChange={e => setQuery(e.target.value)} style={styles.input} />
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #e8e8e8', background: 'transparent' }}>
                    <th style={{ padding: '12px 8px', width: '4%', fontSize: 12 }}>
                      <input type="checkbox" checked={isAllSelected} onChange={toggleSelectAll} />
                    </th>
                    <th style={{ padding: '12px 8px', width: '15%', fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Source</th>
                    <th style={{ padding: '12px 8px', width: '35%', fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Article Title</th>
                    <th style={{ padding: '12px 8px', width: '15%', fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date Published</th>
                    <th style={{ padding: '12px 8px', width: '15%', fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                    <th style={{ padding: '12px 8px', width: '20%', fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actions</th>
                  </tr>
                </thead>
                  <tbody>
                    {sorted.map((a, i) => {
                      const nid = getArticleId(a) || i
                      return (
                        <tr key={nid} style={{ borderBottom: '1px solid #f2f2f2', transition: 'background 150ms', cursor: 'default' }} onMouseEnter={e => e.currentTarget.style.background = '#fbfcff'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <td style={{ padding: 8 }}>
                            <input type="checkbox" checked={selectedIds.includes(nid)} onChange={() => toggleSelect(nid)} />
                          </td>
                          <td style={styles.sourceCell}>{getSourceLabel(a) === '-' ? (extractSourceFromTitle(a.title) || getSourceLabel(a)) : getSourceLabel(a)}</td>
                          <td style={styles.titleCell}>{getTitleLabel(a) || (a.title || '-')}</td>
                          <td style={styles.dateCell}>{(a.PublishedAt || a.publishedAt || a.fetchedAt || a.crawledAt) ? new Date(a.PublishedAt || a.publishedAt || a.fetchedAt || a.crawledAt).toLocaleDateString() : '-'}</td>
                          <td style={styles.statusCell}>{renderBadge(a)}</td>
                          <td style={styles.actionsCell}>
                            <div style={{ display: 'flex', gap: 8 }}>
                              {/* Review button */}
                              <button
                                title="Review"
                                style={{ background: 'transparent', border: 'none', color: '#2b6cb0', fontSize: 16, cursor: 'pointer', paddingLeft: 6 }}
                                onClick={() => {
                                  if (!nid) { showToast('Cannot open review: id missing', 'error'); return }
                                  navigate(`/consultant/articles/${nid}`)
                                }}
                              >📝</button>
                              {canDelete && (
                                <button
                                  title="Delete"
                                  style={{ background: 'transparent', border: 'none', color: '#c92b2b', fontSize: 16, cursor: 'pointer', paddingLeft: 6 }}
                                  onClick={async () => {
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
                      )
                    })}
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

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    this.setState({ error, info })
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <h3 style={{ color: '#c92b2b' }}>An error occurred while rendering this view.</h3>
          <div style={{ whiteSpace: 'pre-wrap', marginTop: 12, background: '#fff7f7', padding: 12, borderRadius: 8 }}>
            {String(this.state.error && this.state.error.toString())}
            {this.state.info && this.state.info.componentStack ? '\n' + this.state.info.componentStack : ''}
          </div>
          <div style={{ marginTop: 12 }}>
            <button onClick={() => window.location.reload()} style={{ padding: '8px 12px', borderRadius: 8 }}>Reload</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function ArticlesList() {
  return (
    <ErrorBoundary>
      <ArticlesListInner />
    </ErrorBoundary>
  )
}