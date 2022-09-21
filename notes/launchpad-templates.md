# Custom template system

Hmmm...

Handlebars is pretty good but makes some decisions I'm not loving. For example, there's no way to choose the layout from within the child template. You *have to* send that in as an option with the `render` call. 

### What is a template system anyway?

It's just middleware that adds `res.render`. That's it. 

When you call `res.render`, that function loads the templates into memory and swaps out the placeholders like `{{firstName}}` with the value passed into the function. It also swaps out things like `{{> my-partial }}` and `{{#if}}` -- but at the end of the day, it's really just loading templates and swapping out values. This is not rocket surgery.

### Core features

- Basic variables: `{{myStuff}}` (escaped by default)
- Unescaped values: `{{@myHtml}}`
- Conditionals: `{{#if isOpen}}` and `{{#unless isOpen}}`
- Loops: `{{#each things[, index]}}`
- Partials: `{{> inner-form }}`
- Escape char: `<pre>\{{preserved-example-code\}}</pre>`
- Front matter: (see below)

### Front matter

This is the killer feature I'm missing from Handlebars.

I want to be able to set a default in my _layout.html like this:

```
---
title: My Awesome Website
description: This is a killer website. You should totally check it out.
---
```

For any page using this layout, the default behaviour will be to set the value of {{$title}} and {{$description}} which should be referenced in the template like `<title>{{$title}}</title>`

But... If a child template uses front matter to set the title, that will be used instead.

```
---
title: My Mediocre Website
description: meh.
---
```

You can also set the layout or sublayout using `extends`.

```
---
extends: products-page
---
```

 ...which in turn extends `_layout` by default.

This too could be overridden with: `layout: false`. The rule is: First in takes precedence.

So if we call `res.render('product-detail')`, and that template `extends: products-page` and also sets the  `title: superwidget`, then that's going to be the title regardless of what anything further up the chain says. 



### Order of parsing

1. Build full page with parent templates and partials (and save to memory cache!)
2. Remove failed conditional blocks
3. Parse loops
4. Swap out vars



### First steps to prove

1. Make a copy of launchpad -- strip almost everything away except auto-loading routes/templates.
2. Make a `render` middleware that only wraps page in default template
3. Add extends and partials
4. Add basic variables, then with escaped vals



### A new challenge... res.render SHOULD error if no template

For auto-routing to pages, I want to fail silently and try the same with /index appended. But this cannot happen inside `res.render`. That's why Handlebars implemented a callback function -- and that's what I should do. 

Here's why...  If in a route I call `res.render('does/not/exist')` I need an error in the logs! But if I call it from the app.js and give it a callback function to try again 

UPDATE: Nailed it.



#### Thinking about syntax

I defaulted to handlebars syntax -- but why not just use Svelte-inspired syntax -- it's cleaner and already familiar.

One change, I'd like `#each` to default to `this` as handlebars does. But with an optional second arg (comma delimited) like this:

```{#each books}```

If you want the index...

```{#each books, index}```

##### For variables, let's keep it simple

```{book.id}```

Remember that escaping is simple... Just prefix with a backslash

```\{book.id}``` --> gets converted to text: `{book.id}`

...and in the extremely unlikely event you *meant* to write that as plain text and don't want it to be parsed by the templating engine, just add a second backslash: `\\{book.id}` --> gets converted to: `\{book.id}`



### Layouts should be more declarative

Going down this road with `{#extends}`, I realize that you should almost never need it. Let's instead assume that your page will wrap itself in whatever _layout is in the same directory, or the next one up if none, etc. In rare cases where you want to declare a different layout than the default one for that section, use this:
`{#layout _alt-layout}`

or
`{#nolayout}`

### ...or should this be in the front-matter?

Probably. If layouts will almost always come from nearest parent dir, that's 99% of use cases. So in the rare case we want to use something different, how about:

```
---
layout: _alt-layout
---
```

or

```
---
layout: false
---
```

that's pretty good!



### Front-matter is ONLY for vars that travel up

And that means that `layout` breaks the pattern. Let's decide right now. Templates are autowrapped in nearest parent _layout. If you want a page with no layout, you can add `{#nolayout}` to the top of (or anywhere in) your template.

It's nice that front-matter can contain arbitrary values. Of course we'll want things like `title` and `description` to shoot up to the top, but also things like `activeNav` or `currentlySelectedProduct` or whatever else you want to put in there.

Then these will always be injected and available with names prefixed with `$` . So if the child template has `currentId: 4` in the front-matter, then the layout will receive the var `$currentId ` which can be used in the template.

You should also be able to send these to templates from routes by setting them directly:

```
res.render('about', { $currentNav: 'about'})
```

...but usually, it will be more convenient to set this in the child template front-matter:

```
---
currentNav: about
---
```



### More thoughts on front-mattter

I was thinking that overriding front-matter would be tricky and that it should just be hard coded into the template and cached. But that means things like `title` could *never* be overwritten or extended. So the `product-detail` page will be hard-coded with something like `Product Detail` and could never use the actual product name from the DB.

Better plan: For each path, cache the template and the front matter.

```js
cache = {
  '/path/to/pages/about-us.html': {
    template: `<html><title>{:$title}</title><h1>About Us</h1></html>`,
    frontMatter: { title: 'About Us' }
  }
}
```

This means the server will have to interpolate these values for each request -- but it's cached so it won't have to read from disk at all.

##### How it will be parsed

Contrary to the previous plan, I think all pages including layouts should be allowed to have front-matter and front-matter should also be settable in the same template. This way, layouts can set default values which can be overwritten by child templates.

```html
---
title: Our amazing website
---
<title>{:$title}</title>

```

And then, a child template could set title to something else and that will take precedence.

