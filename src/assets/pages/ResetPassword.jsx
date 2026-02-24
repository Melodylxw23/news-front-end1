import React, { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || ''

const apiFetch = async (path, opts = {}) => {
  const token = localStorage.getItem('token')
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {})
  if (token) headers['Authorization'] = `Bearer ${token}`
  const fullPath = path.startsWith('http') ? path : `${API_BASE.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`

  console.log('[apiFetch] request', opts.method || 'GET', fullPath, opts.body ? JSON.parse(opts.body) : undefined)

  const res = await fetch(fullPath, Object.assign({ headers }, opts))
  const text = await res.text().catch(() => '')
  if (!res.ok) {
    console.error('[apiFetch] error response:', res.status, text)
    const errorMsg = `HTTP ${res.status} ${res.statusText}${text ? ': ' + text : ''}`
    throw new Error(errorMsg)
  }
  try { return text ? JSON.parse(text) : null } catch (e) { return text }
}

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email')
  const token = searchParams.get('token')
  const code = searchParams.get('code')
  
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '', token: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Log URL parameters for debugging
  React.useEffect(() => {
    console.log('[ResetPassword] URL Parameters:', {
      email,
      token,
      code,
      fullSearch: window.location.search,
      allParams: Object.fromEntries(searchParams)
    })
  }, [email, token, code, searchParams])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!form.newPassword || !form.confirmPassword) {
      setError('Both fields are required')
      return
    }

    if (form.newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (form.newPassword !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!email) {
      setError('Email is missing. Please check the reset link from your email.')
      return
    }

    // Accept token from URL or manual input
    const resetToken = token || code || form.token
    if (!resetToken) {
      setError('Reset token is required. If you received it in your email, please paste it in the "Reset Token" field below.')
      return
    }

    setLoading(true)
    try {
      const payload = {
        Email: email,
        Token: resetToken,
        NewPassword: form.newPassword,
        ConfirmPassword: form.confirmPassword
      }
      
      console.log('[ResetPassword] Submitting payload:', payload)
      
      const res = await apiFetch('/api/UserControllers/reset-member-password', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      setSuccess(true)
      setForm({ newPassword: '', confirmPassword: '', token: '' })
      // Mark that the user has just completed a password reset so login won't force another change
      try { localStorage.setItem('passwordRecentlyReset', '1') } catch (e) { /* ignore */ }
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/MemberLogin')
      }, 2000)
    } catch (err) {
      console.error('[ResetPassword] Error:', err)
      setError(err.message || 'Failed to reset password. Please contact support if the issue persists.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #c92b2b 0%, #8b1f1f 100%)'
    }}>
      <div style={{
        background: 'white',
        padding: 40,
        borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        width: '90%',
        maxWidth: 450
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#333', marginBottom: 8 }}>
            Reset Your Password
          </div>
          <div style={{ fontSize: 14, color: '#666' }}>
            Enter your new password below
          </div>
        </div>

        {error && (
          <div style={{
            background: '#fee',
            border: '1px solid #fcc',
            color: '#c33',
            padding: 12,
            borderRadius: 8,
            marginBottom: 20,
            fontSize: 14
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            background: '#efe',
            border: '1px solid #cfc',
            color: '#3c3',
            padding: 12,
            borderRadius: 8,
            marginBottom: 20,
            fontSize: 14
          }}>
            Password reset successfully! Redirecting to login...
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!token && !code && (
            <div style={{ marginBottom: 20, padding: 12, background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8 }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#333' }}>
                Reset Token (from email) *
              </label>
              <input
                type="text"
                name="token"
                value={form.token}
                onChange={handleChange}
                placeholder="Paste the reset token/code from your email here"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  fontSize: 14,
                  boxSizing: 'border-box'
                }}
              />
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                If you don't see a token in the email, the password reset link should contain it in the URL.
              </div>
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#333' }}>
              New Password *
            </label>
            <input
              type="password"
              name="newPassword"
              value={form.newPassword}
              onChange={handleChange}
              placeholder="Enter your new password"
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #ddd',
                borderRadius: 8,
                fontSize: 14,
                boxSizing: 'border-box'
              }}
              disabled={loading}
            />
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              Minimum 6 characters
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#333' }}>
              Confirm Password *
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="Re-enter your new password"
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #ddd',
                borderRadius: 8,
                fontSize: 14,
                boxSizing: 'border-box'
              }}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading || success}
            style={{
              width: '100%',
              padding: '14px',
              background: loading || success ? '#ccc' : 'linear-gradient(135deg, #c92b2b 0%, #8b1f1f 100%)',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              cursor: loading || success ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s'
            }}
          >
            {loading ? 'Resetting Password...' : success ? 'Password Reset!' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  )
}