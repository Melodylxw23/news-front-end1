import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || 'https://localhost:7191';

const apiFetch = async (path, opts = {}) => {
  const token = localStorage.getItem('token');
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const fullPath = path.startsWith('http') ? path : `${API_BASE.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;

  console.log('[DraftsList apiFetch] API_BASE:', API_BASE);
  console.log('[DraftsList apiFetch] request', opts.method || 'GET', fullPath, opts.body ? JSON.parse(opts.body) : undefined);

  const res = await fetch(fullPath, Object.assign({ headers }, opts));
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    const errorMsg = `HTTP ${res.status} ${res.statusText}${text ? ': ' + text : ''}`;
    console.error('[DraftsList apiFetch] response error', res.status, fullPath, text);
    throw new Error(errorMsg);
  }
  console.log('[DraftsList apiFetch] response success', res.status, fullPath, text ? JSON.parse(text) : null);
  try { return text ? JSON.parse(text) : null; } catch (e) { return text; }
};

const DraftsList = () => {
    const navigate = useNavigate();
    const [drafts, setDrafts] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [editFormData, setEditFormData] = useState({
        title: '',
        subject: '',
        body: '',
        channel: 'Email',
        scheduledSendAt: ''
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDrafts();
    }, []);

    const fetchDrafts = async () => {
        try {
            setLoading(true);
            console.log('[fetchDrafts] Starting fetch...');
            const response = await apiFetch('/api/Broadcast');
            console.log('[fetchDrafts] Raw response:', response);
            console.log('[fetchDrafts] Response type:', typeof response);
            console.log('[fetchDrafts] Is array?', Array.isArray(response));
            console.log('[fetchDrafts] Response.data:', response?.data);
            
            const draftsData = response?.data || response || [];
            console.log('[fetchDrafts] Processed draftsData:', draftsData);
            console.log('[fetchDrafts] Is draftsData array?', Array.isArray(draftsData));
            
            setDrafts(Array.isArray(draftsData) ? draftsData : []);
            console.log('[fetchDrafts] Drafts set successfully');
        } catch (error) {
            console.error('[fetchDrafts] error:', error);
            alert('Failed to load drafts: ' + error.message);
            setDrafts([]);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this draft?')) return;
        
        try {
            console.log('[handleDelete] deleting:', id);
            await apiFetch(`/api/Broadcast/${id}`, { method: 'DELETE' });
            alert('Draft deleted successfully!');
            fetchDrafts();
        } catch (error) {
            console.error('[handleDelete] error:', error);
            alert('Failed to delete draft: ' + error.message);
        }
    };

    const handleEdit = (draft) => {
        setEditingId(draft.id);
        setEditFormData({
            title: draft.title || '',
            subject: draft.subject || '',
            body: draft.body || '',
            channel: draft.channel || 'Email',
            scheduledSendAt: formatDateTimeForInput(draft.scheduledSendAt)
        });
    };

    const handleEditChange = (e) => {
        const { name, value } = e.target;
        setEditFormData({ ...editFormData, [name]: value });
    };

    const handleSaveEdit = async () => {
        try {
            console.log('[handleSaveEdit] updating:', editingId, editFormData);
            const updateData = {
                Title: editFormData.title,
                Subject: editFormData.subject,
                Body: editFormData.body,
                Channel: editFormData.channel
            };
            if (editFormData.scheduledSendAt) {
                updateData.ScheduledSendAt = editFormData.scheduledSendAt;
            }
            await apiFetch(`/api/Broadcast/${editingId}`, {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });
            alert('Draft updated successfully!');
            setEditingId(null);
            fetchDrafts();
        } catch (error) {
            console.error('[handleSaveEdit] error:', error);
            alert('Failed to update draft: ' + error.message);
        }
    };

    const handleSend = (draft) => {
        if (!window.confirm(`Send "${draft.subject || draft.title}" to all ${draft.channel} subscribers?`)) return;
        
        // Navigate to success page with draft info
        navigate('/message-sent', { state: { broadcastSubject: draft.subject || draft.title } });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditFormData({ title: '', subject: '', body: '', channel: 'Email', scheduledSendAt: '' });
    };

    const formatDateTimeForInput = (dateString) => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            // Format as YYYY-MM-DDTHH:mm for datetime-local input
            return date.toISOString().slice(0, 16);
        } catch (e) {
            return dateString || '';
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '24px' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#333', margin: 0 }}>Saved Drafts</h1>
                        <p style={{ color: '#666', fontSize: '14px', marginTop: '8px', margin: 0 }}>Manage your broadcast message drafts</p>
                    </div>
                    <button
                        onClick={() => navigate('/broadcast')}
                        style={{
                            padding: '10px 20px',
                            background: '#dc2626',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        ✨ Create New
                    </button>
                </div>

                {/* Content */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#666' }}>
                        <div style={{ fontSize: '16px' }}>Loading drafts...</div>
                    </div>
                ) : drafts.length === 0 ? (
                    <div style={{ background: 'white', padding: '60px 20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', textAlign: 'center' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
                        <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#333', marginBottom: '8px' }}>No drafts yet</h2>
                        <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>Start creating broadcast messages to see them here</p>
                        <button
                            onClick={() => navigate('/broadcast')}
                            style={{
                                padding: '10px 20px',
                                background: '#dc2626',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '500'
                            }}
                        >
                            Create First Draft
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '16px' }}>
                        {drafts.map((draft) => (
                            <div
                                key={draft.id}
                                style={{
                                    background: 'white',
                                    padding: '20px',
                                    borderRadius: '12px',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                    border: editingId === draft.id ? '2px solid #dc2626' : '1px solid #e5e7eb'
                                }}
                            >
                                {editingId === draft.id ? (
                                    // Edit Mode
                                    <div>
                                        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#333' }}>Edit Draft</h3>
                                        
                                        <div style={{ marginBottom: '16px' }}>
                                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#333' }}>
                                                Title
                                            </label>
                                            <input
                                                type="text"
                                                name="title"
                                                value={editFormData.title}
                                                onChange={handleEditChange}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px',
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: '6px',
                                                    fontSize: '14px',
                                                    fontFamily: 'inherit',
                                                    boxSizing: 'border-box'
                                                }}
                                            />
                                        </div>

                                        <div style={{ marginBottom: '16px' }}>
                                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#333' }}>
                                                Subject
                                            </label>
                                            <input
                                                type="text"
                                                name="subject"
                                                value={editFormData.subject}
                                                onChange={handleEditChange}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px',
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: '6px',
                                                    fontSize: '14px',
                                                    fontFamily: 'inherit',
                                                    boxSizing: 'border-box'
                                                }}
                                            />
                                        </div>

                                        <div style={{ marginBottom: '16px' }}>
                                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#333' }}>
                                                Message Body
                                            </label>
                                            <textarea
                                                name="body"
                                                value={editFormData.body}
                                                onChange={handleEditChange}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px',
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: '6px',
                                                    fontSize: '14px',
                                                    minHeight: '120px',
                                                    resize: 'vertical',
                                                    fontFamily: 'inherit',
                                                    boxSizing: 'border-box'
                                                }}
                                            />
                                        </div>

                                        <div style={{ marginBottom: '16px' }}>
                                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#333' }}>
                                                Channel
                                            </label>
                                            <select
                                                name="channel"
                                                value={editFormData.channel}
                                                onChange={handleEditChange}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px',
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: '6px',
                                                    fontSize: '14px',
                                                    fontFamily: 'inherit',
                                                    boxSizing: 'border-box'
                                                }}
                                            >
                                                <option value="Email">Email</option>
                                                <option value="SMS">WeChat</option>
                                            </select>
                                        </div>

                                        <div style={{ marginBottom: '16px' }}>
                                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#333' }}>
                                                Scheduled Send Time (Optional)
                                            </label>
                                            <input
                                                type="datetime-local"
                                                name="scheduledSendAt"
                                                value={editFormData.scheduledSendAt}
                                                onChange={handleEditChange}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px',
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: '6px',
                                                    fontSize: '14px',
                                                    fontFamily: 'inherit',
                                                    boxSizing: 'border-box'
                                                }}
                                            />
                                            <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                                                Leave blank to send immediately
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <button
                                                onClick={handleSaveEdit}
                                                style={{
                                                    flex: 1,
                                                    padding: '10px 16px',
                                                    background: '#059669',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontSize: '14px',
                                                    fontWeight: '500'
                                                }}
                                            >
                                                Save Changes
                                            </button>
                                            <button
                                                onClick={handleCancelEdit}
                                                style={{
                                                    flex: 1,
                                                    padding: '10px 16px',
                                                    background: '#f3f4f6',
                                                    color: '#333',
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontSize: '14px',
                                                    fontWeight: '500'
                                                }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    // View Mode
                                    <div>
                                        <div style={{ marginBottom: '16px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                                                <div>
                                                    <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: '#333', marginBottom: '4px' }}>
                                                        {draft.title || draft.subject || 'Untitled'}
                                                    </h3>
                                                    <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
                                                        {draft.subject}
                                                    </p>
                                                </div>
                                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                    <span style={{
                                                        display: 'inline-block',
                                                        padding: '4px 12px',
                                                        background: draft.channel === 'Email' ? '#dbeafe' : '#dcfce7',
                                                        color: draft.channel === 'Email' ? '#1e40af' : '#166534',
                                                        borderRadius: '4px',
                                                        fontSize: '12px',
                                                        fontWeight: '500'
                                                    }}>
                                                        {draft.channel === 'Email' ? '📧 Email' : '💬 WeChat'}
                                                    </span>
                                                </div>
                                            </div>
                                            <p style={{ fontSize: '13px', color: '#666', margin: '12px 0 0 0', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                                                {draft.body?.substring(0, 200)}{draft.body?.length > 200 ? '...' : ''}
                                            </p>
                                        </div>

                                        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                            <button
                                                onClick={() => handleSend(draft)}
                                                style={{
                                                    flex: 1,
                                                    padding: '10px 16px',
                                                    background: '#dc2626',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontSize: '13px',
                                                    fontWeight: '500',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '6px'
                                                }}
                                            >
                                                <span>📤</span> Send
                                            </button>
                                            <button
                                                onClick={() => handleEdit(draft)}
                                                style={{
                                                    flex: 1,
                                                    padding: '10px 16px',
                                                    background: '#3b82f6',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontSize: '13px',
                                                    fontWeight: '500',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '6px'
                                                }}
                                            >
                                                <span>✏️</span> Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(draft.id)}
                                                style={{
                                                    flex: 1,
                                                    padding: '10px 16px',
                                                    background: '#fee',
                                                    color: '#dc2626',
                                                    border: '1px solid #fecaca',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontSize: '13px',
                                                    fontWeight: '500',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '6px'
                                                }}
                                            >
                                                <span>🗑️</span> Delete
                                            </button>
                                        </div>

                                        <div style={{ fontSize: '12px', color: '#999' }}>
                                            ID: {draft.id}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DraftsList;
