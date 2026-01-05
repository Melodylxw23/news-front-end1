import React, { useEffect, useState } from 'react'
import { getRoleFromToken } from '../../utils/auth'

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

export default function CategoryManagement() {
  const [activeTab, setActiveTab] = useState('industry') // 'industry' or 'topic'
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ Name: '' })
  const [editForm, setEditForm] = useState({ id: null, Name: '' })
  const role = getRoleFromToken(localStorage.getItem('token'))

  useEffect(() => { load() }, [activeTab])

  const load = async () => {
    setLoading(true)
    try {
      const endpoint = activeTab === 'industry' ? '/api/IndustryTags' : '/api/InterestTags'
      const res = await apiFetch(endpoint)
      const list = res?.data || res || []
      
      const mapped = Array.isArray(list) ? list.map(item => ({
        id: item.industryTagId || item.interestTagId || item.id,
        name: item.name || item.Name || 'N/A'
      })) : []

      setItems(mapped)
    } catch (e) {
      alert('Failed to load items: ' + e.message)
    } finally { setLoading(false) }
  }

  const handleCreate = async () => {
    if (!createForm.Name) {
      alert('Name is required')
      return
    }

    try {
      const endpoint = activeTab === 'industry' ? '/api/IndustryTags' : '/api/InterestTags'
      await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(createForm)
      })
      alert(`${activeTab === 'industry' ? 'Industry' : 'Topic'} created successfully`)
      setIsCreateOpen(false)
      setCreateForm({ Name: '' })
      load()
    } catch (e) {
      alert('Failed to create: ' + e.message)
    }
  }

  const handleEdit = async () => {
    if (!editForm.Name) {
      alert('Name is required')
      return
    }

    try {
      const endpoint = activeTab === 'industry' 
        ? `/api/IndustryTags/${editForm.id}` 
        : `/api/InterestTags/${editForm.id}`
      await apiFetch(endpoint, {
        method: 'PUT',
        body: JSON.stringify({ Name: editForm.Name })
      })
      alert(`${activeTab === 'industry' ? 'Industry' : 'Topic'} updated successfully`)
      setIsEditOpen(false)
      setEditForm({ id: null, Name: '' })
      load()
    } catch (e) {
      alert('Failed to update: ' + e.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm(`Delete this ${activeTab === 'industry' ? 'industry' : 'topic'}?`)) return

    try {
      const endpoint = activeTab === 'industry' 
        ? `/api/IndustryTags/${id}` 
        : `/api/InterestTags/${id}`
      await apiFetch(endpoint, { method: 'DELETE' })
      alert('Deleted successfully')
      load()
    } catch (e) {
      alert('Failed to delete: ' + e.message)
    }
  }

  const openEditModal = (item) => {
    setEditForm({ id: item.id, Name: item.name })
    setIsEditOpen(true)
  }

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const stats = {
    total: items.length,
    industry: activeTab === 'industry' ? items.length : 0,
    topic: activeTab === 'topic' ? items.length : 0
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', padding: 24 }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
            Category Management
          </h1>
          <p style={{ color: '#666', fontSize: 14 }}>
            Manage industries and topics of interest for article classification & member profiling.
          </p>
        </div>

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 24 }}>
          <div style={{ background: 'white', padding: 24, borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
                  Total {activeTab === 'industry' ? 'Industry' : 'Topics of Interest'} Tags
                </div>
                <div style={{ fontSize: 36, fontWeight: 700, color: '#1a1a1a' }}>
                  {stats.total}
                </div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                  All {activeTab === 'industry' ? 'industry' : 'topics of interest'} tags
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs and Actions */}
        <div style={{ background: 'white', padding: '16px 24px', borderRadius: 12, marginBottom: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 24 }}>
            <button
              onClick={() => setActiveTab('industry')}
              style={{
                padding: '12px 24px',
                background: activeTab === 'industry' ? '#c92b2b' : 'transparent',
                color: activeTab === 'industry' ? 'white' : '#666',
                border: 'none',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 14,
                transition: 'all 0.2s'
              }}
            >
              Industry
            </button>
            <button
              onClick={() => setActiveTab('topic')}
              style={{
                padding: '12px 24px',
                background: activeTab === 'topic' ? '#c92b2b' : 'transparent',
                color: activeTab === 'topic' ? 'white' : '#666',
                border: 'none',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 14,
                transition: 'all 0.2s'
              }}
            >
              Topic of Interest
            </button>
          </div>

          {role === 'admin' && (
            <button
              onClick={() => setIsCreateOpen(true)}
              style={{
                padding: '10px 20px',
                background: '#c92b2b',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              + Create {activeTab === 'industry' ? 'Industry' : 'Topic'} Tag
            </button>
          )}
        </div>

        {/* Search */}
        <div style={{ background: 'white', padding: '16px 24px', borderRadius: 12, marginBottom: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 16px',
              border: '1px solid #ddd',
              borderRadius: 8,
              fontSize: 14
            }}
          />
        </div>

        {/* Items Table */}
        <div style={{ background: 'white', padding: 18, borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
          {loading ? <div>Loading...</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
                  <th style={{ padding: 12 }}>{activeTab === 'industry' ? 'Industry' : 'Topic of Interest'} Tag</th>
                  <th style={{ padding: 12, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, i) => (
                  <tr key={item.id ?? i} style={{ borderBottom: '1px solid #f7f7f7' }}>
                    <td style={{ padding: 12, fontSize: 15 }}>{item.name}</td>
                    <td style={{ padding: 12, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => openEditModal(item)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 18,
                            color: '#c92b2b'
                          }}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 18,
                            color: '#F44336'
                          }}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={2} style={{ padding: 12, textAlign: 'center' }}>
                      No items found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {isCreateOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: 32,
            borderRadius: 12,
            width: '90%',
            maxWidth: 500,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: 24 }}>
              Create {activeTab === 'industry' ? 'Industry' : 'Topic'} Tag
            </h2>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Name</label>
              <input
                type="text"
                value={createForm.Name}
                onChange={(e) => setCreateForm({ ...createForm, Name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  fontSize: 14
                }}
                placeholder={`Enter ${activeTab === 'industry' ? 'industry' : 'topic'} name`}
              />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setIsCreateOpen(false)
                  setCreateForm({ Name: '' })
                }}
                style={{
                  padding: '10px 20px',
                  background: '#f0f0f0',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                style={{
                  padding: '10px 20px',
                  background: '#c92b2b',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: 32,
            borderRadius: 12,
            width: '90%',
            maxWidth: 500,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: 24 }}>
              Edit {activeTab === 'industry' ? 'Industry' : 'Topic'} Tag
            </h2>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Name</label>
              <input
                type="text"
                value={editForm.Name}
                onChange={(e) => setEditForm({ ...editForm, Name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  fontSize: 14
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setIsEditOpen(false)
                  setEditForm({ id: null, Name: '' })
                }}
                style={{
                  padding: '10px 20px',
                  background: '#f0f0f0',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleEdit}
                style={{
                  padding: '10px 20px',
                  background: '#c92b2b',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
