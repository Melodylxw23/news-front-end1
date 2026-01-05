import React, { useEffect, useState } from 'react'
import { getRoleFromToken } from '../../utils/auth'

// support either VITE_API_BASE or VITE_API_BASE_URL (some files use different names)
const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || ''

const apiFetch = async (path, opts = {}) => {
  const token = localStorage.getItem('token')
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {})
  if (token) headers['Authorization'] = `Bearer ${token}`
  // normalize base + path
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

export default function InterestManagement() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ Name: '' })
  const role = getRoleFromToken(localStorage.getItem('token'))

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/InterestTags')
      // Backend returns { message, data: [...] }
      const list = res?.data || res || []
      setItems(Array.isArray(list) ? list.map(i => ({ 
        id: i.interestTagId ?? i.InterestTagId ?? i.InterestId ?? i.interestId ?? i.id, 
        Name: i.name ?? i.Name 
      })) : [])
    } catch (e) {
      alert('Failed to load interests: ' + e.message)
    } finally { setLoading(false) }
  }

  const openCreate = () => { setEditing(null); setForm({ Name: '' }); setIsOpen(true) }
  const openEdit = (it) => { setEditing(it); setForm({ Name: it.Name || '' }); setIsOpen(true) }
  const close = () => setIsOpen(false)

  const handleSave = async () => {
    if (!form.Name || String(form.Name).trim() === '') { alert('Name required'); return }
    try {
      if (editing && editing.id) {
        const res = await apiFetch(`/api/InterestTags/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) })
        const updated = res?.data || res
        setItems(prev => prev.map(p => (p.id === editing.id ? ({ 
          id: updated?.interestTagId ?? updated?.InterestTagId ?? updated?.InterestId ?? updated?.interestId ?? updated?.id ?? editing.id, 
          Name: updated?.name ?? updated?.Name ?? form.Name 
        }) : p)))
        alert(res?.message || 'Updated')
      } else {
        const res = await apiFetch('/api/InterestTags', { method: 'POST', body: JSON.stringify(form) })
        const created = res?.data || res
        setItems(prev => [{ 
          id: created?.interestTagId ?? created?.InterestTagId ?? created?.InterestId ?? created?.interestId ?? created?.id, 
          Name: created?.name ?? created?.Name ?? form.Name 
        }, ...prev])
        alert(res?.message || 'Created')
      }
      close()
    } catch (e) { alert('Save failed: ' + e.message) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this interest?')) return
    try {
      const res = await apiFetch(`/api/InterestTags/${id}`, { method: 'DELETE' })
      setItems(prev => prev.filter(p => p.id !== id))
      alert(res?.message || 'Deleted')
    } catch (e) { alert('Delete failed: ' + e.message) }
  }

  if (role !== 'admin') return <div style={{ padding: 24 }}><div style={{ fontWeight: 600 }}>You do not have permission to view this page.</div></div>

  return (
    <div style={{ padding: 20, background: '#fbf4f2', minHeight: '80vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Interest / Topic Management</h2>
        <div>
          <button onClick={openCreate} style={{ background: '#c92b2b', color: 'white', padding: '8px 12px', borderRadius: 6, border: 'none' }}>+ Create Topic</button>
        </div>
      </div>

      <div style={{ background: 'white', padding: 18, borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
        {loading ? <div>Loading...</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
                <th style={{ padding: 12 }}>Topic</th>
                <th style={{ padding: 12 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id ?? i} style={{ borderBottom: '1px solid #f7f7f7' }}>
                  <td style={{ padding: 12 }}>{it.Name}</td>
                  <td style={{ padding: 12 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => openEdit(it)} style={{ border: 'none', background: 'transparent', color: '#2b6cb0' }}>✏️</button>
                      <button onClick={() => handleDelete(it.id)} style={{ border: 'none', background: 'transparent', color: '#c43d3d' }}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={2} style={{ padding: 12 }}>No topics found.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {isOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: 'white', width: '90%', maxWidth: 560, borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{editing ? 'Edit Topic' : 'Create Topic'}</div>
              <button onClick={close}>Close</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input placeholder="Topic Name *" value={form.Name} onChange={e => setForm({ ...form, Name: e.target.value })} style={{ padding: 10, border: '1px solid #ddd', borderRadius: 6 }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button onClick={close}>Cancel</button>
                <button onClick={handleSave} style={{ background: '#2f8b40', color: 'white', padding: '6px 12px', borderRadius: 6 }}>{editing ? 'Save' : 'Create'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}