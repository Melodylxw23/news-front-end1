import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getPublishDraft, batchPublish, getArticle, patchPublishDraft, generateHeroImage, publishAction, getIndustryTags, getInterestTags } from '../../api/articles'

// Inject toast animation styles
if (typeof document !== 'undefined' && !document.getElementById('publish-article-toast-animation')) {
  const style = document.createElement('style')
  style.id = 'publish-article-toast-animation'
  style.textContent = `
    @keyframes slideInFromRight {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `
  document.head.appendChild(style)
}

const palette = {
  bg: '#fbf8f6',
  card: '#ffffff',
  primary: '#BA0006',
  accent: '#e07a16',
  success: '#1e7a3a',
  muted: '#666',
  border: '#e5e7eb',
  lightGray: '#f9fafb'
}

const styles = {
  page: { padding: '24px 32px', background: 'transparent', minHeight: '100vh', boxSizing: 'border-box' },
  card: { background: palette.card, padding: 24, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)', boxSizing: 'border-box', border: '1px solid #f0f0f0' },
  sidebar: { background: palette.card, padding: 24, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)', border: '1px solid #f0f0f0' },
  heading: { fontSize: 14, fontWeight: 700, color: '#1f2937', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }
}

// Draggable Modal Component
function DraggableModal({ title, children, onClose, lang, setModalLang }) {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [size, setSize] = useState({ width: 900, height: 500 })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [resizeOffset, setResizeOffset] = useState({ x: 0, y: 0 })
  const modalRef = useRef(null)

  // Center modal on mount
  useEffect(() => {
    const centerX = Math.max(0, (window.innerWidth - 900) / 2)
    const centerY = Math.max(0, (window.innerHeight - 500) / 2)
    setPosition({ x: centerX, y: centerY })
    setSize({ width: 900, height: 500 })
  }, [])

  const handleMouseDown = (e) => {
    if (e.target.closest('[data-no-drag]')) return
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
  }

  const handleMouseMove = useRef((e) => {
    if (!isDragging) return
    setPosition({
      x: Math.max(0, e.clientX - dragOffset.x),
      y: Math.max(0, e.clientY - dragOffset.y)
    })
  })

  const handleMouseUp = useRef(() => {
    setIsDragging(false)
  })

  useEffect(() => {
    handleMouseMove.current = (e) => {
      if (!isDragging) return
      setPosition({
        x: Math.max(0, e.clientX - dragOffset.x),
        y: Math.max(0, e.clientY - dragOffset.y)
      })
    }
  }, [isDragging, dragOffset])

  useEffect(() => {
    if (isDragging) {
      const onMouseMove = (e) => handleMouseMove.current(e)
      const onMouseUp = () => handleMouseUp.current()
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      return () => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }
    }
  }, [isDragging])

  const handleResizeMouseDown = (e) => {
    e.preventDefault()
    setIsResizing(true)
    setResizeOffset({
      x: e.clientX - size.width,
      y: e.clientY - size.height
    })
  }

  const handleResizeMouseMove = useRef((e) => {
    if (!isResizing) return
    const newWidth = Math.max(400, e.clientX - resizeOffset.x)
    const newHeight = Math.max(300, e.clientY - resizeOffset.y)
    setSize({
      width: newWidth,
      height: newHeight
    })
  })

  const handleResizeMouseUp = useRef(() => {
    setIsResizing(false)
  })

  useEffect(() => {
    handleResizeMouseMove.current = (e) => {
      if (!isResizing) return
      const newWidth = Math.max(400, e.clientX - resizeOffset.x)
      const newHeight = Math.max(300, e.clientY - resizeOffset.y)
      setSize({
        width: newWidth,
        height: newHeight
      })
    }
  }, [isResizing, resizeOffset])

  useEffect(() => {
    if (isResizing) {
      const onMouseMove = (e) => handleResizeMouseMove.current(e)
      const onMouseUp = () => handleResizeMouseUp.current()
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      return () => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }
    }
  }, [isResizing])

  return (
    <>
      <div
        ref={modalRef}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          width: size.width,
          height: size.height,
          background: 'white',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          userSelect: isDragging || isResizing ? 'none' : 'auto',
          cursor: isDragging ? 'grabbing' : 'auto'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header - Draggable */}
        <div
          onMouseDown={handleMouseDown}
          style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, #BA0006 0%, #8B0005 100%)',
            color: 'white',
            borderRadius: '12px 12px 0 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none'
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📖</span>
            {title}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Language Toggle */}
            <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.2)', padding: 4, borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)' }}>
              <button 
                onClick={() => setModalLang('en')}
                data-no-drag="true"
                style={{
                  padding: '6px 12px',
                  borderRadius: 4,
                  background: lang === 'en' ? 'white' : 'transparent',
                  color: lang === 'en' ? '#BA0006' : 'white',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={e => {
                  if (lang !== 'en') e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                }}
                onMouseOut={e => {
                  if (lang !== 'en') e.currentTarget.style.background = 'transparent'
                }}
              >
                EN
              </button>
              <button 
                onClick={() => setModalLang('zh')}
                data-no-drag="true"
                style={{
                  padding: '6px 12px',
                  borderRadius: 4,
                  background: lang === 'zh' ? 'white' : 'transparent',
                  color: lang === 'zh' ? '#BA0006' : 'white',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={e => {
                  if (lang !== 'zh') e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                }}
                onMouseOut={e => {
                  if (lang !== 'zh') e.currentTarget.style.background = 'transparent'
                }}
              >
                中文
              </button>
            </div>
            <button
              data-no-drag="true"
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: 'white',
                fontSize: 18,
                width: 32,
                height: 32,
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '20px',
            fontSize: 14,
            lineHeight: 1.7,
            color: '#333',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            background: '#fafbfc'
          }}
        >
          {children}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #e5e7eb',
            textAlign: 'right',
            background: 'white'
          }}
        >
        </div>

        {/* Resize Handle */}
        <div
          onMouseDown={handleResizeMouseDown}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 20,
            height: 20,
            cursor: 'nwse-resize',
            background: 'linear-gradient(135deg, transparent 50%, #BA0006 50%)',
            borderRadius: '0 0 12px 0'
          }}
          title="Drag to resize"
        />
      </div>
    </>
  )
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
  const [editedTitleEN, setEditedTitleEN] = useState('')
  const [editedTitleZH, setEditedTitleZH] = useState('')
  const [editedSummaryEN, setEditedSummaryEN] = useState('')
  const [editedSummaryZH, setEditedSummaryZH] = useState('')
  const [fullContentModalOpen, setFullContentModalOpen] = useState(false)
  const [fullContentModalLang, setFullContentModalLang] = useState('en')
  const [originalValues, setOriginalValues] = useState({})
  const [sourceTab, setSourceTab] = useState('ready')
  const [unsavedChangesModalOpen, setUnsavedChangesModalOpen] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState(null)
  const [heroUrlAtInit, setHeroUrlAtInit] = useState('')
  const initRef = useRef(false)

  useEffect(() => { if (id) load() }, [id])
  useEffect(() => { initRef.current = false }, [id])

  useEffect(() => {
    if (!data || initRef.current) return
    // Initialize edited fields with current values
    const title = getField('title')
    const summary = getField('summary')
    setEditedTitleEN(title.en || '')
    setEditedTitleZH(title.zh || '')
    setEditedSummaryEN(summary.en || '')
    setEditedSummaryZH(summary.zh || '')
    // Store original values for change detection
    const initialHeroUrl = (() => {
      const d = data?.draft || {}
      if (Object.prototype.hasOwnProperty.call(d, 'HeroImageUrl')) {
        return d.HeroImageUrl || ''
      }
      return data?.article?.HeroImageUrl ?? ''
    })()
    setHeroUrlAtInit(initialHeroUrl)
    setOriginalValues({
      titleEN: title.en || '',
      titleZH: title.zh || '',
      summaryEN: summary.en || '',
      summaryZH: summary.zh || '',
      heroImageUrl: initialHeroUrl,
      industryTagId: data?.draft?.IndustryTagId ?? null,
      interestTagIds: Array.isArray(data?.draft?.InterestTagIds)
        ? data?.draft?.InterestTagIds
        : (Array.isArray(data?.draft?.InterestTags) ? data?.draft?.InterestTags.map(t => t.InterestTagId ?? t.id) : [])
    })
    // Detect source tab from localStorage or URL params
    try {
      const stored = JSON.parse(localStorage.getItem('publishQueue.lastState') || 'null')
      if (stored && stored.tab) setSourceTab(stored.tab)
      else setSourceTab('ready')
    } catch (e) { setSourceTab('ready') }
    initRef.current = true
  }, [data])

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
          // If a local draft exists, prefer it to ensure saved edits show up on reopen
          try {
            const rawLocal = JSON.parse(localStorage.getItem('publishQueue') || '[]')
            const entriesLocal = Array.isArray(rawLocal) ? rawLocal : []
            const foundLocal = entriesLocal.find(e => Number(e?.id ?? e) === Number(id))
            console.log(`[PublishArticle DEBUG] Article ${id} - foundLocal:`, foundLocal)
            console.log(`[PublishArticle DEBUG] Article ${id} - pubVal:`, pubVal)
            if (foundLocal && (foundLocal.data || foundLocal)) {
              const entryData = foundLocal.data || foundLocal
              const merged = {
                ...(pubVal || {}),
                ...(entryData || {}),
                article: entryData.article || pubVal.article,
                draft: { ...(pubVal?.draft || {}), ...(entryData?.draft || {}) },
                en: entryData.en || pubVal.en,
                zh: entryData.zh || pubVal.zh
              }
              console.log(`[PublishArticle DEBUG] Article ${id} - merged draft:`, merged.draft)
              console.log(`[PublishArticle DEBUG] Article ${id} - IndustryTagId:`, merged.draft?.IndustryTagId, '- InterestTagIds:', merged.draft?.InterestTagIds)
              // normalize draft taxonomy from available tag lists so UI checks (canPublish)
              try {
                const industriesRaw = industriesRes && industriesRes.status === 'fulfilled' ? (industriesRes.value?.data ?? industriesRes.value) : []
                const interestsRaw = interestsRes && interestsRes.status === 'fulfilled' ? (interestsRes.value?.data ?? interestsRes.value) : []
                const industries = Array.isArray(industriesRaw) ? industriesRaw.map(i => ({ id: i.industryTagId ?? i.IndustryTagId ?? i.industryId ?? i.industryId ?? i.id, IndustryTagId: i.industryTagId ?? i.IndustryTagId ?? i.id, NameEN: i.nameEN ?? i.NameEN ?? i.Name ?? '', NameZH: i.nameZH ?? i.NameZH ?? i.Name ?? '' })) : []
                const interests = Array.isArray(interestsRaw) ? interestsRaw.map(i => ({ id: i.interestTagId ?? i.InterestTagId ?? i.id, InterestTagId: i.interestTagId ?? i.InterestTagId ?? i.id, NameEN: i.nameEN ?? i.NameEN ?? i.Name ?? '', NameZH: i.nameZH ?? i.NameZH ?? i.Name ?? '' })) : []
                const normalized = { ...(merged || {}) }
                const d = normalized.draft || {}
                const iid = d.IndustryTagId ?? d.IndustryTag?.IndustryTagId ?? d.IndustryTag?.id
                if (typeof iid !== 'undefined' && iid !== null && iid !== '') {
                  const num = Number(iid)
                  if (!Number.isNaN(num)) {
                    normalized.draft = { ...(normalized.draft || {}), IndustryTagId: num }
                    const foundInd = industries.find(x => String(x.id) === String(num) || String(x.IndustryTagId) === String(num))
                    if (foundInd) normalized.draft.IndustryTag = foundInd
                  }
                }
                const itIds = Array.isArray(d.InterestTagIds) ? d.InterestTagIds.map(x => Number(x)).filter(x => !Number.isNaN(x)) : (Array.isArray(d.InterestTags) && d.InterestTags.length ? d.InterestTags.map(t => (t.InterestTagId ?? t.id)).map(x => Number(x)).filter(x => !Number.isNaN(x)) : [])
                if (itIds && itIds.length > 0) {
                  const uniq = Array.from(new Set(itIds.map(x => String(x)))).map(x => Number(x))
                  normalized.draft = { ...(normalized.draft || {}), InterestTagIds: uniq }
                  const objs = uniq.map(id => interests.find(x => String(x.id ?? x.InterestTagId) === String(id))).filter(Boolean)
                  if (objs.length > 0) normalized.draft.InterestTags = objs
                }
                setData(normalized)
              } catch (e) {
                setData(merged)
              }
            } else {
              setData(pubVal)
            }
          } catch (e) {
            setData(pubVal)
          }
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

    // Collect English candidates ONLY from draft, article, and dataEn (not dataZh!)
    const collectEn = (keys) => {
      const vals = []
      for (const k of keys) vals.push(d?.[k])
      for (const k of keys) vals.push(a?.[k])
      // only consider English language payloads for English variants
      for (const k of keys) vals.push(dataEn?.[k])
      return vals.map(first).filter(Boolean)
    }

    // Collect Chinese candidates ONLY from draft, article, and dataZh (not dataEn!)
    const collectZh = (keys) => {
      const vals = []
      for (const k of keys) vals.push(d?.[k])
      for (const k of keys) vals.push(a?.[k])
      // only consider Chinese language payloads for Chinese variants
      for (const k of keys) vals.push(dataZh?.[k])
      return vals.map(first).filter(Boolean)
    }

    const enCandidates = collectEn(enKeys)
    const zhCandidates = collectZh(zhKeys)

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
    const d = data?.draft || {}
    if (Object.prototype.hasOwnProperty.call(d, 'HeroImageUrl')) {
      return d.HeroImageUrl || ''
    }
    return data?.article?.HeroImageUrl ?? ''
  }

  const heroUrlForChange = () => {
    const d = data?.draft || {}
    if (Object.prototype.hasOwnProperty.call(d, 'HeroImageUrl')) {
      return d.HeroImageUrl || ''
    }
    return data?.article?.HeroImageUrl ?? ''
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

  const showToast = (msg, type = 'success', duration = 3000, action = null) => {
    setToast({ message: msg, type, action })
    if (duration > 0) setTimeout(() => setToast(null), duration)
  }

  // Detect if changes were made
  const hasChanges = () => {
    if (!originalValues || !data) return false
    // Check if hero image changed explicitly
    const currentHero = heroUrlForChange()
    if (currentHero !== heroUrlAtInit) return true
    
    // Get current values for comparison
    const currentIndustryId = data?.draft?.IndustryTagId ?? null
    const currentInterestIds = Array.isArray(data?.draft?.InterestTagIds) 
      ? [...data?.draft?.InterestTagIds].sort()
      : (Array.isArray(data?.draft?.InterestTags) ? data?.draft?.InterestTags.map(t => t.InterestTagId ?? t.id).sort() : [])
    
    const currentValues = {
      titleEN: editedTitleEN,
      titleZH: editedTitleZH,
      summaryEN: editedSummaryEN,
      summaryZH: editedSummaryZH,
      heroImageUrl: currentHero,
      industryTagId: currentIndustryId,
      interestTagIds: currentInterestIds
    }
    
    // Sort original interest IDs for accurate comparison
    const originalInterestIds = Array.isArray(originalValues.interestTagIds) 
      ? [...originalValues.interestTagIds].sort()
      : []
    
    // Check each field individually for better debugging
    if (originalValues.titleEN !== currentValues.titleEN) return true
    if (originalValues.titleZH !== currentValues.titleZH) return true
    if (originalValues.summaryEN !== currentValues.summaryEN) return true
    if (originalValues.summaryZH !== currentValues.summaryZH) return true
    if (originalValues.heroImageUrl !== currentValues.heroImageUrl) return true
    if (originalValues.industryTagId !== currentValues.industryTagId) return true
    if (JSON.stringify(originalInterestIds) !== JSON.stringify(currentInterestIds)) return true
    
    return false
  }

  // Check if values differ from original
  const detectChanges = () => {
    if (!originalValues) return { hasTitleChanges: false, hasSummaryChanges: false, hasHeroChanges: false, hasTaxonomyChanges: false }
    const titleChanged = originalValues.titleEN !== editedTitleEN || originalValues.titleZH !== editedTitleZH
    const summaryChanged = originalValues.summaryEN !== editedSummaryEN || originalValues.summaryZH !== editedSummaryZH
    const currentHero = heroUrlForChange()
    const heroChanged = originalValues.heroImageUrl !== currentHero
    const industryChanged = originalValues.industryTagId !== (data?.draft?.IndustryTagId ?? null)
    const currentInterestIds = Array.isArray(data?.draft?.InterestTagIds) 
      ? data?.draft?.InterestTagIds
      : (Array.isArray(data?.draft?.InterestTags) ? data?.draft?.InterestTags.map(t => t.InterestTagId ?? t.id) : [])
    const interestChanged = JSON.stringify(originalValues.interestTagIds) !== JSON.stringify(currentInterestIds)
    const taxonomyChanged = industryChanged || interestChanged
    return { hasTitleChanges: titleChanged, hasSummaryChanges: summaryChanged, hasHeroChanges: heroChanged, hasTaxonomyChanges: taxonomyChanged }
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
          if (returned) {
            // Merge returned draft but ensure HeroImageUrl from our generation is preserved
            setData(prev => ({ 
              ...(prev || {}), 
              draft: { 
                ...(prev?.draft || {}), 
                ...returned,
                HeroImageUrl: url,
                HeroImageSource: 'generated'
              } 
            }))
          }
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
    try {
      setLoading(true)
      const currentInterestIds = Array.isArray(data?.draft?.InterestTagIds)
        ? (data?.draft?.InterestTagIds || []).filter(Boolean)
        : ((data?.draft?.InterestTags || []).map(t => t.InterestTagId ?? t.id).filter(Boolean))
      const fallbackInterestIds = (() => {
        if (Array.isArray(originalValues?.interestTagIds) && originalValues.interestTagIds.length > 0) {
          return originalValues.interestTagIds
        }
        try {
          const raw = JSON.parse(localStorage.getItem('publishQueue') || '[]')
          const entries = Array.isArray(raw) ? raw : []
          const found = entries.find(e => Number(e?.id ?? e) === Number(id))
          const draft = found?.data?.draft || found?.draft || null
          if (!draft) return []
          if (Array.isArray(draft?.InterestTagIds) && draft.InterestTagIds.length > 0) return draft.InterestTagIds
          if (Array.isArray(draft?.InterestTags) && draft.InterestTags.length > 0) return draft.InterestTags.map(t => t.InterestTagId ?? t.id).filter(Boolean)
          return []
        } catch (e) { return [] }
      })()
      const normalizedInterestIds = (currentInterestIds && currentInterestIds.length > 0)
        ? currentInterestIds
        : (fallbackInterestIds || [])
      // construct PublishArticleDto expected by backend
      const dto = {
        NewsArticleId: Number(id),
        HeroImageUrl: data?.draft?.HeroImageUrl ?? null,
        HeroImageAlt: data?.draft?.HeroImageAlt ?? null,
        HeroImageSource: data?.draft?.HeroImageSource ?? null,
        // prefer explicit draft fields, then edited article bodies from `dataEn`/`dataZh`, then fallback to extracted `full` preview
        FullContentEN: data?.draft?.FullContentEN ?? data?.draft?.fullContentEN ?? dataEn?.FullContentEN ?? dataEn?.fullContent ?? full.en ?? null,
        FullContentZH: data?.draft?.FullContentZH ?? data?.draft?.fullContentZH ?? dataZh?.FullContentZH ?? dataZh?.fullContent ?? full.zh ?? null,
        // Use edited titles/summaries if provided, otherwise fall back to original
        TitleEN: (editedTitleEN?.trim()) || (data?.draft?.TitleEN ?? dataEn?.titleEN ?? dataEn?.Title ?? dataEn?.title ?? null),
        TitleZH: (editedTitleZH?.trim()) || (data?.draft?.TitleZH ?? dataZh?.titleZH ?? dataZh?.Title ?? dataZh?.title ?? null),
        SummaryEN: (editedSummaryEN?.trim()) || null,
        SummaryZH: (editedSummaryZH?.trim()) || null,
        IndustryTagId: data?.draft?.IndustryTagId ?? data?.draft?.IndustryTag?.IndustryTagId ?? null,
        InterestTagIds: (normalizedInterestIds || []).filter(Boolean),
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
        const clientDraftQ = { ...(data?.draft || {}), FullContentEN: dto.FullContentEN, FullContentZH: dto.FullContentZH, TitleEN: dto.TitleEN, TitleZH: dto.TitleZH, SummaryEN: dto.SummaryEN, SummaryZH: dto.SummaryZH, IndustryTagId: dto.IndustryTagId, InterestTagIds: dto.InterestTagIds }
        // Preserve unpublished flag if this article is from the Unpublished tab
        const dataQObj = { article: articleObjQ, draft: clientDraftQ, en: dataEn || existingQ?.data?.en, zh: dataZh || existingQ?.data?.zh }
        if (sourceTab === 'unpublished' || sourceTab === 'Unpublished' || existingQ?.data?._unpublished) {
          dataQObj._unpublished = true
        }
        const newEntryQ = { id: nid, data: dataQObj }
        const filteredQ = entriesQ.filter(e => Number(e?.id ?? e) !== nid)
        filteredQ.push(newEntryQ)
        localStorage.setItem('publishQueue', JSON.stringify(filteredQ))
      } catch (e) { /* ignore localStorage errors */ }

      const res = await patchPublishDraft(id, dto)
      // apply returned draft fields if any
      try {
        const returned = res?.draft || res
        if (returned) {
          setData(prev => ({ ...(prev || {}), draft: { ...(prev?.draft || {}), ...returned } }))
          // Also update the edited state with returned values to ensure consistency
          if (returned.TitleEN) setEditedTitleEN(returned.TitleEN)
          if (returned.TitleZH) setEditedTitleZH(returned.TitleZH)
          if (returned.SummaryEN) setEditedSummaryEN(returned.SummaryEN)
          if (returned.SummaryZH) setEditedSummaryZH(returned.SummaryZH)
        } else {
          // If server doesn't return draft fields, update with what we sent
          setData(prev => ({ ...(prev || {}), draft: { ...(prev?.draft || {}), TitleEN: dto.TitleEN, TitleZH: dto.TitleZH, SummaryEN: dto.SummaryEN, SummaryZH: dto.SummaryZH, HeroImageUrl: dto.HeroImageUrl, IndustryTagId: dto.IndustryTagId, InterestTagIds: dto.InterestTagIds } }))
          setEditedTitleEN(dto.TitleEN || '')
          setEditedTitleZH(dto.TitleZH || '')
          setEditedSummaryEN(dto.SummaryEN || '')
          setEditedSummaryZH(dto.SummaryZH || '')
        }
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
          const mergedDraft = { ...(prevDraft || {}), ...(returned || {}), TitleEN: dto.TitleEN, TitleZH: dto.TitleZH, SummaryEN: dto.SummaryEN, SummaryZH: dto.SummaryZH, HeroImageUrl: dto.HeroImageUrl, FullContentEN: dto.FullContentEN, FullContentZH: dto.FullContentZH, IndustryTagId: dto.IndustryTagId, InterestTagIds: dto.InterestTagIds }
          if (clientDraft.IndustryTag) mergedDraft.IndustryTag = clientDraft.IndustryTag
          if (clientDraft.InterestTags) mergedDraft.InterestTags = clientDraft.InterestTags
          // Preserve unpublished flag if this article is from the Unpublished tab
          const newDataObj = { article: articleObj, draft: mergedDraft, en: dataEn || existing?.data?.en, zh: dataZh || existing?.data?.zh }
          if (sourceTab === 'unpublished' || sourceTab === 'Unpublished' || existing?.data?._unpublished) {
            newDataObj._unpublished = true
          }
          const newEntry = { id: nid, data: newDataObj }
          const filtered = entries.filter(e => Number(e?.id ?? e) !== nid)
          filtered.push(newEntry)
          localStorage.setItem('publishQueue', JSON.stringify(filtered))
          // Reload data from localStorage to ensure all fields are up to date
          // Preserve tag lists already loaded so unselected tags remain visible
          setData(prev => ({
            ...(prev || {}),
            ...(newEntry.data || {}),
            industries: (prev && prev.industries) ? prev.industries : newEntry.data?.industries,
            interests: (prev && prev.interests) ? prev.interests : newEntry.data?.interests
          }))
        } catch (inner) { /* ignore localStorage errors */ }
      } catch (e) {}
      
      // Detect if any actual changes were made (by comparing DTO with original)
      const titleChanged = originalValues?.titleEN !== (dto.TitleEN || '') || originalValues?.titleZH !== (dto.TitleZH || '')
      const summaryChanged = originalValues?.summaryEN !== (dto.SummaryEN || '') || originalValues?.summaryZH !== (dto.SummaryZH || '')
      const heroChanged = originalValues?.heroImageUrl !== (dto.HeroImageUrl || '')
      const industryChanged = originalValues?.industryTagId !== (dto.IndustryTagId ?? null)
      
      // Check interest tags changed (sort both arrays for accurate comparison)
      const originalInterests = Array.isArray(originalValues?.interestTagIds) 
        ? [...originalValues.interestTagIds].sort() 
        : []
      const currentInterests = Array.isArray(dto.InterestTagIds) 
        ? [...dto.InterestTagIds].sort() 
        : []
      const interestsChanged = JSON.stringify(originalInterests) !== JSON.stringify(currentInterests)
      
      const hasAnyChanges = titleChanged || summaryChanged || heroChanged || industryChanged || interestsChanged
      
      if (sourceTab === 'ready' && hasAnyChanges) {
        // Article moved from Ready to Drafts - show with View button to navigate to Drafts tab
        const changeTypes = []
        if (titleChanged || summaryChanged) changeTypes.push('content')
        if (heroChanged) changeTypes.push('hero image')
        if (industryChanged || interestsChanged) changeTypes.push('classification')
        
        const changeDesc = changeTypes.length > 0 ? ` (${changeTypes.join(', ')})` : ''
        showToast(`Article moved to Drafts${changeDesc}`, 'success', 6000, {
          label: 'View',
          onClick: () => {
            navigate(`/consultant/publish-queue?tab=drafted&highlight=${id}`)
            setToast(null)
          }
        })
      } else if (hasAnyChanges) {
        // Article already in Drafts and was updated
        showToast('Article saved successfully', 'success')
      } else {
        // No actual changes, but save succeeded
        showToast('Article saved', 'success')
      }
      
      // Update original values to current state (use dto values that were just saved)
      const savedTitleEN = dto.TitleEN || ''
      const savedTitleZH = dto.TitleZH || ''
      const savedSummaryEN = dto.SummaryEN || ''
      const savedSummaryZH = dto.SummaryZH || ''
      
      setOriginalValues({
        titleEN: savedTitleEN,
        titleZH: savedTitleZH,
        summaryEN: savedSummaryEN,
        summaryZH: savedSummaryZH,
        heroImageUrl: dto.HeroImageUrl || '',
        industryTagId: dto.IndustryTagId ?? null,
        interestTagIds: Array.isArray(dto.InterestTagIds) ? [...dto.InterestTagIds].sort() : []
      })
      
      // Reset edited state to match saved values (so hasChanges() returns false)
      setEditedTitleEN(savedTitleEN)
      setEditedTitleZH(savedTitleZH)
      setEditedSummaryEN(savedSummaryEN)
      setEditedSummaryZH(savedSummaryZH)
      
      // Reset hero URL tracking to match saved value (fixes issue with hero image generation followed by save)
      setHeroUrlAtInit(dto.HeroImageUrl || '')
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
            TitleEN: (editedTitleEN?.trim()) || (data?.draft?.TitleEN ?? dataEn?.titleEN ?? dataEn?.Title ?? dataEn?.title ?? null),
            TitleZH: (editedTitleZH?.trim()) || (data?.draft?.TitleZH ?? dataZh?.titleZH ?? dataZh?.Title ?? dataZh?.title ?? null),
            SummaryEN: (editedSummaryEN?.trim()) || null,
            SummaryZH: (editedSummaryZH?.trim()) || null,
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
          TitleEN: (editedTitleEN?.trim()) || (data?.draft?.TitleEN ?? dataEn?.titleEN ?? dataEn?.Title ?? dataEn?.title ?? null),
          TitleZH: (editedTitleZH?.trim()) || (data?.draft?.TitleZH ?? dataZh?.titleZH ?? dataZh?.Title ?? dataZh?.title ?? null),
          SummaryEN: (editedSummaryEN?.trim()) || null,
          SummaryZH: (editedSummaryZH?.trim()) || null,
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

          const newDataObj = { article: articleObj, draft: mergedDraft, en: dataEn || existing?.data?.en, zh: dataZh || existing?.data?.zh }
          // Clear _unpublished flag when scheduling/publishing from Unpublished tab
          // Articles being scheduled/published move to those respective tabs
          if (mode === 'schedule' || mode === 'now') {
            newDataObj._unpublished = false
          }
          const newEntry = { id: nid, data: newDataObj }
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
  const hasHero = (() => {
    // If draft has explicit HeroImageUrl property (even if null/deleted), use that; otherwise fall back to article
    if (Object.prototype.hasOwnProperty.call(draft, 'HeroImageUrl')) {
      return Boolean(draft.HeroImageUrl)
    }
    // No explicit draft hero, check article and localStorage fallback
    return Boolean(data?.article?.HeroImageUrl || (_lsEntry && _lsEntry.draft && _lsEntry.draft.HeroImageUrl))
  })()
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
      const normalized = apiBase.replace(/\/$/, '') + (u.startsWith('/') ? u : '/' + u)
      // Add cache-busting timestamp for regenerated images
      return normalized.includes('?') ? normalized : normalized + '?v=' + Date.now()
    } catch (e) {
      return u
    }
  })()

  return (
    <div className="content-full">
      <div className="page-inner">
        <div style={styles.page}>
          {/* Header */}
          <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottom: '2px solid #f0f0f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <h1 style={{ fontSize: 32, margin: 0, fontWeight: 800, color: '#887B87', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 28 }}>📝</span>
                Publish Article
              </h1>
              <span style={{ 
                padding: '4px 12px', 
                borderRadius: 20, 
                background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)', 
                color: '#6b7280', 
                fontSize: 13,
                fontWeight: 600,
                border: '1px solid #d1d5db'
              }}>
                #{id}
              </span>
            </div>
            <button 
              onClick={() => {
                if (hasChanges()) {
                  setUnsavedChangesModalOpen(true)
                  setPendingNavigation(() => () => navigate('/consultant/publish-queue'))
                } else {
                  navigate('/consultant/publish-queue')
                }
              }} 
              style={{ 
                padding: '10px 20px', 
                borderRadius: 8, 
                border: '1px solid #e5e7eb', 
                background: 'white', 
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: '#374151',
                transition: 'all 0.2s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
              onMouseOver={e => {
                e.currentTarget.style.background = '#f9fafb'
                e.currentTarget.style.borderColor = '#d1d5db'
              }}
              onMouseOut={e => {
                e.currentTarget.style.background = 'white'
                e.currentTarget.style.borderColor = '#e5e7eb'
              }}
            >
              ← Back to Queue
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 24, height: 'calc(100vh - 140px)' }}>
            {/* Left Panel - Article Preview */}
            <div style={{ ...styles.card, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0, paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ fontWeight: 800, fontSize: 20, color: '#BA0006', display: 'flex', alignItems: 'center', gap: 8 }}>
                  Article Preview
                </div>
                <div style={{ display: 'flex', gap: 6, background: '#f9fafb', padding: 4, borderRadius: 8, border: '1px solid #e5e7eb' }}>
                  <button 
                    onClick={() => setLang('en')} 
                    style={{ 
                      padding: '6px 16px', 
                      borderRadius: 6, 
                      background: lang === 'en' ? 'linear-gradient(135deg, #BA0006 0%, #8B0005 100%)' : 'transparent', 
                      color: lang === 'en' ? 'white' : '#6b7280', 
                      border: 'none', 
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: lang === 'en' ? '0 2px 4px rgba(186, 0, 6, 0.2)' : 'none'
                    }}
                  >
                    EN
                  </button>
                  <button 
                    onClick={() => setLang('zh')} 
                    style={{ 
                      padding: '6px 16px', 
                      borderRadius: 6, 
                      background: lang === 'zh' ? 'linear-gradient(135deg, #BA0006 0%, #8B0005 100%)' : 'transparent', 
                      color: lang === 'zh' ? 'white' : '#6b7280', 
                      border: 'none', 
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: lang === 'zh' ? '0 2px 4px rgba(186, 0, 6, 0.2)' : 'none'
                    }}
                  >
                    中文
                  </button>
                </div>
              </div>

              {/* Title - Editable */}
              <div style={{ marginBottom: 10, flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Title (Optional Edit)</span>
                  <span style={{ fontSize: 10, color: '#d1d5db', fontWeight: 500 }}>
                    {lang === 'en' ? 'English' : 'Chinese'}
                  </span>
                </div>
                <textarea 
                  value={lang === 'en' ? editedTitleEN : editedTitleZH}
                  onChange={e => lang === 'en' ? setEditedTitleEN(e.target.value) : setEditedTitleZH(e.target.value)}
                  style={{ 
                    padding: '12px 16px', 
                    borderRadius: 8, 
                    border: '1.5px solid #e5e7eb', 
                    background: '#fafbfc', 
                    fontSize: 13, 
                    fontWeight: 600,
                    color: '#111',
                    lineHeight: 1.5,
                    width: '100%',
                    resize: 'none',
                    minHeight: 60,
                    fontFamily: 'inherit',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box',
                    overflow: 'auto',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none'
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = '#BA0006'
                    e.currentTarget.style.background = 'white'
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(186,0,6,0.1)'
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = '#e5e7eb'
                    e.currentTarget.style.background = '#fafbfc'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                  placeholder="Click to edit the title"
                />
              </div>

              {/* Summary - Editable */}
              <div style={{ marginBottom: 12, flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Summary (Optional Edit)</span>
                  <span style={{ fontSize: 10, color: '#d1d5db', fontWeight: 500 }}>
                    {lang === 'en' ? 'English' : 'Chinese'}
                  </span>
                </div>
                <textarea 
                  value={lang === 'en' ? editedSummaryEN : editedSummaryZH}
                  onChange={e => lang === 'en' ? setEditedSummaryEN(e.target.value) : setEditedSummaryZH(e.target.value)}
                  style={{ 
                    padding: '12px 16px', 
                    borderRadius: 8, 
                    border: '1.5px solid #e5e7eb', 
                    background: '#fafbfc', 
                    fontSize: 13, 
                    minHeight: 210,
                    overflow: 'auto',
                    lineHeight: 1.6,
                    color: '#4b5563',
                    width: '100%',
                    resize: 'none',
                    fontFamily: 'inherit',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none'
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = '#BA0006'
                    e.currentTarget.style.background = 'white'
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(186,0,6,0.1)'
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = '#e5e7eb'
                    e.currentTarget.style.background = '#fafbfc'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                  placeholder="Click to edit the summary"
                />
              </div>

              {/* Full Content - Modal Trigger (Minimal) */}
              <div style={{ marginBottom: 0, flexShrink: 0 }}>
                <button 
                  onClick={() => {
                    setFullContentModalOpen(true)
                    setFullContentModalLang(lang === 'en' ? 'en' : 'zh')
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1.5px solid #BA0006',
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #fff5f5 0%, #ffe6e6 100%)',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#BA0006',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #ffe6e6 0%, #ffcccc 100%)'
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(186,0,6,0.2)'
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #fff5f5 0%, #ffe6e6 100%)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <span>👁️</span>
                  View Full Content
                </button>
              </div>

              {/* Full Content Modal */}
              {fullContentModalOpen && (
                <DraggableModal
                  title="Full Article Content"
                  lang={fullContentModalLang}
                  setModalLang={setFullContentModalLang}
                  onClose={() => setFullContentModalOpen(false)}
                >
                  {dataEn && dataZh ? (
                    fullContentModalLang === 'en' ? full.en : full.zh
                  ) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                      <div style={{ fontSize: 14, marginBottom: 8 }}>⚠️ Content unavailable</div>
                      <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                        The full content couldn't be loaded due to a backend error (HTTP/2 protocol error).
                        <br />
                        Please refresh the page and try again.
                      </div>
                    </div>
                  )}
                </DraggableModal>
              )}
            </div>

            {/* Right Panel - Publishing Controls */}
            <div style={{ ...styles.sidebar, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex' }}>
                  Hero Image (Required)
                </div>
                {displayedHeroUrl ? (
                  <div style={{ 
                    background: 'linear-gradient(135deg, #fafbfc 0%, #f3f4f6 100%)', 
                    padding: 12, 
                    borderRadius: 10, 
                    border: '1px solid #e5e7eb'
                  }}>
                    <img 
                      key={displayedHeroUrl}
                      src={displayedHeroUrl} 
                      alt="hero" 
                      style={{ 
                        width: '100%', 
                        height: 160, 
                        objectFit: 'cover', 
                        borderRadius: 8,
                        marginBottom: 12,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        background: '#f3f4f6'
                      }} 
                      onError={(e) => { 
                        console.error('Hero image failed to load:', displayedHeroUrl)
                        e.currentTarget.style.border = '2px dashed #fca5a5'
                        e.currentTarget.style.background = '#fef2f2'
                      }} 
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button 
                        style={{ 
                          flex: 1,
                          padding: '8px 12px', 
                          borderRadius: 8, 
                          background: loading ? '#e5e7eb' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
                          color: loading ? '#9ca3af' : '#fff', 
                          border: 'none', 
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: loading ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          boxShadow: loading ? 'none' : '0 2px 4px rgba(59, 130, 246, 0.3)',
                          transition: 'all 0.2s'
                        }} 
                        onClick={() => {
                          if (!loading) {
                            console.log('Regenerating hero image for article', id)
                            requestGenerateHeroImage()
                          }
                        }} 
                        disabled={loading}
                        onMouseOver={e => {
                          if (!loading) e.currentTarget.style.transform = 'translateY(-1px)'
                        }}
                        onMouseOut={e => {
                          if (!loading) e.currentTarget.style.transform = 'translateY(0)'
                        }}
                      >
                        {loading ? (
                          <>
                            <span style={{ 
                              display: 'inline-block', 
                              width: 12, 
                              height: 12, 
                              border: '2px solid #d1d5db', 
                              borderTopColor: '#9ca3af', 
                              borderRadius: '50%', 
                              animation: 'spin 1s linear infinite' 
                            }} />
                            Generating...
                          </>
                        ) : (
                          <>
                            <span>✨</span>
                            Regenerate
                          </>
                        )}
                      </button>
                      <button 
                        style={{ 
                          padding: '8px 12px', 
                          borderRadius: 8, 
                          background: (sourceTab === 'unpublished' || sourceTab === 'Unpublished') ? '#e5e7eb' : 'white', 
                          color: (sourceTab === 'unpublished' || sourceTab === 'Unpublished') ? '#9ca3af' : '#ef4444', 
                          border: '1px solid ' + ((sourceTab === 'unpublished' || sourceTab === 'Unpublished') ? '#d1d5db' : '#fee2e2'), 
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: (sourceTab === 'unpublished' || sourceTab === 'Unpublished') ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s',
                          opacity: (sourceTab === 'unpublished' || sourceTab === 'Unpublished') ? 0.5 : 1
                        }} 
                        disabled={sourceTab === 'unpublished' || sourceTab === 'Unpublished'}
                        title={(sourceTab === 'unpublished' || sourceTab === 'Unpublished') ? 'Cannot delete hero image for unpublished articles. Use Regenerate instead.' : 'Remove hero image'}
                        onClick={() => { 
                          if (window.confirm('Remove hero image?')) {
                            const d = { ...(data?.draft || {}) }
                            d.HeroImageUrl = null
                            d.HeroImageSource = null
                            setData({ ...(data || {}), draft: d })
                            showToast('Removed')
                          }
                        }}
                        onMouseOver={e => {
                          e.currentTarget.style.background = '#fef2f2'
                          e.currentTarget.style.borderColor = '#fecaca'
                        }}
                        onMouseOut={e => {
                          e.currentTarget.style.background = 'white'
                          e.currentTarget.style.borderColor = '#fee2e2'
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ 
                    padding: 20, 
                    border: '2px dashed #d1d5db', 
                    borderRadius: 10, 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    justifyContent: 'center',
                    gap: 12,
                    background: '#fafbfc'
                  }}>
                    <div style={{ fontSize: 40, opacity: 0.3 }}>🖼️</div>
                    <span style={{ color: '#9ca3af', fontSize: 12, fontWeight: 500 }}>
                      {loading ? 'Generating image...' : 'No hero image yet'}
                    </span>
                    <button 
                      style={{ 
                        padding: '8px 16px', 
                        borderRadius: 8, 
                        background: loading ? '#e5e7eb' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
                        color: loading ? '#9ca3af' : '#fff', 
                        border: 'none', 
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: loading ? 'none' : '0 2px 4px rgba(59, 130, 246, 0.3)',
                        transition: 'all 0.2s'
                      }} 
                      onClick={() => {
                        if (!loading) {
                          console.log('Generating hero image for article', id)
                          requestGenerateHeroImage()
                        }
                      }} 
                      disabled={loading}
                      onMouseOver={e => {
                        if (!loading) e.currentTarget.style.transform = 'translateY(-1px)'
                      }}
                      onMouseOut={e => {
                        if (!loading) e.currentTarget.style.transform = 'translateY(0)'
                      }}
                    >
                      {loading ? (
                        <>
                          <span style={{ 
                            display: 'inline-block', 
                            width: 12, 
                            height: 12, 
                            border: '2px solid #d1d5db', 
                            borderTopColor: '#9ca3af', 
                            borderRadius: '50%', 
                            animation: 'spin 1s linear infinite' 
                          }} />
                          Generating...
                        </>
                      ) : (
                        <>
                          <span>✨</span>
                          Generate Image
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex' }}>
                  Industry Tag (Required)
                </div>
                {(() => {
                  const industries = data?.industries || data?.IndustryTags || data?.industryTags || data?.industriesList || []
                  const current = data?.draft?.IndustryTagId ?? data?.draft?.IndustryTag?.IndustryTagId ?? data?.draft?.IndustryTag?.id ?? ''
                  if (industries && industries.length > 0) {
                    return (
                      <select 
                        value={String(current)} 
                        onChange={e => { 
                          const val = e.target.value; 
                          const picked = industries.find(x => String(x.id) === val || String(x.IndustryTagId ?? x.id) === val); 
                          setData(prev => ({ 
                            ...(prev || {}), 
                            draft: { 
                              ...(prev?.draft || {}), 
                              IndustryTag: picked || null, 
                              IndustryTagId: picked ? (picked.IndustryTagId ?? picked.id) : null 
                            } 
                          })) 
                        }} 
                        style={{ 
                          padding: '10px 12px', 
                          borderRadius: 8, 
                          border: '1px solid #e5e7eb', 
                          width: '100%', 
                          fontSize: 13,
                          fontWeight: 500,
                          color: '#374151',
                          background: 'white',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <option value=''>Select Industry...</option>
                        {industries.map((it, i) => (
                          <option key={i} value={String(it.id ?? it.IndustryTagId)}>
                            {getDisplayName(it) || String(it.id ?? it.IndustryTagId)}
                          </option>
                        ))}
                      </select>
                    )
                  }
                  const fallbackId = data?.draft?.IndustryTagId ?? data?.draft?.IndustryTag?.IndustryTagId ?? data?.draft?.IndustryTag?.id
                  const attachedList = data?.industries || []
                  if (fallbackId || fallbackId === 0) { 
                    const found = attachedList.find(x => String(x.id ?? x.IndustryTagId ?? x.industryTagId) === String(fallbackId)); 
                    const name = found ? (found.NameEN || found.NameZH || found.Name || found.name || String(fallbackId)) : (getDisplayName(data?.draft?.IndustryTag) || String(fallbackId)); 
                    return (
                      <div style={{ 
                        padding: '10px 12px', 
                        borderRadius: 8, 
                        border: '1px solid #e5e7eb', 
                        fontSize: 13,
                        fontWeight: 500,
                        color: '#374151',
                        background: 'linear-gradient(135deg, #fef3f2 0%, #fee2e2 100%)',
                        border: '1px solid #fca5a5'
                      }}>
                        {name}
                      </div>
                    )
                  }
                  return (
                    <div style={{ 
                      padding: '10px 12px', 
                      borderRadius: 8, 
                      border: '1px solid #e5e7eb', 
                      fontSize: 13, 
                      color: '#9ca3af',
                      background: '#fafbfc'
                    }}>
                      {getDisplayName(data?.draft?.IndustryTag) || 'Not assigned'}
                    </div>
                  )
                })()}
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex' }}>
                  Topics Of Interest (Required)
                </div>
                {(() => {
                  const interests = data?.interests || data?.InterestTags || data?.interestTags || []
                  const draft = data?.draft || {}
                  const draftInterestIds = Array.isArray(draft?.InterestTagIds) ? draft.InterestTagIds.map(x => String(x)) : (Array.isArray(draft?.InterestTags) ? draft.InterestTags.map(t => String(t.InterestTagId ?? t.id)) : [])
                  if (interests && interests.length > 0) {
                    return (
                      <div style={{ 
                        display: 'flex', 
                        gap: 8, 
                        flexWrap: 'wrap', 
                        maxHeight: 140, 
                        overflow: 'auto',
                        padding: '8px',
                        background: '#fafbfc',
                        borderRadius: 8,
                        border: '1px solid #e5e7eb'
                      }}>
                        {interests.map((it, idx) => {
                          const idVal = it.interestTagId ?? it.InterestTagId ?? it.id
                          const idStr = String(idVal)
                          const checked = draftInterestIds.includes(idStr)
                          return (
                            <label 
                              key={idx} 
                              style={{ 
                                display: 'flex', 
                                gap: 6, 
                                alignItems: 'center', 
                                padding: '8px 12px', 
                                borderRadius: 20, 
                                background: checked ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)' : 'white', 
                                border: checked ? '1.5px solid #fca5a5' : '1px solid #e5e7eb', 
                                cursor: 'pointer', 
                                fontSize: 12,
                                fontWeight: 500,
                                transition: 'all 0.2s',
                                boxShadow: checked ? '0 2px 4px rgba(252, 165, 165, 0.2)' : 'none'
                              }}
                              onMouseOver={e => {
                                if (!checked) {
                                  e.currentTarget.style.background = '#f9fafb'
                                  e.currentTarget.style.borderColor = '#d1d5db'
                                }
                              }}
                              onMouseOut={e => {
                                if (!checked) {
                                  e.currentTarget.style.background = 'white'
                                  e.currentTarget.style.borderColor = '#e5e7eb'
                                }
                              }}
                            >
                              <input 
                                type="checkbox" 
                                checked={checked} 
                                style={{ width: 14, height: 14, cursor: 'pointer' }} 
                                onChange={e => { 
                                  const curIds = Array.isArray(draft?.InterestTagIds) ? (draft.InterestTagIds || []).slice() : (Array.isArray(draft?.InterestTags) ? (draft.InterestTags || []).map(t => (t.InterestTagId ?? t.id)) : []); 
                                  const sid = idVal; 
                                  if (e.target.checked) { 
                                    curIds.push(sid) 
                                  } else { 
                                    const i = curIds.findIndex(x => String(x) === idStr); 
                                    if (i >= 0) curIds.splice(i, 1) 
                                  }; 
                                  const normalizedIds = Array.from(new Set(curIds.map(x => String(x)))).map(x => Number(x)).filter(x => !Number.isNaN(x)); 
                                  const curObjs = normalizedIds.map(id => interests.find(x => String(x.id ?? x.InterestTagId ?? x.interestTagId) === String(id))).filter(Boolean); 
                                  setData(prev => ({ ...(prev || {}), draft: { ...(prev?.draft || {}), InterestTagIds: normalizedIds, InterestTags: curObjs } })) 
                                }} 
                              />
                              <span style={{ color: checked ? '#b91c1c' : '#6b7280' }}>
                                {getDisplayName(it) || idStr}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    )
                  }
                  const fallbackNames = []; 
                  if (Array.isArray(draft?.InterestTags) && draft.InterestTags.length > 0) { 
                    for (const t of draft.InterestTags) fallbackNames.push(t.NameEN ?? t.NameZH ?? t.Name ?? t.name ?? String(t.InterestTagId ?? t.id)) 
                  } else if (Array.isArray(draft?.InterestTagIds) && draft.InterestTagIds.length > 0) { 
                    const list = data?.interests || []; 
                    for (const id of draft.InterestTagIds) { 
                      const found = list.find(x => String(x.id ?? x.InterestTagId ?? x.interestTagId) === String(id)); 
                      fallbackNames.push(found ? (found.NameEN || found.NameZH || found.Name || found.name || String(id)) : String(id)) 
                    } 
                  }
                  return (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '12px', background: '#fafbfc', borderRadius: 8, border: '1px solid #e5e7eb', minHeight: 50 }}>
                      {fallbackNames.length > 0 ? fallbackNames.map((n, i) => (
                        <span 
                          key={i} 
                          style={{ 
                            padding: '6px 12px', 
                            borderRadius: 20, 
                            background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)', 
                            fontSize: 12, 
                            color: '#b91c1c',
                            fontWeight: 500,
                            border: '1px solid #fca5a5'
                          }}
                        >
                          {n}
                        </span>
                      )) : (
                        <span style={{ color: '#9ca3af', fontSize: 12, fontStyle: 'italic' }}>
                          No topics selected
                        </span>
                      )}
                    </div>
                  )
                })()}
              </div>

              {/* Publish readiness indicator */}
              <div style={{ 
                marginBottom: 20,
                padding: '12px 16px',
                borderRadius: 10,
                background: canPublish ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)' : 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                border: canPublish ? '1px solid #86efac' : '1px solid #fbbf24'
              }}>
                <div style={{ 
                  fontSize: 12, 
                  fontWeight: 600, 
                  color: canPublish ? '#166534' : '#92400e',
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <span style={{ fontSize: 16 }}>{canPublish ? '✅' : '⚠️'}</span>
                  {canPublish ? 'Ready to Publish' : 'Requirements Not Met'}
                </div>
                <div style={{ fontSize: 11, color: canPublish ? '#15803d' : '#78350f', lineHeight: 1.5 }}>
                  {canPublish 
                    ? 'All requirements satisfied. You can now publish or schedule this article.'
                    : 'Please ensure: Hero image, Industry tag, and at least one Topic are assigned.'
                  }
                </div>
              </div>

              <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: '2px solid #f0f0f0' }}>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex' }}>
                  Publishing Actions
                </div>
                
                {/* Save as Draft */}
                <button 
                  onClick={saveDraft} 
                  style={{ 
                    width: '100%', 
                    background: 'white', 
                    color: '#374151', 
                    border: '1.5px solid #e5e7eb', 
                    padding: '12px 16px', 
                    borderRadius: 10, 
                    fontSize: 13, 
                    fontWeight: 600, 
                    marginBottom: 12, 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: 8,
                    transition: 'all 0.2s',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.background = '#f9fafb'
                    e.currentTarget.style.borderColor = '#d1d5db'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.background = 'white'
                    e.currentTarget.style.borderColor = '#e5e7eb'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  <span style={{ fontSize: 16 }}>💾</span> 
                  Save
                </button>

                {/* Schedule */}
                <div style={{ 
                  background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', 
                  border: '1.5px solid #fcd34d', 
                  borderRadius: 10, 
                  padding: 16, 
                  marginBottom: 12 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#78350f' }}>Choose a date & time</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input 
                      type="datetime-local" 
                      value={scheduledAt} 
                      onChange={e => setScheduledAt(e.target.value)} 
                      style={{ 
                        flex: 1, 
                        padding: '10px 12px', 
                        borderRadius: 8, 
                        border: '1px solid #d97706', 
                        fontSize: 12,
                        fontWeight: 500,
                        color: '#92400e',
                        background: 'white'
                      }} 
                    />
                  </div>
                  <button 
                    onClick={() => handlePublish('schedule')} 
                    disabled={!scheduledAt || !canPublish}
                    title={!canPublish ? 'Assign Hero, Industry, and at least one Topic before scheduling/publishing' : undefined}
                    style={{ 
                      width: '100%',
                      padding: '10px 16px', 
                      borderRadius: 8, 
                      background: (scheduledAt && canPublish) ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : '#e5e7eb', 
                      color: (scheduledAt && canPublish) ? 'white' : '#9ca3af', 
                      border: 'none', 
                      fontSize: 13, 
                      fontWeight: 700, 
                      cursor: (scheduledAt && canPublish) ? 'pointer' : 'not-allowed',
                      transition: 'all 0.2s',
                      boxShadow: (scheduledAt && canPublish) ? '0 2px 4px rgba(245, 158, 11, 0.3)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8
                    }}
                    onMouseOver={e => {
                      if (scheduledAt && canPublish) {
                        e.currentTarget.style.transform = 'translateY(-1px)'
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(245, 158, 11, 0.4)'
                      }
                    }}
                    onMouseOut={e => {
                      if (scheduledAt && canPublish) {
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(245, 158, 11, 0.3)'
                      }
                    }}
                  >
                    <span>📆</span>
                    {(sourceTab === 'unpublished' || sourceTab === 'Unpublished') || (data?.draft?.ScheduledAt || data?.draft?.scheduledAt) ? 'Re-schedule' : 'Schedule Article'}
                  </button>
                </div>

                {/* Publish Now */}
                <button 
                  onClick={() => handlePublish('now')} 
                  disabled={!canPublish}
                  title={!canPublish ? 'Assign Hero, Industry, and at least one Topic before publishing' : undefined}
                  style={{ 
                    width: '100%', 
                    background: canPublish ? 'linear-gradient(135deg, #BA0006 0%, #8B0005 100%)' : '#e5e7eb', 
                    color: canPublish ? 'white' : '#9ca3af', 
                    border: 'none', 
                    padding: '14px 20px', 
                    borderRadius: 10, 
                    fontSize: 14, 
                    fontWeight: 700, 
                    cursor: canPublish ? 'pointer' : 'not-allowed', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: 10, 
                    boxShadow: canPublish ? '0 4px 12px rgba(186, 0, 6, 0.3)' : 'none',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={e => {
                    if (canPublish) {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(186, 0, 6, 0.4)'
                    }
                  }}
                  onMouseOut={e => {
                    if (canPublish) {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(186, 0, 6, 0.3)'
                    }
                  }}
                >
                  <span style={{ fontSize: 18 }}>🚀</span> 
                  Publish Now
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Unsaved Changes Modal */}
      {unsavedChangesModalOpen && (
        <>
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.3)',
              zIndex: 1001,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={() => setUnsavedChangesModalOpen(false)}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'white',
              borderRadius: 12,
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              zIndex: 1002,
              padding: 24,
              maxWidth: 400,
              width: '90%'
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1f2937', marginBottom: 12 }}>
              Unsaved Changes
            </div>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 24, lineHeight: 1.6 }}>
              You have unsaved changes. Do you want to save them before leaving?
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => {
                  setUnsavedChangesModalOpen(false)
                  setPendingNavigation(null)
                }}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: '1.5px solid #e5e7eb',
                  background: 'white',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: '#374151',
                  transition: 'all 0.2s'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = '#f9fafb'
                  e.currentTarget.style.borderColor = '#d1d5db'
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = 'white'
                  e.currentTarget.style.borderColor = '#e5e7eb'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setUnsavedChangesModalOpen(false)
                  if (pendingNavigation) pendingNavigation()
                  setPendingNavigation(null)
                }}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: '1.5px solid #d1d5db',
                  background: 'white',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: '#6b7280',
                  transition: 'all 0.2s'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = '#f3f4f6'
                  e.currentTarget.style.borderColor = '#9ca3af'
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = 'white'
                  e.currentTarget.style.borderColor = '#d1d5db'
                }}
              >
                Don't Save
              </button>
              <button
                onClick={() => {
                  setUnsavedChangesModalOpen(false)
                  saveDraft().then(() => {
                    if (pendingNavigation) pendingNavigation()
                    setPendingNavigation(null)
                  }).catch(e => {
                    setUnsavedChangesModalOpen(true)
                  })
                }}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#BA0006',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: 'white',
                  transition: 'all 0.2s'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = '#8B0005'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(186,0,6,0.3)'
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = '#BA0006'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                Save
              </button>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: toast.type === 'success' 
              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
              : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: 'white',
            padding: '16px 24px',
            borderRadius: 12,
            boxShadow: toast.type === 'success'
              ? '0 8px 24px rgba(16, 185, 129, 0.35), 0 2px 8px rgba(0,0,0,0.1)'
              : '0 8px 24px rgba(239, 68, 68, 0.35), 0 2px 8px rgba(0,0,0,0.1)',
            fontSize: 14,
            fontWeight: 500,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            minWidth: 320,
            backdropFilter: 'blur(10px)',
            animation: 'slideInFromRight 0.3s ease-out'
          }}
        >
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12,
            flex: 1
          }}>
            <span style={{ fontSize: 20 }}>
              {toast.type === 'success' ? '✅' : '⚠️'}
            </span>
            <span>{toast.message}</span>
          </div>
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              style={{
                background: 'rgba(255,255,255,0.95)',
                border: 'none',
                color: toast.type === 'success' ? '#059669' : '#dc2626',
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                whiteSpace: 'nowrap'
              }}
              onMouseOver={e => {
                e.currentTarget.style.background = 'white'
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'
              }}
              onMouseOut={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.95)'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>  )
}