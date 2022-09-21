#! /usr/bin/env node

/*
----------------
devops/deploy.js
----------------

This script will deploy your local public directory to the server configured for the current Git
branch.

Quick Start:
------------------
1. Edit config section below to set your local dir and remote connection.
2. Be sure you're on the Git branch for the target you want to to deploy to.
3. `npm run deploy`


*/

// Config -----------------------------
const localSources = ['devops', 'lib', 'models', 'routes', 'static', 'app.js', 'package.json']
const remote = {
  staging: {
    user: 'example',
    host: 'staging.example.com',
    path: '/home/example/staging/'
  },
  main: {
    user: 'example',
    host: 'example.com',
    path: '/home/example/main/'
  }
}
// ------------------------------------

const path = require('path')
const gitBranch = require('current-git-branch')
const rsync = require('rsync')
const os = require('os')
const { NodeSSH } = require('node-ssh')
const promptSync = require('prompt-sync')

const prompt = promptSync({ sigint: true })

const ssh = new NodeSSH()

// Convert localSources to absolute localPaths
const localPaths = []
localSources.map(function (source) {
  localPaths.push(path.resolve(path.join(process.cwd(), source)))
})

// Set current `localGitBranch`
const localGitBranch = gitBranch()
const allowedBranches = Object.keys(remote)
if (allowedBranches.indexOf(localGitBranch) === -1) {
  console.log(
    '\x1b[36m',
    '\n⚠️  DEPLOY ABORTED: Current Git branch must be one of: ' + allowedBranches + '\n'
  )
  process.exit()
}

// Create a standard rsync connection string like user@host:/path/to/target
const rsyncDestination =
  remote[localGitBranch]['user'] +
  '@' +
  remote[localGitBranch]['host'] +
  ':' +
  remote[localGitBranch]['path']

// Set up rsync command
const rsync_cmd = new rsync()
  .shell('ssh')
  .flags('az')
  .exclude('.DS_Store')
  .source(localPaths)
  .destination(rsyncDestination)

// Execute the command
rsync_cmd.set('delete').execute(function (error, code, cmd) {
  if (error) {
    console.log('Rsync command failed: ' + cmd)
    console.log(error)
  } else {
    console.log('\x1b[36m', '\n👍  Deployed to ' + localGitBranch + ' server.\x1b[0m\n')
    if (confirm('Install remote NPM modules too?')) installModules()
  }
})

async function installModules() {
  const { NodeSSH } = require('node-ssh')
  const ssh = new NodeSSH()
  await ssh.connect({
    host: remote[localGitBranch]['host'],
    username: remote[localGitBranch]['user'],
    privateKey: `${os.homedir()}/.ssh/id_rsa`
  })

  const res = await ssh.execCommand('npm i --production', { cwd: remote[localGitBranch]['path'] })
  if (!res.stderr) {
    console.log(res.stdout)
    console.log(
      '\x1b[36m',
      '\n👍  Installed node_modules on ' + localGitBranch + ' server.\x1b[0m\n'
    )
  }
  process.exit()
}

function confirm(message) {
  console.log('') // New line
  const confirmed = prompt(`${message} [Y/n]: `) || 'Y'
  return Boolean(['Y', 'y', 'Yes', 'yes'].includes(confirmed))
}
