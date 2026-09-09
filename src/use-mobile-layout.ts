import { useEffect, useState } from 'react'
import { hasOpenDialogs } from './dialog-layer'

const mobileLayoutQuery = '(max-width: 980px)'

export function useMobileLayout() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(mobileLayoutQuery).matches)

  useEffect(() => {
    const mediaQuery = window.matchMedia(mobileLayoutQuery)
    // A breakpoint must not unmount a page-owned form while it contains a draft.
    const updateLayout = () => { if (!hasOpenDialogs()) setIsMobile(mediaQuery.matches) }

    setIsMobile(mediaQuery.matches)
    mediaQuery.addEventListener('change', updateLayout)
    window.addEventListener('bam-dialogs-closed', updateLayout)
    return () => { mediaQuery.removeEventListener('change', updateLayout); window.removeEventListener('bam-dialogs-closed', updateLayout) }
  }, [])

  return isMobile
}
