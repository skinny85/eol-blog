---
id: 6
layout: article.html
title: The philosophy behind Oxyjen
summary: "In this post I try to explain the rationale behind creating
	Oxyjen, a code generation and scaffolding tool that I wrote."
created_at: 2015-04-12
---

I've been a little negligent in contributing to my blog lately. The reason is that I was busy working on another side project -- [Oxyjen](http://oxyjen.org), a code generation and scaffolding tool. I recently made enough progress with it that I felt it was ready to be released publicly. I won't repeat myself and explain what Oxyjen is and how it can be used in this post -- it's [home page](http://oxyjen.org) already covers that in great detail, and I would encourage you to give it a read if you haven't already. What I want to do in this article is talk more broadly about the subject -- why did I start the project in the first place and how I hope it can be useful to the programming community. But to get to that, I have to first explain some of my thoughts on our industry that I've acquired through the years working as a software developer.

## Background

I've been fascinated for a long time by the process of creating software. And while I consider programming to be a fantastic endeavor unmatched by anything else I know, one thing in particular always bothered me about it: that creating software is always so time-consuming. Of course, that is a very general statement; it all depends on the people, the technologies used and the particular domain that you are in. But as a rule of thumb, it very often seems that achieving something in software takes a disproportionate amount of time in relation to how big that achievement actually was. I think we can all recall when moving a button on the screen took us the bigger part of a day, or a story similar to that. Of course, you can say that it was something nobody could have predicted -- for instance, nobody knew before that change how the styles for that page were written, and it turned out that you had to rewrite half of them to change the location of that button without messing up the other elements on the page. And while that's true, the frequency of those unpredictable events is so high that, coupled with the predictably hard parts, their cumulative effect is what I said above: that creating software takes a long time.

That is kind of depressing, when you think about it. For example, I have tons of great new ideas for cool software projects that I could get around to. Unfortunately, for almost all of them, once I start to realistically think about how much time they will take, I have no choice but to abandon them even before I've started. I imagine it must be similar for a lot of you.

I've seen (and still do) this phenomenon of software taking too long (just ask any client of an IT company) so much that I believe it's not a factor of the people involved, the technologies or the domain -- it must be some complexity intrinsic to the work of programming. Is there anything that can be done about it? I'm not sure, but after thinking about the problem I came up with only one solution: code generation.

I assume a good deal of you flinched when you read that. Code generation is not generally held in high esteem in our industry. It probably stems from the past abuses that different technologies made using that term (for instance, generating bindings to consume SOAP-based web services). However, in more recent times code generation has been successfully used in a bunch of different projects like Maven, Yeoman, Ruby on Rails and many others. I think the key difference that separates the old approach from the new one is that these new tools understand that generated code is still **code** -- and that means it must adhere to the fundamental rule formulated by Harold Abelson in the classic ["Structure and Interpretation of Computer Programs"](https://mitpress.mit.edu/sites/default/files/sicp/index.html):

> “Programs must be written for people to read,
> and only incidentally for machines to execute.”

It is these traditions that Oxyjen builds upon, and expands.

## My views on the benefits of code generation

So how can code generation (and, more specifically, code generation with the output meant for a human) help to alleviate that fundamental complexity of programming that I mentioned is the problem earlier?

### It allows you to concentrate on your domain

If you take a very birds-eye view of software development, you can think of it as separated into two different areas. The first is your domain -- that something special about your application, the reason for it's existence, the thing (or things) that make it different from any other software in the world (it has to have something like that, because if not, than what's the point in creating it -- just use something that's already existing!). The second is all the rest -- the infrastructure, the "glue code" that forms the foundation on which the realization of those domain goals can be built. Naturally, you want to focus as much energy as you possibly can in the first area, because that is where the value is produced. The infrastructure makes sense only as a means to that end. This is what templates try to achieve -- take as much infrastructure weight off your shoulders as they can to allow you to focus the maximum amount of your energy on the value-adding aspects of your application.

### It's faster to edit something existing than to start from scratch

This is my personal observation which might not be universally applicable, but I found that it almost always takes significantly less effort and mental fatigue to change some existing, working solution to fit your changed requirements (perhaps generalizing it in the process) than to arrive at that same solution but starting from a blank slate. If think most developers have a similar experience when they join a project for the first time -- the best way to learn how to do something is usually to find a solution to an analogous problem that has already been solved. This is the idea behind scaffolding -- to provide you that skeleton that can then be shaped to fit your particular case.

### It frees you from the need of immediate knowledge

As developers, we have to posses incredible amounts of (often very specialized) knowledge. In fact, we are so used to this that we often don't even realize how much we know -- until we have to explain something that requires at least a piece of that knowledge to someone, for example to a new member of our team or (even better) a non-technical person. Templates allow you to start using some technology or approach without overwhelming you with all the minuscule but essential details needed for it to function correctly. The idea is that the template author did that work for you. As you continue to use whatever it is that the template provided, you will naturally run into corner cases that will require you to learn more and more of those details -- but that is a natural process for us developers that practically all of us experience every day.

### It fosters experimentation

In a similar vein, using templates allow you to experiment more easily with different approaches. The risk is mitigated by freeing you from all of those details, while you can evaluate the approach and whether it suits your particular needs.

### It reduces the amount of choices you have to make

There are interesting studies about how our decision power is limited (see, for example [this link](http://www.nytimes.com/2011/08/21/magazine/do-you-suffer-from-decision-fatigue.html?pagewanted=all&_r=0)). Templates free you from some of those decisions to "save" them for the more important stuff later.

### It allows you to tap into the knowledge of others

Programming is very collaborative. I'll talk more about it later on, but anytime you use a template created by someone else, you get access to some of their expertise -- which might be different than yours. You might not agree completely with their way of doing things -- that's fine, and understandable. You can change the generated code any way you see fit later. But there's a chance for learning something every time you engage in this process.

## Sharing is good

But the ease of accessing and using code templates is only one part of the story. Another important focus of Oxyjen is to make creating your own templates and sharing them with the rest of the world as painless as possible. Why is that so important?

### It creates another channel for sharing knowledge

I hope I don't have to convince anyone about the advantages of the free flow of knowledge within an organization or team (or even the entire world, if you don't think that sounds too lofty). The sharing capabilities of Oxyjen offer another, unique avenue for that flow, and increase the overall amount of knowledge sharing that can happen.

### It allows you to create and maintain standards

Templates are a great way to create standards within your team/organization that are much easier to follow and lightweight than long, written documents or Wiki pages. Because of the way templates are versioned, it's also very natural for those standards to evolve as the knowledge, technical choices, business situation or any other factor changes.

### It helps with faster onboarding

Having a large body of ready to use, standard templates also naturally aids in onboarding new members, both into the entire organization and also into specific projects.

### It aids collaboration

I don't think we appreciate enough how collaborative, on the global scale, programming really is. We write open-source software that anyone in the world can use. We answer questions on StackOverflow with the intent that that answer will be read by any number of people, for some unknown amount of time into the future. We submit and discuss issues and pull requests on sites like GitHub -- a lot of us do it multiple times each day. We run IRC channels where people can come and ask about any piece of technology, and often get the answer directly from the creators of said technology. I believe our industry is truly unique in this regard. I would love to think that the sharing capabilities present in Oxyjen, in some small part at least, aid in maintaining and strengthening this global community.

## Summary

So, those are the reasons why I strongly believe a tool like Oxyjen is needed. I encourage you to go the [website](http://oxyjen.org) and give it a try. I would also love to hear your feedback, both on this post and Oxyjen the tool itself.
