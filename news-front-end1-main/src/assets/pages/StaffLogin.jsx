import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getRoleFromToken, getNameFromToken } from '../../utils/auth'
import logo from '../logo.png'
import sccciBuilding from '../sccci_building.png'

function StaffLogin({ onLoginSuccess }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({ Email: '', Password: '', SecretCode: '' })
  const [snackbar, setSnackbar] = useState({ show: false, message: '' })
  const [loading, setLoading] = useState(false)
  const [language, setLanguage] = useState(() => localStorage.getItem('authLanguage') || 'EN')

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  const handleLanguageChange = (lang) => {
    setLanguage(lang)
    localStorage.setItem('authLanguage', lang)
  }
  
  const showSnackbar = (message) => {
    setSnackbar({ show: true, message })
    setTimeout(() => setSnackbar({ show: false, message: '' }), 3000)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
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
        showSnackbar('Invalid Credentials')
      } else {
        const token = data?.token
        if (token) localStorage.setItem('token', token)
        
        // Check if user must change password
        if (data?.mustChangePassword === true) {
          navigate('/set-initial-password')
          return
        }

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
      showSnackbar('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      {/* Snackbar */}
      {snackbar.show && (
        <div className="snackbar">
          {snackbar.message}
        </div>
      )}
      
      {/* Language Toggle */}
      <div className="language-toggle-container">
        <button 
          className={`lang-btn ${language === 'EN' ? 'active' : ''}`}
          onClick={() => handleLanguageChange('EN')}
        >
          EN
        </button>
        <button 
          className={`lang-btn ${language === 'ZH' ? 'active' : ''}`}
          onClick={() => handleLanguageChange('ZH')}
        >
          华语
        </button>
      </div>

      <div className="cards-container">
        {/* Left Panel - Logo */}
        <div className="logo-card" style={{
          background: `linear-gradient(135deg, #E06064 0%, #BA0006 100%)`
        }}>
          {/* SCCCI Building Layer */}
          <div className="building-layer" style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${sccciBuilding})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.3,
            borderTopRightRadius: '40px',
            borderBottomRightRadius: '40px'
          }} />
          {/* Logo Layer */}
          <div className="logo-layer" style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${logo})`,
            backgroundSize: '60% auto',
            backgroundPosition: 'center 35%',
            backgroundRepeat: 'no-repeat'
          }} />
          <div className="logo-overlay">
            <div className="logo-caption">
              <p className="tagline">Be on the wave</p>
              <h2 className="slogan">Your personal, continuous stream of curated English & Chinese news.</h2>
            </div>
          </div>
        </div>

        <div className="divider" />

        {/* Right Panel - Login Form */}
        <div className="form-card">
          <div className="form-content">
            <div className="login-card">
              <h2>Staff Login</h2>
              
              <form onSubmit={handleSubmit}>
                <label>Email</label>
                <input 
                  type="email" 
                  name="Email" 
                  placeholder="Enter your email"
                  value={form.Email} 
                  onChange={handleChange} 
                  required 
                  autoComplete="email" 
                />

                <label>Password</label>
                <input 
                  type="password" 
                  name="Password" 
                  placeholder="Enter your password"
                  value={form.Password} 
                  onChange={handleChange} 
                  required 
                  autoComplete="current-password" 
                />

                <label>Secret Code</label>
                <input 
                  name="SecretCode" 
                  placeholder="Enter secret code"
                  value={form.SecretCode} 
                  onChange={handleChange} 
                  autoComplete="one-time-code" 
                />

                <button className="auth-btn" type="submit" disabled={loading}>
                  {loading ? 'Signing in...' : 'Login'}
                </button>
              </form>

              <div className="member-link-section">
                <span>Are you a </span>
                <Link to="/MemberLogin" className="highlight-link">Member</Link>
                <span>?</span>
              </div>
            </div>

            <Link to="/public-articles" className="view-articles-btn">
              VIEW OUR ARTICLES
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StaffLogin