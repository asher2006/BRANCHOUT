import { useEffect, useState } from 'react'
import type { Project } from './types'
import ProjectForm from './components/ProjectForm'
import ProjectCreated from './components/ProjectCreated'
import './index.css'

type HealthStatus = 'checking' | 'online' | 'offline'
type View = 'landing' | 'form' | 'created'

function App() {
  const [health, setHealth] = useState<HealthStatus>('checking')
  const [view, setView] = useState<View>('landing')
  const [createdProject, setCreatedProject] = useState<Project | null>(null)

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

  const handleProjectCreated = (project: Project) => {
    setCreatedProject(project)
    setView('created')
  }

  const handleCreateAnother = () => {
    setCreatedProject(null)
    setView('form')
  }

  return (
    <>
      <nav className="nav" id="main-nav">
        <div
          className="nav-brand"
          onClick={() => setView('landing')}
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
        >
          <span className="prompt">&gt;_</span>
          <span>branchout</span>
        </div>
        <div className="nav-status">
          <span className={`status-dot ${health}`} />
          <span>{statusLabel[health]}</span>
        </div>
      </nav>

      <main className={`main ${view !== 'landing' ? 'main-top' : ''}`} id="main-content">
        {view === 'landing' && (
          <div className="shell-placeholder">
            <h1>
              <span className="mono">ready</span>
              <span className="cursor-block" />
            </h1>
            <p>
              Branchout coordinates hackathon teams — structured briefs,
              auto-provisioned branches, generated prompts, and live contribution
              tracking.
            </p>
            <button
              className="btn btn-primary btn-cta"
              onClick={() => setView('form')}
              id="start-btn"
            >
              Create a project
            </button>
            <div className="version">v0.1.0 · phase 1</div>
          </div>
        )}

        {view === 'form' && (
          <ProjectForm onSuccess={handleProjectCreated} />
        )}

        {view === 'created' && createdProject && (
          <ProjectCreated
            project={createdProject}
            onCreateAnother={handleCreateAnother}
          />
        )}
      </main>
    </>
  )
}

export default App
