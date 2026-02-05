import React, { useState, useEffect } from 'react';
import { getRoleFromToken } from '../../utils/auth';
import { useNavigate } from 'react-router-dom';
import { previewBroadcastRecipients, sendBroadcast, getBroadcastStatistics, getAudienceCounts } from '../../api/broadcast';

// Add CSS for loading animation
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || '';

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
    if (debug) console.log('[BroadcastManagement apiFetch] request', opts.method || 'GET', fullPath, requestBody ?? opts.body);

  const res = await fetch(fullPath, Object.assign({ headers }, opts));
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    const errorMsg = `HTTP ${res.status} ${res.statusText}${text ? ': ' + text : ''}`;
    console.error('[BroadcastManagement apiFetch] response error', res.status, fullPath, text);
    throw new Error(errorMsg);
  }
    const parsed = safeJsonParse(text);
    if (debug) console.log('[BroadcastManagement apiFetch] response success', res.status, fullPath, parsed ?? (text ? '[non-json response]' : null));
    return parsed ?? (text || null);
};

const BroadcastManagement = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        title: '',
        subject: '',
        body: '',
        channel: ['Email'],
        targetAudience: [],
        id: null,
        scheduledSendAt: '',
        selectedArticleIds: []
    });
    const [drafts, setDrafts] = useState([]);
    const [aiPrompt, setAiPrompt] = useState('');
    const [showAiAssistant, setShowAiAssistant] = useState(false);
    const [generatedContent, setGeneratedContent] = useState(null);
    const [generatedContentId, setGeneratedContentId] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [scheduledTime, setScheduledTime] = useState('');
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [previewRecipients, setPreviewRecipients] = useState(null);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [showStatisticsModal, setShowStatisticsModal] = useState(false);
    const [statistics, setStatistics] = useState(null);
    const [statisticsBroadcastId, setStatisticsBroadcastId] = useState(null);

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

    // Audience data with counts (dynamic from backend)
    const [audienceData, setAudienceData] = useState([
        { value: 0, label: 'All Members', count: 0 },
        { value: 1, label: 'Technology Interested', count: 0 },
        { value: 2, label: 'Business Interested', count: 0 },
        { value: 3, label: 'Sports Interested', count: 0 },
        { value: 4, label: 'Entertainment Interested', count: 0 },
        { value: 5, label: 'Politics Interested', count: 0 }
    ]);
    const [audienceCountsLoading, setAudienceCountsLoading] = useState(false);
    const [emailSubscriberCount, setEmailSubscriberCount] = useState(0);

    const normalizeAudience = (raw) => {
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'number') {
            // Decode bitmask back to individual selections
            if (raw === 0) return [0];
            const selected = [];
            if (raw & 2) selected.push(1);  // Technology
            if (raw & 4) selected.push(2);  // Business
            if (raw & 8) selected.push(3);  // Sports
            if (raw & 16) selected.push(4); // Entertainment
            if (raw & 32) selected.push(5); // Politics
            console.log('[normalizeAudience] bitmask', raw, '-> selected:', selected);
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
            return [map[raw] ?? 0];
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
            if (flags.all) return [0];
            const mapped = [];
            if (flags.tech) mapped.push(1);
            if (flags.business) mapped.push(2);
            if (flags.sports) mapped.push(3);
            if (flags.entertainment) mapped.push(4);
            if (flags.politics) mapped.push(5);
            return mapped.length ? mapped : [0];
        }
        return [];
    };

    const toAudienceEnumValue = (selected) => {
        const chosen = Array.isArray(selected) ? selected : [];
        if (chosen.length === 0) return 0;
        if (chosen.includes(0)) return 0;
        // Use bitwise OR to combine multiple selections: Tech=2, Business=4, Sports=8, Entertainment=16, Politics=32
        const map = { 1: 2, 2: 4, 3: 8, 4: 16, 5: 32 };
        let result = 0;
        chosen.forEach(val => {
            if (map[val]) result |= map[val];
        });
        console.log('[toAudienceEnumValue] selected:', chosen, '-> bitmask:', result);
        return result || 0;
    };

    const normalizeDraft = (draft) => ({
        ...draft,
        targetAudience: normalizeAudience(draft?.targetAudience ?? draft?.TargetAudience),
        selectedArticlesCount: draft?.selectedArticlesCount ?? draft?.SelectedArticlesCount ?? 0,
        selectedArticleIds: (() => {
            const direct = draft?.selectedArticleIds ?? draft?.SelectedArticleIds;
            if (Array.isArray(direct)) return direct;
            const raw = draft?.selectedArticles ?? draft?.SelectedArticles ?? [];
            if (!Array.isArray(raw)) return [];
            return raw
                .map((x) => x?.publicationDraftId ?? x?.PublicationDraftId ?? x?.id ?? x?.Id)
                .map((v) => (typeof v === 'string' ? parseInt(v, 10) : v))
                .filter((v) => typeof v === 'number' && !Number.isNaN(v));
        })()
    });

    // Calculate total recipients based on selected audiences
    const calculateTotalRecipients = (selected) => {
        if (selected.length === 0) return 0;
        // If All Members (0) is selected, return total
        if (selected.includes(0)) {
            const allMembersAudience = audienceData.find(a => a.value === 0);
            return allMembersAudience ? allMembersAudience.count : 0;
        }
        // Otherwise sum the counts of selected audiences
        return selected.reduce((sum, val) => {
            const audience = audienceData.find(a => a.value === val);
            return sum + (audience ? audience.count : 0);
        }, 0);
    };

    const totalRecipients = calculateTotalRecipients(formData.targetAudience);

    useEffect(() => {
        fetchDrafts();
        fetchTags();
        fetchPublishedArticles();
        fetchAudienceCounts();
        
        // Poll audience counts every 30 seconds
        const audienceInterval = setInterval(() => {
            fetchAudienceCounts();
        }, 30000);
        
        return () => {
            clearInterval(audienceInterval);
        };
    }, []);

    const fetchAudienceCounts = async () => {
        try {
            setAudienceCountsLoading(true);
            const counts = await getAudienceCounts();
            
            console.log('[fetchAudienceCounts] received counts:', counts);
            
            // Handle nested interestCategories structure from backend
            const interests = counts.interestCategories || {};
            
            // Update audience data with real counts from backend
            const updatedAudienceData = [
                { 
                    value: 0, 
                    label: 'All Members', 
                    count: counts.allMembers || counts.AllMembers || counts.emailSubscribers || 0 
                },
                { 
                    value: 1, 
                    label: 'Technology Interested', 
                    count: interests.technologyInterested || interests.TechnologyInterested || 0 
                },
                { 
                    value: 2, 
                    label: 'Business Interested', 
                    count: interests.businessInterested || interests.BusinessInterested || 0 
                },
                { 
                    value: 3, 
                    label: 'Sports Interested', 
                    count: interests.sportsInterested || interests.SportsInterested || 0 
                },
                { 
                    value: 4, 
                    label: 'Entertainment Interested', 
                    count: interests.entertainmentInterested || interests.EntertainmentInterested || 0 
                },
                { 
                    value: 5, 
                    label: 'Politics Interested', 
                    count: interests.politicsInterested || interests.PoliticsInterested || 0 
                }
            ];
            setAudienceData(updatedAudienceData);
            
            // Update email subscriber count
            const emailCount = counts.emailSubscribers || counts.EmailSubscribers || counts.allMembers || counts.AllMembers || 0;
            setEmailSubscriberCount(emailCount);
            
            console.log('[fetchAudienceCounts] ✅ Email subscribers:', emailCount);
            console.log('[fetchAudienceCounts] ✅ Updated audience data:', updatedAudienceData);
        } catch (error) {
            console.error('[fetchAudienceCounts] ❌ ERROR:', error);
            console.error('[fetchAudienceCounts] ❌ ERROR MESSAGE:', error.message);
            // Keep default values on error
        } finally {
            setAudienceCountsLoading(false);
        }
    };
    
    // Poll statistics every 10 seconds when modal is open
    useEffect(() => {
        let statsInterval;
        if (showStatisticsModal && statisticsBroadcastId) {
            statsInterval = setInterval(async () => {
                try {
                    const stats = await getBroadcastStatistics(statisticsBroadcastId);
                    setStatistics(stats);
                } catch (error) {
                    console.error('[statistics poll] error:', error);
                }
            }, 10000);
        }
        
        return () => {
            if (statsInterval) clearInterval(statsInterval);
        };
    }, [showStatisticsModal, statisticsBroadcastId]);
    
    // Poll preview recipients every 5 seconds when preview modal is open
    useEffect(() => {
        let previewInterval;
        if (showPreviewModal && (formData.id || generatedContentId)) {
            previewInterval = setInterval(async () => {
                try {
                    const preview = await previewBroadcastRecipients(formData.id || generatedContentId);
                    console.log('[preview poll] ✅ Preview response:', preview);
                    setPreviewRecipients(preview);
                } catch (error) {
                    console.error('[preview poll] error:', error);
                }
            }, 5000);
        }
        
        return () => {
            if (previewInterval) clearInterval(previewInterval);
        };
    }, [showPreviewModal, formData.id, generatedContentId]);

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
        const current = Array.isArray(formData.selectedArticleIds) ? formData.selectedArticleIds : [];
        const exists = current.includes(idNum);
        const next = exists ? current.filter((x) => x !== idNum) : [...current, idNum];
        setFormData({ ...formData, selectedArticleIds: next });
    };

    const clearSelectedArticles = () => {
        setFormData({ ...formData, selectedArticleIds: [] });
    };

    const fetchDrafts = async () => {
        try {
            const response = await apiFetch('/api/Broadcast');
            console.log('[fetchDrafts] response:', response);
            // Handle both response formats: { data: [...] } or direct array
            const draftsData = response?.data || response || [];
            const normalizedDrafts = Array.isArray(draftsData) ? draftsData.map(normalizeDraft) : [];
            setDrafts(normalizedDrafts);
        } catch (error) {
            console.error('[fetchDrafts] error:', error);
            setDrafts([]);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Prevent multiple submissions
        if (isSavingDraft) return;
        
        try {
            setIsSavingDraft(true);
            console.log('[handleSubmit] sending:', formData);
            
            // Validation
            if (!formData.title?.trim()) {
                alert('Title is required');
                setIsSavingDraft(false);
                return;
            }
            if (!formData.subject?.trim()) {
                alert('Subject is required');
                setIsSavingDraft(false);
                return;
            }
            if (!formData.body?.trim()) {
                alert('Message body is required');
                setIsSavingDraft(false);
                return;
            }
            
            const selectedAudience = formData.targetAudience?.length ? formData.targetAudience : [0];
            const selectedChannels = formData.channel?.length ? formData.channel : ['Email'];
            const channelEnumValue = toChannelEnumValue(selectedChannels);
            const submitData = {
                Title: formData.title,
                Subject: formData.subject,
                Body: formData.body,
                Channel: channelEnumValue,
                TargetAudience: toAudienceEnumValue(selectedAudience),
                ScheduledSendAt: formData.scheduledSendAt || null,
                SelectedArticleIds: Array.isArray(formData.selectedArticleIds) ? formData.selectedArticleIds : []
            };
            console.log('[handleSubmit] selectedChannels array:', selectedChannels);
            console.log('[handleSubmit] channelEnumValue:', channelEnumValue, '(should be 1 for Email)');
            console.log('[handleSubmit] payload:', submitData);
            
            // If this was generated by AI, update the auto-generated draft instead of creating a new one
            if (generatedContentId) {
                console.log('[handleSubmit] Updating auto-generated draft:', generatedContentId);
                const response = await apiFetch(`/api/Broadcast/${generatedContentId}`, {
                    method: 'PUT',
                    body: JSON.stringify(submitData)
                });
                console.log('[handleSubmit] update response:', response);
                alert('Draft updated successfully!');
                setGeneratedContentId(null);
                setGeneratedContent(null);
                setFormData({ title: '', subject: '', body: '', channel: ['Email'], targetAudience: [], id: null, scheduledSendAt: '', selectedArticleIds: [] });
            } else {
                // Create a new draft
                const response = await apiFetch('/api/Broadcast', {
                    method: 'POST',
                    body: JSON.stringify(submitData)
                });

                console.log('[handleSubmit] response:', response);
                alert('Draft saved successfully!');
                // Capture the draft ID from response
                const draftId = response?.id || response?.Id;
                setFormData({ title: '', subject: '', body: '', channel: ['Email'], targetAudience: [], id: draftId, scheduledSendAt: '', selectedArticleIds: [] });
            }
            
            fetchDrafts();
        } catch (error) {
            console.error('[handleSubmit] error:', error);
            alert('Failed to save draft: ' + error.message + '\n\nPlease check the browser console and verify your backend endpoint.');
        } finally {
            setIsSavingDraft(false);
        }
    };

    const clearSchedule = () => {
        setFormData({ ...formData, scheduledSendAt: '' });
        setShowScheduleModal(false);
        setScheduledTime('');
    };

    const handlePreviewRecipients = async () => {
        // First, ensure we have a draft ID (save if needed)
        let draftId = formData.id || generatedContentId;
        
        if (!draftId) {
            if (!formData.title?.trim() || !formData.subject?.trim() || !formData.body?.trim()) {
                alert('Please fill in Title, Subject, and Message Body first.');
                return;
            }
            
            // Save draft first
            try {
                setIsSavingDraft(true);
                const selectedAudience = formData.targetAudience?.length ? formData.targetAudience : [0];
                const selectedChannels = formData.channel?.length ? formData.channel : ['Email'];
                const channelEnumValue = toChannelEnumValue(selectedChannels);
                const submitData = {
                    Title: formData.title,
                    Subject: formData.subject,
                    Body: formData.body,
                    Channel: channelEnumValue,
                    TargetAudience: toAudienceEnumValue(selectedAudience),
                    ScheduledSendAt: formData.scheduledSendAt || null,
                    SelectedArticleIds: Array.isArray(formData.selectedArticleIds) ? formData.selectedArticleIds : []
                };
                
                const response = await apiFetch('/api/Broadcast', {
                    method: 'POST',
                    body: JSON.stringify(submitData)
                });
                
                draftId = response?.id || response?.Id;
                setFormData({ ...formData, id: draftId });
            } catch (error) {
                console.error('[handlePreviewRecipients] save error:', error);
                alert('Failed to save draft: ' + error.message);
                return;
            } finally {
                setIsSavingDraft(false);
            }
        }
        
        // Now preview recipients
        try {
            setIsLoadingPreview(true);
            setShowPreviewModal(true);
            const preview = await previewBroadcastRecipients(draftId);
            console.log('[handlePreviewRecipients] ✅ Full preview response:', JSON.stringify(preview, null, 2));
            console.log('[handlePreviewRecipients] ✅ Response keys:', Object.keys(preview || {}));
            console.log('[handlePreviewRecipients] ✅ Recipients array:', preview?.recipients || preview?.Recipients || preview?.data?.recipients || preview?.data?.Recipients);
            setPreviewRecipients(preview);
        } catch (error) {
            console.error('[handlePreviewRecipients] error:', error);
            alert('Failed to preview recipients: ' + error.message);
            setShowPreviewModal(false);
        } finally {
            setIsLoadingPreview(false);
        }
    };

    const handleSendBroadcast = async () => {
        if (!formData.title?.trim() || !formData.subject?.trim() || !formData.body?.trim()) {
            alert('Cannot send: Title, Subject, and Message Body are all required.');
            return;
        }
        
        // Check if audience is selected
        if (!formData.targetAudience || formData.targetAudience.length === 0) {
            alert('Please select at least one Target Audience before sending.');
            return;
        }

        // Build audience description
        const audiences = normalizeAudience(formData.targetAudience);
        let audienceDesc = 'All Members';
        if (audiences.includes(0)) {
            audienceDesc = 'All Members';
        } else if (audiences.length > 0) {
            audienceDesc = audiences.map((val) => {
                const audience = audienceData.find(a => a.value === val);
                return audience ? audience.label : `Audience ${val}`;
            }).join(', ');
        }

        // Build channel description
        const channels = normalizeChannels(formData.channel);
        const channelDesc = channels.length === 1 ? channels[0] : channels.join(', ');

        if (!window.confirm(`Send "${formData.subject}" to ${audienceDesc} via ${channelDesc} now?`)) return;
        
        // Ensure we have a draft ID (save if needed)
        let draftId = formData.id || generatedContentId;
        
        if (!draftId) {
            try {
                setIsSavingDraft(true);
                const selectedAudience = formData.targetAudience?.length ? formData.targetAudience : [0];
                const selectedChannels = formData.channel?.length ? formData.channel : ['Email'];
                const channelEnumValue = toChannelEnumValue(selectedChannels);
                const submitData = {
                    Title: formData.title,
                    Subject: formData.subject,
                    Body: formData.body,
                    Channel: channelEnumValue,
                    TargetAudience: toAudienceEnumValue(selectedAudience),
                    ScheduledSendAt: formData.scheduledSendAt || null,
                    SelectedArticleIds: Array.isArray(formData.selectedArticleIds) ? formData.selectedArticleIds : []
                };
                
                const response = await apiFetch('/api/Broadcast', {
                    method: 'POST',
                    body: JSON.stringify(submitData)
                });
                
                draftId = response?.id || response?.Id;
                setFormData({ ...formData, id: draftId });
            } catch (error) {
                console.error('[handleSendBroadcast] save error:', error);
                alert('Failed to save draft: ' + error.message);
                return;
            } finally {
                setIsSavingDraft(false);
            }
        }
        
        // Send broadcast
        try {
            setIsSending(true);
            const result = await sendBroadcast(draftId);
            console.log('[handleSendBroadcast] sent:', result);
            alert('Broadcast sent successfully!');
            
            // Clear form and refresh drafts
            setFormData({ title: '', subject: '', body: '', channel: ['Email'], targetAudience: [], id: null, scheduledSendAt: '', selectedArticleIds: [] });
            setGeneratedContentId(null);
            setGeneratedContent(null);
            fetchDrafts();
            
            // Navigate to success page
            navigate('/message-sent', { state: { broadcastSubject: formData.subject } });
        } catch (error) {
            console.error('[handleSendBroadcast] error:', error);
            alert('Failed to send broadcast: ' + error.message);
        } finally {
            setIsSending(false);
        }
    };

    const handleViewStatistics = async (broadcastId) => {
        try {
            setStatisticsBroadcastId(broadcastId);
            setShowStatisticsModal(true);
            const stats = await getBroadcastStatistics(broadcastId);
            setStatistics(stats);
        } catch (error) {
            console.error('[handleViewStatistics] error:', error);
            alert('Failed to load statistics: ' + error.message);
            setShowStatisticsModal(false);
        }
    };
    
    const refreshStatistics = async () => {
        if (statisticsBroadcastId) {
            try {
                const stats = await getBroadcastStatistics(statisticsBroadcastId);
                setStatistics(stats);
            } catch (error) {
                console.error('[refreshStatistics] error:', error);
            }
        }
    };

    const handleDelete = async (id) => {
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

    const handleScheduleSubmit = async () => {
        if (!scheduledTime) {
            alert('Please select a date and time');
            return;
        }

        // Validate form fields
        if (!formData.title?.trim() || !formData.subject?.trim() || !formData.body?.trim()) {
            alert('Please fill in Title, Subject, and Message Body before scheduling.');
            return;
        }

        try {
            setIsSavingDraft(true);
            const selectedAudience = formData.targetAudience?.length ? formData.targetAudience : [0];
            const selectedChannels = formData.channel?.length ? formData.channel : ['Email'];
            const channelEnumValue = toChannelEnumValue(selectedChannels);
            
            // Step 1: Save/Create the broadcast first (without Status='Scheduled')
            const submitData = {
                Title: formData.title,
                Subject: formData.subject,
                Body: formData.body,
                Channel: channelEnumValue,
                TargetAudience: toAudienceEnumValue(selectedAudience),
                SelectedArticleIds: Array.isArray(formData.selectedArticleIds) ? formData.selectedArticleIds : []
            };

            let broadcastId;
            if (formData.id || generatedContentId) {
                // Update existing draft
                broadcastId = formData.id || generatedContentId;
                await apiFetch(`/api/Broadcast/${broadcastId}`, {
                    method: 'PUT',
                    body: JSON.stringify(submitData)
                });
            } else {
                // Create new draft
                const response = await apiFetch('/api/Broadcast', {
                    method: 'POST',
                    body: JSON.stringify(submitData)
                });
                broadcastId = response?.id || response?.Id;
            }

            if (!broadcastId) {
                throw new Error('Failed to get broadcast ID');
            }

            // Step 2: Schedule the broadcast using the dedicated scheduling endpoint
            const scheduleData = {
                BroadcastId: broadcastId,
                ScheduledSendAt: scheduledTime
            };

            console.log('[handleScheduleSubmit] Scheduling broadcast:', scheduleData);

            await apiFetch('/api/broadcast/schedule', {
                method: 'POST',
                body: JSON.stringify(scheduleData)
            });

            // Update local state
            setFormData({ ...formData, id: broadcastId, scheduledSendAt: scheduledTime });
            setShowScheduleModal(false);
            
            // Show success message
            const scheduledDate = new Date(scheduledTime);
            const now = new Date();
            const minutesUntilSend = Math.round((scheduledDate - now) / 60000);
            
            alert(
                `✓ Broadcast scheduled successfully!\n\n` +
                `Scheduled for: ${scheduledDate.toLocaleString()}\n` +
                `Time until send: ${minutesUntilSend} minutes\n\n` +
                `The broadcast will be sent automatically by the background service.`
            );
            
            // Refresh drafts to show updated status
            fetchDrafts();
        } catch (error) {
            console.error('[handleScheduleSubmit] error:', error);
            alert('Failed to schedule message: ' + error.message);
        } finally {
            setIsSavingDraft(false);
        }
    };

    const formatScheduledTime = (dateString) => {
        if (!dateString) return 'Not scheduled';
        return new Date(dateString).toLocaleString();
    };

    const handleAiPromptSubmit = async (e) => {
        e.preventDefault();
        setIsGenerating(true);
        try {
            console.log('[handleAiPromptSubmit] sending prompt:', aiPrompt);

            const selectedAudience = formData.targetAudience?.length ? formData.targetAudience : [0];
            const selectedChannels = formData.channel?.length ? formData.channel : ['Email'];
            const channelEnumValue = toChannelEnumValue(selectedChannels);
            const targetAudienceEnumValue = toAudienceEnumValue(selectedAudience);

            const generateReq = {
                Prompt: aiPrompt,
                Channel: channelEnumValue,
                TargetAudience: targetAudienceEnumValue
            };

            // Your backend controller route is api/Broadcast/generate
            // and returns a lightweight BroadcastListItemDTO (no Body), so we fetch details after.
            const response = await apiFetch('/api/Broadcast/generate', {
                method: 'POST',
                body: JSON.stringify(generateReq)
            });

            console.log('[handleAiPromptSubmit] response:', response);

            if (response) {
                // Store the auto-generated ID so we can update it instead of creating a new one
                const newId = response.id || response.Id;
                setGeneratedContentId(newId);

                // Prefer fetching detail DTO to get the generated Body.
                let detail = null;
                if (newId) {
                    try {
                        detail = await apiFetch(`/api/Broadcast/${newId}`);
                    } catch (detailErr) {
                        console.warn('[handleAiPromptSubmit] failed to fetch generated detail, falling back to response:', detailErr);
                    }
                }

                const title = detail?.body ? (detail?.title || detail?.Title || response.title || response.Title || '') : (response.title || response.Title || '');
                const subject = detail?.body ? (detail?.subject || detail?.Subject || response.subject || response.Subject || '') : (response.subject || response.Subject || '');
                const body =
                    detail?.body ||
                    detail?.Body ||
                    response.body ||
                    response.Body ||
                    response.message ||
                    response.Message ||
                    response.content ||
                    '';

                setGeneratedContent({
                    title,
                    subject,
                    body,
                    channel: normalizeChannels(detail?.channel || detail?.Channel || response.channel || response.Channel || formData.channel)
                });
            }

            setAiPrompt('');
        } catch (error) {
            console.error('[handleAiPromptSubmit] error:', error);
            alert('Failed to generate message: ' + error.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const applyGeneratedContent = () => {
        if (generatedContent) {
            // Apply only title, subject, body from AI - DO NOT override user's channel selection
            setFormData({
                ...formData,
                title: generatedContent.title || '',
                subject: generatedContent.subject || '',
                body: generatedContent.body || ''
                // Preserve the user's channel selection, don't override with AI's channel
            });
            // Keep the generatedContentId so we know to update instead of create on save
            setGeneratedContent(null);
            setShowAiAssistant(false);
        }
    };

    const suggestedTopics = [
        'Breaking news about latest tech innovation',
        'Weekly business insights and market trends',
        'Upcoming sports events and exclusive coverage',
        'Entertainment industry updates and reviews'
    ];

    return (
        <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '24px' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', gap: '24px' }}>
                {/* Main Content */}
                <div style={{ flex: 1 }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#333', margin: 0 }}>Create Broadcast Message</h1>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => navigate('/drafts')}
                                style={{
                                    padding: '10px 20px',
                                    background: 'white',
                                    border: '1px solid #ddd',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                📄 View Drafts
                            </button>
                            <button
                                onClick={() => setShowAiAssistant(!showAiAssistant)}
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
                                ✨ AI Assist
                            </button>
                        </div>
                    </div>

                    <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>Send important updates to targeted audience</p>

                    {/* Channel Selection */}
                    <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#333' }}>Select Channels</h3>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            {['Email'].map((ch) => {
                                const isSelected = Array.isArray(formData.channel) ? formData.channel.includes(ch) : formData.channel === ch;
                                return (
                                    <div
                                        key={ch}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => {
                                            const current = Array.isArray(formData.channel) ? formData.channel : [formData.channel].filter(Boolean);
                                            const exists = current.includes(ch);
                                            let next = exists ? current.filter((c) => c !== ch) : [...current, ch];
                                            if (next.length === 0) next = ['Email'];
                                            setFormData({ ...formData, channel: next });
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                const current = Array.isArray(formData.channel) ? formData.channel : [formData.channel].filter(Boolean);
                                                const exists = current.includes(ch);
                                                let next = exists ? current.filter((c) => c !== ch) : [...current, ch];
                                                if (next.length === 0) next = ['Email'];
                                                setFormData({ ...formData, channel: next });
                                            }
                                        }}
                                        style={{
                                            flex: '1',
                                            minWidth: '200px',
                                            padding: '16px',
                                            border: isSelected ? '2px solid #dc2626' : '2px solid #e5e7eb',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            background: isSelected ? '#fef2f2' : 'white',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px'
                                        }}
                                    >
                                        <div style={{
                                            width: '22px',
                                            height: '22px',
                                            borderRadius: '6px',
                                            border: isSelected ? '2px solid #dc2626' : '2px solid #e5e7eb',
                                            background: isSelected ? '#dc2626' : 'white',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: isSelected ? 'white' : 'transparent',
                                            fontSize: '14px',
                                            transition: 'all 0.2s'
                                        }}>
                                            ✓
                                        </div>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                <span style={{ fontSize: '20px' }}>📧</span>
                                                <span style={{ fontWeight: '600', fontSize: '15px' }}>Email</span>
                                            </div>
                                            <div style={{ fontSize: '13px', color: '#666' }}>
                                                {audienceCountsLoading ? 'Loading...' : `${emailSubscriberCount.toLocaleString()} subscribers`}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Message Content */}
                    <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#333' }}>Message Content</h3>

                        {/* AI Content Assistant */}
                        {showAiAssistant && (
                            <div style={{ marginBottom: '20px', padding: '16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '18px' }}>✨</span>
                                        <span style={{ fontWeight: '600', fontSize: '14px' }}>AI Content Assistant</span>
                                    </div>
                                    <button
                                        onClick={() => setShowAiAssistant(false)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#999' }}
                                    >
                                        ×
                                    </button>
                                </div>
                                <form onSubmit={handleAiPromptSubmit}>
                                    <textarea
                                        value={aiPrompt}
                                        onChange={(e) => setAiPrompt(e.target.value)}
                                        placeholder="Describe what you want to write about..."
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '6px',
                                            fontSize: '14px',
                                            minHeight: '80px',
                                            resize: 'vertical',
                                            fontFamily: 'inherit',
                                            marginBottom: '12px',
                                            boxSizing: 'border-box'
                                        }}
                                        required
                                    />
                                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>Suggested topics based on audience interests:</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                                        {suggestedTopics.map((topic, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => setAiPrompt(topic)}
                                                style={{
                                                    padding: '6px 12px',
                                                    background: 'white',
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: '4px',
                                                    fontSize: '12px',
                                                    cursor: 'pointer',
                                                    color: '#666',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.target.style.borderColor = '#dc2626'}
                                                onMouseLeave={(e) => e.target.style.borderColor = '#e5e7eb'}
                                            >
                                                {topic}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isGenerating}
                                        style={{
                                            padding: '10px 20px',
                                            background: isGenerating ? '#dc262633' : '#dc2626',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: isGenerating ? 'not-allowed' : 'pointer',
                                            fontSize: '14px',
                                            fontWeight: '500',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        {isGenerating ? (
                                            <>
                                                <span style={{
                                                    display: 'inline-block',
                                                    width: '14px',
                                                    height: '14px',
                                                    border: '2px solid rgba(255,255,255,0.3)',
                                                    borderTop: '2px solid white',
                                                    borderRadius: '50%',
                                                    animation: 'spin 0.6s linear infinite'
                                                }} />
                                                Generating...
                                            </>
                                        ) : (
                                            'Generate Content'
                                        )}
                                    </button>
                                </form>

                                {/* Generated Content Display */}
                                {generatedContent && (
                                    <div style={{ marginTop: '16px', padding: '16px', background: 'white', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                                        <div style={{ fontWeight: '600', marginBottom: '12px', color: '#333' }}>Generated Content:</div>
                                        {generatedContent.subject && (
                                            <div style={{ marginBottom: '8px' }}>
                                                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Subject:</div>
                                                <div style={{ fontSize: '14px', color: '#333' }}>{generatedContent.subject}</div>
                                            </div>
                                        )}
                                        {generatedContent.body && (
                                            <div style={{ marginBottom: '12px' }}>
                                                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Body:</div>
                                                <div style={{ fontSize: '14px', color: '#333', whiteSpace: 'pre-wrap' }}>{generatedContent.body}</div>
                                            </div>
                                        )}
                                        <button
                                            onClick={applyGeneratedContent}
                                            style={{
                                                padding: '8px 16px',
                                                background: '#059669',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontSize: '14px',
                                                fontWeight: '500'
                                            }}
                                        >
                                            Apply to Message
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Title */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#333' }}>
                                Title (Template Name)
                            </label>
                            <input
                                type="text"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                placeholder="e.g., Weekly Newsletter, Product Launch, etc..."
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    fontFamily: 'inherit',
                                    boxSizing: 'border-box'
                                }}
                            />
                            <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>Used to identify this broadcast template</div>
                        </div>

                        {/* Subject Line */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#333' }}>
                                Subject Line
                            </label>
                            <input
                                type="text"
                                name="subject"
                                value={formData.subject}
                                onChange={handleChange}
                                placeholder="Enter your subject line..."
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    fontFamily: 'inherit',
                                    boxSizing: 'border-box'
                                }}
                                required
                            />
                        </div>

                        {/* Message Body */}
                        <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#333' }}>
                                Message Body
                            </label>
                            <textarea
                                name="body"
                                value={formData.body}
                                onChange={handleChange}
                                placeholder="Write your message here..."
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    minHeight: '200px',
                                    resize: 'vertical',
                                    fontFamily: 'inherit',
                                    boxSizing: 'border-box'
                                }}
                                required
                            />
                        </div>
                    </div>

                    {/* Published Article Selection */}
                    <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                            <div>
                                <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: '#333' }}>Attach Published Articles (Optional)</h3>
                                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                                    Selected: {(formData.selectedArticleIds || []).length}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    type="button"
                                    onClick={fetchPublishedArticles}
                                    style={{ padding: '8px 12px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                                >
                                    Refresh
                                </button>
                                <button
                                    type="button"
                                    onClick={clearArticleFilters}
                                    disabled={!selectedIndustryTagId && (selectedInterestTagIds || []).length === 0}
                                    style={{ padding: '8px 12px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: (!selectedIndustryTagId && (selectedInterestTagIds || []).length === 0) ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: (!selectedIndustryTagId && (selectedInterestTagIds || []).length === 0) ? 0.6 : 1 }}
                                >
                                    Clear Filters
                                </button>
                                <button
                                    type="button"
                                    onClick={clearSelectedArticles}
                                    disabled={(formData.selectedArticleIds || []).length === 0}
                                    style={{ padding: '8px 12px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: (formData.selectedArticleIds || []).length === 0 ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: (formData.selectedArticleIds || []).length === 0 ? 0.6 : 1 }}
                                >
                                    Clear
                                </button>
                            </div>
                        </div>

                        <input
                            type="text"
                            value={articleSearch}
                            onChange={(e) => setArticleSearch(e.target.value)}
                            placeholder="Search published articles by title..."
                            style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '12px' }}
                        />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                                <div style={{ minWidth: '240px', flex: 1 }}>
                                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>Industry</div>
                                    <select
                                        value={selectedIndustryTagId}
                                        disabled={tagsLoading}
                                        onChange={async (e) => {
                                            const next = e.target.value;
                                            setSelectedIndustryTagId(next);
                                            await fetchPublishedArticles({ industryTagId: next, interestTagIds: selectedInterestTagIds });
                                        }}
                                        style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', background: 'white' }}
                                    >
                                        <option value="">All industries</option>
                                        {(availableIndustryTags || []).map((t) => {
                                            const id = t?.Id ?? t?.id;
                                            const name = t?.Name ?? t?.name ?? `Industry ${id}`;
                                            return <option key={id} value={id}>{name}</option>;
                                        })}
                                    </select>
                                </div>
                                <div style={{ minWidth: '240px', flex: 1 }}>
                                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>Interest tags</div>
                                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 12px', background: 'white', maxHeight: '120px', overflow: 'auto' }}>
                                        {tagsLoading ? (
                                            <div style={{ fontSize: '13px', color: '#666' }}>Loading tags...</div>
                                        ) : (
                                            (availableInterestTags || []).length === 0 ? (
                                                <div style={{ fontSize: '13px', color: '#666' }}>No interest tags available.</div>
                                            ) : (
                                                (availableInterestTags || []).map((t) => {
                                                    const id = t?.Id ?? t?.id;
                                                    const name = t?.Name ?? t?.name ?? `Interest ${id}`;
                                                    const checked = (selectedInterestTagIds || []).includes(id);
                                                    return (
                                                        <label key={id} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', color: '#111827', cursor: 'pointer', padding: '4px 0' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() => toggleInterestFilter(id)}
                                                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                                            />
                                                            <span>{name}</span>
                                                        </label>
                                                    );
                                                })
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>
                            {tagsError && (
                                <div style={{ padding: '10px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', color: '#92400e', fontSize: '13px' }}>
                                    {tagsError}
                                </div>
                            )}
                        </div>

                        {publishedError && (
                            <div style={{ padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '13px', marginBottom: '12px' }}>
                                {publishedError}
                            </div>
                        )}

                        <div style={{ maxHeight: '320px', overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                            {publishedLoading ? (
                                <div style={{ padding: '14px', color: '#666', fontSize: '14px' }}>Loading published articles...</div>
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
                                        const publishedAt = a?.publishedAt ?? a?.PublishedAt;
                                        const industry = a?.industryTagName ?? a?.IndustryTagName;
                                        const interests = a?.interestTagNames ?? a?.InterestTagNames;
                                        const isSelected = (formData.selectedArticleIds || []).includes(publicationDraftId);
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
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    gap: '12px',
                                                    padding: '12px',
                                                    borderBottom: '1px solid #e5e7eb',
                                                    cursor: 'pointer',
                                                    background: isSelected ? '#fef2f2' : 'white'
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={!!isSelected}
                                                    readOnly
                                                    style={{ marginTop: '2px', width: '18px', height: '18px', accentColor: '#dc2626', cursor: 'pointer' }}
                                                />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>{title}</div>
                                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                                        {publishedAt ? `Published: ${new Date(publishedAt).toLocaleString()}` : 'Published date unknown'}
                                                    </div>
                                                    {(industry || (Array.isArray(interests) && interests.length > 0)) && (
                                                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                                                            {industry ? `Industry: ${industry}` : ''}
                                                            {industry && Array.isArray(interests) && interests.length > 0 ? ' • ' : ''}
                                                            {Array.isArray(interests) && interests.length > 0 ? `Interests: ${interests.filter(Boolean).join(', ')}` : ''}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                            )}

                            {!publishedLoading && (publishedArticles || []).length === 0 && !publishedError && (
                                <div style={{ padding: '14px', color: '#666', fontSize: '14px' }}>No published articles available.</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Sidebar */}
                <div style={{ width: '320px' }}>
                    {/* Target Audience */}
                    <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                            <span style={{ fontSize: '16px' }}>👥</span>
                            <h3 style={{ fontSize: '15px', fontWeight: '600', margin: 0 }}>Target Audience</h3>
                        </div>
                        <div style={{ fontSize: '13px', color: '#666' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                                {audienceData.map((audience) => {
                                    const isSelected = formData.targetAudience.includes(audience.value);
                                    return (
                                        <div
                                            key={audience.value}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => {
                                                const checked = !isSelected;
                                                if (checked) {
                                                    if (audience.value === 0) {
                                                        setFormData({ ...formData, targetAudience: [0] });
                                                    } else {
                                                        const newSelection = formData.targetAudience.includes(0)
                                                            ? [audience.value]
                                                            : [...formData.targetAudience, audience.value];
                                                        setFormData({ ...formData, targetAudience: newSelection });
                                                    }
                                                } else {
                                                    setFormData({
                                                        ...formData,
                                                        targetAudience: formData.targetAudience.filter(v => v !== audience.value)
                                                    });
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    const checked = !isSelected;
                                                    if (checked) {
                                                        if (audience.value === 0) {
                                                            setFormData({ ...formData, targetAudience: [0] });
                                                        } else {
                                                            const newSelection = formData.targetAudience.includes(0)
                                                                ? [audience.value]
                                                                : [...formData.targetAudience, audience.value];
                                                            setFormData({ ...formData, targetAudience: newSelection });
                                                        }
                                                    } else {
                                                        setFormData({
                                                            ...formData,
                                                            targetAudience: formData.targetAudience.filter(v => v !== audience.value)
                                                        });
                                                    }
                                                }
                                            }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                padding: '10px',
                                                cursor: 'pointer',
                                                borderRadius: '6px',
                                                background: isSelected ? '#fef2f2' : 'transparent',
                                                border: '1px solid ' + (isSelected ? '#fecaca' : 'transparent'),
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!isSelected) e.currentTarget.style.background = '#f9fafb';
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!isSelected) e.currentTarget.style.background = 'transparent';
                                                e.currentTarget.style.borderColor = 'transparent';
                                            }}
                                        >
                                            <div style={{
                                                width: '22px',
                                                height: '22px',
                                                borderRadius: '6px',
                                                border: isSelected ? '2px solid #dc2626' : '2px solid #e5e7eb',
                                                background: isSelected ? '#dc2626' : 'white',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: isSelected ? 'white' : 'transparent',
                                                fontSize: '14px',
                                                transition: 'all 0.2s'
                                            }}>
                                                ✓
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: isSelected ? '600' : '500', color: isSelected ? '#dc2626' : '#333' }}>
                                                    {audience.label}
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#999' }}>
                                                    {audience.count.toLocaleString()} subscribers
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#f9fafb', borderRadius: '6px', borderTop: '1px solid #e5e7eb' }}>
                                <span style={{ fontWeight: '600', color: '#333' }}>Total Recipients</span>
                                <span style={{ fontWeight: '700', color: totalRecipients === 0 ? '#dc2626' : '#059669' }}>
                                    {totalRecipients.toLocaleString()}
                                </span>
                            </div>
                            {totalRecipients === 0 && (
                                <div style={{ marginTop: '12px', padding: '10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '13px', color: '#991b1b' }}>
                                    ⚠️ Please select at least one audience to send broadcast
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>Actions</h3>
                        <button
                            onClick={() => setShowScheduleModal(true)}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: '#8b5cf6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '600',
                                marginBottom: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                            }}
                        >
                            <span>⏰</span> Schedule Message
                        </button>
                        {formData.scheduledSendAt && (
                            <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px', padding: '8px', background: '#f3f4f6', borderRadius: '4px' }}>
                                Scheduled for: {formatScheduledTime(formData.scheduledSendAt)}
                            </div>
                        )}
                        <button
                            onClick={handleSendBroadcast}
                            disabled={isSending}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: isSending ? '#dc262680' : '#dc2626',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: isSending ? 'not-allowed' : 'pointer',
                                fontSize: '14px',
                                fontWeight: '600',
                                marginBottom: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                opacity: isSending ? 0.6 : 1
                            }}
                        >
                            {isSending ? (
                                <>
                                    <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <span>📤</span> Send Broadcast
                                </>
                            )}
                        </button>
                        <button
                            onClick={handlePreviewRecipients}
                            disabled={isLoadingPreview}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: isLoadingPreview ? '#f3f4f6' : 'white',
                                color: isLoadingPreview ? '#9ca3af' : '#333',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px',
                                cursor: isLoadingPreview ? 'not-allowed' : 'pointer',
                                fontSize: '14px',
                                fontWeight: '500',
                                marginBottom: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                opacity: isLoadingPreview ? 0.6 : 1
                            }}
                        >
                            {isLoadingPreview ? (
                                <>
                                    <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
                                    Loading...
                                </>
                            ) : (
                                <>
                                    <span>👥</span> Preview Recipients
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSavingDraft}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: isSavingDraft ? '#d1d5db' : 'white',
                                color: isSavingDraft ? '#9ca3af' : '#333',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px',
                                cursor: isSavingDraft ? 'not-allowed' : 'pointer',
                                fontSize: '14px',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                opacity: isSavingDraft ? 0.6 : 1
                            }}
                        >
                            {isSavingDraft ? (
                                <>
                                    <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <span>💾</span> Save Draft
                                </>
                            )}
                        </button>
                    </div>

                    {/* AI Insights */}
                    <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                            <span style={{ fontSize: '16px' }}>💡</span>
                            <h3 style={{ fontSize: '15px', fontWeight: '600', margin: 0 }}>AI Insights</h3>
                        </div>
                        <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.8' }}>
                            <div style={{ marginBottom: '8px' }}>• Best time to send: <span style={{ fontWeight: '600', color: '#333' }}>3:40 AM</span></div>
                            <div style={{ marginBottom: '8px' }}>• Predicted open rate: <span style={{ fontWeight: '600', color: '#059669' }}>42.44%</span></div>
                            <div style={{ marginBottom: '8px' }}>• Engagement score: <span style={{ fontWeight: '600', color: '#333' }}>High</span></div>
                            <div>• Optimal subject length: <span style={{ fontWeight: '600', color: '#333' }}>40-50 chars</span></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Schedule Message Modal */}
            {showScheduleModal && (
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
                        padding: '32px',
                        borderRadius: '12px',
                        maxWidth: '400px',
                        width: '90%'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Schedule Message</h2>
                            <button
                                onClick={() => setShowScheduleModal(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '24px',
                                    cursor: 'pointer',
                                    color: '#999'
                                }}
                            >
                                ×
                            </button>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#333' }}>
                                Select Date and Time
                            </label>
                            <input
                                type="datetime-local"
                                value={scheduledTime}
                                onChange={(e) => setScheduledTime(e.target.value)}
                                min={new Date().toISOString().slice(0, 16)}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    fontFamily: 'inherit',
                                    boxSizing: 'border-box'
                                }}
                            />
                            <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                                Minimum time: {new Date().toLocaleString()}
                            </div>
                        </div>

                        {scheduledTime && (
                            <div style={{ marginBottom: '24px', padding: '12px', background: '#f0fdf4', borderRadius: '6px', border: '1px solid #86efac' }}>
                                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Scheduled send time:</div>
                                <div style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>
                                    {new Date(scheduledTime).toLocaleString()}
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={handleScheduleSubmit}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    background: '#8b5cf6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '600'
                                }}
                            >
                                Confirm Schedule
                            </button>
                            <button
                                onClick={() => {
                                    setShowScheduleModal(false);
                                    setScheduledTime('');
                                }}
                                style={{
                                    flex: 1,
                                    padding: '12px',
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
                </div>
            )}

            {/* Preview Recipients Modal */}
            {showPreviewModal && (
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
                        padding: '32px',
                        borderRadius: '12px',
                        maxWidth: '600px',
                        width: '90%',
                        maxHeight: '80vh',
                        overflow: 'auto'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <h2 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Preview Recipients</h2>
                                <button
                                    onClick={async () => {
                                        if (formData.id || generatedContentId) {
                                            setIsLoadingPreview(true);
                                            try {
                                                const preview = await previewBroadcastRecipients(formData.id || generatedContentId);
                                                console.log('[refresh preview] ✅ Preview response:', preview);
                                                setPreviewRecipients(preview);
                                            } catch (error) {
                                                console.error('[refresh preview] error:', error);
                                            } finally {
                                                setIsLoadingPreview(false);
                                            }
                                        }
                                    }}
                                    style={{
                                        padding: '6px 12px',
                                        background: '#f3f4f6',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        fontWeight: '500',
                                        color: '#333'
                                    }}
                                >
                                    🔄 Refresh
                                </button>
                            </div>
                            <button
                                onClick={() => {
                                    setShowPreviewModal(false);
                                    setPreviewRecipients(null);
                                }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '24px',
                                    cursor: 'pointer',
                                    color: '#999'
                                }}
                            >
                                ×
                            </button>
                        </div>

                        {isLoadingPreview ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                                <div style={{ fontSize: '32px', marginBottom: '16px' }}>⏳</div>
                                <div>Loading recipients...</div>
                            </div>
                        ) : previewRecipients ? (
                            <div>
                                <div style={{ fontSize: '12px', color: '#666', marginBottom: '16px', textAlign: 'center', background: '#f0fdf4', padding: '8px', borderRadius: '6px', border: '1px solid #86efac' }}>
                                    🔄 Auto-refreshing every 5 seconds
                                </div>
                                <div style={{ marginBottom: '24px', padding: '16px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #86efac' }}>
                                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#333', marginBottom: '8px' }}>
                                        Total Recipients: {
                                            previewRecipients?.data?.totalCount || 
                                            previewRecipients?.data?.TotalCount || 
                                            previewRecipients?.totalCount || 
                                            previewRecipients?.TotalCount || 
                                            previewRecipients?.count || 
                                            previewRecipients?.Count ||
                                            (previewRecipients?.recipients?.length) ||
                                            (previewRecipients?.data?.recipients?.length) ||
                                            (Array.isArray(previewRecipients?.Recipients) ? previewRecipients.Recipients.length : 0) ||
                                            (Array.isArray(previewRecipients?.data?.Recipients) ? previewRecipients.data.Recipients.length : 0) ||
                                            0
                                        }
                                    </div>
                                    {previewRecipients.byTag && (
                                        <div style={{ fontSize: '13px', color: '#666' }}>
                                            Breakdown by tags available
                                        </div>
                                    )}
                                </div>

                                {(previewRecipients.recipients || previewRecipients.Recipients || previewRecipients.data?.recipients || previewRecipients.data?.Recipients) && 
                                 (Array.isArray(previewRecipients.recipients) || Array.isArray(previewRecipients.Recipients) || Array.isArray(previewRecipients.data?.recipients) || Array.isArray(previewRecipients.data?.Recipients)) && 
                                 ((previewRecipients.recipients?.length || 0) + (previewRecipients.Recipients?.length || 0) + (previewRecipients.data?.recipients?.length || 0) + (previewRecipients.data?.Recipients?.length || 0) > 0) && (
                                    <div>
                                        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Sample Recipients:</h3>
                                        <div style={{ maxHeight: '300px', overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                                            {(previewRecipients.recipients || previewRecipients.Recipients || previewRecipients.data?.recipients || previewRecipients.data?.Recipients || []).slice(0, 50).map((recipient, idx) => (
                                                <div key={idx} style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', fontSize: '14px' }}>
                                                    <div style={{ fontWeight: '600', color: '#333' }}>
                                                        {recipient.email || recipient.Email || 'N/A'}
                                                    </div>
                                                    {(recipient.name || recipient.Name) && (
                                                        <div style={{ fontSize: '12px', color: '#666' }}>
                                                            {recipient.name || recipient.Name}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={() => {
                                        setShowPreviewModal(false);
                                        setPreviewRecipients(null);
                                    }}
                                    style={{
                                        width: '100%',
                                        marginTop: '24px',
                                        padding: '12px',
                                        background: '#dc2626',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: '600'
                                    }}
                                >
                                    Close
                                </button>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                                No preview data available
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Statistics Modal */}
            {showStatisticsModal && (
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
                        padding: '32px',
                        borderRadius: '12px',
                        maxWidth: '600px',
                        width: '90%',
                        maxHeight: '80vh',
                        overflow: 'auto'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <h2 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Broadcast Statistics</h2>
                                <button
                                    onClick={refreshStatistics}
                                    style={{
                                        padding: '6px 12px',
                                        background: '#f3f4f6',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        fontWeight: '500',
                                        color: '#333'
                                    }}
                                >
                                    🔄 Refresh
                                </button>
                            </div>
                            <button
                                onClick={() => {
                                    setShowStatisticsModal(false);
                                    setStatistics(null);
                                    setStatisticsBroadcastId(null);
                                }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '24px',
                                    cursor: 'pointer',
                                    color: '#999'
                                }}
                            >
                                ×
                            </button>
                        </div>

                        {statistics ? (
                            <div>
                                <div style={{ fontSize: '12px', color: '#666', marginBottom: '16px', textAlign: 'center', background: '#f9fafb', padding: '8px', borderRadius: '6px' }}>
                                    📊 Auto-refreshing every 10 seconds
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                    <div style={{ padding: '16px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #86efac' }}>
                                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Total Sent</div>
                                        <div style={{ fontSize: '24px', fontWeight: '700', color: '#059669' }}>
                                            {statistics.totalSent || statistics.TotalSent || 0}
                                        </div>
                                    </div>
                                    <div style={{ padding: '16px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #93c5fd' }}>
                                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Delivered</div>
                                        <div style={{ fontSize: '24px', fontWeight: '700', color: '#2563eb' }}>
                                            {statistics.delivered || statistics.Delivered || 0}
                                        </div>
                                    </div>
                                    <div style={{ padding: '16px', background: '#fef3c7', borderRadius: '8px', border: '1px solid #fcd34d' }}>
                                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Opened</div>
                                        <div style={{ fontSize: '24px', fontWeight: '700', color: '#f59e0b' }}>
                                            {statistics.opened || statistics.Opened || 0}
                                        </div>
                                    </div>
                                    <div style={{ padding: '16px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Failed</div>
                                        <div style={{ fontSize: '24px', fontWeight: '700', color: '#dc2626' }}>
                                            {statistics.failed || statistics.Failed || 0}
                                        </div>
                                    </div>
                                </div>

                                {(statistics.openRate || statistics.OpenRate) && (
                                    <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px', marginBottom: '16px' }}>
                                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Open Rate</div>
                                        <div style={{ fontSize: '20px', fontWeight: '700', color: '#333' }}>
                                            {statistics.openRate || statistics.OpenRate}%
                                        </div>
                                    </div>
                                )}

                                {statistics.sentAt && (
                                    <div style={{ fontSize: '13px', color: '#666', marginTop: '16px' }}>
                                        Sent at: {new Date(statistics.sentAt).toLocaleString()}
                                    </div>
                                )}

                                <button
                                    onClick={() => {
                                        setShowStatisticsModal(false);
                                        setStatistics(null);
                                        setStatisticsBroadcastId(null);
                                    }}
                                    style={{
                                        width: '100%',
                                        marginTop: '24px',
                                        padding: '12px',
                                        background: '#dc2626',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: '600'
                                    }}
                                >
                                    Close
                                </button>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                                <div style={{ fontSize: '32px', marginBottom: '16px' }}>⏳</div>
                                <div>Loading statistics...</div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// Normalize channels to an array (supports single string, comma-separated string, or array)
const normalizeChannels = (raw) => {
    const normalizeVal = (v) => {
        if (!v) return null;
        if (typeof v === 'number') return (v & 1) ? 'Email' : 'Email';
        const val = v.trim();
        // WeChat was removed from backend; map any legacy values back to Email.
        if (val.toLowerCase() === 'wechat' || val.toLowerCase() === 'sms') return 'Email';
        return val.toLowerCase() === 'email' ? 'Email' : 'Email';
    };

    if (Array.isArray(raw)) return raw.map(normalizeVal).filter(Boolean);
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

export default BroadcastManagement;