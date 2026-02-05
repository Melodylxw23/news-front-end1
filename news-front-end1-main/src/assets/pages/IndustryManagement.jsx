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

export default function IndustryManagement() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ NameEN: '', NameZH: '' })
  const role = getRoleFromToken(localStorage.getItem('token'))

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/IndustryTags')
      console.log('[load] raw response:', res)
      // Backend returns { message, data: [...] }
      const list = res?.data || res || []
      console.log('[load] list:', list)
      const mapped = Array.isArray(list) ? list.map(i => {
        const item = { 
          id: i.industryTagId ?? i.IndustryTagId ?? i.IndustryId ?? i.industryId ?? i.id, 
          NameEN: i.nameEN ?? i.NameEN ?? i.NameEn ?? '',
          NameZH: i.nameZH ?? i.NameZH ?? i.NameZh ?? ''
        }
        console.log('[load] mapped item:', i, '→', item)
        return item
      }) : []
      setItems(mapped)
    } catch (e) {
      alert('Failed to load industries: ' + e.message)
    } finally { setLoading(false) }
  }

  const openCreate = () => { setEditing(null); setForm({ NameEN: '', NameZH: '' }); setIsOpen(true) }
  const openEdit = (it) => { 
    console.log('[openEdit] item:', it, 'id:', it?.id)
    setEditing(it); 
    setForm({ NameEN: it.NameEN || '', NameZH: it.NameZH || '' }); 
    setIsOpen(true) 
  }
  const close = () => setIsOpen(false)

  const handleSave = async () => {
    if (!form.NameEN || String(form.NameEN).trim() === '') { alert('NameEN required'); return }
    if (!form.NameZH || String(form.NameZH).trim() === '') { alert('NameZH required'); return }
    
    console.log('[handleSave] editing:', editing, 'editing.id:', editing?.id)
    
    try {
      if (editing && editing.id) {
        console.log('[handleSave] UPDATE mode - calling PUT /api/IndustryTags/' + editing.id)
        const payload = { Name: (form.NameEN || form.NameZH || '').trim(), NameEN: form.NameEN.trim(), NameZH: form.NameZH.trim() }
        const res = await apiFetch(`/api/IndustryTags/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        const updated = res?.data || res
        setItems(prev => prev.map(p => (p.id === editing.id ? ({ 
          id: updated?.industryTagId ?? updated?.IndustryTagId ?? updated?.IndustryId ?? updated?.industryId ?? updated?.id ?? editing.id, 
          NameEN: updated?.nameEN ?? updated?.NameEN ?? payload.NameEN,
          NameZH: updated?.nameZH ?? updated?.NameZH ?? payload.NameZH
        }) : p)))
        alert(res?.message || 'Updated')
      } else {
        console.log('[handleSave] CREATE mode - calling POST /api/IndustryTags')
        const payload = { Name: (form.NameEN || form.NameZH || '').trim(), NameEN: form.NameEN.trim(), NameZH: form.NameZH.trim() }
        const res = await apiFetch('/api/IndustryTags', { method: 'POST', body: JSON.stringify(payload) })
        const created = res?.data || res
        setItems(prev => [{ 
          id: created?.industryTagId ?? created?.IndustryTagId ?? created?.IndustryId ?? created?.industryId ?? created?.id, 
          NameEN: created?.nameEN ?? created?.NameEN ?? payload.NameEN,
          NameZH: created?.nameZH ?? created?.NameZH ?? payload.NameZH
        }, ...prev])
        alert(res?.message || 'Created')
      }
      close()
    } catch (e) { alert('Save failed: ' + e.message) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this industry?')) return
    try {
      const res = await apiFetch(`/api/IndustryTags/${id}`, { method: 'DELETE' })
      setItems(prev => prev.filter(p => p.id !== id))
      alert(res?.message || 'Deleted')
    } catch (e) { alert('Delete failed: ' + e.message) }
  }

  if (role !== 'admin') return <div style={{ padding: 24 }}><div style={{ fontWeight: 600 }}>You do not have permission to view this page.</div></div>

  return (
    <div style={{ padding: 20, background: '#fbf4f2', minHeight: '80vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Industry Management</h2>
        <div>
          <button onClick={openCreate} style={{ background: '#c92b2b', color: 'white', padding: '8px 12px', borderRadius: 6, border: 'none' }}>+ Create Industry Tag</button>
        </div>
      </div>

      <div style={{ background: 'white', padding: 18, borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
        {loading ? <div>Loading...</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
                  <th style={{ padding: 12 }}>English (NameEN)</th>
                  <th style={{ padding: 12 }}>Chinese (NameZH)</th>
                  <th style={{ padding: 12 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={it.id ?? i} style={{ borderBottom: '1px solid #f7f7f7' }}>
                    <td style={{ padding: 12 }}>{it.NameEN || '—'}</td>
                    <td style={{ padding: 12 }}>{it.NameZH || '—'}</td>
                    <td style={{ padding: 12 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => openEdit(it)} style={{ border: 'none', background: 'transparent', color: '#2b6cb0' }}>✏️</button>
                        <button onClick={() => handleDelete(it.id)} style={{ border: 'none', background: 'transparent', color: '#c43d3d' }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan={3} style={{ padding: 12 }}>No industries found.</td></tr>}
              </tbody>
            </table>
        )}
      </div>

      {isOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: 'white', width: '90%', maxWidth: 560, borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{editing ? 'Edit Industry' : 'Create Industry'}</div>
              <button onClick={close}>Close</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input placeholder="NameEN * (English)" value={form.NameEN} onChange={e => setForm({ ...form, NameEN: e.target.value })} style={{ padding: 10, border: '1px solid #ddd', borderRadius: 6 }} />
              <input placeholder="NameZH * (Chinese)" value={form.NameZH} onChange={e => setForm({ ...form, NameZH: e.target.value })} style={{ padding: 10, border: '1px solid #ddd', borderRadius: 6 }} />
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