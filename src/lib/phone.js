// Phone sign-in. Supabase Auth takes an e-mail and a password; a phone number becomes the
// stand-in address 09121234567@phone.invalid (see supabase/migrations/0002_phone_login.sql,
// whose phone_norm this mirrors — the two must agree, or a student could never find their row).

const FA = '۰۱۲۳۴۵۶۷۸۹', AR = '٠١٢٣٤٥٦٧٨٩'
export const toLatinDigits = s => String(s ?? '').replace(/[۰-۹٠-٩]/g, d => String(FA.includes(d) ? FA.indexOf(d) : AR.indexOf(d)))

export function normPhone(p) {
  const d = toLatinDigits(p).replace(/\D/g, '')
  if (/^0098\d{10}$/.test(d)) return '0' + d.slice(4)
  if (/^98\d{10}$/.test(d)) return '0' + d.slice(2)
  if (/^9\d{9}$/.test(d)) return '0' + d
  return d
}

// An Iranian mobile (09xxxxxxxxx), or any other number of 8–15 digits.
export const isPhone = p => /^09\d{9}$/.test(normPhone(p)) || /^[1-9]\d{7,14}$/.test(normPhone(p))
export const phoneEmail = p => normPhone(p) + '@phone.invalid'
export const phoneOfEmail = e => (/@phone\.invalid$/i.test(e || '') ? e.split('@')[0] : null)
// 09121234567 → 0912 123 4567, for reading.
export const fmtPhone = p => { const d = normPhone(p); return /^09\d{9}$/.test(d) ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : d }
export const normCode = c => toLatinDigits(c).trim().toUpperCase()
