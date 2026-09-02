import { useEffect, useState } from 'react'
import type { Project } from './types'
import ProjectForm from './components/ProjectForm'
import ProjectCreated from './components/ProjectCreated'
import TeammateOnboarding from './components/TeammateOnboarding'
import './index.css'

type HealthStatus = 'checking' | 'online' | 'offline'
type View = 'landing' | 'form' | 'created' | 'onboarding'

function App() {
  const [health, setHealth] = useState<HealthStatus>('checking')
  const [view, setView] = useState<View>('landing')
  const [createdProject, setCreatedProject] = useState<Project | null>(null)
  const [provisionResult, setProvisionResult] = useState<any>(null)
  const [selectedTeammateId, setSelectedTeammateId] = useState<number | null>(null)

  // Parse initial hash route or handle hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash
      const matchTeammate = hash.match(/#\/?teammate\/(\d+)/)
      if (matchTeammate) {
        const id = parseInt(matchTeammate[1], 10)
        setSelectedTeammateId(id)
        setView('onboarding')
      }
    }

    handleHashChange()
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

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

  const handleProjectCreated = (project: Project, result?: any) => {
    setCreatedProject(project)
    setProvisionResult(result || null)
    setView('created')
    window.location.hash = ''
  }

  const handleCreateAnother = () => {
    setCreatedProject(null)
    setProvisionResult(null)
    setSelectedTeammateId(null)
    setView('form')
    window.location.hash = ''
  }

  const handleSelectTeammate = (teammateId: number) => {
    setSelectedTeammateId(teammateId)
    setView('onboarding')
    window.location.hash = `#/teammate/${teammateId}`
  }

  const handleBackFromOnboarding = () => {
    window.location.hash = ''
    if (createdProject) {
      setView('created')
    } else {
      setView('landing')
    }
  }

  return (
    <>
      <nav className="nav" id="main-nav">
        <div
          className="nav-brand"
          onClick={() => {
            window.location.hash = ''
            setView('landing')
          }}
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
            <div className="version">v0.1.0 · phase 3</div>
          </div>
        )}

        {view === 'form' && (
          <ProjectForm onSuccess={handleProjectCreated} />
        )}

        {view === 'created' && createdProject && (
          <ProjectCreated
            project={createdProject}
            provisionResult={provisionResult}
            onCreateAnother={handleCreateAnother}
            onSelectTeammate={handleSelectTeammate}
          />
        )}

        {view === 'onboarding' && selectedTeammateId && (
          <TeammateOnboarding
            teammateId={selectedTeammateId}
            onBack={handleBackFromOnboarding}
          />
        )}
      </main>
    </>
  )
}

export default App
