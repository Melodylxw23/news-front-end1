import React, { useEffect, useState } from 'react'
import { getRoleFromToken } from '../../utils/auth'
import { deleteArticle, getArticle, translatePreview } from '../../api/articles'

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
  
  // Article management state
  const [selectedIds, setSelectedIds] = useState([])
  const [query, setQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)
  const [toast, setToast] = useState(null)
  const [articleTab, setArticleTab] = useState('translated') // 'translated' or 'pushed'
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [articleDetail, setArticleDetail] = useState(null) // Full article details
  const [editedTitleEn, setEditedTitleEn] = useState('')
  const [editedTitleZh, setEditedTitleZh] = useState('')
  const [editedContentEn, setEditedContentEn] = useState('')
  const [editedContentZh, setEditedContentZh] = useState('')
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [showDetailDebug, setShowDetailDebug] = useState(false)
  const showToast = (opts) => {
    try {
      const msg = (opts && opts.title ? opts.title : '') + (opts && opts.description ? '\n' + opts.description : '')
      setToast({ message: msg, type: opts?.status || 'info' })
      setTimeout(() => setToast(null), 3000)
    } catch (e) { console.log('toast', opts) }
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

  const isPushed = (it) => {
    try {
      const id = Number(getArticleId(it))
      if (!id) return false
      if (it && it._clientQueued) return true
      if (it && it.data && it.data._clientQueued) return true
      const ids = getPublishQueueIds()
      return ids.includes(id)
    } catch (e) { return false }
  }

  const isTranslated = (it) => {
    const s = (it.TranslationStatus || it.translationStatus || '').toString().toLowerCase()
    const approved = it.TranslationApprovedAt ?? it.translationApprovedAt ?? null
    if (approved) return true
    if (s.includes('approved')) return true
    if (s.includes('translated')) return true
    return false
  }

  const renderBadge = (item) => {
    const s = ((item && (item.TranslationStatus || item.translationStatus)) || '').toString().toLowerCase()
    const base = { padding: '6px 10px', borderRadius: 12, fontWeight: 600, fontSize: 12 }

    if (isPushed(item)) {
      return <span style={{ ...base, background: '#e6f0ff', color: '#1e73d1' }}>Pushed</span>
    }

    if (s.includes('inprogress') || s.includes('in progress')) {
      return <span style={{ ...base, background: '#fff4e6', color: '#e07a16' }}>In Progress</span>
    }

    if (isTranslated(item)) {
      return <span style={{ ...base, background: '#e8f9ee', color: '#1e7a3a' }}>Translated</span>
    }

    if (!s || s === 'pending' || s.includes('pending')) {
      return <span style={{ ...base, background: '#e6f0ff', color: '#1e73d1' }}>Pending</span>
    }

    return <span style={{ ...base, background: '#f3f4f6', color: '#444' }}>{item.TranslationStatus || item.translationStatus || 'Unknown'}</span>
  }

  const toggleSelect = (id) => {
    if (!id) return
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const publishSelected = async () => {
    if (!selectedIds || selectedIds.length === 0) { alert('No articles selected'); return }
    if (!window.confirm(`Push ${selectedIds.length} selected article(s) to publish queue?`)) return
    try {
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
        const found = articles.find(it => Number(getArticleId(it) ?? NaN) === id)
        if (!found) return { id }
        const clone = { ...(found || {}) }
        delete clone.PublishedAt
        delete clone.publishedAt
        delete clone.IsPublished
        delete clone.isPublished
        delete clone.draft
        return { id, data: { article: clone, _clientQueued: true } }
      }).filter(Boolean)

      const merged = [...existingObjs, ...toAddObjs]
      const deduped = merged.reduce((acc, cur) => { if (!acc.some(x => x.id === cur.id)) acc.push(cur); return acc }, [])
      localStorage.setItem('publishQueue', JSON.stringify(deduped))

      showToast({ title: 'Pushed to publish queue', status: 'success' })
      setSelectedIds([])
      window.dispatchEvent(new Event('articles:changed'))
    } catch (err) {
      showToast({ title: 'Failed to push to queue', description: err.message || err, status: 'error' })
    }
  }

  const coerceText = (value) => {
    if (typeof value === 'string') return value
    if (Array.isArray(value)) {
      const parts = value
        .map(v => {
          if (typeof v === 'string') return v
          if (v && typeof v === 'object') {
            return v.text || v.Text || v.summary || v.Summary || v.content || v.Content || ''
          }
          return ''
        })
        .map(v => (typeof v === 'string' ? v.trim() : ''))
        .filter(Boolean)
      return parts.length ? parts.join('\n') : ''
    }
    if (value && typeof value === 'object') {
      const txt = value.text || value.Text || value.summary || value.Summary || value.content || value.Content || ''
      return typeof txt === 'string' ? txt : ''
    }
    return ''
  }

  const extractTranslatedText = (resp) => {
    if (!resp) return ''
    if (typeof resp === 'string') return resp
    if (typeof resp === 'object') {
      return resp.translatedText || resp.TranslatedText || resp.translation || resp.Translation || resp.text || resp.Text || resp.result || resp.Result || ''
    }
    return ''
  }

  const pickFromPayloads = (payloads, selectors) => {
    for (const p of payloads) {
      if (!p) continue
      for (const sel of selectors) {
        const v = coerceText(sel(p))
        if (v && v.trim()) return v
      }
    }
    return ''
  }

  const containsCjk = (value) => /[\u3400-\u9fff\uf900-\ufaff]/.test(value || '')

  const viewArticleDetail = async (article) => {
    setSelectedArticle(article)
    setViewModalOpen(true)
    setLoadingDetail(true)
    setShowDetailDebug(false)
    setEditedTitleEn(article.title || '')
    setEditedTitleZh('')
    setEditedContentEn('')
    setEditedContentZh('')
    
    // Try to fetch full article details from server
    try {
      const aid = getArticleId(article)
      if (aid) {
        const [baseRes, enRes, zhRes] = await Promise.allSettled([
          getArticle(aid),
          getArticle(aid, 'en'),
          getArticle(aid, 'zh')
        ])
        const base = baseRes.status === 'fulfilled' ? baseRes.value : null
        const en = enRes.status === 'fulfilled' ? enRes.value : null
        const zh = zhRes.status === 'fulfilled' ? zhRes.value : null
        setArticleDetail(base || en || zh)

        const titleEn = pickFromPayloads([en, base], [
          p => p.TitleEN, p => p.titleEN, p => p.titleEn,
          p => p.Article?.TitleEN, p => p.Article?.titleEN, p => p.Article?.titleEn,
          p => p.article?.TitleEN, p => p.article?.titleEN, p => p.article?.titleEn,
          p => p.titleEN, p => p.titleEn,
          p => p.Title, p => p.title
        ])
        const titleZh = pickFromPayloads([zh, base], [
          p => p.TitleZH, p => p.titleZH, p => p.titleZh,
          p => p.Article?.TitleZH, p => p.Article?.titleZH, p => p.Article?.titleZh,
          p => p.article?.TitleZH, p => p.article?.titleZH, p => p.article?.titleZh,
          p => p.Title, p => p.title
        ])

        let summaryEn = pickFromPayloads([en, base], [
          p => p.SummaryEN, p => p.summaryEN, p => p.summaryEn,
          p => p.SummaryPoints, p => p.summaryPoints, p => p.SummaryBullets, p => p.summaryBullets,
          p => p.KeyPoints, p => p.keyPoints,
          p => p.Article?.SummaryEN, p => p.Article?.summaryEN, p => p.Article?.summaryEn,
          p => p.Article?.SummaryPoints, p => p.Article?.summaryPoints, p => p.Article?.SummaryBullets, p => p.Article?.summaryBullets,
          p => p.Article?.KeyPoints, p => p.Article?.keyPoints,
          p => p.article?.SummaryEN, p => p.article?.summaryEN, p => p.article?.summaryEn,
          p => p.article?.SummaryPoints, p => p.article?.summaryPoints, p => p.article?.SummaryBullets, p => p.article?.summaryBullets,
          p => p.article?.KeyPoints, p => p.article?.keyPoints,
          p => p.data?.SummaryEN, p => p.data?.summaryEN, p => p.data?.summaryEn,
          p => p.data?.SummaryPoints, p => p.data?.summaryPoints, p => p.data?.SummaryBullets, p => p.data?.summaryBullets,
          p => p.data?.KeyPoints, p => p.data?.keyPoints,
          p => p.Data?.SummaryEN, p => p.Data?.summaryEN, p => p.Data?.summaryEn,
          p => p.Data?.SummaryPoints, p => p.Data?.summaryPoints, p => p.Data?.SummaryBullets, p => p.Data?.summaryBullets,
          p => p.Data?.KeyPoints, p => p.Data?.keyPoints,
          p => p.data?.article?.SummaryEN, p => p.data?.article?.summaryEN, p => p.data?.article?.summaryEn,
          p => p.data?.article?.SummaryPoints, p => p.data?.article?.summaryPoints, p => p.data?.article?.SummaryBullets, p => p.data?.article?.summaryBullets,
          p => p.data?.article?.KeyPoints, p => p.data?.article?.keyPoints,
          p => p.Summary, p => p.summary
        ])
        let summaryZh = pickFromPayloads([zh, base], [
          p => p.SummaryZH, p => p.summaryZH, p => p.summaryZh,
          p => p.SummaryPoints, p => p.summaryPoints, p => p.SummaryBullets, p => p.summaryBullets,
          p => p.KeyPoints, p => p.keyPoints,
          p => p.Article?.SummaryZH, p => p.Article?.summaryZH, p => p.Article?.summaryZh,
          p => p.Article?.SummaryPoints, p => p.Article?.summaryPoints, p => p.Article?.SummaryBullets, p => p.Article?.summaryBullets,
          p => p.Article?.KeyPoints, p => p.Article?.keyPoints,
          p => p.article?.SummaryZH, p => p.article?.summaryZH, p => p.article?.summaryZh,
          p => p.article?.SummaryPoints, p => p.article?.summaryPoints, p => p.article?.SummaryBullets, p => p.article?.summaryBullets,
          p => p.article?.KeyPoints, p => p.article?.keyPoints,
          p => p.data?.SummaryZH, p => p.data?.summaryZH, p => p.data?.summaryZh,
          p => p.data?.SummaryPoints, p => p.data?.summaryPoints, p => p.data?.SummaryBullets, p => p.data?.summaryBullets,
          p => p.data?.KeyPoints, p => p.data?.keyPoints,
          p => p.Data?.SummaryZH, p => p.Data?.summaryZH, p => p.Data?.summaryZh,
          p => p.Data?.SummaryPoints, p => p.Data?.summaryPoints, p => p.Data?.SummaryBullets, p => p.Data?.summaryBullets,
          p => p.Data?.KeyPoints, p => p.Data?.keyPoints,
          p => p.data?.article?.SummaryZH, p => p.data?.article?.summaryZH, p => p.data?.article?.summaryZh,
          p => p.data?.article?.SummaryPoints, p => p.data?.article?.summaryPoints, p => p.data?.article?.SummaryBullets, p => p.data?.article?.summaryBullets,
          p => p.data?.article?.KeyPoints, p => p.data?.article?.keyPoints,
          p => p.Summary, p => p.summary
        ])

        if (!summaryEn || !summaryZh) {
          const raw = article?.raw || {}
          const rawSummaryEn =
            raw.SummaryEN ?? raw.summaryEN ?? raw.summaryEn ??
            raw.SummaryPoints ?? raw.summaryPoints ?? raw.SummaryBullets ?? raw.summaryBullets ?? raw.KeyPoints ?? raw.keyPoints ??
            raw.Article?.SummaryEN ?? raw.Article?.summaryEN ?? raw.Article?.summaryEn ??
            raw.Article?.SummaryPoints ?? raw.Article?.summaryPoints ?? raw.Article?.SummaryBullets ?? raw.Article?.summaryBullets ?? raw.Article?.KeyPoints ?? raw.Article?.keyPoints ??
            raw.article?.SummaryEN ?? raw.article?.summaryEN ?? raw.article?.summaryEn ??
            raw.article?.SummaryPoints ?? raw.article?.summaryPoints ?? raw.article?.SummaryBullets ?? raw.article?.summaryBullets ?? raw.article?.KeyPoints ?? raw.article?.keyPoints ??
            raw.Data?.SummaryEN ?? raw.Data?.summaryEN ?? raw.Data?.summaryEn ??
            raw.Data?.SummaryPoints ?? raw.Data?.summaryPoints ?? raw.Data?.SummaryBullets ?? raw.Data?.summaryBullets ?? raw.Data?.KeyPoints ?? raw.Data?.keyPoints ??
            raw.data?.SummaryEN ?? raw.data?.summaryEN ?? raw.data?.summaryEn ??
            raw.data?.SummaryPoints ?? raw.data?.summaryPoints ?? raw.data?.SummaryBullets ?? raw.data?.summaryBullets ?? raw.data?.KeyPoints ?? raw.data?.keyPoints ??
            raw.Data?.article?.SummaryEN ?? raw.Data?.article?.summaryEN ?? raw.Data?.article?.summaryEn ??
            raw.Data?.article?.SummaryPoints ?? raw.Data?.article?.summaryPoints ?? raw.Data?.article?.SummaryBullets ?? raw.Data?.article?.summaryBullets ?? raw.Data?.article?.KeyPoints ?? raw.Data?.article?.keyPoints ??
            raw.data?.article?.SummaryEN ?? raw.data?.article?.summaryEN ?? raw.data?.article?.summaryEn ??
            raw.data?.article?.SummaryPoints ?? raw.data?.article?.summaryPoints ?? raw.data?.article?.SummaryBullets ?? raw.data?.article?.summaryBullets ?? raw.data?.article?.KeyPoints ?? raw.data?.article?.keyPoints ??
            raw.Summary ?? raw.summary ?? ''
          const rawSummaryZh =
            raw.SummaryZH ?? raw.summaryZH ?? raw.summaryZh ??
            raw.SummaryPoints ?? raw.summaryPoints ?? raw.SummaryBullets ?? raw.summaryBullets ?? raw.KeyPoints ?? raw.keyPoints ??
            raw.Article?.SummaryZH ?? raw.Article?.summaryZH ?? raw.Article?.summaryZh ??
            raw.Article?.SummaryPoints ?? raw.Article?.summaryPoints ?? raw.Article?.SummaryBullets ?? raw.Article?.summaryBullets ?? raw.Article?.KeyPoints ?? raw.Article?.keyPoints ??
            raw.article?.SummaryZH ?? raw.article?.summaryZH ?? raw.article?.summaryZh ??
            raw.article?.SummaryPoints ?? raw.article?.summaryPoints ?? raw.article?.SummaryBullets ?? raw.article?.summaryBullets ?? raw.article?.KeyPoints ?? raw.article?.keyPoints ??
            raw.Data?.SummaryZH ?? raw.Data?.summaryZH ?? raw.Data?.summaryZh ??
            raw.Data?.SummaryPoints ?? raw.Data?.summaryPoints ?? raw.Data?.SummaryBullets ?? raw.Data?.summaryBullets ?? raw.Data?.KeyPoints ?? raw.Data?.keyPoints ??
            raw.data?.SummaryZH ?? raw.data?.summaryZH ?? raw.data?.summaryZh ??
            raw.data?.SummaryPoints ?? raw.data?.summaryPoints ?? raw.data?.SummaryBullets ?? raw.data?.summaryBullets ?? raw.data?.KeyPoints ?? raw.data?.keyPoints ??
            raw.Data?.article?.SummaryZH ?? raw.Data?.article?.summaryZH ?? raw.Data?.article?.summaryZh ??
            raw.Data?.article?.SummaryPoints ?? raw.Data?.article?.summaryPoints ?? raw.Data?.article?.SummaryBullets ?? raw.Data?.article?.summaryBullets ?? raw.Data?.article?.KeyPoints ?? raw.Data?.article?.keyPoints ??
            raw.data?.article?.SummaryZH ?? raw.data?.article?.summaryZH ?? raw.data?.article?.summaryZh ??
            raw.data?.article?.SummaryPoints ?? raw.data?.article?.summaryPoints ?? raw.data?.article?.SummaryBullets ?? raw.data?.article?.summaryBullets ?? raw.data?.article?.KeyPoints ?? raw.data?.article?.keyPoints ??
            raw.Summary ?? raw.summary ?? ''
          const rawSummaryEnText = coerceText(rawSummaryEn)
          const rawSummaryZhText = coerceText(rawSummaryZh)
          if (!summaryEn && rawSummaryEnText && !containsCjk(rawSummaryEnText)) summaryEn = rawSummaryEnText
          if (!summaryZh && rawSummaryZhText && containsCjk(rawSummaryZhText)) summaryZh = rawSummaryZhText
        }

        if ((!summaryEn || !summaryZh)) {
          const localSummaryEn = coerceText(article?.summaryEN ?? article?.summaryEn ?? article?.summary ?? '')
          const localSummaryZh = coerceText(article?.summaryZH ?? article?.summaryZh ?? article?.summary ?? '')
          if (!summaryEn && localSummaryEn && !containsCjk(localSummaryEn)) summaryEn = localSummaryEn
          if (!summaryZh && localSummaryZh && containsCjk(localSummaryZh)) summaryZh = localSummaryZh
        }

        if ((!summaryEn || !summaryZh)) {
          const detailSummaryEn = coerceText(
            en?.summaryEN ?? en?.SummaryEN ??
            base?.summaryEN ?? base?.SummaryEN ??
            articleDetail?.summaryEN ?? articleDetail?.SummaryEN ??
            articleDetail?.article?.summaryEN ?? articleDetail?.article?.SummaryEN ??
            articleDetail?.article?.summary ?? articleDetail?.article?.Summary ?? ''
          )
          const detailSummaryZh = coerceText(
            zh?.summaryZH ?? zh?.SummaryZH ??
            base?.summaryZH ?? base?.SummaryZH ??
            articleDetail?.summaryZH ?? articleDetail?.SummaryZH ??
            articleDetail?.article?.summaryZH ?? articleDetail?.article?.SummaryZH ??
            articleDetail?.article?.summary ?? articleDetail?.article?.Summary ?? ''
          )
          if (!summaryEn && detailSummaryEn && !containsCjk(detailSummaryEn)) summaryEn = detailSummaryEn
          if (!summaryZh && detailSummaryZh && containsCjk(detailSummaryZh)) summaryZh = detailSummaryZh
        }

        if ((!summaryEn || !summaryZh)) {
          const raw = article?.raw || {}
          const originalLang = String(raw.originalLanguage || raw.OriginalLanguage || '').toLowerCase()
          const translatedLang = String(raw.translationLanguage || raw.TranslationLanguage || '').toLowerCase()
          const translatedText = coerceText(
            articleDetail?.translatedContent ?? articleDetail?.TranslatedContent ??
            articleDetail?.article?.translatedContent ?? articleDetail?.article?.TranslatedContent ??
            base?.translatedContent ?? base?.TranslatedContent ?? ''
          )
          const originalText = coerceText(
            articleDetail?.originalContent ?? articleDetail?.OriginalContent ??
            articleDetail?.article?.originalContent ?? articleDetail?.article?.OriginalContent ??
            base?.originalContent ?? base?.OriginalContent ?? ''
          )
          if (!summaryEn && translatedText && (translatedLang.includes('en') || (!containsCjk(translatedText) && originalLang.includes('zh')))) summaryEn = translatedText
          if (!summaryZh && originalText && (originalLang.includes('zh') || containsCjk(originalText))) summaryZh = originalText
        }

        if ((!summaryEn || !summaryZh) && article?.snippet) {
          const snippetText = coerceText(article.snippet)
          if (!summaryEn && snippetText && !containsCjk(snippetText)) summaryEn = snippetText
          if (!summaryZh && snippetText && containsCjk(snippetText)) summaryZh = snippetText
        }

        const rawTitleEn = coerceText(selectedArticle?.raw?.titleEN || selectedArticle?.raw?.TitleEN || articleDetail?.titleEN || articleDetail?.TitleEN || articleDetail?.article?.titleEN || articleDetail?.article?.TitleEN || '')
        if (titleEn) setEditedTitleEn(titleEn)
        else if (rawTitleEn) setEditedTitleEn(rawTitleEn)
        if (titleZh) setEditedTitleZh(titleZh)
        if (summaryEn) setEditedContentEn(summaryEn)
        if (summaryZh) setEditedContentZh(summaryZh)

        if (!summaryEn && summaryZh) {
          try {
            const preview = await translatePreview(aid, 'en', summaryZh.slice(0, 3000))
            const translated = extractTranslatedText(preview)
            if (translated) setEditedContentEn(translated)
          } catch (e) {
            console.warn('translatePreview failed', e)
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load article detail:', e)
    } finally {
      setLoadingDetail(false)
    }
  }

  const deleteArticleHandler = async (article) => {
    const aid = getArticleId(article)
    if (!aid) { alert('Cannot delete: article ID missing'); return }
    
    if (!window.confirm('Delete this article? This cannot be undone.')) return
    
    try {
      await deleteArticle(aid)
      showToast({ title: 'Article deleted', status: 'success' })
      setArticles(prev => prev.filter(a => getArticleId(a) !== aid))
      window.dispatchEvent(new Event('articles:changed'))
    } catch (err) {
      showToast({ title: 'Failed to delete article', description: err.message || err, status: 'error' })
    }
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
            const fallback = raw.TitleZH ?? raw.titleZH ?? raw.titleZh ?? raw.TitleEN ?? raw.titleEN ?? raw.Title ?? raw.title ?? raw.Summary ?? raw.summary ?? raw.Snippet ?? raw.snippet ?? `Article ${n.id || 'unknown'}`
            return { ...n, title: fallback || n.title }
          }
          return n
        })
        console.debug('loadRecentArticles - normalized recent articles:', normalized)
        // merge server-provided recent articles into current list, placing server items at top
        setArticles(prev => {
          const merged = mergeNewOnTop(normalized, prev)
          console.log(`📊 After recent articles: ${merged.length} total`)
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
            const fallback = raw.TitleZH ?? raw.titleZh ?? raw.Title ?? raw.title ?? raw.Summary ?? raw.summary ?? raw.Snippet ?? raw.snippet ?? `Article ${n.id || 'unknown'}`
            return { ...n, title: fallback || n.title }
          }
          return n
        })
        // Don't filter out articles at this point - keep all for debugging
        console.debug('triggerFetch - all normalized articles:', normalized)
        console.log(`✅ Fetched ${normalized.length} articles with titles`, normalized.map(a => ({ id: a.id, title: a.title?.substring(0, 50) })))
        setArticles(prev => {
          const merged = mergeNewOnTop(normalized, prev)
          console.log(`📊 Article state: ${merged.length} total (${normalized.length} new, ${prev.length} existing)`)
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
    summaryEn: a.SummaryEN ?? a.summaryEN ?? a.summaryEn ?? a.SummaryPoints ?? a.summaryPoints ?? a.SummaryBullets ?? a.summaryBullets ?? a.KeyPoints ?? a.keyPoints ?? a.Article?.SummaryEN ?? a.Article?.summaryEN ?? a.Article?.summaryEn ?? a.Article?.SummaryPoints ?? a.Article?.summaryPoints ?? a.Article?.SummaryBullets ?? a.Article?.summaryBullets ?? a.Article?.KeyPoints ?? a.Article?.keyPoints ?? a.article?.SummaryEN ?? a.article?.summaryEN ?? a.article?.summaryEn ?? a.article?.SummaryPoints ?? a.article?.summaryPoints ?? a.article?.SummaryBullets ?? a.article?.summaryBullets ?? a.article?.KeyPoints ?? a.article?.keyPoints ?? null,
    summaryZh: a.SummaryZH ?? a.summaryZH ?? a.summaryZh ?? a.SummaryPoints ?? a.summaryPoints ?? a.SummaryBullets ?? a.summaryBullets ?? a.KeyPoints ?? a.keyPoints ?? a.Article?.SummaryZH ?? a.Article?.summaryZH ?? a.Article?.summaryZh ?? a.Article?.SummaryPoints ?? a.Article?.summaryPoints ?? a.Article?.SummaryBullets ?? a.Article?.summaryBullets ?? a.Article?.KeyPoints ?? a.Article?.keyPoints ?? a.article?.SummaryZH ?? a.article?.summaryZH ?? a.article?.summaryZh ?? a.article?.SummaryPoints ?? a.article?.summaryPoints ?? a.article?.SummaryBullets ?? a.article?.summaryBullets ?? a.article?.KeyPoints ?? a.article?.keyPoints ?? null,
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

  // Count translated and pushed articles
  const translatedCount = articles.filter(a => isTranslated(a) && !isPushed(a)).length
  const pushedCount = articles.filter(a => isPushed(a)).length
  const availableCount = articles.filter(a => !isPushed(a)).length

  // Filter articles by search query and tab
  let displayArticles = articles.filter(a => {
    if (!query) return true
    const q = query.toLowerCase()
    const title = (a.title || '').toString().toLowerCase()
    const source = (a.sourceName || sources.find(s => String(s.SourceId) === String(a.sourceId))?.Name || '').toString().toLowerCase()
    return title.includes(q) || source.includes(q)
  })

  // Apply tab filter: show all non-pushed articles as "translated" (even if not explicitly translated)
  if (articleTab === 'translated') {
    displayArticles = displayArticles.filter(a => !isPushed(a))
  } else if (articleTab === 'pushed') {
    displayArticles = displayArticles.filter(a => isPushed(a))
  }

  // Pagination
  const totalPages = Math.max(1, Math.ceil(displayArticles.length / pageSize))
  const paginatedArticles = displayArticles.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const cardStyle = { background: '#ffffff', borderRadius: 14, boxShadow: '0 8px 30px rgba(0,0,0,0.06)', overflow: 'hidden' }
  const inputStyle = { padding: '8px 12px', borderRadius: 8, border: '1px solid #e6e6e6', fontSize: 14, outline: 'none', background: '#fafafa', width: '100%', boxSizing: 'border-box' }
  const labelStyle = { fontSize: 13, color: '#555', fontWeight: 600, marginBottom: 4, display: 'block' }
  const checkboxRowStyle = { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 14, color: '#444' }

  return (
    <div style={{ padding: '28px 32px', background: '#fbf8f6', minHeight: '100vh', boxSizing: 'border-box' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111' }}>News Fetch Dashboard</h2>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#888' }}>Monitor crawlers, trigger fetches, and review recent articles</p>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Sources', value: total, icon: '📡', color: '#1e73d1', bg: '#e6f2ff' },
          { label: 'Active Sources', value: active, icon: '✅', color: '#1e7a3a', bg: '#ecf7f0' },
          { label: 'Inactive Sources', value: inactive, icon: '⏸️', color: '#e07a16', bg: '#fff4e6' },
          { label: 'Articles Fetched', value: articles.length, icon: '📰', color: '#7c3aed', bg: '#f3f0ff' },
          { label: 'Translated', value: translatedCount, icon: '✨', color: '#1e7a3a', bg: '#ecf7f0' },
          { label: 'Pushed to Queue', value: pushedCount, icon: '📤', color: '#1e73d1', bg: '#e6f2ff' }
        ].map((stat, i) => (
          <div key={i} style={{ ...cardStyle, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{stat.icon}</div>
              <span style={{ fontSize: 13, color: '#888', fontWeight: 500 }}>{stat.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Action Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
        {/* Crawler Status */}
        <div style={{ ...cardStyle, padding: 20, borderTop: '3px solid #1e73d1' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e73d1', marginBottom: 10, letterSpacing: '0.3px' }}>CRAWLER STATUS</div>
          <div style={{ color: '#888', fontSize: 14 }}>No logs yet.</div>
          {(!articles.length && lastFetchRaw) && (() => {
            const sums = extractSummaryFromResponse(lastFetchRaw)
            if (sums && sums.length) {
              return (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14 }}>Fetch Results</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '2px solid #f0f0f0' }}>
                        <th style={{ padding: '8px 10px', color: '#888', fontWeight: 600 }}>Source</th>
                        <th style={{ padding: '8px 10px', color: '#888', fontWeight: 600 }}>Fetched</th>
                        <th style={{ padding: '8px 10px', color: '#888', fontWeight: 600 }}>Added</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sums.map((r,i) => (
                        <tr key={r.sourceId ?? r.SourceId ?? i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                          <td style={{ padding: '8px 10px' }}>{r.name ?? r.Name ?? (sources.find(s=>s.SourceId===r.sourceId)?.Name) ?? '-'}</td>
                          <td style={{ padding: '8px 10px' }}>{r.fetched ?? r.Fetched ?? 0}</td>
                          <td style={{ padding: '8px 10px' }}>{r.added ?? r.Added ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <details style={{ marginTop: 12 }}>
                    <summary style={{ cursor: 'pointer', fontSize: 12, color: '#999' }}>Show raw response (debug)</summary>
                    <pre style={{ maxHeight: 250, overflow: 'auto', background: '#fafafa', padding: 10, borderRadius: 8, fontSize: 12, marginTop: 6 }}>{JSON.stringify(lastFetchRaw, null, 2)}</pre>
                  </details>
                </div>
              )
            }
            return (
              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: 'pointer', fontSize: 12, color: '#999' }}>Show raw response (debug)</summary>
                <pre style={{ maxHeight: 250, overflow: 'auto', background: '#fafafa', padding: 10, borderRadius: 8, fontSize: 12, marginTop: 6 }}>{JSON.stringify(lastFetchRaw, null, 2)}</pre>
              </details>
            )
          })()}
          <div style={{ color: '#bbb', marginTop: 12, fontSize: 12 }}>Last Run: {new Date().toLocaleString()}</div>
        </div>

        {/* Manual Fetch Trigger */}
        <div style={{ ...cardStyle, padding: 20, borderTop: '3px solid #e07a16', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e07a16', marginBottom: 10, letterSpacing: '0.3px' }}>MANUAL FETCH</div>
          <div style={{ color: '#888', fontSize: 14, marginBottom: 16 }}>Trigger a new article fetch from configured sources.</div>
          <div style={{ marginTop: 'auto' }}>
            <button
              onClick={() => {
                const defaults = {
                  TranslateOnFetch: true, SummaryWordCount: 150, SummaryTone: 'neutral',
                  SummaryFormat: 'paragraph', CustomKeyPoints: '', MaxArticlesPerFetch: 10,
                  IncludeOriginalChinese: true, IncludeEnglishSummary: true, IncludeChineseSummary: true,
                  MinArticleLength: 0, SummaryFocus: '', SentimentAnalysisEnabled: false,
                  HighlightEntities: false, SummaryLanguage: 'EN'
                }
                setModalSetting(defaults)
                setModalSelectedSourceIds(sources.filter(x=>x.IsActive).map(x=>x.SourceId))
                setModalPersist(true); setModalForce(false); setModalDebug(false); setSettingModalOpen(true)
              }}
              disabled={running}
              style={{
                background: running ? '#ccc' : '#e07a16', color: 'white', padding: '10px 20px',
                borderRadius: 8, border: 'none', cursor: running ? 'default' : 'pointer',
                fontWeight: 600, fontSize: 14, width: '100%', transition: 'background 0.2s'
              }}
            >{running ? '⏳ Running...' : '🚀 Trigger Fetch Now'}</button>
          </div>
        </div>

        {/* Recent Errors */}
        <div style={{ ...cardStyle, padding: 20, borderTop: '3px solid #c92b2b' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#c92b2b', marginBottom: 10, letterSpacing: '0.3px' }}>RECENT ERRORS</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', background: '#ecf7f0', borderRadius: 8 }}>
            <span style={{ fontSize: 16 }}>✅</span>
            <span style={{ color: '#1e7a3a', fontSize: 14, fontWeight: 500 }}>No recent errors.</span>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {settingModalOpen && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ width: 780, maxWidth: '96%', ...cardStyle, padding: 0 }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 22px', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#111' }}>⚙️ Fetch Configuration</div>
              <button onClick={() => setSettingModalOpen(false)} style={{ border: 'none', background: '#f5f5f5', cursor: 'pointer', fontSize: 16, width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            {/* Modal Body */}
            <div style={{ maxHeight: '60vh', overflow: 'auto', padding: '18px 22px' }}>
              {/* Source Selection */}
              <div style={{ marginBottom: 18, padding: 14, background: '#fafafa', borderRadius: 10, border: '1px solid #f0f0f0' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#555', marginBottom: 10, letterSpacing: '0.3px' }}>SELECT SOURCES</div>
                <div style={{ display: 'grid', gridTemplateColumns: sources.length > 4 ? '1fr 1fr' : '1fr', gap: 4 }}>
                  {sources.map(s => (
                    <label key={s.SourceId} style={checkboxRowStyle}>
                      <input type="checkbox" checked={modalSelectedSourceIds.includes(s.SourceId)} onChange={(e) => {
                        const next = modalSelectedSourceIds.slice()
                        if (e.target.checked) { if (!next.includes(s.SourceId)) next.push(s.SourceId) }
                        else { const idx = next.indexOf(s.SourceId); if (idx !== -1) next.splice(idx,1) }
                        setModalSelectedSourceIds(next)
                      }} style={{ accentColor: '#1e73d1' }} />
                      <span>{s.Name ?? s.name ?? `Source ${s.SourceId}`}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Settings Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Summary Word Count</label>
                  <input type="number" value={modalSetting?.SummaryWordCount ?? 150} onChange={e => setModalSetting({...modalSetting, SummaryWordCount: Number(e.target.value)})} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Max Articles Per Fetch</label>
                  <input type="number" value={modalSetting?.MaxArticlesPerFetch ?? 10} onChange={e => setModalSetting({...modalSetting, MaxArticlesPerFetch: Number(e.target.value)})} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Min Article Length</label>
                  <input type="number" value={modalSetting?.MinArticleLength ?? 200} onChange={e => setModalSetting({...modalSetting, MinArticleLength: Number(e.target.value)})} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Summary Tone</label>
                  <select value={modalSetting?.SummaryTone ?? 'neutral'} onChange={e => setModalSetting({...modalSetting, SummaryTone: e.target.value})} style={inputStyle}>
                    <option value="neutral">Neutral</option>
                    <option value="positive">Positive</option>
                    <option value="negative">Negative</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Summary Format</label>
                  <select value={modalSetting?.SummaryFormat ?? 'paragraph'} onChange={e => setModalSetting({...modalSetting, SummaryFormat: e.target.value})} style={inputStyle}>
                    <option value="paragraph">Paragraph</option>
                    <option value="bullets">Bullets</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Summary Language</label>
                  <select value={modalSetting?.SummaryLanguage ?? 'EN'} onChange={e => setModalSetting({...modalSetting, SummaryLanguage: e.target.value})} style={inputStyle}>
                    <option value="EN">English</option>
                    <option value="ZH">Chinese</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Summary Focus</label>
                  <input type="text" value={modalSetting?.SummaryFocus ?? ''} onChange={e => setModalSetting({...modalSetting, SummaryFocus: e.target.value})} style={inputStyle} placeholder="e.g. economic impact" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Custom Key Points (comma-separated)</label>
                  <textarea value={modalSetting?.CustomKeyPoints ?? ''} onChange={e => setModalSetting({...modalSetting, CustomKeyPoints: e.target.value})} style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} rows={2} placeholder="key point 1, key point 2, ..." />
                </div>
              </div>

              {/* Toggle Options */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 14, padding: 14, background: '#fafafa', borderRadius: 10, border: '1px solid #f0f0f0' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#555', gridColumn: '1 / -1', marginBottom: 4, letterSpacing: '0.3px' }}>OPTIONS</div>
                {[
                  { key: 'TranslateOnFetch', label: 'Translate on Fetch' },
                  { key: 'IncludeEnglishSummary', label: 'Include English Summary' },
                  { key: 'IncludeChineseSummary', label: 'Include Chinese Summary' },
                  { key: 'SentimentAnalysisEnabled', label: 'Sentiment Analysis' },
                  { key: 'HighlightEntities', label: 'Highlight Entities' }
                ].map(opt => (
                  <label key={opt.key} style={checkboxRowStyle}>
                    <input type="checkbox" checked={!!(modalSetting && modalSetting[opt.key])} onChange={e => setModalSetting({...modalSetting, [opt.key]: e.target.checked})} style={{ accentColor: '#1e73d1' }} />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 22px', borderTop: '1px solid #f0f0f0', background: '#fafafa' }}>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <label style={{ ...checkboxRowStyle, fontSize: 13 }}>
                  <input type="checkbox" checked={modalPersist} onChange={e => setModalPersist(e.target.checked)} style={{ accentColor: '#1e73d1' }} /> Persist to server
                </label>
                <label style={{ ...checkboxRowStyle, fontSize: 13 }}>
                  <input type="checkbox" checked={modalForce} onChange={e => setModalForce(e.target.checked)} style={{ accentColor: '#e07a16' }} /> Force duplicates
                </label>
                <label style={{ ...checkboxRowStyle, fontSize: 13 }}>
                  <input type="checkbox" checked={modalDebug} onChange={e => setModalDebug(e.target.checked)} style={{ accentColor: '#7c3aed' }} /> Debug mode
                </label>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setSettingModalOpen(false)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #e0e0e0', background: 'white', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#555' }}>Cancel</button>
                <button onClick={async () => {
                  try { await triggerFetch(modalPersist, modalSetting, modalSelectedSourceIds, modalDebug, modalForce) } catch (e) { /* handled */ }
                  setSettingModalOpen(false)
                }} disabled={running} style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: running ? '#ccc' : '#1e73d1', color: 'white', cursor: running ? 'default' : 'pointer', fontWeight: 600, fontSize: 13 }}>{running ? 'Running...' : '🚀 Start Fetch'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content Grid */}
      <div>
        {/* Fetched & Translated Articles */}
        <div style={{ ...cardStyle, padding: 22 }}>
          {/* Header with tabs */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#111', marginBottom: 12 }}>Articles Library</div>
              <div style={{ display: 'flex', gap: 2 }}>
                <button
                  onClick={() => { setArticleTab('translated'); setCurrentPage(1) }}
                  style={{
                    padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: articleTab === 'translated' ? '#1e73d1' : '#f0f0f0',
                    color: articleTab === 'translated' ? 'white' : '#666',
                    borderRadius: '8px 0 0 8px'
                  }}
                >📰 Available ({availableCount})</button>
                <button
                  onClick={() => { setArticleTab('pushed'); setCurrentPage(1) }}
                  style={{
                    padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: articleTab === 'pushed' ? '#1e73d1' : '#f0f0f0',
                    color: articleTab === 'pushed' ? 'white' : '#666',
                    borderRadius: '0 8px 8px 0'
                  }}
                >📤 Pushed ({pushedCount})</button>
              </div>
            </div>
            {displayArticles.length > 0 && (
              <span style={{ fontSize: 12, color: '#999', fontWeight: 500 }}>{displayArticles.length} article{displayArticles.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {displayArticles.length > 0 ? (
            <>
              {/* Controls */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
                {articleTab === 'translated' && (
                  <button
                    onClick={publishSelected}
                    disabled={selectedIds.length === 0}
                    style={{ background: selectedIds.length === 0 ? '#f3f3f3' : '#1e73d1', color: selectedIds.length === 0 ? '#999' : 'white', padding: '8px 14px', borderRadius: 8, border: 'none', cursor: selectedIds.length === 0 ? 'default' : 'pointer', fontWeight: 600, fontSize: 13 }}
                  >Push To Queue ({selectedIds.length})</button>
                )}
                <input 
                  placeholder="🔍 Search by title or source..." 
                  value={query} 
                  onChange={e => { setQuery(e.target.value); setCurrentPage(1) }} 
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e6e6e6', minWidth: 200, fontSize: 13, flex: 1 }} 
                />
              </div>

              {/* Articles Table */}
              <div style={{ overflowX: 'auto', marginBottom: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                      <th style={{ padding: '10px 8px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#999', letterSpacing: '0.3px', width: '4%' }}>
                        <input 
                          type="checkbox" 
                          checked={displayArticles.length > 0 && displayArticles.every(a => selectedIds.includes(getArticleId(a)))}
                          onChange={() => {
                            if (displayArticles.every(a => selectedIds.includes(getArticleId(a)))) {
                              setSelectedIds(prev => prev.filter(id => !displayArticles.map(a => getArticleId(a)).includes(id)))
                            } else {
                              const newIds = displayArticles.map(a => getArticleId(a)).filter(Boolean)
                              setSelectedIds(prev => Array.from(new Set([...prev, ...newIds])))
                            }
                          }}
                        />
                      </th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#999', letterSpacing: '0.3px' }}>SOURCE</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#999', letterSpacing: '0.3px' }}>TITLE</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#999', letterSpacing: '0.3px' }}>FETCH TIME</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#999', letterSpacing: '0.3px' }}>STATUS</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#999', letterSpacing: '0.3px' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedArticles.map((a, i) => {
                      const aid = getArticleId(a)
                      return (
                        <tr key={aid ?? i} style={{ borderBottom: '1px solid #f5f5f5', transition: 'background 0.15s', cursor: 'default' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '10px 8px' }}>
                            {articleTab === 'translated' && (
                              <input 
                                type="checkbox" 
                                checked={selectedIds.includes(aid)} 
                                onChange={() => toggleSelect(aid)} 
                              />
                            )}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#555', whiteSpace: 'nowrap', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {a.sourceName ?? (sources.find(s => String(s.SourceId) === String(a.sourceId))?.Name) ?? '-'}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#222', fontSize: 13, lineHeight: 1.4, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {a.title ?? a.snippet ?? '-'}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>
                            {formatDate(a.fetchedAt)}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            {renderBadge(a)}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                              <button
                                title="View & Edit"
                                onClick={() => viewArticleDetail(a)}
                                style={{ background: '#e6f2ff', border: 'none', color: '#1e73d1', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                              >📝 View</button>
                              <button
                                title="Delete article"
                                onClick={() => deleteArticleHandler(a)}
                                style={{ background: '#fff4f4', border: 'none', color: '#c92b2b', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                              >🗑️ Delete</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage <= 1}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e0e0e0', background: 'white', cursor: currentPage <= 1 ? 'default' : 'pointer', color: currentPage <= 1 ? '#ccc' : '#666', fontWeight: 600, fontSize: 13 }}
                  >←</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      style={{
                        padding: '6px 10px', borderRadius: 6, border: p === currentPage ? 'none' : '1px solid #e0e0e0',
                        background: p === currentPage ? '#1e73d1' : 'white', color: p === currentPage ? 'white' : '#666',
                        cursor: p === currentPage ? 'default' : 'pointer', fontWeight: 600, fontSize: 13, minWidth: 32
                      }}
                    >{p}</button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage >= totalPages}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e0e0e0', background: 'white', cursor: currentPage >= totalPages ? 'default' : 'pointer', color: currentPage >= totalPages ? '#ccc' : '#666', fontWeight: 600, fontSize: 13 }}
                  >→</button>
                  <span style={{ fontSize: 12, color: '#999' }}>Page {currentPage} of {totalPages}</span>
                </div>
              )}
            </>
          ) : (
            loading ? (
              <div style={{ padding: 30, textAlign: 'center', color: '#999' }}>Loading articles...</div>
            ) : (
              <div style={{ padding: 30, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                <div style={{ color: '#999', fontSize: 14 }}>No {articleTab} articles available</div>
                <div style={{ color: '#ccc', fontSize: 13, marginTop: 4 }}>
                  {articleTab === 'translated' ? 'Trigger a fetch to get started' : 'Push articles from the Translated tab'}
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Article Detail Modal */}
      {viewModalOpen && selectedArticle && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998, padding: 16 }}>
          <div style={{ width: '90%', maxWidth: 900, maxHeight: '90vh', ...cardStyle, padding: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#111' }}>📝 Article Details</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={() => setShowDetailDebug(v => !v)}
                  style={{ border: '1px solid #e0e0e0', background: 'white', cursor: 'pointer', fontSize: 12, height: 32, padding: '0 10px', borderRadius: 8, color: '#555', fontWeight: 600 }}
                >{showDetailDebug ? 'Hide Debug' : 'Show Debug'}</button>
                <button onClick={() => { setViewModalOpen(false); setSelectedArticle(null); }} style={{ border: 'none', background: '#f5f5f5', cursor: 'pointer', fontSize: 16, width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1 }}>
              {loadingDetail ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>Loading article details...</div>
              ) : (
                <>
                  {/* Article Metadata */}
                  <div style={{ background: '#fafafa', padding: 14, borderRadius: 10, marginBottom: 18, border: '1px solid #f0f0f0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 4 }}>SOURCE</div>
                        <div style={{ fontSize: 14, color: '#333', fontWeight: 600 }}>{selectedArticle.sourceName || 'Unknown'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 4 }}>FETCH TIME</div>
                        <div style={{ fontSize: 14, color: '#333' }}>{formatDate(selectedArticle.fetchedAt)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 4 }}>STATUS</div>
                        <div>{renderBadge(selectedArticle)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 4 }}>ID</div>
                        <div style={{ fontSize: 14, color: '#333', fontFamily: 'monospace' }}>{getArticleId(selectedArticle)}</div>
                      </div>
                    </div>
                  </div>

                  {showDetailDebug && (
                    <div style={{ background: '#fff9f0', padding: 12, borderRadius: 10, marginBottom: 18, border: '1px solid #ffe2b7', fontSize: 12, color: '#7a4b00' }}>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>Debug: summary fields</div>
                      <div style={{ marginBottom: 6 }}>Article ID: {getArticleId(selectedArticle)}</div>
                      <div style={{ marginBottom: 6 }}>Article keys: {Object.keys(selectedArticle || {}).join(', ') || '-'}</div>
                      <div style={{ marginBottom: 6 }}>Raw keys: {Object.keys(selectedArticle?.raw || {}).join(', ') || '-'}</div>
                      <div style={{ marginBottom: 6 }}>Detail keys: {Object.keys(articleDetail || {}).join(', ') || '-'}</div>
                      <div>Raw summary snapshot: {JSON.stringify({
                        rawSummaryEN: selectedArticle?.raw?.SummaryEN,
                        rawSummaryENLower: selectedArticle?.raw?.summaryEN,
                        rawSummaryZH: selectedArticle?.raw?.SummaryZH,
                        rawSummaryZHLower: selectedArticle?.raw?.summaryZH,
                        rawSummary: selectedArticle?.raw?.Summary,
                        rawSummaryLower: selectedArticle?.raw?.summary,
                        rawSummaryPoints: selectedArticle?.raw?.SummaryPoints,
                        rawKeyPoints: selectedArticle?.raw?.KeyPoints,
                        rawContent: selectedArticle?.raw?.content
                      })}</div>
                      <div style={{ marginTop: 6 }}>Detail summary snapshot: {JSON.stringify({
                        detailSummaryEN: articleDetail?.summaryEN || articleDetail?.SummaryEN,
                        detailSummaryZH: articleDetail?.summaryZH || articleDetail?.SummaryZH,
                        detailArticleSummaryEN: articleDetail?.article?.summaryEN || articleDetail?.article?.SummaryEN || articleDetail?.article?.summary || articleDetail?.article?.Summary,
                        detailArticleSummaryZH: articleDetail?.article?.summaryZH || articleDetail?.article?.SummaryZH || articleDetail?.article?.summary || articleDetail?.article?.Summary,
                        detailTranslatedContent: articleDetail?.translatedContent || articleDetail?.TranslatedContent || articleDetail?.article?.translatedContent || articleDetail?.article?.TranslatedContent,
                        detailOriginalContent: articleDetail?.originalContent || articleDetail?.OriginalContent || articleDetail?.article?.originalContent || articleDetail?.article?.OriginalContent
                      })}</div>
                    </div>
                  )}

                  {/* English Content */}
                  <div style={{ marginBottom: 18 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 10 }}>🇬🇧 English</h3>
                    <div style={{ marginBottom: 10 }}>
                      <label style={labelStyle}>Title (English)</label>
                      <input 
                        value={editedTitleEn} 
                        onChange={e => setEditedTitleEn(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Summary (English)</label>
                      <textarea 
                        value={editedContentEn} 
                        onChange={e => setEditedContentEn(e.target.value)}
                        style={{ ...inputStyle, minHeight: 120, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                      />
                    </div>
                  </div>

                  {/* Chinese Content */}
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 10 }}>🇨🇳 Chinese</h3>
                    <div style={{ marginBottom: 10 }}>
                      <label style={labelStyle}>Title (Chinese)</label>
                      <input 
                        value={editedTitleZh} 
                        onChange={e => setEditedTitleZh(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Summary (Chinese)</label>
                      <textarea 
                        value={editedContentZh} 
                        onChange={e => setEditedContentZh(e.target.value)}
                        style={{ ...inputStyle, minHeight: 120, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, padding: '14px 22px', borderTop: '1px solid #f0f0f0', background: '#fafafa', flexShrink: 0 }}>
              <button 
                onClick={() => { setViewModalOpen(false); setSelectedArticle(null); }} 
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e0e0e0', background: 'white', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#555' }}
              >Close</button>
              <button 
                onClick={() => { 
                  deleteArticleHandler(selectedArticle)
                  setViewModalOpen(false)
                  setSelectedArticle(null)
                }} 
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#c92b2b', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
              >🗑️ Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div style={{ position: 'fixed', right: 20, bottom: 20, background: toast.type === 'error' ? '#fff4f4' : toast.type === 'info' ? '#f0f8ff' : '#e8f9ee', color: toast.type === 'error' ? '#a00' : toast.type === 'info' ? '#0066cc' : '#0a6', padding: '12px 16px', borderRadius: 8, boxShadow: '0 8px 30px rgba(0,0,0,0.08)', zIndex: 9999, maxWidth: 300 }}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
