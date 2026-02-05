import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getRoleFromToken, getNameFromToken } from '../../utils/auth'
import logo from '../logo.png'
import sccciBuilding from '../sccci_building.png'

function MemberLogin({ onLoginSuccess }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({ Email: '', Password: '' })
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
      const res = await fetch('/api/UserControllers/login', {
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

        // Prefer role from token claims if available
        const roleFromToken = getRoleFromToken(token)
        const nameFromToken = getNameFromToken(token)
        if (roleFromToken) {
          localStorage.setItem('role', roleFromToken)
          if (nameFromToken) localStorage.setItem('name', nameFromToken)
          if (onLoginSuccess) onLoginSuccess(roleFromToken)
          
          // Navigate to articles page for members
          if (roleFromToken.toLowerCase() === 'member') {
            if (localStorage.getItem('needsPreferencesSetup') === 'true') {
              localStorage.removeItem('needsPreferencesSetup')
              navigate('/setup-preferences')
              return
            }
            navigate('/member/articles')
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
              
              // Navigate to articles page for members
              if (determined === 'member') {
                if (localStorage.getItem('needsPreferencesSetup') === 'true') {
                  localStorage.removeItem('needsPreferencesSetup')
                  navigate('/setup-preferences')
                  return
                }
                navigate('/member/articles')
                return
              }
            } else {
              localStorage.setItem('role', 'member')
              if (onLoginSuccess) onLoginSuccess('member')
              navigate('/member/articles')
              return
            }
          } catch (err) {
            localStorage.setItem('role', 'member')
            if (onLoginSuccess) onLoginSuccess('member')
            navigate('/member/articles')
            return
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
              <h2>Member Login</h2>
              
              {/* Social Login Icons */}
              <div className="social-login-icons">
                <button className="social-icon-btn" title="Login with Google">
                  <svg viewBox="0 0 48 48" width="24" height="24">
                    <path fill="#887B76" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                  </svg>
                </button>
                <button className="social-icon-btn" title="Login with Apple">
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="#887B76" d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                </button>
                <button className="social-icon-btn" title="Login with Phone">
                  <svg viewBox="0 0 24 24" width="22" height="22">
                    <path fill="#887B76" d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/>
                  </svg>
                </button>
              </div>
              
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

                <button className="auth-btn" type="submit" disabled={loading}>
                  {loading ? 'Signing in...' : 'Login'}
                </button>
              </form>

              <div className="auth-footer">
                <Link to="/forgot-password" className="footer-link">Forgot Password?</Link>
                <Link to="/register" className="footer-link">Register a Member Account</Link>
              </div>

              <div className="staff-link-section">
                <span>Are you a </span>
                <Link to="/StaffLogin" className="highlight-link">Staff</Link>
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

export default MemberLogin