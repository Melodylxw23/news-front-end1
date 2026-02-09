import React from 'react'
import { Link } from 'react-router-dom'

function PublicArticles() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f5f5f5 0%, #ffffff 100%)',
      padding: '40px 20px'
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        padding: '60px 40px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        textAlign: 'center',
        maxWidth: '500px',
        width: '100%'
      }}>
        <h1 style={{
          fontSize: '32px',
          color: '#BA0006',
          marginBottom: '16px',
          fontWeight: '700'
        }}>
          Public Articles
        </h1>
        <p style={{
          fontSize: '16px',
          color: '#887B76',
          marginBottom: '32px',
          lineHeight: '1.6'
        }}>
          This page will display publicly available articles. Coming soon!
        </p>
        <Link 
          to="/MemberLogin"
          style={{
            display: 'inline-block',
            padding: '14px 32px',
            background: '#BA0006',
            color: '#FFFFFF',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: '600',
            fontSize: '14px',
            transition: 'background 0.2s'
          }}
        >
          Back to Login
        </Link>
      </div>
    </div>
  )
}

export default PublicArticles
