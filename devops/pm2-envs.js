#!/usr/bin/env node
require('dotenv').config()

/* Used by pm2-start/stop to check for required .env values */

// Check for required ENVs.
const { PORT, NAME, NODE_ENV } = process.env
if (!PORT || !NAME || !NODE_ENV) {
  console.log('\nPlease be sure your .env file includes values for PORT, NAME, and NODE_ENV.')
  process.exit()
}

// Combine name and environment to identify the app instance. e.g., Flightplan - Production
const INSTANCE = `${NAME} - ${NODE_ENV}`

module.exports = { PORT, INSTANCE, NODE_ENV }
