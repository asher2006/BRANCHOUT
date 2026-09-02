import { useState } from 'react'
import type { TeammateInput, ProjectInput, Project, ProvisionResult } from '../types'

interface ProjectFormProps {
  onSuccess: (project: Project, provisionResult?: ProvisionResult) => void
}

const PRESET_IDEAS = [
  {
    title: '🎨 Real-Time Collab Whiteboard',
    prompt: 'A real-time collaborative whiteboard app with live cursor tracking, voice channels, interactive canvas drawing, and persistent boards for hackathon teams.',
  },
  {
    title: '🤖 DevOps Incident Commander AI',
    prompt: 'An AI-powered DevOps agent that monitors cloud alerts, inspects container logs, diagnoses root causes, and suggests incident remediation scripts.',
  },
  {
    title: '🏃 Smart Health & Habit Tracker',
    prompt: 'A mobile-friendly wellness and habit tracker that logs daily routines, provides AI coaching insights, and gamifies team fitness challenges.',
  },
  {
    title: '🛡️ Web3 Smart Contract Auditor',
    prompt: 'A static analysis security tool that scans Solidity smart contracts for reentrancy and access-control vulnerabilities with interactive remediation diffs.',
  },
]

export default function ProjectForm({ onSuccess }: ProjectFormProps) {
  // Step 1: AI Prompt & Decomposition State
  const [ideaPrompt, setIdeaPrompt] = useState('')
  const [teamSize, setTeamSize] = useState<number>(3)
  const [decomposing, setDecomposing] = useState(false)
  const [decomposeError, setDecomposeError] = useState<string | null>(null)

  // Generated Plan State
  const [decomposed, setDecomposed] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [techStack, setTechStack] = useState('')
  const [conventions, setConventions] = useState('')
  const [teammates, setTeammates] = useState<TeammateInput[]>([])
  const [showConventionsEditor, setShowConventionsEditor] = useState(false)

  // GitHub Provisioning State
  const [githubPat, setGithubPat] = useState('')
  const [repoName, setRepoName] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [isDemo, setIsDemo] = useState(false)
  const [tokenTesting, setTokenTesting] = useState(false)
  const [tokenStatus, setTokenStatus] = useState<{ valid?: boolean; username?: string; error?: string } | null>(null)
  const [showPat, setShowPat] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [provisionProgress, setProvisionProgress] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Trigger AI Decomposition
  const handleDecompose = async (promptOverride?: string) => {
    const promptToUse = promptOverride || ideaPrompt
    if (!promptToUse.trim()) {
      setDecomposeError('Please enter your hackathon idea or select a quick inspiration preset.')
      return
    }

    setDecomposing(true)
    setDecomposeError(null)

    try {
      const res = await fetch('/api/ai/decompose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ideaPrompt: promptToUse.trim(),
          teamSize,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to decompose problem statement')
      }

      const result = data.data
      setName(result.projectName)
      setRepoName(result.projectName)
      setDescription(result.description)
      setTechStack(result.techStack)
      setConventions(result.sharedConventions)
      setTeammates(
        result.teammates.map((tm: any) => ({
          name: tm.name,
          github_username: tm.githubUsername,
          task_description: tm.taskDescription,
          owned_paths: tm.ownedPaths,
        }))
      )
      setDecomposed(true)
    } catch (err: any) {
      setDecomposeError(err.message || 'An error occurred during AI decomposition.')
    } finally {
      setDecomposing(false)
    }
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
    setSubmitError(null)

    if (!name.trim()) {
      setSubmitError('Project name is required')
      return
    }

    const activeTeammates = teammates.filter(
      (t) => t.name.trim() && t.github_username.trim()
    )

    if (activeTeammates.length === 0) {
      setSubmitError('At least one teammate with name and GitHub username is required')
      return
    }

    setSubmitting(true)
    setProvisionProgress('Saving AI-generated project plan to database...')

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
      setProvisionProgress('Provisioning GitHub repository, committing conventions & cutting teammate branches...')
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
        onSuccess(project)
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
      setProvisionProgress(null)
    }
  }

  return (
    <div className="project-form" id="ai-project-planner">
      {/* Header */}
      <div className="form-header">
        <div className="ai-modal-badge mono">✨ AI ARCHITECT</div>
        <h1 style={{ marginTop: '4px' }}>AI Hackathon Project Architect</h1>
        <p className="form-subtitle">
          Enter your problem statement. Branchout automatically designs the architecture, sets shared conventions,
          and allocates conflict-free tasks and branches across your team.
        </p>
      </div>

      {/* ---- STEP 1: Problem Statement Input ---- */}
      <section className="form-section ai-planner-section" id="ai-planner-input">
        <div className="section-title-row">
          <h2 className="section-title">
            <span className="section-icon mono">01</span>
            Describe your idea or problem statement
          </h2>
          {decomposed && (
            <span className="badge-tag mono" style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>
              ✓ Plan Generated
            </span>
          )}
        </div>

        {/* Preset Chips */}
        <div className="field">
          <span className="field-label mono">QUICK INSPIRATION PRESETS:</span>
          <div className="ai-preset-chips">
            {PRESET_IDEAS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                className="ai-preset-chip"
                onClick={() => {
                  setIdeaPrompt(preset.prompt)
                  setDecomposeError(null)
                  handleDecompose(preset.prompt)
                }}
              >
                {preset.title}
              </button>
            ))}
          </div>
        </div>

        {/* Textarea */}
        <div className="field">
          <textarea
            id="idea-prompt-input"
            className="input textarea mono"
            rows={3}
            placeholder="e.g. A real-time collaborative whiteboard app with live cursor tracking, voice channels, and interactive canvas drawing for hackathon teams..."
            value={ideaPrompt}
            onChange={(e) => setIdeaPrompt(e.target.value)}
          />
        </div>

        {/* Team Size Selector & Trigger Button */}
        <div className="field-row two-col" style={{ alignItems: 'flex-end', marginTop: 'var(--space-md)' }}>
          <div className="field">
            <label htmlFor="team-size-select" className="field-label">
              Team Size (Teammates)
            </label>
            <select
              id="team-size-select"
              className="input select-input mono"
              value={teamSize}
              onChange={(e) => setTeamSize(parseInt(e.target.value, 10))}
            >
              <option value={2}>2 Teammates</option>
              <option value={3}>3 Teammates</option>
              <option value={4}>4 Teammates</option>
              <option value={5}>5 Teammates</option>
              <option value={6}>6 Teammates</option>
            </select>
          </div>

          <div className="field" style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-primary ai-decompose-btn"
              onClick={() => handleDecompose()}
              disabled={decomposing || !ideaPrompt.trim()}
              id="btn-auto-decompose"
            >
              {decomposing ? (
                <>
                  <span className="spinner" style={{ width: 14, height: 14 }} />
                  <span>Designing Architecture...</span>
                </>
              ) : decomposed ? (
                '🔄 Re-Generate Architecture'
              ) : (
                '✨ Auto-Decompose & Allocate Tasks'
              )}
            </button>
          </div>
        </div>

        {decomposeError && (
          <div className="error-banner" style={{ marginTop: '12px' }}>
            {decomposeError}
          </div>
        )}
      </section>

      {/* ---- STEP 2: AI-Generated Project & Team Plan (Auto-revealed) ---- */}
      {decomposed && (
        <form onSubmit={handleSubmit}>
          {/* Architecture Overview */}
          <section className="form-section" id="ai-generated-overview">
            <h2 className="section-title">
              <span className="section-icon mono">02</span>
              System Architecture & Tech Stack
            </h2>

            <div className="field-row two-col">
              <div className="field">
                <label htmlFor="project-name" className="field-label">Project Name (Repo Slug)</label>
                <input
                  id="project-name"
                  type="text"
                  className="input mono"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setRepoName(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))
                  }}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="project-tech-stack" className="field-label">Recommended Tech Stack</label>
                <input
                  id="project-tech-stack"
                  type="text"
                  className="input"
                  value={techStack}
                  onChange={(e) => setTechStack(e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="project-description" className="field-label">Project Summary</label>
              <textarea
                id="project-description"
                className="input textarea"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Expandable Conventions Editor */}
            <div style={{ marginTop: 'var(--space-md)' }}>
              <button
                type="button"
                className="btn btn-small btn-secondary"
                onClick={() => setShowConventionsEditor(!showConventionsEditor)}
                id="toggle-conventions-btn"
              >
                {showConventionsEditor ? '▲ Hide SHARED_CONVENTIONS.md' : '▼ View / Edit SHARED_CONVENTIONS.md'}
              </button>
              {showConventionsEditor && (
                <div className="field" style={{ marginTop: 'var(--space-sm)' }}>
                  <textarea
                    id="conventions"
                    className="input textarea textarea-tall mono"
                    rows={8}
                    value={conventions}
                    onChange={(e) => setConventions(e.target.value)}
                  />
                </div>
              )}
            </div>
          </section>

          {/* Conflict-Free Teammate Allocations */}
          <section className="form-section" id="ai-teammates-allocation">
            <div className="section-title-row">
              <h2 className="section-title">
                <span className="section-icon mono">03</span>
                Conflict-Free Task Allocations
                <span className="badge">{teammates.length}</span>
              </h2>
              <span className="security-tag mono" style={{ color: 'var(--accent)' }}>
                ✓ Zero Path Conflicts Guaranteed
              </span>
            </div>
            <p className="section-description">
              Each teammate is allocated dedicated, isolated directory paths. Their AI coding agent will be restricted to these boundaries to eliminate merge conflicts.
            </p>

            <div className="ai-teammates-preview-grid">
              {teammates.map((mate, i) => (
                <div key={i} className="ai-tm-card">
                  <div className="ai-tm-head">
                    <input
                      type="text"
                      className="input mono"
                      style={{ padding: '2px 6px', fontSize: '0.8125rem', width: '45%' }}
                      value={mate.name}
                      onChange={(e) => {
                        const val = e.target.value
                        setTeammates((prev) => prev.map((t, idx) => (idx === i ? { ...t, name: val } : t)))
                      }}
                      placeholder="Name"
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', width: '50%' }}>
                      <span className="mono muted" style={{ fontSize: '0.75rem' }}>@</span>
                      <input
                        type="text"
                        className="input mono"
                        style={{ padding: '2px 6px', fontSize: '0.8125rem' }}
                        value={mate.github_username}
                        onChange={(e) => {
                          const val = e.target.value
                          setTeammates((prev) => prev.map((t, idx) => (idx === i ? { ...t, github_username: val } : t)))
                        }}
                        placeholder="github"
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: '4px' }}>
                    <textarea
                      className="input textarea"
                      style={{ fontSize: '0.75rem', padding: '4px 6px', minHeight: '52px' }}
                      value={mate.task_description}
                      onChange={(e) => {
                        const val = e.target.value
                        setTeammates((prev) => prev.map((t, idx) => (idx === i ? { ...t, task_description: val } : t)))
                      }}
                      placeholder="Task objective"
                    />
                  </div>

                  <div className="ai-tm-paths mono">
                    {mate.owned_paths.map((p, idx) => (
                      <span key={idx} className="path-tag">
                        {p}
                      </span>
                    ))}
                  </div>

                  <div className="ai-tm-branch mono muted" style={{ marginTop: '4px' }}>
                    ↳ <code>{`${mate.task_description.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20)}-${mate.github_username}`}</code>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* STEP 3: GitHub Repository Provisioning */}
          <section className="form-section" id="github-provision-section">
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
                <label htmlFor="repo-name" className="field-label">Repository Name</label>
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

          {/* Submit Actions */}
          {submitError && (
            <div className="error-banner" id="form-error">
              {submitError}
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
              {submitting ? 'Provisioning Repository...' : '🚀 Provision GitHub Repo & Cut Branches'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
