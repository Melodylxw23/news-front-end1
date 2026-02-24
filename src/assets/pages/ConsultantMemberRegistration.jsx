import React, { useState, useEffect } from 'react'
import AuthLayout from './AuthLayout'
import Toast from '../components/Toast'
import { Link, useNavigate } from 'react-router-dom'

function ConsultantMemberRegistration() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    CompanyName: '',
    ContactPerson: '',
    Email: '',
    WeChatWorkId: '',
    Country: '',
    CompanySize: '',
    IndustryTagId: '',
    PreferredLanguage: 'EN',
    PreferredChannel: 'Email',
    MembershipType: 'Local'
  })
  const [toastMsg, setToastMsg] = useState(null)
  const [toastType, setToastType] = useState('info')
  const [loading, setLoading] = useState(false)
  const [industries, setIndustries] = useState([])
  const [countries, setCountries] = useState([])

  // Fetch industries on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch industries
        const industryRes = await fetch('/api/IndustryTags')
        if (industryRes.ok) {
          const industryData = await industryRes.json()
          const industryList = industryData?.data || []
          setIndustries(industryList)
        }
      } catch (err) {
        console.error('Error fetching data:', err)
      }
    }
    fetchData()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setToastMsg(null)
    setLoading(true)

    try {
      // Get token from localStorage for consultant authentication
      const token = localStorage.getItem('token')
      if (!token) {
        setToastMsg('You must be logged in as a consultant to register members.')
        setToastType('error')
        setLoading(false)
        return
      }

      // Prepare the payload matching RegisterMemberByConsultantDTO
      const payload = {
        CompanyName: form.CompanyName,
        ContactPerson: form.ContactPerson,
        Email: form.Email,
        WeChatWorkId: form.WeChatWorkId || null,
        Country: form.Country,
        CompanySize: parseInt(form.CompanySize),
        IndustryTagId: parseInt(form.IndustryTagId),
        PreferredLanguage: form.PreferredLanguage,
        PreferredChannel: form.PreferredChannel,
        MembershipType: form.MembershipType
      }

      const res = await fetch('/api/UserControllers/register-member', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      const text = await res.text()
      if (!res.ok) {
        setToastMsg(text || 'Member registration failed')
        setToastType('error')
      } else {
        setToastMsg('Member registered successfully!')
        setToastType('success')
        // Reset form
        setForm({
          CompanyName: '',
          ContactPerson: '',
          Email: '',
          WeChatWorkId: '',
          Country: '',
          CompanySize: '',
          IndustryTagId: '',
          PreferredLanguage: 'EN',
          PreferredChannel: 'Email',
          MembershipType: 'Local'
        })
        // Redirect after success
        setTimeout(() => {
          navigate('/consultant/members', { 
            state: { message: 'Member registered successfully.' } 
          })
        }, 2000)
      }
    } catch (err) {
      setToastMsg('Network error: ' + err.message)
      setToastType('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Register Member">
      <div className="register-scroll">
        <Toast message={toastMsg} type={toastType} onClose={() => setToastMsg(null)} />
        <form onSubmit={handleSubmit}>
          <label>Company Name *</label>
          <input 
            name="CompanyName" 
            value={form.CompanyName} 
            onChange={handleChange} 
            required 
            maxLength="100"
            placeholder="Enter company name"
          />

          <label>Contact Person *</label>
          <input 
            name="ContactPerson" 
            value={form.ContactPerson} 
            onChange={handleChange} 
            required 
            maxLength="50"
            placeholder="Enter contact person name"
          />

          <label>Email *</label>
          <input 
            type="email" 
            name="Email" 
            value={form.Email} 
            onChange={handleChange} 
            required 
            placeholder="Enter member email"
          />

          <label>WeChat / Work ID</label>
          <input 
            name="WeChatWorkId" 
            value={form.WeChatWorkId} 
            onChange={handleChange} 
            placeholder="Optional WeChat or Work ID"
          />

          <label>Country *</label>
          <input 
            type="text" 
            name="Country" 
            value={form.Country} 
            onChange={handleChange} 
            required 
            placeholder="Enter country name (e.g., China, Singapore)"
          />

          <label>Company Size *</label>
          <select 
            name="CompanySize" 
            value={form.CompanySize} 
            onChange={handleChange} 
            required
          >
            <option value="">Select Company Size</option>
            <option value="1">1 - 10 employees</option>
            <option value="2">11 - 50 employees</option>
            <option value="3">51 - 200 employees</option>
            <option value="4">201 - 500 employees</option>
            <option value="5">500+ employees</option>
          </select>

          <label>Industry *</label>
          <select 
            name="IndustryTagId" 
            value={form.IndustryTagId} 
            onChange={handleChange} 
            required
          >
            <option value="">Select Industry</option>
            {industries.map(industry => (
              <option 
                key={industry.industryTagId || industry.IndustryTagId} 
                value={industry.industryTagId || industry.IndustryTagId}
              >
                {industry.nameEN || industry.NameEN}
              </option>
            ))}
          </select>

          <label>Preferred Language *</label>
          <select 
            name="PreferredLanguage" 
            value={form.PreferredLanguage} 
            onChange={handleChange}
          >
            <option value="EN">English</option>
            <option value="ZH">中文 (Chinese)</option>
          </select>

          <label>Preferred Channel*</label>
          <select 
            name="PreferredChannel" 
            value={form.PreferredChannel} 
            onChange={handleChange}
          >
            <option value="Email">Email</option>
            <option value="SMS">SMS</option>
            <option value="WeChat">WeChat</option>
          </select>

          <label>Membership Type *</label>
          <select 
            name="MembershipType" 
            value={form.MembershipType} 
            onChange={handleChange}
          >
            <option value="Local">Local</option>
            <option value="Overseas">Overseas</option>
          </select>

          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? 'Registering...' : 'Register Member'}
          </button>
        </form>
        <div className="auth-footer">
          <div style={{ opacity: 0.9 }}><Link to="/landing">Back to Dashboard</Link></div>
        </div>
      </div>
    </AuthLayout>
  )
}

export default ConsultantMemberRegistration