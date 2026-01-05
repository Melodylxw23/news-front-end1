import React, { useState, useEffect } from 'react'
import AuthLayout from './AuthLayout'
import { Link } from 'react-router-dom'

function Register() {
  const [form, setForm] = useState({
    CompanyName: '',
    ContactPerson: '',
    Email: '',
    WeChatWorkId: '',
    Country: '',
    IndustryTagId: '', // Add industry field
    PreferredLanguage: '',
    PreferredChannel: '',
    MembershipType: '',
    Password: '',
    ConfirmPassword: ''
  })
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [industries, setIndustries] = useState([]) // Store industries from backend

  // Fetch industries on component mount
  useEffect(() => {
    const fetchIndustries = async () => {
      try {
        const res = await fetch('/api/IndustryTags')
        if (res.ok) {
          const data = await res.json()
          setIndustries(data?.data || [])
        }
      } catch (err) {
        console.error('Error fetching industries:', err)
      }
    }
    fetchIndustries()
  }, [])

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
          IndustryTagId: '',
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
          <input type="email" name="Email" value={form.Email} onChange={handleChange} required autoComplete="email" />

          <label>WeChat / Work ID</label>
          <input name="WeChatWorkId" value={form.WeChatWorkId} onChange={handleChange} />

          <label>Country</label>
          <input name="Country" value={form.Country} onChange={handleChange} />

          <label>Industry</label>
          <select name="IndustryTagId" value={form.IndustryTagId} onChange={handleChange} required>
            <option value="">Select Industry</option>
            {industries.map(industry => (
              <option key={industry.industryTagId} value={industry.industryTagId}>
                {industry.name}
              </option>
            ))}
          </select>

          <label>Preferred Language</label>
          <input name="PreferredLanguage" value={form.PreferredLanguage} onChange={handleChange} />

          <label>Preferred Channel</label>
          <input name="PreferredChannel" value={form.PreferredChannel} onChange={handleChange} />

          <label>Membership Type</label>
          <input name="MembershipType" value={form.MembershipType} onChange={handleChange} />

          <label>Password</label>
          <input type="password" name="Password" value={form.Password} onChange={handleChange} required autoComplete="new-password" />

          <label>Confirm Password</label>
          <input type="password" name="ConfirmPassword" value={form.ConfirmPassword} onChange={handleChange} required autoComplete="new-password" />

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
