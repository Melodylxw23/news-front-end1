import React, { useState } from 'react'
import AuthLayout from './AuthLayout'
import { Link } from 'react-router-dom'

function Register() {
  const [form, setForm] = useState({
    CompanyName: '',
    ContactPerson: '',
    Email: '',
    WeChatWorkId: '',
    Country: '',
    PreferredLanguage: '',
    PreferredChannel: '',
    MembershipType: '',
    Password: '',
    ConfirmPassword: ''
  })
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage(null)
    setLoading(true)
    try {
      const res = await fetch('/api/UserControllers/register-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })

      const text = await res.text()
      if (!res.ok) {
        setMessage(text || 'Registration failed')
      } else {
        setMessage('Registration successful. You can now log in.')
        setForm({
          CompanyName: '',
          ContactPerson: '',
          Email: '',
          WeChatWorkId: '',
          Country: '',
          PreferredLanguage: '',
          PreferredChannel: '',
          MembershipType: '',
          Password: '',
          ConfirmPassword: ''
        })
      }
    } catch (err) {
      setMessage('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Member Registration">
      <div className="register-scroll">
        {message && <div style={{ marginBottom: 12 }}>{message}</div>}
        <form onSubmit={handleSubmit}>
          <label>Company Name</label>
          <input name="CompanyName" value={form.CompanyName} onChange={handleChange} required />

          <label>Contact Person</label>
          <input name="ContactPerson" value={form.ContactPerson} onChange={handleChange} required />

          <label>Email</label>
          <input type="email" name="Email" value={form.Email} onChange={handleChange} required />

          <label>WeChat / Work ID</label>
          <input name="WeChatWorkId" value={form.WeChatWorkId} onChange={handleChange} />

          <label>Country</label>
          <input name="Country" value={form.Country} onChange={handleChange} />

          <label>Preferred Language</label>
          <input name="PreferredLanguage" value={form.PreferredLanguage} onChange={handleChange} />

          <label>Preferred Channel</label>
          <input name="PreferredChannel" value={form.PreferredChannel} onChange={handleChange} />

          <label>Membership Type</label>
          <input name="MembershipType" value={form.MembershipType} onChange={handleChange} />

          <label>Password</label>
          <input type="password" name="Password" value={form.Password} onChange={handleChange} required />

          <label>Confirm Password</label>
          <input type="password" name="ConfirmPassword" value={form.ConfirmPassword} onChange={handleChange} required />

          <button className="auth-btn" type="submit" disabled={loading}>{loading ? 'Registering...' : 'Register'}</button>
        </form>
        <div className="auth-footer">
          <div style={{ opacity: 0.9 }}><Link to="/MemberLogin">Back to Login</Link></div>
          <div style={{ opacity: 0.9 }}><Link to="/StaffRegister">Are you internal staff?</Link></div>
        </div>
      </div>
    </AuthLayout>
  )
}

export default Register
