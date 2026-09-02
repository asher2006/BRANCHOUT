import { useState } from 'react'

export interface AiDecompositionResult {
  projectName: string
  description: string
  techStack: string
  sharedConventions: string
  teammates: Array<{
    name: string
    githubUsername: string
    taskDescription: string
    ownedPaths: string[]
    branchName: string
  }>
}

interface AiDecomposerModalProps {
  onClose: () => void
  onApply: (result: AiDecompositionResult) => void
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

export default function AiDecomposerModal({ onClose, onApply }: AiDecomposerModalProps) {
  const [ideaPrompt, setIdeaPrompt] = useState('')
  const [teamSize, setTeamSize] = useState<number>(3)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AiDecompositionResult | null>(null)

  const handleDecompose = async () => {
    if (!ideaPrompt.trim()) {
      setError('Please describe your hackathon idea or problem statement.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/ai/decompose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ideaPrompt: ideaPrompt.trim(),
          teamSize,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to decompose problem statement')
      }

      setResult(data.data)
    } catch (err: any) {
      setError(err.message || 'An error occurred during AI decomposition.')
    } finally {
      setLoading(false)
    }
  }

  const handleApplyResult = () => {
    if (!result) return
    onApply(result)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card ai-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="ai-modal-badge mono">✨ ARCHITECT AGENT</div>
            <h3 style={{ marginTop: '4px' }}>AI Idea Decomposer & Task Allocator</h3>
            <p className="section-description" style={{ marginTop: '2px' }}>
              Describe your hackathon idea in plain English. The AI architect will break down the system architecture,
              recommend a tech stack, and distribute non-overlapping tasks and directory paths among your team.
            </p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal-body ai-modal-body">
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
                    setError(null)
                  }}
                >
                  {preset.title}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt Textarea */}
          <div className="field">
            <label htmlFor="ai-problem-statement" className="field-label">
              Problem Statement / Idea Description <span className="required">*</span>
            </label>
            <textarea
              id="ai-problem-statement"
              className="textarea"
              rows={3}
              placeholder="e.g. A real-time collaborative whiteboard app with voice rooms, canvas drawing, and AI diagram generation..."
              value={ideaPrompt}
              onChange={(e) => setIdeaPrompt(e.target.value)}
            />
          </div>

          {/* Team Size Selector */}
          <div className="field-row two-col" style={{ alignItems: 'flex-end' }}>
            <div className="field">
              <label htmlFor="ai-team-size" className="field-label">
                Team Size (Members)
              </label>
              <select
                id="ai-team-size"
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
                onClick={handleDecompose}
                disabled={loading || !ideaPrompt.trim()}
                id="btn-trigger-decompose"
              >
                {loading ? (
                  <>
                    <span className="spinner" style={{ width: 14, height: 14 }} />
                    <span>Decomposing System...</span>
                  </>
                ) : (
                  '✨ Auto-Decompose with AI'
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="error-banner" style={{ marginTop: '8px' }}>
              {error}
            </div>
          )}

          {/* Decomposition Preview Card */}
          {result && (
            <div className="ai-preview-card" id="ai-preview-container">
              <div className="ai-preview-header">
                <div>
                  <span className="mono accent-text" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                    DECOMPOSITION RESULT
                  </span>
                  <h4 style={{ margin: '2px 0 0 0' }}>{result.projectName}</h4>
                </div>
                <div className="badge-tag mono">{result.techStack}</div>
              </div>

              <p className="ai-preview-desc">{result.description}</p>

              <div className="ai-teammates-preview-grid">
                {result.teammates.map((tm, i) => (
                  <div key={i} className="ai-tm-card">
                    <div className="ai-tm-head">
                      <strong>{tm.name}</strong>
                      <span className="mono muted">@{tm.githubUsername}</span>
                    </div>
                    <div className="ai-tm-task">{tm.taskDescription}</div>
                    <div className="ai-tm-paths mono">
                      {tm.ownedPaths.map((p, idx) => (
                        <span key={idx} className="path-tag">
                          {p}
                        </span>
                      ))}
                    </div>
                    <div className="ai-tm-branch mono muted">
                      ↳ <code>{tm.branchName}</code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {result && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleApplyResult}
              id="btn-apply-ai-decomposition"
            >
              ✨ Apply to Brief Form
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
