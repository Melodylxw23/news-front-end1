import React, { useState } from 'react'
import AuthLayout from './AuthLayout'
import { Link, useNavigate } from 'react-router-dom'
import { getRoleFromToken, getNameFromToken } from '../../utils/auth'

function MemberLogin({ onLoginSuccess }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({ Email: '', Password: '' })
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage(null)
    setLoading(true)
    try {
      const res = await fetch('/api/UserControllers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setMessage(typeof data === 'string' ? data : (data?.message || 'Login failed'))
      } else {
        const token = data?.token
        if (token) localStorage.setItem('token', token)
        
        // Check if user needs to select topics of interest
        if (data?.needsTopicSelection === true) {
          setMessage('Please select your topics of interest')
          navigate('/select-topics')
          return
        }
        
        setMessage(data?.message || 'Login successful')

        // Prefer role from token claims if available
        const roleFromToken = getRoleFromToken(token)
        const nameFromToken = getNameFromToken(token)
        if (roleFromToken) {
          localStorage.setItem('role', roleFromToken)
          if (nameFromToken) localStorage.setItem('name', nameFromToken)
          if (onLoginSuccess) onLoginSuccess(roleFromToken)
          
          // Navigate to member profile for members
          if (roleFromToken.toLowerCase() === 'member') {
            navigate('/member/profile')
            return
          }
        } else {
          // fallback to /me
          try {
            const meRes = await fetch('/api/UserControllers/me', { headers: { Authorization: `Bearer ${token}` } })
            const me = await meRes.json().catch(() => null)
            const roles = me?.Roles || []
            const rolesLower = roles.map(r => String(r).toLowerCase())
            let determined = null
            if (rolesLower.includes('admin')) determined = 'admin'
            else if (rolesLower.includes('consultant')) determined = 'consultant'
            else if (rolesLower.includes('member')) determined = 'member'
            else if (roles.length > 0) determined = String(roles[0]).toLowerCase()
            if (determined) {
              localStorage.setItem('role', determined)
              if (me?.Name) localStorage.setItem('name', me.Name)
              if (onLoginSuccess) onLoginSuccess(determined)
              
              // Navigate to member profile for members
              if (determined === 'member') {
                navigate('/member/profile')
                return
              }
            } else {
              localStorage.setItem('role', 'member')
              if (onLoginSuccess) onLoginSuccess('member')
              navigate('/member/profile')
              return
            }
          } catch (err) {
            localStorage.setItem('role', 'member')
            if (onLoginSuccess) onLoginSuccess('member')
            navigate('/member/profile')
            return
          }
        }
      }
    } catch (err) {
      setMessage('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Member Login">
      {message && <div style={{ marginBottom: 12 }}>{message}</div>}
      <form onSubmit={handleSubmit}>
        <label>Email</label>
        <input type="email" name="Email" value={form.Email} onChange={handleChange} required autoComplete="email" />

        <label>Password</label>
        <input type="password" name="Password" value={form.Password} onChange={handleChange} required autoComplete="current-password" />

        <button className="auth-btn" type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Login'}</button>
      </form>
      <div className="auth-footer">
        <div style={{ opacity: 0.9 }}><Link to="/forgot-password">Forgot Password?</Link></div>
        <div style={{ opacity: 0.9 }}><Link to="/register">Register a Member Account</Link></div>
      </div>
    </AuthLayout>
  )
}

export default MemberLogin