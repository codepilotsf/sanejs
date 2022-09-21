# New thinking about pages/partials

The problem is there are three dirs: pages, partials, routes. But we really need routes for partials too. Why?

We need to be able to use htmx requests to replace a part of the page with `hx-get="_/my-partial"` and it will sometimes need to be populated with vars.

So where do we store these partials routes? The pages/partials views are nicely separated in separate dirs. So we shouldn't have some other totally different convention for splitting the pages/partials routes. But I don't want to have routes-pages and routes-partials either.

Solution: Partials live in a `_/` directory in both views and routes.

```
routes/
	_/ # Partials
views/
	_/ # Partials
```

Very clean and simple. 

So we're changing the name "pages" to "views" and changing "partials" to simply, "_" as a child of both routes, and views.

#### res.render

Instead of res.page and res.partial, we'll use the more generic res.render for both pages and partials. 

#### res.partial

Using `res.partial('my-partial', { locals} )` will work just like res.render but it will automatically prepend the route with `_/` and will not wrap in a layout. I think this is also helpful just to see it visually in the routes -- at a glance, we can see that this is a partial -- not a full page response.

#### Requests from htmx

Importantly, the auto-routing for views should detect routes beginning with `_/` so that `res.partial` is used to render these pages instead of `res.render`. Note that partials routes need no further magic -- they'll work as is: `hx-get="_/my-partial-route"` already hits the correct route as long is there a partial route at `routes/_/my-partial-route.js`.



### Next steps:

1. Get res.partial working (sets isPartial=true and calls res.render)
2. Test `hx-get="_/my-partial"` and `hx-get="_/my-partial-route"`

