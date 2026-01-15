import React, { useState, useEffect } from 'react';
import { getRoleFromToken } from '../../utils/auth';
import { useNavigate } from 'react-router-dom';

// Add CSS for loading animation
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || '';

const apiFetch = async (path, opts = {}) => {
  const token = localStorage.getItem('token');
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const fullPath = path.startsWith('http') ? path : `${API_BASE.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;

  console.log('[BroadcastManagement apiFetch] request', opts.method || 'GET', fullPath, opts.body ? JSON.parse(opts.body) : undefined);

  const res = await fetch(fullPath, Object.assign({ headers }, opts));
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    const errorMsg = `HTTP ${res.status} ${res.statusText}${text ? ': ' + text : ''}`;
    console.error('[BroadcastManagement apiFetch] response error', res.status, fullPath, text);
    throw new Error(errorMsg);
  }
  console.log('[BroadcastManagement apiFetch] response success', res.status, fullPath, text ? JSON.parse(text) : null);
  try { return text ? JSON.parse(text) : null; } catch (e) { return text; }
};

const BroadcastManagement = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        title: '',
        subject: '',
        body: '',
        channel: ['Email'],
        targetAudience: [],
        id: null
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

    // Audience data with counts
    const audienceData = [
        { value: 0, label: 'All Members', count: 24589 },
        { value: 1, label: 'Technology Interested', count: 8920 },
        { value: 2, label: 'Business Interested', count: 6890 },
        { value: 3, label: 'Sports Interested', count: 4430 },
        { value: 4, label: 'Entertainment Interested', count: 2950 },
        { value: 5, label: 'Politics Interested', count: 1720 }
    ];

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
        targetAudience: normalizeAudience(draft?.targetAudience ?? draft?.TargetAudience)
    });

    // Calculate total recipients based on selected audiences
    const calculateTotalRecipients = (selected) => {
        if (selected.length === 0) return 0;
        // If All Members (0) is selected, return total
        if (selected.includes(0)) {
            return 24589;
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
    }, []);

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
                ScheduledSendAt: formData.scheduledSendAt || null
            };
            console.log('[handleSubmit] selectedChannels array:', selectedChannels);
            console.log('[handleSubmit] channelEnumValue:', channelEnumValue, '(should be 1 for Email, 2 for WeChat, 3 for both)');
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
                setFormData({ title: '', subject: '', body: '', channel: ['Email'], targetAudience: [], id: null, scheduledSendAt: '' });
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
                setFormData({ title: '', subject: '', body: '', channel: ['Email'], targetAudience: [], id: draftId, scheduledSendAt: '' });
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

    const handleSendBroadcast = async () => {
        if (!formData.title?.trim() || !formData.subject?.trim() || !formData.body?.trim()) {
            alert('Cannot send: Title, Subject, and Message Body are all required.');
            return;
        }

        // Build audience description
        const audiences = normalizeAudience(formData.targetAudience);
        let audienceDesc = 'All Members';
        if (audiences.includes(0)) {
            audienceDesc = 'All Members';
        } else if (audiences.length > 0) {
            audienceDesc = audiences.map(getAudienceLabel).join(', ');
        }

        // Build channel description
        const channels = normalizeChannels(formData.channel);
        const channelDesc = channels.length === 1 ? channels[0] : channels.join(', ');

        if (!window.confirm(`Send "${formData.subject}" to ${audienceDesc} via ${channelDesc} now?`)) return;
        
        // Simply navigate to the dummy success page
        navigate('/message-sent', { state: { broadcastSubject: formData.subject } });
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

    const handleScheduleSubmit = () => {
        if (!scheduledTime) {
            alert('Please select a date and time');
            return;
        }
        setFormData({ ...formData, scheduledSendAt: scheduledTime });
        setShowScheduleModal(false);
        alert('Message scheduled for: ' + new Date(scheduledTime).toLocaleString());
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

            const response = await apiFetch('/api/broadcast/generate', {
                method: 'POST',
                body: JSON.stringify({ Prompt: aiPrompt })
            });

            console.log('[handleAiPromptSubmit] response:', response);

            if (response) {
                // Store the auto-generated ID so we can update it instead of creating a new one
                setGeneratedContentId(response.id || response.Id);
                setGeneratedContent({
                    title: response.title || response.Title || '',
                    subject: response.subject || response.Subject || '',
                    body: response.body || response.Body || response.message || response.Message || response.content || '',
                    channel: normalizeChannels(response.channel || response.Channel || formData.channel)
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
                            {['Email', 'WeChat'].map((ch) => {
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
                                            console.log('[Channel Toggle] channel:', ch, 'exists:', exists, 'current:', current, 'next:', next);
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
                                                <span style={{ fontSize: '20px' }}>{ch === 'Email' ? '📧' : '💬'}</span>
                                                <span style={{ fontWeight: '600', fontSize: '15px' }}>{ch === 'Email' ? 'Email' : 'WeChat'}</span>
                                            </div>
                                            <div style={{ fontSize: '13px', color: '#666' }}>{ch === 'Email' ? '6,449 subscribers' : '16,189 subscribers'}</div>
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
                                <span style={{ fontWeight: '700', color: '#dc2626' }}>{totalRecipients.toLocaleString()}</span>
                            </div>
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
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: '#dc2626',
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
                            <span>📤</span> Send Broadcast
                        </button>
                        <button
                            onClick={(e) => { e.preventDefault(); alert('Preview functionality coming soon!'); }}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: 'white',
                                color: '#333',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '500',
                                marginBottom: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                            }}
                        >
                            <span>👁</span> Preview
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
        </div>
    );
};

// Normalize channels to an array (supports single string, comma-separated string, or array)
const normalizeChannels = (raw) => {
    const normalizeVal = (v) => {
        if (!v) return null;
        const val = v.trim();
        if (val.toLowerCase() === 'sms') return 'WeChat';
        return val;
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

export default BroadcastManagement;