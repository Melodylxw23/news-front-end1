import React, { useEffect } from 'react'

export default function Toast({ message, type = 'info', duration = 3000, onClose }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => {
      onClose && onClose()
    }, duration)
    return () => clearTimeout(t)
  }, [message, duration, onClose])

  if (!message) return null

  const bg = type === 'error' ? '#fee2e2' : type === 'success' ? '#ecfdf5' : '#f8fafc'
  const color = type === 'error' ? '#991b1b' : type === 'success' ? '#065f46' : '#0f172a'
  const border = type === 'error' ? '1px solid #fecaca' : type === 'success' ? '1px solid #bbf7d0' : '1px solid #e6eefc'

  return (
    <div style={{
      position: 'fixed',
      right: 20,
      bottom: 24,
      zIndex: 9999,
      minWidth: 220,
      maxWidth: 360,
      padding: '12px 16px',
      borderRadius: 10,
      background: bg,
      color,
      border,
      boxShadow: '0 8px 24px rgba(2,6,23,0.08)',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      fontWeight: 600,
      fontSize: 14
    }}>
      <div style={{ flex: 1 }}>{message}</div>
      <button onClick={() => onClose && onClose()} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color }} aria-label="Close toast">✕</button>
    </div>
  )
}