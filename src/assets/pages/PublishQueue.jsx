import React, { useEffect, useState, useRef } from 'react'
import { getPublishDraft, batchPublish, deleteArticle } from '../../api/articles'
import { useNavigate, useLocation } from 'react-router-dom'

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
  tableCard: { background: palette.card, padding: 18, borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.06)', width: '100%', boxSizing: 'border-box', margin: 0 },
  controls: { display: 'flex', gap: 8, alignItems: 'center' },
  input: { padding: '6px 10px', borderRadius: 6, border: '1px solid #e6e6e6', minWidth: 140, maxWidth: 220 },
  sourceCell: { padding: 10, color: '#333', fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px', verticalAlign: 'middle' },
  titleCell: { padding: 10, color: '#111', fontSize: 16, lineHeight: '1.35', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', verticalAlign: 'middle' },
  dateCell: { padding: 10, fontSize: 13, verticalAlign: 'middle'},
  statusCell: { padding: 8 },
  actionsCell: { padding: 8 }
}

export default function PublishQueue() {
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [queue, setQueue] = useState([])
  const [items, setItems] = useState([]) // { id, data, error }
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize] = useState(5)
  const [sortBy, setSortBy] = useState('date') // date | industry | topics
  const [sortDir, setSortDir] = useState('desc') // desc | asc
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const sortControlRef = useRef(null)
  const [toast, setToast] = useState(null)
  const navigate = useNavigate()

  // normalize draft/article fields to prefer EN variants and handle casing inconsistencies
  const normalizeDraft = (d) => {
    if (!d || typeof d !== 'object') return d
    const out = { ...d }
    out.TitleEN = out.TitleEN ?? out.titleEN ?? out.titleEn ?? out.Title ?? out.title ?? out.TitleZH ?? out.titleZH ?? out.title
    out.FullContentEN = out.FullContentEN ?? out.fullContentEN ?? out.fullContentEn ?? out.FullContent ?? out.fullContent ?? out.FullContentZH ?? out.fullContentZH ?? out.body
    out.TitleEN = typeof out.TitleEN === 'string' ? out.TitleEN : (out.TitleEN ? String(out.TitleEN) : out.TitleEN)
    out.FullContentEN = typeof out.FullContentEN === 'string' ? out.FullContentEN : (out.FullContentEN ? String(out.FullContentEN) : out.FullContentEN)
    return out
  }

  const normalizeArticle = (a) => {
    if (!a || typeof a !== 'object') return a
    const out = { ...a }
    out.TitleEN = out.TitleEN ?? out.titleEN ?? out.titleEn ?? out.Title ?? out.title ?? out.TitleZH ?? out.titleZH
    out.HeroImageUrl = out.HeroImageUrl ?? out.heroImageUrl ?? out.HeroImage ?? out.heroImage
    return out
  }

  const normalizeData = (data) => {
    if (!data || typeof data !== 'object') return data
    const cloned = { ...data }
    if (cloned.draft) cloned.draft = normalizeDraft(cloned.draft)
    if (cloned.article) cloned.article = normalizeArticle(cloned.article)
    return cloned
  }

  // track previous counts so we can auto-switch tabs when items move states
  const prevCountsRef = useRef({ scheduled: 0, live: 0, drafted: 0 })

  const [activeTab, setActiveTab] = useState('ready') // ready, drafted, scheduled, live
  const location = useLocation()

  useEffect(() => {
    // allow opening a specific tab via `?tab=drafted|scheduled|live|ready`
    try {
      const params = new URLSearchParams(location.search)
      const t = params.get('tab')
      if (t && ['ready', 'drafted', 'scheduled', 'live'].includes(t)) setActiveTab(t)
    } catch (e) {}
    loadQueue()
  }, [])

  // refresh queue when window/tab regains focus or when other tabs modify localStorage
  useEffect(() => {
    const onFocus = () => {
      loadQueue()
    }
    const onStorage = (e) => {
      if (!e) return
      if (e.key === 'publishQueue') loadQueue()
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  // watch items changes and auto-switch tab when counts increase (e.g., user scheduled or published an item)
  useEffect(() => {
    try {
      const counts = {
        scheduled: items.filter(it => isScheduled(it)).length,
        live: items.filter(it => isLive(it)).length,
        drafted: items.filter(it => isDrafted(it)).length
      }
      const prev = prevCountsRef.current || { scheduled: 0, live: 0, drafted: 0 }
      // if user was on 'ready' and something moved to scheduled/live/drafted, switch to that tab
      if (activeTab === 'ready') {
        if (counts.scheduled > prev.scheduled) setActiveTab('scheduled')
        else if (counts.live > prev.live) setActiveTab('live')
        else if (counts.drafted > prev.drafted) setActiveTab('drafted')
      }
      prevCountsRef.current = counts
    } catch (e) {
      // noop
    }
  }, [items])

  // close sort menu when clicking outside
  useEffect(() => {
    function onDocClick(e) {
      if (sortControlRef.current && !sortControlRef.current.contains(e.target)) {
        setSortMenuOpen(false)
      }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  const loadQueue = async () => {
    const raw = JSON.parse(localStorage.getItem('publishQueue') || '[]')
    const entries = Array.isArray(raw) ? raw : []
    // queue holds numeric ids for quick checks
    const qids = entries.map(e => (typeof e === 'number' ? Number(e) : Number(e.id ?? e.NewsArticleId ?? e.article?.NewsArticleId ?? e.article?.id))).filter(x => !Number.isNaN(x))
    setQueue(qids)
    if (!entries || entries.length === 0) return setItems([])
    setLoading(true)
    try {
      const fetched = []
      for (const entry of entries) {
        try {
          // derive numeric id and any local payload
          const idRaw = entry && (entry.id ?? entry.NewsArticleId ?? entry.article?.NewsArticleId ?? entry.article?.id) ? (entry.id ?? entry) : entry
          const id = Number(idRaw)
          const localPayload = (typeof entry === 'object' && entry) ? (entry.data ? entry.data : (entry.article ? { article: entry.article, draft: entry.draft } : null)) : null

          // If we have a local payload, prefer it and skip the server call.
          if (!Number.isNaN(id) && localPayload) {
            fetched.push({ id, data: normalizeData(localPayload) })
            continue
          }

          // If no numeric id, but entry contains article/draft, preserve it.
          if (Number.isNaN(id)) {
            if (typeof entry === 'object' && entry && (entry.article || entry.data)) {
              const lid = Number(entry.id ?? entry.NewsArticleId ?? entry.article?.NewsArticleId ?? entry.article?.id)
              const data = entry.data ? entry.data : { article: entry.article, draft: entry.draft }
              fetched.push({ id: lid || null, data: normalizeData(data) })
              continue
            }
            fetched.push({ id: null, data: null, error: 'invalid entry' })
            continue
          }

          // Attempt server fetch for canonical data
          let res = null
          try { res = await getPublishDraft(id) } catch (e) { res = null }
          const serverData = res ? (res?.data ?? res) : null
          if (!serverData || Object.keys(serverData).length === 0) {
            fetched.push({ id, data: null })
            continue
          }

          // Merge server data (no local payload present)
          const server = serverData || {}
          const mergedData = { ...(server || {}) }
          const serverArticle = mergedData.article || mergedData.Article || {}
          mergedData.article = Object.keys(serverArticle).length ? { ...(serverArticle || {}) } : undefined
          const serverDraft = mergedData.draft || {}
          const mergedDraft = { ...(serverDraft || {}) }
          if (Object.keys(mergedDraft).length > 0) mergedData.draft = mergedDraft
          else delete mergedData.draft

          // If the server data indicates client-queued marker, strip publish flags
          if (mergedData._clientQueued) {
            if (mergedData.article) {
              delete mergedData.article.PublishedAt
              delete mergedData.article.publishedAt
              delete mergedData.article.IsPublished
              delete mergedData.article.isPublished
            }
            if (mergedData.draft) {
              delete mergedData.draft.PublishedAt
              delete mergedData.draft.publishedAt
              delete mergedData.draft.ScheduledAt
              delete mergedData.draft.scheduledAt
              const hasTax = (mergedData.draft.IndustryTagId || (Array.isArray(mergedData.draft.InterestTags) && mergedData.draft.InterestTags.length > 0) || (Array.isArray(mergedData.draft.InterestTagIds) && mergedData.draft.InterestTagIds.length > 0))
              if (!hasTax) delete mergedData.draft
            }
          }

          // prefer any local normalized values if they exist in the original entry
          const localEntry = (typeof entry === 'object' && entry && entry.data) ? normalizeData(entry.data) : null
          const finalData = localEntry || normalizeData(mergedData)
          fetched.push({ id, data: finalData })
        } catch (e) {
          const id = Number(entry && entry.id ? entry.id : entry)
          fetched.push({ id, data: null, error: e.message || String(e) })
        }
      }
      setItems(fetched)
    } finally { setLoading(false) }
  }

  const removeFromQueue = (id) => {
    const raw = JSON.parse(localStorage.getItem('publishQueue') || '[]')
    const entries = Array.isArray(raw) ? raw : []
    const idNum = Number(id)
    const updatedEntries = entries.filter(e => {
      if (typeof e === 'number') return Number(e) !== idNum
      const eid = Number(e.id ?? e.NewsArticleId ?? e.article?.NewsArticleId ?? e.article?.id)
      return eid !== idNum
    })
    localStorage.setItem('publishQueue', JSON.stringify(updatedEntries))
    const updatedIds = updatedEntries.map(e => (typeof e === 'number' ? Number(e) : Number(e.id))).filter(x => !Number.isNaN(x))
    setQueue(updatedIds)
    setItems(prev => prev.filter(it => Number(it.id) !== idNum))
  }

  const filtered = items.filter(it => {
    if (!query) return true
    const q = query.toLowerCase()
    const title = (getDisplayTitle(it) || '').toString().toLowerCase()
    const src = (it.data?.article?.SourceName ?? it.data?.article?.Source?.Name ?? '').toString().toLowerCase()
    return title.includes(q) || src.includes(q)
  })

  // normalize title from draft then article using multiple possible casings
  function getDisplayTitle(it) {
    const a = it.data?.article || {}
    const d = it.data?.draft || {}
    const firstString = (v) => (v === null || typeof v === 'undefined') ? null : (typeof v === 'string' ? v : String(v))
    const candidates = [
      // draft preferred (various casings)
      d?.TitleEN, d?.titleEN, d?.titleEn, d?.Title, d?.title, d?.TitleZH, d?.titleZH,
      // article fallbacks (various casings and nested)
      a?.TitleEN, a?.titleEN, a?.titleEn, a?.Title, a?.title, a?.TitleZH, a?.titleZH,
      it.data?.TitleEN, it.data?.titleEN, it.data?.Title, it.data?.title
    ].map(firstString).filter(Boolean)
    return candidates.length > 0 ? candidates[0].trim() : ''
  }

  // derive tab-specific lists
  const parseDateValid = (raw) => {
    if (!raw) return false
    const t = Date.parse(raw)
    return !Number.isNaN(t) && t > 0
  }
  const hasDraftPublishedAt = (d) => Boolean(d && (parseDateValid(d.PublishedAt) || parseDateValid(d.publishedAt)))
  const hasDraftScheduledAt = (d) => Boolean(d && (parseDateValid(d.ScheduledAt) || parseDateValid(d.scheduledAt)))
  const hasArticlePublished = (a) => {
    if (!a) return false
    if (a.IsPublished === true || a.isPublished === true) return true
    return Boolean(parseDateValid(a.PublishedAt) || parseDateValid(a.publishedAt))
  }

  const draftHasTaxonomy = (d) => {
    if (!d) return false
    const industry = d.IndustryTagId ?? d.IndustryTag?.IndustryTagId ?? d.IndustryTag?.id ?? d.IndustryId ?? d.industryId
    const interests = (d.InterestTags && d.InterestTags.length) || (d.InterestTagIds && d.InterestTagIds.length) || 0
    return Boolean(industry) && Number(interests) > 0
  }

  const articleHasTaxonomy = (a, d) => {
    // prefer draft taxonomy if present, otherwise check article
    if (draftHasTaxonomy(d)) return true
    if (!a) return false
    const industry = a.IndustryTagId ?? a.IndustryTag?.IndustryTagId ?? a.IndustryTag?.id ?? a.IndustryId ?? a.industryId
    const interests = (a.InterestTags && a.InterestTags.length) || (a.InterestTagIds && a.InterestTagIds.length) || 0
    return Boolean(industry) && Number(interests) > 0
  }

  const isDrafted = (it) => {
    try {
      // Drafted only when there is a draft, it's not published/scheduled, AND has taxonomy assigned
      const d = it.data?.draft
      if (!d) return false
      if (hasDraftPublishedAt(d) || hasDraftScheduledAt(d)) return false
      return draftHasTaxonomy(d)
    } catch (e) { /* ignore */ }
    return false
  }
  const isScheduled = (it) => {
    try {
      const d = it.data?.draft
      if (!d) return false
      if (!hasDraftScheduledAt(d)) return false
      return draftHasTaxonomy(d)
    } catch (e) { return false }
  }
  const isLive = (it) => {
    try {
      const a = it.data?.article
      const d = it.data?.draft
      if (!a) return false
      // If there's an active draft that is not published or scheduled,
      // treat the item as Drafted (client prefers draft state) and do
      // not surface it as Live even if the article record has published timestamps.
      if (d && !hasDraftPublishedAt(d) && !hasDraftScheduledAt(d)) return false
      if (!hasArticlePublished(a)) return false
      return articleHasTaxonomy(a, d)
    } catch (e) { return false }
  }
  // Ready = items explicitly queued OR items without a draft and not live.
  const isReady = (it) => {
    try {
      // If explicitly client-queued, consider it ready (consultant action required)
      if (it.data && it.data._clientQueued) return true
      const d = it.data?.draft
      const a = it.data?.article
      // If a draft exists, it's not Ready
      if (d) return false
      // If article is already published, not Ready
      if (hasArticlePublished(a)) return false
      return true
    } catch (e) { return false }
  }

  const tabFiltered = filtered.filter(it => {
    if (activeTab === 'ready') return isReady(it)
    if (activeTab === 'drafted') return isDrafted(it)
    if (activeTab === 'scheduled') return isScheduled(it)
    if (activeTab === 'live') return isLive(it)
    return true
  })

  const totalCounts = {
    total: items.length,
    pending: items.filter(it => isReady(it)).length,
    drafted: items.filter(it => isDrafted(it)).length,
    scheduled: items.filter(it => isScheduled(it)).length,
    live: items.filter(it => isLive(it)).length
  }


  // apply sorting to the currently active tab's filtered list
  const getItemDate = (it) => {
    const a = it.data?.article || {}
    const d = it.data?.draft || {}
    const raw = d?.ScheduledAt ?? a?.PublishedAt ?? a?.publishedAt ?? a?.fetchedAt ?? a?.crawledAt
    const t = raw ? new Date(raw).getTime() : 0
    return Number.isNaN(t) ? 0 : t
  }
  const getItemIndustry = (it) => {
    const d = it.data?.draft || {}
    // prefer readable names, but fall back to stored ids when names are not available
    const name = d?.IndustryTag?.NameEN ?? d?.IndustryTag?.NameZH ?? d?.IndustryTag?.Name ?? d?.IndustryTag?.name
    if (name) return String(name)
    const id = d?.IndustryTagId ?? d?.IndustryTag?.IndustryTagId ?? d?.IndustryTag?.id ?? d?.IndustryId ?? d?.industryId
    return id ? String(id) : ''
  }
  const getItemInterests = (it) => {
    const d = it.data?.draft || {}
    const tags = d?.InterestTags || []
    if (!Array.isArray(tags) || tags.length === 0) return ''.toString()
    // If tags are objects with names, prefer those; if they are ids (number/string), show ids
    const mapped = tags.map(i => {
      if (!i && i !== 0) return null
      if (typeof i === 'object') return i.NameEN ?? i.NameZH ?? i.Name ?? i.name ?? (i.InterestTagId ?? i.id) ?? null
      return String(i)
    }).filter(Boolean)
    return (mapped.join(', ') || '').toString()
  }

  const sorted = [...tabFiltered].sort((x, y) => {
    if (sortBy === 'date') {
      return sortDir === 'desc' ? getItemDate(y) - getItemDate(x) : getItemDate(x) - getItemDate(y)
    }
    if (sortBy === 'industry') {
      return sortDir === 'desc'
        ? getItemIndustry(y).localeCompare(getItemIndustry(x))
        : getItemIndustry(x).localeCompare(getItemIndustry(y))
    }
    return sortDir === 'desc'
      ? getItemInterests(y).localeCompare(getItemInterests(x))
      : getItemInterests(x).localeCompare(getItemInterests(y))
  })

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const pageItems = sorted.slice((page - 1) * pageSize, page * pageSize)

  const toggleSelect = (id) => {
    if (!id) return
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const isAllSelected = (() => {
    if (!pageItems || pageItems.length === 0) return false
    const visibleIds = pageItems.map(it => it.id).filter(Boolean)
    if (visibleIds.length === 0) return false
    return visibleIds.every(id => selectedIds.includes(id))
  })()

  const toggleSelectAll = () => {
    const visibleIds = pageItems.map(it => it.id).filter(Boolean)
    if (visibleIds.length === 0) return
    if (visibleIds.every(id => selectedIds.includes(id))) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)))
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])))
    }
  }

  const showToast = (msg, type = 'success') => {
    setToast({ message: msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const publishSelected = async () => {
    if (!selectedIds || selectedIds.length === 0) { alert('No articles selected'); return }
    if (!window.confirm(`Publish ${selectedIds.length} selected article(s) now?`)) return
    try {
      setLoading(true)
      const res = await batchPublish(selectedIds, null)
      // res expected array of { id, success, error }
      const okIds = Array.isArray(res) ? res.filter(r => r.success).map(r => r.id) : []
      for (const id of okIds) removeFromQueue(id)
      showToast(`Published ${okIds.length} article(s)`, 'success')
      setSelectedIds([])
    } catch (e) {
      showToast('Publish failed: ' + (e.message || e), 'error')
    } finally { setLoading(false) }
  }

  const handleDeleteArticle = async (id) => {
    if (!id) return
    if (!confirm('Delete this article permanently? This cannot be undone.')) return
    try {
      setLoading(true)
      await deleteArticle(id)
      removeFromQueue(id)
      showToast('Deleted', 'success')
    } catch (e) {
      showToast('Delete failed: ' + (e.message || e), 'error')
    } finally { setLoading(false) }
  }

  return (
    <div className="content-full">
      <div className="page-inner">
        <div style={styles.page}>
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: '#888', marginBottom: 8 }}>Publish Queue</h1>
            <p style={{ fontSize: 15, color: '#999', margin: 0 }}>Articles you've pushed to the publish workflow</p>
          </div>

          <div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
              <div style={{ background: 'white', padding: 16, borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.06)', flex: 1 }}>
                <div style={{ color: '#666', fontSize: 13, fontWeight: 700 }}>Total Articles</div>
                <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>{totalCounts.total}</div>
                <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>All workspace articles</div>
              </div>
              <div style={{ background: 'white', padding: 16, borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.06)', flex: 1 }}>
                <div style={{ color: '#1e73d1', fontSize: 13, fontWeight: 700 }}>Pending Publication</div>
                <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, color: '#1e73d1' }}>{totalCounts.pending}</div>
                <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>To be published</div>
              </div>
              <div style={{ background: 'white', padding: 16, borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.06)', flex: 1 }}>
                <div style={{ color: '#666', fontSize: 13, fontWeight: 700 }}>Drafted</div>
                <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>{totalCounts.drafted}</div>
                <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>Actively publishing</div>
              </div>
              <div style={{ background: 'white', padding: 16, borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.06)', flex: 1 }}>
                <div style={{ color: '#c92b2b', fontSize: 13, fontWeight: 700 }}>Scheduled</div>
                <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, color: '#c92b2b' }}>{totalCounts.scheduled}</div>
                <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>All scheduled articles</div>
              </div>
              <div style={{ background: 'white', padding: 16, borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.06)', flex: 1 }}>
                <div style={{ color: '#e07a16', fontSize: 13, fontWeight: 700 }}>Live</div>
                <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, color: '#e07a16' }}>{totalCounts.live}</div>
                <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>All published articles</div>
              </div>
            </div>

            <div style={styles.tableCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div onClick={() => setActiveTab('ready')} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: activeTab === 'ready' ? '3px solid #c92b2b' : '3px solid transparent', fontWeight: 700 }}>Ready to Publish</div>
                  <div onClick={() => setActiveTab('drafted')} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: activeTab === 'drafted' ? '3px solid #c92b2b' : '3px solid transparent', fontWeight: 700 }}>Drafted</div>
                  <div onClick={() => setActiveTab('scheduled')} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: activeTab === 'scheduled' ? '3px solid #c92b2b' : '3px solid transparent', fontWeight: 700 }}>Scheduled</div>
                  <div onClick={() => setActiveTab('live')} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: activeTab === 'live' ? '3px solid #c92b2b' : '3px solid transparent', fontWeight: 700 }}>Live</div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={publishSelected} disabled={!selectedIds || selectedIds.length === 0} style={{ padding: '8px 12px', borderRadius: 8, background: selectedIds && selectedIds.length > 0 ? '#1e73d1' : '#f2f2f2', color: selectedIds && selectedIds.length > 0 ? '#fff' : '#999', border: 'none', cursor: selectedIds && selectedIds.length > 0 ? 'pointer' : 'default' }}>{selectedIds && selectedIds.length > 0 ? `Publish (${selectedIds.length})` : 'Publish Selected'}</button>
                  <input placeholder="Search" value={query} onChange={e => setQuery(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e2e2', width: 260 }} />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div ref={sortControlRef} style={{ position: 'relative' }}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setSortMenuOpen(s => !s)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSortMenuOpen(s => !s) }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e2e2', background: '#fff', cursor: 'pointer', minWidth: 180 }}
                        title="Choose sort target (click) — toggle direction on the triangle"
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#333', flex: 1 }}>
                          {sortBy === 'date' ? 'Published Date' : (sortBy === 'industry' ? 'Industry' : 'Topics Of Interest')}
                        </div>
                        <div onClick={(e) => { e.stopPropagation(); setSortDir(d => d === 'desc' ? 'asc' : 'desc') }} title="Toggle sort direction" style={{ padding: '4px 6px', borderRadius: 6 }}>
                          <span style={{ fontWeight: 900, fontSize: 16, lineHeight: 1, display: 'inline-block' }}>{sortDir === 'desc' ? '▾' : '▴'}</span>
                        </div>
                      </div>

                      {sortMenuOpen && (
                        <div style={{ position: 'absolute', right: 0, marginTop: 8, background: 'white', border: '1px solid #eaeaea', boxShadow: '0 6px 18px rgba(0,0,0,0.08)', borderRadius: 8, overflow: 'hidden', zIndex: 40 }}>
                          <div onClick={() => { setSortBy('date'); setSortMenuOpen(false) }} style={{ padding: '8px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Published Date</div>
                          <div onClick={() => { setSortBy('industry'); setSortMenuOpen(false) }} style={{ padding: '8px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Industry</div>
                          <div onClick={() => { setSortBy('topics'); setSortMenuOpen(false) }} style={{ padding: '8px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Topics Of Interest</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #e8e8e8', background: '#fafafa' }}>
                    <th style={{ padding: '12px 8px', fontSize: 12, fontWeight: 600, color: '#999', width: 40 }}><input type="checkbox" checked={isAllSelected} onChange={toggleSelectAll} /></th>
                    <th style={{ padding: '12px 8px', fontSize: 12, fontWeight: 600, color: '#999' }}>Title</th>
                    <th style={{ padding: '12px 8px', fontSize: 12, fontWeight: 600, color: '#999' }}>Date Published</th>
                    <th style={{ padding: '12px 8px', fontSize: 12, fontWeight: 600, color: '#999' }}>Industry</th>
                    <th style={{ padding: '12px 8px', fontSize: 12, fontWeight: 600, color: '#999' }}>Topics Of Interest</th>
                    <th style={{ padding: '12px 8px', fontSize: 12, fontWeight: 600, color: '#999' }}>Stored Assets</th>
                    <th style={{ padding: '12px 8px', fontSize: 12, fontWeight: 600, color: '#999' }}>Status</th>
                    <th style={{ padding: '12px 8px', fontSize: 12, fontWeight: 600, color: '#999' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((it) => {
                    const a = it.data?.article || {}
                    const d = it.data?.draft || {}
                    const nid = it.id
                    // prefer normalized display title (draft -> article) then fallback
                    const title = (getDisplayTitle(it) || `#${nid}`)
                    const date = d.ScheduledAt ?? a.PublishedAt ?? a.publishedAt ?? a.fetchedAt ?? a.crawledAt
                    const industry = getItemIndustry(it) || 'Unassigned'
                    const interests = getItemInterests(it) || 'Unassigned'
                    const hasHero = !!(d.HeroImageUrl || a.HeroImageUrl || d.HeroImage || a.HeroImage)
                    const hasDraft = Boolean(it.data && it.data.draft)
                    // Choose status using taxonomy-aware helpers so items without industry/topics
                    // remain 'Pending' even if server article has published timestamps.
                    let status = 'Pending'
                    if (isScheduled(it)) status = 'Scheduled'
                    else if (isLive(it)) status = 'Live'
                    else if (isDrafted(it)) status = 'Drafted'
                    else status = 'Pending'
                    return (
                      <tr key={nid} style={{ borderBottom: '1px solid #f2f2f2' }}>
                        <td style={{ padding: 10, verticalAlign: 'middle' }}><input type="checkbox" checked={selectedIds.includes(nid)} onChange={() => toggleSelect(nid)} /></td>
                        <td style={styles.titleCell}>{title}</td>
                        <td style={styles.dateCell}>{date ? new Date(date).toLocaleDateString() : '-'}</td>
                        <td style={styles.sourceCell}>{industry}</td>
                        <td style={styles.titleCell}>{interests}</td>
                        <td style={{ padding: 10 }}>
                          <button
                            onClick={() => {
                              const url = d.HeroImageUrl || a.HeroImageUrl || d.HeroImage || a.HeroImage || null
                              if (url) {
                                setPreviewUrl(url)
                                setPreviewOpen(true)
                              } else {
                                // noop or show message
                              }
                            }}
                            style={{ background: 'transparent', border: 'none', cursor: hasHero ? 'pointer' : 'default', padding: 0 }}
                            title={hasHero ? 'Preview hero image' : 'No hero image'}
                          >
                            <span style={{ marginRight: 8 }}>{hasHero ? '🖼️' : '📄'}</span>
                          </button>
                        </td>
                        <td style={styles.statusCell}><span style={{ padding: '6px 10px', borderRadius: 12, background: status === 'Pending' ? '#e6f0ff' : (status === 'Scheduled' ? '#fff4e6' : '#e8f9ee'), color: status === 'Pending' ? '#1e73d1' : (status === 'Scheduled' ? '#e07a16' : '#1e7a3a') }}>{status}</span></td>
                        <td style={styles.actionsCell}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button style={{ background: '#c92b2b', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 8 }} onClick={() => navigate(`/consultant/publish/${nid}`)}>Start</button>
                            <button
                              title="Delete article"
                              onClick={() => handleDeleteArticle(nid)}
                              style={{ background: 'transparent', color: '#c43d3d', border: '1px solid #f2dede', padding: '8px 10px', borderRadius: 8, cursor: 'pointer' }}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {previewOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setPreviewOpen(false)}>
                  <div style={{ maxWidth: '90%', maxHeight: '90%', background: '#fff', padding: 12, borderRadius: 8, boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button onClick={() => setPreviewOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
                    </div>
                    <div style={{ maxWidth: '80vw', maxHeight: '80vh' }}>
                      <img src={previewUrl} alt="hero preview" style={{ maxWidth: '100%', maxHeight: '80vh', display: 'block', margin: '0 auto', borderRadius: 6 }} />
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24, gap: 12 }}>
                <div style={{ background: 'white', padding: 10, borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} style={{ background: 'transparent', border: 'none', padding: '8px 10px', cursor: page <= 1 ? 'default' : 'pointer', color: page <= 1 ? '#ccc' : '#999', fontSize: 18 }}>◀</button>
                  {(() => {
                    const buttons = []
                    for (let p = 1; p <= totalPages; p++) {
                      const isActive = p === page
                      buttons.push(
                        <button key={p} onClick={() => setPage(p)} style={{ background: isActive ? '#c92b2b' : '#f5f5f5', color: isActive ? 'white' : '#555', border: 'none', padding: '8px 12px', borderRadius: 8, fontWeight: 600, minWidth: 36, cursor: isActive ? 'default' : 'pointer', fontSize: 14, margin: '0 4px' }}>{p}</button>
                      )
                    }
                    return buttons
                  })()}
                  <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} style={{ background: 'transparent', border: 'none', padding: '8px 10px', cursor: page >= totalPages ? 'default' : 'pointer', color: page >= totalPages ? '#ccc' : '#999', fontSize: 18 }}>▶</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
