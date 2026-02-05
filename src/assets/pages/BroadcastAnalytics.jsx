import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getPracticalDashboard,
    getDeliveryHealth,
    getDeliveryTrends,
    getAudienceReach,
    getContentDistribution,
    getMemberPreferences,
    getEngagementSignals,
    getPracticalRecommendations,
    getAIRecommendations
} from '../../api/analytics';

const BroadcastAnalytics = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview'); // overview, delivery, content, audience, recommendations
    
    // Data states - Practical Analytics
    const [dashboard, setDashboard] = useState(null);
    const [deliveryHealth, setDeliveryHealth] = useState(null);
    const [deliveryTrends, setDeliveryTrends] = useState(null);
    const [audienceReach, setAudienceReach] = useState(null);
    const [contentDistribution, setContentDistribution] = useState(null);
    const [memberPreferences, setMemberPreferences] = useState(null);
    const [engagementSignals, setEngagementSignals] = useState(null);
    const [recommendations, setRecommendations] = useState(null);
    const [aiRecommendations, setAiRecommendations] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState(null);
    
    // Date range filter
    const [dateRange, setDateRange] = useState('30days'); // 7days, 30days, 90days, all
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    useEffect(() => {
        console.log('[useEffect] Triggered - fetching data...');
        console.log('[useEffect] dateRange:', dateRange);
        console.log('[useEffect] customStartDate:', customStartDate);
        console.log('[useEffect] customEndDate:', customEndDate);
        fetchAllData();
        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchAllData, 30000);
        return () => clearInterval(interval);
    }, [dateRange, customStartDate, customEndDate]);

    const getDateRangeParams = () => {
        if (dateRange === 'custom' && customStartDate && customEndDate) {
            return { startDate: customStartDate, endDate: customEndDate };
        }
        
        const endDate = new Date().toISOString();
        let startDate;
        
        switch (dateRange) {
            case '7days':
                startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
                break;
            case '30days':
                startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
                break;
            case '90days':
                startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
                break;
            default:
                return { startDate: null, endDate: null };
        }
        
        return { startDate, endDate };
    };

    const fetchAllData = async () => {
        try {
            console.log('[fetchAllData] Starting data fetch...');
            setLoading(true);
            const { startDate, endDate } = getDateRangeParams();
            
            console.log('[fetchAllData] Date range:', { startDate, endDate });
            
            const [
                dashboardData,
                deliveryHealthData,
                deliveryTrendsData,
                audienceReachData,
                contentDistData,
                memberPrefsData,
                engagementSignalsData,
                recsData
            ] = await Promise.all([
                getPracticalDashboard(startDate, endDate).catch(err => { console.error('Dashboard error:', err); return null; }),
                getDeliveryHealth(startDate, endDate).catch(err => { console.error('DeliveryHealth error:', err); return null; }),
                getDeliveryTrends(startDate, endDate).catch(err => { console.error('DeliveryTrends error:', err); return null; }),
                getAudienceReach(startDate, endDate).catch(err => { console.error('AudienceReach error:', err); return null; }),
                getContentDistribution(startDate, endDate).catch(err => { console.error('ContentDistribution error:', err); return null; }),
                getMemberPreferences().catch(err => { console.error('MemberPreferences error:', err); return null; }),
                getEngagementSignals(startDate, endDate).catch(err => { console.error('EngagementSignals error:', err); return null; }),
                getPracticalRecommendations().catch(err => { console.error('Recommendations error:', err); return null; })
            ]);
            
            console.log('[fetchAllData] Dashboard:', dashboardData);
            console.log('[fetchAllData] DeliveryHealth:', deliveryHealthData);
            console.log('[fetchAllData] DeliveryTrends:', deliveryTrendsData);
            console.log('[fetchAllData] AudienceReach:', audienceReachData);
            console.log('[fetchAllData] ContentDistribution:', contentDistData);
            console.log('[fetchAllData] MemberPreferences:', memberPrefsData);
            console.log('[fetchAllData] EngagementSignals:', engagementSignalsData);
            console.log('[fetchAllData] Recommendations:', recsData);
            
            setDashboard(dashboardData);
            setDeliveryHealth(deliveryHealthData);
            setDeliveryTrends(deliveryTrendsData);
            setAudienceReach(audienceReachData);
            setContentDistribution(contentDistData);
            setMemberPreferences(memberPrefsData);
            setEngagementSignals(engagementSignalsData);
            setRecommendations(recsData);
            
            // Fetch AI recommendations separately (don't block main data)
            fetchAIRecommendations(startDate, endDate);
        } catch (error) {
            console.error('[fetchAllData] error:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAIRecommendations = async (startDate, endDate) => {
        try {
            setAiLoading(true);
            setAiError(null);
            const aiData = await getAIRecommendations(startDate, endDate);
            setAiRecommendations(aiData);
        } catch (error) {
            console.error('[fetchAIRecommendations] error:', error);
            setAiError(error.message || 'Failed to load AI recommendations');
            setAiRecommendations(null);
        } finally {
            setAiLoading(false);
        }
    };

    const formatNumber = (num) => {
        if (!num && num !== 0) return '0';
        return num.toLocaleString();
    };

    const formatPercent = (num) => {
        if (!num && num !== 0) return '0%';
        return `${num.toFixed(1)}%`;
    };

    const MetricCard = ({ title, value, subtitle, icon, color = '#dc2626', trend = null }) => (
        <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            border: '1px solid #e5e7eb'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ fontSize: '13px', color: '#666', fontWeight: '500' }}>{title}</div>
                <span style={{ fontSize: '20px' }}>{icon}</span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: color, marginBottom: '4px' }}>
                {value}
            </div>
            {subtitle && (
                <div style={{ fontSize: '12px', color: '#999' }}>{subtitle}</div>
            )}
            {trend !== null && trend !== undefined && (
                <div style={{
                    fontSize: '12px',
                    color: trend > 0 ? '#059669' : '#dc2626',
                    marginTop: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                }}>
                    <span>{trend > 0 ? '↑' : '↓'}</span>
                    <span>{Math.abs(trend).toFixed(1)}% vs previous period</span>
                </div>
            )}
        </div>
    );

    const renderOverview = () => {
        const data = dashboard || {};
        const delivery = data.deliveryHealth || deliveryHealth || {};
        const engagement = data.engagementSignals || engagementSignals || {};
        const audience = data.audienceReach || audienceReach || {};
        const recentBroadcasts = data.recentBroadcasts || [];
        
        console.log('[renderOverview] Dashboard data:', data);
        console.log('[renderOverview] Delivery:', delivery);
        console.log('[renderOverview] Engagement:', engagement);
        console.log('[renderOverview] Audience:', audience);
        
        return (
            <div>
                {/* Info Banner */}
                <div style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    padding: '20px',
                    borderRadius: '12px',
                    color: 'white',
                    marginBottom: '24px'
                }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span style={{ fontSize: '32px' }}>📊</span>
                        <div>
                            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600' }}>
                                Practical Analytics - 100% Reliable Metrics
                            </h3>
                            <p style={{ margin: 0, fontSize: '13px', opacity: 0.95 }}>
                                Tracking delivery, audience reach, content distribution, and member preferences. No unreliable open/click tracking.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Key Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                    <MetricCard
                        title="Total Broadcasts"
                        value={formatNumber(delivery.totalBroadcastsSent || 0)}
                        icon="📨"
                        color="#2563eb"
                    />
                    <MetricCard
                        title="Emails Sent"
                        value={formatNumber(delivery.successfulDeliveries || 0)}
                        icon="✅"
                        color="#059669"
                        trend={delivery.deliveryRateChange}
                    />
                    <MetricCard
                        title="Delivery Rate"
                        value={formatPercent(delivery.deliveryRate || 0)}
                        subtitle="Successfully delivered"
                        icon="📬"
                        color={delivery.deliveryRate >= 95 ? "#059669" : delivery.deliveryRate >= 90 ? "#f59e0b" : "#dc2626"}
                        trend={delivery.deliveryRateChange}
                    />
                    <MetricCard
                        title="Bounce Rate"
                        value={formatPercent(delivery.bounceRate || 0)}
                        subtitle={`${formatNumber((delivery.hardBounces || 0) + (delivery.softBounces || 0))} bounces`}
                        icon="⚠️"
                        color="#dc2626"
                    />
                    <MetricCard
                        title="Active Members"
                        value={formatNumber(audience.totalActiveMembers || 0)}
                        subtitle={`${formatPercent(audience.reachPercentage || 0)} reached this period`}
                        icon="👥"
                        color="#8b5cf6"
                    />
                    <MetricCard
                        title="Unsubscribe Rate"
                        value={formatPercent(engagement.unsubscribeRate || 0)}
                        subtitle={`${formatNumber(engagement.unsubscribes || 0)} unsubscribed`}
                        icon="📉"
                        color="#ef4444"
                    />
                </div>

                {/* Quick Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ background: '#fef3c7', padding: '16px', borderRadius: '8px', border: '1px solid #fcd34d' }}>
                        <div style={{ fontSize: '12px', color: '#78350f', marginBottom: '4px' }}>Hard Bounces</div>
                        <div style={{ fontSize: '20px', fontWeight: '700', color: '#f59e0b' }}>
                            {formatNumber(delivery.hardBounces || 0)}
                        </div>
                        <div style={{ fontSize: '11px', color: '#92400e', marginTop: '4px' }}>Remove from list</div>
                    </div>
                    <div style={{ background: '#fee2e2', padding: '16px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                        <div style={{ fontSize: '12px', color: '#7f1d1d', marginBottom: '4px' }}>Soft Bounces</div>
                        <div style={{ fontSize: '20px', fontWeight: '700', color: '#dc2626' }}>
                            {formatNumber(delivery.softBounces || 0)}
                        </div>
                        <div style={{ fontSize: '11px', color: '#991b1b', marginTop: '4px' }}>Temporary failures</div>
                    </div>
                    <div style={{ background: '#d1fae5', padding: '16px', borderRadius: '8px', border: '1px solid #6ee7b7' }}>
                        <div style={{ fontSize: '12px', color: '#065f46', marginBottom: '4px' }}>New Members</div>
                        <div style={{ fontSize: '20px', fontWeight: '700', color: '#059669' }}>
                            {formatNumber(engagement.newMembers || 0)}
                        </div>
                        <div style={{ fontSize: '11px', color: '#047857', marginTop: '4px' }}>List growth</div>
                    </div>
                    <div style={{ background: '#dbeafe', padding: '16px', borderRadius: '8px', border: '1px solid #93c5fd' }}>
                        <div style={{ fontSize: '12px', color: '#1e3a8a', marginBottom: '4px' }}>Churn Rate</div>
                        <div style={{ fontSize: '20px', fontWeight: '700', color: '#2563eb' }}>
                            {formatPercent(engagement.churnRate || 0)}
                        </div>
                        <div style={{ fontSize: '11px', color: '#1e40af', marginTop: '4px' }}>Member loss rate</div>
                    </div>
                </div>

                {/* Health Score & Recommendations */}
                {delivery.healthScore && (
                    <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
                        <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#666' }}>Delivery Health Assessment</h4>
                        <div style={{ display: 'flex', gap: '24px', alignItems: 'center', marginBottom: '16px' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '36px', fontWeight: '700', color: delivery.healthScore >= 90 ? '#059669' : delivery.healthScore >= 75 ? '#f59e0b' : '#dc2626' }}>
                                    {Math.round(delivery.healthScore || 0)}
                                </div>
                                <div style={{ fontSize: '12px', color: '#666' }}>Health Score</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                                    {delivery.healthStatus || 'Unknown'}
                                </div>
                                <div style={{ fontSize: '13px', color: '#666' }}>
                                    Based on delivery rates and bounce patterns
                                </div>
                            </div>
                        </div>
                        {delivery.recommendations && delivery.recommendations.length > 0 && (
                            <div>
                                <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>Recommendations:</div>
                                {delivery.recommendations.map((rec, idx) => (
                                    <div key={idx} style={{ fontSize: '13px', color: '#666', marginBottom: '4px', paddingLeft: '12px' }}>
                                        • {rec}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Recent Broadcasts */}
                {recentBroadcasts.length > 0 && (
                    <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                        <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#666' }}>Recent Broadcasts</h4>
                        <div style={{ display: 'grid', gap: '12px' }}>
                            {recentBroadcasts.slice(0, 5).map((broadcast, idx) => (
                                <div key={idx} style={{
                                    padding: '16px',
                                    background: '#f9fafb',
                                    borderRadius: '8px',
                                    border: '1px solid #e5e7eb'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                                            {broadcast.title}
                                        </div>
                                        <div style={{
                                            fontSize: '11px',
                                            padding: '2px 8px',
                                            borderRadius: '12px',
                                            background: broadcast.deliveryRate >= 95 ? '#d1fae5' : broadcast.deliveryRate >= 90 ? '#fef3c7' : '#fee2e2',
                                            color: broadcast.deliveryRate >= 95 ? '#065f46' : broadcast.deliveryRate >= 90 ? '#78350f' : '#7f1d1d'
                                        }}>
                                            {broadcast.deliveryStatus}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#666' }}>
                                        <span>📨 {formatNumber(broadcast.totalSent)} sent</span>
                                        <span>✅ {formatPercent(broadcast.deliveryRate)} delivered</span>
                                        <span>📰 {broadcast.articleCount} articles</span>
                                        {broadcast.unsubscribes > 0 && (
                                            <span style={{ color: '#dc2626' }}>📉 {broadcast.unsubscribes} unsubscribed</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderDelivery = () => {
        const delivery = deliveryHealth || {};
        const trends = deliveryTrends || [];

        return (
            <div>
                <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px', color: '#333' }}>
                    📬 Email Delivery Health
                </h3>

                {/* Delivery Overview */}
                <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
                    <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#666' }}>Delivery Summary</h4>
                    <div style={{ display: 'grid', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                            <span style={{ fontSize: '14px', color: '#374151' }}>Total Attempted</span>
                            <span style={{ fontSize: '18px', fontWeight: '700', color: '#111827' }}>
                                {formatNumber(delivery.totalEmailsAttempted || 0)}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f0fdf4', borderRadius: '8px' }}>
                            <span style={{ fontSize: '14px', color: '#065f46' }}>✅ Successful Deliveries</span>
                            <span style={{ fontSize: '18px', fontWeight: '700', color: '#059669' }}>
                                {formatNumber(delivery.successfulDeliveries || 0)}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#fef2f2', borderRadius: '8px' }}>
                            <span style={{ fontSize: '14px', color: '#991b1b' }}>❌ Failed Deliveries</span>
                            <span style={{ fontSize: '18px', fontWeight: '700', color: '#dc2626' }}>
                                {formatNumber(delivery.failedDeliveries || 0)}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 12px 12px 32px', background: '#fff7ed', borderRadius: '8px' }}>
                            <span style={{ fontSize: '13px', color: '#9a3412' }}>⚠️ Hard Bounces (Remove)</span>
                            <span style={{ fontSize: '16px', fontWeight: '600', color: '#ea580c' }}>
                                {formatNumber(delivery.hardBounces || 0)}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 12px 12px 32px', background: '#fef3c7', borderRadius: '8px' }}>
                            <span style={{ fontSize: '13px', color: '#78350f' }}>🔄 Soft Bounces (Retry)</span>
                            <span style={{ fontSize: '16px', fontWeight: '600', color: '#f59e0b' }}>
                                {formatNumber(delivery.softBounces || 0)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Delivery Rate Gauge */}
                <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
                    <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#666' }}>Delivery Performance</h4>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '64px', fontWeight: '700', color: '#059669', marginBottom: '8px' }}>
                            {formatPercent(delivery.deliveryRate || 0)}
                        </div>
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>Overall Delivery Rate</div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '13px' }}>
                            <span style={{ color: delivery.deliveryRate >= 95 ? '#059669' : delivery.deliveryRate >= 90 ? '#f59e0b' : '#dc2626' }}>
                                {delivery.deliveryRate >= 95 ? '✅ Excellent' : delivery.deliveryRate >= 90 ? '⚠️ Good' : '❌ Needs Improvement'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Delivery Trends */}
                {Array.isArray(trends) && trends.length > 0 && (
                    <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                        <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#666' }}>Delivery Trends Over Time</h4>
                        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            {trends.map((trend, idx) => (
                                <div key={idx} style={{
                                    padding: '12px',
                                    borderBottom: idx < trends.length - 1 ? '1px solid #f3f4f6' : 'none',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div style={{ fontSize: '13px', color: '#666' }}>
                                        {new Date(trend.date).toLocaleDateString()}
                                    </div>
                                    <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                                        <div>
                                            <span style={{ fontSize: '12px', color: '#999' }}>Attempted: </span>
                                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                                                {formatNumber(trend.emailsAttempted || 0)}
                                            </span>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '12px', color: '#999' }}>Delivered: </span>
                                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#059669' }}>
                                                {formatNumber(trend.emailsDelivered || 0)}
                                            </span>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '12px', color: '#999' }}>Rate: </span>
                                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#059669' }}>
                                                {formatPercent(trend.deliveryRate || 0)}
                                            </span>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '12px', color: '#999' }}>Bounces: </span>
                                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#dc2626' }}>
                                                {formatNumber(trend.bounces || 0)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderContent = () => {
        const content = contentDistribution || {};
        const preferences = memberPreferences || {};
        const topInterestTopics = content.topInterestTopics || [];
        const topIndustryTopics = content.topIndustryTopics || [];
        const contentGaps = content.contentGaps || [];
        const overservedTopics = content.overservedTopics || [];
        const topInterests = preferences.topInterests || [];
        const topIndustries = preferences.topIndustries || [];
        const underserved = contentGaps.filter(gap => gap.gapType === 'Underserved') || [];
        const overserved = contentGaps.filter(gap => gap.gapType === 'Overserved') || [];

        return (
            <div>
                <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px', color: '#333' }}>
                    📰 Content Distribution Analysis
                </h3>

                {/* Content Summary */}
                <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
                    <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#666' }}>Content Overview</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                        <MetricCard
                            title="Total Articles Sent"
                            value={formatNumber(content.totalArticlesSent || 0)}
                            icon="📰"
                            color="#2563eb"
                        />
                        <MetricCard
                            title="Unique Articles"
                            value={formatNumber(content.uniqueArticlesSent || 0)}
                            icon="🔖"
                            color="#8b5cf6"
                        />
                        <MetricCard
                            title="Preference Match Score"
                            value={content.preferenceMatchScore ? `${Math.round(content.preferenceMatchScore)}/100` : 'N/A'}
                            subtitle="How well content matches audience"
                            icon="🎯"
                            color={content.preferenceMatchScore >= 80 ? '#059669' : content.preferenceMatchScore >= 60 ? '#f59e0b' : '#dc2626'}
                        />
                    </div>
                </div>

                {/* Content vs Preferences Comparison */}
                <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
                    <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#666' }}>
                        What You're Sending vs What Members Want
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                        {/* Topics Sent */}
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#8b5cf6', marginBottom: '12px' }}>
                                📤 Interest Topics You're Sending
                            </div>
                            {topInterestTopics.length > 0 ? topInterestTopics.map((topic, idx) => (
                                <div key={idx} style={{
                                    padding: '10px',
                                    marginBottom: '8px',
                                    background: '#f5f3ff',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <span style={{ fontSize: '13px', color: '#374151' }}>{topic.tagNameEN || topic.tagNameZH}</span>
                                    <div style={{ textAlign: 'right', fontSize: '12px' }}>
                                        <div style={{ fontWeight: '600', color: '#8b5cf6' }}>
                                            {formatNumber(topic.timesSent || 0)} broadcasts
                                        </div>
                                        <div style={{ color: '#666' }}>
                                            {formatNumber(topic.totalRecipients || 0)} recipients
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div style={{ fontSize: '13px', color: '#999', padding: '10px', textAlign: 'center' }}>
                                    No interest topics data
                                </div>
                            )}
                            
                            {topIndustryTopics.length > 0 && (
                                <>
                                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#f59e0b', marginTop: '16px', marginBottom: '12px' }}>
                                        🏢 Industry Topics You're Sending
                                    </div>
                                    {topIndustryTopics.slice(0, 5).map((topic, idx) => (
                                        <div key={idx} style={{
                                            padding: '10px',
                                            marginBottom: '8px',
                                            background: '#fffbeb',
                                            borderRadius: '6px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <span style={{ fontSize: '13px', color: '#374151' }}>{topic.tagNameEN || topic.tagNameZH}</span>
                                            <div style={{ textAlign: 'right', fontSize: '12px' }}>
                                                <div style={{ fontWeight: '600', color: '#f59e0b' }}>
                                                    {formatNumber(topic.timesSent || 0)} broadcasts
                                                </div>
                                                <div style={{ color: '#666' }}>
                                                    {formatNumber(topic.totalRecipients || 0)} recipients
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>

                        {/* Member Preferences */}
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#059669', marginBottom: '12px' }}>
                                📥 What Members Want (Interests)
                            </div>
                            {topInterests.length > 0 ? topInterests.map((interest, idx) => (
                                <div key={idx} style={{
                                    padding: '10px',
                                    marginBottom: '8px',
                                    background: '#f0fdf4',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <span style={{ fontSize: '13px', color: '#374151' }}>{interest.tagNameEN || interest.tagNameZH}</span>
                                    <div style={{ textAlign: 'right', fontSize: '12px' }}>
                                        <div style={{ fontWeight: '600', color: '#059669' }}>
                                            {formatNumber(interest.memberCount || 0)} members
                                        </div>
                                        <div style={{ color: '#666' }}>
                                            {formatPercent(interest.percentageOfMembers || 0)}
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div style={{ fontSize: '13px', color: '#999', padding: '10px', textAlign: 'center' }}>
                                    No preference data
                                </div>
                            )}
                            
                            {topIndustries.length > 0 && (
                                <>
                                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#0369a1', marginTop: '16px', marginBottom: '12px' }}>
                                        🏢 Industry Preferences
                                    </div>
                                    {topIndustries.slice(0, 5).map((industry, idx) => (
                                        <div key={idx} style={{
                                            padding: '10px',
                                            marginBottom: '8px',
                                            background: '#f0f9ff',
                                            borderRadius: '6px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <span style={{ fontSize: '13px', color: '#374151' }}>{industry.tagNameEN || industry.tagNameZH}</span>
                                            <div style={{ textAlign: 'right', fontSize: '12px' }}>
                                                <div style={{ fontWeight: '600', color: '#0369a1' }}>
                                                    {formatNumber(industry.memberCount || 0)} members
                                                </div>
                                                <div style={{ color: '#666' }}>
                                                    {formatPercent(industry.percentageOfMembers || 0)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Underserved Topics (High Demand, Low Supply) */}
                {underserved.length > 0 && (
                    <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
                        <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#dc2626' }}>
                            ⚠️ Underserved Topics (Send More of These)
                        </h4>
                        <div style={{ display: 'grid', gap: '12px' }}>
                            {underserved.map((topic, idx) => (
                                <div key={idx} style={{
                                    padding: '16px',
                                    background: '#fef2f2',
                                    borderRadius: '8px',
                                    border: '1px solid #fecaca'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '15px', fontWeight: '600', color: '#374151' }}>
                                            {topic.tagName}
                                        </span>
                                        <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: '600' }}>
                                            GAP: {formatNumber(topic.gap || 0)}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#666' }}>
                                        <span>👥 {formatNumber(topic.membersDemanding || 0)} want this</span>
                                        <span>📨 {formatNumber(topic.timesSent || 0)} sent</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Overserved Topics (Low Demand, High Supply) */}
                {overserved.length > 0 && (
                    <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                        <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#f59e0b' }}>
                            📊 Overserved Topics (Consider Reducing)
                        </h4>
                        <div style={{ display: 'grid', gap: '12px' }}>
                            {overserved.map((topic, idx) => (
                                <div key={idx} style={{
                                    padding: '16px',
                                    background: '#fffbeb',
                                    borderRadius: '8px',
                                    border: '1px solid #fef3c7'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '15px', fontWeight: '600', color: '#374151' }}>
                                            {topic.tagName}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#666' }}>
                                        <span>👥 {formatNumber(topic.membersDemanding || 0)} want this</span>
                                        <span>📨 {formatNumber(topic.timesSent || 0)} sent</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderAudience = () => {
        const audience = audienceReach || {};
        const preferences = memberPreferences || {};
        const segments = audience.segmentBreakdown || [];
        const coverage = audience.coverageGaps || [];
        const topIndustries = preferences.topIndustries || [];
        const languages = preferences.languagePreferences || [];

        return (
            <div>
                <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px', color: '#333' }}>
                    👥 Audience Reach & Preferences
                </h3>

                {/* Segment Breakdown */}
                {segments.length > 0 && (
                    <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
                        <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#666' }}>
                            Audience Segments Reached
                        </h4>
                        <div style={{ display: 'grid', gap: '12px' }}>
                            {segments.map((segment, idx) => (
                                <div key={idx} style={{
                                    padding: '16px',
                                    background: '#f9fafb',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '15px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                                            {segment.segment}
                                        </div>
                                        <div style={{ fontSize: '13px', color: '#666' }}>
                                            {formatNumber(segment.membersReached || 0)} members reached
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '18px', fontWeight: '700', color: '#2563eb' }}>
                                        {formatPercent(segment.percentage || 0)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Coverage Gaps */}
                {coverage.length > 0 && (
                    <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
                        <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#dc2626' }}>
                            ⚠️ Coverage Gaps (Not Reaching These Segments)
                        </h4>
                        <div style={{ display: 'grid', gap: '12px' }}>
                            {coverage.map((gap, idx) => (
                                <div key={idx} style={{
                                    padding: '16px',
                                    background: '#fef2f2',
                                    borderRadius: '8px',
                                    border: '1px solid #fecaca'
                                }}>
                                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                                        {gap.segment}
                                    </div>
                                    <div style={{ fontSize: '13px', color: '#666' }}>
                                        {formatNumber(gap.memberCount || 0)} members not reached recently
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Member Preferences */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    {/* Top Industries */}
                    {topIndustries.length > 0 && (
                        <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                            <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#666' }}>
                                🏭 Top Industries
                            </h4>
                            {topIndustries.map((industry, idx) => (
                                <div key={idx} style={{
                                    padding: '12px',
                                    marginBottom: '8px',
                                    background: '#f0f9ff',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <span style={{ fontSize: '13px', color: '#374151' }}>{industry.industry}</span>
                                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#0369a1' }}>
                                        {formatNumber(industry.memberCount || 0)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Language Preferences */}
                    {languages.length > 0 && (
                        <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                            <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#666' }}>
                                🌐 Language Preferences
                            </h4>
                            {languages.map((lang, idx) => (
                                <div key={idx} style={{
                                    padding: '12px',
                                    marginBottom: '8px',
                                    background: '#f5f3ff',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <span style={{ fontSize: '13px', color: '#374151' }}>{lang.language}</span>
                                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#7c3aed' }}>
                                        {formatPercent(lang.percentage || 0)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderRecommendations = () => {
        const aiRecs = aiRecommendations?.recommendations || [];
        const aiSummary = aiRecommendations?.summary || '';
        
        const getPriorityColor = (priority) => {
            switch (priority?.toLowerCase()) {
                case 'high': return { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' };
                case 'medium': return { bg: '#fffbeb', border: '#fef3c7', text: '#f59e0b' };
                case 'low': return { bg: '#f0fdf4', border: '#86efac', text: '#059669' };
                default: return { bg: '#f9fafb', border: '#e5e7eb', text: '#374151' };
            }
        };

        return (
            <div>
                <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px', color: '#333' }}>
                    💡 AI-Powered Recommendations
                </h3>

                {/* Info Banner */}
                <div style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    padding: '20px',
                    borderRadius: '12px',
                    color: 'white',
                    marginBottom: '24px'
                }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span style={{ fontSize: '32px' }}>🤖</span>
                        <div>
                            <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600' }}>
                                AI-Powered Analytics Insights
                            </h4>
                            <p style={{ margin: 0, fontSize: '13px', opacity: 0.95 }}>
                                OpenAI analyzes your delivery rates, member preferences, and engagement signals to provide actionable recommendations.
                            </p>
                        </div>
                    </div>
                </div>

                {/* AI Loading State */}
                {aiLoading && (
                    <div style={{
                        background: 'white',
                        padding: '24px',
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        marginBottom: '24px',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '32px', marginBottom: '12px' }}>🤔</div>
                        <div style={{ fontSize: '14px', color: '#666' }}>AI is analyzing your data...</div>
                    </div>
                )}

                {/* AI Error State */}
                {!aiLoading && aiError && (
                    <div style={{
                        background: '#fef2f2',
                        padding: '24px',
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        marginBottom: '24px',
                        border: '2px solid #fecaca'
                    }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '24px' }}>⚠️</span>
                            <div style={{ flex: 1 }}>
                                <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#dc2626', marginBottom: '8px' }}>
                                    AI Recommendations Unavailable
                                </h4>
                                <p style={{ fontSize: '13px', color: '#991b1b', lineHeight: '1.6', marginBottom: '12px' }}>
                                    The AI recommendation service encountered an error. This is typically due to backend configuration issues.
                                </p>
                                <details style={{ fontSize: '12px', color: '#7f1d1d' }}>
                                    <summary style={{ cursor: 'pointer', fontWeight: '500', marginBottom: '8px' }}>Technical Details</summary>
                                    <div style={{ 
                                        background: '#fff',
                                        padding: '12px',
                                        borderRadius: '6px',
                                        marginTop: '8px',
                                        fontFamily: 'monospace',
                                        fontSize: '11px',
                                        overflowX: 'auto',
                                        maxHeight: '150px',
                                        overflowY: 'auto'
                                    }}>
                                        {aiError}
                                    </div>
                                </details>
                                <button
                                    onClick={() => {
                                        const { startDate, endDate } = getDateRangeParams();
                                        fetchAIRecommendations(startDate, endDate);
                                    }}
                                    style={{
                                        marginTop: '12px',
                                        padding: '8px 16px',
                                        background: '#dc2626',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        fontWeight: '500'
                                    }}
                                >
                                    🔄 Retry
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* AI Summary */}
                {!aiLoading && aiSummary && (
                    <div style={{
                        background: 'white',
                        padding: '24px',
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        marginBottom: '24px',
                        border: '2px solid #10b981'
                    }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '24px' }}>📊</span>
                            <div>
                                <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                    Overall Assessment
                                </h4>
                                <p style={{ fontSize: '14px', color: '#666', lineHeight: '1.6', margin: 0 }}>
                                    {aiSummary}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* AI Recommendations */}
                {!aiLoading && aiRecs.length > 0 && (
                    <div style={{ display: 'grid', gap: '16px' }}>
                        {aiRecs.map((rec, idx) => {
                            const colors = getPriorityColor(rec.priority);
                            return (
                                <div key={idx} style={{
                                    background: 'white',
                                    padding: '24px',
                                    borderRadius: '12px',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                    border: `2px solid ${colors.border}`
                                }}>
                                    {/* Header */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                        <div style={{ flex: 1 }}>
                                            <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                                                {rec.title}
                                            </h4>
                                            {rec.metricsReferenced && rec.metricsReferenced.length > 0 && (
                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                                                    {rec.metricsReferenced.map((metric, mIdx) => (
                                                        <span key={mIdx} style={{
                                                            fontSize: '11px',
                                                            padding: '2px 8px',
                                                            background: '#f3f4f6',
                                                            borderRadius: '12px',
                                                            color: '#6b7280'
                                                        }}>
                                                            {metric}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <span style={{
                                            fontSize: '12px',
                                            fontWeight: '600',
                                            padding: '4px 12px',
                                            borderRadius: '12px',
                                            background: colors.bg,
                                            color: colors.text,
                                            border: `1px solid ${colors.border}`,
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {rec.priority} Priority
                                        </span>
                                    </div>

                                    {/* Why */}
                                    <div style={{ marginBottom: '16px' }}>
                                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '6px' }}>
                                            📌 Why this matters:
                                        </div>
                                        <div style={{ fontSize: '14px', color: '#374151', lineHeight: '1.6' }}>
                                            {rec.why}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    {rec.actions && rec.actions.length > 0 && (
                                        <div>
                                            <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '8px' }}>
                                                ✅ Recommended actions:
                                            </div>
                                            <div style={{ display: 'grid', gap: '8px' }}>
                                                {rec.actions.map((action, aIdx) => (
                                                    <div key={aIdx} style={{
                                                        padding: '12px',
                                                        background: '#f9fafb',
                                                        borderRadius: '6px',
                                                        fontSize: '13px',
                                                        color: '#374151',
                                                        display: 'flex',
                                                        alignItems: 'flex-start',
                                                        gap: '8px'
                                                    }}>
                                                        <span style={{ color: '#059669', fontWeight: '600' }}>{aIdx + 1}.</span>
                                                        <span>{action}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Empty State */}
                {!aiLoading && aiRecs.length === 0 && (
                    <div style={{
                        background: 'white',
                        padding: '48px',
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                            Everything Looks Good!
                        </div>
                        <div style={{ fontSize: '14px', color: '#666' }}>
                            No urgent recommendations at this time. Keep monitoring your metrics.
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '24px' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#333', margin: '0 0 8px 0' }}>
                            📊 Broadcast Analytics
                        </h1>
                        <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>
                            Track delivery performance, audience reach, and content effectiveness
                        </p>
                    </div>
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

                {/* Date Range Filter */}
                <div style={{ background: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: '500', color: '#666' }}>Time Period:</span>
                        {['7days', '30days', '90days', 'all'].map(range => (
                            <button
                                key={range}
                                onClick={() => setDateRange(range)}
                                style={{
                                    padding: '8px 16px',
                                    background: dateRange === range ? '#dc2626' : '#f3f4f6',
                                    color: dateRange === range ? 'white' : '#374151',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: '500'
                                }}
                            >
                                {range === '7days' ? 'Last 7 Days' :
                                 range === '30days' ? 'Last 30 Days' :
                                 range === '90days' ? 'Last 90 Days' : 'All Time'}
                            </button>
                        ))}
                        {dateRange === 'custom' && (
                            <>
                                <input
                                    type="date"
                                    value={customStartDate}
                                    onChange={(e) => setCustomStartDate(e.target.value)}
                                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                                />
                                <span style={{ fontSize: '13px', color: '#999' }}>to</span>
                                <input
                                    type="date"
                                    value={customEndDate}
                                    onChange={(e) => setCustomEndDate(e.target.value)}
                                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                                />
                            </>
                        )}
                        <button
                            onClick={fetchAllData}
                            style={{
                                padding: '8px 16px',
                                background: '#059669',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: '500',
                                marginLeft: 'auto'
                            }}
                        >
                            🔄 Refresh
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ background: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {[
                            { id: 'overview', label: '📊 Overview', icon: '📊' },
                            { id: 'delivery', label: '📬 Delivery Health', icon: '📬' },
                            { id: 'content', label: '📰 Content', icon: '📰' },
                            { id: 'audience', label: '👥 Audience', icon: '👥' },
                            { id: 'recommendations', label: '💡 Recommendations', icon: '💡' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    padding: '12px 20px',
                                    background: activeTab === tab.id ? '#dc2626' : 'transparent',
                                    color: activeTab === tab.id ? 'white' : '#666',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '48px' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
                        <div style={{ fontSize: '16px', color: '#666' }}>Loading analytics...</div>
                    </div>
                ) : (
                    <div>
                        {activeTab === 'overview' && renderOverview()}
                        {activeTab === 'delivery' && renderDelivery()}
                        {activeTab === 'content' && renderContent()}
                        {activeTab === 'audience' && renderAudience()}
                        {activeTab === 'recommendations' && renderRecommendations()}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BroadcastAnalytics;
