import { useEffect, useState, useCallback } from 'react'
import type { ProjectActivityReport, BranchActivity } from '../types'
import ExportSummaryModal from './ExportSummaryModal'

interface ContributionDashboardProps {
  projectId: number
  onViewOnboarding: (teammateId: number) => void
  onBackToProjects?: () => void
}

function formatRelativeTime(dateStr: string | null) {
  if (!dateStr) return 'No commits yet'
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

export default function ContributionDashboard({
  projectId,
  onViewOnboarding,
  onBackToProjects,
}: ContributionDashboardProps) {
  const [report, setReport] = useState<ProjectActivityReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Settings
  const [staleThreshold, setStaleThreshold] = useState<number>(3)
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(30) // seconds (0 = off)
  const [userPat, setUserPat] = useState<string>('')
  
  // Webhook Modal state
  const [showWebhookModal, setShowWebhookModal] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [sendingWebhook, setSendingWebhook] = useState(false)
  const [webhookResult, setWebhookResult] = useState<{ success: boolean; message: string } | null>(null)

  // Export Modal state
  const [showExportModal, setShowExportModal] = useState(false)

  // Quick feedback
  const [simulatingTeammateId, setSimulatingTeammateId] = useState<number | null>(null)
  const [togglingBoundaryId, setTogglingBoundaryId] = useState<number | null>(null)
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null)
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Settings panel
  const [showSettings, setShowSettings] = useState(false)

  const fetchActivity = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true)

    try {
      const res = await fetch(`/api/projects/${projectId}/activity/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold: staleThreshold, pat: userPat || undefined }),
      })
      if (!res.ok) {
        throw new Error('Failed to load project activity')
      }
      const data: ProjectActivityReport = await res.json()
      setReport(data)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Error fetching activity')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [projectId, staleThreshold, userPat])

  // Initial load & threshold changes
  useEffect(() => {
    let ignore = false
    const load = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/activity/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ threshold: staleThreshold, pat: userPat || undefined }),
        })
        if (!res.ok) throw new Error('Failed to load project activity')
        const data: ProjectActivityReport = await res.json()
        if (!ignore) {
          setReport(data)
          setError(null)
          setLoading(false)
        }
      } catch (err: any) {
        if (!ignore) {
          setError(err.message || 'Error fetching activity')
          setLoading(false)
        }
      }
    }
    load()
    return () => {
      ignore = true
    }
  }, [projectId, staleThreshold, userPat])

  // Auto-refresh interval
  useEffect(() => {
    if (autoRefreshInterval <= 0) return

    const timer = setInterval(() => {
      fetchActivity(false)
    }, autoRefreshInterval * 1000)

    return () => clearInterval(timer)
  }, [autoRefreshInterval, fetchActivity])

  const handleSimulateCommit = async (teammateId: number) => {
    setSimulatingTeammateId(teammateId)
    try {
      const res = await fetch(`/api/projects/${projectId}/activity/simulate-commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teammateId }),
      })
      if (res.ok) {
        await fetchActivity(false)
      }
    } catch (e) {
      console.error('Failed to simulate commit:', e)
    } finally {
      setSimulatingTeammateId(null)
    }
  }

  const handleToggleBoundaryViolation = async (teammateId: number) => {
    setTogglingBoundaryId(teammateId)
    try {
      const res = await fetch(`/api/projects/${projectId}/activity/toggle-boundary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teammateId }),
      })
      if (res.ok) {
        await fetchActivity(false)
      }
    } catch (e) {
      console.error('Failed to toggle boundary violation:', e)
    } finally {
      setTogglingBoundaryId(null)
    }
  }

  const handleStatusChange = async (teammateId: number, newStatus: 'not_started' | 'in_progress' | 'done') => {
    setUpdatingStatusId(teammateId)
    try {
      const res = await fetch(`/api/teammates/${teammateId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        if (report) {
          setReport({
            ...report,
            branches: report.branches.map((b) =>
              b.teammateId === teammateId ? { ...b, status: newStatus } : b
            ),
          })
        }
      }
    } catch (e) {
      console.error('Failed to update status:', e)
    } finally {
      setUpdatingStatusId(null)
    }
  }

  const handleSendWebhook = async () => {
    if (!webhookUrl.trim() || !report) return
    setSendingWebhook(true)
    setWebhookResult(null)

    const staleBranches = report.branches
      .filter((b) => b.isStale)
      .map((b) => ({
        teammateName: b.teammateName,
        githubUsername: b.githubUsername,
        branchName: b.branchName,
        hoursInactive: b.hoursSinceLastCommit || staleThreshold,
        ownedPaths: b.ownedPaths,
      }))

    if (staleBranches.length === 0) {
      setWebhookResult({ success: false, message: 'No stale branches currently detected to notify.' })
      setSendingWebhook(false)
      return
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/notify-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: webhookUrl.trim(),
          projectName: report.projectName,
          staleBranches,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setWebhookResult({ success: true, message: 'Alert dispatched successfully.' })
      } else {
        setWebhookResult({ success: false, message: `Error: ${data.error || 'Failed to send'}` })
      }
    } catch (e: any) {
      setWebhookResult({ success: false, message: `Error: ${e.message}` })
    } finally {
      setSendingWebhook(false)
    }
  }

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedLabel(label)
    setTimeout(() => setCopiedLabel(null), 2000)
  }

  if (loading && !report) {
    return (
      <div className="onboarding-loading">
        <span className="spinner" />
        <span className="mono">Loading live contribution dashboard...</span>
      </div>
    )
  }

  if (error && !report) {
    return (
      <div className="error-banner">
        <p>{error}</p>
        {onBackToProjects && (
          <button className="btn btn-small" onClick={onBackToProjects} style={{ marginTop: '8px' }}>
            ← Back
          </button>
        )}
      </div>
    )
  }

  if (!report) return null

  const staleBranches = report.branches.filter((b) => b.isStale)
  const mismatchesCount = report.branches.filter(
    (b) => b.status === 'done' && b.commitCount === 0
  ).length
  const boundaryViolationsCount = report.branches.filter(
    (b) => b.boundaryCheckStatus === 'failed'
  ).length
  const boundaryCleanCount = report.branches.filter(
    (b) => b.boundaryCheckStatus === 'passed'
  ).length
  const doneCount = report.branches.filter((b) => b.status === 'done').length
  const inProgressCount = report.branches.filter((b) => b.status === 'in_progress').length

  const getHealthLabel = (branch: BranchActivity) => {
    const isMismatch = branch.status === 'done' && branch.commitCount === 0
    if (isMismatch) return { label: 'Mismatch', cls: 'health-stale' }
    if (branch.isStale) return { label: 'Stale', cls: 'health-stale' }
    if (branch.status === 'done') return { label: 'Completed', cls: 'health-active' }
    if (branch.commitCount > 0) return { label: 'Active', cls: 'health-active' }
    return { label: 'Pending', cls: 'health-pending' }
  }

  const getBoundaryLabel = (branch: BranchActivity) => {
    if (branch.boundaryCheckStatus === 'failed') return { label: `Blocked (${branch.boundaryViolationCount || 1})`, cls: 'boundary-failed' }
    if (branch.boundaryCheckStatus === 'passed') return { label: 'Passed', cls: 'boundary-passed' }
    if (branch.boundaryCheckStatus === 'pending') return { label: 'Checking', cls: 'boundary-pending' }
    return { label: 'Ready', cls: 'boundary-none' }
  }

  const getPrLabel = (branch: BranchActivity) => {
    if (branch.prStatus === 'open') return { label: `PR #${branch.prNumber || '1'} Open`, cls: 'pr-open' }
    if (branch.prStatus === 'merged') return { label: 'Merged', cls: 'pr-merged' }
    if (branch.prStatus === 'draft') return { label: 'Draft', cls: 'pr-draft' }
    if (branch.prStatus === 'closed') return { label: 'Closed', cls: 'pr-closed' }
    return { label: 'No PR', cls: 'pr-none' }
  }

  const getReadinessLabel = (branch: BranchActivity) => {
    switch (branch.mergeReadiness) {
      case 'ready': return 'Ready to merge'
      case 'needs_rebase': return `Rebase needed (${branch.behindBy})`
      case 'checks_failing': return 'Checks failing'
      case 'checks_pending': return 'Checks pending'
      case 'merged': return 'Merged'
      case 'draft': return 'Draft PR'
      case 'blocked': return 'Needs review'
      default: return 'No PR'
    }
  }

  return (
    <div className="dashboard-container" id="contribution-dashboard">
      {/* ---- Dashboard Header ---- */}
      <div className="dashboard-header">
        <div className="dashboard-title-group">
          {onBackToProjects && (
            <button className="btn btn-icon btn-back" onClick={onBackToProjects} title="Back">
              ←
            </button>
          )}
          <div>
            <div className="onboarding-breadcrumbs mono">
              <span className="prompt">&gt;_</span>
              <span>project</span>
              <span className="breadcrumb-sep">/</span>
              <span className="accent-text">{report.projectName}</span>
              {report.isDemo ? (
                <span className="demo-badge mono">Demo Activity</span>
              ) : (
                <span className="demo-badge mono" style={{ color: 'var(--accent)', borderColor: 'rgba(0, 240, 255, 0.3)' }}>
                  Cloud Monitored
                </span>
              )}
            </div>
            <h1>Live Contribution Dashboard</h1>
          </div>
        </div>

        <div className="dashboard-quick-actions">
          {report.githubRepoUrl && (
            <a
              href={report.githubRepoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-small"
            >
              GitHub Repo ↗
            </a>
          )}
          <button
            type="button"
            className="btn btn-small btn-primary"
            onClick={() => setShowExportModal(true)}
            id="open-export-modal-btn"
          >
            Export Summary
          </button>
          <button
            type="button"
            className={`btn btn-small ${staleBranches.length > 0 ? 'btn-warning-glow' : ''}`}
            onClick={() => setShowWebhookModal(true)}
            id="open-webhook-modal-btn"
          >
            Webhook Alert {staleBranches.length > 0 ? `(${staleBranches.length} Stale)` : ''}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => fetchActivity(true)}
            disabled={refreshing}
            id="refresh-dashboard-btn"
          >
            {refreshing ? <span className="spinner" style={{ width: 12, height: 12 }} /> : 'Refresh'}
          </button>
          <button
            type="button"
            className="btn btn-small btn-ghost"
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            {showSettings ? 'Close settings' : 'Settings'}
          </button>
        </div>
      </div>

      {/* ---- Compact Stats Strip ---- */}
      <div className="dash-stats-strip">
        <div className="dash-stat">
          <span className="dash-stat__value mono">{report.totalCommits}</span>
          <span className="dash-stat__label">commits</span>
        </div>
        <div className="dash-stat-divider" />
        <div className="dash-stat">
          <span className="dash-stat__value mono">{report.activeBranchesCount}<span className="muted">/{report.branches.length}</span></span>
          <span className="dash-stat__label">active</span>
        </div>
        <div className="dash-stat-divider" />
        <div className={`dash-stat ${staleBranches.length > 0 ? 'dash-stat--warn' : ''}`}>
          <span className="dash-stat__value mono">{report.staleBranchesCount}</span>
          <span className="dash-stat__label">stale</span>
        </div>
        <div className="dash-stat-divider" />
        <div className={`dash-stat ${boundaryViolationsCount > 0 ? 'dash-stat--warn' : ''}`}>
          <span className="dash-stat__value mono">{boundaryViolationsCount > 0 ? boundaryViolationsCount : `${boundaryCleanCount}/${report.branches.length}`}</span>
          <span className="dash-stat__label">{boundaryViolationsCount > 0 ? 'violations' : 'CI clean'}</span>
        </div>
        <div className="dash-stat-divider" />
        <div className={`dash-stat ${mismatchesCount > 0 ? 'dash-stat--warn' : ''}`}>
          <span className="dash-stat__value mono">{mismatchesCount}</span>
          <span className="dash-stat__label">mismatches</span>
        </div>
        <div className="dash-stat-divider" />
        <div className="dash-stat">
          <span className="dash-stat__value mono">{doneCount}<span className="muted">/{report.branches.length}</span></span>
          <span className="dash-stat__label">done</span>
        </div>

        {/* Progress bar */}
        <div className="dash-progress-bar">
          <div className="dash-progress-bar__fill dash-progress-bar__done" style={{ width: `${(doneCount / report.branches.length) * 100}%` }} />
          <div className="dash-progress-bar__fill dash-progress-bar__wip" style={{ width: `${(inProgressCount / report.branches.length) * 100}%` }} />
        </div>
      </div>

      {/* ---- Settings Panel (collapsed by default) ---- */}
      {showSettings && (
        <div className="dash-settings-panel">
          <div className="toolbar-group">
            <label className="toolbar-label mono">STALE THRESHOLD:</label>
            <select
              className="input select-input mono"
              value={staleThreshold}
              onChange={(e) => setStaleThreshold(parseFloat(e.target.value))}
              id="stale-threshold-select"
            >
              <option value={1}>1 Hour</option>
              <option value={2}>2 Hours</option>
              <option value={3}>3 Hours (Default)</option>
              <option value={6}>6 Hours</option>
            </select>
          </div>

          <div className="toolbar-group">
            <label className="toolbar-label mono">AUTO POLL:</label>
            <select
              className="input select-input mono"
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(parseInt(e.target.value, 10))}
              id="auto-refresh-select"
            >
              <option value={0}>Off</option>
              <option value={15}>Every 15s</option>
              <option value={30}>Every 30s (Default)</option>
              <option value={60}>Every 60s</option>
            </select>
          </div>

          <div className="toolbar-group">
            <label className="toolbar-label mono">GITHUB PAT:</label>
            <input
              type="password"
              className="input select-input mono"
              placeholder="Session token..."
              style={{ width: 130 }}
              value={userPat}
              onChange={(e) => setUserPat(e.target.value)}
              title="Optional GitHub token for private repositories"
            />
          </div>

          <div className="toolbar-status-text mono muted">
            <span className="live-poll-dot" /> Last polled: {new Date(report.refreshedAt).toLocaleTimeString()}
          </div>
        </div>
      )}

      {/* ---- Alert Banners ---- */}
      {boundaryViolationsCount > 0 && (
        <div className="warning-banner boundary-alert-banner" id="boundary-alert-banner">
          <span className="warning-icon">!</span>
          <div style={{ flex: 1 }}>
            <strong>CI Boundary Check Alert ({boundaryViolationsCount} blocked)</strong>
            <p>
              Teammate changes touch files outside their assigned <code>owned_paths</code>. The <code>boundary-check</code> workflow will fail and block merging into <code>main</code>.
            </p>
          </div>
        </div>
      )}

      {staleBranches.length > 0 && (
        <div className="warning-banner stale-alert-banner" id="stale-alert-banner">
          <span className="warning-icon">!</span>
          <div style={{ flex: 1 }}>
            <strong>Stale Branch Nudge ({staleBranches.length} inactive)</strong>
            <p>
              The following branches have recorded 0 commits past the {staleThreshold}-hour threshold:{' '}
              <strong>{staleBranches.map((b) => `${b.teammateName} (${b.branchName})`).join(', ')}</strong>.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-small btn-secondary"
            onClick={() => setShowWebhookModal(true)}
          >
            Ping on Discord / Slack →
          </button>
        </div>
      )}

      {/* ---- Search Bar ---- */}
      <div className="dash-search-bar">
        <input
          type="text"
          className="input mono dash-search-input"
          placeholder="Filter teammates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* ---- Teammate Cards ---- */}
      <div className="dash-cards-grid">
        {report.branches
          .filter((branch) => {
            if (!searchQuery.trim()) return true
            const q = searchQuery.toLowerCase()
            return (
              branch.teammateName.toLowerCase().includes(q) ||
              branch.githubUsername.toLowerCase().includes(q) ||
              branch.branchName.toLowerCase().includes(q)
            )
          })
          .map((branch: BranchActivity) => {
            const branchHref = report.githubRepoUrl ? `${report.githubRepoUrl}/tree/${branch.branchName}` : '#'
            const cloneCmd = `git checkout ${branch.branchName}`
            const isMismatch = branch.status === 'done' && branch.commitCount === 0
            const health = getHealthLabel(branch)
            const boundary = getBoundaryLabel(branch)
            const pr = getPrLabel(branch)
            const isWarning = branch.isStale || isMismatch || branch.boundaryCheckStatus === 'failed'

            return (
              <div
                key={branch.teammateId}
                className={`dash-card ${isWarning ? 'dash-card--warn' : ''}`}
                id={`dash-card-${branch.teammateId}`}
              >
                {/* Card Header */}
                <div className="dash-card__header">
                  <div className="dash-card__identity">
                    <div className="tm-avatar mono">{branch.teammateName.slice(0, 2).toUpperCase()}</div>
                    <div>
                      <strong className="dash-card__name">{branch.teammateName}</strong>
                      <a
                        href={`https://github.com/${branch.githubUsername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mono muted dash-card__handle"
                      >
                        @{branch.githubUsername}
                      </a>
                    </div>
                  </div>
                  <span className={`health-badge ${health.cls} mono`}>{health.label}</span>
                </div>

                {/* Card Body — Key Metrics */}
                <div className="dash-card__metrics">
                  <div className="dash-card__metric">
                    <span className="dash-card__metric-label">Commits</span>
                    <span className={`dash-card__metric-value mono ${branch.commitCount > 0 ? 'active-commits' : 'zero-commits'}`}>
                      {branch.commitCount}
                    </span>
                  </div>
                  <div className="dash-card__metric">
                    <span className="dash-card__metric-label">Last activity</span>
                    <span className={`dash-card__metric-value ${branch.isStale ? 'text-warning' : ''}`}>
                      {formatRelativeTime(branch.lastCommitAt)}
                    </span>
                  </div>
                  <div className="dash-card__metric">
                    <span className="dash-card__metric-label">PR</span>
                    <span className={`pr-badge ${pr.cls} mono`}>
                      {branch.prStatus === 'open' && branch.prUrl ? (
                        <a href={branch.prUrl} target="_blank" rel="noopener noreferrer">{pr.label} ↗</a>
                      ) : pr.label}
                    </span>
                  </div>
                  <div className="dash-card__metric">
                    <span className="dash-card__metric-label">Merge</span>
                    <span className={`readiness-badge readiness-${branch.mergeReadiness} mono`}>
                      {getReadinessLabel(branch)}
                    </span>
                  </div>
                </div>

                {/* Branch + Boundary Row */}
                <div className="dash-card__branch-row">
                  <a
                    href={branchHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mono dash-card__branch-link"
                  >
                    {branch.branchName} ↗
                  </a>
                  <span className={`boundary-badge ${boundary.cls} mono`}>{boundary.label}</span>
                </div>

                {/* Mismatch warning */}
                {isMismatch && (
                  <div className="dash-card__mismatch-warn mono">
                    Status mismatch: Reported Done with 0 commits
                  </div>
                )}

                {/* Card Footer — Actions */}
                <div className="dash-card__actions">
                  <select
                    className={`status-select mono status-select-${branch.status}`}
                    value={branch.status}
                    onChange={(e) => handleStatusChange(branch.teammateId, e.target.value as any)}
                    disabled={updatingStatusId === branch.teammateId}
                    title="Change teammate self-reported status"
                  >
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>

                  <div className="dash-card__action-btns">
                    <button
                      type="button"
                      className="btn btn-small btn-secondary"
                      onClick={() => onViewOnboarding(branch.teammateId)}
                      title="View customized onboarding briefing"
                    >
                      Briefing
                    </button>

                    <button
                      type="button"
                      className="btn btn-small btn-secondary"
                      onClick={() => handleSimulateCommit(branch.teammateId)}
                      disabled={simulatingTeammateId === branch.teammateId}
                      title="Simulate a commit to test live updates"
                    >
                      {simulatingTeammateId === branch.teammateId ? '...' : '+ Commit'}
                    </button>

                    <button
                      type="button"
                      className={`btn btn-small ${branch.boundaryCheckStatus === 'failed' ? 'btn-danger' : 'btn-ghost'}`}
                      onClick={() => handleToggleBoundaryViolation(branch.teammateId)}
                      disabled={togglingBoundaryId === branch.teammateId}
                      title="Simulate CI boundary violation / resolution for this branch"
                    >
                      {togglingBoundaryId === branch.teammateId
                        ? '...'
                        : branch.boundaryCheckStatus === 'failed'
                        ? 'Clean'
                        : 'Test CI Fail'}
                    </button>

                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => handleCopy(cloneCmd, `cmd-${branch.teammateId}`)}
                      title="Copy git checkout command"
                    >
                      {copiedLabel === `cmd-${branch.teammateId}` ? 'Copied' : 'Git'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
      </div>

      {/* ---- Export Summary Modal ---- */}
      {showExportModal && (
        <ExportSummaryModal
          projectId={projectId}
          report={report}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {/* ---- Webhook Notification Modal ---- */}
      {showWebhookModal && (
        <div className="modal-overlay" onClick={() => setShowWebhookModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Send Stale Branch Webhook Nudge</h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowWebhookModal(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <p className="section-description">
                Dispatch an immediate activity nudge alert to your team's Discord or Slack channel for all currently inactive branches.
              </p>

              <div className="field" style={{ marginTop: '12px' }}>
                <label htmlFor="webhook-url" className="field-label">Slack / Discord Webhook URL</label>
                <input
                  id="webhook-url"
                  type="url"
                  className="input mono"
                  placeholder="https://discord.com/api/webhooks/... or https://hooks.slack.com/services/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
              </div>

              {staleBranches.length > 0 ? (
                <div className="webhook-preview-box">
                  <span className="field-label">Target Stale Branches ({staleBranches.length}):</span>
                  <ul className="webhook-branches-list mono">
                    {staleBranches.map((b) => (
                      <li key={b.teammateId}>
                        <strong>{b.teammateName}</strong> (@{b.githubUsername}) — <code>{b.branchName}</code> ({b.hoursSinceLastCommit || staleThreshold}h inactive)
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="muted" style={{ fontSize: '0.8125rem', marginTop: '8px' }}>
                  No branches are currently stale past the {staleThreshold}h threshold.
                </p>
              )}

              {webhookResult && (
                <div className={`token-status-badge ${webhookResult.success ? 'token-valid' : 'token-invalid'}`} style={{ marginTop: '12px' }}>
                  {webhookResult.message}
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowWebhookModal(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSendWebhook}
                disabled={sendingWebhook || !webhookUrl.trim() || staleBranches.length === 0}
              >
                {sendingWebhook ? 'Dispatching...' : 'Send Nudge Alert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
