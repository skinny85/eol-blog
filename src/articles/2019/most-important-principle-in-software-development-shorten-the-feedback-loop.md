---
id: 43
layout: article.html
title: "Most important principle in software development: shorten the feedback loop"
summary: |
  In this article,
  I want to talk about what I believe is the fundamental principle underlying all successful software development:
  shortening the feedback loop.
created_at: 2019-12-30
---

In May of 2020, I'll be celebrating 9 years as a professional software developer.
That amount of experience is usually linked to prefixing your job position with titles like 'senior', 'staff', etc.
While I'm not sure I'm deserving of those titles yet,
I feel like I have some thoughts on software development in general,
based on my experience being part of many different projects.
Some of those projects were successful, some of them were not,
and I find it interesting to reflect on why that was:
what makes software development work in some cases,
and fail in others.
After all, ideally all software projects we're part of are successes,
so any universal principles that we can glean from past experiences seem valuable to me.

## Big picture

Let's step back for a second from the details of software development --
whether static typing prevents more bugs than dynamic typing,
whether Gradle is a better build system than Maven,
whether spaces are superior to tabs --
and let's focus on the bigger picture:
what's the most important quality software, any software, has to posses?

I would argue that it needs to fulfill the needs of the humans using it.
If it doesn't, then it's by definition useless --
because if no one can get anything useful out of it,
then it's just a waste of time and energy to run it.
Software is not like art in this sense --
we don't write code to hang it on a wall in some gallery.
We write code to be executed,
and for that execution to fulfill some human-devised goal --
whether that goal is uploading a picture of your cat on social media,
writing a doctoral dissertation,
or emailing your mom.

If we accept that premise,
then it seems natural that there is a single,
most important question that guides the development of any software project --
regardless of what kind of software it is,
regardless of which specific technology is used to build it.
That question is extremely simple, and it is:

> Does this code, that has just been written or changed, do what I need it to do?

This question is not asked once, but constantly --
hundreds, thousands of times during the lifetime of a project.
Every time any sort of change is performed on the software,
it comes up.
Each group of stakeholders asks it separately,
on a different cadence.
Developers working directly on the code answer it multiple times a day.
Quality assurance engineers might do it every time a piece of functionality has been deemed "done" by the developers.
Sponsors usually ask it at the end of a project iteration or milestone.
Customers might be interested if the newly released feature that they've been waiting for works like expected.

This question implies a loop:
if the answer is "yes", that's great,
and we can move on to making or verifying another change;
if the answer is "no",
we need to keep iterating on the current change,
until we can finally say "yes".
As we established above,
we cannot accept "no" as an answer here --
that would mean we are OK with shipping useless software.

My thesis is that the most important principle in software development
is making this feedback loop as short as possible.
Successful projects are those that are able to accomplish that;
unsuccessful projects, almost without exception, have issues with this loop being too long.

When you think about software development this way,
you start to see this principle in many seemingly unrelated practices.
Some examples are:

#### Test-Driven Development

TDD is for shortening this loop for the developers working on the code of the project.
It does it in two ways.
First of all, the [Red-Green-Refactor](https://www.codecademy.com/articles/tdd-red-green-refactor)
cycle ensures that the production change has the desired outcome
(by making the previously failing test pass).
Secondly, the ever-growing test suite guards against regressions,
shortening the feedback on whether the change inadvertently affected some other functionality.

#### Continuous Integration

[Continuous Integration](https://www.thoughtworks.com/continuous-integration)
shortens the feedback loop for inter-team synchronization.
Before CI became common practice,
projects used to schedule a separate integration phase where modules developed by the different teams would be combined into a single system for the first time.
This meant the feedback loop on the project actually working as a whole was many months,
if not years, long.
Continuous integration deliberately shortens that;
by saying developers have to integrate with mainline at least once a day,
that feedback loop should be no longer than 24 hours.

#### Agile

All agile methodologies emphasize the need for rapid feedback.
In traditional waterfall software development,
the customer might first use the system
(and thus, can first give feedback on it)
possibly years after it was started.
Needless to say, that long of a feedback loop is often disastrous.
That's why agile practices like Scrum emphasize the need for a demo of the working product,
with the customer present,
at the end of every sprint.
This ensures that this feedback loop is never longer than a few weeks.

## Summary

I hope I gave you something to think about.
I know making this realization changed my attitude towards many problems.

For example, often when trying to understand the runtime behavior of some piece of code that's not obvious from its source,
my first instinct is to add print statements at different places to try and see the values of the variables at various points in time.
But then I realize by using that simple, easy method I'm lengthening my own feedback loop,
and I make sure to use the debugger instead,
which allows me to get to that information much, much faster.

Can you think of more examples of software development practices whose goal is to shorten this feedback loop?
Let me know in the comments!
