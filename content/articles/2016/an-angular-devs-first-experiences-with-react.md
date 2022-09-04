---
id: 18
layout: article.html
title: An Angular dev's first experiences with React
summary: "At a hackathon at work recently, I had a chance to use React
	for the first time. In this post, I want to summarize my thoughts on the
	framework, with an emphasis on how it compares to Angular – which I know
	fairly well."
created_at: 2016-02-29
---

In recent months, it seems to me that [React](https://facebook.github.io/react/) has established itself as the new cool kid on the JavaScript Model-View-Whatever framework block. And while this scene is notorious for being extremely volatile and susceptible to fads (see: [JavaScript developers are incredible at problem solving, unfortunately](http://cube-drone.com/comics/c/relentless-persistence)), I can't shake the feeling that in this case, it's more than just empty hype -- React genuinely seems to offer a different philosophy when compared to traditional JS frameworks like Ember or Angular.

I've read extensively about it, and the basic methodology -- generating a virtual DOM by means of a pure function of the application's state -- really resonated with me, perhaps because it seemed like a more functional approach than the DOM mutating in place that we are accustomed to seeing (which has a nasty tendency of turning into a mess as the size of the application grows -- I've witnessed this happen multiple times in my career already). Unfortunately, I have not had the chance to use it on a project, and reading can only take you so far. That's why, when we had a hackathon in our Madrid office in December, I figured this was a perfect opportunity to finally give it a shot.

While this was my first time developing with React, I have a fair amount of experience with Angular, as it was used quite extensively at my [previous job](http://pragmatists.pl). For this reason, the article will be written from an Angular's developer perspective, and will often compare and contrast the two frameworks.

### 1. React is fairly lightweight

Angular is a pretty big framework. It includes practically ever component you might need to create a complete, large scale front-end app -- things like a module system, a promise library, a test harness, a REST client, and lots of others. And while that approach certainly has its advantages, it also means you are pretty much locked in to doing things the "Angular way" -- anything different is usually simply not possible (as just one example, the module system is incompatible with [AMD](http://requirejs.org/docs/whyamd.html)).

Compared to that, React feels super sleek and almost bare-bones -- more of a library than a framework, to be honest. You have a way to register components and bootstrap the application -- and that's pretty much it. For instance, to do an AJAX request in React, you simply use jQuery. That was quite shocking to me -- I don't remember when was the last time that I used jQuery directly like that.

And yes, I'm aware that it's mainly because React is structured differently, and that there are in fact "batteries included"-style frameworks similar to Angular in that space (for example, [Facebook's Flux](https://facebook.github.io/flux/docs/overview.html)). However, I would argue that this is React's big advantage -- that you're not forced into one framework, but can choose between many (even Flux is more of a set of patterns than a framework, from what I've seen). You can even write a layer of abstraction above React yourself -- I've heard it [doesn't even take that much code](https://github.com/twincl/fluent).

This is a much more modular design. For example, you can't take out two-way binding and the digest loop out of Angular and use it to build your own framework. Angular is much more of a monolith than React in that sense.

### 2. Everything is a component

In Angular, there are usually multiple ways to achieve the same functionality. Do I use a Constant, Service, or a Factory? Should this be a directive, or just a normal Controller with some markup? If a directive, do we isolate the scope, or do we inherit it to save the clients some boilerplate? Do we get the data into the directive via two-way binding, one-way, or maybe set it in the `link` function from the attributes directly? Should the directive be an HTML element, or just an attribute? I can go on and on, but I hope you get the idea.

There are some community guidelines, of course, but a) they tend to change over time (we used to set the attributes directly on the `$scope` when defining Controllers -- now it's advised to use the `this` convention), and b) you can't guarantee everybody knows them (and their newest version, in particular). Which means that it's hard to achieve uniformity on a large project. Given the same task, it's very probable that two different developers would come up with two very different designs to solve it.

In comparison, React is super simple. Everything is a component. Because of that, there is no choice to make -- when you need to write new functionality, you write a new component. There is only one way that you can get data into the component -- through it's attributes. There is no data-binding (well, there is, sorta, but it's one-way, and managed for you by the framework), so you don't have to worry about choosing between the one-way or the two-way kind. You simply call the component with an attribute set to a value, and then read that value in the view rendering code -- simple and obvious.

### 3. React has a well-defined structure

This is an extension of the previous point, but on a larger scale. Angular, again, doesn't really have much to say on how to structure your application as it grows larger with time. There are varying opinions on things like how to utilize the module system more effectively (should you nest modules, keep them flat, or maybe just use one for the entire app?), bind controllers to views (some say it's best done with ng-controller, because that makes it always obvious which controller is bound to which part of HTML; others see ng-controller as an anti-pattern, and avoid it all cost), how to use routing effectively, and other questions that inevitably pop-up as your application scales in size.

React's documentation includes a section titled ['Thinking in React'](https://facebook.github.io/react/docs/thinking-in-react.html), which contains a pretty much ready receipe on how to structure your application. The promise is that this same method works equally well for both small- and large-scale applications. While obviously I can't verify that claim based on one hackathon, I've used it extensively for the small project, and I don't see a reason why it wouldn't work for a big application as well (also, the post is by an engineer at Facebook -- if it scales to their size, I think it's safe to assume it will scale to yours too).

The reason that structure is so well defined is because of the previous point. As everything is a component, the only sensible way to create an application of any size bigger than "Hello world" is to nest components. Because each one is isolated from the rest, they protect their implementation details from leaking out to the rest of your app -- the only way you can interact with a component is to call it with some attributes, which constitute it's public API. The virtual DOM architecture ensures that components cannot interact with each other through any other means -- most importantly, the real DOM, which has proven itself to be a big source of bugs and fragile solutions.

### 4. Mixing markup and logic is expected

In Angular, I was always uneasy when my templates contained too much code. I usually felt that I was somehow violating the separation of responsibilities -- it felt similarly bad to putting business logic in the View of a traditional server-side application. Almost without exception, whenever I found myself writing something like `ng-if="confirmedAccount && itemsInCart('SPORTS') > 2"`, I figured it was a code smell, and I should come back to this later and move the expression somewhere out of the template (usually to a method on the Controller).

In React, the situation is completely different. Because the component's HTML is defined by what a method on the component object returns, mixing markup and code is not only common -- it's actually the only way to do things! This frees you from worrying about where to actually put your code, and whether you're not inadvertently violating some good design principle. The component model also seems to me to encourage refactoring more -- sure, you can do it in Angular as well with directives, but having the benefit of the code and the markup hidden behind a well-defined public API and linked so closely in the file seems to make it even easier in React.

### 5. The JavaScript expression syntax in JSX is great

This is a small one, but I like it so much I figured it deserved a paragraph of its own.

I really, really like the way you embed JavaScript code in the JSX templates. For those not super familiar with React, it looks something like this: `<form class="horizontal-form" onSubmit={this.handleSubmit}>` -- the value of the `onSubmit` attribute is the result of evaluating the JS expression between the braces (`this.handleSubmit` in this case, which is a reference to a function). In Angular, you often see things like `<div class="section" ng-show="editable">` -- one is a hard-coded string, and the other is a reference to a JavaScript value, and they are both written in exactly the same way, which is often confusing (and the confusion only gets worse when the aforementioned multiple ways to pass arguments to directives enter the picture). The React way, on the other hand, is super clear -- you can tell at a glance what values are simple strings, and which are dynamic JS expression.

### 6. Passing things back and forth gets annoying

Finally, I'll touch upon something which I didn't like as much. The 'Thinking in React' article says that your major decision when designing a React app is where to house each piece of the application's state. Because the only way to structure your React applications is through nesting components inside each other, it may happen that the source for some data (for example, an input element) is very far away from the owner of that data (which may be some top-level form component, for example) in the component hierarchy. When that happens, you have to pass that data and the callbacks used for reacting on the user-input through all of the components between the owner and the source, adding extra attributes to each component on the way, which they don't need or use -- simply pass through to the child component(s). This can get really tiring, and the worst part is that the bigger and more nested your structure is, the more painful this problem becomes. That dynamic encourages you to write bigger, more coarse-grained components with more functionality, instead of smaller ones which do one thing -- the opposite of what we consider good design. The change callbacks are also pretty much boilerplate -- the only thing they do in 95% of the cases is update the state of the component owning the data.

Fortunately, I've heard that frameworks built over core React like Flux have this issue fixed, so it's not like there isn't a solution to this problem. But still, when using pure React, it's by far the worst thing about the framework.

## Conclusions

I think React is a very interesting framework, and after having some fun with it for a short while I'm definitely thirsty for more.

When I look back at the above list, I think there are some common themes that stand out:

* Angular is fairly loose, with a lot of freedom and many ways to achieve the same thing. Thanks to the 'everything is a component' rule, React is much more structured -- both in the small and in the large (in fact it uses the same design approach for the small and for the large)
* React is more functional in it's approach by having the View be a pure function of the Component's state
* React promises to achieve composability by forcing components to define their public APIs and banning any interactions through any means other than those public APIs by using the virtual DOM (in particular, components are not allowed to mutate the real DOM in any way, which has proven to be very fragile, error-prone and not scale well)

That's very interesting, because this general approach of doing things (favoring pure functions to achieve composability and avoiding mutability and side effect as much as possible) that React takes is also the reason why I think functional programming is a better long-term solution to many problems than object-oriented programming is -- but, that's a topic for another blog post.
