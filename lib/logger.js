const colorReset = '\x1b[0m'
const colorYellow = '\x1b[33m'
const colorRed = '\x1b[31m'
const colorGray = '\33[90m'

const logger = {
  info() {
    console.log(colorYellow + [...arguments].join(' ') + colorReset)
  },
  error() {
    console.log(colorRed + [...arguments].join(' ') + colorReset)
  },
  request() {
    console.log(colorGray + [...arguments].join(' ') + colorReset)
  }
}

const requestLogger = (req, res, next) => {
  if (req.url == '/service-worker.js') return next()
  logger.request(req.method.toUpperCase(), req.url)
  next()
}

module.exports = { logger, requestLogger }
