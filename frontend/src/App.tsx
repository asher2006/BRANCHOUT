import { useEffect, useState } from 'react'
import './index.css'

type HealthStatus = 'checking' | 'online' | 'offline'

function App() {
  const [health, setHealth] = useState<HealthStatus>('checking')

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health')
        if (res.ok) {
          setHealth('online')
        } else {
          setHealth('offline')
        }
      } catch {
        setHealth('offline')
      }
    }

    checkHealth()
    const interval = setInterval(checkHealth, 30_000)
    return () => clearInterval(interval)
  }, [])

  const statusLabel = {
    checking: 'connecting…',
    online: 'api connected',
    offline: 'api offline',
  }

  return (
    <>
      <nav className="nav" id="main-nav">
        <div className="nav-brand">
          <span className="prompt">&gt;_</span>
          <span>branchout</span>
        </div>
        <div className="nav-status">
          <span className={`status-dot ${health}`} />
          <span>{statusLabel[health]}</span>
        </div>
      </nav>

      <main className="main" id="main-content">
        <div className="shell-placeholder">
          <h1>
            <span className="mono">ready</span>
            <span className="cursor-block" />
          </h1>
          <p>
            Branchout coordinates hackathon teams — structured briefs,
            auto-provisioned branches, generated prompts, and live contribution
            tracking. Start by creating a project.
          </p>
          <div className="version">v0.1.0 · phase 0 · scaffolding</div>
        </div>
      </main>
    </>
  )
}

export default App
