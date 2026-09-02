import type { TeammateInput, OwnershipConflict, BalanceWarning } from '../types'

/**
 * Check for overlapping owned_paths between teammates.
 * A conflict exists when two teammates claim the same path,
 * or when one path is a parent of another.
 */
export function checkOwnershipConflicts(teammates: TeammateInput[]): OwnershipConflict[] {
  const conflicts: OwnershipConflict[] = []
  const pathOwnerMap = new Map<string, string[]>()

  // Build a map of normalized path → owners
  for (const mate of teammates) {
    if (!mate.name.trim()) continue

    for (const rawPath of mate.owned_paths) {
      const p = normalizePath(rawPath)
      if (!p) continue

      if (!pathOwnerMap.has(p)) {
        pathOwnerMap.set(p, [])
      }
      pathOwnerMap.get(p)!.push(mate.name || mate.github_username)
    }
  }

  // Direct duplicates
  for (const [p, owners] of pathOwnerMap) {
    if (owners.length > 1) {
      conflicts.push({ path: p, owners })
    }
  }

  // Parent/child overlaps — check if any path is a prefix of another
  const allPaths = Array.from(pathOwnerMap.keys())
  for (let i = 0; i < allPaths.length; i++) {
    for (let j = i + 1; j < allPaths.length; j++) {
      const a = allPaths[i]
      const b = allPaths[j]

      if (isParentPath(a, b) || isParentPath(b, a)) {
        const ownersA = pathOwnerMap.get(a)!
        const ownersB = pathOwnerMap.get(b)!

        // Only flag if different owners
        const uniqueOwnersA = new Set(ownersA)
        const uniqueOwnersB = new Set(ownersB)
        const hasOverlap = [...uniqueOwnersA].some(o => !uniqueOwnersB.has(o)) ||
                           [...uniqueOwnersB].some(o => !uniqueOwnersA.has(o))

        if (hasOverlap) {
          const parent = isParentPath(a, b) ? a : b
          const child = parent === a ? b : a
          conflicts.push({
            path: `${parent} ⊃ ${child}`,
            owners: [...new Set([...ownersA, ...ownersB])],
          })
        }
      }
    }
  }

  return conflicts
}

/**
 * Check for workload imbalance across teammates.
 * Flags if task descriptions vary wildly in length, or if
 * one person has significantly more owned paths than others.
 */
export function checkWorkloadBalance(teammates: TeammateInput[]): BalanceWarning | null {
  const active = teammates.filter(m => m.name.trim())
  if (active.length < 2) return null

  // Check task description length variance
  const taskLengths = active.map(m => m.task_description.trim().length)
  const avgLength = taskLengths.reduce((a, b) => a + b, 0) / taskLengths.length
  const hasEmptyTask = taskLengths.some(l => l === 0)
  const hasLongTask = taskLengths.some(l => l > avgLength * 3 && l > 100)

  if (hasEmptyTask) {
    const emptyNames = active
      .filter(m => m.task_description.trim().length === 0)
      .map(m => m.name || m.github_username)
    return {
      message: 'Some teammates have no task description',
      details: `${emptyNames.join(', ')} — consider adding a task description so their prompt can be generated properly.`,
    }
  }

  // Check path count variance
  const pathCounts = active.map(m => m.owned_paths.filter(p => p.trim()).length)
  const maxPaths = Math.max(...pathCounts)
  const minPaths = Math.min(...pathCounts)

  if (maxPaths > 0 && minPaths === 0) {
    const noPaths = active
      .filter(m => m.owned_paths.filter(p => p.trim()).length === 0)
      .map(m => m.name || m.github_username)
    return {
      message: 'Uneven file ownership',
      details: `${noPaths.join(', ')} have no owned paths assigned. This may cause merge conflicts or unclear responsibilities.`,
    }
  }

  if (hasLongTask) {
    const longest = active.reduce((a, b) =>
      a.task_description.length > b.task_description.length ? a : b
    )
    const shortest = active.reduce((a, b) =>
      a.task_description.length < b.task_description.length ? a : b
    )
    if (longest.task_description.length > shortest.task_description.length * 4) {
      return {
        message: 'Task scope looks uneven',
        details: `"${longest.name}" has a much more detailed task than "${shortest.name}". Consider balancing the scope.`,
      }
    }
  }

  return null
}

function normalizePath(p: string): string {
  return p.trim().replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

function isParentPath(parent: string, child: string): boolean {
  if (parent === child) return false
  return child.startsWith(parent + '/')
}
