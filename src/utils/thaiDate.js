/**
 * Utility for Thailand Timezone (UTC+7 / Asia/Bangkok)
 */
function getThaiCurrentISOString() {
  const now = new Date()
  const thaiDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
  const thaiTimeStr = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour12: false })
  const ms = String(now.getMilliseconds()).padStart(3, '0')
  return `${thaiDateStr}T${thaiTimeStr}.${ms}`
}

function parseThaiDate(dateStr) {
  if (!dateStr) return new Date()
  if (dateStr.endsWith('Z') || dateStr.includes('+')) {
    return new Date(dateStr)
  }
  const parts = dateStr.split(/[-T:. ]/)
  if (parts.length >= 5) {
    const year = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1
    const day = parseInt(parts[2], 10)
    const hour = parseInt(parts[3], 10)
    const min = parseInt(parts[4], 10)
    const sec = parts[5] ? parseInt(parts[5], 10) : 0
    return new Date(year, month, day, hour, min, sec)
  }
  return new Date(dateStr)
}

module.exports = {
  getThaiCurrentISOString,
  parseThaiDate
}
