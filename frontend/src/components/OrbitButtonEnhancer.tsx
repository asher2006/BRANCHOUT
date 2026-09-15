import { useEffect } from 'react'

const ORBIT_CLASS = 'orbit-border-button'

/**
 * Applies the shared Orbit Border treatment to native buttons, including
 * buttons rendered later by dialogs and conditional views. Keeping the native
 * elements intact preserves each action's type, keyboard behavior, and form
 * submission semantics.
 */
export function OrbitButtonEnhancer() {
  useEffect(() => {
    const decorate = (root: ParentNode) => {
      root.querySelectorAll('button').forEach((button) => {
        button.classList.add(ORBIT_CLASS)
      })
    }

    decorate(document)

    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return
          if (node.matches('button')) node.classList.add(ORBIT_CLASS)
          decorate(node)
        })
      })
    })

    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return null
}
