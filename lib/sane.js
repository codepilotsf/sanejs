const fs = require('fs')
const sanitize = require('mongo-sanitize')
const parse = require('node-html-parser-hyperscript').parse
const { marked } = require('marked')
const { join, normalize, dirname } = require('path')
const { logger } = require('./logger')
const rootDir = join(__dirname, '..')
const routesDir = join(rootDir, 'routes')

// const cache = { full: {}, partial: {} }
const cache = { page: {}, partial: {} }

const reNoLayout = /(?<!\\){[ \t]*nolayout[ \t]*}/
const reExtendsTag = /(?<!\\){[ \t]*\^[ \t]*([\w\-\/]+)[ \t]*}/
const reSlotTag = /(?<!\\){[ \t]*slot[ \t]*}/
const rePartialTag = /(?<!\\){[ \t]*>[ \t]*([\w\-\/\.]+)[ \t]*}/g
const reFrontMatterBlock = /^[\n]*---[ \t]*\n([\s\S]*?)\n---[ \t]*\n/
const reFrontMatterLines = /^\$?[a-zA-Z_][\w]*[ \t]*:(?:[\S]| |\t|\n  )+/gm
const reFrontMatterKeyVal = /^\$?([a-zA-Z_][\w]*)[ \t]*:[ \t]*([\s\S]+)/
const reTjsBlock =
  /(?<!\\)\{[ \t]*(([@!?]?)[ \t]*(.+?))[ \t]*\}(([\s\S]+?)(\{[ \t]*:[ \t]*\3[ \t]*\}([\s\S]+?))?)\{[ \t]*\/\1[ \t]*\}/g
const reTjsVal = /(?<!\\)\{[ \t]*([=%])[ \t]*(.+?)[ \t]*\}/g

module.exports = (req, res, next) => {
  // Require >= Node 16
  const nodeVersion = process.versions.node.split('.')[0]
  if (nodeVersion < 16) {
    console.error(`Node 16 or higher is required. (Detected: Node v${process.versions.node})`)
    process.exit()
  }

  res.render = async (route, vars, swapIds) => {
    // Build cache if not already set (null means we've cached this route as a 404)
    if (!cache.page[route] && cache.page[route] !== null) {
      cache.page[route] = await buildTemplate(route, (isPartial = false))
    }
    let template = cache.page[route] ? { ...cache.page[route] } : null // Make a copy of cache or null
    if (!template) return next()

    // Populate template vars
    const fmAndVars = { ...template.fm, ...vars }
    template.html = processVars(template.html, fmAndVars)

    // Strip \ char for escaped blocks and vals.
    template.html = template.html.replaceAll('\\{', '{')
    template.html = template.html.replaceAll(/ \\server/gm, ' server')

    // Convert template response to HTMX out-of-band swaps?
    if (swapIds && req.isHtmx) {
      const triggerId = req.headers['hx-trigger']
      template = processSwapIds(template, swapIds, triggerId)
    }

    // Render template.
    res.send(template.html)
  }

  res.partial = async (route, vars) => {
    // Build cache if not already set (null means we've cached this route as a 404)
    if (!cache.partial[route] && cache.partial[route] !== null) {
      cache.partial[route] = await buildTemplate(route, (isPartial = true))
    }
    let template = { ...cache.partial[route] }
    if (!template) return next()

    // Populate template vars
    template.html = vars ? processVars(template.html, vars) : template.html

    // Strip \ char for escaped blocks and vals.
    template.html = template.html.replaceAll('\\{', '{')
    template.html = template.html.replaceAll(/ \\server/gm, ' server')

    // Render template.
    res.send(template.html)
  }

  res.trigger = (eventName) => {
    // Set an HTMX trigger header to trigger event on client.
    res.set('HX-Trigger', eventName)
    return res
  }

  res.error404 = () => {
    res.set('HX-Retarget', 'body')
    res.render('_404', { method: req.method, path: req.url }, null, req.path)
  }

  res.error500 = (debug) => {
    res.set('HX-Retarget', 'body')
    res.render('_500', { debug }, null, req.path)
  }

  // Render a view into a specified element. Defaults to <body> tag (similar to hx-boosted)
  res.retarget = (path, opts = {}, target = 'body') => {
    // The URI to push into history stack must be absolute: /foo/bar
    const normalized = normalize(path)
    const uri = normalized.startsWith('/') ? path : '/' + path
    res.set('HX-Retarget', target)
    res.set('HX-Push', uri)
    res.render(path, opts)
  }

  res.exRedirect = res.redirect
  res.redirect = (route) => {
    route = formatSlashes(route)
    if (req.headers['hx-request']) {
      res.set('HX-Redirect', route)
      res.end()
    } else {
      res.exRedirect(route)
    }
  }

  req.isHtmx = Boolean(req.headers['hx-request'])

  sanitize(req.body)
  sanitize(req.params)
  sanitize(req.query)

  next()
}

/* ============================================= */

async function buildTemplate(route, isPartial) {
  template = await loadTemplate(route) // Sets { html, path }
  if (!template) return null

  // Process front-matter.
  template = await processFrontMatter(template) // Sets { fm }

  // Process Markdown.
  template = processMarkdown(template) // If template is markdown, parse to html

  if (!isPartial) {
    // Process extends tags.
    template = await processExtends(template)

    // Process layout.
    template = await processLayout(template)

    // Process partials.
    template = await processPartials(template)
  }
  return template
}

async function loadTemplate(route) {
  const reServerBlock = /<script[\s]server>([\s\S]+?)<\/script>/m
  const routePath = join(routesDir, route)
  for (possiblePathSuffix of ['.html', '.md', '/index.html', '/index.md']) {
    try {
      const path = routePath + possiblePathSuffix
      const htmlWithServerBlock = await fs.promises.readFile(path, 'utf-8')
      const html = htmlWithServerBlock.replace(reServerBlock, '')
      return { html, path }
    } catch (err) {} // Eat the error and try next possiblePathSuffix.
  }
  return false
}

function processFrontMatter(template) {
  const fmBlockMatch = template.html.match(reFrontMatterBlock)
  if (!fmBlockMatch) return template
  const fmBlock = fmBlockMatch[0]
  const fmLines = fmBlockMatch[1].match(reFrontMatterLines)
  const newFm = {}
  for (const line of fmLines) {
    const [_, key, val] = line.match(reFrontMatterKeyVal)
    joinedVal = val.replace(/\n  [ \t]*/g, ' ') // Remove line breaks in val
    normalizedVal = normalizeVal(joinedVal)
    newFm[key] = normalizedVal
  }
  function normalizeVal(val) {
    if (val === 'false') return false
    if (val === 'null') return null
    if (val === 'undefined') return undefined
    if (!isNaN(val)) return Number(val)
    return val
  }
  const currentFm = template.fm || {}
  template.fm = { ...currentFm, ...newFm }
  template.html = template.html.replace(fmBlock, '').trim()
  return template
}

function processMarkdown(template) {
  if (!template.path.endsWith('.md')) return template
  template.html = marked.parse(template.html)
  return template
}

async function processExtends(template) {
  // Look for tags like {^ some-template }
  const reExtendsTagMatch = template.html.match(reExtendsTag)
  if (!reExtendsTagMatch) return template

  const extendsTag = reExtendsTagMatch[0]
  const wrapperRoute = reExtendsTagMatch[1]

  // Remove this extends tag from template.html)
  template.html = template.html.replace(extendsTag, '')

  // Wrap template with extends template (and merge front-matter).
  template = await wrapIntoSlot(template, wrapperRoute)

  // Recurse until no more extends tags are found.
  return processExtends(template)
}

async function wrapIntoSlot(template, wrapperRoute) {
  let wrapper = await loadTemplate(wrapperRoute)
  wrapper = processFrontMatter(wrapper)
  wrapper = processMarkdown(wrapper)
  const wrapperHtmlParts = wrapper.html.split(reSlotTag)
  if (wrapperHtmlParts?.length < 2) throw Error(`No slot tag found in ${wrapper.path}`)
  template.fm = { ...wrapper.fm, ...template.fm }
  template.html = [wrapperHtmlParts[0], template.html, wrapperHtmlParts[1]].join('')
  return template
}

async function processLayout(template) {
  // Template has a nolayout tag?
  const hasNoLayoutTag = reNoLayout.test(template.html)
  if (hasNoLayoutTag) {
    template.html = template.html.replace(reNoLayout, '')
    return template
  }
  const layoutRoute = await findLayoutRoute(template.path)
  template = await wrapIntoSlot(template, layoutRoute)
  return template
}

async function findLayoutRoute(path) {
  const parentDir = dirname(path)
  const pathToLayout = join(parentDir, '_layout.html')
  try {
    await fs.promises.access(pathToLayout)
    // Return only the route without the abs path to routesDir or extension.
    return pathToLayout.replace(routesDir, '').replace(/\.[^/.]+$/, '')
  } catch (error) {}
  const reachedTop = normalize(parentDir) == normalize(routesDir) || normalize(parentDir) == '/'
  return reachedTop ? false : await findLayoutRoute(join(pathToLayout, '..'))
}

async function processPartials(template) {
  const partialTags = [...template.html.matchAll(rePartialTag)]
  let partialsFm = {}
  for (const tag of partialTags) {
    const partialTag = tag[0]
    const partialRoute = tag[1]
    let partialTemplate = await loadTemplate(partialRoute)
    if (!partialTemplate) throw new Error(`Failed to process partial tag: ${partialTag}`)
    partialTemplate = processFrontMatter(partialTemplate)
    partialTemplate = processMarkdown(partialTemplate)
    const currentFm = template.fm || {}
    template.fm = { ...currentFm, ...partialTemplate.fm }
    template.html = template.html.replace(partialTag, partialTemplate.html)
  }
  return template
}

function processVars(html, vars) {
  // This is a customized version of t.js -> https://github.com/jasonmoo/t.js
  return (
    html
      .replace(reTjsBlock, (_, __, meta, key, inner, ifTrue, hasElse, ifFalse) => {
        var val = getValue(vars, key),
          temp = '',
          i
        if (!val) {
          // Handle if not.
          if (meta == '!') {
            return processVars(inner, vars)
          }

          // check for else
          if (hasElse) {
            return processVars(ifFalse, vars)
          }
          return ''
        }
        // Handle regular if.
        if (meta == '?') {
          return processVars(ifTrue, vars)
        }

        // Process array/obj iteration/
        if (meta == '@') {
          // store any previous vars
          // reuse existing vars
          _ = vars.key
          __ = vars.this
          for (i in val) {
            if (val.hasOwnProperty(i)) {
              vars.key = i
              vars.this = val[i]
              temp += processVars(inner, vars)
            }
          }
          vars.key = _
          vars.this = __
          return temp
        }
        return ''
      })
      // Swap out variables.
      .replace(reTjsVal, function (_, meta, key) {
        var val = getValue(vars, key)
        if (val || val === 0) {
          return meta == '=' ? scrub(val) : val
        }
        return ''
      })
  )

  function scrub(val) {
    val = typeof val === 'string' ? val : JSON.stringify(val)
    return val
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function getValue(vars, key) {
    var parts = key.split('.')
    while (parts.length) {
      if (!vars || !parts[0] || !parts[0] in vars) {
        return
      }
      vars = vars[parts.shift()]
    }
    return vars
  }
}

function processSwapIds(template, swapIds, triggerId) {
  const swapIdsArray = [swapIds].flat() // Convert single string to array.
  const oobSwapElements = [] // oob is HTMX "out of band" https://htmx.org/docs
  const dom = parse(template.html)

  // Is the element that triggered this event also being swapped?
  const triggerIndex = swapIdsArray.indexOf(triggerId)
  const includePrimaryResponse = triggerIndex !== -1
  if (includePrimaryResponse) swapIdsArray.splice(triggerIndex, 1)

  // Append elements specified by id to oobSwapElements.
  swapIdsArray.forEach((id) => {
    const el = dom.getElementById(id)
    if (!el) logger.error(`res.render failed: No DOM element with id="${id}" found in template.`)
    el.setAttribute('hx-swap-oob', true)
    oobSwapElements.push(el.toString())
  })

  // Set the primary response for the swap that matches the trigger id instead of using OOB (this is how HTMX works).
  const primaryResponse = includePrimaryResponse ? dom.getElementById(triggerId) : null
  const oobResponse = oobSwapElements.join('\n\n')
  template.html = primaryResponse ? primaryResponse + '\n\n' + oobResponse : oobResponse
  return template
}

function formatSlashes(route) {
  // Always use leading slash, never use trailing slash.
  route = route.charAt(0) == '/' ? route : '/' + route
  route = route.charAt(route.length - 1) == '/' ? route.slice(0, -1) : route
  return route
}
