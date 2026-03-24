import { useEffect } from 'react'

function useAutoDismissFeedback(feedback, setFeedback, delay = 3000) {
  useEffect(() => {
    if (!feedback) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setFeedback('')
    }, delay)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [feedback, setFeedback, delay])
}

export default useAutoDismissFeedback
