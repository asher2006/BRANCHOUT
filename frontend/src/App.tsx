import { useEffect, useState } from 'react'
import type { Project } from './types'
import ProjectForm from './components/ProjectForm'
import ProjectCreated from './components/ProjectCreated'
import TeammateOnboarding from './components/TeammateOnboarding'
import ContributionDashboard from './components/ContributionDashboard'
import DataPixelArc from './components/DataPixelArc'
import './index.css'

type HealthStatus = 'checking' | 'online' | 'offline'
type View = 'landing' | 'form' | 'created' | 'onboarding' | 'dashboard'

function App() {
  const [health, setHealth] = useState<HealthStatus>('checking')
  const [view, setView] = useState<View>('landing')
  const [createdProject, setCreatedProject] = useState<Project | null>(null)
  const [provisionResult, setProvisionResult] = useState<any>(null)
  const [selectedTeammateId, setSelectedTeammateId] = useState<number | null>(null)
  const [activeDashboardProjectId, setActiveDashboardProjectId] = useState<number | null>(null)

  // Parse initial hash route or handle hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash
      const matchTeammate = hash.match(/#\/?teammate\/(\d+)/)
      if (matchTeammate) {
        const id = parseInt(matchTeammate[1], 10)
        setSelectedTeammateId(id)
        setView('onboarding')
        return
      }

      const matchDashboard = hash.match(/#\/?dashboard(?:\/(\d+))?/)
      if (matchDashboard) {
        const id = matchDashboard[1] ? parseInt(matchDashboard[1], 10) : 1
        setActiveDashboardProjectId(id)
        setView('dashboard')
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
    setActiveDashboardProjectId(project.id)
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

  const handleViewDashboard = (projectId: number) => {
    setActiveDashboardProjectId(projectId)
    setView('dashboard')
    window.location.hash = `#/dashboard/${projectId}`
  }

  const handleBackFromOnboarding = () => {
    if (activeDashboardProjectId) {
      setView('dashboard')
      window.location.hash = `#/dashboard/${activeDashboardProjectId}`
    } else if (createdProject) {
      setView('created')
      window.location.hash = ''
    } else {
      setView('landing')
      window.location.hash = ''
    }
  }

  return (
    <div className="app-container">
      <DataPixelArc
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          minWidth: 0,
          minHeight: 0,
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      <div className="app-content">
        <nav className="nav" id="main-nav">
        <div className="nav-left">
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

          <div className="nav-links">
            <button
              type="button"
              className={`nav-link ${view === 'form' ? 'active' : ''}`}
              onClick={() => {
                window.location.hash = ''
                setView('form')
              }}
            >
              + New Brief
            </button>
            <button
              type="button"
              className={`nav-link ${view === 'dashboard' ? 'active' : ''}`}
              onClick={() => {
                const targetId = activeDashboardProjectId || createdProject?.id || 1
                handleViewDashboard(targetId)
              }}
              id="nav-dashboard-link"
            >
              📊 Live Dashboard
            </button>
          </div>
        </div>

        <div className="nav-status">
          <span className={`status-dot ${health}`} />
          <span>{statusLabel[health]}</span>
        </div>
      </nav>

      <main className={`main ${view !== 'landing' ? 'main-top' : ''}`} id="main-content">
        {view === 'landing' && (
          <div className="landing-hero" id="landing-hero">
            <div className="hero-glow" />

            <div className="hero-content">
              <div className="hero-badge mono">OPEN SOURCE · HACKATHON TOOLKIT</div>
              <h1 className="hero-title">
                <span className="hero-prompt mono">&gt;_</span>{' '}
                <span className="typing-text">branchout</span>
                <span className="cursor-block" />
              </h1>
              <p className="hero-subtitle">
                Paste your repo, describe your idea, and let AI divide work into
                zero-conflict branches — so every teammate codes independently and
                merges cleanly into <code>main</code>.
              </p>

              <div className="landing-actions-row">
                <button
                  className="btn btn-primary btn-cta"
                  onClick={() => setView('form')}
                  id="start-btn"
                >
                  Create a project
                </button>
                <button
                  className="btn btn-secondary btn-cta"
                  onClick={() => handleViewDashboard(1)}
                  id="landing-dashboard-btn"
                >
                  📊 View Live Dashboard
                </button>
              </div>
            </div>

            <div className="feature-cards">
              <div className="feature-card">
                <div className="feature-icon">🔗</div>
                <h3>Paste Repo</h3>
                <p>Connect your newly created GitHub repository in a single step. Branchout auto-detects the project name.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🤖</div>
                <h3>AI Divides Work</h3>
                <p>Describe your idea and AI splits it into non-overlapping tasks, owned paths, and dedicated branches.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🚀</div>
                <h3>Push & Merge</h3>
                <p>Each teammate works on their branch, pushes changes, and opens a PR to merge into <code>main</code>.</p>
              </div>
            </div>

            <div className="version mono">v1.0.0</div>
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
            onViewDashboard={handleViewDashboard}
          />
        )}

        {view === 'onboarding' && selectedTeammateId && (
          <TeammateOnboarding
            teammateId={selectedTeammateId}
            onBack={handleBackFromOnboarding}
          />
        )}

        {view === 'dashboard' && (
          <ContributionDashboard
            projectId={activeDashboardProjectId || createdProject?.id || 1}
            onViewOnboarding={handleSelectTeammate}
            onBackToProjects={() => setView('landing')}
          />
        )}
      </main>
      </div>
    </div>
  )
}

export default App
