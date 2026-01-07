import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getArticle, translatePreview, translateAndSave, approveTranslation } from '../../api/articles'
import { getRoleFromToken } from '../../utils/auth'

const palette = {
  bg: '#fbf8f6',
  card: '#ffffff',
  primary: '#1e73d1',
  accent: '#e07a16',
  success: '#1e7a3a',
  muted: '#666'
}

const styles = {
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16 },
  titleBox: { display: 'flex', flexDirection: 'column' },
  controls: { display: 'flex', gap: 8, alignItems: 'center' },
  button: { padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer' },
  primaryBtn: { background: palette.primary, color: 'white' },
  ghostBtn: { background: 'transparent', border: '1px solid #eee' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 },
  container: { padding: 12, maxWidth: 1100, margin: '0 auto', background: 'transparent', minHeight: '80vh', paddingLeft: 0 },
  card: { background: palette.card, padding: 18, borderRadius: 10, boxShadow: '0 6px 20px rgba(0,0,0,0.06)' },
  textarea: { width: '100%', minHeight: 240, padding: 12, borderRadius: 8, border: '1px solid #e6e6e6', resize: 'vertical', fontSize: 15, lineHeight: 1.5 }
}

export default function ArticleTranslate() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [article, setArticle] = useState(null)
  const [rawData, setRawData] = useState(null)
  const [showRaw, setShowRaw] = useState(false)
  const [original, setOriginal] = useState('')
  const [suggested, setSuggested] = useState('')
  const [edited, setEdited] = useState('')
  const [targetLang, setTargetLang] = useState('zh')
  const [rawOriginalRaw, setRawOriginalRaw] = useState('')

  const pick = (obj, keys) => {
    if (!obj) return null
    for (const k of keys) {
      if (obj[k] != null) return obj[k]
    }
    return null
  }

  const clean = (html) => {
    if (!html) return ''
    try {
      const d = document.createElement('div')
      const replaced = (html || '')
        .replace(/pagebreak/gi, '\n---PAGEBREAK---\n')
        .replace(/\u00A0/g, ' ')
      d.innerHTML = replaced
      let txt = d.textContent || d.innerText || ''
      txt = txt.replace(/\u2003/g, ' ').replace(/\s+/g, ' ').trim()
      return txt
    } catch (e) {
      return (html || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
    }
  }

  useEffect(() => { if (id) load() }, [id])

  const load = async () => {
    setLoading(true)
    try {
      const res = await getArticle(id)
      // res may be { Article: {...}, OriginalContent, TranslatedContent }
      // or it may be the article object itself. Normalize both shapes.
      setRawData(res)
      const articleObj = res?.Article || res?.article || ((res && (res.NewsArticleId || res.ArticleId || res.id || res.title)) ? res : null)
      setArticle(articleObj || null)
      // Original/Translated content may be on res or inside articleObj
      const rawOriginal = res.OriginalContent || res.originalContent || res.Original || res.original || (articleObj && (articleObj.OriginalContent || articleObj.originalContent || articleObj.Original || articleObj.original)) || ''
      const rawTranslated = res.TranslatedContent || res.translatedContent || res.Translated || res.translated || (articleObj && (articleObj.TranslatedContent || articleObj.translatedContent || articleObj.Translated || articleObj.translated)) || ''

      setRawOriginalRaw(rawOriginal || '')
      setOriginal(clean(rawOriginal || ''))
      setSuggested(clean(rawTranslated || '') || '')
      setEdited(clean(rawTranslated || '') || '')
    } catch (e) {
      alert('Failed to load article: ' + e.message)
    } finally { setLoading(false) }
  }

  const doPreview = async () => {
    try {
      const res = await translatePreview(id, targetLang, rawOriginalRaw || undefined)
      setRawData(res)
      // prefer TranslatedContent, then Suggested or generic fields
      const suggestedText = pick(res, ['TranslatedContent', 'translatedContent', 'Translated', 'translated', 'Suggested', 'suggested', 'SuggestedText', 'SuggestedTranslation']) || pick(res.Article || res.article, ['TranslatedContent', 'Translated', 'Suggested', 'suggested']) || ''
      const originalText = pick(res, ['Original', 'original', 'OriginalContent', 'originalContent']) || rawOriginalRaw || original
      if (originalText) setOriginal(clean(originalText))
      setSuggested(clean(suggestedText || '') )
      setEdited(clean(suggestedText || ''))
      if (!suggestedText) alert('Preview generated but no suggested text returned')
    } catch (e) { alert('Translate preview failed: ' + e.message) }
  }

  const doSave = async () => {
    try {
      const payload = { TargetLanguage: targetLang, EditedTranslation: edited || null, AutoTranslateIfNoEdit: !edited, Text: rawOriginalRaw || original }
      const res = await translateAndSave(id, payload)
      setRawData(res)
      // refresh article to ensure full fields (title, source, etc.) are present
      // but merge any returned translation fields for immediate UI feedback
      const returnedArticle = res?.Article || res?.article || (res && (res.NewsArticleId || res.ArticleId || res.id) ? res : null)
      if (returnedArticle) {
        setArticle(prev => ({ ...(prev || {}), ...returnedArticle }))
      }
      // also set edited/suggested from returned translation content if present
      const newTranslated = pick(res, ['TranslatedContent', 'translatedContent', 'Translated', 'translated']) || (returnedArticle && (returnedArticle.TranslatedContent || returnedArticle.translatedContent || returnedArticle.Translated || returnedArticle.translated))
      if (newTranslated) {
        const cleaned = clean(newTranslated)
        setSuggested(cleaned)
        setEdited(cleaned)
      }
      alert('Translation saved')
      // ensure we have the canonical article shape from the server
      load()
      // notify other pages (list) that articles changed so they can reload
      try { window.dispatchEvent(new CustomEvent('articles:changed')) } catch (e) { /* ignore */ }
    } catch (e) { alert('Save failed: ' + e.message) }
  }

  const doApprove = async () => {
    try {
      const res = await approveTranslation(id)
      setRawData(res)
      // merge returned approve info into article and refresh
      const returnedArticle = res?.Article || res?.article || (res && (res.NewsArticleId || res.ArticleId || res.id) ? res : null)
      if (returnedArticle) setArticle(prev => ({ ...(prev || {}), ...returnedArticle }))
      alert('Translation approved')
      load()
      try { window.dispatchEvent(new CustomEvent('articles:changed')) } catch (e) { /* ignore */ }
    } catch (e) { alert('Approve failed: ' + e.message) }
  }

  const role = getRoleFromToken(localStorage.getItem('token'))

  const getPublished = (a) => {
    if (!a) return null
    return a.PublishedAt || a.publishedAt || a.fetchedAt || a.crawledAt || null
  }

  const getSourceLabel = (a) => {
    if (!a) return ''
    return a.SourceName || a.Source || a.source || a.SourceURL || ''
  }

  const displayPublished = getPublished(article)
  const sourceLabel = getSourceLabel(article)

  return (
    <div className="content-full">
      <div className="page-inner">
      <div style={styles.container}>
      <div style={styles.headerRow}>
        <div style={styles.titleBox}>
          <h2 style={{ margin: 0, fontSize: 22 }}>{article ? (article.Title || `Article #${id}`) : `Article #${id}`}</h2>
          {article && <div style={{ color: palette.muted, marginTop: 6 }}>{sourceLabel || article.SourceURL || ''} • {displayPublished ? new Date(displayPublished).toLocaleString() : '-'}</div>}
        </div>
        <div style={styles.controls}>
          <button onClick={() => navigate('/consultant/articles')} style={{ ...styles.button, ...styles.ghostBtn }}>Back to list</button>
          <button onClick={() => setShowRaw(s => !s)} style={{ ...styles.button, ...styles.ghostBtn }}>{showRaw ? 'Hide' : 'Show'} Raw</button>
        </div>
      </div>

      {loading ? <div>Loading...</div> : (
        <div style={styles.grid}>
          <div style={styles.card}>
            <h3 style={{ marginTop: 0 }}>Original</h3>
            <div style={{ whiteSpace: 'pre-wrap', color: '#111' }}>{original || '-'}</div>
          </div>

          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <h3 style={{ margin: 0 }}>Translation</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ color: palette.muted, fontSize: 13 }}>Target:</label>
                <select value={targetLang} onChange={e => setTargetLang(e.target.value)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #e6e6e6' }}>
                  <option value="en">English</option>
                  <option value="zh">Chinese</option>
                </select>
                <button onClick={doPreview} style={{ ...styles.button, ...styles.primaryBtn }}>Auto-Translate</button>
              </div>
            </div>

            <div style={{ marginTop: 12, marginBottom: 8 }}>
              <button onClick={() => { setEdited(suggested || ''); alert('Suggested loaded into editor') }} style={{ ...styles.button, border: '1px solid #eee' }}>Load Suggested</button>
            </div>

            <textarea style={styles.textarea} value={edited} onChange={e => setEdited(e.target.value)} />

            <div style={{ marginTop: 12, color: palette.muted, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div><strong>Saved By:</strong> {article?.TranslationSavedBy ?? '-'}</div>
              <div><strong>Saved At:</strong> {article?.TranslationSavedAt ? new Date(article.TranslationSavedAt).toLocaleString() : '-'}</div>
              <div><strong>Status:</strong> {article?.TranslationStatus ?? '-'}</div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={doSave} style={{ ...styles.button, ...styles.primaryBtn }}>Save Translation</button>
              {role === 'consultant' && <button onClick={doApprove} style={{ ...styles.button, background: palette.success, color: 'white' }}>Approve Translation</button>}
            </div>
          </div>
        </div>
      )}

      {showRaw && rawData && (
        <div style={{ marginTop: 16, background: '#fff', padding: 14, borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.04)' }}>
          <h3 style={{ marginTop: 0 }}>Debug / Raw Response</h3>
          <div style={{ marginBottom: 8 }}>
            <strong>Computed Fallbacks:</strong>
            <div>Published (fallback): {displayPublished || 'NULL'}</div>
            <div>Source label: {sourceLabel || 'NULL'}</div>
            <div>TranslationSavedAt: {article?.TranslationSavedAt ?? 'NULL'}</div>
            <div>TranslationStatus: {article?.TranslationStatus ?? 'NULL'}</div>
          </div>
          <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 320, overflow: 'auto' }}>{JSON.stringify(rawData, null, 2)}</pre>
        </div>
      )}
      </div>
      </div>
    </div>
  )
}
