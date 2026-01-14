import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || ''

const apiFetch = async (path, opts = {}) => {
  const token = localStorage.getItem('token')
  const headers = { 'Content-Type': 'application/json', ...opts.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const fullPath = path.startsWith('http') ? path : `${API_BASE.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
  
  const res = await fetch(fullPath, { ...opts, headers })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export default function MemberProfile() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/api/UserControllers/me')
      console.log('[MemberProfile] Profile data:', data)
      setProfile(data)
    } catch (err) {
      console.error('[MemberProfile] Error:', err)
      alert('Failed to load profile: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ textAlign: 'center', fontSize: 18, color: '#666' }}>Loading profile...</div>
      </div>
    )
  }

  if (!profile?.member && !profile?.Member) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ textAlign: 'center', fontSize: 18, color: '#666' }}>No profile data found</div>
      </div>
    )
  }

  const member = profile.member || profile.Member
  const interests = member?.interests || member?.Interests || []
  const channels = member?.notificationChannels || member?.NotificationChannels || ''
  const frequency = member?.notificationFrequency || member?.NotificationFrequency || ''
  const language = member?.preferredLanguage || member?.PreferredLanguage || 'EN'

  // Parse notification channels
  const channelList = channels ? channels.split(',').map(c => c.trim()) : []
  const channelIcons = {
    whatsapp: '💬',
    email: '📧',
    sms: '📱',
    inApp: '🔔',
    'in-app': '🔔'
  }

  // Parse frequency
  const frequencyDisplay = {
    immediate: '⚡ Immediate',
    daily: '📅 Daily Digest',
    weekly: '📊 Weekly Digest'
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: '#2D3748', margin: 0 }}>My Profile</h1>
        <button
          onClick={() => navigate('/select-topics')}
          style={{
            padding: '8px 16px',
            background: 'white',
            border: '2px solid #E53E3E',
            color: '#E53E3E',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          ✏️ Edit All Preferences
        </button>
      </div>

      <div style={{ height: 1, background: '#E2E8F0', marginBottom: 32 }} />

      {/* Account Information */}
      <div style={{ background: 'white', padding: 24, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#2D3748', marginBottom: 20 }}>Account Information</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex' }}>
            <div style={{ width: 180, fontWeight: 600, color: '#4A5568' }}>Name:</div>
            <div style={{ color: '#2D3748' }}>{profile.name || member?.contactPerson || '-'}</div>
          </div>
          <div style={{ display: 'flex' }}>
            <div style={{ width: 180, fontWeight: 600, color: '#4A5568' }}>Email:</div>
            <div style={{ color: '#2D3748' }}>{profile.email || member?.email || '-'}</div>
          </div>
          <div style={{ display: 'flex' }}>
            <div style={{ width: 180, fontWeight: 600, color: '#4A5568' }}>Company:</div>
            <div style={{ color: '#2D3748' }}>{member?.companyName || '-'}</div>
          </div>
          <div style={{ display: 'flex' }}>
            <div style={{ width: 180, fontWeight: 600, color: '#4A5568' }}>Country:</div>
            <div style={{ color: '#2D3748' }}>{member?.country || '-'}</div>
          </div>
          <div style={{ display: 'flex' }}>
            <div style={{ width: 180, fontWeight: 600, color: '#4A5568' }}>Membership Type:</div>
            <div style={{ color: '#2D3748' }}>{member?.membershipType || '-'}</div>
          </div>
        </div>
      </div>

      {/* Language & Topics */}
      <div style={{ background: '#F7FAFC', padding: 24, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#2D3748', margin: 0 }}>LANGUAGE & TOPICS</h2>
          <button
            onClick={() => navigate('/select-topics')}
            style={{
              padding: '6px 12px',
              background: 'transparent',
              border: 'none',
              color: '#E53E3E',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            ✏️ Edit
          </button>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: '#718096', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>
            Preferred Language
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🌐</span>
            <span style={{ fontWeight: 500, color: '#2D3748' }}>
              {language === 'EN' ? 'English' : language === 'ZH' ? '中文' : language}
            </span>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, color: '#718096', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>
            Topics of Interest
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {interests.length > 0 ? (
              interests.map((topic, idx) => (
                <span
                  key={idx}
                  style={{
                    padding: '6px 16px',
                    background: '#FED7D7',
                    color: '#C53030',
                    borderRadius: 20,
                    fontSize: 14,
                    fontWeight: 500,
                    border: '1px solid #FC8181'
                  }}
                >
                  {topic.name || topic.Name}
                </span>
              ))
            ) : (
              <span style={{ color: '#A0AEC0', fontStyle: 'italic' }}>No topics selected</span>
            )}
          </div>
        </div>
      </div>

      {/* Notification Preferences */}
      <div style={{ background: '#F7FAFC', padding: 24, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#2D3748', margin: 0 }}>NOTIFICATION PREFERENCES</h2>
          <button
            onClick={() => navigate('/notification-preferences')}
            style={{
              padding: '6px 12px',
              background: 'transparent',
              border: 'none',
              color: '#3182CE',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            ✏️ Edit
          </button>
        </div>

        <div>
          <div style={{ fontSize: 12, color: '#718096', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>
            Notification Channels
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {channelList.length > 0 ? (
              channelList.map((channel, idx) => {
                const channelKey = channel.toLowerCase()
                const icon = channelIcons[channelKey] || '📢'
                const displayName = channel === 'inApp' || channel === 'in-app' 
                  ? 'In-App' 
                  : channel.charAt(0).toUpperCase() + channel.slice(1)
                
                return (
                  <span
                    key={idx}
                    style={{
                      padding: '6px 16px',
                      background: '#BEE3F8',
                      color: '#2C5282',
                      borderRadius: 20,
                      fontSize: 14,
                      fontWeight: 500,
                      border: '1px solid #90CDF4'
                    }}
                  >
                    {icon} {displayName}
                  </span>
                )
              })
            ) : (
              <span style={{ color: '#A0AEC0', fontStyle: 'italic' }}>No notification preferences set</span>
            )}
          </div>
        </div>
      </div>

      {/* Notification Frequency */}
      <div style={{ background: '#F7FAFC', padding: 24, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#2D3748', margin: 0 }}>NOTIFICATION FREQUENCY</h2>
          <button
            onClick={() => navigate('/notification-frequency')}
            style={{
              padding: '6px 12px',
              background: 'transparent',
              border: 'none',
              color: '#805AD5',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            ✏️ Edit
          </button>
        </div>

        <div>
          <div style={{ fontSize: 12, color: '#718096', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>
            Frequency
          </div>
          {frequency ? (
            <span
              style={{
                padding: '6px 16px',
                background: '#E9D8FD',
                color: '#553C9A',
                borderRadius: 20,
                fontSize: 14,
                fontWeight: 500,
                border: '1px solid #D6BCFA',
                display: 'inline-block'
              }}
            >
              {frequencyDisplay[frequency] || frequency}
            </span>
          ) : (
            <span style={{ color: '#A0AEC0', fontStyle: 'italic' }}>No frequency set</span>
          )}
        </div>
      </div>
    </div>
  )
}
