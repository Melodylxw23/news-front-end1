import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || ''

const apiFetch = async (path, opts = {}) => {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {})
  const fullPath = path.startsWith('http') ? path : `${API_BASE.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`

  const fetchOpts = Object.assign({}, opts, { headers })
  const res = await fetch(fullPath, fetchOpts)
  const text = await res.text().catch(() => '')
  if (!res.ok) {
    const errorMsg = `HTTP ${res.status} ${res.statusText}${text ? ': ' + text : ''}`
    throw new Error(errorMsg)
  }
  try { return text ? JSON.parse(text) : null } catch (e) { return text }
}

export default function NotificationFrequency({ onComplete }) {
  const navigate = useNavigate()
  const [language, setLanguage] = useState('English')
  const [frequency, setFrequency] = useState('weekly') // 'immediate', 'daily', 'weekly'
  const [notificationLanguage, setNotificationLanguage] = useState('English')
  const [applyToAll, setApplyToAll] = useState(true)
  const [loading, setLoading] = useState(false)

  const handleNext = async () => {
    setLoading(true)
    try {
      const frequencyPreferences = {
        NotificationFrequency: frequency,
        NotificationLanguage: notificationLanguage === 'Chinese' ? 'ZH' : 'EN',
        ApplyToAllTopics: applyToAll
      }

      console.log('[NotificationFrequency] Storing preferences:', frequencyPreferences)
      
      // Store in localStorage for registration process
      localStorage.setItem('pendingNotificationFrequency', JSON.stringify(frequencyPreferences))

      // Call the onComplete callback if provided (from PreferencesSetup)
      if (onComplete) {
        onComplete()
      } else {
        // Fallback for standalone usage
        alert('All preferences saved!')
        navigate('/landing')
      }
    } catch (err) {
      console.error('[NotificationFrequency] Error:', err)
      alert('Failed to save frequency: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = () => {
    navigate('/landing')
  }

  const handleBack = () => {
    navigate('/notification-preferences')
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

      {/* Right Panel - Notification Frequency */}
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
          Notification Frequency
        </h1>
        <p style={{ 
          fontSize: 14, 
          color: '#666',
          marginBottom: 40,
          lineHeight: 1.6
        }}>
          Choose how often you want to receive notifications
        </p>

        {/* Frequency Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 40 }}>
          {/* Immediate */}
          <div 
            onClick={() => setFrequency('immediate')}
            style={{ 
              border: frequency === 'immediate' ? '2px solid #4169E1' : '1px solid #e0e0e0',
              borderRadius: 12,
              padding: 20,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 16,
              transition: 'all 0.2s'
            }}
          >
            <input 
              type="radio"
              checked={frequency === 'immediate'}
              onChange={() => setFrequency('immediate')}
              style={{ 
                width: 20, 
                height: 20, 
                cursor: 'pointer',
                marginTop: 2,
                accentColor: '#4169E1'
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                Immediate
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
                Receive notifications in real-time as events occur
              </p>
            </div>
          </div>

          {/* Daily Digest */}
          <div 
            onClick={() => setFrequency('daily')}
            style={{ 
              border: frequency === 'daily' ? '2px solid #4169E1' : '1px solid #e0e0e0',
              borderRadius: 12,
              padding: 20,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 16,
              transition: 'all 0.2s'
            }}
          >
            <input 
              type="radio"
              checked={frequency === 'daily'}
              onChange={() => setFrequency('daily')}
              style={{ 
                width: 20, 
                height: 20, 
                cursor: 'pointer',
                marginTop: 2,
                accentColor: '#4169E1'
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                Daily Digest
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
                Get a consolidated summary of all activities once per day
              </p>
            </div>
          </div>

          {/* Weekly Digest */}
          <div 
            onClick={() => setFrequency('weekly')}
            style={{ 
              border: frequency === 'weekly' ? '2px solid #4169E1' : '1px solid #e0e0e0',
              borderRadius: 12,
              padding: 20,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 16,
              transition: 'all 0.2s'
            }}
          >
            <input 
              type="radio"
              checked={frequency === 'weekly'}
              onChange={() => setFrequency('weekly')}
              style={{ 
                width: 20, 
                height: 20, 
                cursor: 'pointer',
                marginTop: 2,
                accentColor: '#4169E1'
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                Weekly Digest
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
                Receive a weekly summary of key updates and activities
              </p>
            </div>
          </div>
        </div>

        {/* Settings */}
        <div style={{ 
          background: '#f8f9fa',
          borderRadius: 12,
          padding: 24,
          marginBottom: 40
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

          {/* Notification Language */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ 
              display: 'block', 
              fontSize: 13, 
              color: '#666',
              marginBottom: 8,
              fontWeight: 500
            }}>
              Preferred Notification Language
            </label>
            <select 
              value={notificationLanguage}
              onChange={(e) => setNotificationLanguage(e.target.value)}
              style={{ 
                width: '100%',
                padding: '10px 16px',
                border: '1px solid #ddd',
                borderRadius: 8,
                fontSize: 14,
                cursor: 'pointer'
              }}
            >
              <option value="English">English</option>
              <option value="Chinese">中文</option>
            </select>
          </div>

          {/* Apply to All Topics */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <label style={{ 
              fontSize: 13, 
              color: '#666',
              fontWeight: 500
            }}>
              Apply to all my subscribed topics
            </label>
            <label style={{ 
              position: 'relative',
              display: 'inline-block',
              width: 48,
              height: 24
            }}>
              <input 
                type="checkbox"
                checked={applyToAll}
                onChange={(e) => setApplyToAll(e.target.checked)}
                style={{ 
                  opacity: 0,
                  width: 0,
                  height: 0
                }}
              />
              <span style={{
                position: 'absolute',
                cursor: 'pointer',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: applyToAll ? '#c92b2b' : '#ccc',
                transition: '0.4s',
                borderRadius: 24
              }}>
                <span style={{
                  position: 'absolute',
                  content: '""',
                  height: 18,
                  width: 18,
                  left: applyToAll ? 26 : 3,
                  bottom: 3,
                  background: 'white',
                  transition: '0.4s',
                  borderRadius: '50%'
                }} />
              </span>
            </label>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          marginTop: 'auto',
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
