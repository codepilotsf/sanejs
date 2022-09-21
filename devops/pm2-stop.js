#!/usr/bin/env node
const envs = require('./pm2-envs')
const { exec } = require('child_process')

// Start PM2
console.log('Stopping PM2')
const command = `pm2 stop '${envs.INSTANCE}'`
exec(command, (error, stdout, stderr) => {
  if (error) {
    console.log(`\nError: ${error.message}`)
    return
  }
})
