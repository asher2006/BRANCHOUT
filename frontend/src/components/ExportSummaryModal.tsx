import { useState, useEffect } from 'react'
import type { ProjectActivityReport } from '../types'

interface ExportSummaryModalProps {
  projectId: number
  report: ProjectActivityReport
  onClose: () => void
}

export default function ExportSummaryModal({ projectId, report, onClose }: ExportSummaryModalProps) {
  const [activeTab, setActiveTab] = useState<'markdown' | 'csv'>('markdown')
  const [markdownContent, setMarkdownContent] = useState<string>('')
  const [csvContent, setCsvContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [copiedText, setCopiedText] = useState<string | null>(null)

  useEffect(() => {
    const fetchExports = async () => {
      setLoading(true)
      try {
        const [mdRes, csvRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/export/markdown`),
          fetch(`/api/projects/${projectId}/export/csv`),
        ])
        const md = await mdRes.text()
        const csv = await csvRes.text()
        setMarkdownContent(md)
        setCsvContent(csv)
      } catch (e) {
        console.error('Failed to load exports:', e)
      } finally {
        setLoading(false)
      }
    }

    fetchExports()
  }, [projectId])

  const handleCopy = (content: string, label: string) => {
    navigator.clipboard.writeText(content)
    setCopiedText(label)
    setTimeout(() => setCopiedText(null), 2500)
  }

  const handleDownload = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card export-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>📦 End-of-Hackathon Contribution Export</h3>
            <p className="section-description" style={{ marginTop: '2px' }}>
              Download or copy summary reports for judging submissions, Devpost writeups, and team retrospectives.
            </p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="export-tabs-row">
          <button
            type="button"
            className={`export-tab-btn ${activeTab === 'markdown' ? 'active' : ''}`}
            onClick={() => setActiveTab('markdown')}
            id="tab-markdown-btn"
          >
            📄 Markdown (.md)
          </button>
          <button
            type="button"
            className={`export-tab-btn ${activeTab === 'csv' ? 'active' : ''}`}
            onClick={() => setActiveTab('csv')}
            id="tab-csv-btn"
          >
            📊 CSV Spreadsheet (.csv)
          </button>
        </div>

        {/* Modal Body / Preview */}
        <div className="modal-body export-modal-body">
          {loading ? (
            <div className="onboarding-loading" style={{ padding: '32px' }}>
              <span className="spinner" />
              <span className="mono">Generating export document...</span>
            </div>
          ) : (
            <div className="export-preview-container">
              {activeTab === 'markdown' ? (
                <pre className="export-preview-box mono" id="markdown-preview">
                  {markdownContent}
                </pre>
              ) : (
                <pre className="export-preview-box mono" id="csv-preview">
                  {csvContent}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="modal-actions export-modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>

          {activeTab === 'markdown' ? (
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleCopy(markdownContent, 'md')}
                id="copy-markdown-btn"
              >
                {copiedText === 'md' ? '✓ Copied Markdown!' : '📋 Copy Markdown'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  handleDownload(markdownContent, `${report.projectName}-hackathon-summary.md`, 'text/markdown')
                }
                id="download-markdown-btn"
              >
                ⬇ Download .md
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleCopy(csvContent, 'csv')}
                id="copy-csv-btn"
              >
                {copiedText === 'csv' ? '✓ Copied CSV!' : '📋 Copy CSV'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  handleDownload(csvContent, `${report.projectName}-hackathon-summary.csv`, 'text/csv')
                }
                id="download-csv-btn"
              >
                ⬇ Download .csv
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
