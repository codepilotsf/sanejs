## Thinking about how to build Hemlock templates

Time for a refactor. We have a problem now that if we parse our "meta" tags first, then process markdown, that's a mess because partials and extenstions may not be markdown (and shouldn't be parsed).

If we go the other direction, then our meta tags get wrapped in `<p>` tags if they're on their own line. So we need to "remember" that for example, a `page.md` extends `wrapper.html`, remove that `#extends` tag, then parse the `page.md` markdown before wrapping in the wrapper.

#### All this for #extends?

Yeah actually. Partials don't have front-matter or #extends tags. So if a partial is markdown, just parse it. It's really just about #extends tags and #nolayout tags. Nope. Because a page view can be markdown and can also have an #extends tag -- which could result in `<p></p>`.

#### Use arrays?

It might be easier to grok if we build an array of templates with ancestors, instead of using a recursive function.

For example: 

```js
async function buildTemplate(nextRoute) {}
  const templateLayers = []
  while(nextRoute) {
    // Load the template and store meta info.
    const { template, path, isMarkdown } = await readFile(route)
    // returns <wrapper>, _layout, or false and template without extends/nolayout tags
    const { nextRoute, cleanTemplate } = await extractParentRoute(template) 
    // We know the parent route and stripped #extends and #nolayout tags
    const htmlTemplate = isMarkdown ? marked.parse(cleanTemplate) : template
    // We just potentially parsed markdown with #partials tags. We'll live with that.
    const withPartialsTemplate = parsePartials(htmlTemplate)
    templateLayers.unshift(withPartialsTemplate)
  }
	
}
```



### New idea... Back to recursive functions

I don't want {{#slots}} to wrapped in `<p></p>` tags either. So let's recursively call the parseExtends function passing in the child. 



```js
const template = buildTemplate(route)

async function buildTemplate(route, child) {}
		// Load the template and store meta info.
    const { template, path } = await readFile(route)
    // returns <wrapper>, _layout, or false and template without extends/nolayout tags
    const { parentRoute, cleanTemplate } = await extractParentRoute(template) 
    // We know the parent route and stripped #extends and #nolayout tags
    let htmlTemplate = isMarkdown ? marked.parse(cleanTemplate) : template
    // Is this a wrapper template for a child?
    if (child) {
      const wrapperParts = htmlTemplate.split(reSlotTag)
      if (wrapperParts?.length < 2) console.error('No slot tag')
      const htmlParts = path.endsWith('.md') 
      	? wrapperParts.map(p => marked.parse(p)) 
      	: wrapperParts
      htmlTemplate = [wrapperParts[0], child, wrapper[parts[1]]].join('')
    }
		// Continue wrapping?
		if (parentRoute) return buildTemplate(parentRoute, htmlTemplate)
    return parsePartials(htmlTemplate)
  }
}
```

