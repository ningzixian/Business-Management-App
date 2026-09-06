import { useEffect, useState } from 'react'

const mobileLayoutQuery = '(max-width: 720px)'

export function useMobileLayout() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(mobileLayoutQuery).matches)

  useEffect(() => {
    const mediaQuery = window.matchMedia(mobileLayoutQuery)
    const updateLayout = (event: MediaQueryListEvent) => setIsMobile(event.matches)

    setIsMobile(mediaQuery.matches)
    mediaQuery.addEventListener('change', updateLayout)
    return () => mediaQuery.removeEventListener('change', updateLayout)
  }, [])

  return isMobile
}
