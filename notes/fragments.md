# Fragments and Swap OOB

At a high level, it seems that a common pattern is going to be using an HTMX request to replace one or more chunks of the existing DOM. There are a few ways to achieve this. You could return a HX-Trigger headers in the response to kick off subsequent requests, for example. But that would require a series of full request/response cycles for each fragment.

HTMX does offer a solution for this: Out Of Band Swaps. The idea is to return an additional chunk of DOM with an `hx-swap-oob` attribute specifying the target.

So you might have a chunk of DOM that POSTs some form data to the server, then updates the form itself as well as another element on the page.

On the client:

```html
<form hx-post="update-qty">
  ...
</form>

<aside id="sidebar">
	...
</aside>
```



On the server, you'd return the form element and also at the top level, another chunk of DOM that looks like this:

```html
<aside id="sidebar" hx-swap-oob="true">...</aside>
```

Setting `hx-swap-oob` to `true` means that this extra chunk of DOM (which must be at the top level in the response, not nested), will *replace* the element `#sidebar`.

### Creating the response

Of course, we need a way to get that #sidebar element out of the template in order to send it as a response. Not only get it but also *modify* it to include the `hx-swap-oob` attribute. This sounds like a job for SaneJS middleware.

Example:

```js
res.swap('/products/123#sidebar', { vars })
```

This will insert a string of DOM into the `res.appendedSwaps` array. Using our example template above, the string would look like this:

```html
<aside id="sidebar" hx-swap-oob="true">
	...
</aside>
```





---



### *Hold on!*

Passing vars into `res.swap` could get very confusing

The strategy should be to render the template on the server-side as usual -- processing all templating and variables, etc. But then instead of returning the entire template, we only want to return the fragments that need to be updated. 

For cases where we want to do something fancy like inject a table row, that might be better as a separate method like `res.inject`. Hmmm... then we're still "building an array" which will require some other method to render those fragments. 

##### Maybe something like this is better...

```js
res.swap([
  { 
    template: '/products/123',
    strategy: //...boy this gets ugly fast!
])
```



#### or...

```js
res
	.swap('/products', '#sidebar', { vars })
	.swap('/products', '#otherThing', { vars })
	.render()
```

Feels like we're going to be feeding the same template and vars for every swap.



### Maybe we start very simple.

How about `res.swap`. It's exactly like `res.render` except that rather then returning the whole template, it includes only certain DOM nodes specified by `id`. 

The first swap is always the id of the DOM node that triggered it. HTMX automatically sends this as a request header: `HX-Trigger`.

So here's how it works:

```html
<form id="product-form" hx-post='/products/123'>
  ...
</form>

<aside id="sidebar">
	...
</aside>
```

If we want to only swap out these two elements rather than refresh the whole page, the router would look like this:

```js
res.swap(self, { vars }, 'sidebar')
```

The third arg is *additional* nodes by `id` to swap besides the one that triggered it. If we only wanted to swap the product-form and leave the sidebar alone, the request would look like this:

```js
res.swap(self, { vars })
```

This would look at the `HX-Trigger` header to find `id` of the DOM node that triggered the request, then use a DOM parsing library like Cheerio to extract `$('#product-form')` and return that chunk only. On the client, we'll assume that `hx-swap="outerHTML"` is set so that the node is completely replaced.

The "additional swap nodes" can be a string or array.



### How additional swaps work

Cheerio will extract the id matching the trigger node as the primary response as described above. If there are additional swap nodes, they will be appended and will have `hx-swap-oob="true"` injected into the parent node.



### Updating *only* other elements

Wanna trigger an update *only* to other nodes and leave the triggering node unaffected? No problem. The server will still include the primary node but we can just ignore it by adding `hx-target="none"` on the trigger node. OOB swaps are still processed normally but the trigger node will be unaffected.



### Next steps

1. Prove that trigger node sends HX-Trigger
2. Decide on HTML lib: Cheerio or --> https://www.npmjs.com/package/node-html-parser
3. Add res.swap which probably means extracting res.render logic to a seperate service so we can get back the completed template without actually sending it as the response.
4. Prove that we can swap just the primary node 
5. Add support for additional nodes.



### Modified idea to make things simpler, easier to grok

By default, HTMX response will replace the DOM element that triggered it. Then we list additional id's in res.swap for additional oob swaps. But this feels a bit unintuitive. Rather than have a "primary" response and "additional" responses, it would be easier to understand if you simply supplied a list of id's to swap which may include the primary.

Oh wait.

Then what's the default behavior for the element that triggered the request? We could replace it with nothing -- but that would be unexpected and presumably never what you want. We could *require* that you always include the triggering id - but what's the point of that?

Back to the original idea. `res.swap` will swap the element that called it with the same id from the supplied template. The current implementation is best.



### A MUCH simpler approach to opening a modal form (with refreshed content)

Instead of using Alpine to manage open or closed state, then *also* using HTMX to reload the hidden modal form with reset data – which is tricky because that blows away your Alpine state, instead of all that, we could just take advantage of HTMX's super-cool "settle" functionality. When you swap out a DOM node with the same id as the target but with class names added or removed, HTMX will first swap out with the same classes as the original target, then wait 20ms, then update the classnames. This means we can use really simple CSS animation for example to fade in the whole modal for example after the classname `isOpen` is added. 

So you click the button to open the modal which is hidden by default. The ajax request swaps out the current modal for the new one, then after the request has loaded, `isOpen` gets added and it fades in. To fade out, we could just use Alpine rather than triggering a new request. 

Or... we could reverse that. Alpine just adds the class `isOpen`. Hitting cancel could load the fresh modal form with the `isOpen` removed. Hmmm... in that case, you don't even need to do anything fancy on the server side to add a new class. The form just doesn't have the `isOpen` class by default. Let's try it!

Problem with that second idea: The "edit" button to open the form is outside of the form itself. So `x-data` needs to be the parent of both of them. Now when the new form loads inside, it doesn't pick-up the Alpine state because that's already been evaluated.

Also, if you have to wait 100ms or whatever on a slow connection for the new request, it feels more natural waiting for it to load rather than waiting for it to close. 

Ideally, we wouldn't load the blank, closed modal form at all on the first load. Instead, there should be an empty container for it:

```html
<div id="developer-form"></div>
```

When edit button is clicked, the server should load only that form – which includes the `isOpen` class. 



### res.swap vs res.partial

How do we load only the developer-form partial and swap it out? Perhaps res.partial should be exactly like res.swap except that it doesn't follow extends or layouts (instead of being otherwise like res.render).

Wait. This is early optimization. 



### Rethinking res.swap strategy (again)

I can't shake the feeling that it still feels a bit weird to have a "primary" swap and "additional" swaps. I also don't like that `res.swap` has three args whose order isn't really obvious and still feels very much like `res.render`. Instead of squeezing that third arg of id's to swap, how about if we call that as a separate function and then use `res.render` as usual. And let's require that if you want to swap only the calling div, you have to specify it. So `res.swap` will just set OOB elements.

Oh wait! Actually, right now `res.render` takes only two args. Why don't we instead just add a third arg which is the array of divs to swap. By default, `res.render` will render the entire template. But if a third arg is present, then it ONLY returns those OOB divs (with no primary response).

This makes so much sense. Feels like less to remember for the dev. Feels intuitive. The "primary" swap will be empty if a third arg is passed. But if the `id` of the triggering DOM is included, it will be passed back as an OOB if that works – if it doesn't, then we'll handle that under the hood similar to how the primary response is handled now.

 