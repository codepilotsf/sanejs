# Simplified render strategy

HTMX defaults seem to start with the idea that most of the time, you'll want to replace the inner content of the triggering element with the response from the server. But most of the time, this isn't true.

Most of the time, I want to do one of these three things in decending order likelihood:

1. Swap entire `body` of document with `body` of server result (`hx-boost` behavior)
2. Swap specified elements by id, not including the triggering element
3. Swap the triggering element (and possibly others by id too)

So ideally, if we just set defaults on doc to `hx-swap="none"` – actually this doesn't work because then if you want to use `hx-get` for example to navigate to a page when a table row is clicked, it doesn't swap anything. Speaking of that, setting `hx-target="body"` as a default is a bad idea because this will break out of band swaps when the "primaryResponse" goes to body instead of the triggering element.

### Maybe just work WITH HTMX instead of against it.

I think I'll probably keep the default swap method set to `outerHTML`. But all this stuff about setting defaults to `hx-target="body"` and `hx-swap="none"` and then overriding these when we want default settings – it gets weird fast. So let's keep it simple. HTMX responses are different from regular `href` links. Deal with it. If you want to target the whole page for click on a `tr`, just use the appropriate HTMX on that element or its parent if that helps to keep things DRY. 

So let's go through my list. For #1, either use a plain old `a href` (which will be hx-boosted) or do something like `<tr hx-get="user/123" hx-target="body">`. Ain't no thang.

For #2, set `hx-swap="none"` on the trigger, then include an array of id's to swap as the third arg to `res.render`.

And for #3, you could just use HTMX native behavior to swap at the only the triggering element. If you want to swap the triggering element and also others, then use an id and include the triggering element id in the array of swapIds.

### Hmm.... Maybe working with HTMX natural behavior means accepting that the response normally replaces the triggering element.

This means I should change the behavior of `res.render` so that – oh wait. The problem is that there's no way to pull out "this element" to swap for the triggering element unless that element has a (unique) id. So actually, the way I have it now is probably best. `res.render` is totally consistent with standard HTMX behavior when you pass only 2 args. The result simply replaces the trigger element unless you specify some other target. If you pass a third arg, then you have either include the id of this element in your list of OOB swaps, or just set the triggering element to `hx-swap-"none"` to leave it unmolested.