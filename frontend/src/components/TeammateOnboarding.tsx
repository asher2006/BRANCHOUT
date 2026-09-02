import { useEffect, useState } from 'react'
import type { Project, Teammate } from '../types'
import { generateClientMasterPrompt } from '../utils/promptTemplate'

interface TeammateOnboardingProps {
  teammateId: number
  onBack?: () => void
}

export default function TeammateOnboarding({ teammateId, onBack }: TeammateOnboardingProps) {
  const [teammate, setTeammate] = useState<Teammate | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [allTeammates, setAllTeammates] = useState<Teammate[]>([])
  const [masterPrompt, setMasterPrompt] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [copiedCmd, setCopiedCmd] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  useEffect(() => {
    const fetchTeammate = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/teammates/${teammateId}`)
        if (!res.ok) {
          throw new Error('Teammate not found')
        }
        const data = await res.json()
        setTeammate(data.teammate)
        setProject(data.project)
        setAllTeammates(data.allTeammates || [])
        setMasterPrompt(data.masterPrompt || generateClientMasterPrompt(data.project, data.teammate, data.allTeammates || []))
      } catch (err: any) {
        setError(err.message || 'Failed to load onboarding info')
      } finally {
        setLoading(false)
      }
    }

    fetchTeammate()
  }, [teammateId])

  const handleCopyPrompt = () => {
    if (!masterPrompt) return
    navigator.clipboard.writeText(masterPrompt)
    setCopiedPrompt(true)
    setTimeout(() => setCopiedPrompt(false), 2500)
  }

  const handleDownloadPrompt = () => {
    if (!masterPrompt || !teammate) return
    const blob = new Blob([masterPrompt], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `MASTER_PROMPT_${teammate.github_username}.md`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleCopyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd)
    setCopiedCmd(true)
    setTimeout(() => setCopiedCmd(false), 2000)
  }

  const handleStatusChange = async (newStatus: 'not_started' | 'in_progress' | 'done') => {
    if (!teammate) return
    setUpdatingStatus(true)
    try {
      const res = await fetch(`/api/teammates/${teammate.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setTeammate({ ...teammate, status: newStatus })
      }
    } catch (e) {
      console.error('Failed to update status:', e)
    } finally {
      setUpdatingStatus(false)
    }
  }

  if (loading) {
    return (
      <div className="onboarding-loading">
        <span className="spinner" />
        <span className="mono">Loading onboarding briefing...</span>
      </div>
    )
  }

  if (error || !teammate || !project) {
    return (
      <div className="onboarding-error error-banner">
        <p>{error || 'Teammate not found'}</p>
        {onBack && (
          <button className="btn btn-small" onClick={onBack} style={{ marginTop: '12px' }}>
            ← Back
          </button>
        )}
      </div>
    )
  }

  const otherTeammates = allTeammates.filter(t => t.id !== teammate.id)
  const repoUrl = project.github_repo_url || '#'
  const branchUrl = repoUrl !== '#' ? `${repoUrl}/tree/${teammate.branch_name}` : '#'
  const gitSetupCmd = `git fetch origin && git checkout ${teammate.branch_name}`

  return (
    <div className="onboarding-page" id="onboarding-view">
      {/* ---- Breadcrumb / Header ---- */}
      <div className="onboarding-header">
        {onBack && (
          <button className="btn btn-icon btn-back" onClick={onBack} title="Back to Project">
            ←
          </button>
        )}
        <div className="onboarding-title-group">
          <div className="onboarding-breadcrumbs mono">
            <span>{project.name}</span>
            <span className="breadcrumb-sep">/</span>
            <span className="accent-text">@{teammate.github_username}</span>
          </div>
          <h1>{teammate.name}'s Onboarding Briefing</h1>
        </div>

        {/* Self-reported status picker */}
        <div className="status-picker-group">
          <span className="field-label">My Status:</span>
          <div className="status-buttons">
            <button
              type="button"
              className={`status-btn ${teammate.status === 'not_started' ? 'active not-started' : ''}`}
              onClick={() => handleStatusChange('not_started')}
              disabled={updatingStatus}
            >
              Not Started
            </button>
            <button
              type="button"
              className={`status-btn ${teammate.status === 'in_progress' ? 'active in-progress' : ''}`}
              onClick={() => handleStatusChange('in_progress')}
              disabled={updatingStatus}
            >
              In Progress
            </button>
            <button
              type="button"
              className={`status-btn ${teammate.status === 'done' ? 'active done' : ''}`}
              onClick={() => handleStatusChange('done')}
              disabled={updatingStatus}
            >
              Done ✓
            </button>
          </div>
        </div>
      </div>

      {/* ---- Assigned Branch Card ---- */}
      <section className="form-section onboarding-card" id="branch-setup-card">
        <h2 className="section-title">
          <span className="section-icon mono">🌿</span>
          Assigned Git Branch
        </h2>
        <div className="branch-card-details">
          <div className="branch-meta-row">
            <div>
              <span className="field-label">Your Branch</span>
              <div className="branch-link-row">
                <a
                  href={branchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="branch-name mono"
                  id="teammate-branch-link"
                >
                  {teammate.branch_name} ↗
                </a>
              </div>
            </div>
            {repoUrl !== '#' && (
              <a
                href={repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-small"
              >
                View Repository ↗
              </a>
            )}
          </div>

          <div className="git-cmd-box">
            <span className="field-label">Checkout in your local IDE terminal:</span>
            <div className="copy-cmd-row" style={{ marginTop: '4px' }}>
              <code className="cmd-box mono">{gitSetupCmd}</code>
              <button
                type="button"
                className="btn btn-small btn-primary"
                onClick={() => handleCopyCommand(gitSetupCmd)}
              >
                {copiedCmd ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Assigned Task & Owned Paths ---- */}
      <section className="form-section onboarding-card" id="task-paths-card">
        <h2 className="section-title">
          <span className="section-icon mono">🎯</span>
          Your Scope & Owned Paths
        </h2>
        <div className="scope-details">
          <div className="scope-block">
            <span className="field-label">Task Objective</span>
            <p className="task-desc-text">{teammate.task_description || 'Implement your assigned module.'}</p>
          </div>

          <div className="scope-block">
            <span className="field-label">Your Owned Paths (Full Authority)</span>
            {teammate.owned_paths.length > 0 ? (
              <div className="path-tags" style={{ marginTop: '6px' }}>
                {teammate.owned_paths.map((p, i) => (
                  <span key={i} className="path-tag mono">{p}</span>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ fontSize: '0.8125rem' }}>No exclusive paths assigned. Focus on your task module.</p>
            )}
          </div>
        </div>
      </section>

      {/* ---- AI Master Prompt (Hero Section) ---- */}
      <section className="form-section onboarding-card hero-prompt-section" id="master-prompt-card">
        <div className="prompt-section-header">
          <div>
            <h2 className="section-title" style={{ border: 'none', paddingBottom: '2px' }}>
              <span className="section-icon mono">🤖</span>
              Your Ready-to-Paste Master Prompt
            </h2>
            <p className="section-description">
              Hand this complete prompt to your coding agent (Claude Code, Cursor, Windsurf) in your IDE.
            </p>
          </div>

          <div className="prompt-action-buttons">
            <button
              type="button"
              className="btn btn-primary btn-copy-hero"
              onClick={handleCopyPrompt}
              id="copy-prompt-btn"
            >
              {copiedPrompt ? '✓ Copied to Clipboard!' : '📋 Copy Master Prompt'}
            </button>
            <button
              type="button"
              className="btn btn-small"
              onClick={handleDownloadPrompt}
              id="download-prompt-btn"
            >
              ⬇ Download .md
            </button>
          </div>
        </div>

        <div className="prompt-viewer-container">
          <pre className="prompt-viewer mono">{masterPrompt}</pre>
        </div>
      </section>

      {/* ---- Team Boundaries & Isolation Rules ---- */}
      {otherTeammates.length > 0 && (
        <section className="form-section onboarding-card" id="team-boundaries-card">
          <h2 className="section-title">
            <span className="section-icon mono">⛔</span>
            Team Boundaries & Isolation Rules
          </h2>
          <p className="section-description">
            To prevent merge conflicts, do not edit files owned by your teammates:
          </p>

          <div className="other-teammates-grid">
            {otherTeammates.map((other) => (
              <div key={other.id} className="other-tm-card">
                <div className="other-tm-header">
                  <strong>{other.name}</strong>{' '}
                  <span className="mono muted">@{other.github_username}</span>
                </div>
                <div className="other-tm-branch mono">{other.branch_name}</div>
                <div className="other-tm-paths">
                  {other.owned_paths.length > 0 ? (
                    other.owned_paths.map((p, i) => (
                      <span key={i} className="path-tag mono" style={{ fontSize: '0.6875rem' }}>{p}</span>
                    ))
                  ) : (
                    <span className="muted" style={{ fontSize: '0.75rem' }}>No exclusive paths</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
