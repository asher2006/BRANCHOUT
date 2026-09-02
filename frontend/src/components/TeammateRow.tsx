import { useState } from 'react'
import type { TeammateInput } from '../types'

interface TeammateRowProps {
  index: number
  teammate: TeammateInput
  onChange: (index: number, teammate: TeammateInput) => void
  onRemove: (index: number) => void
  canRemove: boolean
}

export default function TeammateRow({ index, teammate, onChange, onRemove, canRemove }: TeammateRowProps) {
  const [pathInput, setPathInput] = useState('')

  const update = (field: keyof TeammateInput, value: any) => {
    onChange(index, { ...teammate, [field]: value })
  }

  const addPath = () => {
    const trimmed = pathInput.trim()
    if (trimmed && !teammate.owned_paths.includes(trimmed)) {
      update('owned_paths', [...teammate.owned_paths, trimmed])
      setPathInput('')
    }
  }

  const removePath = (pathIndex: number) => {
    update('owned_paths', teammate.owned_paths.filter((_, i) => i !== pathIndex))
  }

  const handlePathKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addPath()
    }
  }

  return (
    <div className="teammate-row" id={`teammate-${index}`}>
      <div className="teammate-header">
        <span className="teammate-index mono">#{index + 1}</span>
        <h3 className="teammate-title">
          {teammate.name || teammate.github_username || `Teammate ${index + 1}`}
        </h3>
        {canRemove && (
          <button
            type="button"
            className="btn-icon btn-remove"
            onClick={() => onRemove(index)}
            aria-label={`Remove teammate ${index + 1}`}
            id={`remove-teammate-${index}`}
          >
            ×
          </button>
        )}
      </div>

      <div className="teammate-fields">
        <div className="field-row two-col">
          <div className="field">
            <label htmlFor={`name-${index}`} className="field-label">Name</label>
            <input
              id={`name-${index}`}
              type="text"
              className="input"
              placeholder="Alice"
              value={teammate.name}
              onChange={(e) => update('name', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={`github-${index}`} className="field-label">
              GitHub username
            </label>
            <div className="input-with-prefix">
              <span className="input-prefix mono">@</span>
              <input
                id={`github-${index}`}
                type="text"
                className="input input-prefixed"
                placeholder="alice-dev"
                value={teammate.github_username}
                onChange={(e) => update('github_username', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="field">
          <label htmlFor={`task-${index}`} className="field-label">Task description</label>
          <textarea
            id={`task-${index}`}
            className="input textarea"
            placeholder="Build the authentication flow — login page, JWT middleware, protected routes..."
            rows={3}
            value={teammate.task_description}
            onChange={(e) => update('task_description', e.target.value)}
          />
        </div>

        <div className="field">
          <label className="field-label">Owned paths</label>
          <div className="path-input-row">
            <input
              type="text"
              className="input mono"
              placeholder="src/auth/"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              onKeyDown={handlePathKeyDown}
              id={`path-input-${index}`}
            />
            <button
              type="button"
              className="btn btn-small"
              onClick={addPath}
              id={`add-path-${index}`}
            >
              + Add
            </button>
          </div>
          {teammate.owned_paths.length > 0 && (
            <div className="path-tags">
              {teammate.owned_paths.map((p, pi) => (
                <span key={pi} className="path-tag mono">
                  {p}
                  <button
                    type="button"
                    className="path-tag-remove"
                    onClick={() => removePath(pi)}
                    aria-label={`Remove path ${p}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
