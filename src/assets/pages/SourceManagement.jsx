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

export default function SourceManagement() {
  const [sources, setSources] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ Name: '', BaseUrl: '', Type: 'rss', Language: 'EN', CrawlFrequency: 60, IsActive: true, Notes: '', Ownership: '', RegionLevel: '', Description: '' })
  const [isOpen, setIsOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [articles, setArticles] = useState([])
  const [lastFetchRaw, setLastFetchRaw] = useState(null)
  const onOpen = () => { setIsOpen(true); setCreating(true); setForm({ Name: '', BaseUrl: '', Type: 'rss', Language: 'EN', CrawlFrequency: 60, IsActive: true, Notes: '', Ownership: '', RegionLevel: '', Description: '' }) }
  const onClose = () => setIsOpen(false)

  const showToast = (opts) => {
    try { alert((opts && opts.title ? opts.title : '') + (opts && opts.description ? '\n' + opts.description : '')) } catch (e) { console.log('toast', opts) }
  }

  const inputStyle = { padding: '8px 10px', border: '1px solid #dcdcdc', borderRadius: 6, width: '100%' }
  const selectStyle = { padding: '8px 10px', border: '1px solid #dcdcdc', borderRadius: 6 }
  const textareaStyle = { padding: '8px 10px', border: '1px solid #dcdcdc', borderRadius: 6, width: '100%' }

  const role = getRoleFromToken(localStorage.getItem('token'))

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/api/sources')
      const normalized = (Array.isArray(data) ? data : []).map(item => ({
        SourceId: item.SourceId ?? item.sourceId,
        Name: item.Name ?? item.name,
        BaseUrl: item.BaseUrl ?? item.baseUrl,
        Type: item.Type ?? item.type,
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
    } catch (e) { showToast({ title: 'Failed to load sources', description: e.message }) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const toggleSel = (id) => {
    const s = new Set(selected)
    if (s.has(id)) s.delete(id); else s.add(id)
    setSelected(s)
  }

  const normalizeItem = (item) => ({
    SourceId: item.SourceId ?? item.sourceId,
    Name: item.Name ?? item.name,
    BaseUrl: item.BaseUrl ?? item.baseUrl,
    Type: item.Type ?? item.type,
    Language: item.Language ?? item.language,
    CrawlFrequency: item.CrawlFrequency ?? item.crawlFrequency,
    LastCrawledAt: item.LastCrawledAt ?? item.lastCrawledAt,
    Ownership: item.Ownership ?? item.ownership,
    RegionLevel: item.RegionLevel ?? item.regionLevel,
    IsActive: item.IsActive ?? item.isActive,
    Description: item.Description ?? item.description,
    Notes: item.Notes ?? item.notes
  })

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

  const handleCreate = async () => {
    const required = ['Name', 'BaseUrl', 'Type', 'Language', 'CrawlFrequency', 'Ownership', 'RegionLevel', 'Description']
    for (const k of required) { if (!form[k] && form[k] !== 0) { showToast({ title: 'Missing field', description: `${k} is required` }); return } }
    if (Number.isNaN(Number(form.CrawlFrequency)) || Number(form.CrawlFrequency) <= 0) { showToast({ title: 'Invalid frequency', description: 'CrawlFrequency must be a positive number' }); return }
    try {
      const payload = { Name: form.Name, BaseUrl: form.BaseUrl, Type: form.Type, Language: form.Language, CrawlFrequency: Number(form.CrawlFrequency), IsActive: form.IsActive, Notes: form.Notes, Description: form.Description, Ownership: form.Ownership, RegionLevel: form.RegionLevel }
      const created = await apiFetch('/api/sources', { method: 'POST', body: JSON.stringify(payload) })
      showToast({ title: 'Created', description: created && (created.Name ?? created.name) ? (created.Name ?? created.name) : 'Source created' })
      onClose()
      if (created) setSources(prev => [normalizeItem(created), ...prev])
      setSelected(new Set())
    } catch (e) { showToast({ title: 'Create failed', description: e.message }) }
  }

  const openEdit = (src) => {
    setForm({
      SourceId: src.SourceId,
      Name: src.Name || '',
      BaseUrl: src.BaseUrl || '',
      Type: src.Type || 'rss',
      Language: src.Language || 'EN',
      CrawlFrequency: src.CrawlFrequency ?? 60,
      IsActive: src.IsActive ?? true,
      Notes: src.Notes || '',
      Ownership: src.Ownership || '',
      RegionLevel: src.RegionLevel || '',
      Description: src.Description || ''
    })
    setCreating(false)
    setIsOpen(true)
  }

  const handleUpdate = async () => {
    const required = ['Name', 'BaseUrl', 'Type', 'Language', 'CrawlFrequency', 'Ownership', 'RegionLevel', 'Description']
    for (const k of required) { if (!form[k] && form[k] !== 0) { showToast({ title: 'Missing field', description: `${k} is required` }); return } }
    if (Number.isNaN(Number(form.CrawlFrequency)) || Number(form.CrawlFrequency) <= 0) { showToast({ title: 'Invalid frequency', description: 'CrawlFrequency must be a positive number' }); return }
    try {
      const payload = { SourceId: form.SourceId, Name: form.Name, BaseUrl: form.BaseUrl, Type: form.Type, Language: form.Language, CrawlFrequency: Number(form.CrawlFrequency), IsActive: form.IsActive, Notes: form.Notes, Description: form.Description, Ownership: form.Ownership, RegionLevel: form.RegionLevel }
      const updated = await apiFetch(`/api/sources/${form.SourceId}`, { method: 'PUT', body: JSON.stringify(payload) })
      showToast({ title: 'Updated', description: updated && (updated.Name ?? updated.name) ? (updated.Name ?? updated.name) : 'Source updated' })
      setIsOpen(false)
      if (updated) setSources(prev => prev.map(s => (s.SourceId === (updated.SourceId ?? updated.sourceId) ? normalizeItem(updated) : s)))
    } catch (e) { showToast({ title: 'Update failed', description: e.message }) }
  }

  const handleDeactivate = async (id) => {
    if (!confirm('Mark this source inactive?')) return
    try {
      await apiFetch(`/api/sources/${id}`, { method: 'DELETE' })
      showToast({ title: 'Source marked inactive' })
      setSources(prev => prev.map(s => s.SourceId === id ? { ...s, IsActive: false } : s))
    } catch (e) { showToast({ title: 'Deactivate failed', description: e.message }) }
  }

  const handleActivate = async (id) => {
    if (!confirm('Activate this source?')) return
    try {
      await apiFetch(`/api/sources/${id}`, { method: 'PUT', body: JSON.stringify({ IsActive: true }) })
      showToast({ title: 'Source activated' })
      setSources(prev => prev.map(s => s.SourceId === id ? { ...s, IsActive: true } : s))
    } catch (e) { showToast({ title: 'Activate failed', description: e.message }) }
  }

  const handlePermanentDelete = async (id) => {
    if (!confirm('Permanently delete this source? This cannot be undone.')) return
    try {
      await apiFetch(`/api/sources/${id}/permanent`, { method: 'DELETE' })
      showToast({ title: 'Source permanently deleted' })
      setSources(prev => prev.filter(s => s.SourceId !== id))
    } catch (e) { showToast({ title: 'Permanent delete failed', description: e.message }) }
  }

  const handleFetchSelected = async (persist = false) => {
    if (selected.size === 0) { showToast({ title: 'No selection' }); return }
    try {
      const dto = { SourceIds: Array.from(selected), Persist: persist }
      const res = await apiFetch('/api/sources/fetch', { method: 'POST', body: JSON.stringify(dto) })
      setLastFetchRaw(res)
      const a = extractArticlesFromResponse(res)
      if (a && a.length > 0) {
        setArticles(a.map(normalizeArticle))
        showToast({ title: 'Fetch completed', description: `Fetched ${a.length} articles` })
      } else {
        // No articles returned
        showToast({ title: 'No articles returned', description: 'The fetch completed but returned no articles.' })
        load()
      }
    } catch (e) { showToast({ title: 'Fetch failed', description: e.message }) }
  }

  const fetchForSource = async (sourceId, persist = true) => {
    try {
      const res = await apiFetch('/api/sources/fetch', { method: 'POST', body: JSON.stringify({ SourceIds: [sourceId], Persist: persist }) })
      setLastFetchRaw(res)
      const a = extractArticlesFromResponse(res)
      if (a && a.length > 0) {
        setArticles(a.map(normalizeArticle))
        showToast({ title: 'Fetch finished', description: `Fetched ${a.length} articles` })
      } else {
        // No articles returned for this source
        showToast({ title: 'No articles returned', description: 'The fetch completed but returned no articles for this source.' })
        load()
      }
    } catch (e) { showToast({ title: 'Fetch failed', description: e.message }) }
  }

  const normalizeArticle = (a) => ({
    id: a.Id ?? a.id ?? a.ArticleId ?? a.articleId,
    title: a.Title ?? a.title ?? a.headline ?? a.TitleSnippet ?? a.titleSnippet,
    snippet: a.Snippet ?? a.snippet ?? a.Summary ?? a.summary ?? '',
    url: a.Url ?? a.url ?? a.Link ?? a.link,
    sourceId: a.SourceId ?? a.sourceId ?? a.Source?.SourceId ?? a.source?.id,
    sourceName: a.SourceName ?? a.sourceName ?? (a.Source && (a.Source.Name || a.Source.name)) ?? undefined,
    fetchedAt: a.FetchedAt ?? a.fetchedAt ?? a.fetchTime ?? a.publishedAt ?? a.published_at ?? a.published
  })

  const extractArticlesFromResponse = (res) => {
    if (!res) return []
    if (Array.isArray(res)) {
      if (res.length > 0 && (res[0].Title || res[0].title || res[0].headline || res[0].Url || res[0].ArticleId)) return res
      const flattened = []
      for (const item of res) {
        if (item && Array.isArray(item.Articles) && item.Articles.length) flattened.push(...item.Articles)
        else if (item && Array.isArray(item.Items) && item.Items.length) flattened.push(...item.Items)
        else if (item && Array.isArray(item.results) && item.results.length) flattened.push(...item.results)
      }
      if (flattened.length) return flattened
      return []
    }
    if (typeof res === 'object') {
      if (Array.isArray(res.Articles) && res.Articles.length) return res.Articles
      if (Array.isArray(res.items) && res.items.length) return res.items
      if (Array.isArray(res.results) && res.results.length) return res.results
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
      if (res.length > 0 && (res[0].fetched !== undefined || res[0].fetched !== undefined)) return res
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

  if (role !== 'admin') return <div style={{ padding: 24 }}><div style={{ fontWeight: 600 }}>You do not have permission to view this page.</div></div>

  return (
    <div style={{ padding: 20, background: '#fbf4f2', minHeight: '80vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h2 style={{ margin: 0 }}>Source Management</h2>
          <button onClick={() => { onOpen(); setCreating(true) }} style={{ background: '#c92b2b', color: 'white', padding: '8px 14px', borderRadius: 6, border: 'none' }}>+ Add New Source</button>
          <input placeholder="Search sources..." style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #e6dede', minWidth: 260 }} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e6e6e6', background: 'white' }}>Import CSV</button>
          <button style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e6e6e6', background: 'white' }}>Export CSV</button>
        </div>
      </div>

      {articles.length > 0 && (
        <div style={{ marginTop: 18, background: 'white', padding: 18, borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Recently Fetched Articles</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
                <th style={{ padding: 12 }}>Source</th>
                <th style={{ padding: 12 }}>Title</th>
                <th style={{ padding: 12 }}>Fetch Time</th>
                <th style={{ padding: 12 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a, i) => (
                <tr key={a.id ?? i} style={{ borderBottom: '1px solid #f2f2f2' }}>
                  <td style={{ padding: 12 }}>{a.sourceName ?? (sources.find(s=>s.SourceId===a.sourceId)?.Name) ?? '-'}</td>
                  <td style={{ padding: 12, color: '#111' }}>{a.title ?? a.snippet ?? '-'}</td>
                  <td style={{ padding: 12 }}>{formatDate(a.fetchedAt)}</td>
                  <td style={{ padding: 12 }}>{a.url ? <a href={a.url} target="_blank" rel="noreferrer">View</a> : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {lastFetchRaw && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: 'pointer' }}>Show raw fetch response (debug)</summary>
              <pre style={{ maxHeight: 300, overflow: 'auto', background: '#f7f7f7', padding: 8 }}>{JSON.stringify(lastFetchRaw, null, 2)}</pre>
            </details>
          )}
        </div>
      )}
      {articles.length === 0 && lastFetchRaw && (() => {
        const sums = extractSummaryFromResponse(lastFetchRaw)
        if (!sums || sums.length === 0) return null
        return (
          <div style={{ marginTop: 18, background: 'white', padding: 18, borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Fetch Results</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
                  <th style={{ padding: 12 }}>Source</th>
                  <th style={{ padding: 12 }}>Fetched</th>
                  <th style={{ padding: 12 }}>Added</th>
                </tr>
              </thead>
              <tbody>
                {sums.map((r, i) => (
                  <tr key={r.sourceId ?? r.SourceId ?? i} style={{ borderBottom: '1px solid #f2f2f2' }}>
                    <td style={{ padding: 12 }}>{r.name ?? r.Name ?? (sources.find(s=>s.SourceId===r.sourceId)?.Name) ?? '-'}</td>
                    <td style={{ padding: 12 }}>{r.fetched ?? r.Fetched ?? 0}</td>
                    <td style={{ padding: 12 }}>{r.added ?? r.Added ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: 'pointer' }}>Show raw fetch response (debug)</summary>
              <pre style={{ maxHeight: 300, overflow: 'auto', background: '#f7f7f7', padding: 8 }}>{JSON.stringify(lastFetchRaw, null, 2)}</pre>
            </details>
          </div>
        )
      })()}

      <div style={{ background: 'white', padding: 18, borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
        {loading ? <div>Loading...</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
                  <th style={{ padding: '12px' }}><input type="checkbox" checked={selected.size === sources.length && sources.length>0} onChange={(e) => { if (e.target.checked) setSelected(new Set(sources.map(s => s.SourceId))); else setSelected(new Set()) }} /></th>
                  <th style={{ padding: '12px' }}>Name</th>
                  <th style={{ padding: '12px' }}>Type</th>
                  <th style={{ padding: '12px' }}>Level</th>
                  <th style={{ padding: '12px' }}>Title</th>
                  <th style={{ padding: '12px' }}>Status</th>
                  <th style={{ padding: '12px' }}>Last Fetch Time</th>
                  <th style={{ padding: '12px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s, idx) => (
                  <tr key={s.SourceId ?? `source-${idx}`} style={{ borderBottom: '1px solid #f7f7f7', background: idx % 2 === 0 ? '#fff' : '#fbfbfb' }}>
                    <td style={{ padding: '14px' }}><input type="checkbox" checked={selected.has(s.SourceId)} onChange={() => toggleSel(s.SourceId)} /></td>
                    <td style={{ padding: '14px', fontWeight: 600 }}>{s.Name}</td>
                    <td style={{ padding: '14px' }}>{s.Type}</td>
                    <td style={{ padding: '14px' }}>{s.RegionLevel}</td>
                    <td style={{ padding: '14px', color: '#666' }}>{s.Description}</td>
                    <td style={{ padding: '14px' }}><span style={{ padding: '6px 10px', borderRadius: 12, background: s.IsActive ? '#e6fcf0' : '#fff4f6', color: s.IsActive ? '#1e7a3a' : '#c43d3d', fontWeight: 600, fontSize: 12 }}>{s.IsActive ? 'Active' : 'Inactive'}</span></td>
                    <td style={{ padding: '14px' }}>{formatDate(s.LastCrawledAt)}</td>
                    <td style={{ padding: '14px' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button title="Copy URL" onClick={() => { navigator.clipboard.writeText(s.BaseUrl); showToast({ title: 'Copied URL' }) }} style={{ border: 'none', background: 'transparent', color: '#2b6cb0' }}>🔗</button>
                        <button title="Edit source" onClick={() => openEdit(s)} style={{ border: 'none', background: 'transparent', color: '#2b6cb0' }}>✏️</button>
                        <button title="Fetch now" onClick={() => fetchForSource(s.SourceId)} style={{ border: 'none', background: 'transparent', color: '#2b6cb0' }}>⚡ Fetch</button>
                        {s.IsActive ? (
                          <button title="Deactivate (soft)" onClick={() => handleDeactivate(s.SourceId)} style={{ border: 'none', background: 'transparent', color: '#c00' }}>Deactivate</button>
                        ) : (
                          <>
                            <button title="Activate" onClick={() => handleActivate(s.SourceId)} style={{ border: 'none', background: 'transparent', color: '#2b6cb0' }}>Activate</button>
                            <button title="Delete permanently" onClick={() => handlePermanentDelete(s.SourceId)} style={{ border: 'none', background: 'transparent', color: '#c00' }}>Delete</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, marginTop: 18 }}>
        <div>
          <div style={{ background: 'white', padding: 14, borderRadius: 12, boxShadow: '0 6px 20px rgba(0,0,0,0.04)', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Quick Statistics</div>
            <div style={{ display: 'flex', gap: 24 }}>
              <div>
                <div style={{ color: '#888' }}>Total Sources</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{sources.length}</div>
              </div>
              <div>
                <div style={{ color: '#888' }}>Active Sources</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'green' }}>{sources.filter(s=>s.IsActive).length}</div>
              </div>
              <div>
                <div style={{ color: '#888' }}>Inactive Sources</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'red' }}>{sources.filter(s=>!s.IsActive).length}</div>
              </div>
            </div>
          </div>
          <div style={{ background: 'white', padding: 14, borderRadius: 12, boxShadow: '0 6px 20px rgba(0,0,0,0.04)' }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Recent Changes</div>
            <div style={{ color: '#666', fontSize: 13 }}>No recent changes recorded.</div>
          </div>
        </div>
        <div>
          <div style={{ background: 'white', padding: 14, borderRadius: 12, boxShadow: '0 6px 20px rgba(0,0,0,0.04)' }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Notifications</div>
            <div style={{ color: '#666', fontSize: 13 }}>API base: {API_BASE || '(same-origin)'}</div>
            <div style={{ color: '#666', fontSize: 13 }}>Token: {localStorage.getItem('token') ? 'present' : 'missing'}</div>
          </div>
        </div>
      </div>

      {isOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: 'white', width: '90%', maxWidth: 680, borderRadius: 8, padding: 16, boxShadow: '0 6px 20px rgba(0,0,0,0.12)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{creating ? 'Create Source' : 'Edit Source'}</div>
              <button onClick={onClose}>Close</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input style={inputStyle} required placeholder="Name *" value={form.Name} onChange={e => setForm({ ...form, Name: e.target.value })} />
              <input style={inputStyle} required placeholder="BaseUrl *" value={form.BaseUrl} onChange={e => setForm({ ...form, BaseUrl: e.target.value })} />
              <div style={{ display: 'flex', gap: 8 }}>
                <select style={selectStyle} required value={form.Type} onChange={e => setForm({ ...form, Type: e.target.value })}><option value="rss">RSS</option><option value="api">API</option><option value="html">HTML</option></select>
                <select style={selectStyle} required value={form.Language} onChange={e => setForm({ ...form, Language: e.target.value })}><option value="EN">EN</option><option value="ZH">ZH</option></select>
              </div>
              <input style={inputStyle} required type="number" placeholder="Crawl Frequency (minutes) *" value={form.CrawlFrequency} onChange={e => setForm({ ...form, CrawlFrequency: e.target.value })} />
              <div style={{ display: 'flex', gap: 8 }}>
                <select style={selectStyle} required value={form.Ownership} onChange={e => setForm({ ...form, Ownership: e.target.value })}>
                  <option value="" disabled>Ownership *</option>
                  <option value="StateRun">StateRun</option>
                  <option value="Independent">Independent</option>
                  <option value="SemiIndependent">SemiIndependent</option>
                  <option value="Private">Private</option>
                </select>
                <select style={selectStyle} required value={form.RegionLevel} onChange={e => setForm({ ...form, RegionLevel: e.target.value })}>
                  <option value="" disabled>Region Level *</option>
                  <option value="National">National</option>
                  <option value="Provincial">Provincial</option>
                </select>
              </div>
              <input style={inputStyle} required placeholder="Short Description *" value={form.Description} onChange={e => setForm({ ...form, Description: e.target.value })} />
              <textarea style={{ ...textareaStyle, minHeight: 80 }} placeholder="Notes / Technical details (optional)" value={form.Notes} onChange={e => setForm({ ...form, Notes: e.target.value })} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={!!form.IsActive} onChange={e => setForm({ ...form, IsActive: e.target.checked })} /> Active</label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button onClick={onClose}>Cancel</button>
                {creating ? (
                  <button onClick={() => { handleCreate(); }} style={{ background: '#2f8b40', color: 'white', padding: '6px 12px', borderRadius: 6 }}>Create</button>
                ) : (
                  <button onClick={() => { handleUpdate(); }} style={{ background: '#2563eb', color: 'white', padding: '6px 12px', borderRadius: 6 }}>Save</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
