import React, { useState, useRef, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || ''

const apiFetch = async (path, opts = {}) => {
  const token = localStorage.getItem('token')
  const headers = { 'Content-Type': 'application/json', ...opts.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const fullPath = path.startsWith('http') ? path : `${API_BASE.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
  
  const res = await fetch(fullPath, { ...opts, headers })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export default function ArticleChatbot({ articleTitle, articleContent }) {
  const [messages, setMessages] = useState([
    { type: 'bot', text: '👋 Hi! I can help you understand this article. What would you like to know?' }
  ])
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleAsk = async () => {
    if (!question.trim()) return

    // Add user message
    setMessages(prev => [...prev, { type: 'user', text: question }])
    setQuestion('')
    setLoading(true)

    try {
      const response = await apiFetch('/api/chat/ask-about-article', {
        method: 'POST',
        body: JSON.stringify({
          articleTitle,
          articleContent,
          question
        })
      })

      // Add bot response
      setMessages(prev => [...prev, { type: 'bot', text: response.answer }])
    } catch (err) {
      console.error('Chat error:', err)
      setMessages(prev => [...prev, { type: 'bot', text: '❌ Sorry, I couldn\'t process that. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000 }}>
      {/* Chat Window */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          bottom: 80,
          right: 0,
          width: 480,
          height: 560,
          background: 'white',
          borderRadius: 12,
          boxShadow: '0 6px 48px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideUp 0.28s ease'
        }}>
          <style>{`
            @keyframes slideUp {
              from { transform: translateY(20px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
          `}</style>

          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)',
            color: 'white',
            padding: 16,
            borderRadius: '12px 12px 0 0',
            fontWeight: 700,
            fontSize: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}>
            <span style={{ width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'white', color: '#b91c1c', borderRadius: 6, fontWeight: 800 }}>A</span>
            <span>Article Assistant</span>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  alignSelf: msg.type === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                  padding: '12px 16px',
                  borderRadius: 8,
                  background: msg.type === 'user' ? '#b91c1c' : '#fff5f5',
                  color: msg.type === 'user' ? 'white' : '#7f1d1d',
                  fontSize: 14,
                  lineHeight: 1.5,
                  boxShadow: msg.type === 'user' ? '0 6px 18px rgba(185,28,28,0.12)' : 'none'
                }}
              >
                {msg.text}
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#b91c1c',
                    animation: 'bounce 1.4s infinite'
                  }} />
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#b91c1c',
                    animation: 'bounce 1.4s infinite 0.2s'
                  }} />
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#b91c1c',
                    animation: 'bounce 1.4s infinite 0.4s'
                  }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: 12,
            borderTop: '1px solid #e0e0e0',
            display: 'flex',
            gap: 8
          }}>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAsk()}
              placeholder="Ask something..."
              style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: '1px solid #f3d4d4',
                  borderRadius: 6,
                  fontSize: 14,
                  outline: 'none'
                }}
            />
            <button
              onClick={handleAsk}
              disabled={loading || !question.trim()}
                style={{
                  padding: '8px 16px',
                  background: '#b91c1c',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600,
                  opacity: loading || !question.trim() ? 0.6 : 1
                }}
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
        style={{
          width: 84,
          height: 84,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)',
          color: 'white',
          border: 'none',
          fontSize: 34,
          cursor: 'pointer',
          boxShadow: '0 10px 30px rgba(185,28,28,0.32)',
          transition: 'transform 0.18s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        {isOpen ? (
          '✕'
        ) : (
          <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10z" fill="white" />
              <path d="M7.5 9.5c0-1.93 1.57-3.5 3.5-3.5s3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5-3.5-1.57-3.5-3.5z" fill="#fde8e8" opacity="0.95" />
            </svg>
          </div>
        )}
      </button>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  )
}