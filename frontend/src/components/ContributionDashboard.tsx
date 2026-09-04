import { useEffect, useState, useCallback } from 'react'
import type { ProjectActivityReport, BranchActivity } from '../types'
import ExportSummaryModal from './ExportSummaryModal'

interface ContributionDashboardProps {
  projectId: number
  onViewOnboarding: (teammateId: number) => void
  onBackToProjects?: () => void
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

  const fetchActivity = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true)
    setError(null)

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
    } catch (err: any) {
      setError(err.message || 'Error fetching activity')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [projectId, staleThreshold, userPat])

  // Initial load & threshold changes
  useEffect(() => {
    fetchActivity()
  }, [fetchActivity])

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
        setWebhookResult({ success: true, message: '✓ Alert dispatched successfully to webhook!' })
      } else {
        setWebhookResult({ success: false, message: `✗ Error: ${data.error || 'Failed to send'}` })
      }
    } catch (e: any) {
      setWebhookResult({ success: false, message: `✗ Error: ${e.message}` })
    } finally {
      setSendingWebhook(false)
    }
  }

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedLabel(label)
    setTimeout(() => setCopiedLabel(null), 2000)
  }

  const formatRelativeTime = (dateStr: string | null) => {
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
                <span className="demo-badge mono">✦ Demo Activity</span>
              ) : (
                <span className="demo-badge mono" style={{ color: 'var(--accent)', borderColor: 'rgba(0, 240, 255, 0.3)' }}>
                  ● Cloud Monitored
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
            📦 Export Summary
          </button>
          <button
            type="button"
            className={`btn btn-small ${staleBranches.length > 0 ? 'btn-warning-glow' : ''}`}
            onClick={() => setShowWebhookModal(true)}
            id="open-webhook-modal-btn"
          >
            🔔 Webhook Alert {staleBranches.length > 0 ? `(${staleBranches.length} Stale)` : ''}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => fetchActivity(true)}
            disabled={refreshing}
            id="refresh-dashboard-btn"
          >
            {refreshing ? <span className="spinner" style={{ width: 12, height: 12 }} /> : '🔄 Refresh Now'}
          </button>
        </div>
      </div>

      {/* ---- Metric Stats Row ---- */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label mono">TOTAL COMMITS</span>
          <div className="stat-value-row">
            <span className="stat-number mono accent-number">{report.totalCommits}</span>
            <span className="stat-subtext">across all branches</span>
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-label mono">ACTIVE BRANCHES</span>
          <div className="stat-value-row">
            <span className="stat-number mono accent-number">{report.activeBranchesCount}</span>
            <span className="stat-subtext">of {report.branches.length} team branches</span>
          </div>
        </div>

        <div className={`stat-card ${report.staleBranchesCount > 0 ? 'stat-card-warning' : ''}`}>
          <span className="stat-label mono">STALE BRANCHES</span>
          <div className="stat-value-row">
            <span className={`stat-number mono ${report.staleBranchesCount > 0 ? 'warning-number' : ''}`}>
              {report.staleBranchesCount}
            </span>
            <span className="stat-subtext">
              {report.staleBranchesCount > 0 ? `> ${staleThreshold}h with no commits` : 'All branches active'}
            </span>
          </div>
        </div>

        <div className={`stat-card ${boundaryViolationsCount > 0 ? 'stat-card-warning' : ''}`}>
          <span className="stat-label mono">CI BOUNDARIES</span>
          <div className="stat-value-row">
            <span className={`stat-number mono ${boundaryViolationsCount > 0 ? 'warning-number' : 'accent-number'}`}>
              {boundaryViolationsCount > 0 ? `⚠️ ${boundaryViolationsCount}` : `🛡️ ${boundaryCleanCount}/${report.branches.length}`}
            </span>
            <span className="stat-subtext">
              {boundaryViolationsCount > 0 ? 'PRs with out-of-bounds files' : 'Zero path violations'}
            </span>
          </div>
        </div>

        <div className={`stat-card ${mismatchesCount > 0 ? 'stat-card-warning' : ''}`}>
          <span className="stat-label mono">STATUS MISMATCHES</span>
          <div className="stat-value-row">
            <span className={`stat-number mono ${mismatchesCount > 0 ? 'warning-number' : 'accent-number'}`}>
              {mismatchesCount}
            </span>
            <span className="stat-subtext">
              {mismatchesCount > 0 ? 'Reported Done with 0 commits' : 'Self-reports match activity'}
            </span>
          </div>
        </div>
      </div>

      {/* ---- Boundary Violation Callout if any PRs violated boundaries ---- */}
      {boundaryViolationsCount > 0 && (
        <div className="warning-banner boundary-alert-banner" id="boundary-alert-banner">
          <span className="warning-icon">🛡️</span>
          <div style={{ flex: 1 }}>
            <strong>CI Boundary Check Alert ({boundaryViolationsCount} blocked)</strong>
            <p>
              Teammate changes touch files outside their assigned <code>owned_paths</code>. GitHub Actions <code>boundary-check</code> workflow will fail and block merging into <code>main</code> until out-of-bounds files are reverted.
            </p>
          </div>
        </div>
      )}

      {/* ---- Stale Warning Callout if any branches are stale ---- */}
      {staleBranches.length > 0 && (
        <div className="warning-banner stale-alert-banner" id="stale-alert-banner">
          <span className="warning-icon">⚠</span>
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

      {/* ---- Controls & Filter Toolbar ---- */}
      <div className="dashboard-toolbar">
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
          <label className="toolbar-label mono">SEARCH:</label>
          <input
            type="text"
            className="input select-input mono"
            placeholder="Filter teammate/branch..."
            style={{ width: 170 }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="toolbar-group">
          <label className="toolbar-label mono">GITHUB PAT (OPTIONAL):</label>
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

      {/* ---- Live Activity Table ---- */}
      <div className="activity-table-container">
        <table className="activity-table" id="activity-table">
          <thead>
            <tr>
              <th>TEAMMATE</th>
              <th>BRANCH</th>
              <th>COMMITS</th>
              <th>LAST ACTIVITY</th>
              <th>PR STATUS</th>
              <th>MERGE READINESS</th>
              <th>SELF REPORT</th>
              <th>CI BOUNDARY</th>
              <th>HEALTH & ALIGNMENT</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
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

                return (
                  <tr
                    key={branch.teammateId}
                    className={`activity-row ${branch.isStale || isMismatch ? 'row-stale' : ''} ${branch.boundaryCheckStatus === 'failed' ? 'row-boundary-failed' : ''}`}
                    id={`row-teammate-${branch.teammateId}`}
                  >
                    {/* Teammate */}
                    <td className="cell-teammate">
                      <div className="tm-avatar-row">
                        <div className="tm-avatar mono">
                          {branch.teammateName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="tm-name-stack">
                          <strong>{branch.teammateName}</strong>
                          <a
                            href={`https://github.com/${branch.githubUsername}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mono muted tm-handle"
                          >
                            @{branch.githubUsername}
                          </a>
                        </div>
                      </div>
                    </td>

                    {/* Branch */}
                    <td className="cell-branch">
                      <a
                        href={branchHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mono branch-table-link"
                        title="Open branch in GitHub"
                      >
                        <span className="branch-icon">🌿</span> {branch.branchName} ↗
                      </a>
                    </td>

                    {/* Commits */}
                    <td className="cell-commits">
                      <div className="commits-pill-wrap">
                        <span className={`commits-count-badge mono ${branch.commitCount > 0 ? 'active-commits' : 'zero-commits'}`}>
                          {branch.commitCount}
                        </span>
                      </div>
                    </td>

                    {/* Last Activity */}
                    <td className="cell-last-commit">
                      <div className="last-commit-info">
                        <span className={`last-commit-time ${branch.isStale ? 'text-warning' : ''}`}>
                          {formatRelativeTime(branch.lastCommitAt)}
                        </span>
                        {branch.lastCommitMessage && (
                          <span className="last-commit-msg mono muted" title={branch.lastCommitMessage}>
                            {branch.lastCommitMessage.slice(0, 28)}
                            {branch.lastCommitMessage.length > 28 ? '…' : ''}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* PR Status */}
                    <td className="cell-pr">
                      {branch.prStatus === 'open' && branch.prUrl && (
                        <a
                          href={branch.prUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pr-badge pr-open mono"
                        >
                          PR #{branch.prNumber || '1'} Open ↗
                        </a>
                      )}
                      {branch.prStatus === 'merged' && (
                        <span className="pr-badge pr-merged mono">Merged ✓</span>
                      )}
                      {branch.prStatus === 'draft' && (
                        <span className="pr-badge pr-draft mono">Draft PR</span>
                      )}
                      {branch.prStatus === 'closed' && (
                        <span className="pr-badge pr-closed mono">Closed</span>
                      )}
                      {branch.prStatus === 'none' && (
                        <span className="pr-badge pr-none mono">No PR</span>
                      )}
                    </td>

                    {/* Merge Readiness */}
                    <td className="cell-readiness">
                      <div className="readiness-stack">
                        <span className={`readiness-badge readiness-${branch.mergeReadiness} mono`} title={`Ahead ${branch.aheadBy} / behind ${branch.behindBy} · Checks: ${branch.checks}`}>
                          {branch.mergeReadiness === 'ready' ? 'Ready to merge ✓' :
                            branch.mergeReadiness === 'needs_rebase' ? `Rebase needed (${branch.behindBy})` :
                            branch.mergeReadiness === 'checks_failing' ? 'Checks failing' :
                            branch.mergeReadiness === 'checks_pending' ? 'Checks pending' :
                            branch.mergeReadiness === 'merged' ? 'Merged ✓' :
                            branch.mergeReadiness === 'draft' ? 'Draft PR' :
                            branch.mergeReadiness === 'blocked' ? 'Needs review' : 'No PR'}
                        </span>
                        {branch.prStatus === 'open' && (
                          <span className="readiness-detail mono">{branch.aheadBy} ahead · {branch.behindBy} behind</span>
                        )}
                      </div>
                    </td>

                    {/* Self-Reported Status Picker */}
                    <td className="cell-self-report">
                      <select
                        className={`status-select mono status-select-${branch.status}`}
                        value={branch.status}
                        onChange={(e) => handleStatusChange(branch.teammateId, e.target.value as any)}
                        disabled={updatingStatusId === branch.teammateId}
                        title="Change teammate self-reported status"
                      >
                        <option value="not_started">Not Started</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done ✓</option>
                      </select>
                    </td>

                    {/* CI Boundary Check */}
                    <td className="cell-boundary">
                      {branch.boundaryCheckStatus === 'failed' ? (
                        <div className="boundary-badge-stack">
                          <span
                            className="boundary-badge boundary-failed mono"
                            title={branch.violatingFiles?.length ? `Out-of-bounds files:\n${branch.violatingFiles.join('\n')}` : 'Modified files outside declared owned_paths'}
                          >
                            ⚠️ Blocked ({branch.boundaryViolationCount || 1})
                          </span>
                          {branch.violatingFiles && branch.violatingFiles.length > 0 && (
                            <span className="violating-file-hint mono muted" title={branch.violatingFiles.join(', ')}>
                              {branch.violatingFiles[0]}
                            </span>
                          )}
                        </div>
                      ) : branch.boundaryCheckStatus === 'passed' ? (
                        <span className="boundary-badge boundary-passed mono" title="All changed files fall strictly within declared owned_paths">
                          🛡️ Passed
                        </span>
                      ) : branch.boundaryCheckStatus === 'pending' ? (
                        <span className="boundary-badge boundary-pending mono">
                          ⏳ Checking...
                        </span>
                      ) : (
                        <span className="boundary-badge boundary-none mono muted">
                          — Ready
                        </span>
                      )}
                    </td>

                    {/* Health & Alignment */}
                    <td className="cell-health">
                      <div className="health-stack">
                        {isMismatch ? (
                          <span className="health-badge health-stale mono" title="Teammate reported 'Done' but 0 commits were recorded on this branch!">
                            ⚠️ Mismatch (0 commits)
                          </span>
                        ) : branch.isStale ? (
                          <span className="health-badge health-stale mono" title={`Inactive for ${branch.hoursSinceLastCommit || staleThreshold}+ hours`}>
                            ⚠ Stale Nudge
                          </span>
                        ) : branch.status === 'done' ? (
                          <span className="health-badge health-active mono">
                            🎉 Completed
                          </span>
                        ) : branch.commitCount > 0 ? (
                          <span className="health-badge health-active mono">
                            🟢 Active
                          </span>
                        ) : (
                          <span className="health-badge health-pending mono">
                            🟡 Pending
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="cell-actions">
                      <div className="table-actions-group">
                        <button
                          type="button"
                          className="btn btn-small btn-secondary"
                          onClick={() => onViewOnboarding(branch.teammateId)}
                          title="View customized onboarding briefing"
                        >
                          Briefing →
                        </button>

                        <button
                          type="button"
                          className="btn btn-small btn-secondary"
                          onClick={() => handleSimulateCommit(branch.teammateId)}
                          disabled={simulatingTeammateId === branch.teammateId}
                          title="Simulate a commit to test live updates"
                        >
                          {simulatingTeammateId === branch.teammateId ? '⚡...' : '+ Commit'}
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
                            ? '✓ Clean'
                            : '⚡ Test CI Fail'}
                        </button>

                        <button
                          type="button"
                          className="btn btn-small"
                          onClick={() => handleCopy(cloneCmd, `cmd-${branch.teammateId}`)}
                          title="Copy git checkout command"
                        >
                          {copiedLabel === `cmd-${branch.teammateId}` ? '✓' : 'Git'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
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
              <h3>🔔 Send Stale Branch Webhook Nudge</h3>
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
                {sendingWebhook ? 'Dispatching Alert...' : '🚀 Send Nudge Alert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
