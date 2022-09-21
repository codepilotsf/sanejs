#!/usr/bin/env node
const envs = require('./pm2-envs')
const { exec } = require('child_process')

// Start PM2
console.log('Starting PM2')
const command = `PORT=${envs.PORT} pm2 start --name '${envs.INSTANCE}' app.js --watch`
exec(command, (error, stdout, stderr) => {
  if (error) {
    console.log(`\nError: ${error.message}`)
    return
  }
})
