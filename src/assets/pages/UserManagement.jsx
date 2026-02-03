import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRoleFromToken } from '../../utils/auth'

// support either VITE_API_BASE or VITE_API_BASE_URL
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

export default function UserManagement() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('members') // 'members' or 'consultants'
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [stats, setStats] = useState({ total: 0, pending: 0, active: 0, inactive: 0 })
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ Name: '', Email: '', OneTimePassword: '' })
  const role = getRoleFromToken(localStorage.getItem('token'))

  useEffect(() => { load() }, [activeTab])

  const load = async () => {
    setLoading(true)
    try {
      const endpoint = activeTab === 'members' ? '/api/UserControllers/members' : '/api/UserControllers/consultants'
      const res = await apiFetch(endpoint)
      console.log('[load] raw response:', res)
      const list = res?.data || res || []
      console.log('[load] full list:', list)
      
      // Map fields with case-insensitive fallbacks
      const mapped = Array.isArray(list) ? list.map(u => {
        console.log('[load] processing user:', u)
        console.log('[load] user.interests:', u.interests)
        console.log('[load] user.Interests:', u.Interests)
        console.log('[load] user.interestTags:', u.interestTags)
        console.log('[load] user.InterestTags:', u.InterestTags)
        
        const industryStr = Array.isArray(u.industryTags) || Array.isArray(u.IndustryTags)
          ? (u.industryTags || u.IndustryTags).map(t => t.nameEN || t.NameEN || t.name || t.Name).join(', ')
          : u.industry ?? u.Industry ?? '-'
        
        const topicsStr = Array.isArray(u.interestTags) || Array.isArray(u.InterestTags)
          ? (u.interestTags || u.InterestTags).map(t => t.nameEN || t.NameEN || t.name || t.Name).join(', ')
          : Array.isArray(u.interests) || Array.isArray(u.Interests)
          ? (u.interests || u.Interests).map(t => t.nameEN || t.NameEN || t.name || t.Name).join(', ')
          : u.topics ?? u.Topics ?? '-'

        const item = {
          id: u.memberId ?? u.id ?? u.Id,
          name: u.name ?? u.Name ?? u.contactPerson ?? u.ContactPerson ?? 'N/A',
          email: u.email ?? u.Email,
          industry: industryStr,
          topics: topicsStr,
          status: u.status ?? u.Status ?? (u.isActive || u.IsActive ? 'Active' : 'Inactive'),
          isActive: u.isActive ?? u.IsActive ?? true,
          avatar: u.avatar ?? u.Avatar ?? null
        }
        console.log('[load] mapped user:', item)
        return item
      }) : []

      setUsers(mapped)
      
      // Calculate stats
      const total = mapped.length
      const pending = mapped.filter(u => !u.isActive).length
      const active = mapped.filter(u => u.isActive).length
      const inactive = total - active
      
      setStats({ total, pending, active, inactive })
    } catch (e) {
      console.error('[load] error:', e)
      alert('Failed to load users: ' + e.message)
    } finally { setLoading(false) }
  }

  const handleActivate = async (userEmail) => {
    if (!confirm('Activate this user account?')) return
    try {
      const res = await apiFetch(`/api/UserControllers/activate/${encodeURIComponent(userEmail)}`, { method: 'PUT' })
      alert(res?.message || 'User activated successfully')
      load() // Reload
    } catch (e) {
      alert('Failed to activate user: ' + e.message)
    }
  }

  const handleDeactivate = async (userEmail) => {
    if (!confirm('Deactivate this user account?')) return
    try {
      const res = await apiFetch(`/api/UserControllers/deactivate/${encodeURIComponent(userEmail)}`, { method: 'PUT' })
      alert(res?.message || 'User deactivated successfully')
      load() // Reload
    } catch (e) {
      alert('Failed to deactivate user: ' + e.message)
    }
  }

  const handleCreateConsultant = async () => {
    if (!createForm.Name || !createForm.Email || !createForm.OneTimePassword) {
      alert('All fields are required')
      return
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.Email)) {
      alert('Please enter a valid email address')
      return
    }

    // Password validation (at least 6 characters)
    if (createForm.OneTimePassword.length < 6) {
      alert('Password must be at least 6 characters')
      return
    }

    try {
      const payload = {
        Name: createForm.Name,
        Email: createForm.Email,
        OneTimePassword: createForm.OneTimePassword
      }

      const res = await apiFetch('/api/UserControllers/create-consultant', { 
        method: 'POST', 
        body: JSON.stringify(payload) 
      })

      alert(res?.message || 'Consultant created successfully! They must change password on first login.')
      setIsCreateOpen(false)
      setCreateForm({ Name: '', Email: '', OneTimePassword: '' })
      load() // Reload list
    } catch (e) {
      alert('Failed to create consultant: ' + e.message)
    }
  }

  const openCreateModal = () => {
    setCreateForm({ Name: '', Email: '', OneTimePassword: '' })
    setIsCreateOpen(true)
  }

  if (role !== 'admin') return <div style={{ padding: 24 }}><div style={{ fontWeight: 600 }}>You do not have permission to view this page.</div></div>

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.industry?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div style={{ padding: 20, background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, marginBottom: 8, color: '#666' }}>User Management</h2>
        <p style={{ margin: 0, color: '#999', fontSize: 14 }}>Manage accounts for consultants & members.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
        <button 
          onClick={() => setActiveTab('consultants')}
          style={{ 
            padding: '10px 24px', 
            background: activeTab === 'consultants' ? '#c92b2b' : '#999',
            color: 'white',
            border: 'none',
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            fontWeight: activeTab === 'consultants' ? 600 : 400,
            cursor: 'pointer'
          }}
        >
          Consultants
        </button>
        <button 
          onClick={() => setActiveTab('members')}
          style={{ 
            padding: '10px 24px', 
            background: activeTab === 'members' ? '#c92b2b' : '#999',
            color: 'white',
            border: 'none',
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            fontWeight: activeTab === 'members' ? 600 : 400,
            cursor: 'pointer'
          }}
        >
          Members
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'white', padding: 20, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 12, color: '#999', fontWeight: 600, marginBottom: 8 }}>Total {activeTab === 'members' ? 'Members' : 'Consultants'}</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#666' }}>{stats.total}</div>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>All {activeTab} accounts</div>
        </div>
        <div style={{ background: 'white', padding: 20, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 12, color: '#999', fontWeight: 600, marginBottom: 8 }}>Pending Activation</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#2196F3' }}>{stats.pending}</div>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>To be activated</div>
        </div>
        <div style={{ background: 'white', padding: 20, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 12, color: '#999', fontWeight: 600, marginBottom: 8 }}>Active</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#4CAF50' }}>{stats.active}</div>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>Active accounts</div>
        </div>
        <div style={{ background: 'white', padding: 20, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 12, color: '#999', fontWeight: 600, marginBottom: 8 }}>Inactive</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#F44336' }}>{stats.inactive}</div>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>Deactivated accounts</div>
        </div>
      </div>

      {/* Search & Sort Bar */}
      <div style={{ background: 'white', padding: 16, borderRadius: 12, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <input 
          type="text"
          placeholder="Search"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, width: 300 }}
        />
        <div style={{ display: 'flex', gap: 12 }}>
          {activeTab === 'members' && (
            <button 
              onClick={() => navigate('/admin/member-analytics')}
              style={{ 
                padding: '8px 16px', 
                background: '#2196F3', 
                color: 'white',
                border: 'none', 
                borderRadius: 6, 
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              📊 Member Analytics
            </button>
          )}
          {activeTab === 'consultants' && (
            <button 
              onClick={openCreateModal}
              style={{ 
                padding: '8px 16px', 
                background: '#c92b2b', 
                color: 'white',
                border: 'none', 
                borderRadius: 6, 
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              + Create Consultant
            </button>
          )}
        </div>
      </div>

      {/* User Table */}
      <div style={{ background: 'white', padding: 18, borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
        {loading ? <div>Loading...</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
                <th style={{ padding: 12 }}>Avatar</th>
                <th style={{ padding: 12 }}>Name</th>
                <th style={{ padding: 12 }}>Email</th>
                {activeTab === 'members' && <th style={{ padding: 12 }}>Industry</th>}
                {activeTab === 'members' && <th style={{ padding: 12 }}>Topics of Interest</th>}
                <th style={{ padding: 12 }}>Status</th>
                <th style={{ padding: 12 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user, i) => (
                <tr key={user.id ?? i} style={{ borderBottom: '1px solid #f7f7f7' }}>
                  <td style={{ padding: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#c92b2b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
                      {user.avatar ? <img src={user.avatar} style={{ width: 40, height: 40, borderRadius: '50%' }} /> : (user.name?.[0] || 'U')}
                    </div>
                  </td>
                  <td style={{ padding: 12 }}>{user.name}</td>
                  <td style={{ padding: 12 }}>{user.email}</td>
                  {activeTab === 'members' && (
                    <td style={{ padding: 12 }}>
                      {user.industry && user.industry !== '-' ? (
                        <span style={{ background: '#c92b2b', color: 'white', padding: '4px 12px', borderRadius: 12, fontSize: 12 }}>{user.industry}</span>
                      ) : '-'}
                    </td>
                  )}
                  {activeTab === 'members' && (
                    <td style={{ padding: 12 }}>
                      {user.topics && user.topics !== '-' ? (
                        user.topics.split(',').slice(0, 2).map((t, i) => (
                          <span key={i} style={{ background: '#f0f0f0', color: '#666', padding: '4px 8px', borderRadius: 8, fontSize: 11, marginRight: 4, display: 'inline-block', marginBottom: 4 }}>{t.trim()}</span>
                        ))
                      ) : '-'}
                    </td>
                  )}
                  <td style={{ padding: 12 }}>
                    <span style={{ 
                      color: user.isActive ? '#4CAF50' : '#F44336',
                      fontWeight: 600,
                      fontSize: 12
                    }}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: 12 }}>
                    {!user.isActive ? (
                      <button 
                        onClick={() => handleActivate(user.email)}
                        style={{ 
                          background: '#4CAF50', 
                          color: 'white', 
                          border: 'none', 
                          padding: '6px 16px', 
                          borderRadius: 6, 
                          cursor: 'pointer',
                          fontSize: 13
                        }}
                      >
                        Activate
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleDeactivate(user.email)}
                        style={{ 
                          background: '#F44336', 
                          color: 'white', 
                          border: 'none', 
                          padding: '6px 16px', 
                          borderRadius: 6, 
                          cursor: 'pointer',
                          fontSize: 13
                        }}
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && <tr><td colSpan={activeTab === 'members' ? 7 : 5} style={{ padding: 12, textAlign: 'center' }}>No users found.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Consultant Modal */}
      {isCreateOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: 'white', width: '90%', maxWidth: 500, borderRadius: 8, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>Create Consultant</div>
              <button 
                onClick={() => setIsCreateOpen(false)}
                style={{ border: 'none', background: 'transparent', fontSize: 24, cursor: 'pointer', color: '#999' }}
              >
                ×
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600 }}>Name *</label>
                <input 
                  type="text"
                  placeholder="Enter consultant name"
                  value={createForm.Name}
                  onChange={e => setCreateForm({ ...createForm, Name: e.target.value })}
                  style={{ padding: '10px 12px', border: '1px solid #ddd', borderRadius: 6, width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600 }}>Email *</label>
                <input 
                  type="email"
                  placeholder="consultant@example.com"
                  value={createForm.Email}
                  onChange={e => setCreateForm({ ...createForm, Email: e.target.value })}
                  style={{ padding: '10px 12px', border: '1px solid #ddd', borderRadius: 6, width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600 }}>One-Time Password *</label>
                <input 
                  type="text"
                  placeholder="Temporary password (min 6 characters)"
                  value={createForm.OneTimePassword}
                  onChange={e => setCreateForm({ ...createForm, OneTimePassword: e.target.value })}
                  style={{ padding: '10px 12px', border: '1px solid #ddd', borderRadius: 6, width: '100%', boxSizing: 'border-box' }}
                />
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                  The consultant will be required to change this password on first login.
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button 
                  onClick={() => setIsCreateOpen(false)}
                  style={{ padding: '10px 20px', border: '1px solid #ddd', background: 'white', borderRadius: 6, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateConsultant}
                  style={{ padding: '10px 20px', background: '#c92b2b', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
