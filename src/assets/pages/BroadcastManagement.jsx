import React, { useState, useEffect, useMemo } from 'react';
import { getRoleFromToken } from '../../utils/auth';
import { useNavigate } from 'react-router-dom';
import { previewBroadcastRecipients, sendBroadcast, getBroadcastStatistics, getAudienceCounts, getAvailableTags, previewTargetedMembers, getTagStatistics } from '../../api/broadcast';

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
        // Bilingual fields
        language: 0,       // 0=English, 1=Chinese, 2=Both
        titleZH: '',
        subjectZH: '',
        bodyZH: '',
        channel: ['Email'],
        // Legacy audience targeting (keeping for backward compatibility)
        targetAudience: [],
        id: null,
        scheduledSendAt: '',
        selectedArticleIds: [],
        // New tag-based targeting
        selectedInterestTagIds: [],
        selectedIndustryTagIds: []
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

    // Bilingual / translation state
    const [isTranslating, setIsTranslating] = useState(false);
    const [isGeneratingTranslation, setIsGeneratingTranslation] = useState(false);
    const [translationStatus, setTranslationStatus] = useState(null); // 'success' | 'error' | null
    const [translationMessage, setTranslationMessage] = useState('');
    const [hasChineseTranslation, setHasChineseTranslation] = useState(false);

    // New tag-based targeting state
    const [availableInterestTagsForTargeting, setAvailableInterestTagsForTargeting] = useState([]);
    const [availableIndustryTagsForTargeting, setAvailableIndustryTagsForTargeting] = useState([]);
    const [isLoadingTargetingTags, setIsLoadingTargetingTags] = useState(false);
    const [targetingTagsError, setTargetingTagsError] = useState(null);
    const [previewedTargetedMembers, setPreviewedTargetedMembers] = useState(null);
    const [isLoadingTargetingPreview, setIsLoadingTargetingPreview] = useState(false);

    // AI insights/recommendations (typed DTO when available)
    const [aiResult, setAiResult] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState(null);
    const [aiDebug, setAiDebug] = useState(null);
    const [showRaw, setShowRaw] = useState(false);
    const [aiGeneratedAt, setAiGeneratedAt] = useState(null);
    const [aiAppliedSubject, setAiAppliedSubject] = useState(null);
    // Real-time lightweight feedback (no AI call)
    const [quickInsights, setQuickInsights] = useState(null);
    const [quickInsightsLoading, setQuickInsightsLoading] = useState(false);

    // Build a context snapshot of the current broadcast to pass to the AI
    const buildBroadcastContext = () => ({
        title: formData.title || '',
        subject: formData.subject || '',
        bodyPreview: (formData.body || '').slice(0, 300),
        selectedArticleCount: (formData.selectedArticleIds || []).length,
        interestTagIds: formData.selectedInterestTagIds || [],
        industryTagIds: formData.selectedIndustryTagIds || [],
        scheduledSendAt: formData.scheduledSendAt || null,
    });

    // Compute broadcast readiness: returns array of {label, done}
    const broadcastReadiness = useMemo(() => [
        { label: 'Subject line', done: (formData.subject || '').trim().length > 0 },
        { label: 'Message body', done: (formData.body || '').trim().length > 0 },
        { label: 'Audience tags selected', done: (formData.selectedInterestTagIds?.length > 0 || formData.selectedIndustryTagIds?.length > 0) },
        { label: 'Article(s) attached', done: (formData.selectedArticleIds?.length > 0) },
    ], [formData.subject, formData.body, formData.selectedInterestTagIds, formData.selectedIndustryTagIds, formData.selectedArticleIds]);

    const readinessCount = broadcastReadiness.filter(r => r.done).length;
    const canGenerateInsights = readinessCount >= 2; // need at least subject + body OR tags

    // Client-side article recommendations: score published articles by tag overlap
    const recommendedArticles = useMemo(() => {
        if (!Array.isArray(publishedArticles) || publishedArticles.length === 0) return [];
        const selectedInterest = new Set(formData.selectedInterestTagIds || []);
        const selectedIndustry = new Set(formData.selectedIndustryTagIds || []);
        const selectedIds = new Set(formData.selectedArticleIds || []);
        return publishedArticles
            .filter(a => {
                const id = a?.publicationDraftId ?? a?.PublicationDraftId;
                return id && !selectedIds.has(id);
            })
            .map(a => {
                const interestTagIds = a?.interestTagIds ?? a?.InterestTagIds ?? [];
                const industryTagId = a?.industryTagId ?? a?.IndustryTagId ?? null;
                let score = 0;
                if (Array.isArray(interestTagIds)) {
                    interestTagIds.forEach(id => { if (selectedInterest.has(id)) score += 2; });
                }
                if (industryTagId && selectedIndustry.has(industryTagId)) score += 3;
                // Also give a small recency bonus
                const published = a?.publishedAt ?? a?.PublishedAt;
                if (published) {
                    const ageDays = (Date.now() - new Date(published).getTime()) / 86400000;
                    if (ageDays < 7) score += 2;
                    else if (ageDays < 30) score += 1;
                }
                return { ...a, _score: score };
            })
            .filter(a => a._score > 0)
            .sort((a, b) => b._score - a._score)
            .slice(0, 3);
    }, [publishedArticles, formData.selectedInterestTagIds, formData.selectedIndustryTagIds, formData.selectedArticleIds]);

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

    // POST /api/analytics/broadcast/quick-insights — instant, no AI
    const fetchQuickInsights = async () => {
        const subject = formData.subject || '';
        const body = formData.body || '';
        if (!subject.trim() && !body.trim()) { setQuickInsights(null); return; }
        try {
            setQuickInsightsLoading(true);
            const payload = {
                draftSubject: subject,
                draftBody: body,
                selectedArticleIds: formData.selectedArticleIds || [],
                selectedInterestTagIds: formData.selectedInterestTagIds || [],
                selectedIndustryTagIds: formData.selectedIndustryTagIds || [],
            };
            const res = await apiFetch('/api/analytics/broadcast/quick-insights', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            if (res && typeof res === 'object') setQuickInsights(res);
        } catch (err) {
            console.warn('[fetchQuickInsights] error (non-blocking)', err?.message);
        } finally {
            setQuickInsightsLoading(false);
        }
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
        language: draft?.language ?? draft?.Language ?? 0,
        titleZH: draft?.titleZH ?? draft?.TitleZH ?? '',
        subjectZH: draft?.subjectZH ?? draft?.SubjectZH ?? '',
        bodyZH: draft?.bodyZH ?? draft?.BodyZH ?? '',
        hasChineseTranslation: draft?.hasChineseTranslation ?? draft?.HasChineseTranslation ?? false,
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
        fetchTagsForTargeting();
        fetchPublishedArticles();
        fetchAudienceCounts();
        // NOTE: AI insights are manual — do not auto-fetch on mount
        
        // Poll audience counts every 30 seconds
        const audienceInterval = setInterval(() => {
            fetchAudienceCounts();
        }, 30000);
        
        return () => {
            clearInterval(audienceInterval);
        };
    }, []);

    // NOTE: generation is manual via 'Generate Insights' button

    // POST /api/analytics/broadcast/ai-insights — full AI analysis
    const fetchAiInsights = async () => {
        try {
            setAiLoading(true);
            setAiError(null);
            setAiGeneratedAt(null);
            setAiDebug(null);
            const payload = {
                draftSubject: formData.subject || '',
                draftBody: formData.body || '',
                selectedArticleIds: formData.selectedArticleIds || [],
                selectedInterestTagIds: formData.selectedInterestTagIds || [],
                selectedIndustryTagIds: formData.selectedIndustryTagIds || [],
                broadcastId: formData.id || null,
                includeSubjectSuggestions: true,
                includeArticleSuggestions: true,
            };
            const res = await apiFetch('/api/analytics/broadcast/ai-insights', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            if (res && typeof res === 'object') {
                setAiResult(res);
                setAiDebug({ raw: JSON.stringify(res, null, 2), ok: true });
            } else if (typeof res === 'string') {
                const parsed = safeJsonParse(res);
                setAiResult(parsed ?? { raw: res });
                setAiDebug({ raw: res, ok: true });
            } else {
                setAiResult(null);
            }
            setAiGeneratedAt(new Date());
        } catch (err) {
            console.error('[fetchAiInsights] error', err);
            setAiError(err?.message || String(err));
            setAiResult(null);
            setAiDebug({ error: err?.message || String(err) });
        } finally {
            setAiLoading(false);
        }
    };

    // Debounced quick-insights — fires 600ms after subject/body/tags change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        const t = setTimeout(() => { fetchQuickInsights(); }, 600);
        return () => clearTimeout(t);
    }, [formData.subject, formData.body, formData.selectedInterestTagIds, formData.selectedIndustryTagIds, formData.selectedArticleIds]);

    // POST /api/Broadcast/{id}/translate?targetLanguage=zh|en
    // Auto-saves a draft if no ID exists yet, returns the broadcast ID
    const saveDraftIfNeeded = async () => {
        const existing = formData.id || generatedContentId;
        if (existing) return existing;
        if (!formData.title?.trim() || !formData.subject?.trim() || !formData.body?.trim()) {
            setTranslationStatus('error');
            setTranslationMessage('Please fill in Title, Subject, and Body before translating.');
            setTimeout(() => setTranslationStatus(null), 5000);
            return null;
        }
        const selectedAudience = formData.targetAudience?.length ? formData.targetAudience : [0];
        const selectedChannels = formData.channel?.length ? formData.channel : ['Email'];
        const draftData = {
            title: formData.title,
            subject: formData.subject,
            body: formData.body,
            language: formData.language ?? 0,
            titleZH: formData.titleZH || null,
            subjectZH: formData.subjectZH || null,
            bodyZH: formData.bodyZH || null,
            channel: toChannelEnumValue(selectedChannels),
            targetAudience: toAudienceEnumValue(selectedAudience),
            scheduledSendAt: formData.scheduledSendAt || null,
            selectedArticleIds: Array.isArray(formData.selectedArticleIds) ? formData.selectedArticleIds : []
        };
        const response = await apiFetch('/api/broadcast', { method: 'POST', body: JSON.stringify(draftData) });
        const newId = response?.id || response?.Id;
        if (!newId) throw new Error('Draft saved but no ID returned');
        setFormData(fd => ({ ...fd, id: newId }));
        fetchDrafts();
        return newId;
    };

    const handleTranslate = async (targetLang) => {
        try {
            setIsTranslating(true);
            setTranslationStatus(null);
            const broadcastId = await saveDraftIfNeeded();
            if (!broadcastId) { setIsTranslating(false); return; }
        try {
            setIsTranslating(true);
            setTranslationStatus(null);
            const res = await apiFetch(`/api/Broadcast/${broadcastId}/translate?targetLanguage=${targetLang}`, { method: 'POST' });
            if (res && res.success !== false) {
                if (targetLang === 'zh') {
                    setFormData(fd => ({
                        ...fd,
                        titleZH: res.translatedTitle ?? fd.titleZH,
                        subjectZH: res.translatedSubject ?? fd.subjectZH,
                        bodyZH: res.translatedBody ?? fd.bodyZH,
                        language: fd.language === 0 ? 2 : fd.language, // upgrade to Both if was English-only
                    }));
                    setHasChineseTranslation(true);
                } else {
                    setFormData(fd => ({
                        ...fd,
                        title: res.translatedTitle ?? fd.title,
                        subject: res.translatedSubject ?? fd.subject,
                        body: res.translatedBody ?? fd.body,
                    }));
                }
                setTranslationStatus('success');
                setTranslationMessage(`Translated to ${targetLang === 'zh' ? 'Chinese (中文)' : 'English'} successfully.`);
            } else {
                throw new Error(res?.message || 'Translation failed');
            }
        } catch (innerErr) {
            setTranslationStatus('error');
            setTranslationMessage(innerErr?.message || 'Translation failed. Check translation service configuration.');
        } finally {
            setIsTranslating(false);
            setTimeout(() => setTranslationStatus(null), 5000);
        }
        } catch (err) {
            setTranslationStatus('error');
            setTranslationMessage(err?.message || 'Could not auto-save draft before translating.');
            setIsTranslating(false);
            setTimeout(() => setTranslationStatus(null), 5000);
        }
    };

    // POST /api/Broadcast/{id}/generate-translations
    const handleGenerateTranslations = async () => {
        try {
            setIsGeneratingTranslation(true);
            setTranslationStatus(null);
            const broadcastId = await saveDraftIfNeeded();
            if (!broadcastId) { setIsGeneratingTranslation(false); return; }
        try {
            setIsGeneratingTranslation(true);
            setTranslationStatus(null);
            const res = await apiFetch(`/api/Broadcast/${broadcastId}/generate-translations`, { method: 'POST' });
            if (res && res.success !== false) {
                // Re-fetch the broadcast to get the updated ZH fields
                const updated = await apiFetch(`/api/Broadcast/${broadcastId}`);
                if (updated) {
                    setFormData(fd => ({
                        ...fd,
                        titleZH: updated.titleZH ?? updated.TitleZH ?? fd.titleZH,
                        subjectZH: updated.subjectZH ?? updated.SubjectZH ?? fd.subjectZH,
                        bodyZH: updated.bodyZH ?? updated.BodyZH ?? fd.bodyZH,
                        language: fd.language === 0 ? 2 : fd.language,
                    }));
                    setHasChineseTranslation(true);
                }
                setTranslationStatus('success');
                setTranslationMessage('Translations generated successfully.');
            } else {
                throw new Error(res?.message || 'Auto-generation failed');
            }
        } catch (innerErr) {
            setTranslationStatus('error');
            setTranslationMessage(innerErr?.message || 'Failed to generate translations.');
        } finally {
            setIsGeneratingTranslation(false);
            setTimeout(() => setTranslationStatus(null), 5000);
        }
        } catch (err) {
            setTranslationStatus('error');
            setTranslationMessage(err?.message || 'Could not auto-save draft before generating translations.');
            setIsGeneratingTranslation(false);
            setTimeout(() => setTranslationStatus(null), 5000);
        }
    };

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
            const response = await apiFetch('/api/broadcast/tags');
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

    // Fetch available tags for broadcast targeting (with member counts)
    const fetchTagsForTargeting = async () => {
        try {
            setIsLoadingTargetingTags(true);
            setTargetingTagsError(null);
            const data = await getAvailableTags();
            console.log('[fetchTagsForTargeting] ✅ Available tags:', data);
            
            // Process interest tags
            const interestTags = data?.interestTags || [];
            setAvailableInterestTagsForTargeting(interestTags);
            
            // Process industry tags
            const industryTags = data?.industryTags || [];
            setAvailableIndustryTagsForTargeting(industryTags);
        } catch (error) {
            console.error('[fetchTagsForTargeting] ❌ ERROR:', error);
            setAvailableInterestTagsForTargeting([]);
            setAvailableIndustryTagsForTargeting([]);
            setTargetingTagsError(error?.message || 'Failed to load targeting tags');
        } finally {
            setIsLoadingTargetingTags(false);
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

    // Preview targeted members based on tag selection
    const handlePreviewTargetedMembers = async () => {
        try {
            setIsLoadingTargetingPreview(true);
            const interestTagIds = formData.selectedInterestTagIds || [];
            const industryTagIds = formData.selectedIndustryTagIds || [];
            console.log('[handlePreviewTargetedMembers] Called with tags:', { interestTagIds, industryTagIds });
            const preview = await previewTargetedMembers(interestTagIds, industryTagIds);
            console.log('[handlePreviewTargetedMembers] Response:', preview);
            setPreviewedTargetedMembers(preview);
        } catch (error) {
            console.error('[handlePreviewTargetedMembers] error', error);
            setTargetingTagsError(error?.message || 'Failed to preview targeted members');
        } finally {
            setIsLoadingTargetingPreview(false);
        }
    };

    // Auto-preview when form tags change (debounced)
    useEffect(() => {
        const timer = setTimeout(() => {
            console.log('[Preview useEffect] tags:', { 
                interest: formData.selectedInterestTagIds?.length, 
                industry: formData.selectedIndustryTagIds?.length 
            });
            if (formData.selectedInterestTagIds?.length > 0 || formData.selectedIndustryTagIds?.length > 0) {
                console.log('[Preview useEffect] Calling handlePreviewTargetedMembers');
                handlePreviewTargetedMembers();
            } else {
                console.log('[Preview useEffect] Skipping preview - no tags');
                setPreviewedTargetedMembers(null);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [formData.selectedInterestTagIds, formData.selectedIndustryTagIds]);

    const fetchDrafts = async () => {
        try {
            const response = await apiFetch('/api/broadcast');
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
                title: formData.title,
                subject: formData.subject,
                body: formData.body,
                language: formData.language ?? 0,
                titleZH: formData.titleZH || null,
                subjectZH: formData.subjectZH || null,
                bodyZH: formData.bodyZH || null,
                channel: channelEnumValue,
                targetAudience: toAudienceEnumValue(selectedAudience),
                scheduledSendAt: formData.scheduledSendAt || null,
                selectedArticleIds: Array.isArray(formData.selectedArticleIds) ? formData.selectedArticleIds : []
            };
            console.log('[handleSubmit] selectedChannels array:', selectedChannels);
            console.log('[handleSubmit] channelEnumValue:', channelEnumValue, '(should be 1 for Email)');
            console.log('[handleSubmit] payload:', submitData);
            
            // If this was generated by AI, update the auto-generated draft instead of creating a new one
            if (generatedContentId) {
                console.log('[handleSubmit] Updating auto-generated draft:', generatedContentId);
                const response = await apiFetch(`/api/broadcast/${generatedContentId}`, {
                    method: 'PUT',
                    body: JSON.stringify(submitData)
                });
                console.log('[handleSubmit] update response:', response);
                alert('Draft updated successfully!');
                setGeneratedContentId(null);
                setGeneratedContent(null);
                setFormData({ title: '', subject: '', body: '', language: 0, titleZH: '', subjectZH: '', bodyZH: '', channel: ['Email'], targetAudience: [], id: null, scheduledSendAt: '', selectedArticleIds: [] });
            } else {
                // Create a new draft
                const response = await apiFetch('/api/broadcast', {
                    method: 'POST',
                    body: JSON.stringify(submitData)
                });

                console.log('[handleSubmit] response:', response);
                alert('Draft saved successfully!');
                // Capture the draft ID from response
                const draftId = response?.id || response?.Id;
                setFormData({ title: '', subject: '', body: '', language: 0, titleZH: '', subjectZH: '', bodyZH: '', channel: ['Email'], targetAudience: [], id: draftId, scheduledSendAt: '', selectedArticleIds: [] });
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
        // First, ensure we have a draft ID (save/update if needed)
        let draftId = formData.id || generatedContentId;
        
        // If using AI-generated content, update it with current form data (including selectedArticleIds)
        if (generatedContentId && !formData.id) {
            try {
                setIsSavingDraft(true);
                const selectedAudience = formData.targetAudience?.length ? formData.targetAudience : [0];
                const selectedChannels = formData.channel?.length ? formData.channel : ['Email'];
                const channelEnumValue = toChannelEnumValue(selectedChannels);
                const updateData = {
                    title: formData.title,
                    subject: formData.subject,
                    body: formData.body,
                    channel: channelEnumValue,
                    targetAudience: toAudienceEnumValue(selectedAudience),
                    scheduledSendAt: formData.scheduledSendAt || null,
                    selectedArticleIds: Array.isArray(formData.selectedArticleIds) ? formData.selectedArticleIds : []
                };
                
                await apiFetch(`/api/broadcast/${generatedContentId}`, {
                    method: 'PUT',
                    body: JSON.stringify(updateData)
                });
                
                console.log('[handlePreviewRecipients] Updated AI-generated draft with selected articles');
            } catch (error) {
                console.error('[handlePreviewRecipients] update AI draft error:', error);
                alert('Failed to update draft: ' + error.message);
                return;
            } finally {
                setIsSavingDraft(false);
            }
        }
        
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
                    title: formData.title,
                    subject: formData.subject,
                    body: formData.body,
                    channel: channelEnumValue,
                    targetAudience: toAudienceEnumValue(selectedAudience),
                    scheduledSendAt: formData.scheduledSendAt || null,
                    selectedArticleIds: Array.isArray(formData.selectedArticleIds) ? formData.selectedArticleIds : []
                };
                
                const response = await apiFetch('/api/broadcast', {
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
        
        // Check if tags are selected for new targeting system
        const hasTagsSelected = (formData.selectedInterestTagIds?.length > 0) || (formData.selectedIndustryTagIds?.length > 0);
        
        if (!hasTagsSelected) {
            alert('Please select at least one Interest or Industry Tag before sending.');
            return;
        }

        // Build targeting description
        let targetingDesc = [];
        
        if (formData.selectedInterestTagIds?.length > 0) {
            const interestNames = formData.selectedInterestTagIds
                .map(id => availableInterestTagsForTargeting.find(t => t.id === id)?.nameEN || `Interest-${id}`)
                .filter(Boolean);
            if (interestNames.length > 0) {
                targetingDesc.push(`Interests: ${interestNames.join(', ')}`);
            }
        }
        
        if (formData.selectedIndustryTagIds?.length > 0) {
            const industryNames = formData.selectedIndustryTagIds
                .map(id => availableIndustryTagsForTargeting.find(t => t.id === id)?.nameEN || `Industry-${id}`)
                .filter(Boolean);
            if (industryNames.length > 0) {
                targetingDesc.push(`Industries: ${industryNames.join(', ')}`);
            }
        }

        const logicType = 'OR';
        const recipientCount = previewedTargetedMembers?.totalMembersMatched || 0;

        // Build channel description
        const channels = normalizeChannels(formData.channel);
        const channelDesc = channels.length === 1 ? channels[0] : channels.join(', ');

        const finalDesc = targetingDesc.length > 0 ? targetingDesc.join(' | ') : 'No filters';
        if (!window.confirm(`Send "${formData.subject}" to ${recipientCount} members (${logicType} logic):\n${finalDesc}\nvia ${channelDesc}?`)) return;
        
        // Ensure we have a draft ID (save/update if needed)
        let draftId = formData.id || generatedContentId;
        
        // If using AI-generated content, update it with current form data
        if (generatedContentId && !formData.id) {
            try {
                setIsSavingDraft(true);
                const selectedChannels = formData.channel?.length ? formData.channel : ['Email'];
                const channelEnumValue = toChannelEnumValue(selectedChannels);
                const updateData = {
                    title: formData.title,
                    subject: formData.subject,
                    body: formData.body,
                    language: formData.language ?? 0,
                    titleZH: formData.titleZH || null,
                    subjectZH: formData.subjectZH || null,
                    bodyZH: formData.bodyZH || null,
                    channel: channelEnumValue,
                    // New tag-based targeting
                    selectedInterestTagIds: formData.selectedInterestTagIds || [],
                    selectedIndustryTagIds: formData.selectedIndustryTagIds || [],
                    // PascalCase variants for backend compatibility
                    SelectedInterestTagIds: formData.selectedInterestTagIds || [],
                    SelectedIndustryTagIds: formData.selectedIndustryTagIds || [],
                    // Keep for backward compatibility
                    targetAudience: 0,
                    scheduledSendAt: formData.scheduledSendAt || null,
                    selectedArticleIds: Array.isArray(formData.selectedArticleIds) ? formData.selectedArticleIds : []
                };
                
                await apiFetch(`/api/broadcast/${generatedContentId}`, {
                    method: 'PUT',
                    body: JSON.stringify(updateData)
                });
                
                console.log('[handleSendBroadcast] Updated AI-generated draft with tag-based targeting');
            } catch (error) {
                console.error('[handleSendBroadcast] update AI draft error:', error);
                alert('Failed to update draft: ' + error.message);
                return;
            } finally {
                setIsSavingDraft(false);
            }
        }
        
        if (!draftId) {
            try {
                setIsSavingDraft(true);
                const selectedChannels = formData.channel?.length ? formData.channel : ['Email'];
                const channelEnumValue = toChannelEnumValue(selectedChannels);
                const submitData = {
                    title: formData.title,
                    subject: formData.subject,
                    body: formData.body,
                    language: formData.language ?? 0,
                    titleZH: formData.titleZH || null,
                    subjectZH: formData.subjectZH || null,
                    bodyZH: formData.bodyZH || null,
                    channel: channelEnumValue,
                    // New tag-based targeting
                    selectedInterestTagIds: formData.selectedInterestTagIds || [],
                    selectedIndustryTagIds: formData.selectedIndustryTagIds || [],
                    // PascalCase variants for backend compatibility
                    SelectedInterestTagIds: formData.selectedInterestTagIds || [],
                    SelectedIndustryTagIds: formData.selectedIndustryTagIds || [],
                    // Keep for backward compatibility
                    targetAudience: 0,
                    scheduledSendAt: formData.scheduledSendAt || null,
                    selectedArticleIds: Array.isArray(formData.selectedArticleIds) ? formData.selectedArticleIds : []
                };
                
                const response = await apiFetch('/api/broadcast', {
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
            setFormData({ 
                title: '', 
                subject: '', 
                body: '',
                language: 0,
                titleZH: '',
                subjectZH: '',
                bodyZH: '',
                channel: ['Email'], 
                targetAudience: [], 
                id: null, 
                scheduledSendAt: '', 
                selectedArticleIds: [],
                selectedInterestTagIds: [],
                selectedIndustryTagIds: []
            });
            setGeneratedContentId(null);
            setGeneratedContent(null);
            setHasChineseTranslation(false);
            setPreviewedTargetedMembers(null);
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
            await apiFetch(`/api/broadcast/${id}`, { method: 'DELETE' });
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
                title: formData.title,
                subject: formData.subject,
                body: formData.body,
                channel: channelEnumValue,
                targetAudience: toAudienceEnumValue(selectedAudience),
                selectedArticleIds: Array.isArray(formData.selectedArticleIds) ? formData.selectedArticleIds : []
            };

            let broadcastId;
            if (formData.id || generatedContentId) {
                // Update existing draft
                broadcastId = formData.id || generatedContentId;
                await apiFetch(`/api/broadcast/${broadcastId}`, {
                    method: 'PUT',
                    body: JSON.stringify(submitData)
                });
            } else {
                // Create new draft
                const response = await apiFetch('/api/broadcast', {
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

            await apiFetch(`/api/broadcast/${broadcastId}`, {
                method: 'PUT',
                body: JSON.stringify({ scheduledSendAt: scheduledTime })
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
                language: formData.language === 1 ? 'zh' : 'en',
                Channel: channelEnumValue,
                TargetAudience: targetAudienceEnumValue
            };

            // Your backend controller route is api/broadcast/generate
            // and returns a lightweight BroadcastListItemDTO (no Body), so we fetch details after.
            const response = await apiFetch('/api/broadcast/generate', {
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
                        detail = await apiFetch(`/api/broadcast/${newId}`);
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

                        {/* Language Selector */}
                        <div style={{ marginBottom: '20px', padding: '14px 16px', background: '#f8faff', border: '1px solid #e0e7ff', borderRadius: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                <span style={{ fontSize: '16px' }}>🌐</span>
                                <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e1b4b' }}>Broadcast Language</span>
                                {formData.language === 2 && hasChineseTranslation && (
                                    <span style={{ fontSize: '11px', background: '#f0fdf4', color: '#059669', padding: '2px 8px', borderRadius: '999px', border: '1px solid #bbf7d0', marginLeft: 'auto' }}>✓ Chinese translation ready</span>
                                )}
                                {formData.language !== 0 && !hasChineseTranslation && formData.language !== 1 && (
                                    <span style={{ fontSize: '11px', background: '#fffbeb', color: '#d97706', padding: '2px 8px', borderRadius: '999px', border: '1px solid #fde68a', marginLeft: 'auto' }}>⚠ No Chinese translation yet</span>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {[
                                    { value: 0, label: 'English Only', icon: '🇬🇧', desc: 'Send in English to all members' },
                                    { value: 1, label: 'Chinese Only', icon: '🇨🇳', desc: '仅发送中文版本' },
                                    { value: 2, label: 'Both Languages', icon: '🌐', desc: "Sent in member's preferred language" },
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setFormData(fd => ({ ...fd, language: opt.value }))}
                                        style={{
                                            flex: 1, minWidth: '140px', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                                            border: formData.language === opt.value ? '2px solid #4f46e5' : '1px solid #e5e7eb',
                                            background: formData.language === opt.value ? '#eef2ff' : 'white',
                                            color: formData.language === opt.value ? '#4338ca' : '#374151',
                                            transition: 'all 0.15s',
                                            textAlign: 'left',
                                        }}
                                    >
                                        <div style={{ fontSize: '13px', fontWeight: formData.language === opt.value ? '700' : '500' }}>{opt.icon} {opt.label}</div>
                                        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{opt.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

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
                                    border: `1px solid ${formData.subject.length > 0 && formData.subject.length < 20 ? '#f59e0b' : formData.subject.length >= 20 && formData.subject.length <= 60 ? '#059669' : formData.subject.length > 60 ? '#dc2626' : '#e5e7eb'}`,
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    fontFamily: 'inherit',
                                    boxSizing: 'border-box'
                                }}
                                required
                            />
                            {/* Live subject feedback */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap', gap: '4px' }}>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    {formData.subject.length === 0 && (
                                        <span style={{ fontSize: '12px', color: '#9ca3af' }}>Type your subject line above</span>
                                    )}
                                    {formData.subject.length > 0 && formData.subject.length < 20 && (
                                        <span style={{ fontSize: '12px', color: '#f59e0b', background: '#fffbeb', padding: '2px 8px', borderRadius: '999px', border: '1px solid #fde68a' }}>⚠ Too short — aim for 20–60 chars</span>
                                    )}
                                    {formData.subject.length >= 20 && formData.subject.length <= 60 && (
                                        <span style={{ fontSize: '12px', color: '#059669', background: '#f0fdf4', padding: '2px 8px', borderRadius: '999px', border: '1px solid #bbf7d0' }}>✓ Good length</span>
                                    )}
                                    {formData.subject.length > 60 && (
                                        <span style={{ fontSize: '12px', color: '#dc2626', background: '#fef2f2', padding: '2px 8px', borderRadius: '999px', border: '1px solid #fecaca' }}>⚠ Too long — may be clipped in email</span>
                                    )}
                                    {formData.subject.length > 0 && !/(read|discover|exclusive|breaking|now|today|update|alert|new|free|latest)/i.test(formData.subject) && (
                                        <span style={{ fontSize: '12px', color: '#6b7280', background: '#f9fafb', padding: '2px 8px', borderRadius: '999px', border: '1px solid #e5e7eb' }}>💡 Add an action word (e.g. "Read", "Discover")</span>
                                    )}
                                    {formData.subject.length > 0 && /[A-Z]{3,}/.test(formData.subject) && (
                                        <span style={{ fontSize: '12px', color: '#f59e0b', background: '#fffbeb', padding: '2px 8px', borderRadius: '999px', border: '1px solid #fde68a' }}>⚠ Avoid all-caps (spam filter risk)</span>
                                    )}
                                </div>
                                <span style={{ fontSize: '12px', color: formData.subject.length > 60 ? '#dc2626' : '#9ca3af' }}>{formData.subject.length} chars</span>
                            </div>
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

                        {/* Chinese Content Fields */}
                        {formData.language !== 0 && (() => {
                            const zhHasContent = !!(formData.subjectZH?.trim() || formData.bodyZH?.trim());
                            const busy = isTranslating || isGeneratingTranslation;
                            return (
                            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '2px dashed #e0e7ff' }}>

                                {/* Section header */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                                    <span style={{ fontSize: '16px' }}>🇨🇳</span>
                                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#1e1b4b' }}>Chinese Content (中文内容)</span>
                                    {zhHasContent
                                        ? <span style={{ fontSize: '11px', background: '#f0fdf4', color: '#059669', padding: '2px 8px', borderRadius: '999px', border: '1px solid #bbf7d0' }}>✓ Filled</span>
                                        : <span style={{ fontSize: '11px', background: '#fffbeb', color: '#b45309', padding: '2px 8px', borderRadius: '999px', border: '1px solid #fde68a' }}>Empty — fill below or use translation</span>
                                    }
                                </div>

                                {/* Translation status banner */}
                                {translationStatus === 'success' && (
                                    <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#059669', fontSize: '13px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        ✓ {translationMessage}
                                    </div>
                                )}
                                {translationStatus === 'error' && (
                                    <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '13px', marginBottom: '14px' }}>
                                        ⚠️ {translationMessage}
                                    </div>
                                )}

                                {/* ── Translation action card ── */}
                                {!zhHasContent ? (
                                    /* Empty state — guide the user clearly */
                                    <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '10px', padding: '16px 18px', marginBottom: '18px' }}>
                                        <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#4c1d95' }}>
                                            Your Chinese fields are empty. You can type manually below, or let the system fill them from your English content:
                                        </p>
                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                            {/* Primary — direct translation */}
                                            <button
                                                type="button"
                                                onClick={() => handleTranslate('zh')}
                                                disabled={busy}
                                                style={{
                                                    padding: '9px 16px', fontSize: '13px', fontWeight: '700', borderRadius: '7px', border: 'none',
                                                    background: busy ? '#e5e7eb' : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                                                    color: busy ? '#9ca3af' : 'white',
                                                    cursor: busy ? 'not-allowed' : 'pointer',
                                                    display: 'flex', alignItems: 'center', gap: '7px', flex: '1', minWidth: '200px'
                                                }}
                                            >
                                                {isTranslating
                                                    ? <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span> Translating…</>
                                                    : <><span>🔄</span><div style={{ textAlign: 'left' }}><div>Translate to Chinese</div><div style={{ fontSize: '11px', fontWeight: '400', opacity: 0.85 }}>Fills fields from your English text</div></div></>
                                                }
                                            </button>
                                            {/* Secondary — AI contextual generation */}
                                            <button
                                                type="button"
                                                onClick={handleGenerateTranslations}
                                                disabled={busy}
                                                style={{
                                                    padding: '9px 16px', fontSize: '13px', fontWeight: '600', borderRadius: '7px',
                                                    border: '1px solid #ddd6fe',
                                                    background: busy ? '#f9fafb' : 'white',
                                                    color: busy ? '#9ca3af' : '#4f46e5',
                                                    cursor: busy ? 'not-allowed' : 'pointer',
                                                    display: 'flex', alignItems: 'center', gap: '7px', flex: '1', minWidth: '200px'
                                                }}
                                            >
                                                {isGeneratingTranslation
                                                    ? <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span> Generating…</>
                                                    : <><span>✨</span><div style={{ textAlign: 'left' }}><div>AI Contextual Version</div><div style={{ fontSize: '11px', fontWeight: '400', color: '#7c3aed' }}>More natural — uses broadcast context</div></div></>
                                                }
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* Filled state — subtler re-translate option */
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '12px', color: '#9ca3af' }}>Need to update?</span>
                                        <button
                                            type="button"
                                            onClick={() => handleTranslate('zh')}
                                            disabled={busy}
                                            title="Overwrites current Chinese fields with a fresh translation of your English text"
                                            style={{
                                                padding: '5px 11px', fontSize: '12px', fontWeight: '600', borderRadius: '6px',
                                                border: '1px solid #fde68a', background: busy ? '#f9fafb' : '#fffbeb',
                                                color: busy ? '#9ca3af' : '#b45309',
                                                cursor: busy ? 'not-allowed' : 'pointer',
                                                display: 'flex', alignItems: 'center', gap: '5px'
                                            }}
                                        >
                                            {isTranslating ? <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span> Translating…</> : '🔄 Re-translate (overwrites)'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleGenerateTranslations}
                                            disabled={busy}
                                            title="AI generates a more contextual Chinese version and saves it — overwrites current Chinese fields"
                                            style={{
                                                padding: '5px 11px', fontSize: '12px', fontWeight: '600', borderRadius: '6px',
                                                border: '1px solid #ddd6fe', background: busy ? '#f9fafb' : 'white',
                                                color: busy ? '#9ca3af' : '#4f46e5',
                                                cursor: busy ? 'not-allowed' : 'pointer',
                                                display: 'flex', alignItems: 'center', gap: '5px'
                                            }}
                                        >
                                            {isGeneratingTranslation ? <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span> Generating…</> : '✨ AI Re-generate'}
                                        </button>
                                    </div>
                                )}

                                {/* Chinese Title */}
                                {formData.language !== 1 && (
                                    <div style={{ marginBottom: '14px' }}>
                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: '#555' }}>Title (中文标题)</label>
                                        <input
                                            type="text"
                                            name="titleZH"
                                            value={formData.titleZH}
                                            onChange={handleChange}
                                            placeholder="中文标题…"
                                            style={{ width: '100%', padding: '11px 12px', border: '1px solid #c7d2fe', borderRadius: '6px', fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box', background: '#fafbff' }}
                                        />
                                    </div>
                                )}

                                {/* Chinese Subject */}
                                <div style={{ marginBottom: '14px' }}>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: '#555' }}>Subject (中文主题行)</label>
                                    <input
                                        type="text"
                                        name="subjectZH"
                                        value={formData.subjectZH}
                                        onChange={handleChange}
                                        placeholder="中文邮件主题…"
                                        style={{ width: '100%', padding: '11px 12px', border: '1px solid #c7d2fe', borderRadius: '6px', fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box', background: '#fafbff' }}
                                    />
                                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{formData.subjectZH.length} chars</div>
                                </div>

                                {/* Chinese Body */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: '#555' }}>Body (中文正文)</label>
                                    <textarea
                                        name="bodyZH"
                                        value={formData.bodyZH}
                                        onChange={handleChange}
                                        placeholder="请在此输入中文内容…"
                                        style={{ width: '100%', padding: '12px', border: '1px solid #c7d2fe', borderRadius: '6px', fontSize: '14px', minHeight: '180px', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', background: '#fafbff' }}
                                    />
                                </div>
                            </div>
                            );
                        })()}
                    </div>

                    {/* Target Audience Selection */}
                    <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                            <span style={{ fontSize: '18px' }}>🎯</span>
                            <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: '#333' }}>Target Audience</h3>
                        </div>

                        {isLoadingTargetingTags ? (
                            <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                                <div style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</div> Loading tags...
                            </div>
                        ) : targetingTagsError ? (
                            <div style={{ padding: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '13px' }}>
                                ⚠️ {targetingTagsError}
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                                {/* Interest Tags */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <label style={{ fontSize: '13px', fontWeight: '600', color: '#333' }}>
                                            Interest Tags
                                        </label>
                                        <button
                                            onClick={() => {
                                                const allIds = availableInterestTagsForTargeting.map(t => t.id);
                                                const isAllSelected = allIds.length > 0 && allIds.every(id => (formData.selectedInterestTagIds || []).includes(id));
                                                setFormData({ 
                                                    ...formData, 
                                                    selectedInterestTagIds: isAllSelected ? [] : allIds 
                                                });
                                            }}
                                            style={{
                                                fontSize: '11px',
                                                padding: '4px 8px',
                                                background: '#f3f4f6',
                                                color: '#333',
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '4px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {availableInterestTagsForTargeting.length > 0 && availableInterestTagsForTargeting.every(t => (formData.selectedInterestTagIds || []).includes(t.id)) ? 'Clear All' : 'Select All'}
                                        </button>
                                    </div>
                                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', background: '#fafafa', maxHeight: '200px', overflow: 'auto' }}>
                                        {availableInterestTagsForTargeting.length > 0 ? (
                                            availableInterestTagsForTargeting.map((tag) => {
                                                const isSelected = (formData.selectedInterestTagIds || []).includes(tag.id);
                                                return (
                                                    <label
                                                        key={`interest-${tag.id}`}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            padding: '6px 8px',
                                                            cursor: 'pointer',
                                                            borderRadius: '4px',
                                                            background: isSelected ? '#fef2f2' : 'transparent',
                                                            marginBottom: '4px'
                                                        }}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => {
                                                                const current = formData.selectedInterestTagIds || [];
                                                                const next = isSelected
                                                                    ? current.filter(id => id !== tag.id)
                                                                    : [...current, tag.id];
                                                                setFormData({ ...formData, selectedInterestTagIds: next });
                                                            }}
                                                            style={{ width: '16px', height: '16px', accentColor: '#dc2626', cursor: 'pointer' }}
                                                        />
                                                        <div style={{ flex: 1, fontSize: '13px' }}>
                                                            <div style={{ fontWeight: isSelected ? '600' : '500', color: isSelected ? '#dc2626' : '#333' }}>
                                                                {tag.nameEN || tag.name}
                                                            </div>
                                                            <div style={{ fontSize: '11px', color: '#999' }}>
                                                                {tag.memberCount} members
                                                            </div>
                                                        </div>
                                                    </label>
                                                );
                                            })
                                        ) : (
                                            <div style={{ color: '#999', fontSize: '12px', padding: '8px' }}>No interest tags available</div>
                                        )}
                                    </div>
                                </div>

                                {/* Industry Tags */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <label style={{ fontSize: '13px', fontWeight: '600', color: '#333' }}>
                                            Industry Tags
                                        </label>
                                        <button
                                            onClick={() => {
                                                const allIds = availableIndustryTagsForTargeting.map(t => t.id);
                                                const isAllSelected = allIds.length > 0 && allIds.every(id => (formData.selectedIndustryTagIds || []).includes(id));
                                                setFormData({ 
                                                    ...formData, 
                                                    selectedIndustryTagIds: isAllSelected ? [] : allIds 
                                                });
                                            }}
                                            style={{
                                                fontSize: '11px',
                                                padding: '4px 8px',
                                                background: '#f3f4f6',
                                                color: '#333',
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '4px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {availableIndustryTagsForTargeting.length > 0 && availableIndustryTagsForTargeting.every(t => (formData.selectedIndustryTagIds || []).includes(t.id)) ? 'Clear All' : 'Select All'}
                                        </button>
                                    </div>
                                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', background: '#fafafa', maxHeight: '200px', overflow: 'auto' }}>
                                        {availableIndustryTagsForTargeting.length > 0 ? (
                                            availableIndustryTagsForTargeting.map((tag) => {
                                                const isSelected = (formData.selectedIndustryTagIds || []).includes(tag.id);
                                                return (
                                                    <label
                                                        key={`industry-${tag.id}`}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            padding: '6px 8px',
                                                            cursor: 'pointer',
                                                            borderRadius: '4px',
                                                            background: isSelected ? '#fef2f2' : 'transparent',
                                                            marginBottom: '4px'
                                                        }}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => {
                                                                const current = formData.selectedIndustryTagIds || [];
                                                                const next = isSelected
                                                                    ? current.filter(id => id !== tag.id)
                                                                    : [...current, tag.id];
                                                                setFormData({ ...formData, selectedIndustryTagIds: next });
                                                            }}
                                                            style={{ width: '16px', height: '16px', accentColor: '#dc2626', cursor: 'pointer' }}
                                                        />
                                                        <div style={{ flex: 1, fontSize: '13px' }}>
                                                            <div style={{ fontWeight: isSelected ? '600' : '500', color: isSelected ? '#dc2626' : '#333' }}>
                                                                {tag.nameEN || tag.name}
                                                            </div>
                                                            <div style={{ fontSize: '11px', color: '#999' }}>
                                                                {tag.memberCount} members
                                                            </div>
                                                        </div>
                                                    </label>
                                                );
                                            })
                                        ) : (
                                            <div style={{ color: '#999', fontSize: '12px', padding: '8px' }}>No industry tags available</div>
                                        )}
                                    </div>
                                </div>

                                {/* Total Recipients Count */}
                                <div style={{ marginBottom: '12px' }}>
                                    {(formData.selectedInterestTagIds?.length || 0) + (formData.selectedIndustryTagIds?.length || 0) > 0 ? (
                                        <>
                                            <div style={{ padding: '12px 14px', background: '#f0fdf4', borderRadius: '6px', border: '1px solid #86efac', fontSize: '13px', fontWeight: '600', color: '#166534' }}>
                                                👥 Total Members: {isLoadingTargetingPreview
                                                    ? 'Loading...'
                                                    : (previewedTargetedMembers?.totalMembersMatched ?? previewedTargetedMembers?.totalCount ?? 0).toLocaleString()}
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ padding: '12px 14px', background: '#f3f4f6', borderRadius: '6px', fontSize: '13px', color: '#666' }}>
                                            Select tags to see member count
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
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

                    {/* Actions */}
                    <div style={{ background: 'white', padding: '20px 24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            {formData.scheduledSendAt && (
                                <div style={{ fontSize: '13px', color: '#666', flex: 1, minWidth: '200px' }}>
                                    📅 Scheduled for: <strong>{formatScheduledTime(formData.scheduledSendAt)}</strong>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isSavingDraft}
                                style={{
                                    padding: '12px 20px',
                                    background: isSavingDraft ? '#d1d5db' : 'white',
                                    color: isSavingDraft ? '#9ca3af' : '#333',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                    cursor: isSavingDraft ? 'not-allowed' : 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    opacity: isSavingDraft ? 0.6 : 1,
                                    minWidth: '140px'
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
                            <button
                                type="button"
                                onClick={() => setShowScheduleModal(true)}
                                style={{
                                    padding: '12px 20px',
                                    background: '#8b5cf6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    minWidth: '140px'
                                }}
                            >
                                <span>⏰</span> Schedule
                            </button>
                            <button
                                type="button"
                                onClick={handleSendBroadcast}
                                disabled={isSending || (!formData.selectedInterestTagIds?.length && !formData.selectedIndustryTagIds?.length)}
                                style={{
                                    padding: '12px 20px',
                                    background: (isSending || (!formData.selectedInterestTagIds?.length && !formData.selectedIndustryTagIds?.length)) ? '#dc262680' : '#dc2626',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: (isSending || (!formData.selectedInterestTagIds?.length && !formData.selectedIndustryTagIds?.length)) ? 'not-allowed' : 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    opacity: (isSending || (!formData.selectedInterestTagIds?.length && !formData.selectedIndustryTagIds?.length)) ? 0.6 : 1,
                                    minWidth: '140px'
                                }}
                            >
                                {isSending ? (
                                    <>
                                        <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <span>📤</span> Send Now
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                {/* Right Sidebar */}
                <div style={{ width: '320px' }}>
                    {/* Member Preview Section */}
                    {previewedTargetedMembers && previewedTargetedMembers.sampleMembers && previewedTargetedMembers.sampleMembers.length > 0 && (
                        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>Sample Recipients</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {previewedTargetedMembers.sampleMembers.slice(0, 5).map((member, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            padding: '12px',
                                            background: '#f9fafb',
                                            borderRadius: '6px',
                                            border: '1px solid #e5e7eb',
                                            fontSize: '12px'
                                        }}
                                    >
                                        <div style={{ fontWeight: '600', color: '#333', marginBottom: '4px' }}>
                                            {member.contactPerson || 'N/A'}
                                        </div>
                                        <div style={{ color: '#666', marginBottom: '4px' }}>
                                            {member.companyName || 'N/A'}
                                        </div>
                                        <div style={{ color: '#999', marginBottom: '4px' }}>
                                            {member.email || 'No email'}
                                        </div>
                                        {(member.interestTagNames?.length > 0 || member.industryTagNames?.length > 0) && (
                                            <div style={{ marginTop: '6px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                {member.interestTagNames?.map((tag, i) => (
                                                    <span
                                                        key={`interest-${i}`}
                                                        style={{
                                                            display: 'inline-block',
                                                            padding: '2px 6px',
                                                            background: '#fef2f2',
                                                            color: '#dc2626',
                                                            borderRadius: '3px',
                                                            fontSize: '11px'
                                                        }}
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                                {member.industryTagNames?.map((tag, i) => (
                                                    <span
                                                        key={`industry-${i}`}
                                                        style={{
                                                            display: 'inline-block',
                                                            padding: '2px 6px',
                                                            background: '#f3e8ff',
                                                            color: '#8b5cf6',
                                                            borderRadius: '3px',
                                                            fontSize: '11px'
                                                        }}
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}



                    {/* AI Insights */}
                    <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                        {/* Header */}
                        <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '17px' }}>✨</span>
                                <h3 style={{ fontSize: '14px', fontWeight: '700', margin: 0, color: 'white' }}>AI Broadcast Insights</h3>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {quickInsightsLoading && <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Updating…</span>}
                                {aiGeneratedAt && !aiLoading && (
                                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
                                        AI: {Math.round((Date.now() - aiGeneratedAt.getTime()) / 60000) < 1 ? 'just now' : `${Math.round((Date.now() - aiGeneratedAt.getTime()) / 60000)}m ago`}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div style={{ padding: '14px 18px' }}>

                            {/* ── LIVE: Quick Insights bar ── */}
                            {quickInsights && (() => {
                                const qi = quickInsights;
                                const pct = qi.readinessScore ?? qi.ReadinessScore ?? null;
                                const recipients = qi.estimatedRecipients ?? qi.EstimatedRecipients ?? qi.recipientCount ?? null;
                                const audienceDesc = qi.audienceDescription ?? qi.AudienceDescription ?? null;
                                const missing = qi.missingItems ?? qi.MissingItems ?? [];
                                const pctColor = pct >= 75 ? '#059669' : pct >= 50 ? '#d97706' : '#dc2626';
                                return (
                                    <div style={{ marginBottom: '14px', background: '#f8faff', border: '1px solid #e0e7ff', borderRadius: '10px', padding: '10px 12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Live Readiness</span>
                                            {pct != null && <span style={{ fontSize: '13px', fontWeight: '700', color: pctColor }}>{pct}%</span>}
                                        </div>
                                        {pct != null && (
                                            <div style={{ height: '5px', borderRadius: '999px', background: '#e0e7ff', overflow: 'hidden', marginBottom: '8px' }}>
                                                <div style={{ height: '100%', width: `${pct}%`, background: pctColor, borderRadius: '999px', transition: 'width 0.4s' }} />
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '12px', color: '#374151' }}>
                                            {recipients != null && (
                                                <span>👥 <strong>{recipients.toLocaleString()}</strong> estimated recipients</span>
                                            )}
                                            {audienceDesc && <span>🎯 {audienceDesc}</span>}
                                        </div>
                                        {Array.isArray(missing) && missing.length > 0 && (
                                            <div style={{ marginTop: '6px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                                {missing.map((m, i) => (
                                                    <span key={i} style={{ fontSize: '11px', background: '#fef3c7', color: '#92400e', padding: '2px 7px', borderRadius: '999px', border: '1px solid #fde68a' }}>⚠ {m}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* ── Readiness checklist (client-side instant) ── */}
                            <div style={{ marginBottom: '12px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                                    {broadcastReadiness.map((item, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: item.done ? '#059669' : '#9ca3af' }}>
                                            <span>{item.done ? '✅' : '⬜'}</span>{item.label}
                                        </div>
                                    ))}
                                </div>
                                <div style={{ marginTop: '6px', height: '3px', borderRadius: '999px', background: '#e5e7eb', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${(readinessCount / broadcastReadiness.length) * 100}%`, background: readinessCount >= 3 ? '#059669' : readinessCount >= 2 ? '#f59e0b' : '#e5e7eb', borderRadius: '999px', transition: 'width 0.3s' }} />
                                </div>
                            </div>

                            {/* ── Generate button ── */}
                            <button
                                type="button"
                                disabled={aiLoading || !canGenerateInsights}
                                title={!canGenerateInsights ? 'Add a subject + body or audience tags first' : 'Run full AI analysis on your broadcast'}
                                onClick={fetchAiInsights}
                                style={{
                                    width: '100%', padding: '10px', borderRadius: '8px', border: 'none',
                                    cursor: (!canGenerateInsights || aiLoading) ? 'not-allowed' : 'pointer',
                                    background: (!canGenerateInsights || aiLoading) ? '#e5e7eb' : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                                    color: (!canGenerateInsights || aiLoading) ? '#9ca3af' : 'white',
                                    fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    marginBottom: '14px', transition: 'all 0.2s'
                                }}
                            >
                                {aiLoading
                                    ? <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span> Analysing broadcast…</>
                                    : <><span>✨</span> Generate Insights</>}
                            </button>

                            {/* Error */}
                            {aiError && !aiLoading && (
                                <div style={{ padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '12px', marginBottom: '12px' }}>
                                    ⚠️ {aiError}
                                    <button type="button" onClick={() => setShowRaw(s => !s)} style={{ marginLeft: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '11px', textDecoration: 'underline' }}>{showRaw ? 'Hide details' : 'Show details'}</button>
                                </div>
                            )}

                            {/* ── AI Result section ── */}
                            {aiResult && !aiLoading && (() => {
                                const ins = aiResult.insights || {};
                                const fmtRate = (v) => v == null ? null : typeof v === 'number' ? (v > 1 ? `${v.toFixed(1)}%` : `${(v * 100).toFixed(1)}%`) : String(v);
                                const scoreColor = { A: '#059669', B: '#16a34a', C: '#d97706', D: '#ea580c', F: '#dc2626' }[aiResult.overallScore] || '#6b7280';
                                const statusStyle = aiResult.readinessStatus === 'Ready'
                                    ? { bg: '#f0fdf4', color: '#059669', border: '#bbf7d0' }
                                    : aiResult.readinessStatus === 'NeedsWork'
                                        ? { bg: '#fffbeb', color: '#d97706', border: '#fde68a' }
                                        : { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
                                return (
                                    <div>
                                        {/* Score + status row */}
                                        {(aiResult.overallScore || aiResult.readinessStatus) && (
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
                                                {aiResult.overallScore && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f9fafb', border: `2px solid ${scoreColor}`, borderRadius: '8px', padding: '6px 12px' }}>
                                                        <span style={{ fontSize: '11px', color: '#6b7280' }}>Score</span>
                                                        <span style={{ fontSize: '22px', fontWeight: '800', color: scoreColor, lineHeight: 1 }}>{aiResult.overallScore}</span>
                                                    </div>
                                                )}
                                                {aiResult.readinessStatus && (
                                                    <span style={{ fontSize: '12px', fontWeight: '600', padding: '4px 10px', borderRadius: '999px', background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}` }}>
                                                        {aiResult.readinessStatus === 'Ready' ? '✅ Ready to send' : aiResult.readinessStatus === 'NeedsWork' ? '⚠ Needs work' : '🚫 Not recommended'}
                                                    </span>
                                                )}
                                                {aiResult.generatedAt && <span style={{ fontSize: '10px', color: '#9ca3af', marginLeft: 'auto' }}>{aiResult.modelVersion || ''}</span>}
                                            </div>
                                        )}

                                        {/* Summary */}
                                        {aiResult.summary && (
                                            <div style={{ fontSize: '12px', color: '#374151', background: '#f9fafb', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', lineHeight: '1.6', borderLeft: '3px solid #6366f1' }}>
                                                {aiResult.summary}
                                            </div>
                                        )}

                                        {/* Metric chips */}
                                        {(() => {
                                            const chips = [
                                                ins.bestSendTimeLocal && { icon: '🕐', label: 'Best send time', value: ins.bestSendTimeLocal, sub: ins.timingRationale, color: '#4f46e5', bg: '#eef2ff' },
                                                !ins.bestSendTimeLocal && ins.bestSendTime && { icon: '🕐', label: 'Best send time', value: ins.bestSendTime, color: '#4f46e5', bg: '#eef2ff' },
                                                ins.predictedOpenRate != null && { icon: '📬', label: 'Open rate', value: fmtRate(ins.predictedOpenRate), color: '#059669', bg: '#f0fdf4' },
                                                ins.predictedClickRate != null && { icon: '🖱️', label: 'Click rate', value: fmtRate(ins.predictedClickRate), color: '#0891b2', bg: '#ecfeff' },
                                                ins.engagementScore && { icon: '⚡', label: 'Engagement', value: ins.engagementScore, sub: ins.engagementRationale, color: ins.engagementScore === 'High' ? '#059669' : ins.engagementScore === 'Medium' ? '#d97706' : '#dc2626', bg: ins.engagementScore === 'High' ? '#f0fdf4' : ins.engagementScore === 'Medium' ? '#fffbeb' : '#fef2f2' },
                                                (ins.audienceMatchQuality) && { icon: '🎯', label: 'Audience match', value: ins.audienceMatchQuality, sub: ins.audienceInsight, color: '#7c3aed', bg: '#faf5ff' },
                                                ins.estimatedRecipientsCount != null && { icon: '👥', label: 'Estimated recipients', value: ins.estimatedRecipientsCount.toLocaleString(), color: '#0369a1', bg: '#f0f9ff' },
                                            ].filter(Boolean);
                                            return chips.length > 0 ? (
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px', marginBottom: '12px' }}>
                                                    {chips.map((chip, i) => (
                                                        <div key={i} style={{ background: chip.bg, border: `1px solid ${chip.color}20`, borderRadius: '8px', padding: '8px 10px' }} title={chip.sub || ''}>
                                                            <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '2px' }}>{chip.icon} {chip.label}</div>
                                                            <div style={{ fontSize: '14px', fontWeight: '700', color: chip.color }}>{chip.value}</div>
                                                            {chip.sub && <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px', lineHeight: '1.3' }}>{chip.sub}</div>}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null;
                                        })()}

                                        {/* Subject feedback + suggestions */}
                                        {(ins.subjectLineFeedback || (Array.isArray(ins.subjectLineSuggestions) && ins.subjectLineSuggestions.length > 0)) && (
                                            <div style={{ marginBottom: '12px', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '8px', padding: '10px 12px' }}>
                                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#7c3aed', marginBottom: '6px', textTransform: 'uppercase' }}>✏️ Subject Line</div>
                                                {ins.subjectLineFeedback && <div style={{ fontSize: '12px', color: '#374151', marginBottom: '6px', lineHeight: '1.5' }}>{ins.subjectLineFeedback}</div>}
                                                {Array.isArray(ins.subjectLineSuggestions) && ins.subjectLineSuggestions.length > 0 && (
                                                    <div>
                                                        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Suggestions — click to use:</div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            {ins.subjectLineSuggestions.map((s, i) => (
                                                                <button
                                                                    key={i}
                                                                    type="button"
                                                                    onClick={() => { setFormData(fd => ({ ...fd, subject: s })); setAiAppliedSubject(s); setTimeout(() => setAiAppliedSubject(null), 3000); }}
                                                                    style={{ textAlign: 'left', fontSize: '12px', padding: '6px 10px', background: 'white', border: '1px solid #d8b4fe', borderRadius: '6px', cursor: 'pointer', color: '#5b21b6', lineHeight: '1.4', transition: 'background 0.15s' }}
                                                                    onMouseEnter={e => e.currentTarget.style.background = '#f3e8ff'}
                                                                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                                                >
                                                                    "{s}"
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Applied subject toast */}
                                        {aiAppliedSubject && (
                                            <div style={{ fontSize: '12px', color: '#059669', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '7px 10px', marginBottom: '10px' }}>
                                                ✓ Subject applied — see subject field above
                                            </div>
                                        )}

                                        {/* Body / content feedback */}
                                        {(ins.bodyLengthFeedback || ins.toneFeedback || (Array.isArray(ins.contentImprovements) && ins.contentImprovements.length > 0)) && (
                                            <div style={{ marginBottom: '12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 12px' }}>
                                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#059669', marginBottom: '6px', textTransform: 'uppercase' }}>📝 Content Quality</div>
                                                {ins.bodyLengthFeedback && <div style={{ fontSize: '12px', color: '#374151', marginBottom: '4px' }}>Length: {ins.bodyLengthFeedback}</div>}
                                                {ins.toneFeedback && <div style={{ fontSize: '12px', color: '#374151', marginBottom: '4px' }}>Tone: {ins.toneFeedback}</div>}
                                                {Array.isArray(ins.contentImprovements) && ins.contentImprovements.length > 0 && (
                                                    <ul style={{ margin: '6px 0 0', paddingLeft: '16px', fontSize: '12px', color: '#374151', lineHeight: '1.7' }}>
                                                        {ins.contentImprovements.map((c, i) => <li key={i}>{c}</li>)}
                                                    </ul>
                                                )}
                                            </div>
                                        )}

                                        {/* Quick wins */}
                                        {Array.isArray(aiResult.quickWins) && aiResult.quickWins.length > 0 && (
                                            <div style={{ marginBottom: '12px' }}>
                                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#059669', textTransform: 'uppercase', marginBottom: '6px' }}>⚡ Quick Wins</div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    {aiResult.quickWins.map((w, i) => (
                                                        <div key={i} style={{ fontSize: '12px', color: '#374151', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                                                            <span style={{ color: '#059669', flexShrink: 0 }}>✓</span>{w}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Warnings */}
                                        {Array.isArray(aiResult.warnings) && aiResult.warnings.length > 0 && (
                                            <div style={{ marginBottom: '12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 12px' }}>
                                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#d97706', textTransform: 'uppercase', marginBottom: '6px' }}>⚠ Warnings</div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    {aiResult.warnings.map((w, i) => (
                                                        <div key={i} style={{ fontSize: '12px', color: '#92400e' }}>• {w}</div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* AI-suggested articles */}
                                        {Array.isArray(aiResult.suggestedArticles) && aiResult.suggestedArticles.length > 0 && (
                                            <div style={{ marginBottom: '12px' }}>
                                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#4338ca', textTransform: 'uppercase', marginBottom: '6px' }}>📎 AI Article Suggestions</div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    {aiResult.suggestedArticles.map((a, i) => {
                                                        const articleId = a?.articleId ?? a?.ArticleId ?? a?.id;
                                                        const title = a?.title ?? a?.Title ?? '(Untitled)';
                                                        const relevance = a?.relevanceScore ?? a?.RelevanceScore;
                                                        const reasoning = a?.reasoning ?? a?.Reasoning;
                                                        const alreadyAttached = (formData.selectedArticleIds || []).includes(articleId);
                                                        return (
                                                            <div key={i} style={{ background: alreadyAttached ? '#f0fdf4' : '#f8faff', border: `1px solid ${alreadyAttached ? '#bbf7d0' : '#c7d2fe'}`, borderRadius: '8px', padding: '8px 10px' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px', marginBottom: '3px' }}>
                                                                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#1e1b4b', flex: 1 }}>{title}</div>
                                                                    {relevance != null && <span style={{ fontSize: '10px', background: '#eef2ff', color: '#4338ca', padding: '1px 6px', borderRadius: '999px', whiteSpace: 'nowrap' }}>{Math.round(relevance * 100)}% match</span>}
                                                                </div>
                                                                {reasoning && <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '5px', lineHeight: '1.4' }}>{reasoning}</div>}
                                                                {!alreadyAttached && articleId && (
                                                                    <button type="button" onClick={() => toggleSelectedArticle(articleId)} style={{ fontSize: '11px', padding: '3px 8px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: '600' }}>+ Attach</button>
                                                                )}
                                                                {alreadyAttached && <span style={{ fontSize: '11px', color: '#059669', fontWeight: '600' }}>✓ Already attached</span>}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Fallback: client-side article recs if AI gave none */}
                                        {(!aiResult.suggestedArticles || aiResult.suggestedArticles.length === 0) && recommendedArticles.length > 0 && (
                                            <div style={{ marginBottom: '12px' }}>
                                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#4338ca', textTransform: 'uppercase', marginBottom: '6px' }}>📎 Suggested Articles (by tag match)</div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                    {recommendedArticles.map((a, i) => {
                                                        const id = a?.publicationDraftId ?? a?.PublicationDraftId;
                                                        const title = a?.title ?? a?.Title ?? '(Untitled)';
                                                        const publishedAt = a?.publishedAt ?? a?.PublishedAt;
                                                        return (
                                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8faff', border: '1px solid #c7d2fe', borderRadius: '8px', padding: '7px 10px' }}>
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <div style={{ fontSize: '11px', fontWeight: '600', color: '#1e1b4b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
                                                                    {publishedAt && <div style={{ fontSize: '10px', color: '#9ca3af' }}>{new Date(publishedAt).toLocaleDateString()}</div>}
                                                                </div>
                                                                <button type="button" onClick={() => toggleSelectedArticle(id)} style={{ fontSize: '11px', padding: '3px 8px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: '600', whiteSpace: 'nowrap' }}>+ Attach</button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Recommendations */}
                                        {Array.isArray(aiResult.recommendations) && aiResult.recommendations.length > 0 && (
                                            <div style={{ marginBottom: '12px' }}>
                                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', marginBottom: '6px' }}>💡 Recommendations</div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                                                    {aiResult.recommendations.map((r, idx) => {
                                                        const p = (r.priority || '').toLowerCase();
                                                        const ps = p === 'high' ? { bg: '#fef2f2', border: '#fecaca', badge: '#dc2626', badgeBg: '#fee2e2' }
                                                            : p === 'low' ? { bg: '#f0fdf4', border: '#bbf7d0', badge: '#059669', badgeBg: '#dcfce7' }
                                                            : { bg: '#fffbeb', border: '#fde68a', badge: '#d97706', badgeBg: '#fef3c7' };
                                                        return (
                                                            <div key={idx} style={{ background: ps.bg, border: `1px solid ${ps.border}`, borderRadius: '8px', padding: '10px' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px', marginBottom: '3px' }}>
                                                                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#111827', flex: 1 }}>{r.title || r.Title || `Recommendation ${idx + 1}`}</div>
                                                                    {r.priority && <span style={{ fontSize: '10px', padding: '2px 7px', background: ps.badgeBg, color: ps.badge, borderRadius: '999px', fontWeight: '700', whiteSpace: 'nowrap' }}>{r.priority}</span>}
                                                                </div>
                                                                {r.why && <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '5px', lineHeight: '1.5' }}>{r.why}</div>}
                                                                {Array.isArray(r.actions) && r.actions.length > 0 && (
                                                                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                                                        {r.actions.map((a, i) => (
                                                                            <span key={i} style={{ fontSize: '10px', background: 'white', color: '#4338ca', padding: '2px 7px', borderRadius: '5px', border: '1px solid #c7d2fe' }}>{a}</span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Idle state */}
                            {!aiLoading && !aiResult && !aiError && (
                                <div style={{ textAlign: 'center', padding: '10px 0', color: '#9ca3af', fontSize: '12px' }}>
                                    {canGenerateInsights ? 'Click Generate Insights for a full AI analysis of your broadcast.' : 'Fill in subject + body or choose audience tags to unlock AI insights.'}
                                </div>
                            )}

                            {/* Debug (collapsed) */}
                            <div style={{ marginTop: '8px', borderTop: '1px dashed #f3f4f6', paddingTop: '6px' }}>
                                <button type="button" onClick={() => setShowRaw(s => !s)} style={{ fontSize: '10px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                    {showRaw ? '▲ Hide debug' : '▼ Show debug'}
                                </button>
                                {showRaw && (
                                    <div style={{ marginTop: '6px', fontSize: '10px', color: '#374151', whiteSpace: 'pre-wrap', maxHeight: '200px', overflow: 'auto', background: '#f9fafb', borderRadius: '6px', padding: '8px' }}>
                                        {aiDebug?.error ? aiDebug.error : aiDebug?.raw || (aiResult ? JSON.stringify(aiResult, null, 2) : 'No data.')}
                                    </div>
                                )}
                            </div>
                        </div>
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