import React from 'react'

export const AdminLogo: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '0.25rem 0' }}>
      <span
        style={{
          fontSize: '1rem',
          fontWeight: 700,
          color: '#2e7d32',
          letterSpacing: '-0.01em',
          lineHeight: 1.2,
        }}
      >
        Pelangi Indonesia
      </span>
      <span
        style={{
          fontSize: '0.65rem',
          fontWeight: 500,
          color: '#4caf50',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        Rumah Psikologi
      </span>
    </div>
  )
}

export const AdminIcon: React.FC = () => {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #4caf50 0%, #1b5e20 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 700,
        fontSize: '0.85rem',
        letterSpacing: '-0.02em',
      }}
    >
      PI
    </div>
  )
}
