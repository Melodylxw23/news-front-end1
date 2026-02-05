import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || '';

function apiUrl(path) {
    if (!path) return API_BASE;
    if (!API_BASE) return path;
    // ensure no double slashes
    if (API_BASE.endsWith('/') && path.startsWith('/')) return API_BASE.slice(0, -1) + path;
    if (!API_BASE.endsWith('/') && !path.startsWith('/')) return API_BASE + '/' + path;
    return API_BASE + path;
}

const ConsultantAdvice = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState('');
    const [preview, setPreview] = useState(null);

    const [sendNowLoading, setSendNowLoading] = useState(false);
    const [sendNowError, setSendNowError] = useState('');
    const [sendNowOk, setSendNowOk] = useState('');
    const [previewGenerated, setPreviewGenerated] = useState(false);
    
    // Form state
    const [formData, setFormData] = useState({
        territories: [],
        industries: [],
        frequency: 'daily', // daily, weekly
        email: '',
        preferredTime: '09:00' // Time of day to receive insights
    });

    const hasSelectedPreferences = formData.territories.length > 0 && formData.industries.length > 0;

    // Available options
    const territoryOptions = [
        { id: 'shanghai', label: '🏙️ Shanghai', value: 'Shanghai' },
        { id: 'beijing', label: '🏛️ Beijing', value: 'Beijing' },
        { id: 'guangdong', label: '🌴 Guangdong (Shenzhen/Guangzhou)', value: 'Guangdong' },
        { id: 'zhejiang', label: '🌊 Zhejiang (Hangzhou)', value: 'Zhejiang' },
        { id: 'jiangsu', label: '🏭 Jiangsu (Nanjing/Suzhou)', value: 'Jiangsu' },
        { id: 'sichuan', label: '🌶️ Sichuan (Chengdu)', value: 'Sichuan' },
        { id: 'hubei', label: '🏞️ Hubei (Wuhan)', value: 'Hubei' },
        { id: 'tianjin', label: '⚓ Tianjin', value: 'Tianjin' }
    ];

    const industryOptions = [
        { id: 'technology', label: '💻 Technology & IT', value: 'Technology' },
        { id: 'manufacturing', label: '🏭 Manufacturing', value: 'Manufacturing' },
        { id: 'retail', label: '🛍️ Retail & E-commerce', value: 'Retail' },
        { id: 'finance', label: '💰 Finance & Banking', value: 'Finance' },
        { id: 'healthcare', label: '🏥 Healthcare & Pharma', value: 'Healthcare' },
        { id: 'realestate', label: '🏢 Real Estate', value: 'RealEstate' },
        { id: 'automotive', label: '🚗 Automotive', value: 'Automotive' },
        { id: 'energy', label: '⚡ Energy & Utilities', value: 'Energy' },
        { id: 'logistics', label: '📦 Logistics & Supply Chain', value: 'Logistics' },
        { id: 'agriculture', label: '🌾 Agriculture & Food', value: 'Agriculture' }
    ];

    useEffect(() => {
        // Load user's email from localStorage or profile
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.email) {
            setFormData(prev => ({ ...prev, email: user.email }));
        }
        
        // Load existing preferences if available
        loadPreferences();
    }, []);

    const loadPreview = async () => {
        try {
            setPreviewLoading(true);
            setPreviewError('');
            const token = localStorage.getItem('token');
            const response = await fetch(apiUrl('/api/consultant/insights/preview'), {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const text = await response.text().catch(() => '');
                throw new Error(text || `Failed to load preview (${response.status})`);
            }

            const data = await response.json();
            setPreview(data);
            setPreviewGenerated(true);
        } catch (error) {
            console.error('[loadPreview] Error:', error);
            setPreviewError(error.message || 'Failed to load preview');
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleSendNow = async () => {
        try {
            setSendNowLoading(true);
            setSendNowError('');
            setSendNowOk('');

            const token = localStorage.getItem('token');
            const body = {
                force: false
            };

            const response = await fetch(apiUrl('/api/consultant/insights/send-now'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const text = await response.text().catch(() => '');
                throw new Error(text || `Send failed (${response.status})`);
            }

            // backend may return JSON or empty
            const result = await response.json().catch(() => null);
            setSendNowOk(result?.message || '✓ Sent! Check your inbox.');
        } catch (error) {
            console.error('[handleSendNow] Error:', error);
            setSendNowError(error.message || 'Failed to send');
        } finally {
            setSendNowLoading(false);
        }
    };

    const loadPreferences = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch(apiUrl('/api/consultant/preferences'), {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data) {
                    setFormData({
                        territories: data.territories || data.Territories || [],
                        industries: data.industries || data.Industries || [],
                        frequency: data.frequency || data.Frequency || 'daily',
                        email: data.email || data.Email || formData.email,
                        preferredTime: data.preferredTime || data.PreferredTime || '09:00'
                    });
                }
            }
        } catch (error) {
            console.log('[loadPreferences] Note: Could not load existing preferences:', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleTerritoryToggle = (value) => {
        setFormData(prev => {
            const territories = prev.territories.includes(value)
                ? prev.territories.filter(t => t !== value)
                : [...prev.territories, value];
            return { ...prev, territories };
        });
    };

    const handleIndustryToggle = (value) => {
        setFormData(prev => {
            const industries = prev.industries.includes(value)
                ? prev.industries.filter(i => i !== value)
                : [...prev.industries, value];
            return { ...prev, industries };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validation
        if (formData.territories.length === 0) {
            alert('Please select at least one territory');
            return;
        }
        
        if (formData.industries.length === 0) {
            alert('Please select at least one industry');
            return;
        }

        try {
            setSaving(true);
            const token = localStorage.getItem('token');
            
            const payload = {
                Territories: formData.territories,
                Industries: formData.industries,
                Frequency: formData.frequency,
                Email: formData.email,
                PreferredTime: formData.preferredTime
            };

            console.log('[handleSubmit] Saving preferences:', payload);

            const response = await fetch(apiUrl('/api/consultant/preferences'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to save preferences');
            }

            const result = await response.json();
            console.log('[handleSubmit] Preferences saved:', result);

            alert(`✓ Preferences saved successfully!\n\nYou will receive ${formData.frequency} insights about:\n\nTerritories: ${formData.territories.join(', ')}\nIndustries: ${formData.industries.join(', ')}\n\nDelivered to: ${formData.email} at ${formData.preferredTime}`);
            
        } catch (error) {
            console.error('[handleSubmit] Error:', error);
            alert('Failed to save preferences: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSelectAllTerritories = () => {
        if (formData.territories.length === territoryOptions.length) {
            setFormData(prev => ({ ...prev, territories: [] }));
        } else {
            setFormData(prev => ({ ...prev, territories: territoryOptions.map(t => t.value) }));
        }
    };

    const handleSelectAllIndustries = () => {
        if (formData.industries.length === industryOptions.length) {
            setFormData(prev => ({ ...prev, industries: [] }));
        } else {
            setFormData(prev => ({ ...prev, industries: industryOptions.map(i => i.value) }));
        }
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
                    <div style={{ fontSize: '16px', color: '#666' }}>Loading preferences...</div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '24px' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ marginBottom: '32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#333', margin: 0 }}>
                            🎯 Consultant Insights Preferences
                        </h1>
                        <button
                            onClick={() => navigate(-1)}
                            style={{
                                padding: '10px 20px',
                                background: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '500'
                            }}
                        >
                            ← Back
                        </button>
                    </div>
                    <p style={{ color: '#666', fontSize: '16px', margin: 0, lineHeight: '1.6' }}>
                        Select the territories and industries you want to track. We'll send you curated insights and news summaries directly to your inbox.
                    </p>
                </div>

                {/* Info Banner */}
                <div style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    padding: '24px',
                    borderRadius: '12px',
                    marginBottom: '32px',
                    color: 'white'
                }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                        <div style={{ fontSize: '32px' }}>💡</div>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>
                                Stay Informed About China Business Landscape
                            </h3>
                            <p style={{ margin: 0, fontSize: '14px', opacity: 0.95, lineHeight: '1.6' }}>
                                Get daily or weekly summaries covering policies, market developments, and industry insights for your selected territories and industries. Help your SCCCI member companies make informed decisions about their China expansion.
                            </p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Territories Section */}
                    <div style={{ background: 'white', padding: '28px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                                <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#333', margin: '0 0 8px 0' }}>
                                    📍 Select Territories
                                </h2>
                                <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
                                    Choose regions in China you want to track ({formData.territories.length} selected)
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleSelectAllTerritories}
                                style={{
                                    padding: '8px 16px',
                                    background: formData.territories.length === territoryOptions.length ? '#dc2626' : '#f3f4f6',
                                    color: formData.territories.length === territoryOptions.length ? 'white' : '#374151',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: '500'
                                }}
                            >
                                {formData.territories.length === territoryOptions.length ? '✓ All Selected' : 'Select All'}
                            </button>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
                            {territoryOptions.map(territory => (
                                <button
                                    key={territory.id}
                                    type="button"
                                    onClick={() => handleTerritoryToggle(territory.value)}
                                    style={{
                                        padding: '16px',
                                        background: formData.territories.includes(territory.value) ? '#fef2f2' : '#f9fafb',
                                        border: formData.territories.includes(territory.value) ? '2px solid #dc2626' : '2px solid #e5e7eb',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        transition: 'all 0.2s',
                                        position: 'relative'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '15px', fontWeight: '500', color: '#374151' }}>
                                            {territory.label}
                                        </span>
                                        {formData.territories.includes(territory.value) && (
                                            <span style={{ fontSize: '18px', color: '#dc2626' }}>✓</span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Industries Section */}
                    <div style={{ background: 'white', padding: '28px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                                <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#333', margin: '0 0 8px 0' }}>
                                    🏭 Select Industries
                                </h2>
                                <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
                                    Choose industries you want to monitor ({formData.industries.length} selected)
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleSelectAllIndustries}
                                style={{
                                    padding: '8px 16px',
                                    background: formData.industries.length === industryOptions.length ? '#dc2626' : '#f3f4f6',
                                    color: formData.industries.length === industryOptions.length ? 'white' : '#374151',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: '500'
                                }}
                            >
                                {formData.industries.length === industryOptions.length ? '✓ All Selected' : 'Select All'}
                            </button>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
                            {industryOptions.map(industry => (
                                <button
                                    key={industry.id}
                                    type="button"
                                    onClick={() => handleIndustryToggle(industry.value)}
                                    style={{
                                        padding: '16px',
                                        background: formData.industries.includes(industry.value) ? '#fef2f2' : '#f9fafb',
                                        border: formData.industries.includes(industry.value) ? '2px solid #dc2626' : '2px solid #e5e7eb',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '15px', fontWeight: '500', color: '#374151' }}>
                                            {industry.label}
                                        </span>
                                        {formData.industries.includes(industry.value) && (
                                            <span style={{ fontSize: '18px', color: '#dc2626' }}>✓</span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Delivery Settings */}
                    <div style={{ background: 'white', padding: '28px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#333', margin: '0 0 20px 0' }}>
                            📧 Delivery Settings
                        </h2>
                        
                        <div style={{ display: 'grid', gap: '20px' }}>
                            {/* Email */}
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    readOnly
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '6px',
                                        fontSize: '14px',
                                        boxSizing: 'border-box',
                                        background: '#f9fafb',
                                        color: '#6b7280',
                                        cursor: 'not-allowed'
                                    }}
                                />
                                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                                    📧 Insights will be sent to your registered email address
                                </div>
                            </div>

                            {/* Frequency */}
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                                    Delivery Frequency
                                </label>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, frequency: 'daily' }))}
                                        style={{
                                            flex: 1,
                                            padding: '16px',
                                            background: formData.frequency === 'daily' ? '#dc2626' : 'white',
                                            color: formData.frequency === 'daily' ? 'white' : '#374151',
                                            border: formData.frequency === 'daily' ? '2px solid #dc2626' : '2px solid #e5e7eb',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            fontSize: '15px',
                                            fontWeight: '500',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <div style={{ fontSize: '24px', marginBottom: '8px' }}>📅</div>
                                        <div>Daily</div>
                                        <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.8 }}>
                                            Every business day
                                        </div>
                                    </button>
                                    
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, frequency: 'weekly' }))}
                                        style={{
                                            flex: 1,
                                            padding: '16px',
                                            background: formData.frequency === 'weekly' ? '#dc2626' : 'white',
                                            color: formData.frequency === 'weekly' ? 'white' : '#374151',
                                            border: formData.frequency === 'weekly' ? '2px solid #dc2626' : '2px solid #e5e7eb',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            fontSize: '15px',
                                            fontWeight: '500',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <div style={{ fontSize: '24px', marginBottom: '8px' }}>📆</div>
                                        <div>Weekly</div>
                                        <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.8 }}>
                                            Every Monday
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Preferred Time */}
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                                    Preferred Delivery Time
                                </label>
                                <select
                                    value={formData.preferredTime}
                                    onChange={(e) => setFormData(prev => ({ ...prev, preferredTime: e.target.value }))}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '6px',
                                        fontSize: '14px',
                                        background: 'white',
                                        cursor: 'pointer',
                                        boxSizing: 'border-box'
                                    }}
                                >
                                    <option value="06:00">6:00 AM - Early Morning</option>
                                    <option value="07:00">7:00 AM - Morning</option>
                                    <option value="08:00">8:00 AM - Morning</option>
                                    <option value="09:00">9:00 AM - Work Starts</option>
                                    <option value="10:00">10:00 AM - Mid-Morning</option>
                                    <option value="12:00">12:00 PM - Lunch Time</option>
                                    <option value="14:00">2:00 PM - Afternoon</option>
                                    <option value="17:00">5:00 PM - End of Day</option>
                                    <option value="18:00">6:00 PM - Evening</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Summary Preview */}
                    {(formData.territories.length > 0 || formData.industries.length > 0) && (
                        <div style={{
                            background: '#f0fdf4',
                            border: '1px solid #86efac',
                            padding: '20px',
                            borderRadius: '12px',
                            marginBottom: '24px'
                        }}>
                            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#166534', margin: '0 0 12px 0' }}>
                                📋 Your Subscription Summary
                            </h3>
                            <div style={{ fontSize: '14px', color: '#166534', lineHeight: '1.8' }}>
                                {formData.territories.length > 0 && (
                                    <div style={{ marginBottom: '8px' }}>
                                        <strong>Territories:</strong> {formData.territories.join(', ')}
                                    </div>
                                )}
                                {formData.industries.length > 0 && (
                                    <div style={{ marginBottom: '8px' }}>
                                        <strong>Industries:</strong> {formData.industries.join(', ')}
                                    </div>
                                )}
                                <div style={{ marginBottom: '8px' }}>
                                    <strong>Frequency:</strong> {formData.frequency === 'daily' ? 'Daily (Monday-Friday)' : 'Weekly (Every Monday)'}
                                </div>
                                <div>
                                    <strong>Delivery Time:</strong> {formData.preferredTime} (SGT)
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Submit Button */}
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            style={{
                                padding: '14px 28px',
                                background: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '15px',
                                fontWeight: '500',
                                color: '#374151'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving || formData.territories.length === 0 || formData.industries.length === 0}
                            style={{
                                padding: '14px 32px',
                                background: (saving || formData.territories.length === 0 || formData.industries.length === 0) ? '#9ca3af' : '#dc2626',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: (saving || formData.territories.length === 0 || formData.industries.length === 0) ? 'not-allowed' : 'pointer',
                                fontSize: '15px',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            {saving ? (
                                <>⏳ Saving...</>
                            ) : (
                                <>💾 Save Preferences</>
                            )}
                        </button>
                    </div>
                </form>

                {/* Help Section */}
                <div style={{
                    background: '#fffbeb',
                    border: '1px solid #fef3c7',
                    padding: '20px',
                    borderRadius: '12px',
                    marginTop: '24px'
                }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#92400e', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>💡</span> What to Expect
                    </h3>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#92400e', fontSize: '14px', lineHeight: '1.8' }}>
                        <li>Curated news summaries in 3-5 bullet points per insight</li>
                        <li>Policy updates and regulatory changes for selected territories</li>
                        <li>Industry trends and market developments</li>
                        <li>Business opportunities and success stories</li>
                        <li>Key statistics and economic indicators</li>
                    </ul>
                </div>

                {/* Insights Preview (shown after preferences are selected) */}
                {hasSelectedPreferences && (
                    <div style={{ background: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginTop: '32px', border: '1px solid #f3f4f6' }}>
                        <div style={{ textAlign: 'center', marginBottom: previewGenerated ? '24px' : '0' }}>
                            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#333', margin: '0 0 12px 0' }}>
                                ✉️ Insights Email Preview
                            </h2>
                            <p style={{ fontSize: '15px', color: '#6b7280', margin: '0 0 24px 0', lineHeight: '1.6' }}>
                                Generate a preview of your next insights digest based on your selected territories and industries.
                            </p>
                            
                            {!previewGenerated && (
                                <button
                                    type="button"
                                    onClick={loadPreview}
                                    disabled={previewLoading}
                                    style={{
                                        padding: '16px 32px',
                                        background: previewLoading ? '#9ca3af' : '#dc2626',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: previewLoading ? 'not-allowed' : 'pointer',
                                        fontSize: '16px',
                                        fontWeight: '700',
                                        transition: 'all 0.2s',
                                        boxShadow: '0 4px 8px rgba(220, 38, 38, 0.3)'
                                    }}
                                >
                                    {previewLoading ? '⏳ Generating...' : '🎯 Generate Preview'}
                                </button>
                            )}
                        </div>

                        {previewError && (
                            <div style={{ 
                                background: '#fef2f2', 
                                border: '1px solid #fecaca', 
                                padding: '16px 20px', 
                                borderRadius: '8px', 
                                color: '#991b1b', 
                                fontSize: '14px',
                                marginBottom: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <span style={{ fontSize: '16px' }}>⚠️</span>
                                <span><strong>Error:</strong> {previewError}</span>
                            </div>
                        )}
                        {sendNowError && (
                            <div style={{ 
                                background: '#fef2f2', 
                                border: '1px solid #fecaca', 
                                padding: '16px 20px', 
                                borderRadius: '8px', 
                                color: '#991b1b', 
                                fontSize: '14px',
                                marginBottom: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <span style={{ fontSize: '16px' }}>❌</span>
                                <span><strong>Send error:</strong> {sendNowError}</span>
                            </div>
                        )}
                        {sendNowOk && (
                            <div style={{ 
                                background: '#ecfdf5', 
                                border: '1px solid #a7f3d0', 
                                padding: '16px 20px', 
                                borderRadius: '8px', 
                                color: '#065f46', 
                                fontSize: '14px',
                                marginBottom: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <span style={{ fontSize: '16px' }}>✅</span>
                                <span>{sendNowOk}</span>
                            </div>
                        )}

                        {previewGenerated && (
                            <div>
                                <div style={{ 
                                    background: '#f1f5f9', 
                                    padding: '16px 20px', 
                                    borderRadius: '8px 8px 0 0',
                                    border: '1px solid #e2e8f0',
                                    borderBottom: 'none'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        <div style={{ fontSize: '14px', color: '#334155', fontWeight: '600' }}>
                                            <span style={{ color: '#64748b', fontWeight: 'normal' }}>Subject:</span> {preview?.subject || preview?.Subject || 'Loading subject...'}
                                        </div>
                                        <div style={{ fontSize: '13px', color: '#64748b', fontStyle: 'italic' }}>
                                            Generated: {preview?.generatedAtUtc || preview?.GeneratedAtUtc || '—'}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ 
                                    border: '1px solid #e2e8f0', 
                                    borderRadius: '0 0 8px 8px', 
                                    overflow: 'hidden', 
                                    background: '#fff',
                                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                                    marginBottom: '20px'
                                }}>
                                    <iframe
                                        title="Consultant insights preview"
                                        sandbox="allow-same-origin"
                                        srcDoc={preview?.htmlBody || preview?.HtmlBody || '<div style="padding:24px;font-family:system-ui;color:#6b7280;text-align:center;"><div style="font-size:48px;margin-bottom:16px;">📧</div><div>Loading preview…</div></div>'}
                                        style={{ width: '100%', height: '480px', border: 'none', background: 'white', display: 'block' }}
                                    />
                                </div>

                                <div style={{ textAlign: 'center' }}>
                                    <button
                                        type="button"
                                        onClick={handleSendNow}
                                        disabled={sendNowLoading}
                                        style={{
                                            padding: '14px 28px',
                                            background: sendNowLoading ? '#9ca3af' : '#059669',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px',
                                            cursor: sendNowLoading ? 'not-allowed' : 'pointer',
                                            fontSize: '16px',
                                            fontWeight: '700',
                                            transition: 'all 0.2s',
                                            boxShadow: '0 4px 8px rgba(5, 150, 105, 0.3)',
                                            marginRight: '12px'
                                        }}
                                    >
                                        {sendNowLoading ? '⏳ Sending...' : '📨 Send Now'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {setPreviewGenerated(false); setPreview(null); setPreviewError(''); setSendNowError(''); setSendNowOk('');}}
                                        style={{
                                            padding: '14px 28px',
                                            background: 'white',
                                            color: '#374151',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            fontSize: '16px',
                                            fontWeight: '600',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        ↻ Generate New
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConsultantAdvice;
