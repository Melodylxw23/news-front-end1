import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || 'https://localhost:7191';

// Helper function to get audience label
const getAudienceLabel = (value) => {
  const labels = [
    'All Members',
    'Technology',
    'Business',
    'Sports',
    'Entertainment',
    'Politics'
  ];
  return labels[value] || 'All Members';
};

const normalizeAudience = (raw) => {
    console.log('[normalizeAudience] input:', raw, 'type:', typeof raw);
    if (raw === null || raw === undefined) {
        console.log('[normalizeAudience] null/undefined, returning [0]');
        return [0];
    }
    if (Array.isArray(raw)) {
        console.log('[normalizeAudience] array, returning as-is:', raw);
        return raw;
    }
    if (typeof raw === 'number') {
        // Decode bitmask back to individual selections
        if (raw === 0) return [0];
        const selected = [];
        console.log('[normalizeAudience] DECODING bitmask:', raw, '(binary:', raw.toString(2) + ')');
        if (raw & 2) {
            selected.push(1);
            console.log('  [normalizeAudience] bit 2 set -> Technology (1)');
        }
        if (raw & 4) {
            selected.push(2);
            console.log('  [normalizeAudience] bit 4 set -> Business (2)');
        }
        if (raw & 8) {
            selected.push(3);
            console.log('  [normalizeAudience] bit 8 set -> Sports (3)');
        }
        if (raw & 16) {
            selected.push(4);
            console.log('  [normalizeAudience] bit 16 set -> Entertainment (4)');
        }
        if (raw & 32) {
            selected.push(5);
            console.log('  [normalizeAudience] bit 32 set -> Politics (5)');
        }
        console.log('[normalizeAudience] RESULT - bitmask', raw, '-> selected array:', selected);
        return selected.length ? selected : [0];
    }
    if (typeof raw === 'string') {
        const map = {
            All: 0, AllMembers: 0, all: 0,
            TechnologyInterested: 1, Technology: 1, technology: 1,
            BusinessInterested: 2, Business: 2, business: 2,
            SportsInterested: 3, Sports: 3, sports: 3,
            EntertainmentInterested: 4, Entertainment: 4, entertainment: 4,
            PoliticsInterested: 5, Politics: 5, politics: 5
        };
        // Handle comma-separated values like "Technology, Sports, Politics"
        const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
        if (parts.length > 1) {
            console.log('[normalizeAudience] string list parts:', parts);
            const mappedParts = parts.map(p => map[p] ?? 0);
            console.log('[normalizeAudience] string list mapped:', raw, '->', mappedParts);
            if (mappedParts.includes(0)) return [0];
            const unique = [...new Set(mappedParts)];
            return unique.length ? unique : [0];
        }
        const mapped = map[raw] ?? 0;
        console.log('[normalizeAudience] string mapped:', raw, '->', mapped);
        return [mapped];
    }
    if (raw && typeof raw === 'object') {
        const flags = {
            all: raw.AllMembers ?? raw.allMembers ?? raw.all,
            tech: raw.TechnologyInterested ?? raw.technologyInterested ?? raw.tech,
            business: raw.BusinessInterested ?? raw.businessInterested,
            sports: raw.SportsInterested ?? raw.sportsInterested,
            entertainment: raw.EntertainmentInterested ?? raw.entertainmentInterested,
            politics: raw.PoliticsInterested ?? raw.politicsInterested
        };
        console.log('[normalizeAudience] object flags:', flags);
        if (flags.all) return [0];
        const mapped = [];
        if (flags.tech) mapped.push(1);
        if (flags.business) mapped.push(2);
        if (flags.sports) mapped.push(3);
        if (flags.entertainment) mapped.push(4);
        if (flags.politics) mapped.push(5);
        const result = mapped.length ? mapped : [0];
        console.log('[normalizeAudience] object result:', result);
        return result;
    }
    console.log('[normalizeAudience] unhandled, returning [0]');
    return [0];
};

// Normalize channels to an array (supports integer enum, single string, comma-separated string, or array)
// Backend sends: Email=1, WeChat=2, Both=3, or "All" for both
const normalizeChannels = (raw) => {
    console.log('[normalizeChannels] input:', raw, 'type:', typeof raw);
    
    const normalizeVal = (v) => {
        if (!v && v !== 0) return null;
        
        // Handle numeric enum values: 1=Email, 2=WeChat, 3=Both
        if (typeof v === 'number') {
            if (v === 1) return 'Email';
            if (v === 2) return 'WeChat';
            if (v === 3) return null; // 3 means both, shouldn't be in array format
            return null;
        }
        
        const val = v.trim();
        // Special case: "All" means both Email and WeChat
        if (val === 'All' || val.toLowerCase() === 'all') return null; // We'll handle "All" specially
        if (val.toLowerCase() === 'sms') return 'WeChat';
        return val;
    };

    // Handle integer enum values from backend
    if (typeof raw === 'number') {
        const channels = [];
        if (raw & 1) channels.push('Email');   // Email = 1 (bit 0)
        if (raw & 2) channels.push('WeChat');  // WeChat = 2 (bit 1)
        console.log('[normalizeChannels] from number', raw, '-> channels:', channels);
        return channels.length > 0 ? channels : ['Email'];
    }

    // Handle "All" string - means both channels
    if (typeof raw === 'string') {
        if (raw === 'All' || raw.toLowerCase() === 'all') {
            console.log('[normalizeChannels] from string "All" -> both channels:', ['Email', 'WeChat']);
            return ['Email', 'WeChat'];
        }
    }

    if (Array.isArray(raw)) {
        const result = raw.map(normalizeVal).filter(Boolean);
        console.log('[normalizeChannels] from array:', raw, '-> filtered:', result);
        return result.length > 0 ? result : ['Email'];
    }
    
    if (typeof raw === 'string') {
        const parts = raw.split(',').map((p) => normalizeVal(p)).filter(Boolean);
        console.log('[normalizeChannels] from string:', raw, '-> parts:', parts);
        if (parts.length > 0) return parts;
    }
    
    console.log('[normalizeChannels] returning default: [Email]');
    return ['Email'];
};

// Encode channels for backend (comma-separated string if multiple)
// Use comma without space to avoid backend parsing issues.
const toChannelPayload = (channels) => {
    const mapVal = (v) => {
        if (!v) return null;
        return v === 'SMS' ? 'WeChat' : v;
    };
    const arr = Array.isArray(channels) ? channels.map(mapVal).filter(Boolean) : [mapVal(channels)].filter(Boolean);
    if (arr.length === 0) return 'Email';
    if (arr.length === 1) return arr[0];
    return arr.join(',');
};

// Convert channel names to enum value for backend
// Backend expects: Email=1, WeChat=2, Both=3 (Email+WeChat)
const toChannelEnumValue = (channels) => {
    const arr = Array.isArray(channels) ? channels : [channels].filter(Boolean);
    if (arr.length === 0) return 1; // Default to Email
    
    let value = 0;
    if (arr.includes('Email')) value |= 1;
    if (arr.includes('WeChat')) value |= 2;
    
    return value || 1; // Default to Email if nothing selected
};

const toAudienceEnumValue = (selected) => {
    const chosen = Array.isArray(selected) ? selected : [];
    console.log('[toAudienceEnumValue] INPUT - selected array:', chosen, 'length:', chosen.length);
    if (chosen.length === 0) {
        console.log('[toAudienceEnumValue] OUTPUT - empty array, returning 0 (All Members)');
        return 0;
    }
    if (chosen.includes(0)) {
        console.log('[toAudienceEnumValue] OUTPUT - includes 0 (All Members), returning 0');
        return 0;
    }
    // Use bitwise OR to combine multiple selections: Tech=2, Business=4, Sports=8, Entertainment=16, Politics=32
    const map = { 1: 2, 2: 4, 3: 8, 4: 16, 5: 32 };
    let result = 0;
    chosen.forEach(val => {
        const encoded = map[val];
        console.log(`  [toAudienceEnumValue] val=${val} -> encoded=${encoded}, result before: ${result}, after: ${result | encoded}`);
        if (map[val]) result |= map[val];
    });
    console.log('[toAudienceEnumValue] OUTPUT - final bitmask:', result, '(binary:', result.toString(2) + ')');
    return result || 0;
};

const normalizeDraft = (draft) => ({
    ...draft,
    targetAudience: normalizeAudience(draft?.targetAudience ?? draft?.TargetAudience),
    channel: normalizeChannels(draft?.channel ?? draft?.Channel)
});

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
        channel: ['Email'],
        targetAudience: [],
        scheduledSendAt: ''
    });
    const [loading, setLoading] = useState(true);
    
    // Filter state
    const [filterChannel, setFilterChannel] = useState('All');
    const [filterAudience, setFilterAudience] = useState('All');

    useEffect(() => {
        fetchDrafts();
    }, []);

    const fetchDrafts = async () => {
        try {
            setLoading(true);
            console.log('[fetchDrafts] Starting fetch...');
            const response = await apiFetch('/api/Broadcast');
            console.log('[fetchDrafts] Raw response:', response);
            
            const draftsData = response?.data || response || [];
            console.log('[fetchDrafts] Processed draftsData:', draftsData);
            
            if (Array.isArray(draftsData)) {
                draftsData.forEach((draft, idx) => {
                    console.log('[fetchDrafts] Draft', idx, '- id:', draft.id, 'channel:', draft.channel, 'Channel:', draft.Channel, 'targetAudience:', draft.targetAudience, 'TargetAudience:', draft.TargetAudience);
                });
            }
            
            const normalizedDrafts = Array.isArray(draftsData) ? draftsData.map(normalizeDraft) : [];
            setDrafts(normalizedDrafts);
            console.log('[fetchDrafts] Drafts set successfully with normalized audiences');
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
        const audiences = normalizeAudience(draft.targetAudience);
        setEditFormData({
            title: draft.title || '',
            subject: draft.subject || '',
            body: draft.body || '',
            channel: normalizeChannels(draft.channel || 'Email'),
            targetAudience: audiences,
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
            
            // Validation
            if (!editFormData.title?.trim()) {
                alert('Title is required');
                return;
            }
            if (!editFormData.subject?.trim()) {
                alert('Subject is required');
                return;
            }
            if (!editFormData.body?.trim()) {
                alert('Message body is required');
                return;
            }
            
            const selectedAudience = editFormData.targetAudience?.length ? editFormData.targetAudience : [0];
            const encodedAudience = toAudienceEnumValue(selectedAudience);
            console.log('[handleSaveEdit] selectedAudience array:', selectedAudience, '-> encoded value:', encodedAudience);
            
            const channelEnumValue = toChannelEnumValue(editFormData.channel);
            const updateData = {
                Title: editFormData.title,
                Subject: editFormData.subject,
                Body: editFormData.body,
                Channel: channelEnumValue,
                TargetAudience: encodedAudience,
                ScheduledSendAt: editFormData.scheduledSendAt || null
            };
            console.log('[handleSaveEdit] channel array:', editFormData.channel, '-> enum value:', channelEnumValue);
            console.log('[handleSaveEdit] sending payload:', updateData);
            
            console.log('[handleSaveEdit] CRITICAL - TargetAudience value being sent:', updateData.TargetAudience, 'type:', typeof updateData.TargetAudience);
            const response = await apiFetch(`/api/Broadcast/${editingId}`, {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });
            console.log('[handleSaveEdit] response from backend:', response);
            console.log('[handleSaveEdit] response TargetAudience:', response?.TargetAudience || response?.targetAudience, 'type:', typeof (response?.TargetAudience || response?.targetAudience));
            
            alert('Draft updated successfully!');
            setEditingId(null);
            fetchDrafts();
        } catch (error) {
            console.error('[handleSaveEdit] error:', error);
            alert('Failed to update draft: ' + error.message);
        }
    };

    const handleSend = async (draft) => {
        // Validation
        if (!draft.title?.trim() || !draft.subject?.trim() || !draft.body?.trim()) {
            alert('Cannot send: Title, Subject, and Message Body are all required.');
            return;
        }
        
        // Build audience description from normalized audience array
        const audiences = normalizeAudience(draft.targetAudience ?? draft.TargetAudience);
        let audienceDesc = 'All Members';
        if (audiences.includes(0)) {
            audienceDesc = 'All Members';
        } else if (audiences.length > 0) {
            audienceDesc = audiences.map(getAudienceLabel).join(', ');
        }

        const channels = normalizeChannels(draft.channel ?? draft.Channel);
        const channelDesc = channels.length === 1 ? channels[0] : channels.join(', ');
        
        if (!window.confirm(`Send "${draft.subject}" to ${audienceDesc} via ${channelDesc} now?`)) return;
        
        try {
            // Delete the draft after sending
            console.log('[handleSend] deleting draft:', draft.id);
            await apiFetch(`/api/Broadcast/${draft.id}`, { method: 'DELETE' });
            console.log('[handleSend] draft deleted successfully');
            // Navigate to success page with draft info
            navigate('/message-sent', { state: { broadcastSubject: draft.subject || draft.title } });
        } catch (error) {
            console.error('[handleSend] error deleting draft:', error);
            alert('Broadcast sent but failed to delete draft: ' + error.message);
        }
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditFormData({ title: '', subject: '', body: '', channel: ['Email'], targetAudience: [], scheduledSendAt: '' });
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
                        onClick={() => navigate('/admin/broadcast')}
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
                            onClick={() => navigate('/admin/broadcast')}
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
                    <div>
                        {/* Filters */}
                        <div style={{ 
                            background: 'white', 
                            padding: '20px', 
                            borderRadius: '12px', 
                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)', 
                            marginBottom: '20px',
                            display: 'flex',
                            gap: '16px',
                            flexWrap: 'wrap',
                            alignItems: 'flex-end'
                        }}>
                            <div style={{ flex: '1', minWidth: '200px' }}>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#333' }}>
                                    Filter by Channel
                                </label>
                                <select
                                    value={filterChannel}
                                    onChange={(e) => setFilterChannel(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '6px',
                                        fontSize: '14px',
                                        fontFamily: 'inherit',
                                        background: 'white',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <option value="All">All Channels</option>
                                    <option value="Email">Email</option>
                                    <option value="WeChat">WeChat</option>
                                </select>
                            </div>
                            
                            <div style={{ flex: '1', minWidth: '200px' }}>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#333' }}>
                                    Filter by Target Audience
                                </label>
                                <select
                                    value={filterAudience}
                                    onChange={(e) => setFilterAudience(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '6px',
                                        fontSize: '14px',
                                        fontFamily: 'inherit',
                                        background: 'white',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <option value="All">All Audiences</option>
                                    <option value="0">All Members</option>
                                    <option value="1">Technology</option>
                                    <option value="2">Business</option>
                                    <option value="3">Sports</option>
                                    <option value="4">Entertainment</option>
                                    <option value="5">Politics</option>
                                </select>
                            </div>
                            
                            {(filterChannel !== 'All' || filterAudience !== 'All') && (
                                <button
                                    onClick={() => {
                                        setFilterChannel('All');
                                        setFilterAudience('All');
                                    }}
                                    style={{
                                        padding: '10px 16px',
                                        background: '#f3f4f6',
                                        color: '#333',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: '500',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    Clear Filters
                                </button>
                            )}
                        </div>
                        
                        <div style={{ display: 'grid', gap: '16px' }}>
                        {drafts.filter(draft => {
                            // Apply channel filter
                            if (filterChannel !== 'All') {
                                const channels = normalizeChannels(draft.channel ?? draft.Channel);
                                if (!channels.includes(filterChannel)) {
                                    return false;
                                }
                            }
                            
                            // Apply audience filter
                            if (filterAudience !== 'All') {
                                const audiences = normalizeAudience(draft.targetAudience ?? draft.TargetAudience);
                                const filterValue = parseInt(filterAudience);
                                if (!audiences.includes(filterValue)) {
                                    return false;
                                }
                            }
                            
                            return true;
                        }).map((draft) => {
                            const audiences = normalizeAudience(draft.targetAudience ?? draft.TargetAudience);
                            const channels = normalizeChannels(draft.channel ?? draft.Channel);
                            return (
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
                                                    Channels (Select Multiple)
                                                </label>
                                                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                                    {['Email', 'WeChat'].map((ch) => {
                                                        const isSelected = editFormData.channel.includes(ch);
                                                        return (
                                                            <label
                                                                key={ch}
                                                                onClick={() => {
                                                                    const current = editFormData.channel;
                                                                    const exists = current.includes(ch);
                                                                    let next = exists ? current.filter((c) => c !== ch) : [...current, ch];
                                                                    if (next.length === 0) next = ['Email'];
                                                                    setEditFormData({ ...editFormData, channel: next });
                                                                }}
                                                                style={{
                                                                    flex: '1',
                                                                    minWidth: '160px',
                                                                    padding: '12px',
                                                                    border: isSelected ? '2px solid #dc2626' : '1px solid #e5e7eb',
                                                                    borderRadius: '8px',
                                                                    cursor: 'pointer',
                                                                    background: isSelected ? '#fef2f2' : 'white',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '8px',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isSelected}
                                                                    readOnly
                                                                    style={{ width: '18px', height: '18px', accentColor: '#dc2626', cursor: 'pointer' }}
                                                                />
                                                                <div>
                                                                    <div style={{ fontWeight: '600', color: '#333' }}>{ch === 'Email' ? 'Email' : 'WeChat'}</div>
                                                                    <div style={{ fontSize: '12px', color: '#666' }}>{ch === 'Email' ? '6,449 subscribers' : '16,189 subscribers'}</div>
                                                                </div>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div style={{ marginBottom: '16px' }}>
                                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#333' }}>
                                                    Target Audience (Select Multiple)
                                                </label>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {[
                                                        { value: 0, label: 'All Members' },
                                                        { value: 1, label: 'Technology Interested' },
                                                        { value: 2, label: 'Business Interested' },
                                                        { value: 3, label: 'Sports Interested' },
                                                        { value: 4, label: 'Entertainment Interested' },
                                                        { value: 5, label: 'Politics Interested' }
                                                    ].map((option) => (
                                                        <label key={option.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={editFormData.targetAudience.includes(option.value)}
                                                                onChange={(e) => {
                                                                    const checked = e.target.checked;
                                                                    if (checked) {
                                                                        if (option.value === 0) {
                                                                            setEditFormData({ ...editFormData, targetAudience: [0] });
                                                                        } else {
                                                                            const newAudience = editFormData.targetAudience.includes(0)
                                                                                ? [option.value]
                                                                                : [...editFormData.targetAudience, option.value];
                                                                            setEditFormData({ ...editFormData, targetAudience: newAudience });
                                                                        }
                                                                    } else {
                                                                        setEditFormData({
                                                                            ...editFormData,
                                                                            targetAudience: editFormData.targetAudience.filter(v => v !== option.value)
                                                                        });
                                                                    }
                                                                }}
                                                                style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                                                            />
                                                            <span style={{ fontSize: '14px', color: '#333' }}>{option.label}</span>
                                                        </label>
                                                    ))}
                                                </div>
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
                                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                        {channels.map((ch) => (
                                                            <span key={ch} style={{
                                                                display: 'inline-block',
                                                                padding: '4px 12px',
                                                                background: ch === 'Email' ? '#dbeafe' : '#dcfce7',
                                                                color: ch === 'Email' ? '#1e40af' : '#166534',
                                                                borderRadius: '4px',
                                                                fontSize: '12px',
                                                                fontWeight: '500'
                                                            }}>
                                                                {ch === 'Email' ? '📧 Email' : '💬 WeChat'}
                                                            </span>
                                                        ))}
                                                        {audiences.includes(0) ? (
                                                            <span style={{
                                                                display: 'inline-block',
                                                                padding: '4px 12px',
                                                                background: '#f3e8ff',
                                                                color: '#7e22ce',
                                                                borderRadius: '4px',
                                                                fontSize: '12px',
                                                                fontWeight: '500'
                                                            }}>
                                                                👥 All Members
                                                            </span>
                                                        ) : (
                                                            audiences.map((audienceVal) => (
                                                                <span key={audienceVal} style={{
                                                                    display: 'inline-block',
                                                                    padding: '4px 12px',
                                                                    background: '#f3e8ff',
                                                                    color: '#7e22ce',
                                                                    borderRadius: '4px',
                                                                    fontSize: '12px',
                                                                    fontWeight: '500'
                                                                }}>
                                                                    👥 {getAudienceLabel(audienceVal)}
                                                                </span>
                                                            ))
                                                        )}
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
                            );
                        })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DraftsList;
