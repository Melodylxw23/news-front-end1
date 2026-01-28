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
  page: { padding: '24px 32px', background: 'transparent', minHeight: '100vh', boxSizing: 'border-box' },
  card: { background: palette.card, padding: 18, borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.06)', boxSizing: 'border-box' },
  sidebar: { background: palette.card, padding: 18, borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.06)' },
  heading: { fontSize: 18, fontWeight: 700, color: '#444', marginBottom: 8 }
}

export default function PublishArticle() {
  const { id } = useParams()
  const navigate = useNavigate()
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
        } else {
          try {
            const raw = JSON.parse(localStorage.getItem('publishQueue') || '[]')
            const entries = Array.isArray(raw) ? raw : []
            const found = entries.find(e => Number(e?.id ?? e) === Number(id))
            if (found) {
              // stored shape: { id, data: { article, draft, en, zh } }
              const entryData = found.data || found
              setData(entryData)
            } else {
              setData(pubVal)
            }
          } catch (e) {
            setData(pubVal)
          }
        }
      }
      if (enRes.status === 'fulfilled') setDataEn(enRes.value)
      if (zhRes.status === 'fulfilled') setDataZh(zhRes.value)
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
      for (const k of keys) {
        vals.push(d?.[k])
      }
      for (const k of keys) {
        vals.push(a?.[k])
      }
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
        setData(prev => ({ ...(prev || {}), draft: { ...(prev?.draft || {}), HeroImageUrl: url, HeroImageSource: 'generated' } }))
        showToast('Generated hero image')
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
        InterestTagIds: (data?.draft?.InterestTags || []).map(t => t.InterestTagId ?? t.id).filter(Boolean),
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
        showToast('Draft saved')
        setTimeout(() => navigate('/consultant/publish-queue?tab=drafted'), 600)
    } catch (e) {
      showToast('Save draft failed: ' + (e.message || e), 'error')
    } finally { setLoading(false) }
  }

  const handlePublish = async () => {
    if (!window.confirm(publishMode === 'now' ? 'Publish this article now?' : 'Schedule this article?')) return
    try {
      setLoading(true)
      // ensure required taxonomy present before calling publish; server also validates this
      const draft = data?.draft || {}
      const interestIds = (draft.InterestTags || []).map(t => t.InterestTagId ?? t.id).filter(Boolean)
      const industryId = draft.IndustryTagId ?? draft.IndustryTag?.IndustryTagId ?? draft.IndustryTag?.id ?? null
      if (!industryId || interestIds.length === 0) {
        showToast('Industry and at least one Topic of Interest are required to publish', 'error')
        setLoading(false)
        return
      }

      // If the consultant selected Draft mode, perform a saveDraft instead of publishing.
      if (publishMode === 'draft') {
        // ensure draft fields include taxonomy
        await saveDraft()
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
            InterestTagIds: (data?.draft?.InterestTags || []).map(t => t.InterestTagId ?? t.id).filter(Boolean),
            ScheduledAt: publishMode === 'now' ? null : (scheduledAt || null)
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

      // send both casing variants (server may expect different shapes)
      const normalizedInterestIds = interestIds.map(x => Number(x)).filter(x => !Number.isNaN(x))
      const body = {
        // canonical (PascalCase) used elsewhere
        NewsArticleId: Number(id),
        Action: 'publish',
        ScheduledAt: publishMode === 'now' ? null : (scheduledAt || null),
        IndustryTagId: industryId,
        InterestTagIds: normalizedInterestIds,
        // lowercase/camelCase duplicates to satisfy alternate server expectations
        newsArticleId: Number(id),
        action: 'publish',
        scheduledAt: publishMode === 'now' ? null : (scheduledAt || null),
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
          if (clientDraft.IndustryTag) mergedDraft.IndustryTag = clientDraft.IndustryTag
          if (clientDraft.IndustryTagId) mergedDraft.IndustryTagId = clientDraft.IndustryTagId
          if (clientDraft.InterestTags) mergedDraft.InterestTags = clientDraft.InterestTags
          // ensure article record indicates published state so PublishQueue treats it as Live
          try {
                if (publishMode === 'now') {
                  const publishedAt = new Date().toISOString()
                  // write both casings for robustness across UI/server shapes
                  if (!articleObj.PublishedAt) articleObj.PublishedAt = publishedAt
                  if (!articleObj.publishedAt) articleObj.publishedAt = publishedAt
                  articleObj.IsPublished = true
                  articleObj.isPublished = true
                  mergedDraft.PublishedAt = mergedDraft.PublishedAt || publishedAt
                  mergedDraft.publishedAt = mergedDraft.publishedAt || publishedAt
                } else if (publishMode === 'schedule' && scheduledAt) {
                  // mark scheduled time on draft so it appears under Scheduled
                  mergedDraft.ScheduledAt = mergedDraft.ScheduledAt || scheduledAt
                  mergedDraft.scheduledAt = mergedDraft.scheduledAt || scheduledAt
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
      showToast('Published')
      setTimeout(() => navigate(`/consultant/publish-queue?tab=${publishMode === 'now' ? 'live' : 'scheduled'}`), 800)
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
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: 24, margin: 0, fontWeight: 700 }}>Publish Article</h1>
              <div style={{ color: '#777', marginTop: 6 }}>Article publish controls and content preview</div>
            </div>
            <div>
              <button onClick={() => navigate(-1)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e6e6e6', background: '#fff' }}>Back</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}>
            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 700 }}>Article</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setLang('en')} style={{ padding: '6px 10px', borderRadius: 6, background: lang === 'en' ? '#c92b2b' : '#f5f5f5', color: lang === 'en' ? 'white' : '#444', border: 'none' }}>EN</button>
                  <button onClick={() => setLang('zh')} style={{ padding: '6px 10px', borderRadius: 6, background: lang === 'zh' ? '#c92b2b' : '#f5f5f5', color: lang === 'zh' ? 'white' : '#444', border: 'none' }}>ZH</button>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>{lang === 'en' ? 'Title (EN)' : 'Title (ZH)'}</div>
                <div style={{ padding: 10, borderRadius: 8, border: '1px solid #eee', background: '#fff', minHeight: 44, whiteSpace: 'pre-wrap' }}>{lang === 'en' ? (title.en || '—') : (title.zh || '—')}</div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>{lang === 'en' ? 'Summary (EN)' : 'Summary (ZH)'}</div>
                <div style={{ padding: 10, borderRadius: 8, border: '1px solid #eee', background: '#fff', minHeight: 80, whiteSpace: 'pre-wrap' }}>{lang === 'en' ? (summary.en || '—') : (summary.zh || '—')}</div>
              </div>


              <div>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>Content</div>
                <div style={{ whiteSpace: 'pre-wrap', padding: 12, border: '1px solid #eee', borderRadius: 8, minHeight: 220, color: '#222' }}>{lang === 'en' ? full.en : full.zh}</div>
              </div>
            </div>

            <div style={styles.sidebar}>
              <div style={{ marginBottom: 12 }}>
                <div style={styles.heading}>Publish Controls</div>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>Article Checklist</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <div style={{ padding: '6px 10px', borderRadius: 20, background: '#f5fdf8', border: '1px solid #e6f2ea', color: '#1e7a3a' }}>Article Content: ZH ✓</div>
                  <div style={{ padding: '6px 10px', borderRadius: 20, background: '#f5fdf8', border: '1px solid #eee', color: '#1e7a3a' }}>Article Content: EN ✓</div>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={styles.heading}>Hero Image</div>
                {displayedHeroUrl ? (
                  <div style={{ background: '#fafafa', padding: 10, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img
                      src={displayedHeroUrl}
                      alt="hero"
                      style={{ width: 120, height: 68, objectFit: 'cover', borderRadius: 6 }}
                      onError={(e) => {
                        console.error('Hero image load failed for', displayedHeroUrl, e)
                        // hide the broken image
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13 }}>{displayedHeroUrl.split('/').pop()}</div>
                      <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                        <button
                          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #1976d2', background: '#1976d2', color: '#fff', cursor: 'pointer' }}
                          onClick={() => requestGenerateHeroImage()}
                          disabled={loading}
                          title="Generate hero image via backend AI service"
                        >
                          {loading ? 'Generating…' : 'Generate Image'}
                        </button>

                        <button
                          style={{ background: 'transparent', color: '#c92b2b', border: 'none', cursor: 'pointer' }}
                          onClick={() => {
                            const d = { ...(data?.draft || {}) };
                            d.HeroImageUrl = null;
                            d.HeroImageSource = null;
                            setData({ ...(data || {}), draft: d });
                            showToast('Hero image removed');
                          }}
                        >
                          Remove
                        </button>

                        <button
                          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer' }}
                          onClick={() => window.open(displayedHeroUrl, '_blank')}
                        >
                          Open
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: 12, border: '1px dashed #eee', borderRadius: 8, color: '#999', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>No hero image</div>
                    <div>
                      <button
                        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #1976d2', background: '#1976d2', color: '#fff', cursor: 'pointer' }}
                        onClick={() => requestGenerateHeroImage()}
                        disabled={loading}
                        title="Generate hero image via backend AI service"
                      >
                        {loading ? 'Generating…' : 'Generate Image'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={styles.heading}>Industry</div>
                {(() => {
                  const industries = data?.industries || data?.IndustryTags || data?.industryTags || data?.industriesList || []
                  const current = data?.draft?.IndustryTagId ?? data?.draft?.IndustryTag?.IndustryTagId ?? data?.draft?.IndustryTag?.id ?? ''
                  if (industries && industries.length > 0) {
                    return (
                      <select
                        value={String(current)}
                        onChange={e => {
                          const val = e.target.value
                          const picked = industries.find(x => String(x.id) === val || String(x.IndustryTagId ?? x.id) === val)
                          setData(prev => ({ ...(prev || {}), draft: { ...(prev?.draft || {}), IndustryTag: picked || null, IndustryTagId: picked ? (picked.IndustryTagId ?? picked.id) : null } }))
                        }}
                        style={{ padding: '10px', borderRadius: 8, border: '1px solid #eee', width: '100%' }}
                      >
                        <option value=''>Unassigned</option>
                        {industries.map((it, i) => (
                          <option key={i} value={String(it.id ?? it.IndustryTagId)}>{getDisplayName(it) || String(it.id ?? it.IndustryTagId)}</option>
                        ))}
                      </select>
                    )
                  }
                  return <div style={{ padding: '10px', borderRadius: 8, border: '1px solid #eee' }}>{getDisplayName(data?.draft?.IndustryTag) || 'Unassigned'}</div>
                })()}
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={styles.heading}>Topics Of Interest</div>
                {(() => {
                  const interests = data?.interests || data?.InterestTags || data?.interestTags || []
                  const selected = (data?.draft?.InterestTags || []).map(t => String(t.InterestTagId ?? t.id ?? t.id))
                  if (interests && interests.length > 0) {
                    return (
                      <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                        {interests.map((it, idx) => {
                          const idStr = String(it.id ?? it.InterestTagId)
                          const checked = selected.includes(idStr)
                          return (
                            <label key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={e => {
                                  const cur = (data?.draft?.InterestTags || []).slice()
                                  if (e.target.checked) {
                                    cur.push(it)
                                  } else {
                                    const idx = cur.findIndex(x => String(x.InterestTagId ?? x.id) === idStr)
                                    if (idx >= 0) cur.splice(idx, 1)
                                  }
                                  setData(prev => ({ ...(prev || {}), draft: { ...(prev?.draft || {}), InterestTags: cur } }))
                                }}
                              />
                              <div style={{ padding: '6px 10px', borderRadius: 12, background: checked ? '#fff4f4' : '#fff', color: '#c92b2b' }}>{getDisplayName(it) || idStr}</div>
                            </label>
                          )
                        })}
                      </div>
                    )
                  }
                  return <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{(data?.draft?.InterestTags || []).map((t, i) => (<div key={i} style={{ padding: '6px 10px', borderRadius: 12, background: '#fff4f4', color: '#c92b2b' }}>{t.NameEN ?? t.NameZH ?? t.Name ?? t.name}</div>))}</div>
                })()}
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={styles.heading}>Attach Assets</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" defaultChecked /> Text Summary</label>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={styles.heading}>Publish Timing</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <label><input type="radio" name="timing" checked={publishMode === 'now'} onChange={() => setPublishMode('now')} /> Publish Now</label>
                  <label><input type="radio" name="timing" checked={publishMode === 'schedule'} onChange={() => setPublishMode('schedule')} /> Schedule</label>
                  <label><input type="radio" name="timing" checked={publishMode === 'draft'} onChange={() => setPublishMode('draft')} /> Draft</label>
                </div>
                {publishMode === 'schedule' && (
                  <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #eee', width: '100%' }} />
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={saveDraft} style={{ flex: 1, background: '#c92b2b', color: 'white', border: 'none', padding: '10px 12px', borderRadius: 8 }}>Save Draft</button>
                <button onClick={handlePublish} style={{ flex: 1, background: '#1e73d1', color: 'white', border: 'none', padding: '10px 12px', borderRadius: 8 }}>{publishMode === 'now' ? 'Publish Now' : (publishMode === 'schedule' ? 'Schedule' : 'Save as Draft')}</button>
                <button onClick={() => navigate('/consultant/publish-queue')} style={{ flex: 1, background: '#f5f5f5', border: '1px solid #eee', padding: '10px 12px', borderRadius: 8 }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
