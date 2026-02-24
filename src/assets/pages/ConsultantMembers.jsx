import React, { useEffect, useState } from 'react'
import Toast from '../components/Toast'
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
    throw new Error(text || `HTTP ${res.status}`)
  }
  try { return text ? JSON.parse(text) : null } catch (e) { return text }
}

export default function ConsultantMembers() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('view') // 'view' or 'create'
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [industries, setIndustries] = useState([])
  const [toastMsg, setToastMsg] = useState(null)
  const [toastType, setToastType] = useState('info')

  // Form state for creating member
  const [form, setForm] = useState({
    CompanyName: '',
    ContactPerson: '',
    Email: '',
    WeChatWorkId: '',
    Country: '',
    CompanySize: '',
    IndustryTagId: '',
    PreferredLanguage: 'EN',
    PreferredChannel: 'Email',
    MembershipType: 'Local'
  })
  const [formLoading, setFormLoading] = useState(false)

  // Fetch members on component mount
  useEffect(() => {
    loadMembers()
    loadIndustries()
  }, [])

  const loadMembers = async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/UserControllers/members')
      const list = res?.data || res || []
      
      const mapped = Array.isArray(list) ? list.map(m => {
        const industryStr = Array.isArray(m.industryTags) || Array.isArray(m.IndustryTags)
          ? (m.industryTags || m.IndustryTags).map(t => t.nameEN || t.NameEN).join(', ')
          : m.industry ?? m.Industry ?? '-'
        
        const interestStr = Array.isArray(m.interestTags) || Array.isArray(m.InterestTags)
          ? (m.interestTags || m.InterestTags).map(t => t.nameEN || t.NameEN).join(', ')
          : m.interests ?? m.Interests ?? '-'

        return {
          id: m.memberId ?? m.MemberId ?? m.id,
          name: m.name ?? m.Name ?? m.contactPerson ?? m.ContactPerson ?? 'N/A',
          email: m.email ?? m.Email,
          company: m.companyName ?? m.CompanyName ?? '-',
          industry: industryStr,
          topics: interestStr,
          status: m.isActive || m.IsActive ? 'Active' : 'Inactive',
          isActive: m.isActive ?? m.IsActive ?? true
        }
      }) : []

      setMembers(mapped)
    } catch (e) {
      console.error('Error loading members:', e)
      setToastMsg('Failed to load members: ' + e.message)
      setToastType('error')
    } finally {
      setLoading(false)
    }
  }

  const loadIndustries = async () => {
    try {
      const res = await apiFetch('/api/IndustryTags')
      const list = res?.data || res || []
      setIndustries(list)
    } catch (e) {
      console.error('Error loading industries:', e)
    }
  }

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleCreateMember = async (e) => {
    e.preventDefault()
    setToastMsg(null)
    setFormLoading(true)

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setToastMsg('You must be logged in to register members.')
        setToastType('error')
        setFormLoading(false)
        return
      }

      const payload = {
        CompanyName: form.CompanyName,
        ContactPerson: form.ContactPerson,
        Email: form.Email,
        WeChatWorkId: form.WeChatWorkId || null,
        Country: form.Country,
        CompanySize: parseInt(form.CompanySize),
        IndustryTagId: parseInt(form.IndustryTagId),
        PreferredLanguage: form.PreferredLanguage,
        PreferredChannel: form.PreferredChannel,
        MembershipType: form.MembershipType
      }

      const res = await apiFetch('/api/UserControllers/register-member', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      setToastMsg('Member registered successfully!')
      setToastType('success')
      
      // Reset form
      setForm({
        CompanyName: '',
        ContactPerson: '',
        Email: '',
        WeChatWorkId: '',
        Country: '',
        CompanySize: '',
        IndustryTagId: '',
        PreferredLanguage: 'EN',
        PreferredChannel: 'Email',
        MembershipType: 'Local'
      })

      // Reload members list
      setTimeout(() => {
        loadMembers()
        setActiveTab('view')
      }, 1500)
    } catch (err) {
      setToastMsg('Error: ' + err.message)
      setToastType('error')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeleteMember = async (memberId, memberName) => {
    if (!confirm(`Are you sure you want to delete member "${memberName}"? This action cannot be undone.`)) {
      return
    }

    try {
      const res = await apiFetch(`/api/UserControllers/delete-member/${memberId}`, {
        method: 'DELETE'
      })

      setToastMsg('Member deleted successfully!')
      setToastType('success')
      loadMembers()
    } catch (err) {
      setToastMsg('Error: ' + err.message)
      setToastType('error')
    }
  }

  const filteredMembers = members.filter(m =>
    m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.industry?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div style={{ padding: 20, background: '#f5f5f5', minHeight: '100vh' }}>
      <Toast message={toastMsg} type={toastType} onClose={() => setToastMsg(null)} />

      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, marginBottom: 8, color: '#666' }}>Member Management</h2>
        <p style={{ margin: 0, color: '#999', fontSize: 14 }}>View all created members or register a new member.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
        <button
          onClick={() => setActiveTab('view')}
          style={{
            padding: '10px 24px',
            background: activeTab === 'view' ? '#c92b2b' : '#999',
            color: 'white',
            border: 'none',
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            fontWeight: activeTab === 'view' ? 600 : 400,
            cursor: 'pointer'
          }}
        >
          View Members
        </button>
        <button
          onClick={() => setActiveTab('create')}
          style={{
            padding: '10px 24px',
            background: activeTab === 'create' ? '#c92b2b' : '#999',
            color: 'white',
            border: 'none',
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            fontWeight: activeTab === 'create' ? 600 : 400,
            cursor: 'pointer'
          }}
        >
          Register Member
        </button>
      </div>

      {/* View Members Tab */}
      {activeTab === 'view' && (
        <>
          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div style={{ background: 'white', padding: 20, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: 12, color: '#999', fontWeight: 600, marginBottom: 8 }}>Total Members</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: '#666' }}>{members.length}</div>
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>All created members</div>
            </div>
            <div style={{ background: 'white', padding: 20, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: 12, color: '#999', fontWeight: 600, marginBottom: 8 }}>Active</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: '#4CAF50' }}>{members.filter(m => m.isActive).length}</div>
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>Active members</div>
            </div>
            <div style={{ background: 'white', padding: 20, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: 12, color: '#999', fontWeight: 600, marginBottom: 8 }}>Inactive</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: '#F44336' }}>{members.filter(m => !m.isActive).length}</div>
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>Inactive members</div>
            </div>
          </div>

          {/* Search Bar */}
          <div style={{ background: 'white', padding: 16, borderRadius: 12, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <input
              type="text"
              placeholder="Search by name, email, company, or industry..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, width: '100%', maxWidth: 400 }}
            />
          </div>

          {/* Members Table */}
          <div style={{ background: 'white', padding: 18, borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
            {loading ? (
              <div style={{ padding: 20, textAlign: 'center' }}>Loading members...</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
                    <th style={{ padding: 12 }}>Avatar</th>
                    <th style={{ padding: 12 }}>Name</th>
                    <th style={{ padding: 12 }}>Email</th>
                    <th style={{ padding: 12 }}>Company</th>
                    <th style={{ padding: 12 }}>Industry</th>
                    <th style={{ padding: 12 }}>Topics</th>
                    <th style={{ padding: 12 }}>Status</th>
                    <th style={{ padding: 12 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member, i) => (
                    <tr key={member.id ?? i} style={{ borderBottom: '1px solid #f7f7f7' }}>
                      <td style={{ padding: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#c92b2b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
                          {member.name?.[0] || 'M'}
                        </div>
                      </td>
                      <td style={{ padding: 12 }}>{member.name}</td>
                      <td style={{ padding: 12 }}>{member.email}</td>
                      <td style={{ padding: 12 }}>{member.company}</td>
                      <td style={{ padding: 12 }}>
                        {member.industry && member.industry !== '-' ? (
                          <span style={{ background: '#c92b2b', color: 'white', padding: '4px 12px', borderRadius: 12, fontSize: 12 }}>{member.industry}</span>
                        ) : '-'}
                      </td>
                      <td style={{ padding: 12 }}>
                        {member.topics && member.topics !== '-' ? (
                          member.topics.split(',').slice(0, 2).map((t, i) => (
                            <span key={i} style={{ background: '#f0f0f0', color: '#666', padding: '4px 8px', borderRadius: 8, fontSize: 11, marginRight: 4, display: 'inline-block', marginBottom: 4 }}>{t.trim()}</span>
                          ))
                        ) : '-'}
                      </td>
                      <td style={{ padding: 12 }}>
                        <span style={{
                          color: member.isActive ? '#4CAF50' : '#F44336',
                          fontWeight: 600,
                          fontSize: 12
                        }}>
                          {member.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: 12 }}>
                        <button
                          onClick={() => handleDeleteMember(member.id, member.name)}
                          style={{
                            background: '#F44336',
                            color: 'white',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 600,
                            transition: 'background 0.2s'
                          }}
                          onMouseOver={(e) => e.target.style.background = '#d32f2f'}
                          onMouseOut={(e) => e.target.style.background = '#F44336'}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredMembers.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ padding: 12, textAlign: 'center', color: '#999' }}>
                        No members found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Create Member Tab */}
      {activeTab === 'create' && (
        <div style={{ background: 'white', padding: 24, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <form onSubmit={handleCreateMember}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Left Column */}
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#666', fontSize: 14 }}>Company Name *</label>
                <input
                  type="text"
                  name="CompanyName"
                  value={form.CompanyName}
                  onChange={handleFormChange}
                  required
                  maxLength="100"
                  placeholder="Enter company name"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 6, marginBottom: 16, boxSizing: 'border-box' }}
                />

                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#666', fontSize: 14 }}>Contact Person *</label>
                <input
                  type="text"
                  name="ContactPerson"
                  value={form.ContactPerson}
                  onChange={handleFormChange}
                  required
                  maxLength="50"
                  placeholder="Enter contact person name"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 6, marginBottom: 16, boxSizing: 'border-box' }}
                />

                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#666', fontSize: 14 }}>Email *</label>
                <input
                  type="email"
                  name="Email"
                  value={form.Email}
                  onChange={handleFormChange}
                  required
                  placeholder="Enter member email"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 6, marginBottom: 16, boxSizing: 'border-box' }}
                />

                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#666', fontSize: 14 }}>WeChat / Work ID</label>
                <input
                  type="text"
                  name="WeChatWorkId"
                  value={form.WeChatWorkId}
                  onChange={handleFormChange}
                  placeholder="Optional WeChat or Work ID"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 6, marginBottom: 16, boxSizing: 'border-box' }}
                />

                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#666', fontSize: 14 }}>Country *</label>
                <input
                  type="text"
                  name="Country"
                  value={form.Country}
                  onChange={handleFormChange}
                  required
                  placeholder="e.g., China, Singapore"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 6, marginBottom: 16, boxSizing: 'border-box' }}
                />
              </div>

              {/* Right Column */}
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#666', fontSize: 14 }}>Company Size *</label>
                <select
                  name="CompanySize"
                  value={form.CompanySize}
                  onChange={handleFormChange}
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 6, marginBottom: 16, boxSizing: 'border-box' }}
                >
                  <option value="">Select Company Size</option>
                  <option value="1">1 - 10 employees</option>
                  <option value="2">11 - 50 employees</option>
                  <option value="3">51 - 200 employees</option>
                  <option value="4">201 - 500 employees</option>
                  <option value="5">500+ employees</option>
                </select>

                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#666', fontSize: 14 }}>Industry *</label>
                <select
                  name="IndustryTagId"
                  value={form.IndustryTagId}
                  onChange={handleFormChange}
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 6, marginBottom: 16, boxSizing: 'border-box' }}
                >
                  <option value="">Select Industry</option>
                  {industries.map(industry => (
                    <option key={industry.industryTagId || industry.IndustryTagId} value={industry.industryTagId || industry.IndustryTagId}>
                      {industry.nameEN || industry.NameEN}
                    </option>
                  ))}
                </select>

                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#666', fontSize: 14 }}>Preferred Language *</label>
                <select
                  name="PreferredLanguage"
                  value={form.PreferredLanguage}
                  onChange={handleFormChange}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 6, marginBottom: 16, boxSizing: 'border-box' }}
                >
                  <option value="EN">English</option>
                  <option value="ZH">中文 (Chinese)</option>
                </select>

                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#666', fontSize: 14 }}>Preferred Channel *</label>
                <select
                  name="PreferredChannel"
                  value={form.PreferredChannel}
                  onChange={handleFormChange}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 6, marginBottom: 16, boxSizing: 'border-box' }}
                >
                  <option value="Email">Email</option>
                  <option value="SMS">SMS</option>
                  <option value="WeChat">WeChat</option>
                </select>

                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#666', fontSize: 14 }}>Membership Type *</label>
                <select
                  name="MembershipType"
                  value={form.MembershipType}
                  onChange={handleFormChange}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 6, marginBottom: 16, boxSizing: 'border-box' }}
                >
                  <option value="Local">Local</option>
                  <option value="Overseas">Overseas</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={formLoading}
              style={{
                padding: '10px 24px',
                background: '#c92b2b',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: formLoading ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                marginTop: 20,
                opacity: formLoading ? 0.7 : 1
              }}
            >
              {formLoading ? 'Registering...' : 'Register Member'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}