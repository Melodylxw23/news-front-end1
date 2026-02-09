import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getPublishDraft, batchPublish, getArticle, patchPublishDraft, generateHeroImage, publishAction, getIndustryTags, getInterestTags } from '../../api/articles'

const palette = {
  bg: '#fbf8f6',
  card: '#ffffff',
  primary: '#1e73d1',
  accent: '#e07a16',
  success: '#1e7a3a',
  muted: '#666'
}

const styles = {
  page: { padding: '12px 20px', background: 'transparent', minHeight: '100vh', boxSizing: 'border-box' },
  card: { background: palette.card, padding: 12, borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.05)', boxSizing: 'border-box' },
  sidebar: { background: palette.card, padding: 12, borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.05)' },
  heading: { fontSize: 13, fontWeight: 700, color: '#444', marginBottom: 4 }
}

export default function PublishArticle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const LAST_STATE_KEY = 'publishQueue.lastState'
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [dataEn, setDataEn] = useState(null)
  const [dataZh, setDataZh] = useState(null)
  const [lang, setLang] = useState('en') // 'en' | 'cn'
  const [publishMode, setPublishMode] = useState('now') // 'now' | 'schedule' | 'draft'
  const [scheduledAt, setScheduledAt] = useState('')
  const [toast, setToast] = useState(null)

  useEffect(() => { if (id) load() }, [id])

  const load = async () => {
    setLoading(true)
    try {
      const [pubRes, enRes, zhRes, industriesRes, interestsRes] = await Promise.allSettled([
        getPublishDraft(id),
        getArticle(id, 'en'),
        getArticle(id, 'zh'),
        getIndustryTags(),
        getInterestTags()
      ])
      if (pubRes.status === 'fulfilled') {
        // server may return null on network/protocol errors or an empty payload;
        // fallback to client-side publishQueue entry so saved drafts are visible when offline
        const pubVal = pubRes.value?.data ?? pubRes.value
        if (pubVal && Object.keys(pubVal || {}).length > 0) {
          setData(pubVal)
          try {
            const s = pubVal?.draft?.ScheduledAt ?? pubVal?.draft?.scheduledAt
            if (s) setScheduledAt(formatForInput(s))
            else setScheduledAt('')
          } catch (e) { /* ignore */ }
        } else {
          try {
            const raw = JSON.parse(localStorage.getItem('publishQueue') || '[]')
            const entries = Array.isArray(raw) ? raw : []
            const found = entries.find(e => Number(e?.id ?? e) === Number(id))
            if (found) {
              // stored shape: { id, data: { article, draft, en, zh } }
              const entryData = found.data || found
              // normalize draft taxonomy from available tag lists so UI checks (canPublish)
              try {
                const industriesRaw = industriesRes && industriesRes.status === 'fulfilled' ? (industriesRes.value?.data ?? industriesRes.value) : []
                const interestsRaw = interestsRes && interestsRes.status === 'fulfilled' ? (interestsRes.value?.data ?? interestsRes.value) : []
                const industries = Array.isArray(industriesRaw) ? industriesRaw.map(i => ({ id: i.industryTagId ?? i.IndustryTagId ?? i.industryId ?? i.industryId ?? i.id, IndustryTagId: i.industryTagId ?? i.IndustryTagId ?? i.id, NameEN: i.nameEN ?? i.NameEN ?? i.Name ?? '', NameZH: i.nameZH ?? i.NameZH ?? i.Name ?? '' })) : []
                const interests = Array.isArray(interestsRaw) ? interestsRaw.map(i => ({ id: i.interestTagId ?? i.InterestTagId ?? i.id, InterestTagId: i.interestTagId ?? i.InterestTagId ?? i.id, NameEN: i.nameEN ?? i.NameEN ?? i.Name ?? '', NameZH: i.nameZH ?? i.NameZH ?? i.Name ?? '' })) : []
                const normalized = { ...(entryData || {}) }
                const d = normalized.draft || {}
                // normalize IndustryTagId and attach IndustryTag object when possible
                const iid = d.IndustryTagId ?? d.IndustryTag?.IndustryTagId ?? d.IndustryTag?.id
                if (typeof iid !== 'undefined' && iid !== null && iid !== '') {
                  const num = Number(iid)
                  if (!Number.isNaN(num)) {
                    normalized.draft = { ...(normalized.draft || {}), IndustryTagId: num }
                    const foundInd = industries.find(x => String(x.id) === String(num) || String(x.IndustryTagId) === String(num))
                    if (foundInd) normalized.draft.IndustryTag = foundInd
                  }
                }
                // normalize InterestTagIds -> InterestTags
                const itIds = Array.isArray(d.InterestTagIds) ? d.InterestTagIds.map(x => Number(x)).filter(x => !Number.isNaN(x)) : (Array.isArray(d.InterestTags) && d.InterestTags.length ? d.InterestTags.map(t => (t.InterestTagId ?? t.id)).map(x => Number(x)).filter(x => !Number.isNaN(x)) : [])
                if (itIds && itIds.length > 0) {
                  const uniq = Array.from(new Set(itIds.map(x => String(x)))).map(x => Number(x))
                  normalized.draft = { ...(normalized.draft || {}), InterestTagIds: uniq }
                  const objs = uniq.map(id => interests.find(x => String(x.id ?? x.InterestTagId) === String(id))).filter(Boolean)
                  if (objs.length > 0) normalized.draft.InterestTags = objs
                }
                setData(normalized)
              } catch (e) {
                setData(entryData)
              }
            } else {
              setData(pubVal)
            }
          } catch (e) {
            setData(pubVal)
          }
        }
      }
      if (enRes.status === 'fulfilled') setDataEn(enRes.value?.data ?? enRes.value)
      if (zhRes.status === 'fulfilled') setDataZh(zhRes.value?.data ?? zhRes.value)
      // attach industry/interest lists to data for use in UI
      if (industriesRes && industriesRes.status === 'fulfilled') {
        const listRaw = industriesRes.value?.data ?? industriesRes.value
        const mapped = Array.isArray(listRaw) ? listRaw.map(i => {
          const id = i.industryTagId ?? i.IndustryTagId ?? i.IndustryId ?? i.industryId ?? i.id
          return {
            id: id,
            IndustryTagId: i.industryTagId ?? i.IndustryTagId ?? id,
            NameEN: i.nameEN ?? i.NameEN ?? i.NameEn ?? i.Name ?? i.titleEN ?? i.TitleEN ?? i.title ?? i.Title ?? '',
            NameZH: i.nameZH ?? i.NameZH ?? i.NameZh ?? i.NameZh ?? i.Name ?? i.titleZH ?? i.TitleZH ?? ''
          }
        }) : []
        setData(prev => ({ ...(prev || {}), industries: mapped }))
      }
      if (interestsRes && interestsRes.status === 'fulfilled') {
        const listRaw = interestsRes.value?.data ?? interestsRes.value
        const mapped = Array.isArray(listRaw) ? listRaw.map(i => {
          const id = i.interestTagId ?? i.InterestTagId ?? i.InterestId ?? i.interestId ?? i.id
          return {
            id: id,
            InterestTagId: i.interestTagId ?? i.InterestTagId ?? id,
            NameEN: i.nameEN ?? i.NameEN ?? i.NameEn ?? i.Name ?? i.titleEN ?? i.TitleEN ?? i.title ?? i.Title ?? '',
            NameZH: i.nameZH ?? i.NameZH ?? i.NameZh ?? i.NameZh ?? i.Name ?? i.titleZH ?? i.TitleZH ?? ''
          }
        }) : []
        setData(prev => ({ ...(prev || {}), interests: mapped }))
      }
      if (pubRes.status !== 'fulfilled' && enRes.status !== 'fulfilled' && zhRes.status !== 'fulfilled') {
        const firstErr = pubRes.reason || enRes.reason || zhRes.reason || 'Failed to load'
        throw firstErr
      }
    } catch (e) {
      console.error(e)
      setToast({ type: 'error', message: 'Failed to load article' })
    } finally { setLoading(false) }
  }
  // utilities copied/adapted from ArticleReview for robust field extraction & sanitization
  const safeStringify = (obj) => {
    try {
      return JSON.stringify(obj, null, 2)
    } catch (e) {
      try { return String(obj) } catch (e2) { return '' }
    }
  }
  const asText = (val) => {
    if (val == null) return ''
    return typeof val === 'string' ? val : safeStringify(val)
  }

  const decodeEntities = (s) => {
    if (!s || typeof s !== 'string') return s
    let t = s
    t = t.replace(/&amp;(#?\w+);/g, '&$1;')
    try {
      const textarea = document.createElement('textarea')
      textarea.innerHTML = t
      return textarea.value
    } catch (e) {
      return t
    }
  }

  const sanitize = (s) => {
    if (!s || typeof s !== 'string') return ''
    let t = s
    try { t = decodeEntities(t) } catch (e) {}
    t = t.replace(/&emsp;+/g, ' ')
    t = t.replace(/\u00A0/g, ' ')
    t = t.replace(/&gt;/g, '>')
    t = t.replace(/<li[^>]*>/gi, '\n- ')
    t = t.replace(/<\/li>/gi, '')
    t = t.replace(/<ul[^>]*>/gi, '\n')
    t = t.replace(/<\/ul>/gi, '\n')
    t = t.replace(/<ol[^>]*>/gi, '\n')
    t = t.replace(/<\/ol>/gi, '\n')
    t = t.replace(/<br\s*\/?>(\s*)/gi, '\n')
    t = t.replace(/<p[^>]*>/gi, '\n')
    t = t.replace(/<\/p>/gi, '\n')
    t = t.replace(/<[^>]+>/g, '')
    const lines = t.split('\n')
    const cleaned = []
    for (let line of lines) {
      const l = line.trim()
      if (!l) continue
      // drop obvious UI strings
      if (/^(Source:|Source:\s|Font:|Share:|Read next:|Read the next article:|\[Correction\])/i.test(l)) continue
      cleaned.push(line)
    }
    let out = cleaned.join('\n')
    out = out.replace(/Read next:[\s\S]*$/i, '')
    out = out.replace(/Read the next article:[\s\S]*$/i, '')
    out = out.replace(/阅读下一篇[\s\S]*$/i, '')
    out = out.replace(/\n{3,}/g, '\n\n')
    return out.trim()
  }

  const containsCJK = (s) => typeof s === 'string' && /[\u4E00-\u9FFF]/.test(s)

  const getField = (key) => {
    const a = data?.article || {}
    const d = data?.draft || {}
    const first = (v) => (v === null || typeof v === 'undefined') ? '' : (typeof v === 'string' ? v : String(v))

    // Build common key variants to match backend naming differences.
    const cap = key && key.length ? key.charAt(0).toUpperCase() + key.slice(1) : key
    const enKeys = [`${key}EN`, `${key}En`, `${key}en`, key, `${cap}EN`, `${cap}En`, `${cap}en`, cap]
    const zhKeys = [`${key}ZH`, `${key}Zh`, `${cap}ZH`, `${cap}Zh`]

    const collect = (keys) => {
      const vals = []
      for (const k of keys) vals.push(d?.[k])
      for (const k of keys) vals.push(a?.[k])
      // also consider article payloads fetched separately for language views
      for (const k of keys) vals.push(dataEn?.[k])
      for (const k of keys) vals.push(dataZh?.[k])
      return vals.map(first).filter(Boolean)
    }

    const enCandidates = collect(enKeys)
    const zhCandidates = collect(zhKeys)

    const pick = (arr) => {
      if (!arr || arr.length === 0) return ''
      for (const v of arr) {
        const s = sanitize(asText(v))
        if (s && s.trim()) return s
      }
      return asText(arr[0])
    }

    return { en: pick(enCandidates), zh: pick(zhCandidates) }
  }
  
  const formatForInput = (s) => {
    if (!s) return ''
    try {
      const d = new Date(s)
      if (Number.isNaN(d.getTime())) return ''
      const pad = (n) => String(n).padStart(2, '0')
      const yyyy = d.getFullYear()
      const mm = pad(d.getMonth() + 1)
      const dd = pad(d.getDate())
      const hh = pad(d.getHours())
      const min = pad(d.getMinutes())
      return `${yyyy}-${mm}-${dd}T${hh}:${min}`
    } catch (e) { return '' }
  }

  useEffect(() => {
    try {
      const s = data?.draft?.ScheduledAt ?? data?.draft?.scheduledAt
      if (s) {
        const formatted = formatForInput(s)
        if (formatted) setScheduledAt(formatted)
      }
    } catch (e) { /* ignore */ }
  }, [data?.draft?.ScheduledAt, data?.draft?.scheduledAt])

  const heroUrl = () => {
    return data?.draft?.HeroImageUrl ?? data?.article?.HeroImageUrl ?? ''
  }

  const removeFromLocalQueue = (removeId) => {
    try {
      const raw = JSON.parse(localStorage.getItem('publishQueue') || '[]')
      const entries = Array.isArray(raw) ? raw : []
      const idNum = Number(removeId)
      const updated = entries.filter(e => {
        if (typeof e === 'number') return Number(e) !== idNum
        const eid = Number(e.id ?? e.NewsArticleId ?? e.article?.NewsArticleId ?? e.article?.id)
        return eid !== idNum
      })
      localStorage.setItem('publishQueue', JSON.stringify(updated))
    } catch (e) {
      // ignore
    }
  }

  const showToast = (msg, type = 'success') => {
    setToast({ message: msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const requestGenerateHeroImage = async () => {
    setLoading(true)
    try {
      // call backend generate endpoint which may use AI service
      // use lowercase keys and include the article id to match backend expectations
      const payload = { newsArticleId: Number(id), promptOverride: '', style: null }
      const res = await generateHeroImage(id, payload)
      // normalize possible response shapes: string, { url }, { data: { url } }, { Url }, or { path }
      console.debug('generateHeroImage response:', res)
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
      const url = normalizeUrl(res)
      if (url) {
        // update client state
        setData(prev => ({ ...(prev || {}), draft: { ...(prev?.draft || {}), HeroImageUrl: url, HeroImageSource: 'generated' } }))
        showToast('Generated hero image')
        // best-effort persist generated hero to server so it survives scheduling/publish and reloads
        try {
          const dto = { NewsArticleId: Number(id), HeroImageUrl: url, HeroImageSource: 'generated' }
          const saved = await patchPublishDraft(id, dto)
          const returned = saved?.draft || saved
          if (returned) setData(prev => ({ ...(prev || {}), draft: { ...(prev?.draft || {}), ...returned } }))
        } catch (e) {
          // ignore persistence errors but keep the generated hero in the client state
        }
      } else {
        showToast('Image generation returned no URL', 'error')
      }
    } catch (e) {
      const errMsg = (e && e.message) ? e.message : String(e)
      console.error('generateHeroImage error:', e)
      showToast('Image generation failed: ' + errMsg, 'error')
      // fallback: save a stable placeholder hero image so consultant can proceed
      try {
        const placeholder = `/assets/generated/hero_placeholder.svg`
        const dto = { NewsArticleId: Number(id), HeroImageUrl: placeholder, HeroImageSource: 'generated' }
        await patchPublishDraft(id, dto)
        setData(prev => ({ ...(prev || {}), draft: { ...(prev?.draft || {}), HeroImageUrl: placeholder, HeroImageSource: 'generated' } }))
        showToast('Set placeholder hero image (generation failed)')
      } catch (inner) {
        console.error('fallback placeholder save failed:', inner)
      }
    } finally { setLoading(false) }
  }

  const saveDraft = async () => {
    if (!window.confirm('Save draft for this article?')) return
    try {
      setLoading(true)
      // construct PublishArticleDto expected by backend
      const dto = {
        NewsArticleId: Number(id),
        HeroImageUrl: data?.draft?.HeroImageUrl ?? null,
        HeroImageAlt: data?.draft?.HeroImageAlt ?? null,
        HeroImageSource: data?.draft?.HeroImageSource ?? null,
        // prefer explicit draft fields, then edited article bodies from `dataEn`/`dataZh`, then fallback to extracted `full` preview
        FullContentEN: data?.draft?.FullContentEN ?? data?.draft?.fullContentEN ?? dataEn?.FullContentEN ?? dataEn?.fullContent ?? full.en ?? null,
        FullContentZH: data?.draft?.FullContentZH ?? data?.draft?.fullContentZH ?? dataZh?.FullContentZH ?? dataZh?.fullContent ?? full.zh ?? null,
        // include title variants so saved drafts retain readable titles when server responses vary
        TitleEN: data?.draft?.TitleEN ?? dataEn?.titleEN ?? dataEn?.Title ?? dataEn?.title ?? null,
        TitleZH: data?.draft?.TitleZH ?? dataZh?.titleZH ?? dataZh?.Title ?? dataZh?.title ?? null,
        IndustryTagId: data?.draft?.IndustryTagId ?? data?.draft?.IndustryTag?.IndustryTagId ?? null,
        InterestTagIds: Array.isArray(data?.draft?.InterestTagIds)
          ? (data?.draft?.InterestTagIds || []).filter(Boolean)
          : ((data?.draft?.InterestTags || []).map(t => t.InterestTagId ?? t.id).filter(Boolean)),
        // Do NOT set ScheduledAt here — scheduling must be done via the Publish (Schedule) action
        ScheduledAt: null
      }
      // Optimistic local save: ensure publishQueue contains this draft so UI shows it
      try {
        const nid = Number(id)
        const rawQ = JSON.parse(localStorage.getItem('publishQueue') || '[]')
        const entriesQ = Array.isArray(rawQ) ? rawQ : []
        const existingQ = entriesQ.find(e => Number(e?.id ?? e) === nid) || null
        const articleObjQ = (data && (data.article || data.Article)) || (existingQ?.data?.article || {})
        const clientDraftQ = { ...(data?.draft || {}), FullContentEN: dto.FullContentEN, FullContentZH: dto.FullContentZH, TitleEN: dto.TitleEN, TitleZH: dto.TitleZH, IndustryTagId: dto.IndustryTagId, InterestTagIds: dto.InterestTagIds }
        const newEntryQ = { id: nid, data: { article: articleObjQ, draft: clientDraftQ, en: dataEn || existingQ?.data?.en, zh: dataZh || existingQ?.data?.zh } }
        const filteredQ = entriesQ.filter(e => Number(e?.id ?? e) !== nid)
        filteredQ.push(newEntryQ)
        localStorage.setItem('publishQueue', JSON.stringify(filteredQ))
      } catch (e) { /* ignore localStorage errors */ }

      const res = await patchPublishDraft(id, dto)
      // apply returned draft fields if any
      try {
        const returned = res?.draft || res
        if (returned) setData(prev => ({ ...(prev || {}), draft: { ...(prev?.draft || {}), ...returned } }))
        // ensure this article is present in the client-side publishQueue with its draft data
        try {
          const nid = Number(id)
          const raw = JSON.parse(localStorage.getItem('publishQueue') || '[]')
          const entries = Array.isArray(raw) ? raw : []
          const existing = entries.find(e => Number(e?.id ?? e) === nid) || null
          const articleObj = (data && (data.article || data.Article)) || (existing?.data?.article || {})
          // merge returned draft with any existing draft to avoid dropping fields
          const prevDraft = (existing && existing.data && existing.data.draft) ? existing.data.draft : (data?.draft || {})
          // prefer server-returned fields but always overlay client selections (industry/interests)
          const clientDraft = data?.draft || {}
          const mergedDraft = { ...(prevDraft || {}), ...(returned || {}) }
          if (clientDraft.IndustryTag) mergedDraft.IndustryTag = clientDraft.IndustryTag
          if (clientDraft.IndustryTagId) mergedDraft.IndustryTagId = clientDraft.IndustryTagId
          if (clientDraft.InterestTags) mergedDraft.InterestTags = clientDraft.InterestTags
          const newEntry = { id: nid, data: { article: articleObj, draft: mergedDraft, en: dataEn || existing?.data?.en, zh: dataZh || existing?.data?.zh } }
          const filtered = entries.filter(e => Number(e?.id ?? e) !== nid)
          filtered.push(newEntry)
          localStorage.setItem('publishQueue', JSON.stringify(filtered))
        } catch (inner) { /* ignore localStorage errors */ }
      } catch (e) {}
        // Always treat Save Draft as a draft action — navigate to Drafted.
        // Ensure stored draft does not have a ScheduledAt timestamp so it appears under Drafted.
        try {
          const nid = Number(id)
          const raw = JSON.parse(localStorage.getItem('publishQueue') || '[]')
          const entries = Array.isArray(raw) ? raw : []
          const existing = entries.find(e => Number(e?.id ?? e) === nid) || null
          const articleObj = (data && (data.article || data.Article)) || (existing?.data?.article || {})
          const prevDraft = (existing && existing.data && existing.data.draft) ? existing.data.draft : (data?.draft || {})
          const mergedDraft = { ...(prevDraft || {}), ...(returned || {}) }
          mergedDraft.ScheduledAt = null
          const newEntry = { id: nid, data: { article: articleObj, draft: mergedDraft, en: dataEn || existing?.data?.en, zh: dataZh || existing?.data?.zh } }
          const filtered = entries.filter(e => Number(e?.id ?? e) !== nid)
          filtered.push(newEntry)
          localStorage.setItem('publishQueue', JSON.stringify(filtered))
        } catch (inner) { /* ignore localStorage errors */ }
        try { localStorage.setItem(LAST_STATE_KEY, JSON.stringify({ tab: 'drafted', page: 1 })) } catch (e) {}
        showToast('Draft saved')
        setTimeout(() => navigate('/consultant/publish-queue'), 600)
    } catch (e) {
      showToast('Save draft failed: ' + (e.message || e), 'error')
    } finally { setLoading(false) }
  }

  const handlePublish = async (modeOverride) => {
    const mode = modeOverride || publishMode
    const _lsEntryForPublish = (() => {
      try {
        const raw = JSON.parse(localStorage.getItem('publishQueue') || '[]')
        const entries = Array.isArray(raw) ? raw : []
        const found = entries.find(e => Number(e?.id ?? e) === Number(id))
        return (found && found.data) ? found.data : null
      } catch (e) { return null }
    })()
    try {
      setLoading(true)
      // ensure required taxonomy present before calling publish; server also validates this
      const draft = data?.draft || {}
      // support both InterestTagIds (array of ids) and InterestTags (array of objects)
      const draftInterestIds = Array.isArray(draft?.InterestTagIds)
        ? (draft.InterestTagIds || [])
        : (Array.isArray(draft?.InterestTags) ? (draft.InterestTags || []).map(t => t.InterestTagId ?? t.id).filter(Boolean) : [])
      const interestIds = (draftInterestIds || []).filter(Boolean)
      const industryId = draft.IndustryTagId ?? draft.IndustryTag?.IndustryTagId ?? draft.IndustryTag?.id ?? null
      const hero = (data?.draft?.HeroImageUrl) || (data?.article?.HeroImageUrl) || null

      if (!hero) {
        showToast('A Hero Image is required before publishing or scheduling', 'error')
        setLoading(false)
        return
      }

      if (!industryId || interestIds.length === 0) {
        showToast('Industry and at least one Topic of Interest are required to publish', 'error')
        setLoading(false)
        return
      }

      // If the consultant selected Draft mode, perform a saveDraft instead of publishing.
      if (mode === 'draft') {
        // ensure draft fields include taxonomy
        await saveDraft()
        return
      }

      // If scheduling, require a scheduled datetime
      if (mode === 'schedule' && !scheduledAt) {
        showToast('Please choose a date and time to schedule', 'error')
        setLoading(false)
        return
      }

      // confirmations after validation
      if (!window.confirm(mode === 'now' ? 'Publish this article now?' : 'Schedule this article?')) {
        setLoading(false)
        return
      }

      // Ensure a draft exists on the server before calling publish — backend returns
      // "No draft to publish." if none exists. Create one silently using patchPublishDraft.
      if (!data?.draft) {
        try {
          const dtoForDraft = {
            NewsArticleId: Number(id),
            HeroImageUrl: data?.draft?.HeroImageUrl ?? data?.article?.HeroImageUrl ?? null,
            HeroImageAlt: data?.draft?.HeroImageAlt ?? null,
            HeroImageSource: data?.draft?.HeroImageSource ?? null,
            FullContentEN: data?.draft?.FullContentEN ?? dataEn?.FullContentEN ?? dataEn?.fullContent ?? full.en ?? null,
            FullContentZH: data?.draft?.FullContentZH ?? dataZh?.FullContentZH ?? dataZh?.fullContent ?? full.zh ?? null,
            TitleEN: data?.draft?.TitleEN ?? dataEn?.titleEN ?? dataEn?.Title ?? dataEn?.title ?? null,
            TitleZH: data?.draft?.TitleZH ?? dataZh?.titleZH ?? dataZh?.Title ?? dataZh?.title ?? null,
            IndustryTagId: data?.draft?.IndustryTagId ?? data?.draft?.IndustryTag?.IndustryTagId ?? null,
            InterestTagIds: Array.isArray(data?.draft?.InterestTagIds)
              ? (data?.draft?.InterestTagIds || []).filter(Boolean)
              : ((data?.draft?.InterestTags || []).map(t => t.InterestTagId ?? t.id).filter(Boolean)),
            ScheduledAt: mode === 'now' ? null : (scheduledAt || null)
          }
          const saved = await patchPublishDraft(id, dtoForDraft)
          try { console.debug('[publish] patchPublishDraft response:', saved) } catch (e) {}
          const returned = saved?.draft || saved || null
          if (returned) setData(prev => ({ ...(prev || {}), draft: { ...(prev?.draft || {}), ...returned } }))
          // verify server now has a draft available
          try {
            const verify = await getPublishDraft(id)
            try { console.debug('[publish] getPublishDraft after patch:', verify) } catch (e) {}
            const serverHasDraft = verify && (verify.draft || verify?.data?.draft || Object.keys(verify || {}).includes('draft'))
            if (!serverHasDraft) {
              showToast('Server did not persist draft — aborting publish', 'error')
              setLoading(false)
              return
            }
          } catch (e) {
            try { console.debug('[publish] getPublishDraft verify failed', e) } catch (ignored) {}
            showToast('Could not verify draft on server — aborting publish', 'error')
            setLoading(false)
            return
          }
          // also update local publishQueue entry
          try {
            const nid = Number(id)
            const raw = JSON.parse(localStorage.getItem('publishQueue') || '[]')
            const entries = Array.isArray(raw) ? raw : []
            const existing = entries.find(e => Number(e?.id ?? e) === nid) || null
            const articleObj = (data && (data.article || data.Article)) || (existing?.data?.article || {})
            const prevDraft = (existing && existing.data && existing.data.draft) ? existing.data.draft : (data?.draft || {})
            const mergedDraft = { ...(prevDraft || {}), ...(returned || {}) }
            if (data?.draft?.IndustryTag) mergedDraft.IndustryTag = data.draft.IndustryTag
            if (data?.draft?.IndustryTagId) mergedDraft.IndustryTagId = data.draft.IndustryTagId
            if (data?.draft?.InterestTags) mergedDraft.InterestTags = data.draft.InterestTags
            const newEntry = { id: nid, data: { article: articleObj, draft: mergedDraft, en: dataEn || existing?.data?.en, zh: dataZh || existing?.data?.zh } }
            const filtered = entries.filter(e => Number(e?.id ?? e) !== nid)
            filtered.push(newEntry)
            localStorage.setItem('publishQueue', JSON.stringify(filtered))
          } catch (inner) { /* ignore localStorage errors */ }
        } catch (e) {
          // if saving draft fails, abort publish and show error
          showToast('Failed to create draft before publishing: ' + (e.message || e), 'error')
          setLoading(false)
          return
        }
      }

      // Ensure server draft contains the hero and taxonomy fields so scheduling/publishing
      // does not lose the HeroImageUrl when the client-side draft came from localStorage.
      try {
        const ensureDto = {
          NewsArticleId: Number(id),
          HeroImageUrl: data?.draft?.HeroImageUrl ?? data?.article?.HeroImageUrl ?? null,
          HeroImageAlt: data?.draft?.HeroImageAlt ?? null,
          HeroImageSource: data?.draft?.HeroImageSource ?? null,
          TitleEN: data?.draft?.TitleEN ?? dataEn?.titleEN ?? dataEn?.Title ?? dataEn?.title ?? null,
          TitleZH: data?.draft?.TitleZH ?? dataZh?.titleZH ?? dataZh?.Title ?? dataZh?.title ?? null,
          IndustryTagId: data?.draft?.IndustryTagId ?? data?.draft?.IndustryTag?.IndustryTagId ?? null,
          InterestTagIds: Array.isArray(data?.draft?.InterestTagIds)
            ? (data?.draft?.InterestTagIds || []).filter(Boolean)
            : ((data?.draft?.InterestTags || []).map(t => t.InterestTagId ?? t.id).filter(Boolean)),
          ScheduledAt: mode === 'now' ? null : (scheduledAt || null)
        }
        const savedEnsure = await patchPublishDraft(id, ensureDto)
        const returnedEnsure = savedEnsure?.draft || savedEnsure
        if (returnedEnsure) {
          setData(prev => ({ ...(prev || {}), draft: { ...(prev?.draft || {}), ...returnedEnsure } }))
        }
      } catch (e) {
        // ignore; best-effort to persist hero/taxonomy before publish
      }

      // send both casing variants (server may expect different shapes)
      const normalizedInterestIds = interestIds.map(x => Number(x)).filter(x => !Number.isNaN(x))
      const body = {
        // canonical (PascalCase) used elsewhere
        NewsArticleId: Number(id),
        Action: 'publish',
        ScheduledAt: mode === 'now' ? null : (scheduledAt || null),
        IndustryTagId: industryId,
        InterestTagIds: normalizedInterestIds,
        // lowercase/camelCase duplicates to satisfy alternate server expectations
        newsArticleId: Number(id),
        action: 'publish',
        scheduledAt: mode === 'now' ? null : (scheduledAt || null),
        industryTagId: industryId,
        interestTagIds: normalizedInterestIds
      }
      // debug: log the outgoing publish body so server validation errors can be diagnosed
      try { console.debug('[publish] request body', body) } catch (e) {}
      const res = await publishAction(id, body)
      // backend returns { message } on success; consider it success
      // Refresh publish/draft/article state so Publish Queue sees the article as live
      try {
        // fetch latest draft and the canonical article record (article record should have PublishedAt)
        const [latestDraftRes, latestArticleRes] = await Promise.allSettled([
          getPublishDraft(id),
          getArticle(id, 'en')
        ])

        const latestDraft = latestDraftRes.status === 'fulfilled' ? (latestDraftRes.value?.data ?? latestDraftRes.value) : null
        const latestArticle = latestArticleRes.status === 'fulfilled' ? (latestArticleRes.value?.data ?? latestArticleRes.value) : null

        // merge into a single data object for local UI state
        const mergedData = {
          ...(latestDraft || {}),
          article: (latestArticle || (latestDraft && (latestDraft.article || latestDraft.Article))) || undefined,
          draft: latestDraft?.draft ?? latestDraft?.draft ?? latestDraft
        }
        setData(mergedData)
        // update schedule input to reflect server-returned scheduled time after scheduling/rescheduling
        try {
          const newSched = mergedData?.draft?.ScheduledAt ?? mergedData?.draft?.scheduledAt
          if (newSched) setScheduledAt(formatForInput(newSched))
          else setScheduledAt('')
        } catch (e) { /* ignore */ }

        // update client-side publishQueue entry to include article so PublishQueue.isLive() becomes true
            try {
          const nid = Number(id)
          const raw = JSON.parse(localStorage.getItem('publishQueue') || '[]')
          const entries = Array.isArray(raw) ? raw : []
          const existing = entries.find(e => Number(e?.id ?? e) === nid) || null
          const articleObj = mergedData.article || (existing?.data?.article) || {}
          const prevDraft = (existing && existing.data && existing.data.draft) ? existing.data.draft : (mergedData?.draft || {})
          // overlay mergedData.draft with any client selections so Industry/Interest persist
          const clientDraft = data?.draft || {}
          const mergedDraft = { ...(prevDraft || {}), ...(mergedData?.draft || {}) }
          // preserve hero image from client draft/article/localStorage when server response lacks it
          try {
            mergedDraft.HeroImageUrl = mergedDraft.HeroImageUrl || clientDraft.HeroImageUrl || data?.article?.HeroImageUrl || (_lsEntryForPublish && _lsEntryForPublish.draft && _lsEntryForPublish.draft.HeroImageUrl) || mergedDraft.HeroImageUrl
          } catch (e) { /* ignore */ }
          if (clientDraft.IndustryTag) mergedDraft.IndustryTag = clientDraft.IndustryTag
          if (clientDraft.IndustryTagId) mergedDraft.IndustryTagId = clientDraft.IndustryTagId
          if (clientDraft.InterestTags) mergedDraft.InterestTags = clientDraft.InterestTags
          if (clientDraft.InterestTagIds) mergedDraft.InterestTagIds = clientDraft.InterestTagIds
          // ensure article record indicates published state so PublishQueue treats it as Live
          try {
                if (mode === 'now') {
                  const publishedAt = new Date().toISOString()
                  // write both casings for robustness across UI/server shapes
                  articleObj.PublishedAt = publishedAt
                  articleObj.publishedAt = publishedAt
                  articleObj.IsPublished = true
                  articleObj.isPublished = true
                  mergedDraft.PublishedAt = publishedAt
                  mergedDraft.publishedAt = publishedAt
                  // clear any scheduled markers so item appears as Published
                  try { delete mergedDraft.ScheduledAt; delete mergedDraft.scheduledAt } catch (e) {}
                } else if (mode === 'schedule' && scheduledAt) {
                  // mark scheduled time on draft so it appears under Scheduled
                  mergedDraft.ScheduledAt = scheduledAt
                  mergedDraft.scheduledAt = scheduledAt
                }
          } catch (e) { /* ignore timestamp setting errors */ }

          const newEntry = { id: nid, data: { article: articleObj, draft: mergedDraft, en: dataEn || existing?.data?.en, zh: dataZh || existing?.data?.zh } }
          const filtered = entries.filter(e => Number(e?.id ?? e) !== nid)
          filtered.push(newEntry)
          localStorage.setItem('publishQueue', JSON.stringify(filtered))
        } catch (inner) { /* ignore localStorage errors */ }
      } catch (e) {
        // ignore refresh error
      }
      try { const target = mode === 'now' ? 'published' : 'scheduled'; localStorage.setItem(LAST_STATE_KEY, JSON.stringify({ tab: target, page: 1 })) } catch (e) {}
      showToast('Published')
      setTimeout(() => navigate('/consultant/publish-queue'), 800)
    } catch (e) {
      showToast('Publish failed: ' + (e.message || e), 'error')
    } finally { setLoading(false) }
  }

  if (!data) {
    return (
      <div className="content-full"><div className="page-inner" style={styles.page}><div style={{...styles.card}}>Loading...</div></div></div>
    )
  }

  // build payload fallbacks similar to ArticleReview
  const enPayload = dataEn || data || {}
  const zhPayload = dataZh || data || {}
  const articleEn = (enPayload?.article || enPayload?.Article) || {}
  const articleZh = (zhPayload?.article || zhPayload?.Article) || {}
  const article = (data?.article || data?.Article) || {}

  // Prefer robust title extraction via getField; avoid falling back to numeric IDs.
  const titleField = getField('title')
  const rawTitleENAlt = asText(
    articleEn?.titleEN ?? articleEn?.titleEn ?? articleEn?.Title ?? articleEn?.title ??
    enPayload?.Title ?? enPayload?.title ?? dataEn?.title ??
    article?.titleEN ?? article?.TitleEN ?? article?.titleEn ?? article?.Title ?? article?.title ?? ''
  )
  const rawTitleZHAlt = asText(
    articleZh?.titleZH ?? articleZh?.titleZh ?? articleZh?.Title ?? articleZh?.title ??
    zhPayload?.Title ?? zhPayload?.title ?? dataZh?.title ??
    article?.titleZH ?? article?.TitleZH ?? article?.titleZh ?? article?.Title ?? article?.title ?? ''
  )

  const preferReadable = (s) => {
    if (!s) return ''
    const t = String(s).trim()
    if (/^\d+$/.test(t)) return '' // treat pure numeric as missing (likely an ID)
    return t
  }

  const rawTitleEN = preferReadable(titleField.en) || preferReadable(rawTitleENAlt) || ''
  const titleEN = sanitize(rawTitleEN)
  const displayTitleEN = titleEN || rawTitleEN

  const rawTitleZH = preferReadable(titleField.zh) || preferReadable(rawTitleZHAlt) || ''
  const titleZH = sanitize(rawTitleZH)
  const displayTitleZH = titleZH || rawTitleZH

  const rawSummaryEN = asText(
    articleEn?.summaryEN ?? articleEn?.summaryEn ?? enPayload?.summary ?? enPayload?.Summary ?? dataEn?.summary ?? article?.summaryEN ?? article?.summary ?? ''
  )
  const summaryEN = sanitize(rawSummaryEN) || rawSummaryEN

  const rawSummaryZH = asText(
    articleZh?.summaryZH ?? articleZh?.summaryZh ?? zhPayload?.summary ?? zhPayload?.Summary ?? dataZh?.summary ?? article?.summaryZH ?? article?.summary ?? ''
  )
  const summaryZH = sanitize(rawSummaryZH) || rawSummaryZH

  const full = getField('fullContent')
  const title = { en: displayTitleEN, zh: displayTitleZH }
  const summary = { en: summaryEN, zh: summaryZH }

  // computed publish readiness
  const draft = data?.draft || {}
  // also consider client-side publishQueue localStorage entry as a fallback
  const _lsEntry = (() => {
    try {
      const raw = JSON.parse(localStorage.getItem('publishQueue') || '[]')
      const entries = Array.isArray(raw) ? raw : []
      const found = entries.find(e => Number(e?.id ?? e) === Number(id))
      return (found && found.data) ? found.data : null
    } catch (e) { return null }
  })()
  const hasHero = Boolean(draft.HeroImageUrl || data?.article?.HeroImageUrl || (_lsEntry && _lsEntry.draft && _lsEntry.draft.HeroImageUrl))
  const industryIdCurrent = draft.IndustryTagId ?? draft.IndustryTag?.IndustryTagId ?? draft.IndustryTag?.id ?? data?.article?.IndustryTagId ?? (_lsEntry && _lsEntry.draft && _lsEntry.draft.IndustryTagId) ?? null
  const interestCount = (Array.isArray(draft.InterestTagIds) && draft.InterestTagIds.length) || (Array.isArray(draft.InterestTags) && draft.InterestTags.length) || (Array.isArray(_lsEntry?.draft?.InterestTagIds) && _lsEntry.draft.InterestTagIds.length) || (Array.isArray(_lsEntry?.draft?.InterestTags) && _lsEntry.draft.InterestTags.length) || 0
  const canPublish = Boolean(hasHero && industryIdCurrent && interestCount > 0)

  const getDisplayName = (item) => {
    if (!item) return ''
    return item.NameEN || item.Name || item.TitleEN || item.title || item.name || item.NameZH || item.Name || ''
  }

  // Normalize hero image URL for display: accept absolute, data:, or make relative paths absolute
  const displayedHeroUrl = (() => {
    const u = heroUrl()
    if (!u) return ''
    if (/^data:|^https?:\/\//i.test(u)) return u
    const apiBase = (import.meta.env.VITE_API_BASE || window.location.origin)
    // If this is the known placeholder filename, prefer the frontend origin (vite dev server)
    if (u.includes('hero_placeholder.svg')) {
      return window.location.origin.replace(/\/$/, '') + (u.startsWith('/') ? u : '/' + u)
    }
    try {
      return apiBase.replace(/\/$/, '') + (u.startsWith('/') ? u : '/' + u)
    } catch (e) {
      return u
    }
  })()

  return (
    <div className="content-full">
      <div className="page-inner">
        <div style={styles.page}>
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>Publish Article</h1>
              <span style={{ color: '#999', fontSize: 12 }}>#{id}</span>
            </div>
            <button onClick={() => navigate('/consultant/publish-queue')} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #e6e6e6', background: '#fff', fontSize: 12 }}>Back</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12, height: 'calc(100vh - 90px)' }}>
            <div style={{ ...styles.card, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexShrink: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Article Preview</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setLang('en')} style={{ padding: '4px 8px', borderRadius: 4, background: lang === 'en' ? '#c92b2b' : '#f5f5f5', color: lang === 'en' ? 'white' : '#444', border: 'none', fontSize: 11 }}>EN</button>
                  <button onClick={() => setLang('zh')} style={{ padding: '4px 8px', borderRadius: 4, background: lang === 'zh' ? '#c92b2b' : '#f5f5f5', color: lang === 'zh' ? 'white' : '#444', border: 'none', fontSize: 11 }}>ZH</button>
                </div>
              </div>

              <div style={{ marginBottom: 6, flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Title</div>
                <div style={{ padding: 6, borderRadius: 6, border: '1px solid #eee', background: '#fafafa', fontSize: 13, fontWeight: 600 }}>{lang === 'en' ? (title.en || '—') : (title.zh || '—')}</div>
              </div>

              <div style={{ marginBottom: 6, flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Summary</div>
                <div style={{ padding: 6, borderRadius: 6, border: '1px solid #eee', background: '#fafafa', fontSize: 12, maxHeight: 60, overflow: 'auto' }}>{lang === 'en' ? (summary.en || '—') : (summary.zh || '—')}</div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Content</div>
                <div style={{ whiteSpace: 'pre-wrap', padding: 8, border: '1px solid #eee', borderRadius: 6, flex: 1, overflow: 'auto', fontSize: 12, color: '#333', background: '#fafafa' }}>{lang === 'en' ? full.en : full.zh}</div>
              </div>
            </div>

            <div style={{ ...styles.sidebar, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
              <div style={{ marginBottom: 8 }}>
                <div style={styles.heading}>Publish Controls</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <span style={{ padding: '3px 8px', borderRadius: 12, background: '#f0fdf4', fontSize: 10, color: '#16a34a' }}>ZH ✓</span>
                  <span style={{ padding: '3px 8px', borderRadius: 12, background: '#f0fdf4', fontSize: 10, color: '#16a34a' }}>EN ✓</span>
                </div>
              </div>

              <div style={{ marginBottom: 8 }}>
                <div style={styles.heading}>Hero Image</div>
                {displayedHeroUrl ? (
                  <div style={{ background: '#fafafa', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img src={displayedHeroUrl} alt="hero" style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 4 }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
                    <div style={{ flex: 1, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button style={{ padding: '3px 6px', borderRadius: 4, background: '#1976d2', color: '#fff', border: 'none', fontSize: 10, cursor: 'pointer' }} onClick={() => requestGenerateHeroImage()} disabled={loading}>{loading ? '...' : 'Generate'}</button>
                      <button style={{ padding: '3px 6px', borderRadius: 4, background: '#fff', color: '#c92b2b', border: '1px solid #fcc', fontSize: 10, cursor: 'pointer' }} onClick={() => { const d = { ...(data?.draft || {}) }; d.HeroImageUrl = null; d.HeroImageSource = null; setData({ ...(data || {}), draft: d }); showToast('Removed'); }}>Remove</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: 8, border: '1px dashed #ddd', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: '#999', fontSize: 11 }}>No image</span>
                    <button style={{ padding: '3px 6px', borderRadius: 4, background: '#1976d2', color: '#fff', border: 'none', fontSize: 10, cursor: 'pointer' }} onClick={() => requestGenerateHeroImage()} disabled={loading}>{loading ? '...' : 'Generate'}</button>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 8 }}>
                <div style={styles.heading}>Industry</div>
                {(() => {
                  const industries = data?.industries || data?.IndustryTags || data?.industryTags || data?.industriesList || []
                  const current = data?.draft?.IndustryTagId ?? data?.draft?.IndustryTag?.IndustryTagId ?? data?.draft?.IndustryTag?.id ?? ''
                  if (industries && industries.length > 0) {
                    return (
                      <select value={String(current)} onChange={e => { const val = e.target.value; const picked = industries.find(x => String(x.id) === val || String(x.IndustryTagId ?? x.id) === val); setData(prev => ({ ...(prev || {}), draft: { ...(prev?.draft || {}), IndustryTag: picked || null, IndustryTagId: picked ? (picked.IndustryTagId ?? picked.id) : null } })) }} style={{ padding: '6px', borderRadius: 6, border: '1px solid #ddd', width: '100%', fontSize: 12 }}>
                        <option value=''>Unassigned</option>
                        {industries.map((it, i) => (<option key={i} value={String(it.id ?? it.IndustryTagId)}>{getDisplayName(it) || String(it.id ?? it.IndustryTagId)}</option>))}
                      </select>
                    )
                  }
                  const fallbackId = data?.draft?.IndustryTagId ?? data?.draft?.IndustryTag?.IndustryTagId ?? data?.draft?.IndustryTag?.id
                  const attachedList = data?.industries || []
                  if (fallbackId || fallbackId === 0) { const found = attachedList.find(x => String(x.id ?? x.IndustryTagId ?? x.industryTagId) === String(fallbackId)); const name = found ? (found.NameEN || found.NameZH || found.Name || found.name || String(fallbackId)) : (getDisplayName(data?.draft?.IndustryTag) || String(fallbackId)); return <div style={{ padding: '6px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12 }}>{name}</div> }
                  return <div style={{ padding: '6px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12, color: '#999' }}>{getDisplayName(data?.draft?.IndustryTag) || 'Unassigned'}</div>
                })()}
              </div>

              <div style={{ marginBottom: 8 }}>
                <div style={styles.heading}>Topics Of Interest</div>
                {(() => {
                  const interests = data?.interests || data?.InterestTags || data?.interestTags || []
                  const draft = data?.draft || {}
                  const draftInterestIds = Array.isArray(draft?.InterestTagIds) ? draft.InterestTagIds.map(x => String(x)) : (Array.isArray(draft?.InterestTags) ? draft.InterestTags.map(t => String(t.InterestTagId ?? t.id)) : [])
                  if (interests && interests.length > 0) {
                    return (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxHeight: 100, overflow: 'auto' }}>
                        {interests.map((it, idx) => {
                          const idVal = it.interestTagId ?? it.InterestTagId ?? it.id
                          const idStr = String(idVal)
                          const checked = draftInterestIds.includes(idStr)
                          return (
                            <label key={idx} style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '3px 6px', borderRadius: 10, background: checked ? '#fee2e2' : '#f5f5f5', border: checked ? '1px solid #fca5a5' : '1px solid #e5e5e5', cursor: 'pointer', fontSize: 11 }}>
                              <input type="checkbox" checked={checked} style={{ width: 12, height: 12 }} onChange={e => { const curIds = Array.isArray(draft?.InterestTagIds) ? (draft.InterestTagIds || []).slice() : (Array.isArray(draft?.InterestTags) ? (draft.InterestTags || []).map(t => (t.InterestTagId ?? t.id)) : []); const sid = idVal; if (e.target.checked) { curIds.push(sid) } else { const i = curIds.findIndex(x => String(x) === idStr); if (i >= 0) curIds.splice(i, 1) }; const normalizedIds = Array.from(new Set(curIds.map(x => String(x)))).map(x => Number(x)).filter(x => !Number.isNaN(x)); const curObjs = normalizedIds.map(id => interests.find(x => String(x.id ?? x.InterestTagId ?? x.interestTagId) === String(id))).filter(Boolean); setData(prev => ({ ...(prev || {}), draft: { ...(prev?.draft || {}), InterestTagIds: normalizedIds, InterestTags: curObjs } })) }} />
                              <span style={{ color: checked ? '#b91c1c' : '#666' }}>{getDisplayName(it) || idStr}</span>
                            </label>
                          )
                        })}
                      </div>
                    )
                  }
                  const fallbackNames = []; if (Array.isArray(draft?.InterestTags) && draft.InterestTags.length > 0) { for (const t of draft.InterestTags) fallbackNames.push(t.NameEN ?? t.NameZH ?? t.Name ?? t.name ?? String(t.InterestTagId ?? t.id)) } else if (Array.isArray(draft?.InterestTagIds) && draft.InterestTagIds.length > 0) { const list = data?.interests || []; for (const id of draft.InterestTagIds) { const found = list.find(x => String(x.id ?? x.InterestTagId ?? x.interestTagId) === String(id)); fallbackNames.push(found ? (found.NameEN || found.NameZH || found.Name || found.name || String(id)) : String(id)) } }
                  return <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{fallbackNames.map((n, i) => (<span key={i} style={{ padding: '3px 6px', borderRadius: 10, background: '#fee2e2', fontSize: 11, color: '#b91c1c' }}>{n}</span>))}</div>
                })()}
              </div>

              <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid #eee' }}>
                <div style={styles.heading}>Actions</div>
                
                {/* Save as Draft */}
                <button 
                  onClick={saveDraft} 
                  style={{ width: '100%', background: '#f5f5f5', color: '#333', border: '1px solid #ddd', padding: '8px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, marginBottom: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <span>💾</span> Save as Draft
                </button>

                {/* Schedule */}
                <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: 8, marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span>📅</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#92400e' }}>Schedule for later</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input 
                      type="datetime-local" 
                      value={scheduledAt} 
                      onChange={e => setScheduledAt(e.target.value)} 
                      style={{ flex: 1, padding: 6, borderRadius: 4, border: '1px solid #ddd', fontSize: 11 }} 
                    />
                    <button 
                      onClick={() => handlePublish('schedule')} 
                      disabled={!scheduledAt || !canPublish}
                      title={!canPublish ? 'Assign Hero, Industry, and at least one Topic before scheduling/publishing' : undefined}
                      style={{ padding: '6px 10px', borderRadius: 4, background: (scheduledAt && canPublish) ? '#f59e0b' : '#ccc', color: 'white', border: 'none', fontSize: 10, fontWeight: 600, cursor: (scheduledAt && canPublish) ? 'pointer' : 'not-allowed' }}
                    >
                      {(data?.draft?.ScheduledAt || data?.draft?.scheduledAt) ? 'Re-schedule' : 'Schedule'}
                    </button>
                  </div>
                </div>

                {/* Publish Now */}
                <button 
                  onClick={() => handlePublish('now')} 
                  disabled={!canPublish}
                  title={!canPublish ? 'Assign Hero, Industry, and at least one Topic before publishing' : undefined}
                  style={{ width: '100%', background: canPublish ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' : '#dfe8df', color: canPublish ? 'white' : '#888', border: 'none', padding: '10px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: canPublish ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: canPublish ? '0 2px 4px rgba(22, 163, 74, 0.3)' : 'none' }}
                >
                  <span>🚀</span> Publish Now
                </button>

                {/* Cancel */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
