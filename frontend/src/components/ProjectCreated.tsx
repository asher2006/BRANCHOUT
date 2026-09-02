import type { Project } from '../types'

interface ProjectCreatedProps {
  project: Project
  onCreateAnother: () => void
}

export default function ProjectCreated({ project, onCreateAnother }: ProjectCreatedProps) {
  return (
    <div className="project-created" id="project-created">
      <div className="success-header">
        <div className="success-icon">✓</div>
        <h1>Project created</h1>
        <p className="mono project-name-display">{project.name}</p>
      </div>

      <section className="created-section">
        <h2 className="section-title">
          <span className="section-icon mono">→</span>
          Teammates & branches
        </h2>

        <div className="branches-list">
          {project.teammates.map((mate) => (
            <div key={mate.id} className="branch-card" id={`branch-${mate.id}`}>
              <div className="branch-card-header">
                <span className="branch-name mono">{mate.branch_name}</span>
                <span className="status-badge status-not-started">{mate.status.replace('_', ' ')}</span>
              </div>
              <div className="branch-card-body">
                <div className="branch-detail">
                  <span className="detail-label">Assigned to</span>
                  <span className="detail-value">{mate.name} <span className="mono muted">@{mate.github_username}</span></span>
                </div>
                {mate.task_description && (
                  <div className="branch-detail">
                    <span className="detail-label">Task</span>
                    <span className="detail-value">{mate.task_description}</span>
                  </div>
                )}
                {mate.owned_paths.length > 0 && (
                  <div className="branch-detail">
                    <span className="detail-label">Paths</span>
                    <div className="path-tags">
                      {mate.owned_paths.map((p, i) => (
                        <span key={i} className="path-tag mono">{p}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="created-hint">
        <p className="muted">
          Next: connect a GitHub repo in Phase 2 to provision these branches.
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
