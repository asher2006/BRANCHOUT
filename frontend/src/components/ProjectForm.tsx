import { useState, useMemo } from 'react'
import type { TeammateInput, ProjectInput, Project, OwnershipConflict, BalanceWarning, ProvisionResult } from '../types'
import { checkOwnershipConflicts, checkWorkloadBalance } from '../utils/validation'
import TeammateRow from './TeammateRow'

const emptyTeammate = (): TeammateInput => ({
  name: '',
  github_username: '',
  task_description: '',
  owned_paths: [],
})

interface ProjectFormProps {
  onSuccess: (project: Project, provisionResult?: ProvisionResult) => void
}

export default function ProjectForm({ onSuccess }: ProjectFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [techStack, setTechStack] = useState('')
  const [conventions, setConventions] = useState('')
  const [teammates, setTeammates] = useState<TeammateInput[]>([emptyTeammate(), emptyTeammate()])
  
  // GitHub provisioning states
  const [githubPat, setGithubPat] = useState('')
  const [repoName, setRepoName] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [isDemo, setIsDemo] = useState(false)
  const [tokenTesting, setTokenTesting] = useState(false)
  const [tokenStatus, setTokenStatus] = useState<{ valid?: boolean; username?: string; error?: string } | null>(null)
  const [showPat, setShowPat] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [provisionProgress, setProvisionProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Live validation
  const conflicts: OwnershipConflict[] = useMemo(
    () => checkOwnershipConflicts(teammates),
    [teammates]
  )

  const balanceWarning: BalanceWarning | null = useMemo(
    () => checkWorkloadBalance(teammates),
    [teammates]
  )

  const updateTeammate = (index: number, updated: TeammateInput) => {
    setTeammates(prev => prev.map((t, i) => (i === index ? updated : t)))
  }

  const addTeammate = () => {
    setTeammates(prev => [...prev, emptyTeammate()])
  }

  const removeTeammate = (index: number) => {
    setTeammates(prev => prev.filter((_, i) => i !== index))
  }

  const handleTestToken = async () => {
    if (!githubPat.trim()) {
      setTokenStatus({ valid: false, error: 'Please enter a token first' })
      return
    }

    setTokenTesting(true)
    setTokenStatus(null)
    try {
      const res = await fetch('/api/github/validate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: githubPat.trim() }),
      })
      const data = await res.json()
      setTokenStatus(data)
    } catch (e: any) {
      setTokenStatus({ valid: false, error: e.message || 'Validation request failed' })
    } finally {
      setTokenTesting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Project name is required')
      return
    }

    const activeTeammates = teammates.filter(
      t => t.name.trim() && t.github_username.trim()
    )

    if (activeTeammates.length === 0) {
      setError('At least one teammate with name and GitHub username is required')
      return
    }

    setSubmitting(true)
    setProvisionProgress('Saving project brief to database...')

    try {
      const payload: ProjectInput = {
        name: name.trim(),
        description: description.trim(),
        tech_stack: techStack.trim(),
        shared_conventions: conventions.trim(),
        teammates: activeTeammates,
      }

      // 1. Create project in DB
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create project')
      }

      const project: Project = await res.json()

      // 2. Provision GitHub repository
      setProvisionProgress('Provisioning GitHub repository and cutting branches...')
      const provisionRes = await fetch(`/api/projects/${project.id}/provision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pat: githubPat.trim() || undefined,
          repoName: repoName.trim() || undefined,
          isPrivate,
          isDemo: isDemo || !githubPat.trim(),
        }),
      })

      if (provisionRes.ok) {
        const provisionResult: ProvisionResult = await provisionRes.json()
        project.github_repo_url = provisionResult.repoUrl
        onSuccess(project, provisionResult)
      } else {
        // Still proceed to success page even if provisioning had an issue
        onSuccess(project)
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
      setProvisionProgress(null)
    }
  }

  return (
    <form className="project-form" onSubmit={handleSubmit} id="project-form">
      <div className="form-header">
        <h1>New project brief</h1>
        <p className="form-subtitle">
          Define your project, set shared conventions, and auto-provision GitHub branches.
        </p>
      </div>

      {/* ---- Project Details ---- */}
      <section className="form-section" id="project-details">
        <h2 className="section-title">
          <span className="section-icon mono">01</span>
          Project
        </h2>

        <div className="field">
          <label htmlFor="project-name" className="field-label">Project name *</label>
          <input
            id="project-name"
            type="text"
            className="input"
            placeholder="hackathon-tracker"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (!repoName) {
                setRepoName(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))
              }
            }}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="project-description" className="field-label">Description</label>
          <textarea
            id="project-description"
            className="input textarea"
            placeholder="A tool that..."
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="project-tech-stack" className="field-label">Tech stack</label>
          <input
            id="project-tech-stack"
            type="text"
            className="input"
            placeholder="React, Node, PostgreSQL, Redis"
            value={techStack}
            onChange={(e) => setTechStack(e.target.value)}
          />
        </div>
      </section>

      {/* ---- Shared Conventions ---- */}
      <section className="form-section" id="conventions-section">
        <h2 className="section-title">
          <span className="section-icon mono">02</span>
          Shared conventions
        </h2>
        <p className="section-description">
          Coding standards, naming patterns, and project rules that every teammate should follow.
          This will be committed as <code>SHARED_CONVENTIONS.md</code> on the repository's <code>main</code> branch.
        </p>

        <div className="field">
          <label htmlFor="conventions" className="field-label">Conventions (markdown)</label>
          <textarea
            id="conventions"
            className="input textarea textarea-tall mono"
            placeholder={"# Conventions\n\n- Use TypeScript strict mode\n- Naming: camelCase for variables, PascalCase for components\n- All API routes start with /api/\n- Commit messages: type(scope): description"}
            rows={8}
            value={conventions}
            onChange={(e) => setConventions(e.target.value)}
          />
        </div>
      </section>

      {/* ---- Teammates ---- */}
      <section className="form-section" id="teammates-section">
        <h2 className="section-title">
          <span className="section-icon mono">03</span>
          Teammates
          <span className="badge">{teammates.length}</span>
        </h2>

        {/* Validation warnings */}
        {conflicts.length > 0 && (
          <div className="warning-banner" id="conflict-warning">
            <span className="warning-icon">⚠</span>
            <div>
              <strong>Ownership conflicts detected</strong>
              <ul className="warning-list">
                {conflicts.map((c, i) => (
                  <li key={i}>
                    <code>{c.path}</code> — claimed by {c.owners.join(' & ')}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {balanceWarning && (
          <div className="warning-banner warning-info" id="balance-warning">
            <span className="warning-icon">⚖</span>
            <div>
              <strong>{balanceWarning.message}</strong>
              <p>{balanceWarning.details}</p>
            </div>
          </div>
        )}

        <div className="teammates-list">
          {teammates.map((mate, i) => (
            <TeammateRow
              key={i}
              index={i}
              teammate={mate}
              onChange={updateTeammate}
              onRemove={removeTeammate}
              canRemove={teammates.length > 1}
            />
          ))}
        </div>

        <button
          type="button"
          className="btn btn-add-teammate"
          onClick={addTeammate}
          id="add-teammate-btn"
        >
          + Add teammate
        </button>
      </section>

      {/* ---- GitHub Provisioning Section ---- */}
      <section className="form-section" id="github-section">
        <h2 className="section-title">
          <span className="section-icon mono">04</span>
          GitHub Repository Provisioning
        </h2>
        <p className="section-description">
          Branchout will automatically create your GitHub repo, commit <code>SHARED_CONVENTIONS.md</code> to <code>main</code>, and cut one branch per teammate.
        </p>

        <div className="field">
          <div className="field-header-row">
            <label htmlFor="github-pat" className="field-label">GitHub Personal Access Token (PAT)</label>
            <span className="security-tag mono">🔒 Session only · Never persisted</span>
          </div>
          <div className="pat-input-container">
            <input
              id="github-pat"
              type={showPat ? "text" : "password"}
              className="input mono"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={githubPat}
              onChange={(e) => {
                setGithubPat(e.target.value)
                setTokenStatus(null)
              }}
            />
            <button
              type="button"
              className="btn btn-small"
              onClick={() => setShowPat(!showPat)}
              title={showPat ? "Hide token" : "Show token"}
            >
              {showPat ? "Hide" : "Show"}
            </button>
            <button
              type="button"
              className="btn btn-small btn-secondary"
              onClick={handleTestToken}
              disabled={tokenTesting || !githubPat.trim()}
              id="test-token-btn"
            >
              {tokenTesting ? "Testing..." : "Verify Token"}
            </button>
          </div>

          {tokenStatus && (
            <div className={`token-status-badge ${tokenStatus.valid ? 'token-valid' : 'token-invalid'}`}>
              {tokenStatus.valid ? (
                <span>✓ Authenticated with GitHub as <strong>@{tokenStatus.username}</strong></span>
              ) : (
                <span>✗ {tokenStatus.error}</span>
              )}
            </div>
          )}
        </div>

        <div className="field-row two-col">
          <div className="field">
            <label htmlFor="repo-name" className="field-label">Repository name</label>
            <input
              id="repo-name"
              type="text"
              className="input mono"
              placeholder="my-hackathon-repo"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
            />
          </div>
          <div className="field checkbox-field">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                id="is-private-checkbox"
              />
              <span>Create as Private Repository</span>
            </label>
            <label className="checkbox-label demo-toggle">
              <input
                type="checkbox"
                checked={isDemo}
                onChange={(e) => setIsDemo(e.target.checked)}
                id="is-demo-checkbox"
              />
              <span>Demo Mode (Simulate GitHub actions without real PAT)</span>
            </label>
          </div>
        </div>
      </section>

      {/* ---- Submit ---- */}
      {error && (
        <div className="error-banner" id="form-error">
          {error}
        </div>
      )}

      {provisionProgress && (
        <div className="progress-banner" id="provision-progress">
          <span className="spinner" />
          <span>{provisionProgress}</span>
        </div>
      )}

      <div className="form-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting}
          id="submit-btn"
        >
          {submitting ? 'Provisioning Repo...' : 'Create & Provision Repo'}
        </button>
        <span className="form-hint">
          {conflicts.length > 0 && '⚠ Conflicts present — you can still submit'}
        </span>
      </div>
    </form>
  )
}
