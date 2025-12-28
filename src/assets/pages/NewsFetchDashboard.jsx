import React, { useEffect, useState } from 'react'
import { getRoleFromToken } from '../../utils/auth'

const API_BASE = import.meta.env.VITE_API_BASE || ''

const apiFetch = async (path, opts = {}) => {
  const token = localStorage.getItem('token')
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {})
  if (token) headers['Authorization'] = `Bearer ${token}`
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, Object.assign({ headers }, opts))
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(txt || res.statusText)
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
  const showToast = (opts) => {
    try {
      alert((opts && opts.title ? opts.title : '') + (opts && opts.description ? '\n' + opts.description : ''))
    } catch (e) { console.log('toast', opts) }
  }

  useEffect(() => { load(); loadRecentArticles() }, [])

  // Try to load persisted recent articles from the backend, fall back to localStorage
  const loadRecentArticles = async () => {
    try {
      const res = await apiFetch('/api/newsarticles/recent')
      const a = extractArticlesFromResponse(res)
      if (a && a.length > 0) {
        const normalized = a.map(normalizeArticle)
        console.debug('loadRecentArticles - normalized recent articles:', normalized)
        setArticles(normalized)
        try { localStorage.setItem('recentArticles', JSON.stringify(normalized)) } catch (e) {}
        return
      }
    } catch (e) {
      // ignore - endpoint may not exist
    }

    // fallback: load from localStorage if available
    try {
      const stored = localStorage.getItem('recentArticles')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) setArticles(parsed)
      }
    } catch (e) { /* ignore parse errors */ }
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

  const triggerFetch = async (persist = true) => {
    if (running) return
    setRunning(true)
    try {
      const ids = sources.filter(x=>x.IsActive).map(x=>x.SourceId)
      const res = await apiFetch('/api/sources/fetch', { method: 'POST', body: JSON.stringify({ SourceIds: ids, Persist: persist }) })
      setLastFetchRaw(res)
      const a = extractArticlesFromResponse(res)
      if (a && a.length > 0) {
        const normalized = a.map(normalizeArticle)
        console.debug('triggerFetch - normalized fetched articles:', normalized)
        setArticles(normalized)
        try { localStorage.setItem('recentArticles', JSON.stringify(normalized)) } catch (e) {}
        // attempt to reload persisted articles from server (if backend saved them)
        if (persist) await loadRecentArticles()
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
    id: a.Id ?? a.id ?? a.ArticleId ?? a.articleId ?? a.NewsArticleId ?? a.newsArticleId ?? a.NewsArticleID,
    title: a.Title ?? a.title ?? a.headline ?? a.TitleSnippet ?? a.titleSnippet,
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
      // array of article-like objects
      if (res.length > 0 && (res[0].Title || res[0].title || res[0].headline || res[0].Url || res[0].ArticleId)) return res
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
      const res = await apiFetch('/api/sources/fetch', { method: 'POST', body: JSON.stringify({ SourceIds: [sourceId], Persist: persist }) })
      setLastFetchRaw(res)
      const a = extractArticlesFromResponse(res)
      if (a && a.length > 0) {
        const normalized = a.map(normalizeArticle)
        console.debug('fetchForSource - normalized fetched articles:', normalized)
        setArticles(normalized)
        try { localStorage.setItem('recentArticles', JSON.stringify(normalized)) } catch (e) {}
        if (persist) await loadRecentArticles()
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

  const total = sources.length
  const active = sources.filter(s=>s.IsActive).length
  const inactive = total - active

  const role = getRoleFromToken(localStorage.getItem('token'))

  if (role !== 'admin') return <div style={{ padding: 24 }}><div style={{ fontWeight: 600 }}>You do not have permission to view this page.</div></div>
  return (
    <div style={{ padding: 20, background: '#fbf4f2', minHeight: '80vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>News Fetch Dashboard</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e6e6e6', background: 'white' }}>Create New Fetch Job</button>
          <button style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e6e6e6', background: 'white' }}>Update Crawler Settings</button>
          <button style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#c92b2b', color: 'white' }}>Export Logs</button>
        </div>
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
            <button onClick={() => triggerFetch(true)} disabled={running} style={{ background: '#5b46ff', color: 'white', padding: '8px 14px', borderRadius: 8, border: 'none' }}>{running ? 'Running...' : 'Trigger Fetch Now'}</button>
          </div>
        </div>
        <div style={{ background: 'white', padding: 16, borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
          <div style={{ color: '#666', fontSize: 13 }}>Recent Fetch Errors</div>
          <div style={{ marginTop: 8, color: '#c92b2b', fontSize: 13 }}>No recent errors.</div>
        </div>
      </div>

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
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
                        <th style={{ padding: 12 }}>Source</th>
                        <th style={{ padding: 12 }}>Title Snippet</th>
                        <th style={{ padding: 12 }}>Fetch Time</th>
                        <th style={{ padding: 12 }}>Status</th>
                        <th style={{ padding: 12 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sources.slice(0,6).map((s, i) => (
                        <tr key={s.SourceId ?? i} style={{ borderBottom: '1px solid #f2f2f2' }}>
                          <td style={{ padding: 12 }}>{s.Name}</td>
                          <td style={{ padding: 12, color: '#666' }}>{s.Description ? (s.Description.length>60 ? s.Description.slice(0,60)+'...' : s.Description) : '-'}</td>
                          <td style={{ padding: 12 }}>{formatDate(s.LastCrawledAt)}</td>
                          <td style={{ padding: 12 }}>{Math.random() > 0.8 ? <span style={{ background: '#ffecec', color: '#c43d3d', padding: '4px 8px', borderRadius: 12 }}>Error</span> : <span style={{ background: '#e6ffed', color: '#1e7a3a', padding: '4px 8px', borderRadius: 12 }}>Success</span>}</td>
                          <td style={{ padding: 12 }}>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button onClick={() => fetchForSource(s.SourceId)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #e6e6e6', background: 'white' }}>Fetch Now</button>
                              <button onClick={() => fetchForSource(s.SourceId, false)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #e6e6e6', background: 'white' }}>Fetch (no persist)</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
