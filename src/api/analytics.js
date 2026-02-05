const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || '';

const buildHeaders = () => {
  const token = localStorage.getItem('token');
  const h = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
};

const join = (path) => path.startsWith('http') ? path : `${API_BASE}${path}`;

// ==================== PRACTICAL ANALYTICS (RELIABLE METRICS) ====================

// Get comprehensive practical dashboard with all reliable metrics
export const getPracticalDashboard = async (startDate = null, endDate = null) => {
  let url = join('/api/analytics/practical/dashboard');
  if (startDate && endDate) {
    url += `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
  }
  
  const response = await fetch(url, {
    headers: buildHeaders()
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get practical dashboard: ${errorText}`);
  }
  
  return response.json();
};

// Get email delivery health (100% reliable)
export const getDeliveryHealth = async (startDate = null, endDate = null) => {
  let url = join('/api/analytics/practical/delivery-health');
  if (startDate && endDate) {
    url += `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
  }
  
  const response = await fetch(url, {
    headers: buildHeaders()
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get delivery health: ${errorText}`);
  }
  
  return response.json();
};

// Get delivery trends over time
export const getDeliveryTrends = async (startDate = null, endDate = null) => {
  let url = join('/api/analytics/practical/delivery-trends');
  if (startDate && endDate) {
    url += `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
  }
  
  const response = await fetch(url, {
    headers: buildHeaders()
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get delivery trends: ${errorText}`);
  }
  
  return response.json();
};

// Get audience reach by segments
export const getAudienceReach = async (startDate = null, endDate = null) => {
  let url = join('/api/analytics/practical/audience-reach');
  if (startDate && endDate) {
    url += `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
  }
  
  const response = await fetch(url, {
    headers: buildHeaders()
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get audience reach: ${errorText}`);
  }
  
  return response.json();
};

// Get content distribution vs member preferences
export const getContentDistribution = async (startDate = null, endDate = null) => {
  let url = join('/api/analytics/practical/content-distribution');
  if (startDate && endDate) {
    url += `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
  }
  
  const response = await fetch(url, {
    headers: buildHeaders()
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get content distribution: ${errorText}`);
  }
  
  return response.json();
};

// Get member preferences (from profile data)
export const getMemberPreferences = async () => {
  const response = await fetch(join('/api/analytics/practical/member-preferences'), {
    headers: buildHeaders()
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get member preferences: ${errorText}`);
  }
  
  return response.json();
};

// Get engagement signals (unsubscribes, churn, growth)
export const getEngagementSignals = async (startDate = null, endDate = null) => {
  let url = join('/api/analytics/practical/engagement-signals');
  if (startDate && endDate) {
    url += `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
  }
  
  const response = await fetch(url, {
    headers: buildHeaders()
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get engagement signals: ${errorText}`);
  }
  
  return response.json();
};

// Get AI-powered recommendations
export const getPracticalRecommendations = async () => {
  const response = await fetch(join('/api/analytics/practical/recommendations'), {
    headers: buildHeaders()
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get recommendations: ${errorText}`);
  }
  
  return response.json();
};

// ==================== AI-POWERED RECOMMENDATIONS ====================

// Get combined AI recommendations from both practical and broadcast analytics
export const getAIRecommendations = async (startDate = null, endDate = null) => {
  let url = join('/api/analytics/ai/recommendations');
  if (startDate && endDate) {
    url += `?fromDate=${encodeURIComponent(startDate)}&toDate=${encodeURIComponent(endDate)}`;
  }
  
  const response = await fetch(url, {
    headers: buildHeaders()
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get AI recommendations: ${errorText}`);
  }
  
  return response.json();
};

// Get AI recommendations focused on delivery health, audience reach, content distribution
export const getPracticalAIRecommendations = async (startDate = null, endDate = null) => {
  let url = join('/api/analytics/practical/ai-recommendations');
  if (startDate && endDate) {
    url += `?fromDate=${encodeURIComponent(startDate)}&toDate=${encodeURIComponent(endDate)}`;
  }
  
  const response = await fetch(url, {
    headers: buildHeaders()
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get practical AI recommendations: ${errorText}`);
  }
  
  return response.json();
};

// Get AI recommendations focused on engagement, topics, trends
export const getBroadcastAIRecommendations = async (startDate = null, endDate = null) => {
  let url = join('/api/analytics/broadcast/ai-recommendations');
  if (startDate && endDate) {
    url += `?fromDate=${encodeURIComponent(startDate)}&toDate=${encodeURIComponent(endDate)}`;
  }
  
  const response = await fetch(url, {
    headers: buildHeaders()
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get broadcast AI recommendations: ${errorText}`);
  }
  
  return response.json();
};

// ==================== LEGACY ANALYTICS (KEPT FOR BACKWARDS COMPATIBILITY) ====================

// Get comprehensive dashboard with all metrics
export const getAnalyticsDashboard = async (startDate = null, endDate = null) => {
  let url = join('/api/analytics/broadcast/dashboard');
  if (startDate && endDate) {
    url += `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
  }
  
  const response = await fetch(url, {
    headers: buildHeaders()
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get analytics dashboard: ${errorText}`);
  }
  
  return response.json();
};

// Get overview metrics for a period
export const getAnalyticsOverview = async (startDate = null, endDate = null) => {
  let url = join('/api/analytics/broadcast/overview');
  if (startDate && endDate) {
    url += `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
  }
  
  const response = await fetch(url, {
    headers: buildHeaders()
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get analytics overview: ${errorText}`);
  }
  
  return response.json();
};

// Get top performing content (topics & articles)
export const getTopContent = async (startDate = null, endDate = null, limit = 10) => {
  let url = join(`/api/analytics/broadcast/top-content?limit=${limit}`);
  if (startDate && endDate) {
    url += `&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
  }
  
  const response = await fetch(url, {
    headers: buildHeaders()
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get top content: ${errorText}`);
  }
  
  return response.json();
};

// Get topic performance metrics
export const getTopicPerformance = async (startDate = null, endDate = null) => {
  let url = join('/api/analytics/broadcast/topic-performance');
  if (startDate && endDate) {
    url += `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
  }
  
  const response = await fetch(url, {
    headers: buildHeaders()
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get topic performance: ${errorText}`);
  }
  
  return response.json();
};

// Get trending topics (rising/declining)
export const getTrendingTopics = async () => {
  const response = await fetch(join('/api/analytics/broadcast/trending-topics'), {
    headers: buildHeaders()
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get trending topics: ${errorText}`);
  }
  
  return response.json();
};

// Get audience insights (segmentation, demographics)
export const getAudienceInsights = async (startDate = null, endDate = null) => {
  let url = join('/api/analytics/broadcast/audience-insights');
  if (startDate && endDate) {
    url += `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
  }
  
  const response = await fetch(url, {
    headers: buildHeaders()
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get audience insights: ${errorText}`);
  }
  
  return response.json();
};

// Get member engagement list
export const getMemberEngagement = async (segmentType = null, limit = 100) => {
  let url = join(`/api/analytics/broadcast/member-engagement?limit=${limit}`);
  if (segmentType) {
    url += `&segmentType=${encodeURIComponent(segmentType)}`;
  }
  
  const response = await fetch(url, {
    headers: buildHeaders()
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get member engagement: ${errorText}`);
  }
  
  return response.json();
};

// Get individual broadcast analytics
export const getBroadcastAnalytics = async (broadcastId) => {
  const response = await fetch(join(`/api/analytics/broadcast/${broadcastId}`), {
    headers: buildHeaders()
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get broadcast analytics: ${errorText}`);
  }
  
  return response.json();
};

// Get engagement trends over time
export const getEngagementTrends = async (startDate = null, endDate = null, granularity = 'daily') => {
  let url = join(`/api/analytics/broadcast/trends?granularity=${granularity}`);
  if (startDate && endDate) {
    url += `&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
  }
  
  const response = await fetch(url, {
    headers: buildHeaders()
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get engagement trends: ${errorText}`);
  }
  
  return response.json();
};

// Get best send time recommendations
export const getBestSendTime = async () => {
  const response = await fetch(join('/api/analytics/broadcast/best-send-time'), {
    headers: buildHeaders()
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get best send time: ${errorText}`);
  }
  
  return response.json();
};

// Get content recommendations
export const getContentRecommendations = async () => {
  const response = await fetch(join('/api/analytics/broadcast/recommendations'), {
    headers: buildHeaders()
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get content recommendations: ${errorText}`);
  }
  
  return response.json();
};

// Track email open (called via tracking pixel)
export const trackEmailOpen = async (broadcastId, memberId) => {
  const response = await fetch(join(`/api/analytics/track/open/${broadcastId}/${memberId}`), {
    headers: buildHeaders()
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to track email open: ${errorText}`);
  }
  
  return response;
};

// Track link click (called via click redirect)
export const trackLinkClick = async (broadcastId, memberId, articleId = null) => {
  let url = join(`/api/analytics/track/click/${broadcastId}/${memberId}`);
  if (articleId) {
    url += `?articleId=${articleId}`;
  }
  
  const response = await fetch(url, {
    headers: buildHeaders()
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to track link click: ${errorText}`);
  }
  
  return response;
};
