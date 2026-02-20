import React, { useState, useEffect, useMemo } from 'react'
import { getRoleFromToken } from '../../utils/auth'

const API_BASE = import.meta.env.VITE_API_BASE || ''

/* ─── Safe date parser (handles high-precision fractional seconds) ───── */
const safeParseDate = (str) => {
  if (!str) return null
  // JS Date only handles up to 3 fractional‑second digits; trim extras
  const trimmed = String(str).replace(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3})\d+/, '$1')
  const d = new Date(trimmed)
  return isNaN(d.getTime()) ? null : d
}

/* ─── API Helper ──────────────────────────────────────────────────────── */
const apiFetch = async (path, opts = {}) => {
  const token = localStorage.getItem('token')
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {})
  if (token) headers['Authorization'] = `Bearer ${token}`
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  
  let res
  try {
    res = await fetch(url, Object.assign({ headers }, opts))
  } catch (err) {
    throw new Error('Network error: ' + (err && err.message ? err.message : String(err)))
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    const msg = txt || res.statusText || `HTTP ${res.status}`
    throw new Error(msg)
  }
  const text = await res.text().catch(() => '')
  try { return text ? JSON.parse(text) : null } catch { return text }
}

/* ─── SVG Icons (replacing lucide-react) ─────────────────────────────── */
const IconDownload = ({ size = 16, style: s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)
const IconRefresh = ({ size = 16, spin, style: s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ ...(s || {}), ...(spin ? { animation: 'fa-spin 1s linear infinite' } : {}) }}>
    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
)
const IconSettings = ({ size = 16, style: s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
    <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)
const IconCheckCircle = ({ size = 12, style: s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
  </svg>
)
const IconArrowRight = ({ size = 16, style: s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
)
const IconExternalLink = ({ size = 20, style: s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
  </svg>
)
const IconTrash = ({ size = 16, style: s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
)

/* ─── Custom Toggle Switch ───────────────────────────────────────────── */
const ToggleSwitch = ({ checked, onChange }) => (
  <button
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    style={{
      width: 36, height: 20, borderRadius: 10, padding: 2,
      border: 'none', cursor: 'pointer',
      background: checked ? '#BA0006' : '#d1d5db',
      transition: 'background 0.2s',
      display: 'flex', alignItems: 'center', position: 'relative'
    }}
  >
    <div style={{
      width: 16, height: 16, borderRadius: '50%', background: 'white',
      transition: 'transform 0.2s',
      transform: checked ? 'translateX(16px)' : 'translateX(0)',
      boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
    }} />
  </button>
)

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */
export default function FetchArticles() {
  const role = getRoleFromToken(localStorage.getItem('token'))
  if (role !== 'consultant') {
    return <div style={{ padding: 24 }}><div style={{ fontWeight: 600 }}>You do not have permission to view this page.</div></div>
  }

  /* ─── State ──────────────────────────────────────────────────────── */
  const [settings, setSettings] = useState({
    sources: ['1'],
    maxArticles: 5,
    summaryFormat: 'paragraph',
    summaryLength: 'medium',
  })

  const [isFetching, setIsFetching] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [selectedArticles, setSelectedArticles] = useState([])
  const [articleLanguageToggles, setArticleLanguageToggles] = useState({})
  const [fetchAttempts, setFetchAttempts] = useState([])
  const [expandedAttempts, setExpandedAttempts] = useState({})
  const [visibleAttemptArticles, setVisibleAttemptArticles] = useState({})
  const [toast, setToast] = useState(null)
  // `persistToServer` and `debugMode` toggles removed: persistence and debug are handled server-side
  const [isAutoFetchEnabled, setIsAutoFetchEnabled] = useState(false)
  const [isAutoFetchLoading, setIsAutoFetchLoading] = useState(false)
  const [autoFetchIntervalMinutes, setAutoFetchIntervalMinutes] = useState(null)
  const [isAutoFetchVisible, setIsAutoFetchVisible] = useState(true)
  // Debug panel disabled — always null so the JSX block is skipped
  const lastFetchDebug = null
  const setLastFetchDebug = () => {}
  const [isAttemptsLoading, setIsAttemptsLoading] = useState(false)
  const [attemptsError, setAttemptsError] = useState(null)
  const [fetchStartTime, setFetchStartTime] = useState(null)
  const [elapsedTime, setElapsedTime] = useState(0)

  // Articles are derived from attempts — single source of truth
  const fetchedArticles = useMemo(
    () => fetchAttempts.flatMap(a => a.articles || []),
    [fetchAttempts]
  )

  // Update elapsed time while fetching
  useEffect(() => {
    if (!isFetching || !fetchStartTime) return
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - fetchStartTime) / 1000))
    }, 100)
    return () => clearInterval(interval)
  }, [isFetching, fetchStartTime])

  // Restore fetch attempts: load local cache FIRST (so the merge can preserve articles),
  // then sync with the server. Uses a ref to prevent StrictMode double-fire.
  const didInit = React.useRef(false)
  useEffect(() => {
    if (didInit.current) return
    didInit.current = true

    // Step 1: restore from localStorage immediately
    try {
      const raw = localStorage.getItem('fetchArticlesState')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed.fetchAttempts) && parsed.fetchAttempts.length > 0) {
          const attempts = [...parsed.fetchAttempts]
            .sort((a, b) => (safeParseDate(a.timestamp || a.fetchedAt)?.getTime() ?? 0) - (safeParseDate(b.timestamp || b.fetchedAt)?.getTime() ?? 0))
            .map((a, idx) => ({ ...a, sequence: a.sequence ?? (idx + 1) }))
          setFetchAttempts(attempts)
        }
      }
    } catch (e) {
      console.warn('Failed to load cached fetch attempts:', e)
    }

    // Step 2: merge with server + load auto-fetch state (one combined init)
    const init = async () => {
      // Sync fetch attempts
      try { await loadFetchAttempts({ silent: true }) } catch (_) {}

      // Load auto-fetch toggle state
      if (role === 'consultant') {
        try {
          const res = await apiFetch('/api/autofetch')
          setIsAutoFetchEnabled(res.enabled ?? false)
          if (res.intervalSeconds) setAutoFetchIntervalMinutes(Math.round(res.intervalSeconds / 60))
          setIsAutoFetchVisible(true)
        } catch (err) {
          if (err.message && err.message.includes('403')) {
            setIsAutoFetchVisible(false)
          }
        }
      }
    }
    init()
  }, [])

  // Persist attempts locally so they survive refresh (articles are embedded in attempts)
  useEffect(() => {
    try {
      localStorage.setItem('fetchArticlesState', JSON.stringify({ fetchAttempts }))
    } catch (e) {
      console.warn('Failed to persist fetch state:', e)
    }
  }, [fetchAttempts])

  /* ─── Component mount: nothing extra needed (init handled above) ──── */

  /* ─── Toast helper ───────────────────────────────────────────────── */
  const showToast = (msg, type = 'success') => {
    setToast({ message: msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  /* ─── Available Sources ──────────────────────────────────────────── */
  const availableSources = [
    { id: '1', name: 'Xinhua News Agency', language: 'both' },
    { id: '2', name: 'China Daily', language: 'english' },
  ]

  /* ─── Summary text helper ────────────────────────────────────────── */
  const getSummaryText = (article, language) => {
    // Real API returns summaryEn and summaryZh
    if (language === 'chinese' || language === 'zh') {
      return article.summaryZh || article.snippet || 'No summary available'
    }
    return article.summaryEn || article.snippet || 'No summary available'
  }

  const formatSummaryFormatLabel = (format) => {
    if (!format) return ''
    const f = String(format).toLowerCase()
    if (f === 'bullet' || f === 'bullets') return 'Bullet Points'
    if (f === 'paragraph') return 'Paragraph'
    return f.charAt(0).toUpperCase() + f.slice(1)
  }

  const formatSummaryLengthLabel = (len) => {
    if (!len) return ''
    const l = String(len).toLowerCase()
    if (l === 'short') return 'Short'
    if (l === 'medium') return 'Medium'
    if (l === 'long') return 'Long'
    return l.charAt(0).toUpperCase() + l.slice(1)
  }

  /* ─── Article extraction and normalization helpers ───────────────── */
  const extractArticlesFromResponse = (res) => {
    if (!res) return []
    
    // NEW BACKEND FORMAT: { fetchAttemptId, fetchedAt, results: [{sourceId, name, articles: [...]}] }
    if (typeof res === 'object' && !Array.isArray(res) && Array.isArray(res.results)) {
      const flattened = []
      for (const result of res.results) {
        if (result && Array.isArray(result.articles) && result.articles.length) {
          // Attach the source metadata from the top-level result into each article
          const sourceId = result.sourceId ?? result.SourceId ?? null
          const sourceName = result.name ?? result.Name ?? null
          const match = availableSources.find(s => String(s.id) === String(sourceId))
          const preferredName = match ? match.name : sourceName
          for (const art of result.articles) {
            if (art && typeof art === 'object') {
              // don't overwrite if article already has these fields
              if (art.sourceId == null && art.SourceId == null) art.sourceId = sourceId
              if (!art.sourceName && !art.SourceName && preferredName) art.sourceName = preferredName
              flattened.push(art)
            }
          }
        }
      }
      if (flattened.length) return flattened
      // If no articles found in results, return empty (backend found 0 articles)
      return []
    }
    
    if (Array.isArray(res)) {
      if (res.length > 0) {
        const sample = res[0]
        const looksLikeArticle = Boolean(
          sample.Title || sample.title || sample.headline || sample.Url || sample.ArticleId ||
          sample.TitleZH || sample.titleZH || sample.TitleEN || sample.NewsArticleId || sample.id ||
          sample.Summary || sample.summary || sample.SummaryEN || sample.SummaryZH || sample.Snippet
        )
        if (looksLikeArticle) return res
      }
      const flattened = []
      for (const item of res) {
        if (item && Array.isArray(item.Articles) && item.Articles.length) flattened.push(...item.Articles)
        else if (item && Array.isArray(item.articles) && item.articles.length) flattened.push(...item.articles)
        else if (item && Array.isArray(item.Items) && item.Items.length) flattened.push(...item.Items)
        else if (item && Array.isArray(item.items) && item.items.length) flattened.push(...item.items)
        else if (item && Array.isArray(item.results) && item.results.length) flattened.push(...item.results)
      }
      if (flattened.length) return flattened
      return []
    }
    if (typeof res === 'object') {
      if (Array.isArray(res.Articles) && res.Articles.length) return res.Articles
      if (Array.isArray(res.articles) && res.articles.length) return res.articles
      if (Array.isArray(res.items) && res.items.length) return res.items
      if (Array.isArray(res.Items) && res.Items.length) return res.Items
      if (Array.isArray(res.Data) && res.Data.length) return res.Data
    }
    return []
  }

  const normalizeArticle = (a, attemptId, index) => {
    // Backend article fields: fetchAttemptArticleId, newsArticleId, titleZH, titleEN,
    // sourceURL, summaryEN, summaryZH, fullContentEN, fullContentZH, status
    const fetchAttemptArticleId = a.fetchAttemptArticleId ?? a.FetchAttemptArticleId ?? null
    const newsArticleId = a.newsArticleId ?? a.NewsArticleId ?? a.id ?? a.Id ?? a.ArticleId ?? a.articleId
    const baseId = newsArticleId ?? `${attemptId}-${index}`

    const sourceId = a.sourceId ?? a.SourceId ?? a.Source?.SourceId ?? a.source?.id ?? null
    let sourceName = a.sourceName ?? a.SourceName ?? (a.Source && (a.Source.Name || a.Source.name)) ?? undefined
    if (!sourceName && sourceId != null) {
      const match = availableSources.find(s => String(s.id) === String(sourceId))
      if (match) sourceName = match.name
    }

    const titleEn = a.titleEN ?? a.TitleEN ?? a.titleEn ?? a.Title ?? a.title ?? a.headline ?? null
    const titleZh = a.titleZH ?? a.TitleZH ?? a.titleZh ?? null
    const summaryEn = a.summaryEN ?? a.SummaryEN ?? a.summaryEn ?? null
    const summaryZh = a.summaryZH ?? a.SummaryZH ?? a.summaryZh ?? null
    const fullContentEn = a.fullContentEN ?? a.FullContentEN ?? null
    const fullContentZh = a.fullContentZH ?? a.FullContentZH ?? null
    const sourceURL = a.sourceURL ?? a.SourceURL ?? a.sourceUrl ?? a.SourceUrl ?? a.url ?? a.Url ?? null

    // Map backend status: "Draft", "ReadyForPublish", "Published"
    const rawStatus = a.status ?? a.Status ?? 'Draft'
    let status = 'fetched'
    if (rawStatus === 'ReadyForPublish' || rawStatus === 'ready-to-publish') status = 'ready-to-publish'
    else if (rawStatus === 'Published') status = 'published'
    else if (rawStatus === 'Draft') status = 'fetched'

    return {
      id: baseId,
      fetchAttemptArticleId,
      newsArticleId: newsArticleId ?? null,
      title: titleEn || titleZh || 'Untitled Article',
      titleZh: titleZh || null,
      titleEn: titleEn || null,
      summaryEn,
      summaryZh,
      fullContentEn,
      fullContentZh,
      snippet: a.snippet ?? a.Snippet ?? a.summary ?? a.Summary ?? '',
      url: sourceURL,
      sourceId,
      sourceName,
      fetchedAt: a.fetchedAt ?? a.FetchedAt ?? a.publishedAt ?? a.PublishedAt ?? null,
      status,
      attemptId,
      isTemporary: newsArticleId == null,
      raw: a,
    }
  }

  const getSourceLabel = (article, attemptSources = []) => {
    if (article.sourceName) return article.sourceName
    if (article.source) return article.source
    if (article.sourceId != null) {
      const match = availableSources.find(s => String(s.id) === String(article.sourceId))
      if (match) return match.name
      return `Source ${article.sourceId}`
    }
    if (attemptSources.length > 0) return attemptSources.join(', ')
    return 'Source unknown'
  }

  const getArticleIssues = (article) => {
    const issues = []
    if (!article.title) issues.push('Missing title')
    if (!(article.summaryEn || article.summaryZh || article.snippet)) issues.push('Missing summary')
    if (!(article.sourceName || article.source || article.sourceId)) issues.push('Unknown source')
    return issues
  }

  const renderSummaryContent = (article, language, format) => {
    const text = getSummaryText(article, language)
    if (format === 'bullet' || format === 'bullets') {
      const lines = String(text).split(/\n+/).map(s => s.trim()).filter(Boolean)
      const items = lines.length > 1
        ? lines
        : String(text).split(/[.!?]\s+/).map(s => s.trim()).filter(Boolean)

      return (
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
          {items.map((item, idx) => (
            <li key={`${article.id}-bullet-${idx}`} style={{ marginBottom: 6 }}>{item}</li>
          ))}
        </ul>
      )
    }

    return (
      <p style={{ fontSize: 14, color: '#333', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
        {text}
      </p>
    )
  }

  const normalizeAttemptSettings = (raw) => {
    const src = raw || {}
    // Parse sourceIdsSnapshot (comma-separated string from backend) into an array
    let sources = src.sources ?? src.SourceIds ?? src.Sources ?? src.sourceIds ?? null
    const snapshotStr = src.sourceIdsSnapshot ?? src.SourceIdsSnapshot ?? null
    if (!Array.isArray(sources) && typeof snapshotStr === 'string') {
      sources = snapshotStr.split(',').map(s => s.trim()).filter(Boolean)
    }
    if (!Array.isArray(sources)) sources = []
    return {
      sources,
      maxArticles: src.maxArticles ?? src.maxArticlesPerFetch ?? src.MaxArticlesPerFetch ?? src.MaxArticles ?? undefined,
      summaryFormat: src.summaryFormat ?? src.SummaryFormat ?? undefined,
      summaryLength: src.summaryLength ?? src.SummaryLength ?? undefined,
    }
  }

  const loadFetchAttempts = async ({ silent = false, limit = 50 } = {}) => {
    if (!silent) setIsAttemptsLoading(true)
    setAttemptsError(null)

    try {
      const res = await apiFetch(`/api/articles/fetchAttempts?limit=${limit}`)
      const attemptsRaw = Array.isArray(res) ? res : []

      const attempts = attemptsRaw.map((attempt) => {
        const attemptId = String(attempt.fetchAttemptId ?? attempt.id ?? Date.now())
        const attemptNumber = attempt.attemptNumber ?? 1

        // Parse configuration snapshot from backend — may be nested or at top level
        let configSnapshot = attempt.configuration ?? attempt.settingsUsed ?? attempt.settings ?? null
        if (!configSnapshot || (typeof configSnapshot === 'object' && Object.keys(configSnapshot).length === 0)) {
          // Fallback: config fields may be at top level of the attempt object
          configSnapshot = {
            maxArticlesPerFetch: attempt.maxArticlesPerFetch ?? attempt.MaxArticlesPerFetch,
            sourceIdsSnapshot: attempt.sourceIdsSnapshot ?? attempt.SourceIdsSnapshot,
            summaryFormat: attempt.summaryFormat ?? attempt.SummaryFormat,
            summaryLength: attempt.summaryLength ?? attempt.SummaryLength,
          }
        }
        const settingsUsed = normalizeAttemptSettings(configSnapshot)

        // Normalize articles from backend
        const rawArticles = Array.isArray(attempt.articles) ? attempt.articles : []
        const normalized = rawArticles.map((a, idx) => normalizeArticle(a, attemptId, idx))

        return {
          id: attemptId,
          sequence: attemptNumber,
          timestamp: attempt.fetchedAt ?? attempt.timestamp ?? null,
          settingsUsed,
          articles: normalized,
          articleCount: normalized.length,
        }
      })

      // Server data is the single source of truth — replace local state entirely
      setFetchAttempts(attempts)

      return attempts
    } catch (e) {
      if (!silent) setAttemptsError(e.message || String(e))
      return null
    } finally {
      if (!silent) setIsAttemptsLoading(false)
    }
  }

  /* ─── Auto-fetch toggle handler ──────────────────────────────────── */
  const handleAutoFetchToggle = async () => {
    if (isAutoFetchLoading) return
    
    // Optimistic UI update
    const previousState = isAutoFetchEnabled
    setIsAutoFetchEnabled(!previousState)
    setIsAutoFetchLoading(true)

    try {
      const endpoint = !previousState ? '/api/autofetch/enable' : '/api/autofetch/disable'
      const res = await apiFetch(endpoint, { method: 'POST' })
      
      console.log(`✅ Auto-fetch ${!previousState ? 'enabled' : 'disabled'}:`, res)
      
      // Update interval if returned
      if (res.intervalSeconds) {
        setAutoFetchIntervalMinutes(Math.round(res.intervalSeconds / 60))
      }
      showToast(`Auto-fetch ${!previousState ? 'enabled' : 'disabled'} successfully`)
    } catch (err) {
      console.error('❌ Auto-fetch toggle failed:', err)
      // Revert optimistic update
      setIsAutoFetchEnabled(previousState)
      
      if (err.message && err.message.includes('403')) {
        showToast('You do not have permission to change auto-fetch settings', 'error')
        setIsAutoFetchVisible(false)
      } else {
        showToast(`Failed to ${!previousState ? 'enable' : 'disable'} auto-fetch: ${err.message}`, 'error')
      }
    } finally {
      setIsAutoFetchLoading(false)
    }
  }

  /* ─── Fetch handler ──────────────────────────────────────────────── */
  const handleFetchArticles = async () => {
    if (isFetching) return
    setIsFetching(true)
    setFetchStartTime(Date.now())
    setElapsedTime(0)
    showToast('Fetching articles from sources...', 'info')

    try {
      const sourceIds = settings.sources.map(s => parseInt(s, 10)).filter(n => !isNaN(n))
      if (sourceIds.length === 0) {
        showToast('Please select at least one source', 'error')
        setIsFetching(false)
        return
      }

      const maxRequested = Math.max(1, Math.min(10, Number(settings.maxArticles) || 5))

      // Match backend API contract exactly
      const body = {
        sourceIds,
        maxArticles: maxRequested,
        summaryFormat: settings.summaryFormat,
        summaryLength: settings.summaryLength,
      }

      const res = await apiFetch('/api/articles/fetchArticles', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const totalAdded = res?.totalAdded ?? 0

      // Refresh fetch attempts from server to get canonical data
      // (including attemptNumber, configuration snapshot, normalized articles)
      const updatedAttempts = await loadFetchAttempts({ silent: true })

      // After a new fetch, show only the latest attempt's articles
      if (Array.isArray(updatedAttempts) && updatedAttempts.length > 0) {
        const latestAttempt = updatedAttempts[updatedAttempts.length - 1]
        setVisibleAttemptArticles({ [latestAttempt.id]: true })
      }

      // Show appropriate toast message
      if (totalAdded > 0) {
        showToast(`${totalAdded} new article(s) fetched successfully!`)
      } else {
        showToast('Fetch completed \u2014 all articles were duplicates or no new content found.', 'info')
      }

    } catch (e) {
      console.error('Fetch failed:', e)
      showToast(`Fetch failed: ${e.message || String(e)}`, 'error')
    } finally {
      setIsFetching(false)
      setFetchStartTime(null)
      setElapsedTime(0)
    }
  }

  /* ─── Toggles ────────────────────────────────────────────────────── */
  const toggleSource = (sourceId) => {
    if (settings.sources.includes(sourceId)) {
      setSettings({ ...settings, sources: settings.sources.filter((id) => id !== sourceId) })
    } else {
      setSettings({ ...settings, sources: [...settings.sources, sourceId] })
    }
  }

  const getArticleKey = (article) => `${article.attemptId || 'unknown'}:${article.id}`

  const toggleArticleSelection = (articleKey) => {
    if (selectedArticles.includes(articleKey)) {
      setSelectedArticles(selectedArticles.filter(id => id !== articleKey))
    } else {
      setSelectedArticles([...selectedArticles, articleKey])
    }
  }

  /* ─── Language helpers ───────────────────────────────────────────── */
  const getDefaultLanguage = (articleKey) => {
    // Honor explicit per-article toggle when present
    if (articleLanguageToggles[articleKey]) return articleLanguageToggles[articleKey]
    // Default to English; user can toggle per-article to Chinese
    return 'english'
  }

  const firstNonEmpty = (...vals) => {
    for (const v of vals) {
      if (v == null) continue
      try {
        const s = String(v).trim()
        if (s.length > 0) return s
      } catch (e) { continue }
    }
    return null
  }

  /* ─── Publish Queue helpers ──────────────────────────────────────── */
  const isArticleInPublishQueue = (articleId) => {
    try {
      const rawQ = JSON.parse(localStorage.getItem('publishQueue') || '[]')
      const entries = Array.isArray(rawQ) ? rawQ : []
      return entries.some(e => {
        try {
          const eid = Number(e?.id ?? e?.data?.article?.id ?? e?.data?.article?.NewsArticleId)
          return !Number.isNaN(eid) && eid === Number(articleId)
        } catch { return false }
      })
    } catch { return false }
  }

  const removeFromPublishQueue = (articleId) => {
    try {
      const rawQ = JSON.parse(localStorage.getItem('publishQueue') || '[]')
      const entries = Array.isArray(rawQ) ? rawQ : []
      const filtered = entries.filter(e => {
        try {
          const eid = Number(e?.id ?? e?.data?.article?.id ?? e?.data?.article?.NewsArticleId)
          return Number.isNaN(eid) || eid !== Number(articleId)
        } catch { return true }
      })
      localStorage.setItem('publishQueue', JSON.stringify(filtered))
    } catch (err) {
      console.warn('Failed to remove from publishQueue:', err)
    }
  }

  /* ─── Publish handler ────────────────────────────────────────────── */
  const handlePushToPublish = async () => {
    const selectedKeys = new Set(selectedArticles)

    // Collect newsArticleIds and article data from selected articles
    const articleIds = []
    const articlesToAdd = []
    for (const attempt of fetchAttempts) {
      for (const art of (attempt.articles || [])) {
        if (!selectedKeys.has(getArticleKey(art))) continue
        const nid = art.newsArticleId ?? art.id
        if (nid != null && !isNaN(Number(nid))) articleIds.push(Number(nid))
        articlesToAdd.push(art)
      }
    }

    if (articleIds.length === 0) {
      showToast('No valid articles selected', 'error')
      return
    }

    try {
      // Call backend to mark articles as ReadyForPublish
      await apiFetch('/api/articles/markReadyForPublish', {
        method: 'POST',
        body: JSON.stringify({ articleIds }),
      })

      // Also persist to localStorage for PublishQueue.jsx backward compatibility
      try {
        const rawQ = JSON.parse(localStorage.getItem('publishQueue') || '[]')
        const entries = Array.isArray(rawQ) ? rawQ : []
        const updated = [...entries]

        for (const art of articlesToAdd) {
          const nid = Number(art.newsArticleId ?? art.id)
          const articleObj = {
            id: !Number.isNaN(nid) ? nid : art.id,
            NewsArticleId: !Number.isNaN(nid) ? nid : undefined,
            TitleEN: art.titleEn || art.title || null,
            TitleZH: art.titleZh || null,
            Url: art.url || null,
            SourceName: art.sourceName || null,
            SummaryEN: art.summaryEn || null,
            SummaryZH: art.summaryZh || null,
          }
          const exists = updated.some(e => {
            try {
              const eid = Number(e?.id ?? e?.data?.article?.id)
              return !Number.isNaN(eid) && eid === nid
            } catch { return false }
          })
          if (!exists) updated.push({ id: articleObj.id, data: { article: articleObj } })
        }

        localStorage.setItem('publishQueue', JSON.stringify(updated))
      } catch (e) {
        console.warn('[FetchArticles] Failed to persist to publishQueue', e)
      }

      // Refresh attempts from server to get updated status
      await loadFetchAttempts({ silent: true })

      showToast(`${articleIds.length} article(s) marked as Ready for Publish`)
      setSelectedArticles([])
    } catch (e) {
      showToast(`Failed to mark articles: ${e.message || String(e)}`, 'error')
    }
  }

  const handleDeleteAttempt = async (attempt) => {
    if (!attempt || !attempt.id) return

    // Check if any articles in this attempt are in the publish queue
    const articlesInQueue = (attempt.articles || []).filter(art => {
      const nid = art.newsArticleId ?? art.id
      return nid != null && isArticleInPublishQueue(nid)
    })

    if (articlesInQueue.length > 0) {
      window.alert(
        `Cannot delete Fetch Attempt #${attempt.sequence || ''}.\n\n` +
        `${articlesInQueue.length} article(s) from this attempt have been pushed to the Publish Queue. ` +
        `Please delete those articles individually first, then you can delete the entire fetch attempt.`
      )
      return
    }

    if (!window.confirm(`Delete Fetch Attempt #${attempt.sequence || ''}? This will remove its articles.`)) {
      return
    }

    try {
      // Backend cascade-deletes the attempt AND all its articles,
      // then renumbers remaining attempts starting from #1
      await apiFetch(`/api/articles/fetchAttempts/${attempt.id}`, { method: 'DELETE' })

      // Reload attempts from server to get renumbered sequences
      await loadFetchAttempts({ silent: true })

      showToast('Fetch attempt and its articles deleted successfully')
    } catch (e) {
      showToast((e && e.message) ? e.message : 'Failed to delete attempt', 'error')
    }
  }

  const handleDeleteAllAttempts = async () => {
    // Check if any articles across all attempts are in the publish queue
    const attemptsWithQueueArticles = fetchAttempts.filter(attempt =>
      (attempt.articles || []).some(art => {
        const nid = art.newsArticleId ?? art.id
        return nid != null && isArticleInPublishQueue(nid)
      })
    )

    if (attemptsWithQueueArticles.length > 0) {
      window.alert(
        `Cannot delete all fetch attempts.\n\n` +
        `${attemptsWithQueueArticles.length} attempt(s) contain articles that have been pushed to the Publish Queue. ` +
        `Please delete those articles individually first, then you can delete the fetch attempts.`
      )
      return
    }

    if (!window.confirm('Delete ALL fetch attempts? This will remove all fetched articles.')) {
      return
    }

    try {
      // Delete each attempt individually (backend cascade-deletes articles)
      for (const attempt of [...fetchAttempts]) {
        try {
          await apiFetch(`/api/articles/fetchAttempts/${attempt.id}`, { method: 'DELETE' })
        } catch (err) {
          console.warn(`Failed to delete attempt ${attempt.id}:`, err)
        }
      }
      await loadFetchAttempts({ silent: true })
      setSelectedArticles([])
      showToast('All fetch attempts deleted')
    } catch (e) {
      showToast(e.message || 'Failed to delete all attempts', 'error')
    }
  }

  /* ─── Delete handler ─────────────────────────────────────────────── */
  const handleDeleteArticle = async (article) => {
    const articleId = article.newsArticleId ?? article.id
    const attemptId = article.attemptId
    if (!articleId || !attemptId) {
      showToast('Cannot delete article without ID', 'error')
      return
    }

    const inPublishQueue = isArticleInPublishQueue(articleId)

    if (inPublishQueue) {
      if (!window.confirm(
        `Delete article "${(article.title || '').substring(0, 50)}..."?\n\n` +
        `This article has been pushed to the Publish Queue. ` +
        `It will be removed from both Fetch Articles and the Publish Queue.`
      )) {
        return
      }
    } else {
      if (!window.confirm(`Delete article "${(article.title || '').substring(0, 50)}..."?`)) {
        return
      }
    }

    try {
      // Use the new endpoint: DELETE /api/articles/fetchAttempts/{attemptId}/articles/{articleId}
      await apiFetch(`/api/articles/fetchAttempts/${attemptId}/articles/${articleId}`, { method: 'DELETE' })

      // Also remove from publish queue if present
      if (inPublishQueue) {
        removeFromPublishQueue(articleId)
      }

      // Update local state
      setFetchAttempts(prev => prev.map(attempt => {
        if (String(attempt.id) !== String(attemptId)) return attempt
        const filtered = (attempt.articles || []).filter(a => String(a.newsArticleId ?? a.id) !== String(articleId))
        return { ...attempt, articles: filtered, articleCount: filtered.length }
      }))
      showToast(inPublishQueue
        ? 'Article deleted from Fetch Articles and Publish Queue'
        : 'Article deleted successfully')
    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e || 'Failed to delete article')
      showToast(msg, 'error')
    }
  }

  /* ─── Save Settings ──────────────────────────────────────────────── */
  const handleSaveSettings = () => {
    setIsSettingsOpen(false)
    showToast('Fetch settings saved successfully')
  }

  /* ═══════════════════════════════════════════════════════════════════
     STYLES
     ═══════════════════════════════════════════════════════════════════ */
  const cardStyle = {
    background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden'
  }
  const cardHeaderStyle = { padding: '20px 24px 0' }
  const cardContentStyle = { padding: '16px 24px 24px' }
  const badgeOutlineStyle = (bg, border, color) => ({
    display: 'inline-flex', alignItems: 'center',
    padding: '2px 8px', borderRadius: 9999, fontSize: 12, fontWeight: 500,
    background: bg || 'transparent', border: `1px solid ${border || '#e5e7eb'}`, color: color || '#333'
  })
  const badgeFilledStyle = (bg, color) => ({
    display: 'inline-flex', alignItems: 'center',
    padding: '2px 8px', borderRadius: 9999, fontSize: 12, fontWeight: 500,
    background: bg || '#f3f4f6', color: color || '#333', border: 'none'
  })
  const btnBaseStyle = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 6, fontWeight: 600, fontSize: 14, cursor: 'pointer',
    transition: 'all 0.15s', border: 'none', padding: '8px 16px'
  }
  const btnPrimary = { ...btnBaseStyle, background: '#BA0006', color: 'white' }
  const btnOutline = { ...btnBaseStyle, background: 'white', color: '#887B76', border: '1px solid #e5e7eb' }
  const inputStyle = {
    padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(136,123,118,0.2)',
    fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box',
    color: '#333', fontWeight: 500
  }
  const labelStyle = { fontSize: 14, color: '#887B76', fontWeight: 600, marginBottom: 4, display: 'block' }
  const sectionBg = { background: 'rgba(249,250,251,0.5)', borderRadius: 6, padding: 12 }
  const radioStyle = { accentColor: '#BA0006', marginRight: 6 }
  const checkboxStyle = { accentColor: '#BA0006', marginRight: 6 }
  const modalOverlay = {
    position: 'fixed', left: 0, top: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', zIndex: 9999
  }

  /* ═══════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ padding: '32px', minHeight: '100vh', background: '#fbf8f6', boxSizing: 'border-box' }}>
      {/* Key‌frame for spinning icon */}
      <style>{`@keyframes fa-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#887B76' }}>Fetch Articles</h1>
          <p style={{ margin: '4px 0 0', fontSize: 15, color: 'rgb(136,123,118)' }}>
            Fetch and manage articles from configured sources
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* Fetch Settings Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            style={{ ...btnOutline }}
          >
            <IconSettings size={16} style={{ marginRight: 8 }} />
            Fetch Settings
          </button>

          {/* Auto-fetch Toggle Button */}
          {isAutoFetchVisible && (
            <button
              onClick={handleAutoFetchToggle}
              disabled={isAutoFetchLoading || !isAutoFetchVisible}
              style={{
                ...btnOutline,
                borderColor: isAutoFetchEnabled ? '#BA0006' : '#e5e7eb',
                color: isAutoFetchEnabled ? '#BA0006' : '#887B76',
                background: isAutoFetchEnabled ? 'rgba(186,0,6,0.05)' : 'white',
                opacity: isAutoFetchLoading ? 0.6 : 1,
                cursor: isAutoFetchLoading ? 'not-allowed' : 'pointer'
              }}
              title={autoFetchIntervalMinutes ? `Auto-fetch every ${autoFetchIntervalMinutes} minutes` : undefined}
            >
              {isAutoFetchLoading ? (
                <><IconRefresh size={16} spin style={{ marginRight: 8 }} />Updating...</>
              ) : isAutoFetchEnabled ? (
                <>
                  <span>⏸️ Auto-fetch: ON</span>
                  {autoFetchIntervalMinutes && (
                    <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>({autoFetchIntervalMinutes}m)</span>
                  )}
                </>
              ) : (
                <>▶️ Auto-fetch: OFF</>
              )}
            </button>
          )}

          {/* Fetch Articles Button */}
          <button
            onClick={handleFetchArticles}
            disabled={isFetching || settings.sources.length === 0}
            style={{
              ...btnPrimary,
              opacity: (isFetching || settings.sources.length === 0) ? 0.6 : 1,
              cursor: (isFetching || settings.sources.length === 0) ? 'not-allowed' : 'pointer'
            }}
          >
            {isFetching
              ? <><IconRefresh size={16} spin style={{ marginRight: 8 }} />Fetching...</>
              : <><IconDownload size={16} style={{ marginRight: 8 }} />Fetch Articles</>}
          </button>
        </div>
      </div>

      {/* ── Current Fetch Configuration ─────────────────────────────── */}
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <div style={cardHeaderStyle}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#BA0006' }}>Current Fetch Configuration</div>
          <p style={{ fontSize: 12, color: 'rgba(136,123,118,0.7)', margin: '2px 0 0' }}>Active settings for article fetching</p>
        </div>
        <div style={cardContentStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {/* Sources */}
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#333', marginBottom: 4 }}>Sources</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {settings.sources.map((sourceId) => {
                  const source = availableSources.find(s => s.id === sourceId)
                  return source ? (
                    <span key={sourceId} style={badgeOutlineStyle('rgba(186,0,6,0.05)', 'rgba(186,0,6,0.2)', '#BA0006')}>
                      {source.name}
                    </span>
                  ) : null
                })}
              </div>
            </div>
            {/* Max Articles */}
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#333', marginBottom: 4 }}>Max Articles</div>
              <p style={{ fontSize: 12, color: '#887B76', fontWeight: 500, margin: 0 }}>{settings.maxArticles} articles</p>
            </div>
            {/* Summary */}
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#333', marginBottom: 4 }}>Summary</div>
                <p style={{ fontSize: 12, color: '#887B76', fontWeight: 500, margin: 0, textTransform: 'capitalize' }}>
                {formatSummaryFormatLabel(settings.summaryFormat)} · {formatSummaryLengthLabel(settings.summaryLength)}
              </p>
            </div>
          </div>

          {/* Keywords removed — filtering handled server-side */}
        </div>
      </div>

      {/* ── Fetch Attempts Section ─────────────────────────────────── */}
      {fetchAttempts.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 24 }}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'rgb(136,123,118)' }}>Fetch Attempts</div>
                <p style={{ fontSize: 13, color: '#888', margin: '2px 0 0' }}>History of article fetch attempts</p>
                {attemptsError && (
                  <p style={{ fontSize: 12, color: '#b91c1c', margin: '6px 0 0' }}>
                    Failed to load attempts: {attemptsError}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleDeleteAllAttempts}
                  disabled={fetchAttempts.length === 0}
                  style={{
                    ...btnOutline,
                    fontSize: 13,
                    color: '#b91c1c',
                    borderColor: 'rgba(185,28,28,0.4)',
                    opacity: fetchAttempts.length === 0 ? 0.5 : 1,
                    cursor: fetchAttempts.length === 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  Delete All Attempts
                </button>
                <button
                  onClick={handlePushToPublish}
                  disabled={selectedArticles.length === 0}
                  style={{
                    ...btnPrimary,
                    opacity: selectedArticles.length === 0 ? 0.5 : 1,
                    cursor: selectedArticles.length === 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  <IconArrowRight size={16} style={{ marginRight: 8 }} />
                  Push to Publish ({selectedArticles.length})
                </button>
              </div>
            </div>
          </div>
          <div style={cardContentStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {fetchAttempts.map((attempt, attemptIndex) => {
                const isActive = visibleAttemptArticles[attempt.id] || expandedAttempts[attempt.id]
                const sequence = attempt.sequence ?? (attemptIndex + 1)
                return (
                  <div key={attempt.id} style={{
                    border: isActive ? '1px solid #BA0006' : '1px solid #e5e7eb',
                    borderRadius: 6, padding: 16,
                    transition: 'all 0.2s',
                    background: isActive ? 'rgba(186,0,6,0.03)' : 'transparent',
                    boxShadow: isActive ? '0 4px 6px rgba(0,0,0,0.07)' : 'none'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ fontSize: 14, color: '#887B76', fontWeight: 500, margin: 0 }}>
                          Fetch Attempt #{sequence} • {safeParseDate(attempt.timestamp)?.toLocaleString() ?? 'Unknown date'}
                        </p>
                        <p style={{ fontSize: 12, color: 'rgba(136,123,118,0.6)', margin: '4px 0 0' }}>
                          {attempt.articleCount > 0
                            ? `${attempt.articleCount} new article${attempt.articleCount !== 1 ? 's' : ''} added`
                            : attempt.resultSummary
                              ? 'All articles already in database (duplicates skipped)'
                              : 'No articles returned'}
                        </p>
                        {/* Per-source breakdown */}
                        {attempt.resultSummary && attempt.resultSummary.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                            {attempt.resultSummary.map((src, i) => (
                              <span key={i} style={{
                                fontSize: 11, padding: '2px 8px', borderRadius: 4,
                                background: src.error ? '#fef2f2' : src.added > 0 ? '#f0fdf4' : '#f9fafb',
                                color: src.error ? '#b91c1c' : src.added > 0 ? '#15803d' : '#6b7280',
                                border: `1px solid ${src.error ? '#fecaca' : src.added > 0 ? '#bbf7d0' : '#e5e7eb'}`,
                              }}>
                                {src.name}: {src.error ? `Error` : `${src.fetched} crawled, ${src.added} new`}
                                {(!src.error && src.duplicatesSkipped) ? `, ${src.duplicatesSkipped} duplicates skipped` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => setVisibleAttemptArticles(prev => ({ ...prev, [attempt.id]: !prev[attempt.id] }))}
                          style={{ ...btnOutline, color: '#BA0006', borderColor: 'rgba(186,0,6,0.3)', fontSize: 13, padding: '6px 14px' }}
                        >
                          {visibleAttemptArticles[attempt.id] ? 'Hide Articles' : 'Show Articles'}
                        </button>
                        <button
                          onClick={() => setExpandedAttempts(prev => ({ ...prev, [attempt.id]: !prev[attempt.id] }))}
                          style={{ ...btnOutline, fontSize: 13, padding: '6px 14px' }}
                        >
                          {expandedAttempts[attempt.id] ? 'Hide Details' : 'Show Details'}
                        </button>
                        <button
                          onClick={() => handleDeleteAttempt(attempt)}
                          style={{
                            ...btnOutline,
                            fontSize: 13,
                            padding: '6px 14px',
                            color: '#b91c1c',
                            borderColor: 'rgba(185,28,28,0.4)'
                          }}
                        >
                          Delete Attempt
                        </button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedAttempts[attempt.id] && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#333', marginBottom: 4 }}>Sources</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {(attempt.settingsUsed.sources || []).map((sourceId) => {
                                const source = availableSources.find(s => String(s.id) === String(sourceId))
                                return source ? (
                                  <span key={sourceId} style={badgeOutlineStyle('rgba(186,0,6,0.05)', 'rgba(186,0,6,0.2)', '#BA0006')}>
                                    {source.name}
                                  </span>
                                ) : (
                                  <span key={sourceId} style={badgeOutlineStyle('rgba(186,0,6,0.05)', 'rgba(186,0,6,0.2)', '#BA0006')}>
                                    Source {sourceId}
                                  </span>
                                )
                              })}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#333', marginBottom: 4 }}>Max Articles</div>
                            <p style={{ fontSize: 12, color: '#887B76', fontWeight: 500, margin: 0 }}>{attempt.settingsUsed.maxArticles ?? 'N/A'} articles</p>
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#333', marginBottom: 4 }}>Summary</div>
                            <p style={{ fontSize: 12, color: '#887B76', fontWeight: 500, margin: 0, textTransform: 'capitalize' }}>
                              {formatSummaryFormatLabel(attempt.settingsUsed.summaryFormat)} · {formatSummaryLengthLabel(attempt.settingsUsed.summaryLength)}
                            </p>
                          </div>
                        </div>

                        {/* Keywords removed from settings; not displayed */}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Article Cards ─────────────────────────────────────────── */}
      {fetchedArticles.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {fetchedArticles
            .filter(article => article.attemptId && visibleAttemptArticles[article.attemptId])
            .map((article) => {
              const articleAttempt = fetchAttempts.find(attempt => attempt.id === article.attemptId)
              const attemptFormat = articleAttempt?.settingsUsed?.summaryFormat || settings.summaryFormat
              const attemptLength = articleAttempt?.settingsUsed?.summaryLength || settings.summaryLength
              // Backend always returns both EN and ZH — check what the article actually has
              const hasBothLanguages = Boolean(article.titleEn || article.summaryEn) && Boolean(article.titleZh || article.summaryZh)
              const hasOnlyChinese = !hasBothLanguages && Boolean(article.titleZh || article.summaryZh)
              const attemptSourceNames = (articleAttempt?.settingsUsed?.sources || [])
                .map((sourceId) => {
                  const source = availableSources.find(s => String(s.id) === String(sourceId))
                  return source ? source.name : null
                })
                .filter(Boolean)
              const sourceLabel = getSourceLabel(article, attemptSourceNames)
              const articleKey = getArticleKey(article)
              const currentLang = getDefaultLanguage(articleKey)
              const articleTitle = currentLang === 'chinese'
                ? (firstNonEmpty(article.titleZh, article.titleEn, article.title) || 'Article unknown')
                : (firstNonEmpty(article.titleEn, article.titleZh, article.title) || 'Article unknown')
              const issues = getArticleIssues(article)

              return (
                <div key={article.id} style={{
                  ...cardStyle,
                  borderColor: article.status === 'ready-to-publish' ? '#22c55e' : '#e5e7eb'
                }}>
                  <div style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', gap: 16 }}>
                      {/* Checkbox */}
                      {article.status === 'fetched' && (
                        <input
                          type="checkbox"
                          checked={selectedArticles.includes(articleKey)}
                          onChange={() => toggleArticleSelection(articleKey)}
                          style={{ ...checkboxStyle, width: 18, height: 18, cursor: 'pointer', flexShrink: 0, marginTop: 2 }}
                        />
                      )}

                      <div style={{ flex: 1 }}>
                        {/* Title & Header Info */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#BA0006', flex: 1 }}>{articleTitle}</h4>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                                {article.url && (
                                  <a
                                    href={article.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="View original article"
                                    style={{ color: '#887B76', transition: 'color 0.15s', display: 'flex' }}
                                    onMouseOver={(e) => e.currentTarget.style.color = '#BA0006'}
                                    onMouseOut={(e) => e.currentTarget.style.color = '#887B76'}
                                  >
                                    <IconExternalLink size={20} />
                                  </a>
                                )}
                                <button
                                  onClick={() => handleDeleteArticle(article)}
                                  title="Delete article"
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#dc2626',
                                    cursor: 'pointer',
                                    padding: 4,
                                    display: 'flex',
                                    alignItems: 'center',
                                    transition: 'opacity 0.15s'
                                  }}
                                  onMouseOver={(e) => e.currentTarget.style.opacity = '0.7'}
                                  onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                                >
                                  <IconTrash size={18} />
                                </button>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                              <span style={badgeOutlineStyle('transparent', 'rgba(136,123,118,0.3)', '#887B76')}>
                                {sourceLabel}
                              </span>
                              {article.status === 'ready-to-publish' && (
                                <span style={badgeFilledStyle('#16a34a', 'white')}>
                                  <IconCheckCircle size={12} style={{ marginRight: 4 }} />
                                  Ready to Publish
                                </span>
                              )}
                            </div>
                            {issues.length > 0 && (
                              <div style={{ marginTop: 6, fontSize: 11, color: '#b45309' }}>
                                Data issue: {issues.join('; ')}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Summary with Language Toggle */}
                        <div style={{ background: '#f9fafb', borderRadius: 6, padding: 12, marginTop: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>Summary</span>
                            {hasBothLanguages ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{
                                  fontSize: 12, fontWeight: 500,
                                  color: getDefaultLanguage(articleKey) === 'english' ? '#BA0006' : 'rgba(136,123,118,0.6)'
                                }}>English</span>
                                <ToggleSwitch
                                  checked={getDefaultLanguage(articleKey) === 'chinese'}
                                  onChange={(checked) =>
                                    setArticleLanguageToggles({
                                      ...articleLanguageToggles,
                                      [articleKey]: checked ? 'chinese' : 'english'
                                    })
                                  }
                                />
                                <span style={{
                                  fontSize: 12, fontWeight: 500,
                                  color: getDefaultLanguage(articleKey) === 'chinese' ? '#BA0006' : 'rgba(136,123,118,0.6)'
                                }}>中文</span>
                              </div>
                            ) : (
                              <span style={badgeFilledStyle('#f3f4f6', '#333')}>
                                {hasOnlyChinese ? '中文' : 'English'}
                              </span>
                            )}
                          </div>
                          {hasBothLanguages
                            ? renderSummaryContent(article, getDefaultLanguage(articleKey), attemptFormat)
                            : hasOnlyChinese
                              ? renderSummaryContent(article, 'chinese', attemptFormat)
                              : renderSummaryContent(article, 'english', attemptFormat)
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      )}

      {/* ── LIVE Fetch Status Panel (while fetching) ────────────────── */}
      {isFetching && fetchStartTime && (
        <div style={{
          ...cardStyle, marginBottom: 24, borderColor: '#3b82f6',
          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
          borderWidth: 2
        }}>
          <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{
                color: '#3b82f6',
                fontSize: 24,
                animation: 'fa-spin 1s linear infinite'
              }}>⟳</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#3b82f6' }}>
                  🔄 Fetching Articles in Progress
                </div>
                <p style={{ fontSize: 12, color: '#0369a1', margin: '4px 0 0' }}>
                  Elapsed: <strong>{elapsedTime}s</strong> • Do not close the page or navigate away
                </p>
              </div>
            </div>
            <div style={{
              padding: '12px 14px',
              background: 'rgba(59, 130, 246, 0.1)',
              borderRadius: 6,
              borderLeft: '4px solid #3b82f6'
            }}>
              <div style={{ fontSize: 11, color: '#0369a1', fontWeight: 700, marginBottom: 6 }}>REQUEST DETAILS:</div>
              <div style={{ fontSize: 11, color: '#0c4a6e', fontFamily: 'monospace', lineHeight: 1.6 }}>
                <div>POST /api/articles/fetchArticles</div>
                <div>Sources: {settings.sources.map(s => {
                  const src = availableSources.find(x => x.id === s)
                  return src ? src.name : `Source ${s}`
                }).join(', ')}</div>
                <div>Max Articles: <strong>{settings.maxArticles}</strong></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Empty State ─────────────────────────────────────────────── */}
      {fetchedArticles.length === 0 && (
        <div style={{ ...cardStyle }}>
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ margin: '0 auto 16px', width: 48, height: 48, color: '#999' }}>
              <IconDownload size={48} />
            </div>
            {fetchAttempts.length > 0 ? (
              <>
                <p style={{ color: '#888', fontSize: 14, margin: '0 0 8px' }}>
                  All fetched articles were duplicates already in the database.
                </p>
                <p style={{ color: '#999', fontSize: 12, margin: 0 }}>
                  The sources were crawled but no new content was found. Check the fetch attempts above for per-source details.
                </p>
              </>
            ) : (
              <>
                <p style={{ color: '#888', fontSize: 14, margin: '0 0 8px' }}>
                  No articles fetched yet. Click &quot;Fetch Articles&quot; to get started.
                </p>
                <p style={{ color: '#999', fontSize: 12, margin: 0 }}>
                  Current fetch limit: <strong>{settings.maxArticles} articles</strong> from {settings.sources.length} source(s)
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Debug Panel (shows raw API response) ────────────────────── */}
      {lastFetchDebug && (
        <div style={{ ...cardStyle, marginTop: 24, borderColor: '#f59e0b' }}>
          <div style={{ padding: '16px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>🔍 Fetch Debug Panel</div>
              <p style={{ fontSize: 12, color: '#888', margin: '2px 0 0' }}>Last fetch at {lastFetchDebug.timestamp}</p>
            </div>
            <button
              onClick={() => setLastFetchDebug(null)}
              style={{ ...btnOutline, fontSize: 12, padding: '4px 10px', color: '#888' }}
            >Dismiss</button>
          </div>
          <div style={{ padding: '12px 24px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div style={{ background: '#fffbeb', borderRadius: 6, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>RESPONSE TYPE</div>
                <div style={{ fontSize: 13, color: '#333', fontWeight: 600 }}>{lastFetchDebug.rawResponseType}</div>
              </div>
              <div style={{ background: '#fffbeb', borderRadius: 6, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>IS ARRAY?</div>
                <div style={{ fontSize: 13, color: '#333', fontWeight: 600 }}>{String(lastFetchDebug.isArray)}</div>
              </div>
              <div style={{ background: '#fffbeb', borderRadius: 6, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>{lastFetchDebug.isArray ? 'ARRAY LENGTH' : 'TOP-LEVEL KEYS'}</div>
                <div style={{ fontSize: 13, color: '#333', fontWeight: 600 }}>
                  {lastFetchDebug.isArray ? lastFetchDebug.arrayLength : (lastFetchDebug.topLevelKeys?.join(', ') || 'N/A')}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div style={{ background: '#fffbeb', borderRadius: 6, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>ARTICLES IN STATE</div>
                <div style={{ fontSize: 13, color: '#333', fontWeight: 600 }}>{fetchedArticles.length}</div>
              </div>
              <div style={{ background: '#fffbeb', borderRadius: 6, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>FETCH ATTEMPTS</div>
                <div style={{ fontSize: 13, color: '#333', fontWeight: 600 }}>{fetchAttempts.length}</div>
              </div>
              <div style={{ background: '#fffbeb', borderRadius: 6, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>EXTRACTED COUNT</div>
                <div style={{ fontSize: 13, color: '#333', fontWeight: 600 }}>{lastFetchDebug.extractedCount ?? '?'}</div>
              </div>
            </div>
            {lastFetchDebug.firstItem && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>FIRST ITEM SAMPLE:</div>
                <pre style={{ background: '#1e1e1e', color: '#d4d4d4', padding: 12, borderRadius: 6, fontSize: 11, overflow: 'auto', maxHeight: 200, whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>
                  {lastFetchDebug.firstItem}
                </pre>
              </div>
            )}
            {lastFetchDebug.normalizedSample && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>NORMALIZED FIRST ARTICLE:</div>
                <pre style={{ background: '#1e1e1e', color: '#d4d4d4', padding: 12, borderRadius: 6, fontSize: 11, overflow: 'auto', maxHeight: 200, whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>
                  {lastFetchDebug.normalizedSample}
                </pre>
              </div>
            )}
            {Array.isArray(lastFetchDebug.resultSummary) && lastFetchDebug.resultSummary.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>PER-SOURCE RESULTS:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {lastFetchDebug.resultSummary.map((r, idx) => (
                    <div key={`${r.sourceId || 'source'}-${idx}`} style={{
                      background: '#fffbeb', borderRadius: 6, padding: '8px 10px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      fontSize: 12, color: '#333'
                    }}>
                      <div style={{ fontWeight: 600 }}>
                        {r.name || `Source ${r.sourceId ?? 'unknown'}`}
                      </div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span>fetched: {r.fetched ?? 0}</span>
                        <span>added: {r.added ?? 0}</span>
                        <span>articles: {r.articleCount ?? 0}</span>
                        {r.error ? <span style={{ color: '#b91c1c' }}>error: {String(r.error)}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>RAW RESPONSE (first 3000 chars):</div>
              <pre style={{ background: '#1e1e1e', color: '#d4d4d4', padding: 12, borderRadius: 6, fontSize: 11, overflow: 'auto', maxHeight: 300, whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>
                {lastFetchDebug.rawSnippet}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
         SETTINGS DIALOG
         ═══════════════════════════════════════════════════════════════ */}
      {isSettingsOpen && (
        <div style={modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setIsSettingsOpen(false) }}>
          <div style={{
            width: '90vw', maxWidth: '90vw', maxHeight: '85vh',
            background: 'white', borderRadius: 10, boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            {/* Dialog Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#BA0006' }}>Article Fetching Settings</div>
              <p style={{ fontSize: 14, color: '#887B76', margin: '4px 0 0' }}>Configure advanced settings for fetching and managing articles from sources.</p>
            </div>

            {/* Dialog Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', color: '#887B76', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
              {/* Quick Presets */}
              

              {/* Two Column Layout */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {/* Left Column */}
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#BA0006', borderBottom: '1px solid rgba(186,0,6,0.2)', paddingBottom: 8, marginBottom: 16, marginTop: 0 }}>
                    Source &amp; Content Filters
                  </h3>

                  {/* Select Sources */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Select Sources:</label>
                    <div style={sectionBg}>
                      {availableSources.map((source) => (
                        <label key={source.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={settings.sources.includes(source.id)}
                            onChange={() => toggleSource(source.id)}
                            style={checkboxStyle}
                          />
                          <span style={{ fontSize: 14, color: '#333', fontWeight: 500 }}>{source.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Max Articles */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Max Articles:</label>
                    <input
                      type="number" min="1" max="10"
                      value={settings.maxArticles}
                      onChange={(e) => setSettings({ ...settings, maxArticles: Math.min(10, Math.max(1, parseInt(e.target.value) || 1)) })}
                      style={{ ...inputStyle, height: 36, borderColor: 'rgba(136,123,118,0.2)' }}
                    />
                  </div>

                  {/* Keywords inputs removed per UX decision */}
                </div>

                {/* Right Column */}
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#BA0006', borderBottom: '1px solid rgba(186,0,6,0.2)', paddingBottom: 8, marginBottom: 16, marginTop: 0 }}>
                    Summary Settings
                  </h3>

                  {/* Summary Format */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Summary Format:</label>
                    <div style={{ ...sectionBg, display: 'flex', gap: 16 }}>
                      {[
                        { value: 'bullet', label: 'Bullet Points' },
                        { value: 'paragraph', label: 'Paragraph' },
                      ].map(opt => (
                        <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                          <input
                            type="radio" name="summaryFormat"
                            value={opt.value}
                            checked={settings.summaryFormat === opt.value}
                            onChange={() => setSettings({ ...settings, summaryFormat: opt.value })}
                            style={radioStyle}
                          />
                          <span style={{ fontSize: 14, color: '#333', fontWeight: 500 }}>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Summary Length */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Summary Length:</label>
                    <div style={sectionBg}>
                      {[
                        { value: 'short', label: 'Short (50-100 words)' },
                        { value: 'medium', label: 'Medium (100-200 words)' },
                        { value: 'long', label: 'Long (200-300 words)' },
                      ].map(opt => (
                        <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', cursor: 'pointer' }}>
                          <input
                            type="radio" name="summaryLength"
                            value={opt.value}
                            checked={settings.summaryLength === opt.value}
                            onChange={() => setSettings({ ...settings, summaryLength: opt.value })}
                            style={radioStyle}
                          />
                          <span style={{ fontSize: 14, color: '#333', fontWeight: 500 }}>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingTop: 16, borderTop: '1px solid #e5e7eb', marginTop: 16 }}>
                <button
                  onClick={handleSaveSettings}
                  disabled={settings.sources.length === 0}
                  style={{
                    ...btnOutline, height: 40, borderColor: 'rgba(136,123,118,0.3)',
                    opacity: settings.sources.length === 0 ? 0.5 : 1,
                    cursor: settings.sources.length === 0 ? 'not-allowed' : 'pointer'
                  }}
                >Save as Default Fetch Settings</button>
                <button
                  onClick={() => { handleSaveSettings(); handleFetchArticles() }}
                  disabled={settings.sources.length === 0 || isFetching}
                  style={{
                    ...btnPrimary, height: 40,
                    opacity: (settings.sources.length === 0 || isFetching) ? 0.6 : 1,
                    cursor: (settings.sources.length === 0 || isFetching) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isFetching
                    ? <><IconRefresh size={16} spin style={{ marginRight: 8 }} />Fetching...</>
                    : <><IconDownload size={16} style={{ marginRight: 8 }} />Fetch Now</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Notification ──────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', right: 20, bottom: 20, zIndex: 10000, maxWidth: 320,
          background: toast.type === 'error' ? '#fff4f4' : toast.type === 'info' ? '#f0f8ff' : '#e8f9ee',
          color: toast.type === 'error' ? '#a00' : toast.type === 'info' ? '#0066cc' : '#0a6',
          padding: '12px 16px', borderRadius: 8, boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
          fontWeight: 500, fontSize: 14
        }}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
