import React, { useEffect, useState, useRef } from 'react'
import { getPublishDraft, getArticle, batchPublish, deleteArticle, getIndustryTags, getInterestTags, batchSaveDrafts, generateHeroImage, batchUnpublish } from '../../api/articles'
import { suggestPublish } from '../../api/articles'
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

// Inject keyframes for spinner animation
if (typeof document !== 'undefined' && !document.getElementById('publish-queue-spin-style')) {
  const style = document.createElement('style')
  style.id = 'publish-queue-spin-style'
  style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'
  document.head.appendChild(style)
}

export default function PublishQueue() {
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [articlePreview, setArticlePreview] = useState(null) // { id, data } for article preview modal
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
  const [suggestions, setSuggestions] = useState({}) // { [id]: { industryTagId, interestTagIds, rawSuggestion } }
  const [suggestionLoading, setSuggestionLoading] = useState(false)
  const [industryList, setIndustryList] = useState([])
  const [interestList, setInterestList] = useState([])
  const [displayLang, setDisplayLang] = useState('EN') // 'EN' | 'ZH'
  const navigate = useNavigate()
  const LAST_STATE_KEY = 'publishQueue.lastState'

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

  // helpers to resolve tag names from various possible backend shapes
  const resolveTagName = (t, fallback, lang = displayLang) => {
    if (!t) return fallback ?? null
    if (lang === 'ZH') {
      return t.NameZH ?? t.nameZH ?? t.TitleZH ?? t.NameEN ?? t.nameEN ?? t.Name ?? t.TitleEN ?? t.Title ?? t.label ?? t.value ?? t.displayName ?? t.name ?? (fallback ?? null)
    }
    return t.NameEN ?? t.nameEN ?? t.TitleEN ?? t.NameZH ?? t.nameZH ?? t.Name ?? t.Title ?? t.label ?? t.value ?? t.displayName ?? t.name ?? (fallback ?? null)
  }
  const findTagById = (list, id) => {
    if (!Array.isArray(list) || list.length === 0) return null
    return list.find(x => String(x.id ?? x.industryTagId ?? x.industryId ?? x.IndustryTagId ?? x.InterestTagId ?? x.interestTagId ?? x.InterestTagId ?? x.TagId ?? x.Value ?? x.value) === String(id)) || null
  }

  // track previous counts so we can auto-switch tabs when items move states
  const prevCountsRef = useRef({ scheduled: 0, published: 0, drafted: 0, unpublished: 0 })

  // If user navigated to a specific tab via URL param, we should avoid
  // the "auto-switch" behavior on first items update so their explicit
  // choice is respected.
  const skipAutoSwitchRef = useRef(false)

  const [activeTab, setActiveTab] = useState('ready') // ready, drafted, scheduled, published, unpublished
  const location = useLocation()

  useEffect(() => {
    // Restore last viewed tab/page from localStorage when possible so users
    // return to the exact place they left off. If no stored state exists,
    // fall back to `?tab=` URL param and mark skipAutoSwitch accordingly.
    try {
      const stored = JSON.parse(localStorage.getItem(LAST_STATE_KEY) || 'null')
      if (stored && stored.tab && ['ready', 'drafted', 'scheduled', 'published', 'unpublished'].includes(stored.tab)) {
        setActiveTab(stored.tab)
        setPage(stored.page || 1)
        // Prevent the auto-switch effect from immediately overriding the restored state
        skipAutoSwitchRef.current = true
      } else {
        const params = new URLSearchParams(location.search)
        const t = params.get('tab')
        if (t && ['ready', 'drafted', 'scheduled', 'published', 'unpublished'].includes(t)) { setActiveTab(t); skipAutoSwitchRef.current = true }
      }
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
        published: items.filter(it => isLive(it)).length,
        drafted: items.filter(it => isDrafted(it)).length,
        unpublished: items.filter(it => isUnpublished(it)).length
      }
      const prev = prevCountsRef.current || { scheduled: 0, published: 0, drafted: 0 }
      // if user was on 'ready' and something moved to scheduled/live/drafted, switch to that tab
      if (activeTab === 'ready') {
        // Only consume the "skipAutoSwitch" token when an actual auto-switch would occur.
        // This avoids consuming the token on intermediate/partial item updates so that an
        // explicit `?tab=` param remains honored until the first real state-change.
        if (counts.scheduled > prev.scheduled) {
          if (skipAutoSwitchRef.current) skipAutoSwitchRef.current = false
          else setActiveTab('scheduled')
        } else if (counts.published > prev.published) {
          if (skipAutoSwitchRef.current) skipAutoSwitchRef.current = false
          else setActiveTab('published')
        } else if (counts.drafted > prev.drafted) {
          if (skipAutoSwitchRef.current) skipAutoSwitchRef.current = false
          else setActiveTab('drafted')
        }
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

  // Persist last-viewed tab/page so we can restore it on refresh/back navigation
  const saveLastState = (tab, pageNum) => {
    try {
      const obj = { tab: tab || activeTab, page: Number(pageNum || page) || 1 }
      localStorage.setItem(LAST_STATE_KEY, JSON.stringify(obj))
    } catch (e) { /* ignore */ }
  }

  const setActiveTabPersist = (t) => {
    setActiveTab(t)
    saveLastState(t, page)
  }

  const setPagePersist = (p) => {
    setPage(p)
    saveLastState(activeTab, p)
  }

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
            // If the publish draft endpoint returned no data, try fetching the article
            // record itself so we can at least display a proper title instead of an ID.
            try {
              const artRes = await getArticle(id, 'en')
              const art = artRes ? (artRes?.data ?? artRes) : null
              if (art && Object.keys(art).length > 0) {
                fetched.push({ id, data: normalizeData({ article: art }) })
                continue
              }
            } catch (e) {
              // ignore — fall through to null-data handling
            }
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
  function getDisplayTitle(it, lang = displayLang) {
    const a = it.data?.article || {}
    const d = it.data?.draft || {}
    const firstString = (v) => (v === null || typeof v === 'undefined') ? null : (typeof v === 'string' ? v : String(v))
    let candidates
    if (lang === 'ZH') {
      candidates = [
        // ZH preferred
        d?.TitleZH, d?.titleZH, d?.TitleEN, d?.titleEN, d?.Title, d?.title,
        a?.TitleZH, a?.titleZH, a?.TitleEN, a?.titleEN, a?.Title, a?.title,
        it.data?.TitleZH, it.data?.titleZH, it.data?.TitleEN, it.data?.Title
      ].map(firstString).filter(Boolean)
    } else {
      candidates = [
        // EN preferred
        d?.TitleEN, d?.titleEN, d?.titleEn, d?.Title, d?.title, d?.TitleZH, d?.titleZH,
        a?.TitleEN, a?.titleEN, a?.titleEn, a?.Title, a?.title, a?.TitleZH, a?.titleZH,
        it.data?.TitleEN, it.data?.titleEN, it.data?.Title, it.data?.title
      ].map(firstString).filter(Boolean)
    }
    if (!candidates || candidates.length === 0) return ''
    // prefer the first candidate that is not purely numeric (avoid showing IDs)
    for (const c of candidates) {
      const s = String(c).trim()
      if (!/^\d+$/.test(s) && s) return s
    }
    return ''
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
      // Previously we required taxonomy (industry + topics) to consider an item "Drafted".
      // Change: treat any saved draft (that is not published or scheduled) as Drafted so
      // "Save as Draft" from Ready will surface under the Drafted tab even if taxonomy
      // hasn't been assigned yet.
      return true
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

  // Determine if an item is explicitly unpublished (client-side marker or inferred)
  const isUnpublished = (it) => {
    try {
      if (!it) return false
      if (it.data && (it.data._unpublished || it.data.unpublished)) return true
      // If article exists but is not published and there's evidence it was previously published,
      // we could infer, but prefer explicit client/server flag. Default: false
      return false
    } catch (e) { return false }
  }

  const tabFiltered = filtered.filter(it => {
    if (activeTab === 'ready') return isReady(it)
    if (activeTab === 'drafted') return isDrafted(it)
    if (activeTab === 'scheduled') return isScheduled(it)
    if (activeTab === 'published') return isLive(it)
    if (activeTab === 'unpublished') return isUnpublished(it)
    return true
  })

  const totalCounts = {
    total: items.length,
    pending: items.filter(it => isReady(it)).length,
    drafted: items.filter(it => isDrafted(it)).length,
    scheduled: items.filter(it => isScheduled(it)).length,
    live: items.filter(it => isLive(it)).length,
    unpublished: items.filter(it => isUnpublished(it)).length
  }

  // load tag lists for mapping suggestion ids -> names
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const [inds, ints] = await Promise.allSettled([getIndustryTags(), getInterestTags()])
        if (mounted) {
          if (inds.status === 'fulfilled') setIndustryList(Array.isArray(inds.value?.data ?? inds.value) ? (inds.value.data || inds.value) : [])
          if (ints.status === 'fulfilled') setInterestList(Array.isArray(ints.value?.data ?? ints.value) ? (ints.value.data || ints.value) : [])
        }
      } catch (e) {
        // ignore
      }
    })()
    return () => { mounted = false }
  }, [])

  // Handler for AI classification button - fetches suggestions for selected articles
  const handleAssignAIClassifications = async () => {
    if (!selectedIds || selectedIds.length === 0) {
      showToast('Please select articles first', 'error')
      return
    }
    setSuggestionLoading(true)
    try {
      const res = await suggestPublish(selectedIds)
      const map = {}
      if (Array.isArray(res)) {
        for (const r of res) {
          const id = Number(r.id ?? r.NewsArticleId ?? r.newsArticleId ?? r.articleId ?? r.article?.NewsArticleId)
          if (!Number.isNaN(id)) map[id] = r
        }
      } else if (typeof res === 'object' && res !== null) {
        for (const k of Object.keys(res)) {
          const id = Number(k)
          if (!Number.isNaN(id)) map[id] = res[k]
        }
      }
      setSuggestions(prev => ({ ...(prev || {}), ...map }))
      // Persist AI suggestions to drafts so they survive reload and are visible in PublishArticle
      try {
        const dtos = []
        for (const k of Object.keys(map)) {
          const id = Number(k)
          if (Number.isNaN(id)) continue
          const v = map[k]
          if (!v || v.error) continue
          const it = items.find(x => Number(x.id) === id)
          const d = it?.data?.draft
          // If draft already has taxonomy, do not overwrite
          const draftHasTax = d && (d.IndustryTagId || (d.InterestTags && d.InterestTags.length) || (d.InterestTagIds && d.InterestTagIds.length))
          if (draftHasTax) continue
          const industryTagId = (typeof v.industryTagId !== 'undefined') ? v.industryTagId : null
          const interestTagIds = Array.isArray(v.interestTagIds) ? v.interestTagIds : []
          if (industryTagId === null && (!interestTagIds || interestTagIds.length === 0)) continue
          dtos.push({ NewsArticleId: id, IndustryTagId: industryTagId, InterestTagIds: interestTagIds })
        }
        if (dtos.length > 0) {
          // Optimistically persist AI suggestions to client-side publishQueue so
          // the UI shows classifications even if the server call fails or is flaky.
          try {
            try {
              const rawQ = JSON.parse(localStorage.getItem('publishQueue') || '[]')
              const entriesQ = Array.isArray(rawQ) ? rawQ : []
              const updated = entriesQ.slice()
              for (const dto of dtos) {
                const nid = Number(dto.NewsArticleId)
                if (Number.isNaN(nid)) continue
                const idx = updated.findIndex(e => Number(e?.id ?? e) === nid)
                const existing = idx >= 0 ? updated[idx] : null
                const articleObj = (existing && existing.data && existing.data.article) ? existing.data.article : (items.find(x => Number(x.id) === nid)?.data?.article || {})
                const prevDraft = (existing && existing.data && existing.data.draft) ? existing.data.draft : (items.find(x => Number(x.id) === nid)?.data?.draft || {})
                const mergedDraft = { ...(prevDraft || {}) }
                if (typeof dto.IndustryTagId !== 'undefined') mergedDraft.IndustryTagId = dto.IndustryTagId
                if (Array.isArray(dto.InterestTagIds) && dto.InterestTagIds.length > 0) mergedDraft.InterestTagIds = dto.InterestTagIds.map(x => Number(x)).filter(x => !Number.isNaN(x))
                // attempt to build InterestTags objects from known interestList for nicer display
                if (Array.isArray(mergedDraft.InterestTagIds) && mergedDraft.InterestTagIds.length > 0 && Array.isArray(interestList) && interestList.length > 0) {
                  mergedDraft.InterestTags = mergedDraft.InterestTagIds.map(id => interestList.find(x => String(x.id ?? x.InterestTagId ?? x.interestTagId) === String(id))).filter(Boolean)
                }
                const newEntry = { id: nid, data: { article: articleObj, draft: mergedDraft, en: existing?.data?.en, zh: existing?.data?.zh } }
                if (idx >= 0) updated.splice(idx, 1, newEntry)
                else updated.push(newEntry)
              }
              localStorage.setItem('publishQueue', JSON.stringify(updated))
            } catch (inner) { /* ignore localStorage errors */ }

            await batchSaveDrafts(dtos)
            loadQueue()
            showToast(`Applied AI suggestions to ${dtos.length} draft(s)`, 'success')
          } catch (e) {
            console.error('Failed to save AI suggestions', e)
            // We already attempted client-side persistence; inform user server persist failed.
            showToast('Failed to persist AI suggestions to server (saved locally)', 'error')
          }
        } else {
          const successCount = Object.keys(map).filter(k => !map[k].error).length
          if (successCount > 0) showToast(`AI classifications available for ${successCount} article(s)`, 'info')
          else showToast('AI could not classify the selected articles', 'error')
        }
      } catch (e) {
        console.error('persist AI suggestions error', e)
      }
    } catch (e) {
      console.error('AI classification failed', e)
      showToast('AI classification failed: ' + (e.message || e), 'error')
    } finally {
      setSuggestionLoading(false)
    }
  }


  // apply sorting to the currently active tab's filtered list
  const getItemDate = (it) => {
    const a = it.data?.article || {}
    const d = it.data?.draft || {}
    const raw = d?.ScheduledAt ?? a?.PublishedAt ?? a?.publishedAt ?? a?.fetchedAt ?? a?.crawledAt
    const t = raw ? new Date(raw).getTime() : 0
    return Number.isNaN(t) ? 0 : t
  }
  const getItemIndustry = (it, lang = displayLang) => {
    const d = it.data?.draft || {}
    // prefer readable names based on language, fall back to stored ids when names are not available
    let name
    if (lang === 'ZH') {
      name = d?.IndustryTag?.NameZH ?? d?.IndustryTag?.NameEN ?? d?.IndustryTag?.Name ?? d?.IndustryTag?.name
    } else {
      name = d?.IndustryTag?.NameEN ?? d?.IndustryTag?.NameZH ?? d?.IndustryTag?.Name ?? d?.IndustryTag?.name
    }
    if (name) return String(name)
    const id = d?.IndustryTagId ?? d?.IndustryTag?.IndustryTagId ?? d?.IndustryTag?.id ?? d?.IndustryId ?? d?.industryId
    return id ? String(id) : ''
  }
  const getItemInterests = (it, lang = displayLang) => {
    const d = it.data?.draft || {}
    const tags = d?.InterestTags || []
    if (!Array.isArray(tags) || tags.length === 0) return ''.toString()
    // If tags are objects with names, prefer those based on language; if they are ids (number/string), show ids
    const mapped = tags.map(i => {
      if (!i && i !== 0) return null
      if (typeof i === 'object') {
        if (lang === 'ZH') {
          return i.NameZH ?? i.NameEN ?? i.Name ?? i.name ?? (i.InterestTagId ?? i.id) ?? null
        }
        return i.NameEN ?? i.NameZH ?? i.Name ?? i.name ?? (i.InterestTagId ?? i.id) ?? null
      }
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

  // direct publish helper removed — use `quickPublish` which saves drafts, applies AI and generates images before publishing

  const openQuickScheduleModal = () => {
    if (!selectedIds || selectedIds.length === 0) {
      showToast('Please select articles first', 'error')
      return
    }
    // Build article list for display
    const articles = selectedIds.map(id => {
      const it = items.find(x => Number(x.id) === Number(id))
      const a = it?.data?.article || {}
      const d = it?.data?.draft || {}
      const sug = suggestions?.[id] || {}
      
      // Get AI suggested or existing tags
      const industryId = sug.industryTagId ?? d.IndustryTagId ?? d.IndustryTag?.IndustryTagId ?? null
      const industryTag = industryId ? findTagById(industryList, industryId) : null
      const industryName = industryTag ? resolveTagName(industryTag, String(industryId)) : null
      
      const interestIds = sug.interestTagIds ?? d.InterestTagIds ?? (d.InterestTags || []).map(t => t.InterestTagId ?? t.id) ?? []
      const interestNames = (Array.isArray(interestIds) ? interestIds : []).map(id => {
        const tag = findTagById(interestList, id)
        return tag ? resolveTagName(tag, String(id)) : String(id)
      }).filter(Boolean)
      
      // Normalize hero URL
      const heroUrl = d.HeroImageUrl ?? a.HeroImageUrl ?? null
      const displayHeroUrl = (() => {
        if (!heroUrl) return null
        if (/^data:|^https?:\/\//i.test(heroUrl)) return heroUrl
        const apiBase = (import.meta.env.VITE_API_BASE || window.location.origin)
        return apiBase.replace(/\/$/, '') + (heroUrl.startsWith('/') ? heroUrl : '/' + heroUrl)
      })()
      
      return {
        id: Number(id),
        title: getDisplayTitle(it) || `Article #${id}`,
        heroUrl: displayHeroUrl,
        industryName,
        interestNames,
        hasAISuggestion: Boolean(sug.industryTagId || sug.interestTagIds)
      }
    })
    
    setQuickScheduleArticles(articles)
    setQuickScheduleDate('')
    setQuickScheduleProgress({ current: 0, total: 0, status: '' })
    setQuickScheduleModalOpen(true)
  }

  // Helper: attempt to generate a hero image with a richer prompt and retries
  const generateHeroFor = async (id, title = '', content = '') => {
    const normalizeUrl = (r) => {
      if (!r) return null
      if (typeof r === 'string') return r
      if (r.url) return r.url
      if (r.Url) return r.Url
      if (r.path) return r.path
      if (r.filePath) return r.filePath
      if (r.data && typeof r.data === 'string') return r.data
      if (r.data && r.data.url) return r.data.url
      if (r.data && r.data.Url) return r.data.Url
      return null
    }
    const snippet = (content || '').replace(/\s+/g, ' ').trim().slice(0, 400)
    const prompt = `${title || 'News article'}\n\n${snippet}`
    const attempts = 3
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const res = await generateHeroImage(id, { newsArticleId: Number(id), promptOverride: prompt, style: null })
        const url = normalizeUrl(res)
        if (url) return url
      } catch (e) {
        console.error('generateHeroImage attempt', attempt, 'failed for', id, e)
      }
      // backoff
      await new Promise(r => setTimeout(r, attempt * 700))
    }
    return null
  }

  const removeFromQuickSchedule = (id) => {
    setQuickScheduleArticles(prev => prev.filter(a => a.id !== id))
  }

  const submitQuickSchedule = async () => {
    if (!quickScheduleDate) {
      showToast('Please select a date and time', 'error')
      return
    }
    if (quickScheduleArticles.length === 0) {
      showToast('No articles to schedule', 'error')
      return
    }
    
    setQuickScheduleProcessing(true)
    const total = quickScheduleArticles.length
    const articleIds = quickScheduleArticles.map(a => a.id)
    
    try {
      // Step 1: Apply AI classifications
      setQuickScheduleProgress({ current: 0, total, status: 'Applying AI classifications...' })
      const aiRes = await suggestPublish(articleIds)
      const aiMap = {}
      if (Array.isArray(aiRes)) {
        for (const r of aiRes) {
          const id = Number(r.id ?? r.NewsArticleId ?? r.newsArticleId)
          if (!Number.isNaN(id)) aiMap[id] = r
        }
      } else if (typeof aiRes === 'object' && aiRes !== null) {
        for (const k of Object.keys(aiRes)) {
          const id = Number(k)
          if (!Number.isNaN(id)) aiMap[id] = aiRes[k]
        }
      }
      setSuggestions(prev => ({ ...(prev || {}), ...aiMap }))
      
      // Step 2: Generate hero images
      setQuickScheduleProgress({ current: 0, total, status: 'Generating hero images...' })
      for (let i = 0; i < articleIds.length; i++) {
        const id = articleIds[i]
        setQuickScheduleProgress({ current: i + 1, total, status: `Generating hero image ${i + 1}/${total}...` })
        try {
          const it = items.find(x => Number(x.id) === Number(id))
          const a = it?.data?.article || {}
          const d = it?.data?.draft || {}
          const title = d.TitleEN ?? a.TitleEN ?? a.Title ?? ''
          const content = d.FullContentEN ?? a.FullContentEN ?? ''
          const url = await generateHeroFor(id, title, content)
          if (!url) console.error('generateHeroImage returned no url for', id)
        } catch (e) {
          console.error('generateHeroImage failed for', id, e)
        }
      }
      
      // Step 3: Build DTOs with AI suggestions and schedule
      setQuickScheduleProgress({ current: total, total, status: 'Scheduling articles...' })
      const dtos = []
      for (const id of articleIds) {
        const it = items.find(x => Number(x.id) === Number(id))
        const a = it?.data?.article || {}
        const d = it?.data?.draft || {}
        const sug = aiMap[id] || suggestions?.[id] || {}
        
        const FullContentEN = d.FullContentEN ?? a.FullContentEN ?? ''
        const FullContentZH = d.FullContentZH ?? a.FullContentZH ?? ''
        const TitleEN = d.TitleEN ?? a.TitleEN ?? a.Title ?? ''
        const TitleZH = d.TitleZH ?? a.TitleZH ?? a.Title ?? ''
        const IndustryTagId = sug.industryTagId ?? d.IndustryTagId ?? null
        const InterestTagIds = sug.interestTagIds ?? (d.InterestTags || []).map(t => t.InterestTagId ?? t.id) ?? []
        
        dtos.push({
          NewsArticleId: Number(id),
          HeroImageUrl: d.HeroImageUrl ?? a.HeroImageUrl ?? null,
          HeroImageSource: 'generated',
          FullContentEN,
          FullContentZH,
          TitleEN,
          TitleZH,
          IndustryTagId,
          InterestTagIds,
          ScheduledAt: quickScheduleDate
        })
      }
      
      await batchSaveDrafts(dtos)
      await batchPublish(articleIds, quickScheduleDate)
      
      showToast(`Successfully scheduled ${total} article(s)`, 'success')
      setQuickScheduleModalOpen(false)
      setSelectedIds([])
      loadQueue()
    } catch (e) {
      console.error('Quick Schedule failed', e)
      showToast('Quick Schedule failed: ' + (e.message || e), 'error')
    } finally {
      setQuickScheduleProcessing(false)
    }
  }

  const quickPublish = async () => {
    if (!selectedIds || selectedIds.length === 0) { alert('No articles selected'); return }
    const useAISuggest = window.confirm('Apply AI-suggested classifications where available? (OK = yes)')
    const genImages = window.confirm('Generate hero images for selected articles? (OK = yes)')
    if (!window.confirm(`Publish ${selectedIds.length} selected article(s) now?`)) return
    try {
      setLoading(true)
      const dtos = []
      for (const id of selectedIds) {
        const it = items.find(x => Number(x.id) === Number(id))
        const a = it?.data?.article || {}
        const d = it?.data?.draft || {}
        const sug = suggestions?.[id] || {}
        const FullContentEN = d.FullContentEN ?? a.FullContentEN ?? ''
        const FullContentZH = d.FullContentZH ?? a.FullContentZH ?? ''
        const TitleEN = d.TitleEN ?? a.TitleEN ?? a.Title ?? ''
        const TitleZH = d.TitleZH ?? a.TitleZH ?? a.Title ?? ''
        const IndustryTagId = useAISuggest ? (sug.industryTagId ?? (d.IndustryTagId ?? null)) : (d.IndustryTagId ?? null)
        const InterestTagIds = useAISuggest ? (sug.interestTagIds ?? (d.InterestTags || []).map(t => t.InterestTagId ?? t.id)) : ((d.InterestTags || []).map(t => t.InterestTagId ?? t.id))
        dtos.push({ NewsArticleId: Number(id), HeroImageUrl: d.HeroImageUrl ?? a.HeroImageUrl ?? null, HeroImageSource: d.HeroImageSource ?? null, FullContentEN, FullContentZH, TitleEN, TitleZH, IndustryTagId, InterestTagIds, ScheduledAt: null })
      }
      if (genImages) {
        for (const id of selectedIds) {
          try {
            const it = items.find(x => Number(x.id) === Number(id))
            const a = it?.data?.article || {}
            const d = it?.data?.draft || {}
            const title = d.TitleEN ?? a.TitleEN ?? a.Title ?? ''
            const content = d.FullContentEN ?? a.FullContentEN ?? ''
            const url = await generateHeroFor(id, title, content)
            if (!url) console.error('generateHeroImage returned no url for', id)
          } catch (e) { console.error('generateHeroImage failed for', id, e) }
        }
      }
      await batchSaveDrafts(dtos)
      await batchPublish(selectedIds, null)
      showToast('Published selected articles')
      setSelectedIds([])
      loadQueue()
    } catch (e) {
      showToast('Quick Publish failed: ' + (e.message || e), 'error')
    } finally { setLoading(false) }
  }

  // Quick action modal state and helpers
  const [quickModalOpen, setQuickModalOpen] = useState(false)
  const [quickModalAction, setQuickModalAction] = useState(null) // 'schedule' | 'publish'
  const [modalArticles, setModalArticles] = useState([])
  const [modalScheduledAt, setModalScheduledAt] = useState('')

  // Quick Schedule modal state
  const [quickScheduleModalOpen, setQuickScheduleModalOpen] = useState(false)
  const [quickScheduleArticles, setQuickScheduleArticles] = useState([])
  const [quickScheduleDate, setQuickScheduleDate] = useState('')
  const [quickScheduleProcessing, setQuickScheduleProcessing] = useState(false)
  const [quickScheduleProgress, setQuickScheduleProgress] = useState({ current: 0, total: 0, status: '' })

  const openQuickModal = (action) => {
    // build editable payloads for selectedIds
    const rows = selectedIds.map(id => {
      const it = items.find(x => Number(x.id) === Number(id))
      const a = it?.data?.article || {}
      const d = it?.data?.draft || {}
      const sug = suggestions?.[id] || {}
      const IndustryTagId = sug.industryTagId ?? d.IndustryTagId ?? (d.IndustryTag?.IndustryTagId ?? null)
      const InterestTagIds = sug.interestTagIds ?? ((d.InterestTags || []).map(t => t.InterestTagId ?? t.id))
      return {
        id: Number(id),
        TitleEN: d.TitleEN ?? a.TitleEN ?? a.Title ?? '',
        TitleZH: d.TitleZH ?? a.TitleZH ?? a.Title ?? '',
        FullContentEN: d.FullContentEN ?? a.FullContentEN ?? '',
        FullContentZH: d.FullContentZH ?? a.FullContentZH ?? '',
        IndustryTagId: IndustryTagId || '',
        InterestTagIds: Array.isArray(InterestTagIds) ? InterestTagIds : (InterestTagIds ? [InterestTagIds] : []),
        HeroImageUrl: d.HeroImageUrl ?? a.HeroImageUrl ?? null,
        applyAISuggest: true,
        rawSuggestion: sug.rawSuggestion || ''
      }
    })
    setModalArticles(rows)
    setQuickModalAction(action)
    setQuickModalOpen(true)
  }

  const updateModalArticle = (id, patch) => {
    setModalArticles(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  const handleGenerateHeroFor = async (id) => {
    try {
      setLoading(true)
      const res = await generateHeroImage(id, { newsArticleId: Number(id), promptOverride: '', style: null })
      // normalize url
      const url = (res && (res.url || res.Url || res.path || res.filePath)) || (typeof res === 'string' ? res : null)
      if (url) updateModalArticle(id, { HeroImageUrl: url })
      showToast('Generated hero image for ' + id)
    } catch (e) {
      showToast('Hero generation failed: ' + (e.message || e), 'error')
    } finally { setLoading(false) }
  }

  const submitQuickModal = async () => {
    if (!modalArticles || modalArticles.length === 0) return
    try {
      setLoading(true)
      const dtos = modalArticles.map(m => ({
        NewsArticleId: Number(m.id),
        HeroImageUrl: m.HeroImageUrl || null,
        HeroImageSource: m.HeroImageUrl ? 'generated' : null,
        FullContentEN: m.FullContentEN || null,
        FullContentZH: m.FullContentZH || null,
        TitleEN: m.TitleEN || null,
        TitleZH: m.TitleZH || null,
        IndustryTagId: m.applyAISuggest ? (m.IndustryTagId || null) : (m.IndustryTagId || null),
        InterestTagIds: m.applyAISuggest ? (m.InterestTagIds || []) : (m.InterestTagIds || []),
        ScheduledAt: quickModalAction === 'schedule' ? (modalScheduledAt || null) : null
      }))
      await batchSaveDrafts(dtos)
      const ids = modalArticles.map(m => m.id)
      await batchPublish(ids, quickModalAction === 'schedule' ? (modalScheduledAt || null) : null)
      showToast(quickModalAction === 'schedule' ? 'Scheduled selected articles' : 'Published selected articles')
      setQuickModalOpen(false)
      setSelectedIds([])
      loadQueue()
    } catch (e) {
      showToast('Quick action failed: ' + (e.message || e), 'error')
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

  const handleUnpublishArticle = async (id) => {
    if (!id) return
    if (!confirm('Unpublish this article? It will move to Unpublished.')) return
    try {
      setLoading(true)
      const res = await batchUnpublish([id])
      // mark local queue entry as unpublished so UI surfaces it under the Unpublished tab
      try {
        const rawQ = JSON.parse(localStorage.getItem('publishQueue') || '[]')
        const entriesQ = Array.isArray(rawQ) ? rawQ : []
        const updated = entriesQ.slice()
        const idx = updated.findIndex(e => Number(e?.id ?? e) === Number(id))
        const it = items.find(x => Number(x.id) === Number(id))
        if (idx >= 0) {
          const existing = updated[idx]
          const data = (typeof existing === 'object' && existing && existing.data) ? { ...(existing.data || {}) } : { article: existing?.article || null }
          // ensure draft object exists and preserve hero image from draft or article
          data.draft = { ...(data.draft || {}) }
          data.draft.HeroImageUrl = data.draft.HeroImageUrl || (data.article && (data.article.HeroImageUrl ?? data.article.heroImageUrl)) || (it && (it.data?.draft?.HeroImageUrl || it.data?.article?.HeroImageUrl)) || null
          data._unpublished = true
          if (data.article) {
            delete data.article.PublishedAt
            delete data.article.publishedAt
            delete data.article.IsPublished
            delete data.article.isPublished
          }
          updated.splice(idx, 1, { id: Number(id), data })
          localStorage.setItem('publishQueue', JSON.stringify(updated))
        } else {
          // If no local entry exists, add one so the item is visible under Unpublished with its hero preserved
          const articleObj = (it && it.data && it.data.article) ? it.data.article : null
          const hero = (it && it.data && (it.data.draft?.HeroImageUrl || it.data.article?.HeroImageUrl)) || null
          const newData = { article: articleObj, draft: { HeroImageUrl: hero }, _unpublished: true }
          updated.push({ id: Number(id), data: newData })
          localStorage.setItem('publishQueue', JSON.stringify(updated))
        }
      } catch (inner) { /* ignore local storage errors */ }

      // update in-memory items for immediate UI feedback and preserve hero image
      setItems(prev => prev.map(it => {
        if (Number(it.id) !== Number(id)) return it
        const newData = { ...(it.data || {}) }
        newData._unpublished = true
        // ensure draft exists and preserve hero image
        newData.draft = { ...(newData.draft || {}) }
        newData.draft.HeroImageUrl = newData.draft.HeroImageUrl || (newData.article && (newData.article.HeroImageUrl ?? newData.article.heroImageUrl)) || null
        if (newData.article) {
          delete newData.article.PublishedAt
          delete newData.article.publishedAt
          delete newData.article.IsPublished
          delete newData.article.isPublished
        }
        return { ...it, data: newData }
      }))

      showToast('Unpublish request sent', 'success')
      try { window.dispatchEvent(new Event('articles:changed')) } catch (e) {}
      loadQueue()
    } catch (err) {
      showToast('Unpublish failed: ' + (err.message || err), 'error')
    } finally { setLoading(false) }
  }

  return (
    <div className="content-full">
      <div className="page-inner">
        <div style={styles.page}>
          <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: '#887B76', marginBottom: 8 }}>Publish Queue</h1>
              <p style={{ fontSize: 15, color: '#887B76', margin: 0 }}>Articles you've pushed to the publish workflow</p>
            </div>
            <div style={{ fontSize: 13, color: '#887B76', fontWeight: 500 }}>Total: <span style={{ fontWeight: 700 }}>{totalCounts.total}</span> articles</div>
          </div>

            <div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
              <div style={{ background: 'white', padding: 16, borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.06)', flex: 1 }}>
                <div style={{ color: '#1e73d1', fontSize: 13, fontWeight: 700 }}>Ready To Publish</div>
                <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, color: '#1e73d1' }}>{totalCounts.pending}</div>
                <div style={{ color: '#1e73d1', fontSize: 12, marginTop: 8 }}>To be published</div>
              </div>
              <div style={{ background: 'white', padding: 16, borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.06)', flex: 1 }}>
                <div style={{ color: '#aaa', fontSize: 13, fontWeight: 700 }}>Drafted</div>
                <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, color: '#aaa' }}>{totalCounts.drafted}</div>
                <div style={{ color: '#aaa', fontSize: 12, marginTop: 8 }}>Actively publishing</div>
              </div>
              <div style={{ background: 'white', padding: 16, borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.06)', flex: 1 }}>
                <div style={{ color: '#e07a16', fontSize: 13, fontWeight: 700 }}>Scheduled</div>
                <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, color: '#e07a16' }}>{totalCounts.scheduled}</div>
                <div style={{ color: '#e07a16', fontSize: 12, marginTop: 8 }}>All scheduled articles</div>
              </div>
              <div style={{ background: 'white', padding: 16, borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.06)', flex: 1 }}>
                <div style={{ color: '#1e7a3a', fontSize: 13, fontWeight: 700 }}>Published</div>
                <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, color: '#1e7a3a' }}>{totalCounts.live}</div>
                <div style={{ color: '#1e7a3a', fontSize: 12, marginTop: 8 }}>All published articles</div>
              </div>
              <div style={{ background: 'white', padding: 16, borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.06)', flex: 1 }}>
                <div style={{ color: '#c62828', fontSize: 13, fontWeight: 700 }}>Unpublished</div>
                <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, color: '#c62828' }}>{totalCounts.unpublished}</div>
                <div style={{ color: '#c62828', fontSize: 12, marginTop: 8 }}>All unpublished articles</div>
              </div>
            </div>

            <div style={styles.tableCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
                  <div onClick={() => setActiveTabPersist('ready')} style={{ padding: '6px 12px', cursor: 'pointer', borderBottom: activeTab === 'ready' ? '2px solid #c92b2b' : '2px solid transparent', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 13, color: '#887B76' }}>Ready to Publish</div>
                  <div onClick={() => setActiveTabPersist('drafted')} style={{ padding: '6px 12px', cursor: 'pointer', borderBottom: activeTab === 'drafted' ? '2px solid #c92b2b' : '2px solid transparent', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 13, color: '#887B76' }}>Drafted</div>
                  <div onClick={() => setActiveTabPersist('scheduled')} style={{ padding: '6px 12px', cursor: 'pointer', borderBottom: activeTab === 'scheduled' ? '2px solid #c92b2b' : '2px solid transparent', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 13, color: '#887B76' }}>Scheduled</div>
                  <div onClick={() => setActiveTabPersist('published')} style={{ padding: '6px 12px', cursor: 'pointer', borderBottom: activeTab === 'published' ? '2px solid #c92b2b' : '2px solid transparent', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 13, color: '#887B76' }}>Published</div>
                  <div onClick={() => setActiveTabPersist('unpublished')} style={{ padding: '6px 12px', cursor: 'pointer', borderBottom: activeTab === 'unpublished' ? '2px solid #c92b2b' : '2px solid transparent', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 13, color: '#887B76' }}>Unpublished</div>
                </div>

                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button 
                    onClick={handleAssignAIClassifications} 
                    disabled={!selectedIds || selectedIds.length === 0 || suggestionLoading} 
                    style={{ 
                      padding: '4px 8px', 
                      borderRadius: 4, 
                      fontSize: 11, 
                      fontWeight: 600,
                      background: selectedIds && selectedIds.length > 0 ? 'linear-gradient(135deg, #BA0006 0%, #8B0005 100%)' : '#f2f2f2', 
                      color: selectedIds && selectedIds.length > 0 ? '#fff' : '#999', 
                      border: 'none', 
                      cursor: selectedIds && selectedIds.length > 0 && !suggestionLoading ? 'pointer' : 'default',
                      boxShadow: selectedIds && selectedIds.length > 0 ? '0 2px 6px rgba(186, 0, 6, 0.25)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    {suggestionLoading ? (
                      <span style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <span style={{ fontSize: 10 }}>✨</span>
                    )}
                    {suggestionLoading ? 'Classifying...' : 'AI Classify'}
                  </button>
                  <button onClick={openQuickScheduleModal} disabled={!selectedIds || selectedIds.length === 0} style={{ padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, background: selectedIds && selectedIds.length > 0 ? '#e07a16' : '#f2f2f2', color: selectedIds && selectedIds.length > 0 ? '#fff' : '#999', border: 'none', cursor: selectedIds && selectedIds.length > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 4 }}><span>📅</span> Quick Schedule</button>
                  <button onClick={quickPublish} disabled={!selectedIds || selectedIds.length === 0} style={{ padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, background: selectedIds && selectedIds.length > 0 ? '#1e7a3a' : '#f2f2f2', color: selectedIds && selectedIds.length > 0 ? '#fff' : '#999', border: 'none', cursor: selectedIds && selectedIds.length > 0 ? 'pointer' : 'default' }}>Publish</button>
                  {/* 'Publish Selected' removed per request — use Quick Publish instead */}
                  {/* Language toggle (row content only) */}
                  <div style={{ display: 'flex', borderRadius: 4, overflow: 'hidden', border: '1px solid #e2e2e2' }}>
                    <button 
                      onClick={() => setDisplayLang('EN')} 
                      style={{ 
                        padding: '4px 8px', 
                        fontSize: 10, 
                        fontWeight: 600,
                        background: displayLang === 'EN' ? '#BA0006' : '#fff', 
                        color: displayLang === 'EN' ? '#fff' : '#666', 
                        border: 'none', 
                        cursor: 'pointer'
                      }}
                    >EN</button>
                    <button 
                      onClick={() => setDisplayLang('ZH')} 
                      style={{ 
                        padding: '4px 8px', 
                        fontSize: 10, 
                        fontWeight: 600,
                        background: displayLang === 'ZH' ? '#BA0006' : '#fff', 
                        color: displayLang === 'ZH' ? '#fff' : '#666', 
                        border: 'none', 
                        borderLeft: '1px solid #e2e2e2',
                        cursor: 'pointer'
                      }}
                    >中文</button>
                  </div>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, fontSize: 12 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #e8e8e8', background: '#fafafa' }}>
                    <th style={{ padding: '8px 4px', fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', width: 32 }}><input type="checkbox" checked={isAllSelected} onChange={toggleSelectAll} style={{ width: 14, height: 14 }} /></th>
                    <th style={{ padding: '8px 4px', fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Title</th>
                    <th style={{ padding: '8px 4px', fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Industry</th>
                    <th style={{ padding: '8px 4px', fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Topics</th>
                    {/* AI Suggestion column removed - suggestions now show under Industry / Topics */}
                    <th style={{ padding: '8px 4px', fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                    <th style={{ padding: '8px 4px', fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((it) => {
                    const a = it.data?.article || {}
                    const d = it.data?.draft || {}
                    const nid = it.id
                    // prefer normalized display title (draft -> article) then fallback to article TitleEN/TitleZH
                    const title = (() => {
                      const t = getDisplayTitle(it)
                      if (t && !/^\d+$/.test(String(t).trim())) return t
                      const a = it.data?.article || {}
                      const fallback = displayLang === 'ZH'
                        ? (a?.TitleZH ?? a?.titleZH ?? a?.Title ?? a?.title)
                        : (a?.TitleEN ?? a?.titleEN ?? a?.Title ?? a?.title)
                      if (fallback && !/^\d+$/.test(String(fallback).trim())) return String(fallback).trim()
                      return `#${nid}`
                    })()
                    // Choose status using taxonomy-aware helpers so items without industry/topics
                    // remain 'Pending' even if server article has published timestamps.
                    let status = 'Pending'
                    if (isScheduled(it)) status = 'Scheduled'
                    else if (isUnpublished(it)) status = 'Unpublished'
                    else if (isLive(it)) status = 'Published'
                    else if (isDrafted(it)) status = 'Drafted'
                    else status = 'Pending'
                    return (
                      <tr key={nid} style={{ borderBottom: '1px solid #f2f2f2' }}>
                        <td style={{ padding: 8, verticalAlign: 'middle' }}><input type="checkbox" checked={selectedIds.includes(nid)} onChange={() => toggleSelect(nid)} /></td>
                        <td style={{ padding: 8, color: '#111', fontSize: 13, lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280, verticalAlign: 'middle' }}>{title}</td>
                        <td style={{ padding: 8, color: '#333', fontSize: 13, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                          {(() => {
                            const sug = suggestions?.[nid]
                            const d = it.data?.draft || {}
                            
                            // If AI suggestion exists for this article, show it with special styling
                            if (sug && (sug.industryTagId || sug.industryTagId === 0) && !sug.error) {
                              const id = sug.industryTagId
                              const found = findTagById(industryList, id)
                              const tagName = found ? resolveTagName(found, String(id)) : String(id)
                              return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ 
                                    padding: '5px 10px', 
                                    borderRadius: 20, 
                                    background: 'linear-gradient(135deg, #BA0006 0%, #8B0005 100%)', 
                                    color: 'white', 
                                    fontSize: 11, 
                                    fontWeight: 600, 
                                    boxShadow: '0 2px 6px rgba(186, 0, 6, 0.25)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4
                                  }}>
                                    <span style={{ fontSize: 12 }}>✨</span>
                                    {tagName}
                                  </span>
                                </div>
                              )
                            }
                            
                            // Check if draft has IndustryTagId (even without full object)
                            const industryId = d?.IndustryTagId ?? d?.IndustryTag?.IndustryTagId ?? d?.IndustryTag?.id
                            if (industryId || industryId === 0) {
                              const found = findTagById(industryList, industryId)
                              const tagName = found ? resolveTagName(found, String(industryId)) : String(industryId)
                              return (
                                <span style={{ 
                                  padding: '5px 10px', 
                                  borderRadius: 20, 
                                  background: '#BA0006', 
                                  color: '#fff', 
                                  fontSize: 11, 
                                  fontWeight: 500,
                                  border: 'none'
                                }}>
                                  {tagName}
                                </span>
                              )
                            }
                            
                            // Default: Unassigned
                            return (
                              <span style={{ 
                                padding: '5px 10px', 
                                borderRadius: 20, 
                                background: '#f5f5f5', 
                                color: '#999', 
                                fontSize: 11, 
                                fontWeight: 500,
                                border: '1px solid #e8e8e8'
                              }}>
                                Unassigned
                              </span>
                            )
                          })()}
                        </td>
                        <td style={{ padding: 8, color: '#333', fontSize: 13, maxWidth: 280, verticalAlign: 'middle' }}>
                          {(() => {
                            const sug = suggestions?.[nid]
                            const d = it.data?.draft || {}
                            
                            // If AI suggestion exists for this article, show tags with special styling
                            if (sug && Array.isArray(sug.interestTagIds) && sug.interestTagIds.length > 0 && !sug.error) {
                              return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                  {sug.interestTagIds.map((id, idx) => {
                                    const found = findTagById(interestList, id)
                                    const name = found ? resolveTagName(found, String(id)) : String(id)
                                    return (
                                      <span key={idx} style={{ 
                                        padding: '4px 8px', 
                                        borderRadius: 16, 
                                        background: 'linear-gradient(135deg, #BA0006 0%, #8B0005 100%)', 
                                        color: 'white', 
                                        fontSize: 10, 
                                        fontWeight: 600, 
                                        boxShadow: '0 2px 6px rgba(186, 0, 6, 0.25)',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 3
                                      }}>
                                        {idx === 0 && <span style={{ fontSize: 10 }}>✨</span>}
                                        {name}
                                      </span>
                                    )
                                  })}
                                </div>
                              )
                            }
                            
                            // Check if draft has InterestTagIds or InterestTags
                            const interestIds = d?.InterestTagIds || (d?.InterestTags || []).map(t => t.InterestTagId ?? t.interestTagId ?? t.id).filter(Boolean)
                            if (Array.isArray(interestIds) && interestIds.length > 0) {
                              return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                  {interestIds.map((id, idx) => {
                                    const found = findTagById(interestList, id)
                                    const name = found ? resolveTagName(found, String(id)) : String(id)
                                    return (
                                      <span key={idx} style={{ 
                                        padding: '4px 8px', 
                                        borderRadius: 16, 
                                        background: '#FFF5F5', 
                                        color: '#BA0006', 
                                        fontSize: 10, 
                                        fontWeight: 500,
                                        border: '1px solid #FFDBDB'
                                      }}>
                                        {name}
                                      </span>
                                    )
                                  })}
                                </div>
                              )
                            }
                            
                            // Default: Unassigned
                            return (
                              <span style={{ 
                                padding: '5px 10px', 
                                borderRadius: 20, 
                                background: '#f5f5f5', 
                                color: '#999', 
                                fontSize: 11, 
                                fontWeight: 500,
                                border: '1px solid #e8e8e8'
                              }}>
                                Unassigned
                              </span>
                            )
                          })()}
                        </td>
                        {/* AI suggestion cell removed to keep table columns aligned; suggestions show under Industry/Topics */}
                        <td style={{ padding: 6 }}>
                          <span style={{
                            padding: '3px 6px',
                            borderRadius: 8,
                            fontSize: 10,
                            fontWeight: 500,
                            background: status === 'Unpublished' ? '#fdecea' : (status === 'Pending' ? '#e6f0ff' : (status === 'Scheduled' ? '#fff4e6' : (status === 'Drafted' ? '#f5f5f5' : '#e8f9ee'))),
                            color: status === 'Unpublished' ? '#c62828' : (status === 'Pending' ? '#1e73d1' : (status === 'Scheduled' ? '#e07a16' : (status === 'Drafted' ? '#aaa' : '#1e7a3a')))
                          }}>{status}</span>
                        </td>
                        <td style={{ padding: 6 }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {isLive(it) ? (
                              <>
                                <button 
                                  onClick={() => setArticlePreview({ id: nid, data: it.data })}
                                  title="Preview article"
                                  style={{ 
                                    background: 'linear-gradient(135deg, #BA0006 0%, #8B0005 100%)', 
                                    color: 'white', 
                                    border: 'none', 
                                    padding: '4px 8px', 
                                    borderRadius: 4, 
                                    fontSize: 11,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4
                                  }}
                                >
                                  👁️
                                </button>
                                <button onClick={() => handleUnpublishArticle(nid)} style={{ background: '#777', color: 'white', border: 'none', padding: '4px 8px', borderRadius: 4, fontSize: 11 }}>Unpublish</button>
                              </>
                            ) : (
                              <>
                                <button style={{ background: '#c92b2b', color: 'white', border: 'none', padding: '4px 8px', borderRadius: 4, fontSize: 11 }} onClick={() => navigate(`/consultant/publish/${nid}`)}>{isUnpublished(it) ? 'Re-publish' : (isDrafted(it) || isScheduled(it) ? 'Edit' : 'Start')}</button>
                                <button
                                  title="Delete article"
                                  onClick={() => handleDeleteArticle(nid)}
                                  style={{ background: 'transparent', color: '#c43d3d', border: '1px solid #f2dede', padding: '4px 6px', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
                                >
                                  🗑️
                                </button>
                              </>
                            )}
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

              {/* Article Preview Modal */}
              {articlePreview && (
                <div 
                  style={{ 
                    position: 'fixed', 
                    inset: 0, 
                    background: 'rgba(0,0,0,0.6)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    zIndex: 3000,
                    backdropFilter: 'blur(4px)'
                  }} 
                  onClick={() => setArticlePreview(null)}
                >
                  <div 
                    style={{ 
                      width: '90%', 
                      maxWidth: 800, 
                      maxHeight: '90vh', 
                      overflow: 'hidden', 
                      background: '#fff', 
                      borderRadius: 16, 
                      boxShadow: '0 25px 80px rgba(0,0,0,0.3)',
                      display: 'flex',
                      flexDirection: 'column'
                    }} 
                    onClick={e => e.stopPropagation()}
                  >
                    {/* Modal Header */}
                    <div style={{ 
                      padding: '16px 20px', 
                      borderBottom: '1px solid #f0f0f0',
                      background: 'linear-gradient(135deg, #BA0006 0%, #8B0005 100%)',
                      color: 'white',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 20 }}>📰</span>
                        <span style={{ fontWeight: 700, fontSize: 16 }}>Article Preview</span>
                      </div>
                      <button 
                        onClick={() => setArticlePreview(null)} 
                        style={{ 
                          background: 'rgba(255,255,255,0.2)', 
                          border: 'none', 
                          color: 'white',
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          fontSize: 16, 
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >✕</button>
                    </div>

                    {/* Modal Body */}
                    <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
                      {(() => {
                        const d = articlePreview?.data?.draft || {}
                        const a = articlePreview?.data?.article || {}
                        const heroUrl = d.HeroImageUrl || a.HeroImageUrl || null
                        const titleEN = d.TitleEN || d.titleEN || a.TitleEN || a.titleEN || a.Title || a.title || ''
                        const titleZH = d.TitleZH || d.titleZH || a.TitleZH || a.titleZH || ''
                        const summaryEN = d.SummaryEN || d.summaryEN || a.SummaryEN || a.summaryEN || a.Summary || a.summary || ''
                        const summaryZH = d.SummaryZH || d.summaryZH || a.SummaryZH || a.summaryZH || ''
                        const contentEN = d.FullContentEN || d.fullContentEN || a.FullContentEN || a.fullContentEN || a.FullContent || a.fullContent || a.Body || a.body || ''
                        const contentZH = d.FullContentZH || d.fullContentZH || a.FullContentZH || a.fullContentZH || ''
                        
                        // Get industry tag
                        const industryId = d.IndustryTagId || d.IndustryTag?.IndustryTagId || d.IndustryTag?.id || a.IndustryTagId
                        const industryTag = industryId ? findTagById(industryList, industryId) : null
                        const industryName = industryTag ? resolveTagName(industryTag, String(industryId)) : (industryId ? String(industryId) : 'Unassigned')
                        
                        // Get interest tags
                        const interestIds = d.InterestTagIds || (d.InterestTags ? d.InterestTags.map(t => t.InterestTagId || t.id) : []) || a.InterestTagIds || []
                        const interestNames = interestIds.map(id => {
                          const tag = findTagById(interestList, id)
                          return tag ? resolveTagName(tag, String(id)) : String(id)
                        })

                        // Normalize hero URL
                        const displayHeroUrl = (() => {
                          if (!heroUrl) return null
                          if (/^data:|^https?:\/\//i.test(heroUrl)) return heroUrl
                          const apiBase = (import.meta.env.VITE_API_BASE || window.location.origin)
                          if (heroUrl.includes('hero_placeholder.svg')) {
                            return window.location.origin.replace(/\/$/, '') + (heroUrl.startsWith('/') ? heroUrl : '/' + heroUrl)
                          }
                          try {
                            return apiBase.replace(/\/$/, '') + (heroUrl.startsWith('/') ? heroUrl : '/' + heroUrl)
                          } catch (e) {
                            return heroUrl
                          }
                        })()

                        return (
                          <div>
                            {/* Hero Image */}
                            <div style={{ marginBottom: 20, borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
                              <img
                                src={displayHeroUrl || '/assets/generated/hero_placeholder.svg'}
                                alt="Hero"
                                style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }}
                                onError={(e) => { try { e.currentTarget.src = '/assets/generated/hero_placeholder.svg' } catch (err) {} }}
                              />
                            </div>

                            {/* Tags Section */}
                            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                              <div style={{ 
                                padding: '8px 14px', 
                                borderRadius: 20, 
                                background: 'linear-gradient(135deg, #BA0006 0%, #8B0005 100%)', 
                                color: 'white', 
                                fontSize: 12, 
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6
                              }}>
                                <span>🏢</span> {industryName}
                              </div>
                              {interestNames.length > 0 && interestNames.map((name, idx) => (
                                <div key={idx} style={{ 
                                  padding: '8px 14px', 
                                  borderRadius: 20, 
                                  background: '#FFF5F5', 
                                  color: '#BA0006', 
                                  fontSize: 12, 
                                  fontWeight: 500,
                                  border: '1px solid #FFDBDB'
                                }}>
                                  {name}
                                </div>
                              ))}
                            </div>

                            {/* Titles */}
                            <div style={{ marginBottom: 16 }}>
                              <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Title (English)</div>
                              <div style={{ fontSize: 18, fontWeight: 700, color: '#222', lineHeight: 1.4 }}>{titleEN || '—'}</div>
                            </div>
                            {titleZH && (
                              <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Title (中文)</div>
                                <div style={{ fontSize: 16, fontWeight: 600, color: '#333', lineHeight: 1.4 }}>{titleZH}</div>
                              </div>
                            )}

                            {/* Summaries */}
                            {(summaryEN || summaryZH) && (
                              <div style={{ marginBottom: 16, padding: 16, background: '#f9f9f9', borderRadius: 10, borderLeft: '4px solid #BA0006' }}>
                                <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Summary</div>
                                {summaryEN && <div style={{ fontSize: 14, color: '#444', lineHeight: 1.6, marginBottom: summaryZH ? 12 : 0 }}>{summaryEN}</div>}
                                {summaryZH && <div style={{ fontSize: 14, color: '#666', lineHeight: 1.6 }}>{summaryZH}</div>}
                              </div>
                            )}

                            {/* Content */}
                            <div style={{ marginBottom: 8 }}>
                              <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Full Content</div>
                              <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: contentZH ? '1fr 1fr' : '1fr', 
                                gap: 16 
                              }}>
                                <div style={{ 
                                  padding: 16, 
                                  background: '#fafafa', 
                                  borderRadius: 10, 
                                  maxHeight: 300, 
                                  overflow: 'auto',
                                  border: '1px solid #eee'
                                }}>
                                  <div style={{ fontSize: 10, color: '#aaa', marginBottom: 8, fontWeight: 600 }}>EN</div>
                                  <div style={{ fontSize: 13, color: '#333', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{contentEN || '—'}</div>
                                </div>
                                {contentZH && (
                                  <div style={{ 
                                    padding: 16, 
                                    background: '#fafafa', 
                                    borderRadius: 10, 
                                    maxHeight: 300, 
                                    overflow: 'auto',
                                    border: '1px solid #eee'
                                  }}>
                                    <div style={{ fontSize: 10, color: '#aaa', marginBottom: 8, fontWeight: 600 }}>中文</div>
                                    <div style={{ fontSize: 13, color: '#333', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{contentZH}</div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })()}
                    </div>

                    {/* Modal Footer */}
                    <div style={{ 
                      padding: '14px 20px', 
                      borderTop: '1px solid #f0f0f0',
                      display: 'flex',
                      justifyContent: 'flex-end'
                    }}>
                      <button 
                        onClick={() => setArticlePreview(null)}
                        style={{ 
                          padding: '10px 20px', 
                          borderRadius: 8, 
                          background: '#f5f5f5', 
                          color: '#666', 
                          border: 'none',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >Close</button>
                    </div>
                  </div>
                </div>
              )}

              {quickModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }} onClick={() => setQuickModalOpen(false)}>
                  <div style={{ width: '90%', maxWidth: 980, maxHeight: '90vh', overflow: 'auto', background: '#fff', padding: 18, borderRadius: 8 }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{quickModalAction === 'schedule' ? 'Quick Schedule' : 'Quick Publish'}</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {quickModalAction === 'schedule' && <input type="datetime-local" value={modalScheduledAt} onChange={e => setModalScheduledAt(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #e6e6e6' }} />}
                        <button onClick={() => setQuickModalOpen(false)} style={{ padding: '8px 12px', borderRadius: 6 }}>Close</button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {modalArticles.map((m) => (
                        <div key={m.id} style={{ border: '1px solid #f0f0f0', padding: 12, borderRadius: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ fontWeight: 700 }}>{m.TitleEN || `#${m.id}`}</div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={m.applyAISuggest} onChange={e => updateModalArticle(m.id, { applyAISuggest: e.target.checked })} />Apply AI suggestion</label>
                              <button onClick={() => handleGenerateHeroFor(m.id)} style={{ padding: '6px 10px', borderRadius: 6, background: '#1976d2', color: '#fff', border: 'none' }}>Generate Image</button>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                              <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Title (EN)</div>
                              <input value={m.TitleEN} onChange={e => updateModalArticle(m.id, { TitleEN: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e6e6e6' }} />
                              <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>Full Content (EN)</div>
                              <textarea value={m.FullContentEN} onChange={e => updateModalArticle(m.id, { FullContentEN: e.target.value })} rows={6} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e6e6e6' }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Title (ZH)</div>
                              <input value={m.TitleZH} onChange={e => updateModalArticle(m.id, { TitleZH: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e6e6e6' }} />
                              <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>Full Content (ZH)</div>
                              <textarea value={m.FullContentZH} onChange={e => updateModalArticle(m.id, { FullContentZH: e.target.value })} rows={6} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e6e6e6' }} />
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center' }}>
                            <div style={{ minWidth: 220 }}>
                              <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Industry</div>
                              <select value={m.IndustryTagId || ''} onChange={e => updateModalArticle(m.id, { IndustryTagId: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e6e6e6' }}>
                                <option value=''>Unassigned</option>
                                {industryList.map((it, i) => (<option key={i} value={it.industryTagId ?? it.IndustryTagId ?? it.id}>{resolveTagName(it, String(it.industryTagId ?? it.IndustryTagId ?? it.id))}</option>))}
                              </select>
                            </div>

                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Topics Of Interest</div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {interestList.map((t, idx) => {
                                  const idStr = t.interestTagId ?? t.InterestTagId ?? t.id
                                  const checked = (m.InterestTagIds || []).map(x => String(x)).includes(String(idStr))
                                  return (
                                    <label key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                      <input type="checkbox" checked={checked} onChange={e => {
                                        const cur = (m.InterestTagIds || []).slice()
                                        const sid = idStr
                                        if (e.target.checked) cur.push(sid)
                                        else {
                                          const i = cur.findIndex(x => String(x) === String(sid))
                                          if (i >= 0) cur.splice(i, 1)
                                        }
                                        updateModalArticle(m.id, { InterestTagIds: cur })
                                      }} />
                                      <div style={{ padding: '6px 10px', borderRadius: 12, background: checked ? '#fff4f4' : '#fff', color: '#c92b2b' }}>{resolveTagName(t, String(t.interestTagId ?? t.InterestTagId ?? t.id))}</div>
                                    </label>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                      <button onClick={() => { setQuickModalOpen(false) }} style={{ padding: '8px 12px', borderRadius: 6 }}>Cancel</button>
                      <button onClick={submitQuickModal} style={{ padding: '8px 12px', borderRadius: 6, background: quickModalAction === 'schedule' ? '#e07a16' : '#1e7a3a', color: '#fff', border: 'none' }}>{quickModalAction === 'schedule' ? 'Schedule Selected' : 'Publish Now'}</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Schedule Modal */}
              {quickScheduleModalOpen && (
                <div 
                  style={{ 
                    position: 'fixed', 
                    inset: 0, 
                    background: 'rgba(0,0,0,0.6)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    zIndex: 3000,
                    backdropFilter: 'blur(4px)'
                  }} 
                  onClick={() => !quickScheduleProcessing && setQuickScheduleModalOpen(false)}
                >
                  <div 
                    style={{ 
                      width: '90%', 
                      maxWidth: 700, 
                      maxHeight: '90vh', 
                      overflow: 'hidden', 
                      background: '#fff', 
                      borderRadius: 16, 
                      boxShadow: '0 25px 80px rgba(0,0,0,0.3)',
                      display: 'flex',
                      flexDirection: 'column'
                    }} 
                    onClick={e => e.stopPropagation()}
                  >
                    {/* Modal Header */}
                    <div style={{ 
                      padding: '20px 24px', 
                      borderBottom: '1px solid #f0f0f0',
                      background: 'linear-gradient(135deg, #e07a16 0%, #c96a12 100%)',
                      color: 'white'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                            <span style={{ fontSize: 24 }}>📅</span>
                            <span style={{ fontWeight: 700, fontSize: 20 }}>Quick Schedule Articles</span>
                          </div>
                          <div style={{ fontSize: 13, opacity: 0.9 }}>
                            Schedule {quickScheduleArticles.length} article{quickScheduleArticles.length !== 1 ? 's' : ''} with AI-powered classification and hero images
                          </div>
                        </div>
                        <button 
                          onClick={() => !quickScheduleProcessing && setQuickScheduleModalOpen(false)}
                          disabled={quickScheduleProcessing}
                          style={{ 
                            background: 'rgba(255,255,255,0.2)', 
                            border: 'none', 
                            color: 'white',
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            fontSize: 18, 
                            cursor: quickScheduleProcessing ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: quickScheduleProcessing ? 0.5 : 1
                          }}
                        >✕</button>
                      </div>
                    </div>

                    {/* Modal Body */}
                    <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
                      {/* Article List */}
                      <div style={{ padding: '16px 24px', maxHeight: 320, overflow: 'auto' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                          Selected Articles
                        </div>
                        {quickScheduleArticles.length === 0 ? (
                          <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
                            No articles selected
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {quickScheduleArticles.map((article) => (
                              <div 
                                key={article.id} 
                                style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: 12, 
                                  padding: 12, 
                                  background: '#f9f9f9', 
                                  borderRadius: 10,
                                  border: '1px solid #eee'
                                }}
                              >
                                {/* Hero Image Thumbnail */}
                                <div style={{ 
                                  width: 64, 
                                  height: 48, 
                                  borderRadius: 6, 
                                  overflow: 'hidden',
                                  background: '#e0e0e0',
                                  flexShrink: 0,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}>
                                  <img
                                    src={article.heroUrl || '/assets/generated/hero_placeholder.svg'}
                                    alt="Hero"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                    onError={(e) => {
                                      try { e.currentTarget.src = '/assets/generated/hero_placeholder.svg' } catch (err) { /* noop */ }
                                    }}
                                  />
                                </div>

                                {/* Article Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ 
                                    fontWeight: 600, 
                                    fontSize: 13, 
                                    color: '#333',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    marginBottom: 4
                                  }}>
                                    {article.title}
                                  </div>
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {article.industryName && (
                                      <span style={{ 
                                        padding: '2px 8px', 
                                        borderRadius: 10, 
                                        background: '#BA0006', 
                                        color: 'white', 
                                        fontSize: 10,
                                        fontWeight: 500
                                      }}>
                                        {article.industryName}
                                      </span>
                                    )}
                                    {article.interestNames.slice(0, 2).map((name, idx) => (
                                      <span key={idx} style={{ 
                                        padding: '2px 8px', 
                                        borderRadius: 10, 
                                        background: '#FFF5F5', 
                                        color: '#BA0006', 
                                        fontSize: 10,
                                        fontWeight: 500,
                                        border: '1px solid #FFDBDB'
                                      }}>
                                        {name}
                                      </span>
                                    ))}
                                    {article.interestNames.length > 2 && (
                                      <span style={{ 
                                        padding: '2px 6px', 
                                        fontSize: 10,
                                        color: '#999'
                                      }}>
                                        +{article.interestNames.length - 2}
                                      </span>
                                    )}
                                    {!article.industryName && article.interestNames.length === 0 && (
                                      <span style={{ 
                                        padding: '2px 8px', 
                                        borderRadius: 10, 
                                        background: '#E3F2FD', 
                                        color: '#1976d2', 
                                        fontSize: 10,
                                        fontWeight: 500
                                      }}>
                                        🤖 AI will classify
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button
                                    onClick={() => removeFromQuickSchedule(article.id)}
                                    disabled={quickScheduleProcessing}
                                    style={{
                                      width: 32,
                                      height: 32,
                                      borderRadius: 6,
                                      border: '1px solid #ffcdd2',
                                      background: '#fff5f5',
                                      color: '#d32f2f',
                                      cursor: quickScheduleProcessing ? 'not-allowed' : 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: 14,
                                      fontWeight: 600,
                                      opacity: quickScheduleProcessing ? 0.5 : 1
                                    }}
                                    title="Remove from selection"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Schedule DateTime Picker */}
                      <div style={{ padding: '16px 24px', borderTop: '1px solid #f0f0f0', background: '#fafafa' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                          Schedule Date & Time
                        </div>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          <input 
                            type="date"
                            value={quickScheduleDate ? quickScheduleDate.split('T')[0] : ''}
                            onChange={(e) => {
                              const time = quickScheduleDate ? quickScheduleDate.split('T')[1] || '09:00' : '09:00'
                              setQuickScheduleDate(e.target.value ? `${e.target.value}T${time}` : '')
                            }}
                            min={new Date().toISOString().split('T')[0]}
                            disabled={quickScheduleProcessing}
                            style={{ 
                              padding: '10px 14px', 
                              borderRadius: 8, 
                              border: '1px solid #ddd', 
                              fontSize: 14,
                              flex: 1,
                              background: quickScheduleProcessing ? '#f5f5f5' : 'white'
                            }}
                          />
                          <input 
                            type="time"
                            value={quickScheduleDate ? quickScheduleDate.split('T')[1]?.substring(0,5) || '09:00' : '09:00'}
                            onChange={(e) => {
                              const date = quickScheduleDate ? quickScheduleDate.split('T')[0] : new Date().toISOString().split('T')[0]
                              setQuickScheduleDate(`${date}T${e.target.value}`)
                            }}
                            disabled={quickScheduleProcessing}
                            style={{ 
                              padding: '10px 14px', 
                              borderRadius: 8, 
                              border: '1px solid #ddd', 
                              fontSize: 14,
                              width: 120,
                              background: quickScheduleProcessing ? '#f5f5f5' : 'white'
                            }}
                          />
                        </div>
                      </div>

                      {/* AI Info Box */}
                      <div style={{ padding: '16px 24px' }}>
                        <div style={{ 
                          background: '#E3F2FD', 
                          border: '1px solid #BBDEFB', 
                          borderRadius: 10, 
                          padding: 14,
                          display: 'flex',
                          gap: 12,
                          alignItems: 'flex-start'
                        }}>
                          <span style={{ fontSize: 20 }}>🤖</span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: '#1565C0', marginBottom: 4 }}>
                              AI will automatically:
                            </div>
                            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#1976d2', lineHeight: 1.8 }}>
                              <li>Assign industry classification to unclassified articles</li>
                              <li>Assign topics of interest tags</li>
                              <li>Generate hero images for articles without one</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {quickScheduleProcessing && (
                        <div style={{ padding: '0 24px 16px' }}>
                          <div style={{ 
                            background: '#f5f5f5', 
                            borderRadius: 8, 
                            padding: 14,
                            border: '1px solid #e0e0e0'
                          }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 8 }}>
                              {quickScheduleProgress.status || 'Processing...'}
                            </div>
                            <div style={{ 
                              height: 8, 
                              background: '#e0e0e0', 
                              borderRadius: 4, 
                              overflow: 'hidden' 
                            }}>
                              <div style={{ 
                                height: '100%', 
                                background: 'linear-gradient(90deg, #e07a16, #c96a12)',
                                borderRadius: 4,
                                width: `${quickScheduleProgress.total > 0 ? (quickScheduleProgress.current / quickScheduleProgress.total) * 100 : 0}%`,
                                transition: 'width 0.3s ease'
                              }} />
                            </div>
                            <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>
                              {quickScheduleProgress.current} of {quickScheduleProgress.total} complete
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Modal Footer */}
                    <div style={{ 
                      padding: '16px 24px', 
                      borderTop: '1px solid #f0f0f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: '#fafafa'
                    }}>
                      <div style={{ fontSize: 12, color: '#666' }}>
                        {quickScheduleArticles.length} article{quickScheduleArticles.length !== 1 ? 's' : ''} selected
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button 
                          onClick={() => setQuickScheduleModalOpen(false)}
                          disabled={quickScheduleProcessing}
                          style={{ 
                            padding: '10px 20px', 
                            borderRadius: 8, 
                            background: '#f5f5f5', 
                            color: '#666', 
                            border: 'none',
                            fontWeight: 600,
                            cursor: quickScheduleProcessing ? 'not-allowed' : 'pointer',
                            opacity: quickScheduleProcessing ? 0.5 : 1
                          }}
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={submitQuickSchedule}
                          disabled={quickScheduleProcessing || !quickScheduleDate || quickScheduleArticles.length === 0}
                          style={{ 
                            padding: '10px 24px', 
                            borderRadius: 8, 
                            background: (quickScheduleProcessing || !quickScheduleDate || quickScheduleArticles.length === 0) 
                              ? '#ccc' 
                              : 'linear-gradient(135deg, #e07a16 0%, #c96a12 100%)', 
                            color: 'white', 
                            border: 'none',
                            fontWeight: 600,
                            cursor: (quickScheduleProcessing || !quickScheduleDate || quickScheduleArticles.length === 0) ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                          }}
                        >
                          {quickScheduleProcessing ? (
                            <>
                              <span style={{ 
                                display: 'inline-block', 
                                width: 14, 
                                height: 14, 
                                border: '2px solid rgba(255,255,255,0.3)', 
                                borderTopColor: 'white', 
                                borderRadius: '50%', 
                                animation: 'spin 1s linear infinite' 
                              }} />
                              Processing...
                            </>
                          ) : (
                            <>
                              <span>📅</span> Confirm Schedule
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16, gap: 12 }}>
              <div style={{ background: 'white', padding: 8, borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <button onClick={() => setPagePersist(Math.max(1, page - 1))} disabled={page <= 1} style={{ background: 'transparent', border: 'none', padding: '6px 8px', cursor: page <= 1 ? 'default' : 'pointer', color: page <= 1 ? '#ccc' : '#999', fontSize: 16 }}>◀</button>
                {(() => {
                  const buttons = []
                  for (let p = 1; p <= totalPages; p++) {
                    const isActive = p === page
                    buttons.push(
                      <button key={p} onClick={() => setPagePersist(p)} style={{ background: isActive ? '#c92b2b' : '#f5f5f5', color: isActive ? 'white' : '#555', border: 'none', padding: '6px 10px', borderRadius: 6, fontWeight: 600, minWidth: 32, cursor: isActive ? 'default' : 'pointer', fontSize: 13, margin: '0 3px' }}>{p}</button>
                    )
                  }
                  return buttons
                })()}
                <button onClick={() => setPagePersist(Math.min(totalPages, page + 1))} disabled={page >= totalPages} style={{ background: 'transparent', border: 'none', padding: '6px 8px', cursor: page >= totalPages ? 'default' : 'pointer', color: page >= totalPages ? '#ccc' : '#999', fontSize: 16 }}>▶</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
