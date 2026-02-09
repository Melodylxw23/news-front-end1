const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || '';

/**
 * BROADCAST STATISTICS TRACKING GUIDE
 * ====================================
 * 
 * How Statistics Work:
 * 1. When a broadcast is sent via sendBroadcast(), your backend creates email delivery records
 * 2. Your backend tracks:
 *    - totalSent: Total number of emails queued for sending
 *    - delivered: Emails successfully delivered to recipient inboxes
 *    - opened: Emails opened by recipients (requires email tracking pixels)
 *    - failed: Emails that bounced or failed delivery
 * 
 * Backend Requirements:
 * - Implement email tracking pixels (1x1 transparent image) in email HTML
 * - Track opens when pixel is loaded: GET /api/broadcast/track-open/{broadcastId}/{memberId}
 * - Update delivery status when emails are sent/bounced
 * - Return statistics from GET /api/broadcast/{broadcastId}/statistics
 * 
 * Expected Response Format:
 * {
 *   "totalSent": 100,
 *   "delivered": 95,
 *   "opened": 42,
 *   "failed": 5,
 *   "openRate": 44.2,
 *   "sentAt": "2026-02-03T10:30:00Z"
 * }
 * 
 * Frontend Auto-Refresh:
 * - Statistics refresh every 10 seconds when modal is open
 * - Audience counts refresh every 30 seconds
 * - Preview recipients refresh every 5 seconds when preview modal is open
 */

const buildHeaders = () => {
  const token = localStorage.getItem('token');
  const h = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
};

const join = (path) => path.startsWith('http') ? path : `${API_BASE}${path}`;

// Preview recipients before sending
export const previewBroadcastRecipients = async (broadcastId) => {
  const response = await fetch(join(`/api/broadcast/preview-recipients`), {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ broadcastId })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to preview recipients: ${errorText}`);
  }
  
  return response.json();
};

// Send broadcast
export const sendBroadcast = async (broadcastId) => {
  const response = await fetch(join(`/api/broadcast/send`), {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ 
      broadcastId, 
      confirmSend: true 
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send broadcast: ${errorText}`);
  }
  
  return response.json();
};

// Get broadcast statistics
export const getBroadcastStatistics = async (broadcastId) => {
  const response = await fetch(join(`/api/broadcast/${broadcastId}/statistics`), {
    headers: buildHeaders()
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get broadcast statistics: ${errorText}`);
  }
  
  return response.json();
};

// Get broadcast status
export const getBroadcastStatus = async (broadcastId) => {
  const response = await fetch(join(`/api/broadcast/${broadcastId}/status`), {
    headers: buildHeaders()
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get broadcast status: ${errorText}`);
  }
  
  return response.json();
};

// Get audience counts (member statistics by interest/audience type)
export const getAudienceCounts = async () => {
  const response = await fetch(join(`/api/broadcast/audience-counts`), {
    headers: buildHeaders()
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get audience counts: ${errorText}`);
  }
  
  return response.json();
};
