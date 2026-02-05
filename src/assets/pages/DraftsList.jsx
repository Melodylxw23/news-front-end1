import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendBroadcast } from '../../api/broadcast';

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || '';

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
// WeChat was removed from backend; treat any legacy values as Email.
const normalizeChannels = (raw) => {
    const normalizeVal = (v) => {
        if (!v && v !== 0) return null;
        
        // Handle numeric enum values (legacy): treat anything as Email.
        if (typeof v === 'number') {
            return (v & 1) ? 'Email' : 'Email';
        }
        
        const val = v.trim();
        if (val === 'All' || val.toLowerCase() === 'all') return 'Email';
        if (val.toLowerCase() === 'wechat' || val.toLowerCase() === 'sms') return 'Email';
        return val.toLowerCase() === 'email' ? 'Email' : 'Email';
    };

    // Handle integer enum values from backend
    if (typeof raw === 'number') {
        const channels = [];
        if (raw & 1) channels.push('Email');   // Email = 1 (bit 0)
        return channels.length > 0 ? channels : ['Email'];
    }

    if (Array.isArray(raw)) {
        const result = raw.map(normalizeVal).filter(Boolean);
        return result.length > 0 ? result : ['Email'];
    }
    
    if (typeof raw === 'string') {
        const parts = raw.split(',').map((p) => normalizeVal(p)).filter(Boolean);
        if (parts.length > 0) return parts;
    }
    return ['Email'];
};

// Encode channels for backend (comma-separated string if multiple)
// Use comma without space to avoid backend parsing issues.
const toChannelPayload = (channels) => {
    const mapVal = (v) => {
        if (!v) return null;
        if (typeof v === 'string' && (v.toLowerCase() === 'wechat' || v.toLowerCase() === 'sms')) return 'Email';
        return v;
    };
    const arr = Array.isArray(channels) ? channels.map(mapVal).filter(Boolean) : [mapVal(channels)].filter(Boolean);
    if (arr.length === 0) return 'Email';
    if (arr.length === 1) return arr[0];
    return arr.join(',');
};

// Convert channel names to enum value for backend
// WeChat was removed; always send Email (1).
const toChannelEnumValue = (channels) => {
    return 1;
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
    channel: normalizeChannels(draft?.channel ?? draft?.Channel),
    selectedArticlesCount: draft?.selectedArticlesCount ?? draft?.SelectedArticlesCount ?? 0,
    selectedArticleIds: (() => {
        const direct = draft?.selectedArticleIds ?? draft?.SelectedArticleIds;
        if (Array.isArray(direct)) {
            const ids = direct
                .map((v) => (typeof v === 'string' ? parseInt(v, 10) : v))
                .filter((v) => typeof v === 'number' && !Number.isNaN(v));
            return Array.from(new Set(ids));
        }
        const raw = draft?.selectedArticles ?? draft?.SelectedArticles ?? [];
        if (!Array.isArray(raw)) return [];
        const ids = raw
            .map((x) => x?.publicationDraftId ?? x?.PublicationDraftId ?? x?.id ?? x?.Id)
            .map((v) => (typeof v === 'string' ? parseInt(v, 10) : v))
            .filter((v) => typeof v === 'number' && !Number.isNaN(v));
        return Array.from(new Set(ids));
    })()
});

const safeJsonParse = (text) => {
    if (!text) return null;
    try { return JSON.parse(text); } catch (e) { return null; }
};

const apiFetch = async (path, opts = {}) => {
  const token = localStorage.getItem('token');
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const fullPath = path.startsWith('http') ? path : `${API_BASE.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;

    const debug = import.meta.env.DEV && localStorage.getItem('debugApi') === '1';
    const requestBody = typeof opts.body === 'string' ? safeJsonParse(opts.body) : null;
    if (debug) {
        console.log('[DraftsList apiFetch] API_BASE:', API_BASE);
        console.log('[DraftsList apiFetch] request', opts.method || 'GET', fullPath, requestBody ?? opts.body);
    }

  const res = await fetch(fullPath, Object.assign({ headers }, opts));
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    const errorMsg = `HTTP ${res.status} ${res.statusText}${text ? ': ' + text : ''}`;
    console.error('[DraftsList apiFetch] response error', res.status, fullPath, text);
    throw new Error(errorMsg);
  }
    const parsed = safeJsonParse(text);
    if (debug) console.log('[DraftsList apiFetch] response success', res.status, fullPath, parsed ?? (text ? '[non-json response]' : null));
    return parsed ?? (text || null);
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
        scheduledSendAt: '',
        selectedArticleIds: []
    });
    const [loading, setLoading] = useState(true);
    const [loadingDetailId, setLoadingDetailId] = useState(null);

    // Published articles selection
    const [publishedArticles, setPublishedArticles] = useState([]);
    const [publishedLoading, setPublishedLoading] = useState(false);
    const [publishedError, setPublishedError] = useState(null);
    const [articleSearch, setArticleSearch] = useState('');

    // Tag filters for published articles
    const [availableIndustryTags, setAvailableIndustryTags] = useState([]);
    const [availableInterestTags, setAvailableInterestTags] = useState([]);
    const [tagsLoading, setTagsLoading] = useState(false);
    const [tagsError, setTagsError] = useState(null);
    const [selectedIndustryTagId, setSelectedIndustryTagId] = useState('');
    const [selectedInterestTagIds, setSelectedInterestTagIds] = useState([]);
    
    // Filter state
    const [filterChannel, setFilterChannel] = useState('All');
    const [filterAudience, setFilterAudience] = useState('All');

    useEffect(() => {
        fetchDrafts();
        fetchTags();
        fetchPublishedArticles();
    }, []);

    const fetchTags = async () => {
        try {
            setTagsLoading(true);
            setTagsError(null);
            const response = await apiFetch('/api/Broadcast/tags');
            const data = response?.data || response || {};
            const industry = Array.isArray(data?.IndustryTags) ? data.IndustryTags : (Array.isArray(data?.industryTags) ? data.industryTags : []);
            const interests = Array.isArray(data?.InterestTags) ? data.InterestTags : (Array.isArray(data?.interestTags) ? data.interestTags : []);
            setAvailableIndustryTags(industry);
            setAvailableInterestTags(interests);
        } catch (error) {
            console.error('[fetchTags] error:', error);
            setAvailableIndustryTags([]);
            setAvailableInterestTags([]);
            setTagsError(error?.message || 'Failed to load tags');
        } finally {
            setTagsLoading(false);
        }
    };

    const buildPublishedArticlesUrl = (industryTagId, interestTagIds) => {
        const industry = industryTagId ? String(industryTagId) : '';
        const interests = Array.isArray(interestTagIds) ? interestTagIds.filter(Boolean) : [];
        if (!industry && interests.length === 0) return '/api/Broadcast/published-articles';
        const params = [];
        if (industry) params.push(`industryTagId=${encodeURIComponent(industry)}`);
        interests.forEach((id) => params.push(`interestTagIds=${encodeURIComponent(String(id))}`));
        return `/api/Broadcast/published-articles/filter?${params.join('&')}`;
    };

    const fetchPublishedArticles = async (opts = null) => {
        try {
            setPublishedLoading(true);
            setPublishedError(null);
            const industry = opts?.industryTagId !== undefined ? opts.industryTagId : selectedIndustryTagId;
            const interests = opts?.interestTagIds !== undefined ? opts.interestTagIds : selectedInterestTagIds;
            const url = buildPublishedArticlesUrl(industry, interests);
            const response = await apiFetch(url);
            const data = response?.data || response || [];
            setPublishedArticles(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('[fetchPublishedArticles] error:', error);
            setPublishedArticles([]);
            setPublishedError(error?.message || 'Failed to load published articles');
        } finally {
            setPublishedLoading(false);
        }
    };

    const clearArticleFilters = async () => {
        setSelectedIndustryTagId('');
        setSelectedInterestTagIds([]);
        await fetchPublishedArticles({ industryTagId: '', interestTagIds: [] });
    };

    const toggleInterestFilter = async (interestTagId) => {
        const idNum = typeof interestTagId === 'string' ? parseInt(interestTagId, 10) : interestTagId;
        if (!idNum && idNum !== 0) return;
        const current = Array.isArray(selectedInterestTagIds) ? selectedInterestTagIds : [];
        const exists = current.includes(idNum);
        const next = exists ? current.filter((x) => x !== idNum) : [...current, idNum];
        setSelectedInterestTagIds(next);
        await fetchPublishedArticles({ industryTagId: selectedIndustryTagId, interestTagIds: next });
    };

    const toggleSelectedArticle = (publicationDraftId) => {
        const idNum = typeof publicationDraftId === 'string' ? parseInt(publicationDraftId, 10) : publicationDraftId;
        if (!idNum && idNum !== 0) return;
        const current = Array.isArray(editFormData.selectedArticleIds) ? editFormData.selectedArticleIds : [];
        const exists = current.includes(idNum);
        const next = exists ? current.filter((x) => x !== idNum) : [...current, idNum];
        setEditFormData({ ...editFormData, selectedArticleIds: next });
    };

    const fetchDrafts = async () => {
        try {
            setLoading(true);
            const debug = import.meta.env.DEV && localStorage.getItem('debugBroadcast') === '1';
            if (debug) console.log('[fetchDrafts] Starting fetch...');
            const response = await apiFetch('/api/Broadcast');
            if (debug) console.log('[fetchDrafts] Raw response:', response);
            
            const draftsData = response?.data || response || [];
            if (debug) console.log('[fetchDrafts] Processed draftsData length:', Array.isArray(draftsData) ? draftsData.length : 0);
            
            const normalizedDrafts = Array.isArray(draftsData) ? draftsData.map(normalizeDraft) : [];
            setDrafts(normalizedDrafts);
            if (debug) console.log('[fetchDrafts] Drafts set successfully');
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
        const id = draft?.id ?? draft?.Id;
        setEditingId(id);
        const audiences = normalizeAudience(draft.targetAudience ?? draft.TargetAudience);
        const selectedIds = Array.isArray(draft.selectedArticleIds) ? draft.selectedArticleIds : [];
        setEditFormData({
            title: draft.title || draft.Title || '',
            subject: draft.subject || draft.Subject || '',
            body: draft.body || draft.Body || '',
            channel: normalizeChannels(draft.channel ?? draft.Channel ?? 'Email'),
            targetAudience: audiences,
            scheduledSendAt: formatDateTimeForInput(draft.scheduledSendAt ?? draft.ScheduledSendAt),
            selectedArticleIds: selectedIds
        });

        // List DTO may not include Body/SelectedArticles; fetch detail DTO on demand.
        if (!draft.body && !draft.Body) {
            (async () => {
                try {
                    setLoadingDetailId(id);
                    const detail = await apiFetch(`/api/Broadcast/${id}`);
                    const payload = detail?.data || detail || {};
                    const body = payload?.body ?? payload?.Body ?? '';

                    const selectedArticles = payload?.selectedArticles ?? payload?.SelectedArticles ?? [];
                    const detailSelectedIds = Array.isArray(selectedArticles)
                        ? selectedArticles
                            .map((x) => x?.publicationDraftId ?? x?.PublicationDraftId)
                            .map((v) => (typeof v === 'string' ? parseInt(v, 10) : v))
                            .filter((v) => typeof v === 'number' && !Number.isNaN(v))
                        : [];

                    setEditFormData((prev) => ({
                        ...prev,
                        body,
                        selectedArticleIds: detailSelectedIds.length ? Array.from(new Set(detailSelectedIds)) : prev.selectedArticleIds
                    }));
                } catch (e) {
                    console.error('[handleEdit] failed to fetch detail:', e);
                    alert('Failed to load broadcast details: ' + (e?.message || e));
                } finally {
                    setLoadingDetailId(null);
                }
            })();
        }
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
                ScheduledSendAt: editFormData.scheduledSendAt || null,
                SelectedArticleIds: Array.isArray(editFormData.selectedArticleIds) ? editFormData.selectedArticleIds : []
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
        let toSend = draft;

        // List DTO may not include Body; fetch detail if needed.
        if (!toSend?.body && !toSend?.Body) {
            try {
                setLoadingDetailId(draft?.id ?? draft?.Id);
                const detail = await apiFetch(`/api/Broadcast/${draft?.id ?? draft?.Id}`);
                toSend = detail?.data || detail || draft;
            } catch (e) {
                console.error('[handleSend] failed to fetch detail:', e);
                alert('Cannot send: failed to load full message details. ' + (e?.message || e));
                return;
            } finally {
                setLoadingDetailId(null);
            }
        }

        // Validation
        const title = (toSend?.title ?? toSend?.Title ?? '').trim();
        const subject = (toSend?.subject ?? toSend?.Subject ?? '').trim();
        const body = (toSend?.body ?? toSend?.Body ?? '').trim();
        if (!title || !subject || !body) {
            alert('Cannot send: Title, Subject, and Message Body are all required.');
            return;
        }
        
        // Build audience description from normalized audience array
        const audiences = normalizeAudience(toSend.targetAudience ?? toSend.TargetAudience);
        let audienceDesc = 'All Members';
        if (audiences.includes(0)) {
            audienceDesc = 'All Members';
        } else if (audiences.length > 0) {
            audienceDesc = audiences.map(getAudienceLabel).join(', ');
        }

        const channels = normalizeChannels(toSend.channel ?? toSend.Channel);
        const channelDesc = channels.length === 1 ? channels[0] : channels.join(', ');
        
        if (!window.confirm(`Send "${subject}" to ${audienceDesc} via ${channelDesc} now?`)) return;
        
        try {
            const draftId = draft.id ?? draft.Id;
            console.log('[handleSend] sending broadcast:', draftId);
            
            // Send the broadcast using the same API as BroadcastManagement
            const result = await sendBroadcast(draftId);
            console.log('[handleSend] broadcast sent successfully:', result);
            
            alert('Broadcast sent successfully!');
            
            // Refresh the drafts list to show updated status
            fetchDrafts();
            
            // Navigate to success page
            navigate('/message-sent', { state: { broadcastSubject: subject || title } });
        } catch (error) {
            console.error('[handleSend] error sending broadcast:', error);
            alert('Failed to send broadcast: ' + error.message);
        }
    };

    const handleUnschedule = async (draft) => {
        const draftId = draft.id ?? draft.Id;
        const subject = draft.subject || draft.Subject;
        
        if (!window.confirm(`Cancel scheduled broadcast "${subject}"?\n\nThis will remove the scheduled send time and change status back to Draft.`)) {
            return;
        }

        try {
            console.log('[handleUnschedule] unscheduling broadcast:', draftId);
            
            await apiFetch(`/api/broadcast/${draftId}/unschedule`, {
                method: 'POST'
            });
            
            alert('✓ Broadcast unscheduled successfully!\n\nStatus changed back to Draft.');
            
            // Refresh the drafts list
            fetchDrafts();
        } catch (error) {
            console.error('[handleUnschedule] error:', error);
            alert('Failed to unschedule broadcast: ' + error.message);
        }
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditFormData({ title: '', subject: '', body: '', channel: ['Email'], targetAudience: [], scheduledSendAt: '', selectedArticleIds: [] });
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
                                            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#333' }}>
                                                Edit Draft
                                                {loadingDetailId === editingId && (
                                                    <span style={{ marginLeft: '10px', fontSize: '12px', fontWeight: '500', color: '#666' }}>
                                                        Loading details...
                                                    </span>
                                                )}
                                            </h3>
                                            
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
                                                    placeholder={loadingDetailId === editingId ? 'Loading message body...' : ''}
                                                />
                                            </div>

                                            <div style={{ marginBottom: '16px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', margin: 0, color: '#333' }}>
                                                        Attach Published Articles (Optional)
                                                    </label>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button
                                                            type="button"
                                                            onClick={fetchPublishedArticles}
                                                            style={{ padding: '6px 10px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                                                        >
                                                            Refresh
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={clearArticleFilters}
                                                            disabled={!selectedIndustryTagId && (selectedInterestTagIds || []).length === 0}
                                                            style={{ padding: '6px 10px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: (!selectedIndustryTagId && (selectedInterestTagIds || []).length === 0) ? 'not-allowed' : 'pointer', fontSize: '12px', opacity: (!selectedIndustryTagId && (selectedInterestTagIds || []).length === 0) ? 0.6 : 1 }}
                                                        >
                                                            Clear Filters
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditFormData({ ...editFormData, selectedArticleIds: [] })}
                                                            disabled={(editFormData.selectedArticleIds || []).length === 0}
                                                            style={{ padding: '6px 10px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: (editFormData.selectedArticleIds || []).length === 0 ? 'not-allowed' : 'pointer', fontSize: '12px', opacity: (editFormData.selectedArticleIds || []).length === 0 ? 0.6 : 1 }}
                                                        >
                                                            Clear
                                                        </button>
                                                    </div>
                                                </div>

                                                <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                                                    Selected: {(editFormData.selectedArticleIds || []).length}
                                                </div>

                                                <input
                                                    type="text"
                                                    value={articleSearch}
                                                    onChange={(e) => setArticleSearch(e.target.value)}
                                                    placeholder="Search by title..."
                                                    style={{ width: '100%', padding: '9px 10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '10px' }}
                                                />

                                                <div style={{ display: 'grid', gap: '10px', marginBottom: '10px' }}>
                                                    <div>
                                                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>Industry</div>
                                                        <select
                                                            value={selectedIndustryTagId}
                                                            disabled={tagsLoading}
                                                            onChange={async (e) => {
                                                                const next = e.target.value;
                                                                setSelectedIndustryTagId(next);
                                                                await fetchPublishedArticles({ industryTagId: next, interestTagIds: selectedInterestTagIds });
                                                            }}
                                                            style={{ width: '100%', padding: '9px 10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', background: 'white' }}
                                                        >
                                                            <option value="">All industries</option>
                                                            {(availableIndustryTags || []).map((t) => {
                                                                const id = t?.Id ?? t?.id;
                                                                const name = t?.Name ?? t?.name ?? `Industry ${id}`;
                                                                return <option key={id} value={id}>{name}</option>;
                                                            })}
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>Interest tags</div>
                                                        <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 10px', background: 'white', maxHeight: '110px', overflow: 'auto' }}>
                                                            {tagsLoading ? (
                                                                <div style={{ fontSize: '12px', color: '#666' }}>Loading tags...</div>
                                                            ) : (
                                                                (availableInterestTags || []).length === 0 ? (
                                                                    <div style={{ fontSize: '12px', color: '#666' }}>No interest tags available.</div>
                                                                ) : (
                                                                    (availableInterestTags || []).map((t) => {
                                                                        const id = t?.Id ?? t?.id;
                                                                        const name = t?.Name ?? t?.name ?? `Interest ${id}`;
                                                                        const checked = (selectedInterestTagIds || []).includes(id);
                                                                        return (
                                                                            <label key={id} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px', color: '#111827', cursor: 'pointer', padding: '3px 0' }}>
                                                                                <input type="checkbox" checked={checked} onChange={() => toggleInterestFilter(id)} style={{ width: '15px', height: '15px', cursor: 'pointer' }} />
                                                                                <span>{name}</span>
                                                                            </label>
                                                                        );
                                                                    })
                                                                )
                                                            )}
                                                        </div>
                                                    </div>

                                                    {tagsError && (
                                                        <div style={{ padding: '8px 10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', color: '#92400e', fontSize: '12px' }}>
                                                            {tagsError}
                                                        </div>
                                                    )}
                                                </div>

                                                {publishedError && (
                                                    <div style={{ padding: '8px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '12px', marginBottom: '10px' }}>
                                                        {publishedError}
                                                    </div>
                                                )}

                                                <div style={{ maxHeight: '220px', overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                                                    {publishedLoading ? (
                                                        <div style={{ padding: '12px', color: '#666', fontSize: '13px' }}>Loading published articles...</div>
                                                    ) : (
                                                        (publishedArticles || [])
                                                            .filter((a) => {
                                                                const title = (a?.title ?? a?.Title ?? '').toString().toLowerCase();
                                                                const q = (articleSearch || '').trim().toLowerCase();
                                                                return !q || title.includes(q);
                                                            })
                                                            .slice(0, 200)
                                                            .map((a) => {
                                                                const publicationDraftId = a?.publicationDraftId ?? a?.PublicationDraftId;
                                                                const title = a?.title ?? a?.Title ?? '(Untitled)';
                                                                const isSelected = (editFormData.selectedArticleIds || []).includes(publicationDraftId);
                                                                return (
                                                                    <div
                                                                        key={publicationDraftId}
                                                                        role="button"
                                                                        tabIndex={0}
                                                                        onClick={() => toggleSelectedArticle(publicationDraftId)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                                e.preventDefault();
                                                                                toggleSelectedArticle(publicationDraftId);
                                                                            }
                                                                        }}
                                                                        style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px', borderBottom: '1px solid #e5e7eb', cursor: 'pointer', background: isSelected ? '#fef2f2' : 'white' }}
                                                                    >
                                                                        <input type="checkbox" checked={!!isSelected} readOnly style={{ marginTop: '2px', width: '16px', height: '16px', accentColor: '#dc2626', cursor: 'pointer' }} />
                                                                        <div style={{ fontSize: '13px', color: '#111827', lineHeight: '1.4' }}>{title}</div>
                                                                    </div>
                                                                );
                                                            })
                                                    )}
                                                    {!publishedLoading && (publishedArticles || []).length === 0 && !publishedError && (
                                                        <div style={{ padding: '12px', color: '#666', fontSize: '13px' }}>No published articles available.</div>
                                                    )}
                                                </div>
                                            </div>

                                            <div style={{ marginBottom: '16px' }}>
                                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#333' }}>
                                                    Channel
                                                </label>
                                                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                                    {['Email'].map((ch) => {
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
                                                                    <div style={{ fontWeight: '600', color: '#333' }}>Email</div>
                                                                    <div style={{ fontSize: '12px', color: '#666' }}>6,449 subscribers</div>
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
                                        <div>
                                            <div style={{ marginBottom: '16px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                            <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: '#333' }}>
                                                                {draft.title || draft.subject || 'Untitled'}
                                                            </h3>
                                                            {draft.status && (
                                                                <span style={{
                                                                    display: 'inline-block',
                                                                    padding: '4px 10px',
                                                                    background: draft.status === 'Sent' || draft.status === 'sent' ? '#dcfce7' : draft.status === 'Scheduled' || draft.status === 'scheduled' ? '#fef3c7' : '#f3f4f6',
                                                                    color: draft.status === 'Sent' || draft.status === 'sent' ? '#166534' : draft.status === 'Scheduled' || draft.status === 'scheduled' ? '#92400e' : '#4b5563',
                                                                    borderRadius: '4px',
                                                                    fontSize: '11px',
                                                                    fontWeight: '600',
                                                                    textTransform: 'uppercase'
                                                                }}>
                                                                    {draft.status === 'Sent' || draft.status === 'sent' ? '✓ Sent' : draft.status === 'Scheduled' || draft.status === 'scheduled' ? '⏰ Scheduled' : draft.status}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
                                                            {draft.subject}
                                                        </p>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                        {channels.map((ch) => (
                                                            <span key={ch} style={{
                                                                display: 'inline-block',
                                                                padding: '4px 12px',
                                                                background: '#dbeafe',
                                                                color: '#1e40af',
                                                                borderRadius: '4px',
                                                                fontSize: '12px',
                                                                fontWeight: '500'
                                                            }}>
                                                                📧 Email
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
                                                    {draft.body ? (
                                                        <>{draft.body?.substring(0, 200)}{draft.body?.length > 200 ? '...' : ''}</>
                                                    ) : (
                                                        <span style={{ color: '#9ca3af' }}>Body not loaded in list view — click Edit to load.</span>
                                                    )}
                                                </p>
                                                <div style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
                                                    Selected articles: {draft.selectedArticlesCount ?? (draft.selectedArticleIds || []).length}
                                                </div>
                                                {(draft.scheduledSendAt || draft.ScheduledSendAt) && (
                                                    <div style={{ 
                                                        fontSize: '13px', 
                                                        color: '#92400e', 
                                                        marginTop: '10px',
                                                        padding: '8px 12px',
                                                        background: '#fef3c7',
                                                        borderRadius: '6px',
                                                        border: '1px solid #fcd34d',
                                                        display: 'inline-block'
                                                    }}>
                                                        ⏰ Scheduled for: {new Date(draft.scheduledSendAt || draft.ScheduledSendAt).toLocaleString()}
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                                {/* Show Send button only for non-sent drafts */}
                                                {!(draft.status === 'Sent' || draft.status === 'sent') && !(draft.status === 'Scheduled' || draft.status === 'scheduled') && (
                                                    <button
                                                        onClick={() => handleSend(draft)}
                                                        style={{
                                                            flex: '1 1 auto',
                                                            minWidth: '100px',
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
                                                        <span>📤</span> Send Now
                                                    </button>
                                                )}
                                                
                                                {/* Show Unschedule button for scheduled broadcasts */}
                                                {(draft.status === 'Scheduled' || draft.status === 'scheduled') && (
                                                    <button
                                                        onClick={() => handleUnschedule(draft)}
                                                        style={{
                                                            flex: '1 1 auto',
                                                            minWidth: '100px',
                                                            padding: '10px 16px',
                                                            background: '#f59e0b',
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
                                                        <span>🚫</span> Unschedule
                                                    </button>
                                                )}
                                                
                                                <button
                                                    onClick={() => handleEdit(draft)}
                                                    style={{
                                                        flex: '1 1 auto',
                                                        minWidth: '100px',
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
                                                        flex: '1 1 auto',
                                                        minWidth: '100px',
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
