---
id: 17
layout: article.html
title: Recreating the code from the 'GOOS' book example project
summary: 'Just a quick entry talking about my project recreating the example
	developed in Part 3 of the "Growing Object-Oriented Software, Guided by
	Tests" book.'
created_at: 2016-01-31
---

In the book ["Growing Object-Oriented Software, Guided by Tests"](https://www.amazon.com/gp/product/0321503627/ref=as_li_tl?ie=UTF8&tag=endoflineblog-20&camp=1789&creative=9325&linkCode=as2&creativeASIN=0321503627&linkId=ddfb1e4d66ed48d7afdb4063de0e7b32) (which is really great - can't recommend it enough), the entire Part III is dedicated to developing an example application which demonstrates how the authors practice their flavor of Test-Driven Development. The example is very interesting, especially because it illustrates developing a fairly large application (well, large for a book example, but still). However, it's comparative complexity also meant that the code pretty quickly became difficult for me to follow.

Due to the nature of books, you only get to see the application a small snippet of code at a time. There is no way to see the project in its entirety - you have to keep it all "in your head". This usually works because the examples in books are small - this one, though, is deliberately pretty big, like I said already. Because of that, it fairly quickly overflowed my small brain, and I couldn't really follow the authors' train of thought very well.

There is an official repository on GitHub containing the source code for the example (you'll find it [here](https://github.com/sf105/goos-code)). There is a problem with it, however: it only contains the final version of the code. In the book, the project took over 150 pages of development to finally arrive at that structure. There were multiple moments when some design insight led to large, cross-cutting changes, both to production and test code. Functionality was added incrementally, using multiple instances of the Red-Green-Refactor cycle. In fact, the entire point of the example project was to illustrate how these cycles look like, as it is somewhat different than the "traditional" way we think about TDD.

Looking only at the end result stored in that repository misses all of that. It's not about the destination, but the journey getting there. And it's a real shame, because the example is very educating - the way the authors approach the problem is completely different than I would go about it, for example. It's also hard to follow the design insights that led to some large refactorings without seeing the actual design.

For all of the above reasons, I decided to write down the code, step by step, as I was progressing through the book. You'll find the end result on GitHub here:

<p style="text-align: center">
[skinny85/goos-book-code](https://github.com/skinny85/goos-book-code)
</p>

I've tried to stay as true to the flow of the book as I could. The repository history reflects the development as it proceeded through the chapters of Part III. I made commits after every step (Red, Green, Refactor) of the TDD cycle, and after every modification that was performed outside of that cycle. Every commit message also contains the page number that the change happened on. If you were to step through the Git history, you should be able to see the evolution of the code exactly as it happened in the book (that was the goal, at least).

There are certainly minor, non-functional differences between my version and the original. One is indentation - I used the more standard 4 spaces, while the book used 2 to make the most code fit on the page. I also added blank lines in a lot of places for clarity, which were missing from the book for the same reason. Some things like certain names or String constants, order of methods etc. might also be different. Additionally, a large part of the code was only hinted at in the book, but never actually shown - in those cases, I relied on the official repo, or did my best guess.

I also changed the build system from Ant to Gradle, which eases IDE integration (among other things). I think all of those differences are minor. The most important point of the example - incrementally developing a fairly real-life application using Test-Driven Development, including end-to-end tests - should (hopefully!) be preserved.

Don't forget that in order for the integration and end-to-end tests to pass, you need to run a local XMPP server - see the details in the [readme](https://github.com/skinny85/goos-book-code/blob/master/readme.md) of the repo on GitHub.

If you have any problems with running the code or tests, or see any potential improvements, please open an issue, or, better yet - contribute a pull request!
