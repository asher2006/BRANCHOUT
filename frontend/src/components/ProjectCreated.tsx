import { useState } from 'react'
import type { Project, ProvisionResult } from '../types'

interface ProjectCreatedProps {
  project: Project
  provisionResult?: ProvisionResult | null
  onCreateAnother: () => void
}

export default function ProjectCreated({ project, provisionResult, onCreateAnother }: ProjectCreatedProps) {
  const [showLogs, setShowLogs] = useState(false)
  const [copiedText, setCopiedText] = useState<string | null>(null)

  const repoUrl = project.github_repo_url || provisionResult?.repoUrl || ''

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedText(label)
    setTimeout(() => setCopiedText(null), 2000)
  }

  return (
    <div className="project-created" id="project-created">
      <div className="success-header">
        <div className="success-icon">✓</div>
        <h1>Repository & Branches Provisioned</h1>
        <p className="mono project-name-display">{project.name}</p>
        {provisionResult?.isDemo && (
          <div className="demo-badge mono">✦ Simulated Demo Mode (No GitHub PAT used)</div>
        )}
      </div>

      {/* ---- Repository Info Card ---- */}
      {repoUrl && (
        <section className="created-section" id="repo-summary-card">
          <div className="repo-summary-header">
            <div>
              <span className="field-label">GitHub Repository</span>
              <div className="repo-url-row">
                <a
                  href={repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="repo-link mono"
                  id="github-repo-link"
                >
                  {repoUrl} ↗
                </a>
              </div>
            </div>
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-small"
              id="open-repo-btn"
            >
              Open on GitHub ↗
            </a>
          </div>

          <div className="committed-files-row">
            <span className="detail-label">Committed to main:</span>
            <div className="file-badges">
              <span className="file-badge mono">📄 SHARED_CONVENTIONS.md</span>
              <span className="file-badge mono">📄 README.md</span>
            </div>
          </div>
        </section>
      )}

      {/* ---- Teammates & Cut Branches ---- */}
      <section className="created-section" id="branches-section">
        <h2 className="section-title">
          <span className="section-icon mono">🌿</span>
          Teammate Branches ({project.teammates.length})
        </h2>

        <div className="branches-list">
          {project.teammates.map((mate) => {
            const branchUrl = repoUrl ? `${repoUrl}/tree/${mate.branch_name}` : '#'
            const cloneCmd = `git checkout -b ${mate.branch_name}`

            return (
              <div key={mate.id} className="branch-card" id={`branch-${mate.id}`}>
                <div className="branch-card-header">
                  <div className="branch-title-group">
                    <a
                      href={branchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="branch-name mono"
                      title="View branch on GitHub"
                    >
                      {mate.branch_name} ↗
                    </a>
                  </div>
                  <span className="status-badge status-not-started">{mate.status.replace('_', ' ')}</span>
                </div>

                <div className="branch-card-body">
                  <div className="branch-detail">
                    <span className="detail-label">Assigned to</span>
                    <span className="detail-value">
                      <strong>{mate.name}</strong>{' '}
                      <a
                        href={`https://github.com/${mate.github_username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mono muted"
                      >
                        @{mate.github_username}
                      </a>
                    </span>
                  </div>

                  {mate.task_description && (
                    <div className="branch-detail">
                      <span className="detail-label">Task</span>
                      <span className="detail-value">{mate.task_description}</span>
                    </div>
                  )}

                  {mate.owned_paths.length > 0 && (
                    <div className="branch-detail">
                      <span className="detail-label">Owned paths</span>
                      <div className="path-tags">
                        {mate.owned_paths.map((p, i) => (
                          <span key={i} className="path-tag mono">{p}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="branch-detail branch-actions-row">
                    <span className="detail-label">Checkout</span>
                    <div className="copy-cmd-row">
                      <code className="cmd-box mono">{cloneCmd}</code>
                      <button
                        type="button"
                        className="btn btn-small"
                        onClick={() => handleCopy(cloneCmd, `cmd-${mate.id}`)}
                      >
                        {copiedText === `cmd-${mate.id}` ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ---- Provisioning Log Console ---- */}
      {provisionResult?.logs && provisionResult.logs.length > 0 && (
        <section className="created-section" id="logs-section">
          <div
            className="logs-toggle-header"
            onClick={() => setShowLogs(!showLogs)}
            role="button"
            tabIndex={0}
          >
            <span className="section-title" style={{ border: 'none', padding: 0 }}>
              <span className="section-icon mono">&gt;_</span>
              Provisioning Logs ({provisionResult.logs.length} events)
            </span>
            <span className="toggle-indicator mono">{showLogs ? '▲ Hide' : '▼ View'}</span>
          </div>

          {showLogs && (
            <div className="log-console mono">
              {provisionResult.logs.map((line, i) => (
                <div key={i} className="log-line">{line}</div>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="created-hint">
        <p className="muted">
          Next Phase: Generate personalized AI master prompts and shareable onboarding links for each teammate.
        </p>
      </div>

      <div className="form-actions">
        <button
          className="btn btn-primary"
          onClick={onCreateAnother}
          id="create-another-btn"
        >
          Create another project
        </button>
      </div>
    </div>
  )
}
