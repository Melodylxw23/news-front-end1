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
  // AI recommendations removed per request
  const [pendingInterests, setPendingInterests] = useState([])
  const [selectedIndustry, setSelectedIndustry] = useState(null)
  
  // Interest Decay state (unused when AI removed)
  const [decayRecommendations, setDecayRecommendations] = useState([])
  const [loadingDecay, setLoadingDecay] = useState(false)
  const [showDecay, setShowDecay] = useState(true)
  
  const navigate = useNavigate()

  useEffect(() => {
    // Load industry from localStorage (saved during registration)
    const loadIndustry = async () => {
      try {
        const industryId = localStorage.getItem('selectedIndustryTagId')
        if (industryId) {
          // Fetch industry tags to get the name
          const res = await apiFetch('/api/IndustryTags')
          const list = res?.data || res || []
          const found = list.find(ind => 
            (ind.industryTagId ?? ind.IndustryTagId) == industryId
          )
          if (found) {
            setSelectedIndustry(found.nameEN ?? found.NameEN)
          }
        }
      } catch (err) {
        console.error('[MemberProfile] Error loading industry:', err)
      }
    }
    
    loadIndustry()
    loadProfile()
    // AI suggestion loading removed
  }, [])

  const parseStoredJson = (key) => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : null
    } catch (e) {
      console.error(`[MemberProfile] Failed to parse ${key}:`, e)
      return null
    }
  }

  useEffect(() => {
    const member = profile?.member || profile?.Member
    const currentInterests = member?.interests || member?.Interests || []
    if (currentInterests.length > 0) return

    const pending = parseStoredJson('pendingTopicSelections')
    const pendingIds = pending?.InterestTagIds || []
    if (!pendingIds.length) return

    let cancelled = false
    const loadPendingInterests = async () => {
      try {
        const res = await apiFetch('/api/InterestTags')
        const list = res?.data || res || []
        const nameById = new Map(
          list.map(t => [
            t.interestTagId ?? t.InterestTagId,
            t.nameEN ?? t.NameEN ?? t.name ?? t.Name
          ])
        )
        const mapped = pendingIds.map(id => ({
          interestTagId: id,
          name: nameById.get(id) || `Topic ${id}`
        }))
        if (!cancelled) setPendingInterests(mapped)
      } catch (err) {
        console.error('[MemberProfile] Error loading pending interests:', err)
      }
    }

    loadPendingInterests()
    return () => { cancelled = true }
  }, [profile])

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

  

  // Load interest decay recommendations with mock data
  const loadInterestDecayRecommendations = async () => {
    setLoadingDecay(true)
    try {
      // For demo purposes, always show mock data
      console.log('[MemberProfile] Loading Interest Decay recommendations (mock data for demo)')
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800))
      
      setDecayRecommendations([
        {
          lowEngagementTopic: {
            interestTagId: 1,
            name: 'Digital Transformation',
            daysSinceLastEngagement: 120,
            totalEngagements: 2
          },
          replacementSuggestion: {
            interestTagId: 996,
            name: 'Supply Chain Automation',
            matchPercentage: 89,
            reason: 'This topic aligns better with your recent reading patterns'
          }
        },
        {
          lowEngagementTopic: {
            interestTagId: 2,
            name: 'Blockchain Technology',
            daysSinceLastEngagement: 95,
            totalEngagements: 1
          },
          replacementSuggestion: {
            interestTagId: 995,
            name: 'FinTech Innovations',
            matchPercentage: 84,
            reason: 'Trending among members with similar profiles'
          }
        }
      ])
    } catch (err) {
      console.error('[MemberProfile] Error loading decay recommendations:', err)
    } finally {
      setLoadingDecay(false)
    }
  }

  // Handle replacement of low-engagement topic with suggested topic
  const handleReplaceInterest = async (recommendation) => {
    try {
      const member = profile?.member || profile?.Member
      if (!member) return

      const currentInterests = member.interests || member.Interests || []
      const currentInterestIds = currentInterests.map(i => i.interestTagId || i.InterestTagId)

      // Fetch all topics from database to get real IDs
      let allTopics = []
      try {
        const allTopicsRes = await apiFetch('/api/InterestTags')
        allTopics = allTopicsRes?.data || allTopicsRes || []
      } catch (err) {
        console.error('[MemberProfile] Error fetching topics:', err)
        alert('Failed to fetch topics from database')
        return
      }

      // Find the real ID of the old topic to remove (by name match)
      let oldTopicId = recommendation.lowEngagementTopic.interestTagId
      const oldTopicMatch = allTopics.find(t => 
        (t.name || t.Name)?.toLowerCase() === recommendation.lowEngagementTopic.name?.toLowerCase()
      )
      if (oldTopicMatch) {
        oldTopicId = oldTopicMatch.interestTagId || oldTopicMatch.InterestTagId
        console.log('[MemberProfile] Found old topic ID to remove:', oldTopicId, 'for', recommendation.lowEngagementTopic.name)
      }

      // Remove old topic
      const newInterestIds = currentInterestIds.filter(id => id !== oldTopicId)
      
      // Get real ID for the new topic (replacement suggestion)
      let newTopicId = recommendation.replacementSuggestion.interestTagId
      if (newTopicId > 900) {
        // It's a mock ID, find the real one
        console.log('[MemberProfile] Mock replacement detected, finding real topic...')
        const matchingTopic = allTopics.find(t => 
          (t.name || t.Name)?.toLowerCase() === recommendation.replacementSuggestion.name?.toLowerCase()
        )
        
        if (matchingTopic) {
          newTopicId = matchingTopic.interestTagId || matchingTopic.InterestTagId
          console.log('[MemberProfile] Found matching topic ID:', newTopicId)
        } else {
          alert(`Topic "${recommendation.replacementSuggestion.name}" not found in database. Please add it in Category Management first.`)
          return
        }
      }

      newInterestIds.push(newTopicId)

      const payload = {
        InterestTagIds: newInterestIds,
        PreferredLanguage: member.preferredLanguage || member.PreferredLanguage || 'EN',
        NotificationChannels: member.notificationChannels || member.NotificationChannels
      }

      await apiFetch('/api/UserControllers/select-topics', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      alert(`✅ Replaced "${recommendation.lowEngagementTopic.name}" with "${recommendation.replacementSuggestion.name}"!`)
      
      // Remove from recommendations
      setDecayRecommendations(prev => prev.filter(r => 
        r.lowEngagementTopic.interestTagId !== recommendation.lowEngagementTopic.interestTagId
      ))
      
      // Reload profile
      await loadProfile()
    } catch (err) {
      console.error('[MemberProfile] Error replacing topic:', err)
      alert('Failed to replace topic: ' + err.message)
    }
  }

  // Keep the current low-engagement topic
  const handleKeepInterest = (recommendation) => {
    setDecayRecommendations(prev => prev.filter(r => 
      r.lowEngagementTopic.interestTagId !== recommendation.lowEngagementTopic.interestTagId
    ))
    alert(`✓ Keeping "${recommendation.lowEngagementTopic.name}" in your interests`)
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

  const pendingTopicSelections = parseStoredJson('pendingTopicSelections')
  const pendingNotificationPreferences = parseStoredJson('pendingNotificationPreferences')
  const pendingNotificationFrequency = parseStoredJson('pendingNotificationFrequency')

  const displayInterests = interests.length > 0 ? interests : pendingInterests
  const channels = (member?.notificationChannels || member?.NotificationChannels || pendingNotificationPreferences?.NotificationChannels || '')
  const frequency = (member?.notificationFrequency || member?.NotificationFrequency || pendingNotificationFrequency?.NotificationFrequency || '')
  const language = (member?.preferredLanguage || member?.PreferredLanguage || pendingTopicSelections?.PreferredLanguage || 'EN')

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
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 84, height: 84, borderRadius: 12, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              {profile?.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile?.name || (profile?.member || profile?.Member)?.contactPerson || 'Profile'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <rect width="24" height="24" rx="4" fill="#F1F5F9" />
                  <path d="M12 12c1.933 0 3.5-1.567 3.5-3.5S13.933 5 12 5 8.5 6.567 8.5 8.5 10.067 12 12 12z" fill="#4A5568" />
                  <path d="M4 19c0-2.761 3.589-5 8-5s8 2.239 8 5v1H4v-1z" fill="#4A5568" />
                </svg>
              )}
            </div>

            <h1 style={{ fontSize: 36, fontWeight: 800, color: '#2D3748', margin: 0 }}>{profile?.name || (profile?.member || profile?.Member)?.contactPerson || (profile?.member || profile?.Member)?.userName || 'Member'}</h1>
          </div>

          <div>
            <button
              onClick={() => navigate('/member/saved-articles')}
              style={{
                padding: '10px 14px',
                background: '#b91c1c',
                border: 'none',
                color: 'white',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 700,
                boxShadow: '0 2px 8px rgba(185,28,28,0.2)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.03)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
            >
              📌 View Saved Articles
            </button>
          </div>
        </div>
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
            <div style={{ width: 180, fontWeight: 600, color: '#4A5568' }}>Industry:</div>
            <div style={{ color: '#2D3748' }}>
              {(() => {
                const industryTags = member?.industryTags || member?.IndustryTags || []
                if (Array.isArray(industryTags) && industryTags.length > 0) {
                  return industryTags.map(tag => tag.nameEN || tag.NameEN || tag.name || tag.Name).filter(Boolean).join(', ')
                }
                return selectedIndustry || member?.industry || member?.Industry || '-'
              })()}
            </div>
          </div>
          <div style={{ display: 'flex' }}>
            <div style={{ width: 180, fontWeight: 600, color: '#4A5568' }}>Membership Type:</div>
            <div style={{ color: '#2D3748' }}>{member?.membershipType || '-'}</div>
          </div>
        </div>
      </div>

      {/* Preferences - Combined Box */}
      <div style={{ background: '#F7FAFC', padding: 24, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#2D3748', margin: 0 }}>PREFERENCES</h2>
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

        {/* Language Section */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, color: '#2D3748', fontWeight: 700, textTransform: 'uppercase', marginBottom: 12, letterSpacing: '0.5px' }}>
            Preferred Language
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🌐</span>
            <span style={{ fontWeight: 500, color: '#2D3748' }}>
              {language === 'EN' ? 'English' : language === 'ZH' ? '中文' : language}
            </span>
          </div>
        </div>

        {/* Topics Section */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, color: '#2D3748', fontWeight: 700, textTransform: 'uppercase', marginBottom: 12, letterSpacing: '0.5px' }}>
            Topics of Interest
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {displayInterests.length > 0 ? (
              displayInterests.map((topic, idx) => (
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
                  {topic.name || topic.Name || topic.nameEN || topic.NameEN}
                </span>
              ))
            ) : (
              <span style={{ color: '#A0AEC0', fontStyle: 'italic' }}>No topics selected</span>
            )}
          </div>
        </div>

        {/* Notification Channels Section */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, color: '#2D3748', fontWeight: 700, textTransform: 'uppercase', marginBottom: 12, letterSpacing: '0.5px' }}>
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

        {/* Notification Frequency Section */}
        <div>
          <div style={{ fontSize: 14, color: '#2D3748', fontWeight: 700, textTransform: 'uppercase', marginBottom: 12, letterSpacing: '0.5px' }}>
            Notification Frequency
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
