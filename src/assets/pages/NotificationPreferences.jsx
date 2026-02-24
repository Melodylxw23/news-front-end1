import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || ''

const apiFetch = async (path, opts = {}) => {
  const token = localStorage.getItem('token')
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {})
  if (token) headers['Authorization'] = `Bearer ${token}`
  const fullPath = path.startsWith('http') ? path : `${API_BASE.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`

  const res = await fetch(fullPath, Object.assign({ headers }, opts))
  const text = await res.text().catch(() => '')
  if (!res.ok) {
    const errorMsg = `HTTP ${res.status} ${res.statusText}${text ? ': ' + text : ''}`
    throw new Error(errorMsg)
  }
  try { return text ? JSON.parse(text) : null } catch (e) { return text }
}

export default function NotificationPreferences() {
  const navigate = useNavigate()
  const [language, setLanguage] = useState('English')
  const [channels, setChannels] = useState({
    whatsapp: false,
    email: false,
    sms: false,
    inApp: false
  })
  const [loading, setLoading] = useState(false)

  // Load existing preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      const parseChannels = (channelsString) => {
        const existing = (channelsString || '').split(',').map(c => c.trim().toLowerCase())
        return {
          whatsapp: existing.includes('whatsapp'),
          email: existing.includes('email'),
          sms: existing.includes('sms'),
          inApp: existing.includes('inapp') || existing.includes('in-app')
        }
      }

      try {
        // 1) Try pending preferences saved in localStorage (onboarding/flow)
        try {
          const pending = JSON.parse(localStorage.getItem('pendingNotificationPreferences') || 'null')
          const pendingChannels = pending?.NotificationChannels || pending?.notificationChannels
          if (pendingChannels) {
            setChannels(parseChannels(pendingChannels))
            return
          }
        } catch (e) {
          console.warn('[NotificationPreferences] Could not parse pending preferences', e)
        }

        // 2) Fallback: fetch from server
        const response = await apiFetch('/api/UserControllers/me')
        const userData = response?.data || response
        
        console.log('[NotificationPreferences] Full response:', response)
        console.log('[NotificationPreferences] Loaded user data:', userData)
        
        // The notification data is nested in the member object
        const memberData = userData?.member || userData?.Member
        console.log('[NotificationPreferences] Member data:', memberData)
        
        // Pre-populate channels if they exist
        const channelsString = memberData?.notificationChannels || memberData?.NotificationChannels
        console.log('[NotificationPreferences] Channels string:', channelsString)
        
        if (channelsString) {
          const channelsState = parseChannels(channelsString)
          console.log('[NotificationPreferences] Pre-populating channels:', channelsState)
          setChannels(channelsState)
        } else {
          console.log('[NotificationPreferences] No existing channels found')
        }
      } catch (err) {
        console.error('[NotificationPreferences] Error loading preferences:', err)
      }
    }
    loadPreferences()
  }, [])

  const handleChannelToggle = (channel) => {
    setChannels(prev => ({ ...prev, [channel]: !prev[channel] }))
  }

  const handleNext = async () => {
    setLoading(true)
    try {
      // Convert selected channels to comma-separated string
      const selectedChannels = Object.keys(channels)
        .filter(key => channels[key])
        .join(',')
      
      console.log('[NotificationPreferences] Selected channels:', selectedChannels)
      
      const payload = {
        NotificationChannels: selectedChannels // "whatsapp,email,sms,inApp"
      }

      console.log('[NotificationPreferences] Saving preferences:', payload)
      
      await apiFetch('/api/UserControllers/update-notification-preferences', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      alert('Preferences saved!')
      navigate('/notification-frequency')
    } catch (err) {
      console.error('[NotificationPreferences] Error:', err)
      alert('Failed to save preferences: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = () => {
    navigate('/member/articles')
  }

  const handleBack = () => {
    navigate('/select-topics')
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

      {/* Right Panel - Notification Preferences */}
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

        <h1 style={{ 
          fontSize: 32, 
          fontWeight: 700, 
          color: '#c92b2b',
          marginBottom: 16,
          marginTop: 0
        }}>
          Notification Preferences
        </h1>
        <p style={{ 
          fontSize: 14, 
          color: '#666',
          marginBottom: 40,
          lineHeight: 1.6
        }}>
          Select your preferred channels for receiving important updates from SinoStream
        </p>

        {/* Notification Channels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* WhatsApp */}
          <div style={{ 
            border: '1px solid #e0e0e0',
            borderRadius: 12,
            padding: 20,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16
          }}>
            <input 
              type="checkbox"
              checked={channels.whatsapp}
              onChange={() => handleChannelToggle('whatsapp')}
              style={{ 
                width: 20, 
                height: 20, 
                cursor: 'pointer',
                marginTop: 2
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 20 }}>💬</span>
                <span style={{ fontWeight: 600, fontSize: 15 }}>WhatsApp</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
                Real-time alerts and internal team communications.
              </p>
            </div>
          </div>

          {/* Email */}
          <div style={{ 
            border: '1px solid #e0e0e0',
            borderRadius: 12,
            padding: 20,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16
          }}>
            <input 
              type="checkbox"
              checked={channels.email}
              onChange={() => handleChannelToggle('email')}
              style={{ 
                width: 20, 
                height: 20, 
                cursor: 'pointer',
                marginTop: 2
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 20 }}>📧</span>
                <span style={{ fontWeight: 600, fontSize: 15 }}>Email</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
                Stay informed with detailed alerts in your inbox.
              </p>
            </div>
          </div>

          {/* SMS */}
          <div style={{ 
            border: '1px solid #e0e0e0',
            borderRadius: 12,
            padding: 20,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16
          }}>
            <input 
              type="checkbox"
              checked={channels.sms}
              onChange={() => handleChannelToggle('sms')}
              style={{ 
                width: 20, 
                height: 20, 
                cursor: 'pointer',
                marginTop: 2
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 20 }}>📱</span>
                <span style={{ fontWeight: 600, fontSize: 15 }}>SMS</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
                Quick alerts, even when you're offline
              </p>
            </div>
          </div>

          {/* In-App Notifications */}
          <div style={{ 
            border: '1px solid #e0e0e0',
            borderRadius: 12,
            padding: 20,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16
          }}>
            <input 
              type="checkbox"
              checked={channels.inApp}
              onChange={() => handleChannelToggle('inApp')}
              style={{ 
                width: 20, 
                height: 20, 
                cursor: 'pointer',
                marginTop: 2
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 20 }}>🔔</span>
                <span style={{ fontWeight: 600, fontSize: 15 }}>In-App Notifications</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
                Real-time updates while you work
              </p>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          marginTop: 40,
          gap: 12
        }}>
          <button
            onClick={handleBack}
            style={{
              padding: '12px 32px',
              background: 'white',
              color: '#c92b2b',
              border: '2px solid #c92b2b',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Back
          </button>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={handleSkip}
              style={{
                padding: '12px 32px',
                background: 'transparent',
                color: '#666',
                border: 'none',
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Skip for now
            </button>
            <button
              onClick={handleNext}
              disabled={loading}
              style={{
                padding: '12px 48px',
                background: '#c92b2b',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
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