import React from 'react'
import logo from '../logo.png'

export default function AuthLayout({ title, children, leftTitle = 'SinoStream', leftLead = 'Your personal, continuous stream of curated English & Chinese news.' }) {
  const leftStyle = {
    backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%), url(${logo})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center left',
    backgroundRepeat: 'no-repeat',
    filter: 'brightness(1.12)'
  }

  return (
    <div className="auth-page">
      <div className="cards-container">
        <div className="logo-card" style={leftStyle} role="img" aria-label="SinoStream logo">
          <div className="logo-card-inner">
            {/* Large image is background; small caption/text below if desired */}
            <div className="logo-caption">
              <h1>{leftTitle}</h1>
              <p className="lead">Be on the wave</p>
            </div>
          </div>
        </div>

        <div className="divider" aria-hidden="true" />

        <div className="form-card">
          <div className="form-content">
            <h2>{title}</h2>
            <div className="auth-form">{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
