import React, { useState } from 'react'
import AuthLayout from './AuthLayout'
import { Link, useNavigate } from 'react-router-dom'
import { getRoleFromToken, getNameFromToken } from '../../utils/auth'

function StaffLogin({ onLoginSuccess }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({ Email: '', Password: '', SecretCode: '' })
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage(null)
    setLoading(true)
    try {
      const API_BASE = import.meta.env.VITE_API_BASE || ''
      const res = await fetch(`${API_BASE}/api/UserControllers/login`, {
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
        
        // Check if user must change password
        if (data?.mustChangePassword === true) {
          setMessage('You must change your password before continuing')
          navigate('/set-initial-password')
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
        } else {
          // fallback to /me
          try {
            const meRes = await fetch(`${API_BASE}/api/UserControllers/me`, { headers: { Authorization: `Bearer ${token}` } })
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
            } else {
              localStorage.setItem('role', 'consultant')
              if (onLoginSuccess) onLoginSuccess('consultant')
            }
          } catch (err) {
            localStorage.setItem('role', 'consultant')
            if (onLoginSuccess) onLoginSuccess('consultant')
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
    <AuthLayout title="Admin / Consultant Login">
      {message && <div style={{ marginBottom: 12 }}>{message}</div>}
      <form onSubmit={handleSubmit}>
        <label>Email</label>
        <input type="email" name="Email" value={form.Email} onChange={handleChange} required autoComplete="email" />

        <label>Password</label>
        <input type="password" name="Password" value={form.Password} onChange={handleChange} required autoComplete="current-password" />

        <label>Secret Code</label>
        <input name="SecretCode" value={form.SecretCode} onChange={handleChange} autoComplete="one-time-code" />

        <button className="auth-btn" type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Login'}</button>
      </form>
      <div className="auth-footer">
        <div style={{ opacity: 0.9 }}><Link to="/MemberLogin">Are you a Member?</Link></div>
        <div style={{ opacity: 0.9 }}><Link to="/StaffRegister">Register as Staff (Admin/Consultant)</Link></div>
      </div>
    </AuthLayout>
  )
}

export default StaffLogin