import React, { useState, useEffect } from 'react';
import { getRoleFromToken } from '../../utils/auth';

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
    const [formData, setFormData] = useState({
        title: '',
        subject: '',
        body: '',
        channel: 'Email',
    });
    const [drafts, setDrafts] = useState([]);
    const [aiPrompt, setAiPrompt] = useState('');
    const [showAiAssistant, setShowAiAssistant] = useState(false);
    const [generatedContent, setGeneratedContent] = useState(null);
    const [showDraftsModal, setShowDraftsModal] = useState(false);

    useEffect(() => {
        fetchDrafts();
    }, []);

    const fetchDrafts = async () => {
        try {
            const response = await apiFetch('/api/Broadcast/drafts');
            console.log('[fetchDrafts] response:', response);
            // Handle both response formats: { data: [...] } or direct array
            const draftsData = response?.data || response || [];
            setDrafts(Array.isArray(draftsData) ? draftsData : []);
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
        try {
            console.log('[handleSubmit] sending:', formData);
            
            const response = await apiFetch('/api/Broadcast/drafts', {
                method: 'POST',
                body: JSON.stringify({
                    Title: formData.title,
                    Subject: formData.subject,
                    Body: formData.body,
                    Channel: formData.channel
                })
            });
            
            console.log('[handleSubmit] response:', response);
            alert('Draft saved successfully!');
            fetchDrafts();
            setFormData({ title: '', subject: '', body: '', channel: 'Email' });
        } catch (error) {
            console.error('[handleSubmit] error:', error);
            alert('Failed to save draft: ' + error.message + '\n\nPlease check the browser console and verify your backend endpoint.');
        }
    };

    const handleDelete = async (id) => {
        try {
            console.log('[handleDelete] deleting:', id);
            await apiFetch(`/api/Broadcast/drafts/${id}`, { method: 'DELETE' });
            alert('Draft deleted successfully!');
            fetchDrafts();
        } catch (error) {
            console.error('[handleDelete] error:', error);
            alert('Failed to delete draft: ' + error.message);
        }
    };

    const handleAiPromptSubmit = async (e) => {
        e.preventDefault();
        try {
            console.log('[handleAiPromptSubmit] sending prompt:', aiPrompt);

            const response = await apiFetch('/api/Broadcast/generate', {
                method: 'POST',
                body: JSON.stringify({ Prompt: aiPrompt })
            });

            console.log('[handleAiPromptSubmit] response:', response);

            if (response) {
                setGeneratedContent({
                    title: response.title || response.Title || '',
                    subject: response.subject || response.Subject || '',
                    body: response.body || response.Body || response.message || response.Message || response.content || '',
                    channel: response.channel || response.Channel || formData.channel
                });
            }

            setAiPrompt('');
        } catch (error) {
            console.error('[handleAiPromptSubmit] error:', error);
            alert('Failed to generate message: ' + error.message);
        }
    };

    const applyGeneratedContent = () => {
        if (generatedContent) {
            setFormData({
                ...formData,
                ...generatedContent
            });
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
                                onClick={() => setShowDraftsModal(true)}
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
                            <div
                                onClick={() => setFormData({ ...formData, channel: 'Email' })}
                                style={{
                                    flex: '1',
                                    minWidth: '200px',
                                    padding: '16px',
                                    border: formData.channel === 'Email' ? '2px solid #dc2626' : '2px solid #e5e7eb',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    background: formData.channel === 'Email' ? '#fef2f2' : 'white'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '20px' }}>📧</span>
                                    <span style={{ fontWeight: '600', fontSize: '15px' }}>Email</span>
                                </div>
                                <div style={{ fontSize: '13px', color: '#666' }}>6,449 subscribers</div>
                            </div>
                            <div
                                onClick={() => setFormData({ ...formData, channel: 'SMS' })}
                                style={{
                                    flex: '1',
                                    minWidth: '200px',
                                    padding: '16px',
                                    border: formData.channel === 'SMS' ? '2px solid #dc2626' : '2px solid #e5e7eb',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    background: formData.channel === 'SMS' ? '#fef2f2' : 'white'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '20px' }}>💬</span>
                                    <span style={{ fontWeight: '600', fontSize: '15px' }}>WeChat</span>
                                </div>
                                <div style={{ fontSize: '13px', color: '#666' }}>16,189 subscribers</div>
                            </div>
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
                                        Generate Content
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                                <span>All Members</span>
                                <span style={{ fontWeight: '600', color: '#333' }}>24,589</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                                <span>Technology Interested</span>
                                <span style={{ fontWeight: '600', color: '#333' }}>8,920</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                                <span>Business Interested</span>
                                <span style={{ fontWeight: '600', color: '#333' }}>6,890</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                                <span>Sports Interested</span>
                                <span style={{ fontWeight: '600', color: '#333' }}>4,430</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                                <span>Entertainment Interested</span>
                                <span style={{ fontWeight: '600', color: '#333' }}>2,950</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                                <span>Politics Interested</span>
                                <span style={{ fontWeight: '600', color: '#333' }}>1,720</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0 0', marginTop: '8px' }}>
                                <span style={{ fontWeight: '600', color: '#333' }}>Total Recipients</span>
                                <span style={{ fontWeight: '700', color: '#dc2626' }}>24,589</span>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>Actions</h3>
                        <button
                            onClick={(e) => { e.preventDefault(); alert('Send Broadcast functionality coming soon!'); }}
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
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                            }}
                        >
                            <span>💾</span> Save Draft
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

            {/* Drafts Modal */}
            {showDraftsModal && (
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
                            <h2 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Saved Drafts</h2>
                            <button
                                onClick={() => setShowDraftsModal(false)}
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
                        {drafts.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                                No drafts saved yet
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {drafts.map(draft => (
                                    <div
                                        key={draft.id}
                                        style={{
                                            padding: '16px',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '8px',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                                            <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: '#333' }}>{draft.title || draft.subject}</h3>
                                            <button
                                                onClick={() => handleDelete(draft.id)}
                                                style={{
                                                    padding: '4px 12px',
                                                    background: '#fee',
                                                    color: '#dc2626',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px',
                                                    fontWeight: '500'
                                                }}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                        <p style={{ fontSize: '14px', color: '#666', margin: '8px 0', lineHeight: '1.5' }}>
                                            {draft.body?.substring(0, 100)}{draft.body?.length > 100 ? '...' : ''}
                                        </p>
                                        <div style={{ fontSize: '12px', color: '#999' }}>
                                            Channel: {draft.channel || 'Email'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default BroadcastManagement;