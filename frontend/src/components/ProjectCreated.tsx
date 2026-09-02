import { useState } from 'react'
import type { Project, ProvisionResult, Teammate } from '../types'
import { generateClientMasterPrompt } from '../utils/promptTemplate'

interface ProjectCreatedProps {
  project: Project
  provisionResult?: ProvisionResult | null
  onCreateAnother: () => void
  onSelectTeammate?: (teammateId: number) => void
  onViewDashboard?: (projectId: number) => void
}

export default function ProjectCreated({
  project,
  provisionResult,
  onCreateAnother,
  onSelectTeammate,
  onViewDashboard,
}: ProjectCreatedProps) {
  const [showLogs, setShowLogs] = useState(false)
  const [copiedText, setCopiedText] = useState<string | null>(null)

  const repoUrl = project.github_repo_url || provisionResult?.repoUrl || ''

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedText(label)
    setTimeout(() => setCopiedText(null), 2000)
  }

  const handleCopyPrompt = (mate: Teammate) => {
    const prompt = generateClientMasterPrompt(project, mate, project.teammates)
    handleCopy(prompt, `prompt-${mate.id}`)
  }

  return (
    <div className="project-created" id="project-created">
      <div className="success-header">
        <div className="success-icon">✓</div>
        <h1>Repository & Branches Provisioned</h1>
        {repoUrl && (
          <div className="demo-badge mono" style={{ color: 'var(--accent)', borderColor: 'rgba(92, 225, 230, 0.3)' }}>
            ✦ Connected: {repoUrl}
          </div>
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
              <span className="file-badge mono">🛡️ .branchout/ownership.json</span>
              <span className="file-badge mono">⚙️ .github/workflows/boundary-check.yml</span>
            </div>
          </div>
        </section>
      )}

      {/* ---- Teammates & Cut Branches ---- */}
      <section className="created-section" id="branches-section">
        <div className="branches-section-header">
          <h2 className="section-title" style={{ border: 'none', padding: 0 }}>
            <span className="section-icon mono">🌿</span>
            Teammate Onboarding & Master Prompts ({project.teammates.length})
          </h2>
          <span className="section-description">
            Share each teammate's link so they can paste their master prompt into Cursor/Claude Code.
          </span>
        </div>

        <div className="branches-list" style={{ marginTop: '16px' }}>
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
                  <div className="card-header-actions">
                    <span className="status-badge status-not-started">{mate.status.replace('_', ' ')}</span>
                  </div>
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
                    <span className="detail-label">Quick Actions</span>
                    <div className="teammate-action-buttons">
                      <button
                        type="button"
                        className="btn btn-small btn-primary"
                        onClick={() => handleCopyPrompt(mate)}
                        id={`copy-prompt-${mate.id}`}
                      >
                        {copiedText === `prompt-${mate.id}` ? '✓ Copied Prompt!' : '📋 Copy Master Prompt'}
                      </button>

                      {onSelectTeammate && (
                        <button
                          type="button"
                          className="btn btn-small btn-secondary"
                          onClick={() => onSelectTeammate(mate.id)}
                          id={`view-onboarding-${mate.id}`}
                        >
                          👤 View Onboarding Page →
                        </button>
                      )}

                      {repoUrl && (
                        <a
                          href={`${repoUrl.replace(/\.git$/, '')}/compare/main...${mate.branch_name}?expand=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-small"
                          style={{ color: 'var(--accent)', borderColor: 'rgba(92, 225, 230, 0.4)' }}
                          title="Open Pull Request to merge this branch into main"
                        >
                          🚀 Open PR to main ↗
                        </a>
                      )}

                      <button
                        type="button"
                        className="btn btn-small"
                        onClick={() => handleCopy(cloneCmd, `cmd-${mate.id}`)}
                        title="Copy git checkout command"
                      >
                        {copiedText === `cmd-${mate.id}` ? '✓ Copied Git Cmd' : '🌿 Copy Git Cmd'}
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

      <div className="form-actions" style={{ gap: '12px' }}>
        {onViewDashboard && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onViewDashboard(project.id)}
            id="open-dashboard-btn"
          >
            📊 Open Live Contribution Dashboard →
          </button>
        )}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onCreateAnother}
          id="create-another-btn"
        >
          Create another project
        </button>
      </div>
    </div>
  )
}
