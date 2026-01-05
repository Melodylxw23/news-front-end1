import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || ''

const apiFetch = async (path, opts = {}) => {
  const token = localStorage.getItem('token')
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {})
  if (token) headers['Authorization'] = `Bearer ${token}`
  const fullPath = path.startsWith('http') ? path : `${API_BASE.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`

  console.log('[apiFetch] request', opts.method || 'GET', fullPath, opts.body ? JSON.parse(opts.body) : undefined)

  const res = await fetch(fullPath, Object.assign({ headers }, opts))
  const text = await res.text().catch(() => '')
  if (!res.ok) {
    const errorMsg = `HTTP ${res.status} ${res.statusText}${text ? ': ' + text : ''}`
    console.error('[apiFetch] response error', res.status, fullPath, text)
    throw new Error(errorMsg)
  }
  console.log('[apiFetch] response success', res.status, fullPath, text ? JSON.parse(text) : null)
  try { return text ? JSON.parse(text) : null } catch (e) { return text }
}

export default function SelectTopicsOfInterest({ onComplete }) {
  const navigate = useNavigate()
  const [topics, setTopics] = useState([])
  const [selectedTopics, setSelectedTopics] = useState([])
  const [language, setLanguage] = useState('English')
  const [notifyEnabled, setNotifyEnabled] = useState(true)
  const [loading, setLoading] = useState(false)
  const [loadingTopics, setLoadingTopics] = useState(true)
  const [loadingProfile, setLoadingProfile] = useState(true)

  useEffect(() => {
    loadTopics()
    loadCurrentPreferences()
  }, [])

  const loadCurrentPreferences = async () => {
    setLoadingProfile(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setLoadingProfile(false)
        return
      }

      const res = await fetch('/api/UserControllers/me', { 
        headers: { Authorization: `Bearer ${token}` } 
      })
      
      if (!res.ok) {
        setLoadingProfile(false)
        return
      }

      const data = await res.json()
      console.log('[loadCurrentPreferences] Full API response:', data)
      
      const memberData = data?.Member || data?.member
      console.log('[loadCurrentPreferences] Member data:', memberData)

      if (memberData) {
        // Pre-populate language - map from backend enum values to dropdown values
        // Backend enum: EN, ZH, Both
        const backendLang = memberData.preferredLanguage || memberData.PreferredLanguage
        console.log('[loadCurrentPreferences] Backend language value:', backendLang, 'Type:', typeof backendLang)
        
        if (backendLang) {
          // Map backend enum values to dropdown values
          if (backendLang === 'EN' || backendLang === 'English' || backendLang === 0) {
            console.log('[loadCurrentPreferences] Setting language to English')
            setLanguage('English')
          } else if (backendLang === 'ZH' || backendLang === 'Chinese' || backendLang === '中文' || backendLang === 1) {
            console.log('[loadCurrentPreferences] Setting language to Chinese')
            setLanguage('Chinese')
          } else {
            console.log('[loadCurrentPreferences] Using backend value as-is:', backendLang)
            setLanguage(backendLang) // Use as-is if already matches
          }
        }

        // Pre-populate selected topics
        const interests = memberData.interests || memberData.Interests || []
        if (interests.length > 0) {
          const selectedIds = interests.map(i => i.interestTagId || i.InterestTagId)
          setSelectedTopics(selectedIds)
        }
      }
    } catch (e) {
      console.error('[loadCurrentPreferences] error:', e)
    } finally {
      setLoadingProfile(false)
    }
  }

  const loadTopics = async () => {
    setLoadingTopics(true)
    try {
      const res = await apiFetch('/api/InterestTags')
      console.log('[loadTopics] raw response:', res)
      const list = res?.data || res || []
      const mapped = Array.isArray(list) ? list.map(t => ({
        id: t.interestTagId ?? t.InterestTagId ?? t.id,
        name: t.name ?? t.Name
      })) : []
      setTopics(mapped)
    } catch (e) {
      console.error('[loadTopics] error:', e)
      alert('Failed to load topics: ' + e.message)
    } finally {
      setLoadingTopics(false)
    }
  }

  const toggleTopic = (topicId) => {
    setSelectedTopics(prev => 
      prev.includes(topicId) 
        ? prev.filter(id => id !== topicId)
        : [...prev, topicId]
    )
  }

  const handleSubmit = async () => {
    if (selectedTopics.length === 0) {
      alert('Please select at least one topic of interest')
      return
    }

    setLoading(true)
    try {
      // Map frontend language values to backend enum format
      // Backend expects: "EN", "ZH", or "Both"
      const backendLanguage = language === 'Chinese' ? 'ZH' : 'EN'
      
      console.log('[handleSubmit] Frontend language:', language)
      console.log('[handleSubmit] Mapped backend language:', backendLanguage)
      
      // Only send database topic IDs (no custom topics)
      const payload = {
        InterestTagIds: selectedTopics,
        CustomTopics: [],
        PreferredLanguage: backendLanguage,
        NotifyNewArticles: notifyEnabled
      }

      console.log('[handleSubmit] Full payload:', payload)

      const res = await apiFetch('/api/UserControllers/select-topics', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      
      console.log('[handleSubmit] API response:', res)

      alert(res?.message || 'Topics saved successfully!')
      
      // Navigate to notification preferences page
      navigate('/notification-preferences')
    } catch (e) {
      console.error('[handleSubmit] error:', e)
      alert('Failed to save topics: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = () => {
    navigate('/landing')
  }

  return (
    <div style={{ 
      display: 'flex', 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      {/* Left Panel - Branding */}
      <div style={{ 
        flex: '0 0 45%',
        background: 'linear-gradient(135deg, #c92b2b 0%, #8b1f1f 100%)',
        color: 'white',
        padding: '60px 80px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ fontSize: 48, fontWeight: 700, marginBottom: 80, letterSpacing: 2 }}>
            SINOSTREAM
          </div>
          <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 16 }}>Be on the wave</div>
          <div style={{ fontSize: 28, fontWeight: 300, lineHeight: 1.4 }}>
            Your personal, continuous stream of curated English & Chinese news.
          </div>
        </div>
      </div>

      {/* Right Panel - Topics Selection */}
      <div style={{ 
        flex: 1,
        background: 'white',
        padding: '60px 80px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Language Selector */}
        <div style={{ textAlign: 'right', marginBottom: 32 }}>
          <select 
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={{ 
              padding: '8px 16px',
              border: '1px solid #ddd',
              borderRadius: 6,
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            <option value="English">English</option>
            <option value="Chinese">中文</option>
          </select>
        </div>

        <div style={{ flex: 1 }}>
          <h1 style={{ 
            fontSize: 36, 
            fontWeight: 700, 
            color: '#c92b2b',
            marginBottom: 16,
            marginTop: 0
          }}>
            Topics Of Interest
          </h1>
          <p style={{ 
            fontSize: 15, 
            color: '#666',
            marginBottom: 32,
            lineHeight: 1.6
          }}>
            Select the areas that matter most to your business.<br/>
            This will help us tailor your news feed and alerts.
          </p>

          {/* Topics Grid */}
          {(loadingTopics || loadingProfile) ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#999' }}>Loading topics...</div>
          ) : (
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: 12,
              marginBottom: 32
            }}>
              {topics.map(topic => (
                <button
                  key={topic.id}
                  onClick={() => toggleTopic(topic.id)}
                  style={{
                    padding: '10px 20px',
                    border: selectedTopics.includes(topic.id) ? '2px solid #c92b2b' : '2px solid #ddd',
                    background: selectedTopics.includes(topic.id) ? '#fff5f5' : 'white',
                    color: selectedTopics.includes(topic.id) ? '#c92b2b' : '#666',
                    borderRadius: 24,
                    fontSize: 14,
                    cursor: 'pointer',
                    fontWeight: selectedTopics.includes(topic.id) ? 600 : 400,
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  {topic.name}
                </button>
              ))}
            </div>
          )}

          {/* Settings Section */}
          <div style={{ 
            background: '#f9f9f9',
            padding: 24,
            borderRadius: 12,
            marginBottom: 32
          }}>
            <h3 style={{ 
              fontSize: 18,
              fontWeight: 600,
              color: '#c92b2b',
              marginTop: 0,
              marginBottom: 20
            }}>
              Settings
            </h3>
            
            <div style={{ marginBottom: 20 }}>
              <label style={{ 
                display: 'block',
                fontSize: 14,
                color: '#666',
                marginBottom: 8,
                fontWeight: 500
              }}>
                Preferred Article Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  fontSize: 14,
                  cursor: 'pointer',
                  background: 'white'
                }}
              >
                <option value="English">English</option>
                <option value="Chinese">中文</option>
              </select>
            </div>

            <div style={{ 
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <label style={{ 
                fontSize: 14,
                color: '#666',
                fontWeight: 500
              }}>
                Notify me about new articles in these topics
              </label>
              <label style={{ 
                position: 'relative',
                display: 'inline-block',
                width: 52,
                height: 28,
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={notifyEnabled}
                  onChange={(e) => setNotifyEnabled(e.target.checked)}
                  style={{ display: 'none' }}
                />
                <span style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: notifyEnabled ? '#c92b2b' : '#ccc',
                  borderRadius: 28,
                  transition: 'background 0.3s'
                }}>
                  <span style={{
                    position: 'absolute',
                    content: '',
                    height: 22,
                    width: 22,
                    left: notifyEnabled ? 26 : 3,
                    bottom: 3,
                    background: 'white',
                    borderRadius: '50%',
                    transition: 'left 0.3s'
                  }}></span>
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ 
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          paddingTop: 24,
          borderTop: '1px solid #eee'
        }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: '12px 32px',
              background: 'white',
              border: '2px solid #ddd',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              color: '#666'
            }}
          >
            Back
          </button>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={handleSkip}
              style={{
                padding: '12px 24px',
                background: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 500,
                cursor: 'pointer',
                color: '#999'
              }}
            >
              Skip for now
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || selectedTopics.length === 0}
              style={{
                padding: '12px 48px',
                background: selectedTopics.length === 0 ? '#ccc' : '#c92b2b',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 600,
                cursor: selectedTopics.length === 0 ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Saving...' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
