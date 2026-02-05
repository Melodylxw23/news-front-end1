import React from 'react';
import { useNavigate } from 'react-router-dom';

const MessageSent = () => {
    const navigate = useNavigate();

    return (
        <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ maxWidth: '600px', width: '100%', background: 'white', padding: '60px 40px', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.1)', textAlign: 'center' }}>
                <div style={{ fontSize: '80px', marginBottom: '24px' }}>✅</div>
                <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#333', marginBottom: '12px', margin: 0 }}>Broadcast Sent!</h1>
                <p style={{ fontSize: '16px', color: '#666', marginBottom: '32px', lineHeight: '1.6' }}>
                    Your broadcast message has been sent successfully to all subscribers.
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <button
                        onClick={() => navigate('/admin/broadcast')}
                        style={{
                            padding: '12px 32px',
                            background: '#dc2626',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '600'
                        }}
                    >
                        Create Another Message
                    </button>
                    <button
                        onClick={() => navigate('/drafts')}
                        style={{
                            padding: '12px 32px',
                            background: 'white',
                            color: '#333',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '600'
                        }}
                    >
                        View Drafts
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MessageSent;
