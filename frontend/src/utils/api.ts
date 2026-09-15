const configuredApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')

function getApiUrl(path: string): string {
  if (configuredApiUrl) return `${configuredApiUrl}${path}`
  return path
}

/**
 * Calls the Branchout API and gives the UI an actionable error when the API
 * cannot be reached. In local development, retry directly against the
 * backend so the app still works if the Vite proxy is unavailable.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(getApiUrl(path), init)
  } catch (error) {
    const isLocalFrontend =
      !configuredApiUrl &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
      window.location.port !== '3001'

    if (isLocalFrontend) {
      try {
        return await fetch(`http://${window.location.hostname}:3001${path}`, init)
      } catch {
        // Fall through to the actionable error below.
      }
    }

    if (error instanceof TypeError) {
      throw new Error(
        'The Branchout API is unreachable. Start the backend with `npm run dev` from the project root, then try again.',
      )
    }
    throw error
  }
}
