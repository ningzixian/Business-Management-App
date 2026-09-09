export type CsvCell = string | number | boolean | null | undefined

export function csvCell(value: CsvCell) {
  let text = String(value ?? '')
  // Quoting alone does not prevent spreadsheet formula evaluation.
  if (typeof value === 'string' && (/^[\s\u0000-\u001f\u007f]*[=+@-]/u.test(text) || /^[\t\r\n]/.test(text))) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

export function downloadCsv(filename: string, rows: CsvCell[][]) {
  const content = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function dialPhone(phone: string, onUnavailable: () => void) {
  const normalized = callablePhone(phone)
  if (!normalized) {
    onUnavailable()
    return
  }
  window.location.href = `tel:${normalized}`
}

export function callablePhone(phone: string): string | null {
  const text = phone.trim()
  // Accept only complete numbers with common display separators. Never strip
  // masking characters, extensions or letters into a different number.
  if (!/^\+?[\d ()-]+$/.test(text)) return null
  const normalized = text.replace(/[ ()-]/g, '')
  if (!/^\+?[0-9]{7,15}$/.test(normalized)) return null
  if (text.includes('(') || text.includes(')')) {
    if (!/^\+?[\d -]*\(\d+\)[\d -]*$/.test(text)) return null
  }
  return normalized
}

export function openMapSearch(location: string, onUnavailable: () => void) {
  const query = location.trim()
  if (!query || query === '待补充') {
    onUnavailable()
    return
  }
  window.open(`https://www.amap.com/search?query=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer')
}
