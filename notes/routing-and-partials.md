## Load as page or load as partial

I think this is a core principle of htmx app design. If I navigate directly to /books/new, I should see the books page with the 'new' book form already open. But if was previously on books/list for example, then the 'add new' button should only load the partial. 

The simplest way to accomplish this is to follow the Handlebars way of handling partials which is to keep them in a separate dir. I didn't really like this at first but it actually makes a lot of sense because then we can detect whether the request was htmx or not by checking headers. If so, we'll serve 'pages/books/new.html' -- which itself will include the partial 'partials/books/new.html'. If not, the we'll serve only the 'partials/books/new.html' directly.



### `res.isHtmx` and `res.partial`

These tiny little helper methods in launchpad-middleware allow for some very powerful routing.

```js
router.get('/new', async (req, res) => {
  const books = await getBooks(req.query)
  req.isHtmx
    ? res.partial('books/new', { books })
    : res.render('books', { books, usePartial: 'books/new' })
})
```

If it's an htmx request, we return only the partial. The `res.isHtmx` method tells us if the request headers included `hx-request` but did not include `hx-boosted` since that second header means it was just a regular page load but using htmx to replace the body instead of the whole page. So if was a _real_ htmx request, we could just send back a regular `res.render` like this:

```js
res.render('../partials/books/new', { books, layout: false})
```

...and that would work fine. Alternatively, use `res.partial` which is exactly the same with the following two exceptions:

1. The route path is prepended with `'../partials'`.
2. If a `layout` isn't passed in explicitly, it will be set to `false`.

Since this is a pattern that will be used throughout the app very often, the `res.partial` method will save a bit of typing and keep things clean.

### Loading the partial with the full page request

Notice above that the call to `res.render` passes in `usePartial: 'books/new`'. Since we aren't loading the partial from the router, we need to tell the template to load it. In the `books.html` template, we can do something like this:

```handlebars
<div id="modal">
  {{#if usePartial}}
    {{> (lookup . 'usePartial') }}
  {{/if}}
</div>
```

Remember that `usePartial: 'books/new'` was passed into this template only if accessed directly. So if that value was set, we tell Handlebars to load that partial dynamically by the path we passed in (`'books/new'` in this case). 

##### Standard partial include

```handlebars
{{> great-beers-of-the-world }}
```

##### Dynamic partial include

```handlebars
{{> (lookup . 'dynamicVarName') }}
```





### Very helpful tip to set default layout for a routes module

At top of file...
```js
router.all('/*', function (req, res, next) {
  req.app.locals.layout = 'admin' // set your layout here
  next() // pass control to the next handler
})
``

```

