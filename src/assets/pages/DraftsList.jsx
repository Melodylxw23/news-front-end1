import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendBroadcast, previewTargetedMembers } from '../../api/broadcast';

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
    if (raw === null || raw === undefined) {
        return [0];
    }
    if (Array.isArray(raw)) {
        return raw;
    }
    if (typeof raw === 'number') {
        // Decode bitmask back to individual selections
        if (raw === 0) return [0];
        const selected = [];
        if (raw & 2) {
            selected.push(1);
        }
        if (raw & 4) {
            selected.push(2);
        }
        if (raw & 8) {
            selected.push(3);
        }
        if (raw & 16) {
            selected.push(4);
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

const normalizeDraft = (draft) => {
    const normalized = {
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
    };
    
    // Preserve tag data - try multiple property names
    const interestIds = draft?.selectedInterestTagIds ?? draft?.SelectedInterestTagIds ?? draft?.interestTagIds ?? draft?.InterestTagIds ?? [];
    const industryIds = draft?.selectedIndustryTagIds ?? draft?.SelectedIndustryTagIds ?? draft?.industryTagIds ?? draft?.IndustryTagIds ?? [];
    
    if (Array.isArray(interestIds)) {
        normalized.selectedInterestTagIds = interestIds.map(v => typeof v === 'string' ? parseInt(v, 10) : v).filter(v => typeof v === 'number' && !Number.isNaN(v));
    }
    if (Array.isArray(industryIds)) {
        normalized.selectedIndustryTagIds = industryIds.map(v => typeof v === 'string' ? parseInt(v, 10) : v).filter(v => typeof v === 'number' && !Number.isNaN(v));
    }
    
if ((normalized.selectedInterestTagIds || []).length > 0 || (normalized.selectedIndustryTagIds || []).length > 0) {
                console.log('[normalizeDraft] Draft', draft.id, '- Tags preserved:', {
                    interest: normalized.selectedInterestTagIds?.length || 0,
                    industry: normalized.selectedIndustryTagIds?.length || 0
                });
            }
    
    return normalized;
};

const safeJsonParse = (text) => {
    if (!text) return null;
    try { return JSON.parse(text); } catch (e) { return null; }
};

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
        // legacy array kept for backward-compat, prefer tag ids below
        targetAudience: [],
        // New tag-based targeting
        selectedInterestTagIds: [],
        selectedIndustryTagIds: [],
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
    const [isLoadingTargetingPreview, setIsLoadingTargetingPreview] = useState(false);
    const [previewedTargetedMembers, setPreviewedTargetedMembers] = useState(null);
    const [targetingTagsError, setTargetingTagsError] = useState(null);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    
    // Filter state
    const [filterInterestTagIds, setFilterInterestTagIds] = useState([]);
    const [filterIndustryTagIds, setFilterIndustryTagIds] = useState([]);

    useEffect(() => {
        fetchDrafts();
    }, []);

    const fetchTags = async () => {
        try {
            setTagsLoading(true);
            setTagsError(null);
            const response = await apiFetch('/api/broadcast/tags');
            const data = response?.data || response || {};
            const industry = Array.isArray(data?.IndustryTags) ? data.IndustryTags : (Array.isArray(data?.industryTags) ? data.industryTags : []);
            const interests = Array.isArray(data?.InterestTags) ? data.InterestTags : (Array.isArray(data?.interestTags) ? data.interestTags : []);
            // Deduplicate tags by id and normalize keys
            const normalizeAndDedupe = (arr) => {
                const map = new Map();
                (arr || []).forEach((t) => {
                    const id = t?.Id ?? t?.id;
                    if (id === undefined || id === null) return;
                    const existing = map.get(id) || {};
                    map.set(id, {
                        id,
                        name: t?.Name ?? t?.name ?? existing.name,
                        nameEN: t?.NameEN ?? t?.nameEN ?? t?.name ?? existing.nameEN ?? existing.name,
                        memberCount: t?.MemberCount ?? t?.memberCount ?? existing.memberCount ?? 0
                    });
                });
                return Array.from(map.values());
            };

            setAvailableIndustryTags(normalizeAndDedupe(industry));
            setAvailableInterestTags(normalizeAndDedupe(interests));
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
        if (!industry && interests.length === 0) return '/api/broadcast/published-articles';
        const params = [];
        if (industry) params.push(`industryTagId=${encodeURIComponent(industry)}`);
        interests.forEach((id) => params.push(`interestTagIds=${encodeURIComponent(String(id))}`));
        return `/api/broadcast/published-articles/filter?${params.join('&')}`;
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

    // Helpers to extract tag ids from draft objects (support multiple backend shapes)
    const getDraftInterestIds = (draft) => {
        const raw = draft?.selectedInterestTagIds ?? draft?.SelectedInterestTagIds ?? draft?.interestTagIds ?? draft?.InterestTagIds ?? draft?.interests ?? draft?.InterestIds ?? [];
        if (!Array.isArray(raw)) return [];
        return raw.map(v => (typeof v === 'string' ? parseInt(v, 10) : v)).filter(v => typeof v === 'number' && !Number.isNaN(v));
    };

    const getDraftIndustryIds = (draft) => {
        const raw = draft?.selectedIndustryTagIds ?? draft?.SelectedIndustryTagIds ?? draft?.industryTagIds ?? draft?.IndustryTagIds ?? draft?.industries ?? draft?.IndustryIds ?? [];
        if (!Array.isArray(raw)) return [];
        return raw.map(v => (typeof v === 'string' ? parseInt(v, 10) : v)).filter(v => typeof v === 'number' && !Number.isNaN(v));
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

    const toggleEditInterestTag = (tagId) => {
        const idNum = typeof tagId === 'string' ? parseInt(tagId, 10) : tagId;
        if (!idNum && idNum !== 0) return;
        const current = Array.isArray(editFormData.selectedInterestTagIds) ? editFormData.selectedInterestTagIds : [];
        const exists = current.includes(idNum);
        const next = exists ? current.filter((x) => x !== idNum) : [...current, idNum];
        setEditFormData({ ...editFormData, selectedInterestTagIds: next });
    };

    const toggleEditIndustryTag = (tagId) => {
        const idNum = typeof tagId === 'string' ? parseInt(tagId, 10) : tagId;
        if (!idNum && idNum !== 0) return;
        const current = Array.isArray(editFormData.selectedIndustryTagIds) ? editFormData.selectedIndustryTagIds : [];
        const exists = current.includes(idNum);
        const next = exists ? current.filter((x) => x !== idNum) : [...current, idNum];
        setEditFormData({ ...editFormData, selectedIndustryTagIds: next });
    };

    const handlePreviewTargetedMembers = async () => {
        try {
            setIsLoadingTargetingPreview(true);
            setTargetingTagsError(null);
            console.log('[handlePreviewTargetedMembers] Called with tags:', { 
                interest: editFormData.selectedInterestTagIds, 
                industry: editFormData.selectedIndustryTagIds 
            });
            const preview = await previewTargetedMembers(
                editFormData.selectedInterestTagIds || [],
                editFormData.selectedIndustryTagIds || []
            );
            console.log('[handlePreviewTargetedMembers] Response:', preview);
            setPreviewedTargetedMembers(preview);
        } catch (err) {
            console.error('[handlePreviewTargetedMembers] error', err);
            setTargetingTagsError(err?.message || 'Failed to preview targeted members');
        } finally {
            setIsLoadingTargetingPreview(false);
        }
    };

    // Auto-preview when edit tags change (debounced)
    useEffect(() => {
        const timer = setTimeout(() => {
            console.log('[Preview useEffect] editingId:', editingId, 'tags:', { 
                interest: editFormData.selectedInterestTagIds?.length, 
                industry: editFormData.selectedIndustryTagIds?.length 
            });
            if (editingId && (editFormData.selectedInterestTagIds?.length > 0 || editFormData.selectedIndustryTagIds?.length > 0)) {
                console.log('[Preview useEffect] Calling handlePreviewTargetedMembers');
                handlePreviewTargetedMembers();
            } else {
                console.log('[Preview useEffect] Skipping preview - missing editingId or tags');
                setPreviewedTargetedMembers(null);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [editFormData.selectedInterestTagIds, editFormData.selectedIndustryTagIds]);

    const fetchDrafts = async () => {
        try {
            setLoading(true);
            const debug = import.meta.env.DEV && localStorage.getItem('debugBroadcast') === '1';
            if (debug) console.log('[fetchDrafts] Starting fetch...');
            const response = await apiFetch('/api/broadcast');
            if (debug) console.log('[fetchDrafts] Raw response:', response);
            
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
            await apiFetch(`/api/broadcast/${id}`, { method: 'DELETE' });
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
        // New tag-based fields (backend may provide these names)
        const interestTags = Array.isArray(draft.selectedInterestTagIds) ? draft.selectedInterestTagIds : (Array.isArray(draft.SelectedInterestTagIds) ? draft.SelectedInterestTagIds : []);
        const industryTags = Array.isArray(draft.selectedIndustryTagIds) ? draft.selectedIndustryTagIds : (Array.isArray(draft.SelectedIndustryTagIds) ? draft.SelectedIndustryTagIds : []);
        
        if ((interestTags || []).length > 0 || (industryTags || []).length > 0) {
            console.log('[handleEdit] ✅ Tags loaded from list - Interest:', interestTags, 'Industry:', industryTags);
        }
        
        setEditFormData({
            title: draft.title || '',
            subject: draft.subject || '',
            body: draft.body || '',
            channel: normalizeChannels(draft.channel || 'Email'),
            targetAudience: audiences,
            selectedInterestTagIds: interestTags,
            selectedIndustryTagIds: industryTags,
            scheduledSendAt: formatDateTimeForInput(draft.scheduledSendAt ?? draft.ScheduledSendAt),
            selectedArticleIds: selectedIds
        });

        // ALWAYS fetch detail to ensure we have complete data (body, articles, and TAGS)
        (async () => {
            try {
                setLoadingDetailId(id);
                const detail = await apiFetch(`/api/broadcast/${id}`);
                const payload = detail?.data || detail || {};
                
                const body = payload?.body ?? payload?.Body ?? '';

                const selectedArticles = payload?.selectedArticles ?? payload?.SelectedArticles ?? [];
                const detailSelectedIds = Array.isArray(selectedArticles)
                    ? selectedArticles
                        .map((x) => x?.publicationDraftId ?? x?.PublicationDraftId)
                        .map((v) => (typeof v === 'string' ? parseInt(v, 10) : v))
                        .filter((v) => typeof v === 'number' && !Number.isNaN(v))
                    : [];
                
                // Try multiple backend property names for tags (for compatibility)
                const detailInterestIds = payload?.selectedInterestTagIds ?? 
                                         payload?.SelectedInterestTagIds ?? 
                                         payload?.interestTagIds ?? 
                                         payload?.InterestTagIds ?? [];
                const detailIndustryIds = payload?.selectedIndustryTagIds ?? 
                                         payload?.SelectedIndustryTagIds ?? 
                                         payload?.industryTagIds ?? 
                                         payload?.IndustryTagIds ?? [];
                
                if ((detailInterestIds || []).length > 0 || (detailIndustryIds || []).length > 0) {
                    console.log('[handleEdit] ✅ Tags fetched from backend - Interest:', detailInterestIds, 'Industry:', detailIndustryIds);
                }
                
                setEditFormData((prev) => {
                    return {
                        ...prev,
                        body: body || prev.body,
                        selectedArticleIds: detailSelectedIds.length ? Array.from(new Set(detailSelectedIds)) : prev.selectedArticleIds,
                        selectedInterestTagIds: Array.isArray(detailInterestIds) && detailInterestIds.length > 0 ? detailInterestIds : prev.selectedInterestTagIds,
                        selectedIndustryTagIds: Array.isArray(detailIndustryIds) && detailIndustryIds.length > 0 ? detailIndustryIds : prev.selectedIndustryTagIds
                    };
                });
            } catch (e) {
                console.error('[handleEdit] ❌ Failed to fetch detail:', e);
                alert('Failed to load broadcast details: ' + (e?.message || e));
            } finally {
                setLoadingDetailId(null);
            }
        })();
    };

    const handleEditChange = (e) => {
        const { name, value } = e.target;
        setEditFormData({ ...editFormData, [name]: value });
    };

    const handleSaveEdit = async () => {
        try {
            console.log('[handleSaveEdit] Saving draft:', editingId, '- Tags:', {
                interest: editFormData.selectedInterestTagIds?.length || 0,
                industry: editFormData.selectedIndustryTagIds?.length || 0
            });
            
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
            
            // Use new tag-based targeting when available; keep legacy TargetAudience for backward compatibility
            const channelEnumValue = toChannelEnumValue(editFormData.channel);
            const updateData = {
                Title: editFormData.title,
                Subject: editFormData.subject,
                Body: editFormData.body,
                Channel: channelEnumValue,
                // New tag-based targeting payload
                selectedInterestTagIds: Array.isArray(editFormData.selectedInterestTagIds) ? editFormData.selectedInterestTagIds : [],
                selectedIndustryTagIds: Array.isArray(editFormData.selectedIndustryTagIds) ? editFormData.selectedIndustryTagIds : [],
                // PascalCase variants for backend compatibility
                SelectedInterestTagIds: Array.isArray(editFormData.selectedInterestTagIds) ? editFormData.selectedInterestTagIds : [],
                SelectedIndustryTagIds: Array.isArray(editFormData.selectedIndustryTagIds) ? editFormData.selectedIndustryTagIds : [],
                // keep legacy field as neutral value
                TargetAudience: 0,
                ScheduledSendAt: editFormData.scheduledSendAt || null,
                SelectedArticleIds: Array.isArray(editFormData.selectedArticleIds) ? editFormData.selectedArticleIds : []
            };
            // Log channel mapping if verbose debug enabled
            if (import.meta.env.DEV && localStorage.getItem('debugBroadcast') === '1') {
                console.log('[handleSaveEdit] channel array:', editFormData.channel, '-> enum value:', channelEnumValue);
                console.log('[handleSaveEdit] payload:', updateData);
            }
            const response = await apiFetch(`/api/broadcast/${editingId}`, {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });
            
            if (import.meta.env.DEV && localStorage.getItem('debugBroadcast') === '1') {
                console.log('[handleSaveEdit] Response from backend:', response);
                console.log('[handleSaveEdit] Response tag fields:', {
                    selectedInterestTagIds: response?.selectedInterestTagIds,
                    SelectedInterestTagIds: response?.SelectedInterestTagIds,
                    selectedIndustryTagIds: response?.selectedIndustryTagIds,
                    SelectedIndustryTagIds: response?.SelectedIndustryTagIds
                });
            }
            
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
                const detail = await apiFetch(`/api/broadcast/${draft?.id ?? draft?.Id}`);
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
            
            await apiFetch(`/api/broadcast/${draftId}`, {
                method: 'PUT',
                body: JSON.stringify({ scheduledSendAt: null })
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
        setEditFormData({ title: '', subject: '', body: '', channel: ['Email'], targetAudience: [], selectedInterestTagIds: [], selectedIndustryTagIds: [], scheduledSendAt: '', selectedArticleIds: [] });
        setPreviewedTargetedMembers(null);
        setTargetingTagsError(null);
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
                            {/* Active filters summary and clear button */}
                            {(filterInterestTagIds.length > 0 || filterIndustryTagIds.length > 0) && (
                                <div style={{ 
                                    flexBasis: '100%', 
                                    marginTop: '12px', 
                                    padding: '12px', 
                                    background: 'linear-gradient(135deg, #fef7ff 0%, #f0f9ff 100%)', 
                                    borderRadius: '8px', 
                                    border: '1px solid #e2e8f0',
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: '12px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                                            🔍 Active Filters:
                                        </span>
                                        {filterInterestTagIds.length > 0 && (
                                            <span style={{ 
                                                padding: '2px 8px', 
                                                background: '#dc2626', 
                                                color: 'white', 
                                                borderRadius: '12px', 
                                                fontSize: '11px',
                                                fontWeight: '600'
                                            }}>
                                                {filterInterestTagIds.length} Interest
                                            </span>
                                        )}
                                        {filterIndustryTagIds.length > 0 && (
                                            <span style={{ 
                                                padding: '2px 8px', 
                                                background: '#8b5cf6', 
                                                color: 'white', 
                                                borderRadius: '12px', 
                                                fontSize: '11px',
                                                fontWeight: '600'
                                            }}>
                                                {filterIndustryTagIds.length} Industry
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => {
                                            setFilterInterestTagIds([]);
                                            setFilterIndustryTagIds([]);
                                        }}
                                        style={{
                                            background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                                            color: 'white',
                                            border: 'none',
                                            padding: '6px 14px',
                                            borderRadius: '6px',
                                            fontSize: '12px',
                                            cursor: 'pointer',
                                            fontWeight: '600',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onMouseOver={(e) => e.target.style.transform = 'translateY(-1px)'}
                                        onMouseOut={(e) => e.target.style.transform = 'translateY(0px)'}
                                    >
                                        🗑️ Clear All
                                    </button>
                                </div>
                            )}
                            
                            <div style={{ flex: '1', minWidth: '250px' }}>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#333' }}>
                                    Filter by Interest Tags 
                                    {filterInterestTagIds.length > 0 && (
                                        <span style={{ 
                                            marginLeft: '8px', 
                                            padding: '1px 6px', 
                                            background: '#dc2626', 
                                            color: 'white', 
                                            borderRadius: '8px', 
                                            fontSize: '10px',
                                            fontWeight: '600'
                                        }}>
                                            {filterInterestTagIds.length}
                                        </span>
                                    )}
                                </label>
                                <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', background: 'white', maxHeight: '120px', overflow: 'auto' }}>
                                    {(availableInterestTags || []).length === 0 ? (
                                        <div style={{ padding: '12px', color: '#666', fontSize: '13px' }}>No interest tags available</div>
                                    ) : (
                                        (availableInterestTags || []).map(t => {
                                            const isSelected = filterInterestTagIds.includes(t.id);
                                            return (
                                                <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => {
                                                            if (isSelected) {
                                                                setFilterInterestTagIds(filterInterestTagIds.filter(id => id !== t.id));
                                                            } else {
                                                                setFilterInterestTagIds([...filterInterestTagIds, t.id]);
                                                            }
                                                        }}
                                                        style={{ width: '16px', height: '16px', accentColor: '#dc2626' }}
                                                    />
                                                    <span style={{ fontSize: '13px', color: '#333' }}>{t.name || t.nameEN || `Interest ${t.id}`}</span>
                                                </label>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                            <div style={{ flex: '1', minWidth: '250px' }}>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#333' }}>
                                    Filter by Industry Tags
                                    {filterIndustryTagIds.length > 0 && (
                                        <span style={{ 
                                            marginLeft: '8px', 
                                            padding: '1px 6px', 
                                            background: '#8b5cf6', 
                                            color: 'white', 
                                            borderRadius: '8px', 
                                            fontSize: '10px',
                                            fontWeight: '600'
                                        }}>
                                            {filterIndustryTagIds.length}
                                        </span>
                                    )}
                                </label>
                                <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', background: 'white', maxHeight: '120px', overflow: 'auto' }}>
                                    {(availableIndustryTags || []).length === 0 ? (
                                        <div style={{ padding: '12px', color: '#666', fontSize: '13px' }}>No industry tags available</div>
                                    ) : (
                                        (availableIndustryTags || []).map(t => {
                                            const isSelected = filterIndustryTagIds.includes(t.id);
                                            return (
                                                <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => {
                                                            if (isSelected) {
                                                                setFilterIndustryTagIds(filterIndustryTagIds.filter(id => id !== t.id));
                                                            } else {
                                                                setFilterIndustryTagIds([...filterIndustryTagIds, t.id]);
                                                            }
                                                        }}
                                                        style={{ width: '16px', height: '16px', accentColor: '#8b5cf6' }}
                                                    />
                                                    <span style={{ fontSize: '13px', color: '#333' }}>{t.name || t.nameEN || `Industry ${t.id}`}</span>
                                                </label>
                                            );
                                        })
                                    )}
                                </div>
            </div>
                            
                            {}
                        </div>
                        
                        {(() => {
                            const filteredDrafts = drafts.filter(draft => {
                                // Apply interest tag filter
                                if ((filterInterestTagIds || []).length > 0) {
                                    const draftInterest = getDraftInterestIds(draft);
                                    const has = draftInterest.some(id => filterInterestTagIds.includes(id));
                                    if (!has) return false;
                                }

                                // Apply industry tag filter
                                if ((filterIndustryTagIds || []).length > 0) {
                                    const draftIndustry = getDraftIndustryIds(draft);
                                    const hasI = draftIndustry.some(id => filterIndustryTagIds.includes(id));
                                    if (!hasI) return false;
                                }
                                
                                return true;
                            });
                            
                            return (
                                <>
                                    {/* Results counter */}
                                    <div style={{ 
                                        marginBottom: '16px', 
                                        padding: '12px 16px', 
                                        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', 
                                        borderRadius: '8px',
                                        border: '1px solid #cbd5e1',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        flexWrap: 'wrap',
                                        gap: '8px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#475569' }}>
                                                📋 Showing {filteredDrafts.length} of {drafts.length} draft{drafts.length !== 1 ? 's' : ''}
                                            </span>
                                            {filteredDrafts.length < drafts.length && (
                                                <span style={{ 
                                                    fontSize: '12px', 
                                                    color: '#64748b', 
                                                    padding: '2px 6px', 
                                                    background: '#f1f5f9', 
                                                    borderRadius: '4px' 
                                                }}>
                                                    Filtered
                                                </span>
                                            )}
                                        </div>
                                        {filteredDrafts.length === 0 && drafts.length > 0 && (
                                            <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: '500' }}>
                                                🚫 No drafts match your current filters
                                            </span>
                                        )}
                                    </div>
                        
                        <div style={{ display: 'grid', gap: '16px' }}>
                        {filteredDrafts.map((draft) => {
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
                                                                    <div style={{ fontWeight: '600', color: '#333' }}>Email</div>
                                                                </div>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div style={{ marginBottom: '16px' }}>
                                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#333' }}>
                                                    Target Audience
                                                </label>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                    <div>
                                                        <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            Interest Tags
                                                            <span style={{ 
                                                                padding: '2px 8px', 
                                                                background: (editFormData.selectedInterestTagIds || []).length > 0 ? '#dc2626' : '#e5e7eb', 
                                                                color: (editFormData.selectedInterestTagIds || []).length > 0 ? 'white' : '#666',
                                                                borderRadius: '12px', 
                                                                fontSize: '11px',
                                                                fontWeight: '600'
                                                            }}>
                                                                {(editFormData.selectedInterestTagIds || []).length} selected
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const allIds = availableInterestTags.map(t => t?.Id ?? t?.id);
                                                                    const isAllSelected = allIds.every(id => (editFormData.selectedInterestTagIds || []).includes(id));
                                                                    setEditFormData({
                                                                        ...editFormData,
                                                                        selectedInterestTagIds: isAllSelected ? [] : allIds
                                                                    });
                                                                }}
                                                                style={{
                                                                    padding: '2px 8px',
                                                                    fontSize: '11px',
                                                                    fontWeight: '600',
                                                                    background: '#f3f4f6',
                                                                    border: '1px solid #e5e7eb',
                                                                    borderRadius: '4px',
                                                                    cursor: 'pointer',
                                                                    marginLeft: '4px'
                                                                }}
                                                            >
                                                                {availableInterestTags.every(t => (editFormData.selectedInterestTagIds || []).includes(t?.Id ?? t?.id)) ? 'Clear' : 'All'}
                                                            </button>
                                                        </div>
                                                        <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px', background: '#fafafa', maxHeight: '200px', overflow: 'auto' }}>
                                                            {tagsLoading ? (
                                                                <div style={{ fontSize: '13px', color: '#666' }}>Loading tags...</div>
                                                            ) : (availableInterestTags.length === 0 ? (
                                                                <div style={{ fontSize: '13px', color: '#666' }}>No interest tags available.</div>
                                                            ) : (
                                                                availableInterestTags.map((t) => {
                                                                    const id = t?.Id ?? t?.id;
                                                                    const name = t?.Name ?? t?.name ?? `Interest ${id}`;
                                                                    const checked = (editFormData.selectedInterestTagIds || []).includes(id);
                                                                    return (
                                                                        <label key={id} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', color: '#111827', cursor: 'pointer', padding: '6px 0' }}>
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={checked}
                                                                                onChange={() => toggleEditInterestTag(id)}
                                                                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                                                            />
                                                                            <span>{name}</span>
                                                                        </label>
                                                                    );
                                                                })
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            Industry Tags
                                                            <span style={{ 
                                                                padding: '2px 8px', 
                                                                background: (editFormData.selectedIndustryTagIds || []).length > 0 ? '#8b5cf6' : '#e5e7eb', 
                                                                color: (editFormData.selectedIndustryTagIds || []).length > 0 ? 'white' : '#666',
                                                                borderRadius: '12px', 
                                                                fontSize: '11px',
                                                                fontWeight: '600'
                                                            }}>
                                                                {(editFormData.selectedIndustryTagIds || []).length} selected
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const allIds = availableIndustryTags.map(t => t?.Id ?? t?.id);
                                                                    const isAllSelected = allIds.every(id => (editFormData.selectedIndustryTagIds || []).includes(id));
                                                                    setEditFormData({
                                                                        ...editFormData,
                                                                        selectedIndustryTagIds: isAllSelected ? [] : allIds
                                                                    });
                                                                }}
                                                                style={{
                                                                    padding: '2px 8px',
                                                                    fontSize: '11px',
                                                                    fontWeight: '600',
                                                                    background: '#f3f4f6',
                                                                    border: '1px solid #e5e7eb',
                                                                    borderRadius: '4px',
                                                                    cursor: 'pointer',
                                                                    marginLeft: '4px'
                                                                }}
                                                            >
                                                                {availableIndustryTags.every(t => (editFormData.selectedIndustryTagIds || []).includes(t?.Id ?? t?.id)) ? 'Clear' : 'All'}
                                                            </button>
                                                        </div>
                                                        <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px', background: '#fafafa', maxHeight: '200px', overflow: 'auto' }}>
                                                            {tagsLoading ? (
                                                                <div style={{ fontSize: '13px', color: '#666' }}>Loading tags...</div>
                                                            ) : (availableIndustryTags.length === 0 ? (
                                                                <div style={{ fontSize: '13px', color: '#666' }}>No industry tags available.</div>
                                                            ) : (
                                                                availableIndustryTags.map((t) => {
                                                                    const id = t?.Id ?? t?.id;
                                                                    const name = t?.Name ?? t?.name ?? `Industry ${id}`;
                                                                    const checked = (editFormData.selectedIndustryTagIds || []).includes(id);
                                                                    return (
                                                                        <label key={id} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', color: '#111827', cursor: 'pointer', padding: '6px 0' }}>
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={checked}
                                                                                onChange={() => toggleEditIndustryTag(id)}
                                                                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                                                            />
                                                                            <span>{name}</span>
                                                                        </label>
                                                                    );
                                                                })
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', flexDirection: 'column', gap: '8px' }}>
                                                    {(editFormData.selectedInterestTagIds?.length || 0) + (editFormData.selectedIndustryTagIds?.length || 0) > 0 ? (
                                                        <>
                                                            <div style={{ padding: '10px 14px', background: '#f0fdf4', borderRadius: '6px', border: '1px solid #86efac', fontSize: '13px', fontWeight: '600', color: '#166534' }}>
                                                                👥 Total Members: {isLoadingTargetingPreview
                                                                    ? 'Loading...'
                                                                    : (previewedTargetedMembers?.totalMembersMatched ?? previewedTargetedMembers?.totalCount ?? 0).toLocaleString()}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div style={{ padding: '10px 14px', background: '#f3f4f6', borderRadius: '6px', fontSize: '13px', color: '#666' }}>
                                                            Select tags to see member count
                                                        </div>
                                                    )}
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
                                                        {/* Tag badges */}
                                                        {(() => {
                                                            const interestIds = getDraftInterestIds(draft);
                                                            const industryIds = getDraftIndustryIds(draft);
                                                            const hasAnyTags = interestIds.length > 0 || industryIds.length > 0;
                                                            
                                                            if (!hasAnyTags) return null;
                                                            
                                                            return (
                                                                <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                                    {interestIds.map((id) => {
                                                                        const tag = (availableInterestTags || []).find(t => t.id === id);
                                                                        const name = tag?.name || tag?.nameEN || `Interest #${id}`;
                                                                        return (
                                                                            <span key={`dint-${draft.id}-${id}`} style={{ 
                                                                                padding: '3px 8px', 
                                                                                background: '#fef2f2', 
                                                                                color: '#dc2626', 
                                                                                borderRadius: '12px', 
                                                                                fontSize: '11px', 
                                                                                fontWeight: '500',
                                                                                border: '1px solid #fecaca'
                                                                            }}>
                                                                                🏷️ {name}
                                                                            </span>
                                                                        );
                                                                    })}
                                                                    {industryIds.map((id) => {
                                                                        const tag = (availableIndustryTags || []).find(t => t.id === id);
                                                                        const name = tag?.name || tag?.nameEN || `Industry #${id}`;
                                                                        return (
                                                                            <span key={`dind-${draft.id}-${id}`} style={{ 
                                                                                padding: '3px 8px', 
                                                                                background: '#f3e8ff', 
                                                                                color: '#8b5cf6', 
                                                                                borderRadius: '12px', 
                                                                                fontSize: '11px', 
                                                                                fontWeight: '500',
                                                                                border: '1px solid #d8b4fe'
                                                                            }}>
                                                                                🏢 {name}
                                                                            </span>
                                                                        );
                                                                    })}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                    {/* Removed channel and audience badges per user request */}
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
                                </>
                            );
                        })()}
                    </div>
                )}
            </div>

            {/* Preview Modal */}
            {showPreviewModal && previewedTargetedMembers && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }} onClick={() => setShowPreviewModal(false)}>
                    <div style={{ width: 'min(1000px, 95%)', maxHeight: '80vh', overflow: 'auto', background: 'white', borderRadius: '10px', padding: '18px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h2 style={{ margin: 0, fontSize: '18px' }}>Recipient Preview</h2>
                            <button onClick={() => setShowPreviewModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px' }}>✖️</button>
                        </div>

                        <div style={{ marginBottom: '12px' }}>
                            <div style={{ fontSize: '14px', fontWeight: '600' }}>Total matched: {previewedTargetedMembers.totalMembersMatched?.toLocaleString() || 0}</div>
                            <div style={{ fontSize: '13px', color: '#16a34a' }}>Sample size: {previewedTargetedMembers.sampleSize || 0}</div>
                        </div>

                        <div style={{ display: 'grid', gap: '10px' }}>
                            {(previewedTargetedMembers.recipients || previewedTargetedMembers.data?.recipients || previewedTargetedMembers.sampleMembers || []).map((member, i) => (
                                <div key={member?.id ?? member?.memberId ?? i} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fafafa' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontWeight: '700' }}>{member.contactPerson || member.name || member.fullName || member.memberName || 'N/A'}</div>
                                        <div style={{ fontSize: '12px', color: '#666' }}>{member.email || member.contactEmail || member.emailAddress || ''}</div>
                                    </div>
                                    <div style={{ fontSize: '13px', color: '#666', marginTop: '6px' }}>{member.companyName || member.company || ''}</div>
                                    {(member.interestTagNames || member.interests || member.interestTags || []).length > 0 && (
                                        <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                            {(member.interestTagNames || member.interests || member.interestTags || []).map((t, j) => (
                                                <span key={`int-${i}-${j}`} style={{ padding: '2px 6px', background: '#fef2f2', color: '#dc2626', borderRadius: '3px', fontSize: '12px' }}>{t}</span>
                                            ))}
                                        </div>
                                    )}
                                    {(member.industryTagNames || member.industries || member.industryTags || []).length > 0 && (
                                        <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                            {(member.industryTagNames || member.industries || member.industryTags || []).map((t, j) => (
                                                <span key={`ind-${i}-${j}`} style={{ padding: '2px 6px', background: '#f3e8ff', color: '#8b5cf6', borderRadius: '3px', fontSize: '12px' }}>{t}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DraftsList;
