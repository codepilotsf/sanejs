window.macdate = {
  day(date = Date.now()) {
    date = ensureDateType(date)
    if (isToday(date)) return 'Today'
    if (isYesterday(date)) return 'Yesterday'
    return formatDate(date) // ex: June 3, 2021
  },
  time(date = Date.now()) {
    date = ensureDateType(date)
    return formatTime(date) // ex: 4:20 PM
  },
  dayAndTime(date = Date.now()) {
    return `${this.day(date)} at ${this.time(date)}` // ex: Yesterday at 2:01 AM
  }
}

// ======================================== //

function isToday(date) {
  const today = new Date()
  return today.toDateString() === date.toDateString()
}

function isYesterday(date) {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return yesterday.toDateString() === date.toDateString()
}

function pad(n) {
  return n < 10 ? '0' + n : n
}

function ensureDateType(date) {
  // Make sure date is a date object (in case a string was passed).
  return typeof date === Date ? date : new Date(date)
}

function formatDate(date) {
  // Returns month, date, year. Ex: June 3, 2021
  const month = monthNames[date.getMonth()]
  const day = date.getDate()
  const year = date.getFullYear()
  return `${month} ${day}, ${year}`
}

function formatTime(date) {
  // Returns Hour:Minutes AM/PM. Ex: 2:07 PM
  const hours24 = date.getHours()
  const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24
  const minutes = pad(date.getMinutes())
  const ampm = hours24 >= 12 ? 'PM' : 'AM'
  return `${hours12}:${minutes} ${ampm}`
}

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]
