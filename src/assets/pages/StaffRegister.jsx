import React, { useState } from 'react'
import AuthLayout from './AuthLayout'
import { Link } from 'react-router-dom'

function StaffRegister() {
  const [form, setForm] = useState({
    Name: '',
    Email: '',
    Password: '',
    ConfirmPassword: '',
    WeChatWorkId: '',
    SecretCode: ''
  })
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage(null)
    setLoading(true)
    try {
      const res = await fetch('/api/UserControllers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const text = await res.text()
      if (!res.ok) setMessage(text || 'Registration failed')
      else {
        setMessage('Staff registration successful.')
        setForm({ Name: '', Email: '', Password: '', ConfirmPassword: '', WeChatWorkId: '', SecretCode: '' })
      }
    } catch (err) {
      setMessage('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Staff Registration">
      {message && <div style={{ marginBottom: 12 }}>{message}</div>}
      <form onSubmit={handleSubmit}>
        <label>Name</label>
        <input name="Name" value={form.Name} onChange={handleChange} required />

        <label>Email</label>
        <input type="email" name="Email" value={form.Email} onChange={handleChange} required />

        <label>WeChat / Work ID</label>
        <input name="WeChatWorkId" value={form.WeChatWorkId} onChange={handleChange} />

        <label>Password</label>
        <input type="password" name="Password" value={form.Password} onChange={handleChange} required />

        <label>Confirm Password</label>
        <input type="password" name="ConfirmPassword" value={form.ConfirmPassword} onChange={handleChange} required />

        <label>Secret Code</label>
        <input name="SecretCode" value={form.SecretCode} onChange={handleChange} required />

        <button className="auth-btn" type="submit" disabled={loading}>{loading ? 'Registering...' : 'Register'}</button>
      </form>
      <div className="auth-footer">
        <div style={{ opacity: 0.9 }}><Link to="/StaffLogin">Back to Staff Login</Link></div>
        <div style={{ opacity: 0.9 }}><Link to="/MemberLogin">Member Login</Link></div>
      </div>
    </AuthLayout>
  )
}

export default StaffRegister
