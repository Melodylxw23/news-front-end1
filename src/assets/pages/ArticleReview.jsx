import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_BASE || ''

const fetchArticle = async (id, lang = null) => {
  const token = localStorage.getItem('token')
  const headers = Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: `Bearer ${token}` } : {})
  const url = `${API_BASE}/api/articles/${id}${lang ? `?lang=${encodeURIComponent(lang)}` : ''}`
  const res = await fetch(url, { headers })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(txt || res.statusText)
  }
  return res.json()
}

export default function ArticleReview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const [dataEn, setDataEn] = useState(null)
  const [dataZh, setDataZh] = useState(null)
  const [translatedTitleEn, setTranslatedTitleEn] = useState('')
  const [translatingTitle, setTranslatingTitle] = useState(false)
  const [prevAvailable, setPrevAvailable] = useState(false)
  const [nextAvailable, setNextAvailable] = useState(false)
  const [checkingNeighbors, setCheckingNeighbors] = useState(false)
  const [prevId, setPrevId] = useState(null)
  const [nextId, setNextId] = useState(null)
  

  useEffect(() => {
    (async () => {
      if (!id) return
      // reset translation state when switching articles
      setTranslatedTitleEn('')
      setTranslatingTitle(false)
      setLoading(true)
      setError(null)
      try {
        // Fetch baseline payload plus language-specific variants in parallel
        const [base, en, zh] = await Promise.allSettled([
          fetchArticle(id),
          fetchArticle(id, 'en'),
          fetchArticle(id, 'zh')
        ])

        if (base.status === 'fulfilled') setData(base.value)
        if (en.status === 'fulfilled') setDataEn(en.value)
        if (zh.status === 'fulfilled') setDataZh(zh.value)

        // If none succeeded, throw the first rejection
        if (base.status !== 'fulfilled' && en.status !== 'fulfilled' && zh.status !== 'fulfilled') {
          const firstErr = base.reason || en.reason || zh.reason || 'Failed to load'
          throw firstErr
        }
      } catch (e) {
        setError(e.message || String(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  // check whether previous/next article ids exist (assumes numeric sequential ids)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      setCheckingNeighbors(true)
      try {
        const idNum = parseInt(id, 10)
        if (Number.isNaN(idNum)) {
          if (mounted) {
            setPrevAvailable(false)
            setNextAvailable(false)
          }
          return
        }
        const token = localStorage.getItem('token')
        const headers = Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: `Bearer ${token}` } : {})
        // prefer list-first approach to compute true neighbors (works with non-sequential ids)
        try {
          const tryFetchList = async () => {
            const normalize = (j) => {
              if (!j) return []
              if (Array.isArray(j)) return j
              if (Array.isArray(j.items)) return j.items
              if (Array.isArray(j.data)) return j.data
              return []
            }

            // try common "get all" params first
            const attempts = [
              '/api/articles?size=1000',
              '/api/articles?limit=1000',
              '/api/articles?per_page=1000',
              '/api/articles'
            ]
            for (const url of attempts) {
              try {
                const r = await fetch(url, { headers }).catch(() => null)
                if (!r || !r.ok) continue
                const j = await r.json()
                const items = normalize(j)
                if (items.length > 0) return items
              } catch (e) {
                // ignore and continue
              }
            }

            // fallback to paged fetch (safe cap to avoid infinite loops)
            const pageSizeCandidates = [50, 100]
            for (const pageSize of pageSizeCandidates) {
              let page = 1
              const maxPages = 20
              const all = []
              for (; page <= maxPages; page++) {
                const pUrl = `/api/articles?page=${page}&size=${pageSize}`
                try {
                  const pr = await fetch(pUrl, { headers }).catch(() => null)
                  if (!pr || !pr.ok) break
                  const pj = await pr.json()
                  const items = normalize(pj)
                  if (items.length === 0) break
                  all.push(...items)
                  // if we already have many items, stop early
                  if (all.length >= 2000) break
                } catch (e) {
                  break
                }
              }
              if (all.length > 0) return all
            }
            return []
          }

          const items = await tryFetchList()
          if (items && items.length > 0) {
            const getId = (it) => (it?.id ?? it?.article?.id ?? it?.Article?.id ?? it?._id ?? it)
            const ids = items.map(getId).map(String)
            const idx = ids.indexOf(String(id))
            if (idx >= 0) {
              const p = ids[idx - 1]
              const n = ids[idx + 1]
              if (mounted) {
                if (p) {
                  setPrevAvailable(true)
                  setPrevId(String(p))
                }
                if (n) {
                  setNextAvailable(true)
                  setNextId(String(n))
                }
              }
              if (mounted) setCheckingNeighbors(false)
              return
            }
          }
        } catch (e) {
          // list fetch failed; fall back to numeric neighbor probes
        }

        // fall back: probe numeric neighbors (works for sequential numeric ids)
        try {
          const base = API_BASE || ''
          const prevUrl = `${base}/api/articles/${idNum - 1}`
          const nextUrl = `${base}/api/articles/${idNum + 1}`
          const [pRes, nRes] = await Promise.all([
            fetch(prevUrl, { method: 'GET', headers }).catch(() => ({ ok: false })),
            fetch(nextUrl, { method: 'GET', headers }).catch(() => ({ ok: false }))
          ])
          if (!mounted) return
          const pOk = !!(pRes && pRes.ok)
          const nOk = !!(nRes && nRes.ok)
          setPrevAvailable(pOk)
          setNextAvailable(nOk)
          setPrevId(pOk ? String(idNum - 1) : null)
          setNextId(nOk ? String(idNum + 1) : null)
        } catch (e) {
          // ignore
        }
      } catch (e) {
        if (mounted) {
          setPrevAvailable(false)
          setNextAvailable(false)
        }
      } finally {
        if (mounted) setCheckingNeighbors(false)
      }
    })()
    return () => { mounted = false }
  }, [id])

  

  // response shapes: base `data` may include Article dto plus OriginalContent/TranslatedContent
  // prefer language-specific Article DTOs (en/zh) if present, then base `data`.
  const enPayload = dataEn || data
  const zhPayload = dataZh || data
  // payloads sometimes use lowercase `article` and top-level camelCase fields
  const articleEn = (enPayload?.article || enPayload?.Article) || {}
  const articleZh = (zhPayload?.article || zhPayload?.Article) || {}
  // fallback generic article (base payload)
  const article = (data?.article || data?.Article) || {}

  // root-level originals/translations from any payload (prefer base for original/translated)
  const original = data?.originalContent ?? data?.OriginalContent ?? data?.Original ?? enPayload?.originalContent ?? enPayload?.OriginalContent ?? enPayload?.Original ?? ''
  const translated = data?.translatedContent ?? data?.TranslatedContent ?? data?.Translated ?? zhPayload?.translatedContent ?? zhPayload?.TranslatedContent ?? zhPayload?.Translated ?? ''

  // Full content fallbacks: prefer Article.FullContent fields, then payload-level Translated/Original
  const fullEN = (
    // prefer explicit `fullContentEN` fields on article or payloads
    article?.fullContentEN ?? article?.fullContentEn ??
    enPayload?.article?.fullContentEN ?? enPayload?.article?.fullContentEn ??
    enPayload?.Article?.FullContentEN ?? enPayload?.Article?.fullContentEN ??
    enPayload?.fullContentEN ?? enPayload?.fullContentEn ?? enPayload?.fullContent ??
      enPayload?.FullContentEN ?? 
    enPayload?.TranslatedContent ?? enPayload?.translatedContent ?? enPayload?.OriginalContent ?? enPayload?.originalContent ??
    data?.FullContentEN ?? data?.fullContentEN ?? data?.fullContentEn ?? data?.fullContent ?? ''
  )
  const fullZH = (
    // prefer explicit `fullContentZH` fields on article or payloads
    article?.fullContentZH ?? article?.fullContentZh ??
    zhPayload?.article?.fullContentZH ?? zhPayload?.article?.fullContentZh ??
    zhPayload?.Article?.FullContentZH ?? zhPayload?.Article?.fullContentZH ??
    zhPayload?.fullContentZH ?? zhPayload?.fullContentZh ?? zhPayload?.fullContent ??
      zhPayload?.FullContentZH ?? 
    zhPayload?.OriginalContent ?? zhPayload?.originalContent ?? zhPayload?.TranslatedContent ?? zhPayload?.translatedContent ??
    data?.FullContentZH ?? data?.fullContentZH ?? data?.fullContentZh ?? data?.fullContent ?? ''
  )
  const summaryEN = (
    // prefer explicit `summaryEN` fields
    article?.summaryEN ?? article?.summaryEn ??
    enPayload?.article?.summaryEN ?? enPayload?.article?.summaryEn ??
    enPayload?.Article?.SummaryEN ?? enPayload?.Article?.summaryEN ??
    enPayload?.summaryEN ?? enPayload?.summaryEn ?? enPayload?.SummaryEN ?? enPayload?.Summary ??
      enPayload?.Summary ?? 
    data?.SummaryEN ?? data?.summaryEN ?? data?.summaryEn ?? data?.summary ?? ''
  )
  const summaryZH = (
    // prefer explicit `summaryZH` fields
    article?.summaryZH ?? article?.summaryZh ??
    zhPayload?.article?.summaryZH ?? zhPayload?.article?.summaryZh ??
    zhPayload?.Article?.SummaryZH ?? zhPayload?.Article?.summaryZH ??
    zhPayload?.summaryZH ?? zhPayload?.summaryZh ?? zhPayload?.SummaryZH ?? zhPayload?.Summary ??
      zhPayload?.Summary ?? 
    data?.SummaryZH ?? data?.summaryZH ?? data?.summaryZh ?? data?.summary ?? ''
  )

  // utility: safely stringify objects for debug and guard non-string content
  const safeStringify = (obj) => {
    try {
      return JSON.stringify(obj, null, 2)
    } catch (e) {
      try {
        return String(obj)
      } catch (e2) {
        return ''
      }
    }
  }

  const asText = (val) => {
    if (val == null) return ''
    return typeof val === 'string' ? val : safeStringify(val)
  }

  const containsCJK = (s) => typeof s === 'string' && /[\u4E00-\u9FFF]/.test(s)
  const isMostlyAscii = (s) => {
    if (!s || typeof s !== 'string') return false
    const onlyAscii = s.replace(/\s/g, '')
    return /^[\x00-\x7F]*$/.test(onlyAscii)
  }

  const sanitize = (s) => {
    if (!s || typeof s !== 'string') return s
    let t = s
    // decode double-escaped HTML entities early
    try {
      t = decodeEntities(t)
    } catch (e) {
      // ignore
    }
    // remove HTML entity sequences like &emsp;&emsp; and single &emsp;
    t = t.replace(/&emsp;+/g, ' ')
    // replace non-breaking spaces
    t = t.replace(/\u00A0/g, ' ')
    // remove repeated > encodings
    t = t.replace(/&gt;/g, '>')
    // convert common HTML list and block tags into plaintext so bullets stay visible
    t = t.replace(/<li[^>]*>/gi, '\n- ')
    t = t.replace(/<\/li>/gi, '')
    t = t.replace(/<ul[^>]*>/gi, '\n')
    t = t.replace(/<\/ul>/gi, '\n')
    t = t.replace(/<ol[^>]*>/gi, '\n')
    t = t.replace(/<\/ol>/gi, '\n')
    t = t.replace(/<br\s*\/?>/gi, '\n')
    t = t.replace(/<p[^>]*>/gi, '\n')
    t = t.replace(/<\/p>/gi, '\n')
    // remove any remaining HTML tags (keep inner text)
    t = t.replace(/<[^>]+>/g, '')
    // remove common header/footer lines
    const lines = t.split('\n')
      const cleaned = []
      for (let line of lines) {
        const l = line.trim()
        if (!l) continue
        // header/footer patterns to drop (only drop generic English strings when they don't contain CJK)
        if (/^(Xinhua News|Source:|Source:\s*Xinhua News Agency|Font:|Small Medium Large|Share:|Share to:|Share to|Share:|Read next:|Read the next article:|\[Correction\])/i.test(l) && !containsCJK(l)) continue
        if (/^(来源：|来源:|来源：新华社|来源: 新华社|阅读下一篇|【纠错】)/i.test(l)) continue
        // drop editorial credits lines
        if (/^Chief Editors?:/i.test(l)) continue
        if (/^Contributors?:/i.test(l)) continue
        // Chinese editorial credit patterns
        if (/^(主编|责任编辑|责编|责任编辑：|责任编辑:)/i.test(l)) continue
        if (/^(供稿|撰稿|作者|来源：新华社|来源： 新华社)/i.test(l)) continue
        // drop lines that are just timestamps like 2026-01-18 16:01:21
        if (/^\d{4}-\d{2}-\d{2}/.test(l)) continue
        // drop lines that are site breadcrumbs like 'Xinhua News >> Text' or Chinese '新华网 > > 正文'
        if (/>>/.test(l) && /Xinhua/i.test(l)) continue
        if (/^\s*新华网\b/.test(l)) continue
        if (/正文/.test(l) && /新华网/.test(l)) continue
        // drop lines that are title headers like 'Where will the Middle East go in 2026? - Xinhua News'
        if (/^-?\s*Where will the Middle East go in 2026\?/i.test(l)) continue
        // alternate English phrasing to drop
        if (/^-?\s*Where will the Middle East be heading in 2026\?/i.test(l)) continue
        // drop reporter bylines like 'Xinhua News Agency reporter Shadahti'
        if (/^Xinhua News Agency reporter/i.test(l)) continue
        if (/-\s*Xinhua News$/i.test(l)) continue
        // drop lines with trailing '-新华网' (common duplicated title)
        if (/-\s*新华网$/i.test(l)) continue
        // drop Chinese UI/title fragments like '字体：' or '字号：' and share controls
        if (/^(字体:|字体：|字号:|字号：)/i.test(l) && !containsCJK(l)) continue
        if (/^(小 中 大|小 中 大 分享到|分享|分享到|分享到：)/i.test(l) && !containsCJK(l)) continue
        // drop standalone 'Font:' or similar UI strings
        if (/^Font:/i.test(l)) continue
        // drop English site/breadcrumb/source lines like 'Xinhua Net' or 'Source: Xinhua Net' when not CJK
        if ((/Xinhua\s*Net/i.test(l) || /Source:\s*Xinhua\s*Net/i.test(l)) && !containsCJK(l)) continue
        // drop Responsible editor / Responsible editor: lines
        if (/Responsible editor[:：]/i.test(l)) continue
        cleaned.push(line)
      }
    let out = cleaned.join('\n')
    // Remove leading duplicate title lines or UI fragments
    try {
      const oLines = out.split('\n').map(l => l.trim()).filter(Boolean)
      // drop immediate duplicate leading lines
      while (oLines.length > 1 && oLines[0] === oLines[1]) {
        oLines.shift()
      }
      // drop a few common leading UI/header fragments (be conservative if line contains CJK)
      while (oLines.length && (/^\s*新华网$/.test(oLines[0]) || /^新华网\b/.test(oLines[0]) || /^来源：/.test(oLines[0]) || /正文/.test(oLines[0]) || /字体：|字号：|小 中 大|分享到了?|分享|分享到/.test(oLines[0]) )) {
        oLines.shift()
      }
      // drop trailing duplicate title if it repeats at the end
      if (oLines.length > 1 && oLines[0] === oLines[oLines.length - 1]) {
        oLines.pop()
      }
      out = oLines.join('\n')
      // remove any further occurrences of the first headline-like line (drop duplicates elsewhere)
      try {
        const firstLine = oLines[0]
        if (firstLine && firstLine.length > 5) {
            // normalize for more robust duplicate detection
            const normalize = (x) => x.replace(/\s+/g, ' ').trim()
            const normFirst = normalize(firstLine)
            const escaped = normFirst.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const re = new RegExp('^' + escaped + '$', 'm')
          const pieces = out.split('\n')
          // keep only the first occurrence
          let seen = false
          out = pieces.filter(p => {
            if (p.trim() === '') return false
              if (re.test(normalize(p)) && !seen) {
              seen = true
              return true
            }
              if (re.test(normalize(p)) && seen) return false
            return true
          }).join('\n')
        }
      } catch (e) {
        // ignore
      }
    } catch (e) {
      // ignore
    }
    // remove any trailing 'Read next' blocks
      out = out.replace(/Read next:[\s\S]*$/i, '')
      out = out.replace(/Read the next article:[\s\S]*$/i, '')
      out = out.replace(/Read next article:[\s\S]*$/i, '')
      out = out.replace(/阅读下一篇[\s\S]*$/i, '')
      out = out.replace(/\[Correction\][\s\S]*$/i, '')
      out = out.replace(/【纠错】[\s\S]*$/i, '')
      out = out.replace(/Source:\s*Xinhua News Agency[\s\S]*$/i, '')
      out = out.replace(/Chief Editors?:[\s\S]*$/i, '')
      out = out.replace(/Contributors?:[\s\S]*$/i, '')
      out = out.replace(/来源：?\s*新华社[\s\S]*$/i, '')
      out = out.replace(/来源: ?新华社[\s\S]*$/i, '')
      out = out.replace(/(责任编辑|主编|供稿|撰稿|作者)[\s\S]*$/i, '')
      // remove single lines that contain '新华网' or '来源：新华网' (do not strip remaining article body)
      out = out.replace(/(^|\n)\s*新华网[^\n]*/i, '')
      out = out.replace(/(^|\n)[^\n]*来源：?\s*新华网[^\n]*/i, '')
      // remove inline '来源：新华网' occurrences
      out = out.replace(/来源：?\s*新华网\s*/gi, '')
      // remove example repeated headline occurrences (and similar exact duplicates)
      out = out.replace(/(^|\n)\s*2026年的中东将向何处去？\s*(\n|$)/gi, '\n')
      // remove combined credit blocks like a single trailing credits line (but avoid removing the rest of the article)
      out = out.replace(/(^|\n)[^\n]*来源：?\s*新华网[^\n]*/i, '')
      out = out.replace(/主笔[:：][\s\S]*$/i, '')
      out = out.replace(/参与报道[:：][\s\S]*$/i, '')
      out = out.replace(/【责任编辑[:：][\s\S]*?】/i, '')
      out = out.replace(/责任编辑[:：][\s\S]*$/i, '')
      // English-specific removals
      out = out.replace(/Source:\s*Xinhua\s*Net[\s\S]*$/i, '')
      out = out.replace(/Font:[\s\S]*?(Share to:|Share:|$)/gi, '')
      out = out.replace(/Share to:[\s\S]*$/gi, '')
      out = out.replace(/【Correction】[\s\S]*$/gi, '')
      out = out.replace(/Responsible editor[:：][\s\S]*$/i, '')
      out = out.replace(/Read the next article[:：]?[\s\S]*$/i, '')
      out = out.replace(/New China Interview[\s\S]*?Xinhua Net/gi, '')
      // remove specific duplicated title suffix and breadcrumb blocks (only the line)
      out = out.replace(/2026年的中东将向何处去？\s*-?\s*新华网/gi, '')
      out = out.replace(/(^|\n)[^\n]*新华网\s*&gt;\s*&gt;\s*正文[^\n]*/gi, '')
      out = out.replace(/字体：[\s\S]*?(小\s*中\s*大\s*分享|分享到[:：]?)/gi, '')
      // remove reading-next and long trailing navigation blocks
      out = out.replace(/阅读下一篇：[\s\S]*$/i, '')
      out = out.replace(/阅读下一篇[:：][\s\S]*$/i, '')
    out = out.replace(/\n{3,}/g, '\n\n')
    return out.trim()
  }

  // decode HTML entities, including double-escaped ones like &amp;emsp;
  const decodeEntities = (s) => {
    if (!s || typeof s !== 'string') return s
    let t = s
    // unescape double-encoded entities like &amp;nbsp;
    t = t.replace(/&amp;(#?\w+);/g, '&$1;')
    try {
      const textarea = document.createElement('textarea')
      textarea.innerHTML = t
      return textarea.value
    } catch (e) {
      return t
    }
  }

  // helper: strip HTML entities/tags and return cleaned text for scoring
  const stripForScoring = (s) => {
    if (!s || typeof s !== 'string') return ''
    let t = s
    t = t.replace(/<[^>]+>/g, '')
    t = t.replace(/&nbsp;|\u00A0/g, ' ')
    t = t.replace(/&emsp;+/g, ' ')
    t = t.replace(/&[a-z]+;/gi, ' ')
    return t.trim()
  }

    // extract titles for English and Chinese sides (prefer language-specific payloads)
    const rawTitleEN = asText(
      enPayload?.article?.titleEN ?? enPayload?.article?.titleEn ?? enPayload?.article?.Title ?? enPayload?.article?.title ??
      enPayload?.Title ?? enPayload?.title ?? dataEn?.article?.titleEN ?? dataEn?.article?.titleEn ?? dataEn?.title ??
      article?.titleEN ?? article?.TitleEN ?? article?.titleEn ?? article?.Title ?? article?.title ?? ''
    )
    const titleEN = sanitize(rawTitleEN)

    const rawTitleZH = asText(
      zhPayload?.article?.titleZH ?? zhPayload?.article?.titleZh ?? zhPayload?.article?.Title ?? zhPayload?.article?.title ??
      zhPayload?.Title ?? zhPayload?.title ?? dataZh?.article?.titleZH ?? dataZh?.article?.titleZh ?? dataZh?.title ??
      article?.titleZH ?? article?.TitleZH ?? article?.titleZh ?? article?.Title ?? article?.title ?? ''
    )
    const titleZH = sanitize(rawTitleZH)

    // Prefer sanitized titles, but fall back to raw strings when sanitizer strips content
    const displayTitleEN = (titleEN && String(titleEN).trim()) ? titleEN.trim() : (rawTitleEN && String(rawTitleEN).trim() ? rawTitleEN.trim() : '')
    const displayTitleZH = (titleZH && String(titleZH).trim()) ? titleZH.trim() : (rawTitleZH && String(rawTitleZH).trim() ? rawTitleZH.trim() : '')

  // Attempt to translate ZH->EN (or EN->EN when EN contains CJK)
  const translateText = async (text) => {
    // Translation API removed per user request — do not call external service.
    // Keep a no-op async stub so callers don't break.
    return ''
  }
  // Translation has been disabled — do not run any translation effects.

  // effectiveTitleEN: prefer a real ASCII EN title, else use translated result, else fallback to raw EN
  // derive a short title from English summary or full content when explicit EN title is missing
  const deriveTitleFromENContent = (summary, full) => {
    try {
      const s = asText(summary || '')
      if (s && isMostlyAscii(s)) {
        // take first line or first 12 words
        const firstLine = s.split('\n').map(l => l.trim()).find(Boolean) || ''
        const words = firstLine.split(/\s+/).slice(0, 12).join(' ')
        return words.length > 0 ? (words + (firstLine.split(/\s+/).length > 12 ? '...' : '')) : ''
      }
      const f = asText(full || '')
      if (f && isMostlyAscii(f)) {
        const firstSentenceMatch = f.match(/(^.*?[.!?])(\s|$)/)
        if (firstSentenceMatch && firstSentenceMatch[1]) {
          const s2 = firstSentenceMatch[1].trim()
          const words = s2.split(/\s+/).slice(0, 12).join(' ')
          return words + (s2.split(/\s+/).length > 12 ? '...' : '')
        }
        const words = f.split(/\s+/).slice(0, 12).join(' ')
        return words + (f.split(/\s+/).length > 12 ? '...' : '')
      }
    } catch (e) {
      // ignore
    }
    return ''
  }
  const derivedTitleFromEN = deriveTitleFromENContent(summaryEN, fullEN)

  // When an explicit English title is missing, prefer using the full English content
  // (or the English summary) as the displayed title so the full English text is visible.
  const fullTitleFromEN = (() => {
    try {
      const f = asText(fullEN || '')
      if (f && isMostlyAscii(f)) {
        const firstLine = f.split('\n').map(l => l.trim()).find(Boolean)
        // prefer the first non-empty line (often the headline or leading paragraph)
        return firstLine || f
      }
      const s = asText(summaryEN || '')
      if (s && isMostlyAscii(s)) {
        const firstLine = s.split('\n').map(l => l.trim()).find(Boolean)
        return firstLine || s
      }
    } catch (e) {
      // ignore
    }
    return ''
  })()

  // Prefer an explicit ASCII EN title first, then translated result, then a derived English title,
  // and only use raw EN/EN-field (which may contain CJK) as a last resort.
  // Prefer a translated title (from Chinese) if available, otherwise prefer a clear ASCII EN title.
  const effectiveTitleEN = (() => {
    // Do not translate Chinese title — prefer an explicit ASCII EN title when present.
    if (displayTitleEN && isMostlyAscii(displayTitleEN)) return displayTitleEN
    return (fullTitleFromEN || derivedTitleFromEN || displayTitleEN || rawTitleEN || '')
  })()

  // cleaned Chinese full content: prefer sanitized, but if sanitizer strips too much and raw contains CJK, show raw
  const countCJK = (s) => {
    if (!s || typeof s !== 'string') return 0
    const m = s.match(/[\u4E00-\u9FFF]/g)
    return m ? m.length : 0
  }

  // returns object { best, bestScore, chosenIndex }
  const pickBestChinese = (candidates) => {
    let best = ''
    let bestScore = 0
    let chosenIndex = -1
    for (let i = 0; i < candidates.length; i++) {
      const v = candidates[i]
      const txtRaw = asText(v || '')
      const txt = stripForScoring(txtRaw)
      const cjk = countCJK(txt)
      const score = cjk * Math.log(Math.max(1, txt.length))
      if (score > bestScore) {
        bestScore = score
        best = txtRaw
        chosenIndex = i
      }
    }
    return { best, bestScore, chosenIndex }
  }

  const { cleanedFullZH, pickInfo } = useMemo(() => {
    // gather likely fields to choose from (include language-specific article objects)
    const candidates = [
      fullZH,
      original,
      articleZh?.fullContentZH,
      articleZh?.FullContentZH,
      articleZh?.content,
      articleZh?.Content,
      article?.fullContentZH,
      article?.FullContentZH,
      article?.content,
      article?.Content,
      zhPayload?.fullContent,
      zhPayload?.TranslatedContent,
      zhPayload?.translatedContent,
      zhPayload?.OriginalContent,
      dataZh?.fullContent,
      dataZh?.article?.fullContent,
      data?.article?.fullContent,
      data?.fullContent
    ]
    const pick = pickBestChinese(candidates)
    const best = pick.best
    const bestScore = pick.bestScore
    const chosenIndex = pick.chosenIndex
    const s = sanitize(best || '')
    let result = ''
    if (s && s.trim()) result = s
    else if (containsCJK(best)) result = best
    else {
      try {
        const scored = candidates.map((v, i) => ({ i, txt: asText(v || ''), cjk: countCJK(asText(v || '')) }))
          .filter(x => x.cjk > 0)
          .sort((a, b) => (b.cjk * b.txt.length) - (a.cjk * a.txt.length))
        if (scored.length >= 2) {
          result = (scored[0].txt + '\n\n' + scored[1].txt).trim()
        }
      } catch (e) {
        // ignore
      }
    }
    const diagnostics = {
      chosenIndex,
      bestScore,
      candidates: candidates.map((c, i) => ({ i, len: asText(c || '').length, cjk: countCJK(asText(c || '')), preview: asText(c || '').slice(0, 240) }))
    }
    return { cleanedFullZH: result, pickInfo: diagnostics }
  }, [fullZH, original, article, articleZh, zhPayload, dataZh, data])

  // (avoid storing pickInfo in state to prevent render loops)

  // cleaned Chinese summary similar fallback
  const cleanedSummaryZH = (() => {
    // Prefer an explicit summary field if available (so bullet-format summaries are preserved)
    const explicit = article?.summaryZH ?? article?.SummaryZH ?? summaryZH ?? dataZh?.summary ?? data?.summary
    if (explicit && String(explicit).trim()) {
      const san = sanitize(asText(explicit))
      if (san && san.trim()) return san
      if (containsCJK(explicit)) return asText(explicit)
    }

    const candidates = [
      summaryZH,
      article?.summaryZH,
      article?.SummaryZH,
      summaryZH || fullZH,
      fullZH,
      original,
      article?.summary,
      dataZh?.summary,
      data?.summary
    ]
    const pick = pickBestChinese(candidates)
    const best = pick.best
    const s = sanitize(best || '')
    if (s && s.trim()) return s
    if (containsCJK(best)) return best
    return ''
  })()

  

  const titleText = (() => {
    const t = article?.Title ?? article?.title
    if (t == null) return 'Article Review'
    return typeof t === 'string' ? t : safeStringify(t)
  })()
  if (loading) {
    return <div style={{ padding: 24 }}>Loading...</div>
  }
  if (error) {
    return <div style={{ padding: 24, color: '#c92b2b' }}>Error: {error}</div>
  }

  return (
    <div style={{ padding: 16, background: '#fbf8f6', overflowX: 'hidden', minWidth: 0 }}>
      <div style={{ maxWidth: 1440, margin: '0 auto', width: '100%', padding: 36, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
          <button
            onClick={() => {
              const idNum = parseInt(id, 10)
              if (!Number.isNaN(idNum) && prevAvailable) {
                try {
                  const target = prevId || String(idNum - 1)
                  const u = new URL(window.location.href)
                  const parts = u.pathname.split('/').filter(Boolean)
                  if (parts.length === 0) {
                    navigate(`/${target}${u.search}${u.hash}`)
                    return
                  }
                  parts[parts.length - 1] = String(target)
                  const newPath = '/' + parts.join('/')
                  navigate(newPath + u.search + u.hash)
                } catch (e) {
                  navigate(String(idNum - 1))
                }
              }
            }}
            disabled={!prevAvailable || checkingNeighbors}
            style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #e6e6e6', background: prevAvailable ? 'white' : '#f5f5f5', opacity: prevAvailable ? 1 : 0.6, cursor: prevAvailable ? 'pointer' : 'default' }}
          >
            Previous
          </button>

          <button onClick={() => navigate('/consultant/articles')} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #e6e6e6', background: 'white' }}>Back</button>

          <button
            onClick={() => {
              const idNum = parseInt(id, 10)
              if (!Number.isNaN(idNum) && nextAvailable) {
                try {
                  const target = nextId || String(idNum + 1)
                  const u = new URL(window.location.href)
                  const parts = u.pathname.split('/').filter(Boolean)
                  if (parts.length === 0) {
                    navigate(`/${target}${u.search}${u.hash}`)
                    return
                  }
                  parts[parts.length - 1] = String(target)
                  const newPath = '/' + parts.join('/')
                  navigate(newPath + u.search + u.hash)
                } catch (e) {
                  navigate(String(idNum + 1))
                }
              }
            }}
            disabled={!nextAvailable || checkingNeighbors}
            style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #e6e6e6', background: nextAvailable ? 'white' : '#f5f5f5', opacity: nextAvailable ? 1 : 0.6, cursor: nextAvailable ? 'pointer' : 'default' }}
          >
            Next
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(640px, 1fr))', gridTemplateRows: 'auto 1fr', gap: 36, alignItems: 'start', marginBottom: 32 }}>
            {/* Title row: use a flex wrapper so both title boxes stretch to match the taller one */}
            <div style={{ gridColumn: '1 / -1', gridRow: '1 / 2', display: 'flex', gap: 36, alignItems: 'stretch' }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'white', padding: 32, borderRadius: 10, boxShadow: '0 6px 18px rgba(0,0,0,0.06)', boxSizing: 'border-box' }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Title (English)</div>
                <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word', wordBreak: 'break-word', overflow: 'auto', flex: 1, maxWidth: '100%' }}>
                  { (effectiveTitleEN && String(effectiveTitleEN).trim()) || derivedTitleFromEN || (summaryEN && String(summaryEN).trim()) || (fullEN && String(fullEN).trim()) || '' }
                </div>
                {translatedTitleEn && String(translatedTitleEn).trim() && (translatedTitleEn.trim() !== (effectiveTitleEN || '').trim()) ? (
                  <div style={{ marginTop: 8, color: '#333', fontSize: 14, whiteSpace: 'pre-wrap' }}>Translated (EN): {translatedTitleEn}</div>
                ) : null}
                {rawTitleEN && String(rawTitleEN).trim() && !containsCJK(rawTitleEN) && rawTitleEN.trim() !== (effectiveTitleEN || '').trim() ? (
                  <div style={{ marginTop: 8, color: '#666', fontSize: 13, whiteSpace: 'pre-wrap', overflow: 'visible', textOverflow: 'unset' }}>Full (EN): {rawTitleEN}</div>
                ) : null}
              </div>

              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'white', padding: 32, borderRadius: 10, boxShadow: '0 6px 18px rgba(0,0,0,0.06)', boxSizing: 'border-box' }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Title (Chinese)</div>
                <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word', wordBreak: 'break-word', textAlign: 'left', overflow: 'auto', flex: 1, maxWidth: '100%' }}>
                  { (displayTitleZH && String(displayTitleZH).trim()) || cleanedSummaryZH || (cleanedFullZH && String(cleanedFullZH).slice(0, 500)) || '' }
                </div>
                {rawTitleZH && String(rawTitleZH).trim() && rawTitleZH.trim() !== (displayTitleZH || '').trim() ? (
                  <div style={{ marginTop: 8, color: '#666', fontSize: 13, whiteSpace: 'pre-wrap' }}>Full (ZH title raw): {rawTitleZH}</div>
                ) : null}
              </div>
            </div>

          
          {/* Content row: two columns */}
            <div style={{ gridColumn: '1 / -1', gridRow: '2 / 3', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(640px, 1fr))', gap: 36, minWidth: 0 }}>
              <div style={{ background: 'white', padding: 32, borderRadius: 10, boxShadow: '0 6px 18px rgba(0,0,0,0.06)', overflowX: 'hidden', minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Full Content (English)</div>
              <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word', wordBreak: 'break-word', maxHeight: '60vh', overflow: 'auto', maxWidth: '100%' }}>
                {(
                  (sanitize(asText(fullEN)) || asText(fullEN)) ||
                  (sanitize(asText(translated)) || asText(translated)) ||
                  '—'
                )}
              </pre>
            </div>
              <div style={{ background: 'white', padding: 32, borderRadius: 10, boxShadow: '0 6px 18px rgba(0,0,0,0.06)', overflowX: 'hidden', minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Full Content (Chinese)</div>
              <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word', wordBreak: 'break-word', maxHeight: '60vh', overflow: 'auto', maxWidth: '100%' }}>
                {(cleanedFullZH || asText(fullZH) || '—')}
              </pre>
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(640px, 1fr))', gap: 36, minWidth: 0 }}>
              <div style={{ background: 'white', padding: 32, borderRadius: 10, boxShadow: '0 6px 18px rgba(0,0,0,0.06)', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Summary (English)</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{(sanitize(asText(summaryEN)) || asText(summaryEN) || '—')}</div>
              </div>
              <div style={{ background: 'white', padding: 32, borderRadius: 10, boxShadow: '0 6px 18px rgba(0,0,0,0.06)', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Summary (Chinese)</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>
                    <div style={{ color: '#333' }}>
                      {(() => {
                        const s = (cleanedSummaryZH || asText(summaryZH) || '').trim()
                        if (!s) return '—'
                        // If the summary uses dash-prefixed lines, render as a proper list
                        if (/^\s*-\s+/m.test(s)) {
                          const lines = s.split(/\r?\n/).map(l => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean)
                          return (
                            <ul style={{ margin: 0, paddingLeft: 20 }}>
                              {lines.map((ln, idx) => <li key={idx} style={{ marginBottom: 6 }}>{ln}</li>)}
                            </ul>
                          )
                        }
                        if (s && containsCJK(s)) return s
                        return s || '—'
                      })()}
                    </div>
                  </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <details style={{ marginTop: 16, background: 'white', padding: 16, borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.04)' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Debug: raw payloads</summary>
        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>base data</div>
          <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 240, overflow: 'auto' }}>{safeStringify(data)}</pre>
          <div style={{ fontWeight: 600, margin: '12px 0 6px' }}>?lang=en</div>
          <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 240, overflow: 'auto' }}>{safeStringify(dataEn)}</pre>
          <div style={{ fontWeight: 600, margin: '12px 0 6px' }}>?lang=zh</div>
          <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 240, overflow: 'auto' }}>{safeStringify(dataZh)}</pre>
          <div style={{ fontWeight: 600, margin: '12px 0 6px' }}>Candidate diagnostics</div>
          <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 240, overflow: 'auto' }}>{safeStringify(pickInfo)}</pre>
        </div>
      </details>
      
      </div>
  )
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('ArticleReview caught error', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20 }}>
          <h3 style={{ color: '#c92b2b' }}>An error occurred while rendering this article.</h3>
          <div style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{String(this.state.error)}</div>
          <div style={{ marginTop: 12 }}>
            <button onClick={() => window.location.reload()} style={{ marginRight: 8 }}>Reload</button>
            <button onClick={() => { window.location.href = '/articles' }}>Back</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
