import React, { Component, useEffect, useState } from 'react'
import { listArticles, stats, deleteArticle, publishArticles, batchSaveDrafts } from '../../api/articles'
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
  const [pages, setPages] = useState({ translated: 1, pushed: 1 })
  const [pageSize] = useState(5)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [rawFetchedCount, setRawFetchedCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const navigate = useNavigate()
  const [sourcesMap, setSourcesMap] = useState({})
  const [globalCounts, setGlobalCounts] = useState(null)
  const [initialized, setInitialized] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  // Tab state: allow switching between 'translated' and 'pushed' views
  const [activeTab, setActiveTab] = useState('translated')
  const [showDebug, setShowDebug] = useState(false)
  const [pageJump, setPageJump] = useState('')
  const [includePushed, setIncludePushed] = useState(false)
  const [showExtraList, setShowExtraList] = useState(false)
  const [diagUniqueCount, setDiagUniqueCount] = useState(null)
  const [diagVisibleExcludingPushed, setDiagVisibleExcludingPushed] = useState(null)
  const [diagItems, setDiagItems] = useState([])
  const [showExtraInTable, setShowExtraInTable] = useState(false)

  useEffect(() => {
    if (!initialized) return
    // When includePushed is enabled we fetch all translated pages; avoid
    // running the paginated `loadPage` which would overwrite the full items list.
    if (activeTab === 'translated' && includePushed) return
    loadPage(pages[activeTab] || 1)
  }, [pages, initialized, activeTab, includePushed])
  // reload when other pages signal that articles changed (save/approve)
  useEffect(() => {
    const handler = () => { if (initialized) loadPage(pages[activeTab] || 1) }
    window.addEventListener('articles:changed', handler)
    return () => window.removeEventListener('articles:changed', handler)
  }, [pages, initialized, activeTab])
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
      try { await loadPage(pages[activeTab] || 1) } catch (e) { /* ignore */ }
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

      setRawFetchedCount(normalized.length)
      // Do not hide queued items — show all articles from server
      setItems(normalized)
      setTotal(Number(totalCount) || 0)
      // refresh global stats after loading a page so totals reflect current DB state
      try { await loadStats() } catch (e) { /* ignore */ }
      // global stats are loaded once on mount; do not refresh here to avoid
      // changing stat cards when navigating pages.
    } catch (e) {
      alert('Failed to load articles: ' + (e.message || e))
    } finally { setLoading(false) }
  }

  // Load all translated pages from the server (used when includePushed is enabled)
  const loadAllTranslatedPages = async () => {
    setLoading(true)
    try {
      // determine how many pages to fetch from server counts
      const totalTranslated = Number(displayCounts && displayCounts.translated != null ? displayCounts.translated : total) || 0
      const pagesToFetch = Math.max(1, Math.ceil(totalTranslated / pageSize))
      const allItems = []
      for (let p = 1; p <= pagesToFetch; p += 1) {
        try {
          const res = await listArticles(p, pageSize, 'translated')
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
          allItems.push(...itemsPage)
        } catch (e) {
          // continue fetching remaining pages even if one fails
          console.warn('Failed to fetch translated page', p, e)
        }
      }
      const normalizeTitle = (it) => {
        if (!it) return ''
        const firstString = (v) => (v === null || typeof v === 'undefined') ? null : (typeof v === 'string' ? v : String(v))
        const candidates = [
          it.Article && (it.Article.TitleZH ?? it.Article.titleZH ?? it.Article.titleZh),
          it.article && (it.article.TitleZH ?? it.article.titleZH ?? it.article.titleZh),
          it.TitleZH, it.titleZH, it.titleZh, it.TitleZh,
          it.TitleEN, it.titleEN, it.Title, it.title, it.headline, it.Headline,
          it.TitleSnippet, it.titleSnippet, it.Snippet, it.snippet, it.Summary, it.summary,
          it.fullContentZH, it.fullContentZh, it.fullContent, it.fullContentEN,
          it.summaryZH, it.summaryZh, it.summaryEN
        ].map(firstString).filter(Boolean)
        return (candidates.length > 0 ? candidates[0].trim() : '')
      }
      const normalized = allItems.map(it => ({ ...it, title: normalizeTitle(it) }))
      setRawFetchedCount(normalized.length)
      // dedupe by article id since server pages may contain overlapping or extra rows
      const byId = new Map()
      for (const it of normalized) {
        const id = Number(getArticleId(it))
        if (Number.isFinite(id)) {
          if (!byId.has(id)) byId.set(id, it)
        } else {
          // keep items without a numeric id as well using a generated key
          const key = `local-${Math.random().toString(36).slice(2,9)}`
          byId.set(key, it)
        }
      }
      const unique = Array.from(byId.values())
      console.log(`Loaded all translated pages: ${normalized.length} articles (${unique.length} unique)`)
      setItems(unique)
      setTotal(Number(displayCounts && displayCounts.translated != null ? displayCounts.translated : unique.length) || unique.length)
    } catch (e) {
      console.warn('Failed to load all translated pages', e)
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

  const getPublishQueueIds = () => {
    try {
      const raw = JSON.parse(localStorage.getItem('publishQueue') || '[]')
      if (!Array.isArray(raw)) return []
      return raw.map(e => {
        if (typeof e === 'number') return Number(e)
        if (typeof e === 'string') {
          try { const p = JSON.parse(e); return Number(p?.id ?? p?.NewsArticleId ?? p?.article?.NewsArticleId ?? p?.article?.id ?? NaN) } catch (_) { const n = Number(e); return Number.isNaN(n) ? null : n }
        }
        if (typeof e === 'object' && e !== null) return Number(e.id ?? e.NewsArticleId ?? e.article?.NewsArticleId ?? e.article?.id ?? NaN)
        return null
      }).filter(x => Number.isFinite(x))
    } catch (e) { return [] }
  }

  // Return normalized local publishQueue entries as objects { id, data }
  const getLocalPublishQueue = () => {
    try {
      const raw = JSON.parse(localStorage.getItem('publishQueue') || '[]')
      if (!Array.isArray(raw)) return []
      return raw.map(e => {
        if (typeof e === 'number') return { id: Number(e), data: null }
        if (typeof e === 'string') {
          try {
            const p = JSON.parse(e) || {}
            return { id: Number(p?.id ?? p?.NewsArticleId ?? p?.article?.id ?? p?.article?.NewsArticleId ?? NaN), data: p.data ?? p }
          } catch (_) {
            const n = Number(e)
            return { id: Number.isFinite(n) ? n : NaN, data: null }
          }
        }
        if (typeof e === 'object' && e !== null) {
          return { id: Number(e.id ?? e.NewsArticleId ?? e.article?.id ?? e.article?.NewsArticleId ?? NaN), data: e.data ?? (e.article ? { article: e.article } : e) }
        }
        return null
      }).filter(x => x && Number.isFinite(x.id))
    } catch (e) { return [] }
  }

  const isPushed = (it) => {
    try {
      const id = Number(getArticleId(it))
      if (!id) return false
      // if the local payload marks it as queued, treat as pushed
      if (it && it._clientQueued) return true
      if (it && it.data && it.data._clientQueued) return true
      const ids = getPublishQueueIds()
      return ids.includes(id)
    } catch (e) { return false }
  }

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

  const isAllSelected = () => {
    const current = pages[activeTab] || 1
    const visible = displayed.slice((current - 1) * pageSize, current * pageSize)
    if (!Array.isArray(visible) || visible.length === 0) return false
    const visibleIds = visible.map(it => getArticleId(it)).filter(Boolean)
    if (visibleIds.length === 0) return false
    return visibleIds.every(id => selectedIds.includes(id))
  }

  const toggleSelectAll = () => {
    const current = pages[activeTab] || 1
    const visible = displayed.slice((current - 1) * pageSize, current * pageSize)
    const visibleIds = visible.map(it => getArticleId(it)).filter(Boolean)
    if (visibleIds.length === 0) return
    if (visibleIds.every(id => selectedIds.includes(id))) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)))
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])))
    }
  }

  const publishSelected = async () => {
    if (!selectedIds || selectedIds.length === 0) { alert('No articles selected'); return }
    if (!window.confirm(`Push ${selectedIds.length} selected article(s) to publish queue?`)) return
    try {
      setLoading(true)
      // Do not create drafts on push — pushing only queues the article for review

      // maintain a client-side queue storing full article objects so PublishQueue renders immediately
      const rawExisting = JSON.parse(localStorage.getItem('publishQueue') || '[]')
      const existingObjs = Array.isArray(rawExisting) ? rawExisting.map(e => {
        if (typeof e === 'number') return { id: Number(e) }
        if (typeof e === 'string') {
          try {
            const parsed = JSON.parse(e)
            return { ...(parsed || {}), id: Number(parsed?.id ?? parsed?.NewsArticleId ?? parsed?.article?.id ?? parsed?.article?.NewsArticleId ?? NaN) }
          } catch (err) {
            const n = Number(e)
            if (!Number.isNaN(n)) return { id: n }
            return null
          }
        }
        try { return { ...(e || {}), id: Number(e.id ?? e.NewsArticleId ?? e.article?.id ?? e.article?.NewsArticleId ?? NaN) } } catch (err) { return null }
      }).filter(x => x && !Number.isNaN(x.id)) : []

      const toAddObjs = selectedIds.map(idRaw => {
        const id = Number(idRaw)
        if (Number.isNaN(id)) return null
        if (existingObjs.some(x => x.id === id)) return null
        const found = items.find(it => Number(getArticleId(it) ?? NaN) === id)
        if (!found) return { id }
        // When pushing from ArticleList, do NOT surface server "live" flags locally.
        // Create a local payload under `data.article` and strip published/scheduled indicators
        const clone = { ...(found || {}) }
        // remove server publish indicators so the queue treats this as Ready/Pending
        delete clone.PublishedAt
        delete clone.publishedAt
        delete clone.IsPublished
        delete clone.isPublished
        // also remove any draft fields if present
        delete clone.draft
        return { id, data: { article: clone, _clientQueued: true } }
      }).filter(Boolean)

      const merged = [...existingObjs, ...toAddObjs]
      const deduped = merged.reduce((acc, cur) => { if (!acc.some(x => x.id === cur.id)) acc.push(cur); return acc }, [])
      localStorage.setItem('publishQueue', JSON.stringify(deduped))

      // keep articles visible in the ArticleList (do not remove them)

      // refresh server stats so total reflects any server-side changes
      try { await loadStats() } catch (e) { /* ignore */ }
      showToast('Pushed to publish queue', 'success')
      setSelectedIds([])
      window.dispatchEvent(new Event('articles:changed'))
    } catch (err) {
      showToast('Failed to push to queue: ' + (err.message || err), 'error')
    } finally { setLoading(false) }
  }

  const saveSelectedAsDrafts = async () => {
    if (!selectedIds || selectedIds.length === 0) { alert('No articles selected'); return }
    if (!window.confirm(`Save ${selectedIds.length} selected article(s) as drafts?`)) return
    try {
      setLoading(true)
      const dtos = selectedIds.map(id => ({ NewsArticleId: id }))
      const res = await batchSaveDrafts(dtos)
      showToast('Drafts saved', 'success')
      try {
        const okIds = Array.isArray(res) ? res.filter(r => r.success).map(r => r.id) : selectedIds
        setItems(prev => prev.filter((it, idx) => {
          const nid = getArticleId(it) || idx
          return !okIds.includes(nid)
        }))
      } catch (e) { /* ignore */ }
      setSelectedIds([])
      window.dispatchEvent(new Event('articles:changed'))
    } catch (err) {
      showToast('Save drafts failed: ' + (err.message || err), 'error')
    } finally { setLoading(false) }
  }

  const unpublishSelected = async () => {
    if (!selectedIds || selectedIds.length === 0) { alert('No articles selected'); return }
    if (!window.confirm(`Unpublish ${selectedIds.length} selected article(s)?`)) return
    try {
      setLoading(true)
      const res = await batchUnpublish(selectedIds)
      showToast('Unpublish request sent', 'success')
      try {
        const okIds = Array.isArray(res) ? res.filter(r => r.success).map(r => r.id) : selectedIds
        setItems(prev => prev.filter((it, idx) => {
          const nid = getArticleId(it) || idx
          return !okIds.includes(nid)
        }))
      } catch (e) { /* ignore */ }
      setSelectedIds([])
      window.dispatchEvent(new Event('articles:changed'))
    } catch (err) {
      showToast('Unpublish failed: ' + (err.message || err), 'error')
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

    // If this article is in the local publish queue, mark it as Pushed
    if (isPushed(item)) {
      return <span style={{ ...base, background: '#e6f0ff', color: '#1e73d1' }}>Pushed</span>
    }

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
  
  // We only show translated articles; use count of translated items currently loaded
  const translatedShownCount = items.filter(it => isTranslated(it)).length
  const localPublishQueue = getLocalPublishQueue()
  const pushedShownCount = localPublishQueue.length
  const displayTranslated = Number(displayCounts && displayCounts.translated != null ? displayCounts.translated : translatedShownCount) || 0
  const extraVisibleCount = Math.max(0, translatedShownCount - displayTranslated)

  // Filter items: include only translated articles and apply search. For the "pushed" tab
  // show entries derived from local publishQueue so items pushed from other pages are visible.
  let filtered = []
  if (activeTab === 'pushed') {
    // map local queue entries to article-like objects, prefer server item when available
    filtered = localPublishQueue.map(lq => {
      const server = items.find(it => Number(getArticleId(it)) === Number(lq.id))
      if (server) return server
      // build a lightweight placeholder using any draft/article data from local queue
      const title = lq.data?.draft?.TitleEN ?? lq.data?.draft?.Title ?? lq.data?.article?.title ?? lq.data?.article?.Title ?? `Article ${lq.id}`
      return { NewsArticleId: lq.id, title, PublishedAt: null, TranslationStatus: 'Translated' }
    }).filter(Boolean)
    // apply search filter if query present
    if (query) {
      const q = query.toLowerCase()
      filtered = filtered.filter(it => ((it.title || '').toString().toLowerCase().includes(q)) || ((getSourceLabel(it) || '').toString().toLowerCase().includes(q)))
    }
  } else {
    filtered = items.filter(it => {
      // active: exclude translated items
      if (activeTab === 'active' && isTranslated(it)) return false
      // translated: include only translated items (saved or explicitly translated/approved)
      if (activeTab === 'translated' && !isTranslated(it)) return false
      // do not show pushed items in the translated tab unless `includePushed` is enabled
      if (activeTab === 'translated' && !includePushed && isPushed(it)) return false
      if (query) {
        const q = query.toLowerCase()
        const title = (it.title || '').toString().toLowerCase()
        const src = (getSourceLabel(it) || '').toString().toLowerCase()
        return title.includes(q) || src.includes(q)
      }
      return true
    })
  }

  console.log(`Active tab: ${activeTab}, Items: ${items.length}, Filtered: ${filtered.length}`)

  // Optionally merge diagnostic extra items into the displayed list so the
  // main table can show articles that the server counted but the paginated
  // view filtered out (e.g. pushed items). Compute `displayed` and then
  // derive pagination from it so counts and pages align with the table.
  const displayed = (() => {
    // If extras-in-table is enabled and we have diagnostics, use the
    // diagnostic unique ordering as the authoritative list so items are
    // de-duplicated across pages and pagination is stable.
    if (showExtraInTable && Array.isArray(diagItems) && diagItems.length > 0) {
      let src = diagItems.slice()
      // keep only translated items
      src = src.filter(it => isTranslated(it))
      // respect includePushed flag: when false, exclude pushed items
      if (activeTab === 'translated' && !includePushed) src = src.filter(it => !isPushed(it))
      // ensure dedupe by numeric id
      const byId = new Map()
      for (const it of src) {
        const id = Number(getArticleId(it))
        if (Number.isFinite(id)) {
          if (!byId.has(id)) byId.set(id, it)
        } else {
          const key = `local-${Math.random().toString(36).slice(2,9)}`
          if (!byId.has(key)) byId.set(key, it)
        }
      }
      return Array.from(byId.values())
    }
    // Fallback: use current filtered (page-scoped) list
    return filtered.slice()
  })()

  const effectiveTotal = activeTab === 'pushed' ? pushedShownCount : displayed.length
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / viewPageSize))
  // Clamp current page to valid range to avoid showing empty table rows
  const currentPage = Math.max(1, Math.min(pages[activeTab] || 1, totalPages))

  const displayExtra = (diagVisibleExcludingPushed != null) ? Math.max(0, diagVisibleExcludingPushed - displayTranslated) : extraVisibleCount
  const extraAll = (diagUniqueCount != null) ? Math.max(0, diagUniqueCount - displayTranslated) : null

  // Diagnostic: fetch all translated pages in the background (without
  // replacing the current `items`) to determine whether the server's
  // numeric total aligns with the actual rows and to compute the extra
  // visible count even when `includePushed` is false.
  const runDiagnosticFetch = async () => {
    try {
      const totalTranslated = Number(displayCounts && displayCounts.translated != null ? displayCounts.translated : total) || 0
      const pagesToFetch = Math.max(1, Math.ceil(totalTranslated / pageSize))
      const allItems = []
      for (let p = 1; p <= pagesToFetch; p += 1) {
        try {
          const res = await listArticles(p, pageSize, 'translated')
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
          allItems.push(...itemsPage)
        } catch (e) {
          console.warn('Diagnostic fetch failed for page', p, e)
        }
      }
      const firstString = (v) => (v === null || typeof v === 'undefined') ? null : (typeof v === 'string' ? v : String(v))
      const normalizeTitle = (it) => {
        if (!it) return ''
        const candidates = [
          it.Article && (it.Article.TitleZH ?? it.Article.titleZH ?? it.Article.titleZh),
          it.article && (it.article.TitleZH ?? it.article.titleZH ?? it.article.titleZh),
          it.TitleZH, it.titleZH, it.titleZh, it.TitleZh,
          it.TitleEN, it.titleEN, it.Title, it.title, it.headline, it.Headline,
          it.TitleSnippet, it.titleSnippet, it.Snippet, it.snippet, it.Summary, it.summary,
          it.fullContentZH, it.fullContentZh, it.fullContent, it.fullContentEN,
          it.summaryZH, it.summaryZh, it.summaryEN
        ].map(firstString).filter(Boolean)
        return (candidates.length > 0 ? candidates[0].trim() : '')
      }
      const normalized = allItems.map(it => ({ ...it, title: normalizeTitle(it) }))
      const byId = new Map()
      for (const it of normalized) {
        const id = Number(getArticleId(it))
        if (Number.isFinite(id)) {
          if (!byId.has(id)) byId.set(id, it)
        } else {
          const key = `local-${Math.random().toString(36).slice(2,9)}`
          byId.set(key, it)
        }
      }
      const unique = Array.from(byId.values())
      const visibleExcl = unique.filter(it => !isPushed(it)).length
      setDiagUniqueCount(unique.length)
      setDiagVisibleExcludingPushed(visibleExcl)
      setDiagItems(unique.slice(0, 200))
    } catch (e) {
      console.warn('runDiagnosticFetch failed', e)
      setDiagUniqueCount(null)
      setDiagVisibleExcludingPushed(null)
      setDiagItems([])
    }
  }

  useEffect(() => {
    if (!initialized) return
    // run a diagnostic pass in background to compute extra counts
    runDiagnosticFetch().catch(() => {})
    const onChange = () => runDiagnosticFetch().catch(() => {})
    window.addEventListener('storage', onChange)
    window.addEventListener('articles:changed', onChange)
    return () => { window.removeEventListener('storage', onChange); window.removeEventListener('articles:changed', onChange) }
  }, [initialized])

  // When includePushed is enabled we attempted to fetch all translated pages; ensure toggling triggers loads
  useEffect(() => {
    if (!initialized) return
    if (activeTab !== 'translated') return
    if (includePushed) {
      loadAllTranslatedPages().catch(() => {})
    } else {
      // go back to server-paginated view. Reset translated page to 1 so
      // the visible count and the table page stay in sync after toggling.
      setPages(prev => ({ ...prev, [activeTab]: 1 }))
      try { setPageJump(1) } catch (e) { /* ignore if not present */ }
      loadPage(1).catch(() => {})
    }
  }, [includePushed, initialized, activeTab])

  const sorted = displayed.slice()
  const pageItems = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="content-full">
      <div className="page-inner">
        <div style={styles.page}>
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: '#888', marginBottom: 8 }}>Fetched Incoming Articles</h1>
            <p style={{ fontSize: 15, color: '#999', margin: 0 }}>Manage all fetched Chinese articles to be translated into English</p>
          </div>

          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <div style={styles.statCard}>
              <div style={{ color: palette.success, fontSize: 13, fontWeight: 700 }}>Translated</div>
              <div style={{ fontSize: 36, fontWeight: 700, marginTop: 6, color: palette.success }}>{translatedShownCount}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
                Server: {displayTranslated} · Visible: {translatedShownCount}
                {rawFetchedCount ? ` · Raw: ${rawFetchedCount}` : null}
                {(displayExtra > 0 || (extraAll > 0)) && (
                  <span style={{ marginLeft: 8, color: '#c92b2b', fontWeight: 600 }}>
                    Extra: {displayExtra > 0 ? displayExtra : 0}
                    {extraAll > 0 && (
                      <span style={{ marginLeft: 8, fontWeight: 600, color: '#a12b2b' }}>(all: {extraAll})</span>
                    )}
                    <button onClick={() => setShowExtraList(s => !s)} style={{ marginLeft: 8, background: 'transparent', border: 'none', color: '#1e73d1', cursor: 'pointer' }}>{showExtraList ? 'Hide' : 'Show'} list</button>
                    <button onClick={() => setShowExtraInTable(s => !s)} style={{ marginLeft: 8, background: showExtraInTable ? '#c92b2b' : 'transparent', color: showExtraInTable ? 'white' : '#1e73d1', border: 'none', padding: '4px 8px', borderRadius: 6, cursor: 'pointer' }}>{showExtraInTable ? 'Hide extras in table' : 'Show extras in table'}</button>
                  </span>
                )}
              </div>
              <div style={{ color: '#999', fontSize: 12, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 18 }}>📋</span>
                All translated articles
              </div>
            </div>
            {showExtraList && (displayExtra > 0 || (extraAll > 0)) && (
              <div style={{ marginTop: 12, background: '#fff7f7', padding: 12, borderRadius: 8 }}>
                <strong>Visible articles (diagnostic titles & ids):</strong>
                <ul style={{ maxHeight: 220, overflow: 'auto', marginTop: 8 }}>
                  {diagItems.filter(it => isTranslated(it)).map((it, idx) => (
                    <li key={idx} style={{ marginBottom: 6 }}>
                      <strong>{getArticleId(it) ?? '(no-id)'}</strong>: {getTitleLabel(it) || it.title || '[no title]'}
                    </li>
                  ))}
                </ul>
                <div style={{ fontSize: 12, color: '#666' }}>Note: this list is gathered by fetching all translated pages for diagnostics; to map specific server counts we still may need HARs.</div>
              </div>
            )}
            <div style={styles.statCard}>
              <div style={{ color: '#1e73d1', fontSize: 13, fontWeight: 700 }}>Pushed</div>
              <div style={{ fontSize: 36, fontWeight: 700, marginTop: 6, color: '#1e73d1' }}>{pushedShownCount}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>Local: {pushedShownCount}</div>
              <div style={{ color: '#999', fontSize: 12, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 18 }}>📤</span>
                Articles pushed to publish queue
              </div>
            </div>
          </div>

          <div>
            <div style={styles.tableCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div
                      onClick={() => setActiveTab('translated')}
                      style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: activeTab === 'translated' ? '3px solid #c92b2b' : '3px solid transparent', fontWeight: 700 }}
                    >Translated</div>
                    <div
                      onClick={() => setActiveTab('pushed')}
                      style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: activeTab === 'pushed' ? '3px solid #c92b2b' : '3px solid transparent', fontWeight: 700 }}
                    >Pushed</div>
                  </div>

                <div style={{ ...styles.controls, marginLeft: 'auto' }}>
                  <button
                    onClick={publishSelected}
                    disabled={selectedIds.length === 0}
                    style={{ marginRight: 8, background: selectedIds.length === 0 ? '#f3f3f3' : '#1e73d1', color: selectedIds.length === 0 ? '#999' : 'white', padding: '8px 12px', borderRadius: 8, border: 'none', cursor: selectedIds.length === 0 ? 'default' : 'pointer', fontWeight: 700 }}
                  >Push To Publish Queue</button>
                  <input placeholder="🔍 Search" value={query} onChange={e => setQuery(e.target.value)} style={styles.input} />
                  {activeTab === 'translated' && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8, color: '#666', fontSize: 13 }}>
                      <input type="checkbox" checked={includePushed} onChange={e => setIncludePushed(e.target.checked)} />
                      <span>Include pushed</span>
                    </label>
                  )}
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #e8e8e8', background: 'transparent' }}>
                    <th style={{ padding: '12px 8px', width: '4%', fontSize: 12 }}>
                      <input type="checkbox" checked={isAllSelected()} onChange={toggleSelectAll} />
                    </th>
                    <th style={{ padding: '12px 8px', width: '15%', fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Source</th>
                    <th style={{ padding: '12px 8px', width: '35%', fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Article Title</th>
                    <th style={{ padding: '12px 8px', width: '15%', fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date Published</th>
                    <th style={{ padding: '12px 8px', width: '15%', fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                    <th style={{ padding: '12px 8px', width: '20%', fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actions</th>
                  </tr>
                </thead>
                  <tbody>
                    {pageItems.map((a, i) => {
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
                                      try { await loadPage(currentPage) } catch (e) { /* ignore */ }
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
                  onClick={() => setPages(prev => ({ ...prev, [activeTab]: Math.max(1, (prev[activeTab] || 1) - 1) }))}
                  disabled={currentPage <= 1}
                  style={{ background: 'transparent', border: 'none', padding: '8px 10px', cursor: currentPage <= 1 ? 'default' : 'pointer', color: currentPage <= 1 ? '#ccc' : '#999', fontSize: 18 }}
                >◀</button>

                {(() => {
                  const windowSize = 1
                  const pageSet = new Set()
                  pageSet.add(1)
                  pageSet.add(totalPages)
                  for (let p = currentPage - windowSize; p <= currentPage + windowSize; p += 1) {
                    if (p >= 1 && p <= totalPages) pageSet.add(p)
                  }
                  const sortedPages = Array.from(pageSet).sort((a, b) => a - b)

                  const buttons = []
                  sortedPages.forEach((p, idx) => {
                    const prev = sortedPages[idx - 1]
                    if (idx > 0 && p - prev > 1) {
                      buttons.push(<span key={`gap-${p}`} style={{ padding: '0 4px', color: '#999' }}>…</span>)
                    }
                    const isActive = p === currentPage
                    buttons.push(
                      <button
                        key={p}
                        onClick={() => setPages(prev => ({ ...prev, [activeTab]: p }))}
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
                  onClick={() => setPages(prev => ({ ...prev, [activeTab]: Math.min(totalPages, (prev[activeTab] || 1) + 1) }))}
                  disabled={currentPage >= totalPages}
                  style={{ background: 'transparent', border: 'none', padding: '8px 10px', cursor: currentPage >= totalPages ? 'default' : 'pointer', color: currentPage >= totalPages ? '#ccc' : '#999', fontSize: 18 }}
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
                    setPages(prev => ({ ...prev, [activeTab]: num }))
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