#!/usr/bin/env node
const promptSync = require('prompt-sync')
const connectToMongo = require('~/lib/mongoConnection')
const User = require('~/models/User')

const getPrompt = promptSync({ sigint: true })

function prompt(message, value = '') {
  if (value) message += ` [${value}]: `
  return getPrompt(message + ': ') || value
}

async function insertAdmin() {
  await connectToMongo()
  const email = prompt('Email')
  // Check for existing email address.
  const exists = await User.findOne({ email })
  if (exists) {
    console.error(`\n ** User with email address ${email} already exists.\n`)
    return insertAdmin()
  }
  const password = prompt('Password')
  // Create User
  const user = await User.create({
    firstName: 'Dev',
    lastName: 'Admin',
    email: email,
    password: password,
    roles: ['admin']
  }).catch((err) => {
    console.error(err)
    process.exit()
  })
  if (user) console.log('\nAdded admin:', email, '\n')
  process.exit()
}

insertAdmin()
