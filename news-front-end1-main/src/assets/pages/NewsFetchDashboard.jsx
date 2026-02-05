import React, { useEffect, useState } from 'react'
import { getRoleFromToken } from '../../utils/auth'

const API_BASE = import.meta.env.VITE_API_BASE || ''

const apiFetch = async (path, opts = {}) => {
  const token = localStorage.getItem('token')
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {})
  if (token) headers['Authorization'] = `Bearer ${token}`
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  let res
  try {
    console.debug('apiFetch ->', url)
    res = await fetch(url, Object.assign({ headers }, opts))
  } catch (err) {
    console.error('apiFetch network error', url, err)
    throw new Error('Network error: ' + (err && err.message ? err.message : String(err)))
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    const msg = txt || res.statusText || `HTTP ${res.status}`
    console.error('apiFetch non-OK response', url, res.status, msg)
    throw new Error(msg)
  }
  const text = await res.text().catch(() => '')
  try { return text ? JSON.parse(text) : null } catch { return text }
}

export default function NewsFetchDashboard() {
  const [sources, setSources] = useState([])
  const [articles, setArticles] = useState([])
  const [lastFetchRaw, setLastFetchRaw] = useState(null)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [settingModalOpen, setSettingModalOpen] = useState(false)
  const [modalSetting, setModalSetting] = useState(null)
  const [modalSelectedSourceIds, setModalSelectedSourceIds] = useState([])
  const [modalPersist, setModalPersist] = useState(true)
  const [modalForce, setModalForce] = useState(false)
  const [modalDebug, setModalDebug] = useState(false)
  const showToast = (opts) => {
    try {
      alert((opts && opts.title ? opts.title : '') + (opts && opts.description ? '\n' + opts.description : ''))
    } catch (e) { console.log('toast', opts) }
  }

  useEffect(() => {
    (async () => {
      try {
        await load()
      } catch (e) {
        // ignore - load() shows its own toast on error
      }
      try {
        await loadRecentArticles()
      } catch (e) {
        // ignore fallback handled inside loadRecentArticles
      }
    })()
  }, [])

  // Try to load persisted recent articles from the backend, fall back to localStorage
  const loadRecentArticles = async () => {
    try {
      console.debug('loadRecentArticles: requesting /api/articles/recent')
      const res = await apiFetch('/api/articles/recent')
      const a = extractArticlesFromResponse(res)
      if (a && a.length > 0) {
        let normalized = a.map(normalizeArticle)
        // ensure we pick up title from raw DTO when normalize didn't find a title
        normalized = normalized.map(n => {
          if (n && (!n.title || String(n.title).trim().length === 0)) {
            const raw = n.raw || {}
            const fallback = raw.TitleZH ?? raw.titleZH ?? raw.titleZh ?? raw.TitleEN ?? raw.titleEN ?? raw.Title ?? raw.title ?? raw.Summary ?? raw.summary ?? raw.Snippet ?? raw.snippet ?? ''
            return { ...n, title: fallback || n.title }
          }
          return n
        })
        // filter out articles with blank/whitespace-only titles
        normalized = normalized.filter(x => x && x.title && String(x.title).trim().length > 0)
        console.debug('loadRecentArticles - normalized recent articles:', normalized)
        // merge server-provided recent articles into current list, placing server items at top
        setArticles(prev => {
          const merged = mergeNewOnTop(normalized, prev)
          return merged
        })
        return
      }
      console.debug('loadRecentArticles: no recent articles returned', res)
    } catch (e) {
      console.error('loadRecentArticles failed', e)
      try { showToast({ title: 'Failed to load recent articles', description: e.message || String(e), status: 'error' }) } catch (ex) { console.error(ex) }
    }

    // NOTE: removed localStorage fallback per configuration: rely on server-provided recent articles only
  }

  const load = async () => {
    setLoading(true)
    try {
      const s = await apiFetch('/api/sources')
      const normalized = (Array.isArray(s) ? s : []).map(item => ({
        SourceId: item.SourceId ?? item.sourceId,
        Name: item.Name ?? item.name,
        BaseUrl: item.BaseUrl ?? item.baseUrl,
        Type: item.Type ?? (item.type ? String(item.type).toString() : undefined),
        Language: item.Language ?? item.language,
        CrawlFrequency: item.CrawlFrequency ?? item.crawlFrequency,
        LastCrawledAt: item.LastCrawledAt ?? item.lastCrawledAt,
        Ownership: item.Ownership ?? item.ownership,
        RegionLevel: item.RegionLevel ?? item.regionLevel,
        IsActive: item.IsActive ?? item.isActive,
        Description: item.Description ?? item.description,
        Notes: item.Notes ?? item.notes
      }))
      setSources(normalized)
    } catch (e) { showToast({ title: 'Failed to load', description: e.message, status: 'error' }) }
    finally { setLoading(false) }
  }

  const triggerFetch = async (persist = true, sourceSetting = null, sourceIds = null, debug = false, force = false) => {
    if (running) return
    setRunning(true)
    try {
      const ids = Array.isArray(sourceIds) && sourceIds.length > 0 ? sourceIds : sources.filter(x=>x.IsActive).map(x=>x.SourceId)
      const body = { SourceIds: ids, Persist: persist }
      if (sourceSetting) body.SourceSettingOverride = sourceSetting
      // include Force flag if requested
      if (force) body.Force = true
      const url = '/api/articles/fetchArticles' + (debug ? '?debug=true' : '')
      const res = await apiFetch(url, { method: 'POST', body: JSON.stringify(body) })
      setLastFetchRaw(res)
      const a = extractArticlesFromResponse(res)
      if (a && a.length > 0) {
        let normalized = a.map(normalizeArticle)
        normalized = normalized.map(n => {
          if (n && (!n.title || String(n.title).trim().length === 0)) {
            const raw = n.raw || {}
            const fallback = raw.TitleZH ?? raw.titleZh ?? raw.Title ?? raw.title ?? raw.Summary ?? raw.summary ?? raw.Snippet ?? raw.snippet ?? ''
            return { ...n, title: fallback || n.title }
          }
          return n
        })
        normalized = normalized.filter(x => x && x.title && String(x.title).trim().length > 0)
        console.debug('triggerFetch - normalized fetched articles:', normalized)
        setArticles(prev => {
          const merged = mergeNewOnTop(normalized, prev)
          return merged
        })
        // attempt to reload persisted articles from server (if backend saved them)
        if (persist) {
          await loadRecentArticles()
          // notify other views (ArticleList) that articles may have changed
          try { window.dispatchEvent(new Event('articles:changed')) } catch (e) { /* ignore */ }
        }
        showToast({ title: 'Fetch finished', description: `Fetched ${a.length} articles`, status: 'success' })
      } else {
        // No articles returned
        showToast({ title: 'No articles returned', description: 'The fetch completed but returned no articles.', status: 'info' })
        load()
      }
    } catch (e) { showToast({ title: 'Fetch failed', description: e.message, status: 'error' }) }
    finally { setRunning(false) }
  }

  const normalizeArticle = (a) => ({
    // handle nested payloads like { Article: { TitleZH: ... } } or top-level shapes
    id: a.Id ?? a.id ?? a.ArticleId ?? a.articleId ?? a.NewsArticleId ?? a.newsArticleId ?? a.NewsArticleID,
    // prefer Chinese title when available (check nested article/article casing and lower-t variants too)
    title: (
      a.Article?.TitleZH ?? a.Article?.titleZh ?? a.Article?.TitleEN ??
      a.article?.TitleZH ?? a.article?.titleZh ?? a.article?.titleZH ?? a.article?.titleEN ??
      a.TitleZH ?? a.titleZH ?? a.titleZh ?? a.TitleEN ?? a.titleEN ??
      a.Title ?? a.title ?? a.headline ?? a.TitleSnippet ?? a.titleSnippet
    ) || null,
    snippet: a.Snippet ?? a.snippet ?? a.Summary ?? a.summary ?? '',
    // support many possible URL field names returned by backend (include lowercase sourceurl)
    url: a.Url ?? a.url ?? a.Link ?? a.link ?? a.SourceURL ?? a.SourceUrl ?? a.sourceUrl ?? a.sourceURL ?? a.source_url ?? a.sourceurl
      ?? a.OriginalUrl ?? a.originalUrl ?? a.ArticleUrl ?? a.articleUrl ?? a.CanonicalUrl ?? a.canonicalUrl
      ?? a.NewsUrl ?? a.newsUrl ?? a.SourceLink ?? a.sourceLink ?? a.Website ?? a.website,
    sourceId: a.SourceId ?? a.sourceId ?? a.Source?.SourceId ?? a.source?.id,
    sourceName: a.SourceName ?? a.sourceName ?? (a.Source && (a.Source.Name || a.Source.name)) ?? undefined,
    // include PublishedAt (capital P) returned by server DTOs and various other date shapes
    fetchedAt: a.PublishedAt ?? a.FetchedAt ?? a.fetchedAt ?? a.fetchTime ?? a.publishedAt ?? a.published_at ?? a.published,
    // keep original raw article so we can inspect other shapes if url is missing
    raw: a
  })

  // Merge helper: put newArticles at top, dedupe by id or sourceURL+title+publishedAt
  const mergeNewOnTop = (newArticles, existingArticles) => {
    const out = []
    const seen = new Set()
    const pushIfNew = (it) => {
      if (!it) return
      // Prefer database primary key `newsArticleId` when available (from normalized id or raw object)
      const raw = it.raw || {}
      const rawId = raw.NewsArticleId ?? raw.newsArticleId ?? raw.NewsArticleID ?? raw.newsArticleID ?? null
      const idKey = it.id ?? (rawId != null ? String(rawId) : null)
      const urlKey = (it.url && String(it.url).toLowerCase()) || null
      const titleKey = it.title ? String(it.title).trim().toLowerCase() : null
      const pubKey = it.fetchedAt ? String(it.fetchedAt) : null
      const key = idKey ?? (urlKey ? `${urlKey}` : (titleKey && pubKey ? `${titleKey}|${pubKey}` : null))
      if (key) {
        if (seen.has(key)) return
        seen.add(key)
        out.push(it)
      } else {
        out.push(it)
      }
    }
    for (const n of (Array.isArray(newArticles) ? newArticles : [])) pushIfNew(n)
    for (const e of (Array.isArray(existingArticles) ? existingArticles : [])) pushIfNew(e)
    // Ensure each item exposes NewsArticleId (for UI compatibility)
    return out.map(it => {
      const raw = it.raw || {}
      const rawId = raw.NewsArticleId ?? raw.newsArticleId ?? raw.NewsArticleID ?? raw.newsArticleID ?? null
      const nid = it.NewsArticleId ?? it.id ?? rawId ?? null
      return { ...it, NewsArticleId: nid, id: it.id ?? nid }
    })
  }

  // Try to find any URL string inside an object/array (depth-limited, avoids circulars)
  // This will search for URLs that appear anywhere inside strings (including HTML/escaped forms).
  const findUrlInObject = (obj, seen = new Set(), depth = 0) => {
    if (!obj || depth > 8) return null
    if (typeof obj === 'string') {
      const s = obj.trim()
      if (/^\s*https?:\/\//i.test(s) || s.startsWith('//')) return s
      // match URLs anywhere inside the string (covers href="...", embedded links, etc.)
      const m = s.match(/(https?:\/\/[^\s"'<>\u00A0]+)/i)
      if (m) return m[1]
      // try to unescape common HTML-escaped ampersands used in query strings
      const unescaped = s.replace(/&amp;/g, '&').replace(/\\u0026/g, '&')
      const m2 = unescaped.match(/(https?:\/\/[^\s"'<>\u00A0]+)/i)
      if (m2) return m2[1]
      return null
    }
    if (typeof obj !== 'object') return null
    if (seen.has(obj)) return null
    seen.add(obj)
    if (Array.isArray(obj)) {
      for (const it of obj) {
        const r = findUrlInObject(it, seen, depth + 1)
        if (r) return r
      }
      return null
    }
    for (const k of Object.keys(obj)) {
      const v = obj[k]
      if (typeof v === 'string') {
        const s = v.trim()
        if (/^\s*https?:\/\//i.test(s) || s.startsWith('//')) return s
        const m = s.match(/(https?:\/\/[^\s"'<>\u00A0]+)/i)
        if (m) return m[1]
      }
      const r = findUrlInObject(v, seen, depth + 1)
      if (r) return r
    }
    return null
  }

  const extractArticlesFromResponse = (res) => {
    if (!res) return []
    // If it's an array of articles
    if (Array.isArray(res)) {
      // array of article-like objects - accept many possible property names including localized fields
      if (res.length > 0) {
        const sample = res[0]
        const looksLikeArticle = Boolean(
          sample.Title || sample.title || sample.headline || sample.Url || sample.ArticleId || sample.ArticleId ||
          sample.TitleZH || sample.titleZH || sample.TitleEN || sample.titleEN || sample.titleZh || sample.titleEn || sample.NewsArticleId || sample.id ||
          sample.Summary || sample.summary || sample.SummaryEN || sample.SummaryZH || sample.Snippet || sample.snippet
        )
        if (looksLikeArticle) return res
      }
      // array of containers which may have Articles/Items (support mixed casing)
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
    // If it's an object with arrays inside
    if (typeof res === 'object') {
      if (Array.isArray(res.Articles) && res.Articles.length) return res.Articles
      if (Array.isArray(res.articles) && res.articles.length) return res.articles
      if (Array.isArray(res.items) && res.items.length) return res.items
      if (Array.isArray(res.results) && res.results.length) return res.results
      // some endpoints return an object with DTO properties directly (e.g. { Items: [...] } or top-level array-like keys)
      if (Array.isArray(res.Items) && res.Items.length) return res.Items
      if (Array.isArray(res.Data) && res.Data.length) return res.Data
      // maybe object keyed by source id
      const keys = Object.keys(res)
      for (const k of keys) {
        const v = res[k]
        if (Array.isArray(v) && v.length && (v[0].Title || v[0].title || v[0].headline || v[0].Url)) return v
      }
    }
    return []
  }

  const extractSummaryFromResponse = (res) => {
    if (!res) return []
    if (Array.isArray(res)) {
      // items like { sourceId, name, fetched, added, articles }
      if (res.length > 0 && (typeof res[0].fetched !== 'undefined' || typeof res[0].added !== 'undefined')) return res
      const flattened = []
      for (const item of res) {
        if (item && typeof item.fetched !== 'undefined') flattened.push(item)
      }
      return flattened
    }
    if (typeof res === 'object') {
      const candidates = []
      for (const k of Object.keys(res)) {
        const v = res[k]
        if (Array.isArray(v)) {
          for (const it of v) if (it && typeof it.fetched !== 'undefined') candidates.push(it)
        }
      }
      return candidates
    }
    return []
  }

  const fetchForSource = async (sourceId, persist = true) => {
    try {
      const res = await apiFetch('/api/articles/fetchArticles', { method: 'POST', body: JSON.stringify({ SourceIds: [sourceId], Persist: persist }) })
      setLastFetchRaw(res)
      const a = extractArticlesFromResponse(res)
      if (a && a.length > 0) {
        let normalized = a.map(normalizeArticle)
        normalized = normalized.filter(x => x && x.title && String(x.title).trim().length > 0)
        console.debug('fetchForSource - normalized fetched articles:', normalized)
        setArticles(prev => {
          const merged = mergeNewOnTop(normalized, prev)
          return merged
        })
        if (persist) {
          await loadRecentArticles()
          try { window.dispatchEvent(new Event('articles:changed')) } catch (e) { /* ignore */ }
        }
        showToast({ title: 'Fetch finished', description: `Fetched ${a.length} articles`, status: 'success' })
      } else {
        // No articles for this source
        showToast({ title: 'No articles returned', description: 'The fetch completed but returned no articles for this source.', status: 'info' })
        load()
      }
    } catch (e) { showToast({ title: 'Fetch failed', description: e.message, status: 'error' }) }
  }

  const formatDate = (v) => {
    if (!v) return '-'
    try {
      let d
      if (typeof v === 'number') {
        const ms = v > 1e12 ? v : v * 1000
        d = new Date(ms)
      } else if (/^\d+$/.test(String(v))) {
        const n = Number(v)
        const ms = n > 1e12 ? n : n * 1000
        d = new Date(ms)
      } else {
        d = new Date(v)
      }
      if (isNaN(d)) return String(v)
      const opts = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }
      return d.toLocaleString(undefined, opts)
    } catch (e) { return String(v) }
  }

  const resolveSourceLabel = (a) => {
    if (!a) return '-'
    if (a.sourceName) return a.sourceName
    // try direct lookup by id
    if (a.sourceId) {
      const found = sources.find(s => String(s.SourceId) === String(a.sourceId) || String(s.SourceId) === String(a.sourceId))
      if (found && found.Name) return found.Name
    }
    // try to match by article url hostname -> source.BaseUrl hostname
    const tryHostnameMatch = (url) => {
      try {
        const u = new URL(url, window.location.origin)
        const host = u.hostname.replace(/^www\./,'')
        for (const s of sources) {
          if (!s.BaseUrl) continue
          try {
            const bs = new URL(s.BaseUrl, window.location.origin)
            const bhost = bs.hostname.replace(/^www\./,'')
            if (bhost && host && (host === bhost || host.endsWith('.' + bhost) || bhost.endsWith('.' + host))) return s.Name
          } catch (e) { /* ignore invalid baseUrl */ }
        }
      } catch (e) { /* ignore invalid url */ }
      return null
    }

    if (a.url) {
      const byUrl = tryHostnameMatch(a.url)
      if (byUrl) return byUrl
    }
    // inspect raw object for any URL and try match
    if (a.raw) {
      try {
        const found = findUrlInObject(a.raw)
        if (found) {
          const byRaw = tryHostnameMatch(found)
          if (byRaw) return byRaw
        }
      } catch (e) { /* ignore */ }
    }

    return 'Unknown source'
  }

  const total = sources.length
  const active = sources.filter(s=>s.IsActive).length
  const inactive = total - active

  const role = getRoleFromToken(localStorage.getItem('token'))

  if (role !== 'consultant') return <div style={{ padding: 24 }}><div style={{ fontWeight: 600 }}>You do not have permission to view this page.</div></div>
  return (
    <div style={{ padding: 20, background: '#fbf4f2', minHeight: '80vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>News Fetch Dashboard</h2>
        
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 16 }}>
        <div style={{ background: 'white', padding: 16, borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
          <div style={{ color: '#666', fontSize: 13 }}>Crawler Status</div>
            <div style={{ color: '#666' }}>No logs yet.</div>
            {(!articles.length && lastFetchRaw) && (() => {
              const sums = extractSummaryFromResponse(lastFetchRaw)
              if (sums && sums.length) {
                return (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Fetch Results</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
                          <th style={{ padding: 8 }}>Source</th>
                          <th style={{ padding: 8 }}>Fetched</th>
                          <th style={{ padding: 8 }}>Added</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sums.map((r,i) => (
                          <tr key={r.sourceId ?? r.SourceId ?? i} style={{ borderBottom: '1px solid #f2f2f2' }}>
                            <td style={{ padding: 8 }}>{r.name ?? r.Name ?? (sources.find(s=>s.SourceId===r.sourceId)?.Name) ?? '-'}</td>
                            <td style={{ padding: 8 }}>{r.fetched ?? r.Fetched ?? 0}</td>
                            <td style={{ padding: 8 }}>{r.added ?? r.Added ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <details style={{ marginTop: 12 }}>
                      <summary style={{ cursor: 'pointer' }}>Show last fetch response (debug)</summary>
                      <pre style={{ maxHeight: 300, overflow: 'auto', background: '#f7f7f7', padding: 8 }}>{JSON.stringify(lastFetchRaw, null, 2)}</pre>
                    </details>
                  </div>
                )
              }
              return (
                <details style={{ marginTop: 12 }}>
                  <summary style={{ cursor: 'pointer' }}>Show last fetch response (debug)</summary>
                  <pre style={{ maxHeight: 300, overflow: 'auto', background: '#f7f7f7', padding: 8 }}>{JSON.stringify(lastFetchRaw, null, 2)}</pre>
                </details>
              )
            })()}
          <div style={{ color: '#888', marginTop: 8 }}>Last Run: {new Date().toLocaleString()}</div>
        </div>
        <div style={{ background: 'white', padding: 16, borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
          <div style={{ color: '#666', fontSize: 13 }}>Manual Fetch Trigger</div>
          <div style={{ marginTop: 12 }}>
            <button
              onClick={() => {
                // open modal with defaults and currently active sources selected
                const defaults = {
                  TranslateOnFetch: true,
                  SummaryWordCount: 150,
                  SummaryTone: 'neutral',
                  SummaryFormat: 'paragraph',
                  CustomKeyPoints: '',
                  MaxArticlesPerFetch: 10,
                  IncludeOriginalChinese: true,
                  IncludeEnglishSummary: true,
                  IncludeChineseSummary: true,
                  MinArticleLength: 0,
                  SummaryFocus: '',
                  SentimentAnalysisEnabled: false,
                  HighlightEntities: false,
                  SummaryLanguage: 'EN'
                }
                setModalSetting(defaults)
                setModalSelectedSourceIds(sources.filter(x=>x.IsActive).map(x=>x.SourceId))
                setModalPersist(true)
                setModalForce(false)
                setModalDebug(false)
                setSettingModalOpen(true)
              }}
              disabled={running}
              style={{ background: '#5b46ff', color: 'white', padding: '8px 14px', borderRadius: 8, border: 'none' }}
            >{running ? 'Running...' : 'Trigger Fetch Now'}</button>
          </div>
        </div>
        <div style={{ background: 'white', padding: 16, borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
          <div style={{ color: '#666', fontSize: 13 }}>Recent Fetch Errors</div>
          <div style={{ marginTop: 8, color: '#c92b2b', fontSize: 13 }}>No recent errors.</div>
        </div>
      </div>

      {settingModalOpen && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ width: 760, maxWidth: '96%', background: 'white', borderRadius: 12, padding: 18, boxShadow: '0 12px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 700 }}>Source Setting</div>
              <div>
                <button onClick={() => setSettingModalOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>✕</button>
              </div>
            </div>

            <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Select Sources</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {sources.map(s => (
                    <label key={s.SourceId} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="checkbox" checked={modalSelectedSourceIds.includes(s.SourceId)} onChange={(e) => {
                        const next = modalSelectedSourceIds.slice()
                        if (e.target.checked) {
                          if (!next.includes(s.SourceId)) next.push(s.SourceId)
                        } else {
                          const idx = next.indexOf(s.SourceId)
                          if (idx !== -1) next.splice(idx,1)
                        }
                        setModalSelectedSourceIds(next)
                      }} />
                      <span>{s.Name ?? s.name ?? `Source ${s.SourceId}`}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ display: 'block' }}>
                  <div style={{ fontSize: 13, color: '#444' }}>Translate On Fetch</div>
                  <input type="checkbox" checked={!!(modalSetting && modalSetting.TranslateOnFetch)} onChange={e => setModalSetting({...modalSetting, TranslateOnFetch: e.target.checked})} />
                </label>
                <label style={{ display: 'block' }}>
                  <div style={{ fontSize: 13, color: '#444' }}>Summary Word Count</div>
                  <input type="number" value={modalSetting?.SummaryWordCount ?? 150} onChange={e => setModalSetting({...modalSetting, SummaryWordCount: Number(e.target.value)})} style={{ width: '100%' }} />
                </label>
                <label style={{ display: 'block' }}>
                  <div style={{ fontSize: 13, color: '#444' }}>Max Articles Per Fetch</div>
                  <input type="number" value={modalSetting?.MaxArticlesPerFetch ?? 10} onChange={e => setModalSetting({...modalSetting, MaxArticlesPerFetch: Number(e.target.value)})} style={{ width: '100%' }} />
                </label>
                <label style={{ display: 'block' }}>
                  <div style={{ fontSize: 13, color: '#444' }}>Min Article Length</div>
                  <input type="number" value={modalSetting?.MinArticleLength ?? 200} onChange={e => setModalSetting({...modalSetting, MinArticleLength: Number(e.target.value)})} style={{ width: '100%' }} />
                </label>
                <label style={{ display: 'block' }}>
                  <div style={{ fontSize: 13, color: '#444' }}>Summary Tone</div>
                  <select value={modalSetting?.SummaryTone ?? 'neutral'} onChange={e => setModalSetting({...modalSetting, SummaryTone: e.target.value})} style={{ width: '100%' }}>
                    <option value="neutral">neutral</option>
                    <option value="positive">positive</option>
                    <option value="negative">negative</option>
                  </select>
                </label>
                <label style={{ display: 'block' }}>
                  <div style={{ fontSize: 13, color: '#444' }}>Summary Format</div>
                  <select value={modalSetting?.SummaryFormat ?? 'paragraph'} onChange={e => setModalSetting({...modalSetting, SummaryFormat: e.target.value})} style={{ width: '100%' }}>
                    <option value="paragraph">paragraph</option>
                    <option value="bullets">bullets</option>
                  </select>
                </label>
                <label style={{ display: 'block' }}>
                  <div style={{ fontSize: 13, color: '#444' }}>Include English Summary</div>
                  <input type="checkbox" checked={!!(modalSetting && modalSetting.IncludeEnglishSummary)} onChange={e => setModalSetting({...modalSetting, IncludeEnglishSummary: e.target.checked})} />
                </label>
                <label style={{ display: 'block' }}>
                  <div style={{ fontSize: 13, color: '#444' }}>Include Chinese Summary</div>
                  <input type="checkbox" checked={!!(modalSetting && modalSetting.IncludeChineseSummary)} onChange={e => setModalSetting({...modalSetting, IncludeChineseSummary: e.target.checked})} />
                </label>
                <label style={{ display: 'block' }}>
                  <div style={{ fontSize: 13, color: '#444' }}>Sentiment Analysis Enabled</div>
                  <input type="checkbox" checked={!!(modalSetting && modalSetting.SentimentAnalysisEnabled)} onChange={e => setModalSetting({...modalSetting, SentimentAnalysisEnabled: e.target.checked})} />
                </label>
                <label style={{ display: 'block' }}>
                  <div style={{ fontSize: 13, color: '#444' }}>Highlight Entities</div>
                  <input type="checkbox" checked={!!(modalSetting && modalSetting.HighlightEntities)} onChange={e => setModalSetting({...modalSetting, HighlightEntities: e.target.checked})} />
                </label>
                <label style={{ display: 'block', gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 13, color: '#444' }}>Custom Key Points (comma-separated)</div>
                  <textarea value={modalSetting?.CustomKeyPoints ?? ''} onChange={e => setModalSetting({...modalSetting, CustomKeyPoints: e.target.value})} style={{ width: '100%' }} rows={3} />
                </label>
                <label style={{ display: 'block' }}>
                  <div style={{ fontSize: 13, color: '#444' }}>Summary Focus</div>
                  <input type="text" value={modalSetting?.SummaryFocus ?? ''} onChange={e => setModalSetting({...modalSetting, SummaryFocus: e.target.value})} style={{ width: '100%' }} />
                </label>
                <label style={{ display: 'block' }}>
                  <div style={{ fontSize: 13, color: '#444' }}>Summary Language</div>
                  <select value={modalSetting?.SummaryLanguage ?? 'EN'} onChange={e => setModalSetting({...modalSetting, SummaryLanguage: e.target.value})} style={{ width: '100%' }}>
                    <option value="EN">EN</option>
                    <option value="ZH">ZH</option>
                  </select>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={modalPersist} onChange={e => setModalPersist(e.target.checked)} /> Persist results to server
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="checkbox" checked={modalForce} onChange={e => setModalForce(e.target.checked)} /> Force (allow duplicates)
                </label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="checkbox" checked={modalDebug} onChange={e => setModalDebug(e.target.checked)} /> Debug (include samples)
                </label>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  <button onClick={() => setSettingModalOpen(false)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e6e6e6', background: 'white' }}>Cancel</button>
                  <button onClick={async () => {
                    try {
                      await triggerFetch(modalPersist, modalSetting, modalSelectedSourceIds, modalDebug, modalForce)
                    } catch (e) { /* triggerFetch handles errors */ }
                    setSettingModalOpen(false)
                  }} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#5b46ff', color: 'white' }}>{running ? 'Running...' : 'Fetch'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div>
          <div style={{ background: 'white', padding: 18, borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.06)', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Fetch Success/Error Rate</div>
            <div style={{ height: 180, background: '#f7f7f7', borderRadius: 8 }} />
          </div>

          <div style={{ background: 'white', padding: 18, borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Recently Fetched Articles</div>
              {articles.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
                      <th style={{ padding: 12 }}>Source</th>
                      <th style={{ padding: 12 }}>Title</th>
                      <th style={{ padding: 12 }}>Fetch Time</th>
                      <th style={{ padding: 12 }}>Status</th>
                      <th style={{ padding: 12 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {articles.map((a, i) => (
                      <tr key={a.id ?? i} style={{ borderBottom: '1px solid #f2f2f2' }}>
                        <td style={{ padding: 12 }}>{a.sourceName ?? (sources.find(s=>s.SourceId===a.sourceId)?.Name) ?? '-'}</td>
                        <td style={{ padding: 12, color: '#111' }}>{a.title ?? a.snippet ?? '-'}</td>
                        <td style={{ padding: 12 }}>{formatDate(a.fetchedAt)}</td>
                        <td style={{ padding: 12 }}><span style={{ background: '#e6ffed', color: '#1e7a3a', padding: '4px 8px', borderRadius: 12 }}>Success</span></td>
                        <td style={{ padding: 12 }}>
                          {(() => {
                            // Prefer normalized url, otherwise try to discover any URL inside raw article object
                            let found = a.url ?? null
                            if (!found && a.raw) {
                              try { found = findUrlInObject(a.raw) } catch (e) { found = null }
                            }
                            if (!found) return '-'

                            // normalize common missing-protocol cases
                            let href = String(found)
                            if (href.startsWith('//')) href = window.location.protocol + href
                            else if (/^www\./i.test(href)) href = 'https://' + href
                            else if (!/^https?:\/\//i.test(href) && href.includes('.') && !href.includes(' ')) href = 'https://' + href

                            const icon = (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ color: '#2b6cb0' }}>
                                <path d="M14 3H21V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M21 21H3V3H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )

                            const short = href.length > 60 ? href.slice(0, 60) + '...' : href
                            return (
                              <button
                                type="button"
                                title="Open article"
                                aria-label={`Open article ${href}`}
                                onClick={(e) => { e.stopPropagation(); try { window.open(href, '_blank') } catch (err) { /* ignore */ } }}
                                onMouseDown={(e) => { /* prevent focus ring on click */ e.preventDefault() }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  color: '#2b6cb0',
                                  background: 'transparent',
                                  border: 'none',
                                  padding: 0,
                                  cursor: 'pointer',
                                  outline: 'none',
                                  boxShadow: 'none',
                                  WebkitTapHighlightColor: 'transparent'
                                }}
                              >
                                {icon}
                              </button>
                            )
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                (loading) ? <div>Loading...</div> : (
                  <div style={{ padding: 18, color: '#666' }}>No recent articles.</div>
                )
              )}
          </div>
        </div>

        <div>
          <div style={{ background: 'white', padding: 18, borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.06)', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Fetch Log</div>
            <div style={{ color: '#666' }}>No logs yet.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
