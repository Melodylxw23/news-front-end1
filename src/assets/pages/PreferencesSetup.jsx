import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import SelectTopicsOfInterest from './SelectTopicsOfInterest'
import NotificationFrequency from './NotificationFrequency'
import NotificationPreferences from './NotificationPreferences'

export default function PreferencesSetup() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1=Topics, 2=Frequency, 3=Channels
  const [allPreferencesComplete, setAllPreferencesComplete] = useState(false)

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token')
    if (!token) {
      console.log('[PreferencesSetup] No token found, redirecting to login')
      navigate('/MemberLogin')
      return
    }
    console.log('[PreferencesSetup] User is logged in, showing preferences setup')
  }, [navigate])

  const handleTopicsComplete = () => {
    console.log('[PreferencesSetup] Topics step completed, moving to frequency')
    setStep(2)
  }

  const handleFrequencyComplete = () => {
    console.log('[PreferencesSetup] Frequency step completed, moving to channels')
    setStep(3)
  }

  const handleChannelsComplete = () => {
    console.log('[PreferencesSetup] All preferences setup complete!')
    setAllPreferencesComplete(true)
    // Redirect to articles after a short delay
    setTimeout(() => {
      navigate('/member/articles')
    }, 1500)
  }

  // Progress bar component
  const ProgressBar = () => (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '4px',
      background: '#e5e7eb',
      zIndex: 1000
    }}>
      <div style={{
        height: '100%',
        background: '#b91c1c',
        width: `${(step / 3) * 100}%`,
        transition: 'width 0.3s ease'
      }} />
    </div>
  )

  // Success overlay
  const SuccessOverlay = () => (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '12px',
        textAlign: 'center',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
        <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#1f2a37', marginBottom: '12px' }}>
          Preferences Set Up Complete!
        </h2>
        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>
          Redirecting to your articles...
        </p>
      </div>
    </div>
  )

  return (
    <div>
      <ProgressBar />
      {allPreferencesComplete && <SuccessOverlay />}
      
      {/* Step 1: Topics */}
      {step === 1 && (
        <SelectTopicsOfInterest onComplete={handleTopicsComplete} />
      )}

      {/* Step 2: Frequency */}
      {step === 2 && (
        <NotificationFrequency onComplete={handleFrequencyComplete} />
      )}

      {/* Step 3: Channels */}
      {step === 3 && (
        <NotificationPreferences onComplete={handleChannelsComplete} />
      )}
    </div>
  )
}
