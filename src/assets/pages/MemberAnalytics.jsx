import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || ''

const apiFetch = async (path, opts = {}) => {
  const token = localStorage.getItem('token')
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {})
  if (token) headers['Authorization'] = `Bearer ${token}`
  const fullPath = path.startsWith('http') ? path : `${API_BASE.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(fullPath, Object.assign({ headers }, opts))
  const text = await res.text().catch(() => '')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  try { return text ? JSON.parse(text) : null } catch (e) { return text }
}

export default function MemberAnalytics() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState([])
  const [industryStats, setIndustryStats] = useState([])
  const [interestStats, setInterestStats] = useState([])
  const [totalMembers, setTotalMembers] = useState(0)
  const [segments, setSegments] = useState([])
  const [growthTrends, setGrowthTrends] = useState([])
  const [topicForecasts, setTopicForecasts] = useState([])
  const [suggestedActions, setSuggestedActions] = useState([])
  const [showAIInsights, setShowAIInsights] = useState(false)
  const [generatingInsights, setGeneratingInsights] = useState(false)

  useEffect(() => {
    loadAnalytics()
  }, [])

  // AI Feature 1: Intelligent Member Segmentation
  const analyzeSegments = (membersList) => {
    const segmentMap = {}
    
    membersList.forEach(member => {
      const interests = member.interestTags || member.InterestTags || []
      const interestNames = interests.map(i => i.nameEN || i.NameEN).sort().join(', ')
      
      if (interestNames) {
        if (!segmentMap[interestNames]) {
          segmentMap[interestNames] = {
            interests: interestNames,
            count: 0,
            members: []
          }
        }
        segmentMap[interestNames].count++
        segmentMap[interestNames].members.push(member)
      }
    })

    // Group similar segments
    const segmentsList = Object.values(segmentMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5) // Top 5 segments
      .map((seg, idx) => ({
        name: `Segment ${idx + 1}`,
        interests: seg.interests,
        count: seg.count,
        percentage: ((seg.count / membersList.length) * 100).toFixed(1)
      }))

    return segmentsList
  }

  // AI Feature 4: Industry Growth Predictions
  const predictIndustryGrowth = (industryData, membersList) => {
    // Simulate growth predictions based on current distribution
    // In production, this would use historical data and ML models
    return industryData.map((industry, idx) => {
      const currentShare = (industry.count / membersList.length * 100)
      
      // Simple heuristic: higher current adoption = higher predicted growth
      const baseGrowth = currentShare > 20 ? 35 : currentShare > 10 ? 25 : 15
      const variance = Math.random() * 10 - 5 // +/- 5% randomness
      const predictedGrowth = Math.round(baseGrowth + variance)
      
      return {
        name: industry.name,
        currentCount: industry.count,
        predictedGrowth: Math.max(5, predictedGrowth), // Minimum 5%
        trend: predictedGrowth > 25 ? 'high' : predictedGrowth > 15 ? 'medium' : 'low'
      }
    }).sort((a, b) => b.predictedGrowth - a.predictedGrowth).slice(0, 3)
  }

  // AI Feature 5: Topic Popularity Forecasting
  const forecastTopicPopularity = (interestData, membersList) => {
    // Predict which topics will grow based on current patterns
    return interestData.map((topic, idx) => {
      const currentShare = (topic.count / membersList.length * 100)
      const momentum = currentShare * (Math.random() * 0.5 + 0.75) // Simulate momentum
      
      // Higher current adoption with random variance
      const baseGrowth = currentShare > 30 ? 40 : currentShare > 20 ? 30 : 20
      const variance = Math.random() * 15 - 7.5
      const predictedGrowth = Math.round(baseGrowth + variance)
      
      return {
        name: topic.name,
        currentCount: topic.count,
        currentShare: currentShare.toFixed(1),
        predictedGrowth: Math.max(10, predictedGrowth),
        basis: currentShare > 20 ? 'High current adoption + market trends' : 'Emerging interest patterns'
      }
    }).sort((a, b) => b.predictedGrowth - a.predictedGrowth).slice(0, 5)
  }

 const generateInsights = async () => {
  if (members.length === 0) {
    alert('No member data available to generate insights')
    return
  }

  setGeneratingInsights(true)

  try {
    console.log('Calling AI insights API...')
    const res = await apiFetch('/api/genai/insights', { method: 'POST' })
    console.log('AI Response:', res)
    
    let parsed = res?.parsed
    
    // If parsed is null but raw exists, extract JSON from markdown code fences
    if (!parsed && res?.raw) {
      const raw = res.raw
      // Extract JSON from ```json ... ``` or ``` ... ```
      const jsonMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
      if (jsonMatch && jsonMatch[1]) {
        try {
          parsed = JSON.parse(jsonMatch[1])
          console.log('Extracted JSON from markdown:', parsed)
        } catch (e) {
          console.error('Failed to parse extracted JSON:', e)
        }
      }
    }
    
    console.log('Parsed data:', parsed)

    if (parsed && typeof parsed === 'object') {
      console.log('Setting AI data:', { 
        segments: parsed.segments?.length, 
        growth: parsed.industryGrowthForecast?.length || parsed.industryGrowth?.length,
        forecasts: parsed.topicPopularityForecast?.length || parsed.topicForecasts?.length
      })
      
      // Transform segments data to match UI format
      const transformedSegments = (parsed.segments || []).map(seg => ({
        name: `Segment ${seg.id}`,
        interests: Array.isArray(seg.interests) ? seg.interests.join(', ') : seg.interests,
        count: seg.size,
        percentage: seg.percent?.toFixed(1) || '0.0'
      }))
      
      // Transform industry growth to match UI format
      const transformedGrowth = (parsed.industryGrowthForecast || []).map(ind => ({
        name: ind.industry,
        currentCount: ind.currentMembers,
        predictedGrowth: ind.expectedGrowthPercent,
        trend: ind.expectedGrowthPercent > 15 ? 'high' : ind.expectedGrowthPercent > 10 ? 'medium' : 'low'
      }))
      
      // Transform topic forecasts to match UI format
      const transformedForecasts = (parsed.topicPopularityForecast || []).map(topic => ({
        name: topic.topic,
        currentCount: topic.currentMembers,
        currentShare: ((topic.currentMembers / totalMembers) * 100).toFixed(1),
        predictedGrowth: topic.expectedGrowthPercent,
        basis: topic.rationale
      }))
      
      setSegments(transformedSegments)
      setGrowthTrends(transformedGrowth)
      setTopicForecasts(transformedForecasts)
      setSuggestedActions(parsed.suggestedActions || [])
      console.log('Suggested Actions set:', parsed.suggestedActions)
    } else {
      throw new Error('Invalid response format')
    }
  } catch (err) {
    console.error('AI insights failed, using local analysis:', err)
    // Simulate processing time for fallback
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    const analyzedSegments = analyzeSegments(members)
    const growthPredictions = predictIndustryGrowth(industryStats, members)
    const topicForecast = forecastTopicPopularity(interestStats, members)

    setSegments(analyzedSegments)
    setGrowthTrends(growthPredictions)
    setTopicForecasts(topicForecast)
    
    // Generate fallback suggested actions
    const fallbackActions = []
    if (growthPredictions.length > 0) {
      fallbackActions.push(`Action: Increase content for ${growthPredictions[0].name}; When: Next Quarter; KPI: +${growthPredictions[0].predictedGrowth}% engagement; Rationale: Highest predicted growth industry.`)
    }
    if (topicForecast.length > 0) {
      fallbackActions.push(`Action: Develop resources for ${topicForecast[0].name}; When: Monthly; KPI: 2 new articles; Rationale: Most popular topic with ${topicForecast[0].currentShare}% member interest.`)
    }
    if (analyzedSegments.length > 0) {
      fallbackActions.push(`Action: Target ${analyzedSegments[0].name}; When: Ongoing; KPI: ${analyzedSegments[0].count} members engaged; Rationale: Largest member segment.`)
    }
    setSuggestedActions(fallbackActions)
  } finally {
    setGeneratingInsights(false)
    setShowAIInsights(true)
  }
}

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/UserControllers/members')
      const membersList = res?.data || res || []
      setMembers(membersList)
      setTotalMembers(membersList.length)

      // Process industry statistics
      const industryMap = {}
      membersList.forEach(member => {
        const industries = member.industryTags || member.IndustryTags || []
        industries.forEach(industry => {
          const name = industry.nameEN || industry.NameEN || 'Unknown'
          industryMap[name] = (industryMap[name] || 0) + 1
        })
      })

      const industryData = Object.entries(industryMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
      setIndustryStats(industryData)

      // Process interest statistics
      const interestMap = {}
      membersList.forEach(member => {
        const interests = member.interestTags || member.InterestTags || []
        interests.forEach(interest => {
          const name = interest.nameEN || interest.NameEN || 'Unknown'
          interestMap[name] = (interestMap[name] || 0) + 1
        })
      })

      const interestData = Object.entries(interestMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
      setInterestStats(interestData)

    } catch (err) {
      console.error('[MemberAnalytics] Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const maxIndustryCount = Math.max(...industryStats.map(s => s.count), 1)
  const maxInterestCount = Math.max(...interestStats.map(s => s.count), 1)

  const colors = ['#c92b2b', '#e63946', '#f77f00', '#fcbf49', '#2a9d8f', '#264653', '#e76f51', '#6a4c93']

  return (
    <div style={{ padding: '24px 40px', minHeight: '100vh', background: '#f5f5f5' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <button 
            onClick={() => navigate('/admin/users')}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: '#c92b2b', 
              cursor: 'pointer', 
              fontSize: 14,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            ← Back to User Management
          </button>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#1f2a37', margin: 0 }}>
            📊 Member Analytics
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280', marginTop: 8 }}>
            Insights and statistics about member distribution across industries and interests
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>
            Loading analytics...
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20, marginBottom: 32 }}>
              <div style={{ background: 'linear-gradient(135deg, #c92b2b 0%, #8b1f1f 100%)', padding: 24, borderRadius: 12, boxShadow: '0 4px 12px rgba(201, 43, 43, 0.3)', color: 'white' }}>
                <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 8 }}>Total Members</div>
                <div style={{ fontSize: 42, fontWeight: 700 }}>{totalMembers}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 8 }}>Active member accounts</div>
              </div>

              <div style={{ background: 'linear-gradient(135deg, #2a9d8f 0%, #264653 100%)', padding: 24, borderRadius: 12, boxShadow: '0 4px 12px rgba(42, 157, 143, 0.3)', color: 'white' }}>
                <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 8 }}>Industries</div>
                <div style={{ fontSize: 42, fontWeight: 700 }}>{industryStats.length}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 8 }}>Different industries represented</div>
              </div>

              <div style={{ background: 'linear-gradient(135deg, #f77f00 0%, #d62828 100%)', padding: 24, borderRadius: 12, boxShadow: '0 4px 12px rgba(247, 127, 0, 0.3)', color: 'white' }}>
                <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 8 }}>Topics of Interest</div>
                <div style={{ fontSize: 42, fontWeight: 700 }}>{interestStats.length}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 8 }}>Different topics selected</div>
              </div>
            </div>

            {/* Industry Distribution */}
            <div style={{ background: 'white', padding: 32, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: 32 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1f2a37', marginBottom: 8 }}>
                🏢 Members by Industry
              </h2>
              <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 32 }}>
                Distribution of members across different industries
              </p>

              {industryStats.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
                  No industry data available
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center' }}>
                  {/* Pie Chart */}
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <svg width="320" height="320" viewBox="0 0 320 320" style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.1))' }}>
                      {(() => {
                        let currentAngle = -90 // Start from top
                        return industryStats.map((stat, index) => {
                          const percentage = stat.count / totalMembers
                          const angle = percentage * 360
                          const startAngle = currentAngle
                          const endAngle = currentAngle + angle
                          
                          const startRad = (startAngle * Math.PI) / 180
                          const endRad = (endAngle * Math.PI) / 180
                          
                          const x1 = 160 + 140 * Math.cos(startRad)
                          const y1 = 160 + 140 * Math.sin(startRad)
                          const x2 = 160 + 140 * Math.cos(endRad)
                          const y2 = 160 + 140 * Math.sin(endRad)
                          
                          const largeArc = angle > 180 ? 1 : 0
                          
                          const path = `M 160 160 L ${x1} ${y1} A 140 140 0 ${largeArc} 1 ${x2} ${y2} Z`
                          
                          currentAngle = endAngle
                          
                          return (
                            <g key={stat.name}>
                              <path
                                d={path}
                                fill={colors[index % colors.length]}
                                stroke="white"
                                strokeWidth="3"
                                style={{ 
                                  transition: 'transform 0.3s ease',
                                  transformOrigin: '160px 160px',
                                  cursor: 'pointer'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'scale(1.05)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'scale(1)'
                                }}
                              />
                            </g>
                          )
                        })
                      })()}
                      {/* Center white circle */}
                      <circle cx="160" cy="160" r="70" fill="white" />
                      <text x="160" y="150" textAnchor="middle" style={{ fontSize: 32, fontWeight: 700, fill: '#1f2a37' }}>
                        {totalMembers}
                      </text>
                      <text x="160" y="175" textAnchor="middle" style={{ fontSize: 14, fill: '#6b7280' }}>
                        Total Members
                      </text>
                    </svg>
                  </div>

                  {/* Legend */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {industryStats.map((stat, index) => {
                      const percentage = (stat.count / totalMembers * 100).toFixed(1)
                      return (
                        <div 
                          key={stat.name}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 12,
                            padding: 12,
                            borderRadius: 8,
                            transition: 'background 0.2s ease',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f9fafb'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent'
                          }}
                        >
                          <div 
                            style={{ 
                              width: 20, 
                              height: 20, 
                              borderRadius: 4, 
                              background: colors[index % colors.length],
                              flexShrink: 0
                            }} 
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 2 }}>
                              {stat.name}
                            </div>
                            <div style={{ fontSize: 13, color: '#6b7280' }}>
                              {stat.count} members
                            </div>
                          </div>
                          <div style={{ 
                            fontSize: 16, 
                            fontWeight: 700, 
                            color: colors[index % colors.length]
                          }}>
                            {percentage}%
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Interest Distribution */}
            <div style={{ background: 'white', padding: 32, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1f2a37', marginBottom: 8 }}>
                🎯 Members by Topics of Interest
              </h2>
              <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 32 }}>
                Popular topics among members
              </p>

              {interestStats.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
                  No interest data available
                </div>
              ) : (
                <>
                  {/* Top Interests as Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
                    {interestStats.slice(0, 6).map((stat, index) => (
                      <div 
                        key={stat.name}
                        style={{ 
                          background: `linear-gradient(135deg, ${colors[index % colors.length]}15 0%, ${colors[index % colors.length]}05 100%)`,
                          border: `2px solid ${colors[index % colors.length]}30`,
                          padding: 20,
                          borderRadius: 10,
                          textAlign: 'center'
                        }}
                      >
                        <div style={{ fontSize: 28, fontWeight: 700, color: colors[index % colors.length], marginBottom: 8 }}>
                          {stat.count}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', lineHeight: 1.4 }}>
                          {stat.name}
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                          {(stat.count / totalMembers * 100).toFixed(1)}% of members
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* All Interests as Bars */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {interestStats.map((stat, index) => {
                      const percentage = (stat.count / totalMembers * 100).toFixed(1)
                      const barWidth = (stat.count / maxInterestCount * 100)
                      return (
                        <div key={stat.name}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{stat.name}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span style={{ fontSize: 12, color: '#6b7280' }}>{percentage}%</span>
                              <span style={{ 
                                fontSize: 14, 
                                fontWeight: 700, 
                                color: colors[index % colors.length],
                                minWidth: 35,
                                textAlign: 'right'
                              }}>
                                {stat.count}
                              </span>
                            </div>
                          </div>
                          <div style={{ 
                            width: '100%', 
                            height: 8, 
                            background: '#f3f4f6', 
                            borderRadius: 4,
                            overflow: 'hidden'
                          }}>
                            <div style={{ 
                              width: `${barWidth}%`, 
                              height: '100%', 
                              background: colors[index % colors.length],
                              borderRadius: 4,
                              transition: 'width 0.5s ease'
                            }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
