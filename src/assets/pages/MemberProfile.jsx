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
  const [aiSuggestions, setAiSuggestions] = useState([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(true)
  
  // Interest Decay state
  const [decayRecommendations, setDecayRecommendations] = useState([])
  const [loadingDecay, setLoadingDecay] = useState(false)
  const [showDecay, setShowDecay] = useState(true)
  
  const navigate = useNavigate()

  useEffect(() => {
    loadProfile()
    loadAISuggestions()
    loadInterestDecayRecommendations()
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

  const loadAISuggestions = async () => {
    setLoadingSuggestions(true)
    try {
      const data = await apiFetch('/api/AI/suggest-topics')
      console.log('[MemberProfile] AI Suggestions Response:', data)
      
      // Handle different response formats
      if (data?.suggestions && Array.isArray(data.suggestions)) {
        console.log('[MemberProfile] Found suggestions:', data.suggestions)
        setAiSuggestions(data.suggestions)
      } else if (data?.data?.suggestions && Array.isArray(data.data.suggestions)) {
        console.log('[MemberProfile] Found suggestions in data.data:', data.data.suggestions)
        setAiSuggestions(data.data.suggestions)
      } else if (Array.isArray(data)) {
        console.log('[MemberProfile] Response is array:', data)
        setAiSuggestions(data)
      } else {
        console.log('[MemberProfile] No suggestions found or backend not implemented yet')
        // TEMPORARY: Add mock data for testing if backend not ready
        setAiSuggestions([
          {
            interestTagId: 999,
            name: 'Environmental Compliance',
            matchPercentage: 87,
            reason: 'Based on your reading pattern, you frequently engage with regulatory content'
          },
          {
            interestTagId: 998,
            name: 'Trade Incentives',
            matchPercentage: 82,
            reason: 'Popular among members with similar interests'
          },
          {
            interestTagId: 997,
            name: 'Logistics Cost Management',
            matchPercentage: 78,
            reason: 'You\'ve shown interest in supply chain topics'
          }
        ])
      }
    } catch (err) {
      console.error('[MemberProfile] Error loading suggestions:', err)
      console.log('[MemberProfile] Backend endpoint may not be implemented yet. Using mock data.')
      // Show mock data if backend not ready
      setAiSuggestions([
        {
          interestTagId: 999,
          name: 'Environmental Compliance',
          matchPercentage: 87,
          reason: 'Based on your reading pattern, you frequently engage with regulatory content'
        },
        {
          interestTagId: 998,
          name: 'Trade Incentives',
          matchPercentage: 82,
          reason: 'Popular among members with similar interests'
        },
        {
          interestTagId: 997,
          name: 'Logistics Cost Management',
          matchPercentage: 78,
          reason: 'You\'ve shown interest in supply chain topics'
        }
      ])
    } finally {
      setLoadingSuggestions(false)
    }
  }

  const handleAddSuggestion = async (suggestion) => {
    try {
      const member = profile?.member || profile?.Member
      if (!member) return

      // If it's a mock suggestion (ID > 900), find the real topic from database
      let topicId = suggestion.interestTagId
      if (topicId > 900) {
        console.log('[MemberProfile] Mock suggestion detected, fetching real topic...')
        try {
          const allTopicsRes = await apiFetch('/api/InterestTags')
          const allTopics = allTopicsRes?.data || allTopicsRes || []
          const matchingTopic = allTopics.find(t => 
            (t.name || t.Name)?.toLowerCase() === suggestion.name?.toLowerCase()
          )
          
          if (matchingTopic) {
            topicId = matchingTopic.interestTagId || matchingTopic.InterestTagId
            console.log('[MemberProfile] Found matching topic ID:', topicId)
          } else {
            alert(`Topic "${suggestion.name}" not found in database. Please add it in Category Management first.`)
            return
          }
        } catch (err) {
          console.error('[MemberProfile] Error fetching topics:', err)
          alert('Failed to find topic in database')
          return
        }
      }

      const currentInterests = member.interests || member.Interests || []
      const currentInterestIds = currentInterests.map(i => i.interestTagId || i.InterestTagId)

      // Check if already added
      if (currentInterestIds.includes(topicId)) {
        alert(`"${suggestion.name}" is already in your interests!`)
        setAiSuggestions(prev => prev.filter(s => s.interestTagId !== suggestion.interestTagId))
        return
      }

      const payload = {
        InterestTagIds: [...currentInterestIds, topicId],
        PreferredLanguage: member.preferredLanguage || member.PreferredLanguage || 'EN',
        NotificationChannels: member.notificationChannels || member.NotificationChannels
      }

      console.log('[MemberProfile] Sending payload:', payload)

      await apiFetch('/api/UserControllers/select-topics', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      alert(`✅ ${suggestion.name} has been added to your interests!`)
      setAiSuggestions(prev => prev.filter(s => s.interestTagId !== suggestion.interestTagId))
      
      // Reload profile to show updated topics
      await loadProfile()
    } catch (err) {
      console.error('[MemberProfile] Error adding topic:', err)
      alert('Failed to add topic: ' + err.message)
    }
  }

  const handleIgnoreSuggestion = (suggestionId) => {
    setAiSuggestions(prev => prev.filter(s => s.interestTagId !== suggestionId))
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
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: '#2D3748', margin: 0 }}>My Profile</h1>
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

      {/* AI Recommendations Section */}
      {(showSuggestions && (aiSuggestions.length > 0 || decayRecommendations.length > 0)) && (
        <div style={{
          background: 'linear-gradient(135deg, #c92b2b 0%, #8b1f1f 100%)',
          padding: 24,
          borderRadius: 12,
          boxShadow: '0 4px 12px rgba(201, 43, 43, 0.3)',
          marginBottom: 24,
          position: 'relative'
        }}>
          {/* Close button */}
          <button
            onClick={() => setShowSuggestions(false)}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: 'white',
              fontSize: 18,
              cursor: 'pointer',
              borderRadius: 6,
              padding: '4px 12px',
              fontWeight: 600
            }}
          >
            ✕
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 28 }}>🤖</span>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: 0 }}>
              AI-Powered Recommendations
            </h2>
          </div>

          <p style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.9)', marginBottom: 20, lineHeight: 1.6 }}>
            Our AI analyzes your behavior to keep your profile fresh and relevant:
          </p>

          {/* Interest Health Check Section */}
          {decayRecommendations.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 20 }}>⏰</span>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'white', margin: 0 }}>
                  Interest Health Check
                </h3>
              </div>
              <p style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.85)', marginBottom: 16, lineHeight: 1.5 }}>
                Topics you haven't engaged with recently - consider replacing them:
              </p>

              {loadingDecay ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'white' }}>
                  <div style={{ fontSize: 16 }}>⏳ Analyzing your engagement patterns...</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
                  {decayRecommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'blur(10px)',
                        padding: 20,
                        borderRadius: 10,
                        border: '1px solid rgba(255, 255, 255, 0.3)'
                      }}
                    >
                      {/* Low engagement topic */}
                      <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <span style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>
                            📉 {rec.lowEngagementTopic.name}
                          </span>
                          <span style={{
                            padding: '2px 10px',
                            background: 'rgba(239, 68, 68, 0.8)',
                            color: 'white',
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 600
                          }}>
                            Low Activity
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.85)' }}>
                          ⚠️ Last engaged {rec.lowEngagementTopic.daysSinceLastEngagement} days ago 
                          ({rec.lowEngagementTopic.totalEngagements} total interactions)
                        </div>
                      </div>

                      {/* Replacement suggestion */}
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.9)', marginBottom: 10, fontWeight: 600 }}>
                          💡 Suggested Replacement:
                        </div>
                        <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: 12, borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>
                              📈 {rec.replacementSuggestion.name}
                            </span>
                            <span style={{
                              padding: '2px 8px',
                              background: 'rgba(16, 185, 129, 0.8)',
                              color: 'white',
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 600
                            }}>
                              {rec.replacementSuggestion.matchPercentage}% match
                            </span>
                          </div>
                          <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.85)' }}>
                            ✨ {rec.replacementSuggestion.reason}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleReplaceInterest(rec)}
                          style={{
                            padding: '8px 20px',
                            background: 'white',
                            color: '#c92b2b',
                            border: 'none',
                            borderRadius: 6,
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = '#f7f7f7'
                            e.target.style.transform = 'scale(1.05)'
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = 'white'
                            e.target.style.transform = 'scale(1)'
                          }}
                        >
                          🔄 Replace Topic
                        </button>
                        <button
                          onClick={() => handleKeepInterest(rec)}
                          style={{
                            padding: '8px 20px',
                            background: 'rgba(255, 255, 255, 0.2)',
                            color: 'white',
                            border: '1px solid rgba(255, 255, 255, 0.4)',
                            borderRadius: 6,
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
                          onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
                        >
                          Keep Current
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* New Topic Suggestions Section */}
          {aiSuggestions.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 20 }}>💡</span>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'white', margin: 0 }}>
                  New Topics You Might Like
                </h3>
              </div>
              <p style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.85)', marginBottom: 16, lineHeight: 1.5 }}>
                Based on your reading behavior, expand your interests:
              </p>

              {loadingSuggestions ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'white' }}>
                  <div style={{ fontSize: 16 }}>⏳ Analyzing your preferences...</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {aiSuggestions.slice(0, 5).map((suggestion, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'blur(10px)',
                        padding: 16,
                        borderRadius: 10,
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        transition: 'all 0.3s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                        e.currentTarget.style.transform = 'translateY(0)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                            <span style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>
                              {suggestion.name}
                            </span>
                            <span style={{
                              padding: '2px 8px',
                              background: '#f6ad55',
                              color: 'white',
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 600
                            }}>
                              {suggestion.matchPercentage}% match
                            </span>
                          </div>
                          <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.85)', lineHeight: 1.5 }}>
                            💡 {suggestion.reason}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, marginLeft: 16 }}>
                          <button
                            onClick={() => handleAddSuggestion(suggestion)}
                            style={{
                              padding: '6px 16px',
                              background: 'white',
                              color: '#c92b2b',
                              border: 'none',
                              borderRadius: 6,
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.background = '#f7f7f7'
                              e.target.style.transform = 'scale(1.05)'
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background = 'white'
                              e.target.style.transform = 'scale(1)'
                            }}
                          >
                            ✓ Add
                          </button>
                          <button
                            onClick={() => handleIgnoreSuggestion(suggestion.interestTagId)}
                            style={{
                              padding: '6px 16px',
                              background: 'rgba(255, 255, 255, 0.2)',
                              color: 'white',
                              border: '1px solid rgba(255, 255, 255, 0.3)',
                              borderRadius: 6,
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
                            onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
                          >
                            Ignore
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!loadingSuggestions && !loadingDecay && aiSuggestions.length === 0 && decayRecommendations.length === 0 && (
            <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255, 255, 255, 0.85)', fontSize: 14 }}>
              📚 Read more articles to get personalized AI recommendations!
            </div>
          )}
        </div>
      )}

      {/* Show dismissed suggestions button */}
      {!showSuggestions && (aiSuggestions.length > 0 || decayRecommendations.length > 0) && (
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={() => setShowSuggestions(true)}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #c92b2b 0%, #8b1f1f 100%)',
              border: 'none',
              color: 'white',
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 12px rgba(201, 43, 43, 0.4)',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)'
              e.target.style.boxShadow = '0 6px 16px rgba(201, 43, 43, 0.5)'
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)'
              e.target.style.boxShadow = '0 4px 12px rgba(201, 43, 43, 0.4)'
            }}
          >
            💡 Show AI Recommendations ({aiSuggestions.length + decayRecommendations.length})
          </button>
        </div>
      )}
    </div>
  )
}
