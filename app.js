const express = require('express')
const helmet = require('helmet')
const compression = require('compression')
const session = require('express-session')
const MongoDBStore = require('connect-mongodb-session')(session)
const connectToMongo = require('./lib/mongoConnection')
const sane = require('./lib/sane')
const { protectAdminRoutes } = require('./lib/auth')
const { join } = require('path')
const fs = require('fs')
const livereload = require('livereload')
const connectLivereload = require('connect-livereload')
const { requestLogger, logger } = require('./lib/logger')
const dotenv = require('dotenv')
dotenv.config()

// Check for required .env values.
const requiredEnvs = ['PORT', 'NAME', 'NODE_ENV']
const missingEnvs = requiredEnvs.filter((e) => !process.env[e])
if (missingEnvs.length) {
  console.log('\nBefore running saneJS, please set the following values in your .env:\n')
  for (const v of missingEnvs) logger.error('-', v)
  console.log('')
  process.exit()
}

// Create Express app.
const app = express()

// Use gzip compression.
app.use(compression())

// Modify response headers for better security.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }))

// Set path to static dir.
const staticDirectory = join(__dirname, 'static')

// Connect to LiveReload for development: Watch static dir and nodemon refresh.
if (app.get('env') === 'development') {
  const liveReloadServer = livereload.createServer()
  // Only directly watch the static directory.
  liveReloadServer.watch(staticDirectory)
  // When Nodemon restarts, refresh the browser.
  liveReloadServer.server.once('connection', () => {
    setTimeout(() => {
      liveReloadServer.refresh('/')
    }, 100)
  })
  // Inject the JS snippet into page <head>.
  app.use(connectLivereload())
}

// Serve static resources like images and css.
app.use(express.static(staticDirectory))

// Use simple request logger.
app.use(requestLogger)

// Allow use of modern browser form data and JSON responses.
app.use(express.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }))
app.use(express.json())

// Use sane templating middleware.
app.use(sane)

// Use Express Session
if (process.env.SESSION_SECRET && process.env.MONGO_URI) {
  app.set('trustproxy', true)
  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      saveUninitialized: true,
      resave: true,
      store: new MongoDBStore({
        uri: process.env.MONGO_URI,
        collection: '_express_sessions'
      }),
      cookie: { maxAge: 1000 * 60 * 60 * 2 }, // 2 hours
      rolling: true
    })
  )
}
// Use auth middleware for protected routes.
app.use(protectAdminRoutes)

// Need to use self-executing function for the rest so we can await dynamic routes.
;(async function () {
  // Dynamically add all routes found in routes/ dir excluding those prefixed with underscore.
  await dynamicallyLoadRoutes(join(__dirname, 'routes'))

  // If route hasn't been handled yet, serve a plain .html template if present.
  app.use((req, res, next) => {
    if (req.method != 'GET') return next()
    if (req.path.indexOf('.') !== -1) return next() // Don't waste cpu on .css and favicons
    res.render(req.path, {})
  })

  // Handle simple 404.
  app.use((req, res, next) => {
    if (req.url == '/service-worker.js') return next()
    logger.error(`404 NOT FOUND: ${req.method} ${req.url}`)
    res.error404()
  })

  // Handle all other errors.
  app.use((error, req, res, next) => {
    // Is this a regular 404 raised by `res.error(404)`?
    if (error?.status == 404) {
      logger.error(`404 NOT FOUND: ${req.method} ${req.url}`)

      res.error404()
      return
    }
    // Is this a MongoDB castError?
    // Ex: /usersById/not-a-real-id causes Mongo to throw this error.
    if (error?.name == 'CastError') {
      // Handle as a regular 404.
      logger.error('MongoDB CastError (invalid ObjectID)')
      logger.error(`404 NOT FOUND: ${req.method} ${req.url}`)

      res.error404()
      return
    }

    // Show debug info for dev?
    const debug = {}
    if (process.env.NODE_ENV == 'development') {
      debug.message = error.message || error
      debug.stack = error.stack
      logger.error(debug.stack)
    }
    res.error500(debug)
  })

  // Connect to Mongo
  if (process.env.MONGO_URI) connectToMongo()

  // Start the server.
  const port = process.env.PORT || 3000
  app.listen(port, () => {
    console.log('\x1b[33m', `\n👍 Listening at localhost:${port}\n`, '\x1b[0m')
  })
})()

// ============================================= //

async function dynamicallyLoadRoutes(dirPath) {
  await continueLoadingRoutes(dirPath)
  async function continueLoadingRoutes(thisDir) {
    const files = await fs.promises.readdir(thisDir)

    for (const fileName of files) {
      // Ignore files starting with a double underscore.
      if (fileName.startsWith('__')) continue
      // Set the full abs path to file.
      const absPath = join(thisDir, fileName)
      // Recurse into directories for nested routes.
      if (fs.statSync(absPath).isDirectory()) {
        await continueLoadingRoutes(absPath)
        continue
      }
      // Set the route endpoint for .html or .md files only.
      const matchRoute = absPath.match(/([\w\-\/. ]+)\.(html|md)/)
      if (!matchRoute || matchRoute.length < 2) continue
      const route = matchRoute[1].replace(dirPath, '')
      const fileExt = matchRoute[2]
      // Read the file and look for <script server>
      const template = await fs.promises.readFile(absPath, 'utf-8')
      const matchScript = template.match(/<script[\s]server>([\s\S]+?)<\/script>/m)
      let serverBlock = matchScript && matchScript[1] + '\nreturn server'
      const server = require('express').Router()
      let routeHandler
      if (serverBlock) {
        // Parse the serverBlock, passing in refs to Express router `server`, Node `require`, and `self` route reference.
        try {
          routeHandler = new Function('server', 'require', 'self', serverBlock)
          useRoute(route, routeHandler(server, require, route), absPath)
        } catch (err) {
          logger.error(`Unable to parse server block in: ${absPath}\n\n${err.stack}`)
        }
      }
    }
  }
}

const routes = {} // Keep track so we can check for duplicates.
function useRoute(route, handler, absPath) {
  // Avoid adding duplicate route.
  if (routes[route]) {
    logger.error('Duplicate routes defined for', route, 'in:\n - ', routes[route], '\n - ', absPath)
    return
  }
  app.use(route, handler)
  routes[route] = absPath
  // Also add special route for index file?
  if (route.endsWith('/index')) {
    const indexRoute = route.slice(0, -5)
    app.use(indexRoute, handler)
    routes[route] = absPath
  }
}
