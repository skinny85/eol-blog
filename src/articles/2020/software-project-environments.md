---
id: 46
layout: article.html
title: Software project environments
summary: |
  Almost all software projects beyond the most trivial ones have multiple environments involved –
  production, of course, but also test, development, pre-production, etc.
  This article goes into details of the various environments that are utilized in a typical software project.
created_at: 2020-05-31
---

Almost all software projects beyond the most trivial ones have multiple environments involved --
production, of course, but also test, development, pre-production, etc.
This article goes into details of the various environments that are utilized in a typical software project.

## Local environments

These are the environments that each person working on the project
(software developers, testers, project owners, etc.)
stands up locally on their own desktop or laptop.
This is the only environment type that's not shared,
but private to the person owning it --
it's their own little playground,
where they are free to experiment and try things out without any consequences for making mistakes.
It's also where they primarily attempt to reproduce bugs,
and verify fixes for them actually work.

It seems counterintuitive, but,
even though these environments are never accessed by anybody other than their owner,
I believe they are actually the most important type of environments discussed in this article.
The reason I say that is because it's vitally important for the long-term health of any software project to be able to quickly and easily spin up a reliable local copy of the production environment.

Without that ability,
the only way to see your changes is to deploy them into one of the shared development environments.
That way of working makes it impossible to iterate on the project quickly
(and, as I've said before on this blog,
in my mind
[shortening the feedback loop is the most important thing you can do for the health of a software project](/most-important-principle-in-software-development-shorten-the-feedback-loop))
and to reliably test changes before releasing them.
In these circumstances, the cost of each software change rises up dramatically,
which means the project's development pace slows down to a crawl;
and the number of defects released increases because of the more involved testing process,
which makes releases more risky in the eyes of the project's stakeholders,
which slows their pace even more, which slows down the development pace even more, etc.
Once you've entered this sort of "death spiral",
it's very hard for a project to recover.

[Docker](/optimizing-development-with-docker)
is one of the more interesting technologies for easily setting up a local development environment --
the idea is to use exactly the same container image in all environments!
Using tools like [docker-compose](https://docs.docker.com/compose),
you can stand up a complicated, multi-container application with a single command.
There are also services,
like [Gitpod](https://gitpod.io) and [GitHub CodeSpaces](https://github.com/features/codespaces),
that offer a turnkey local development experience --
click a link in the browser,
and a new, private development environment will be spun up for you,
backed by a virtual machine somewhere in the Cloud,
along with an in-browser IDE,
all ready for you to make changes.

## Development

Development (often called 'dev' for short)
is the first of the shared environments.
It's almost always hosted in a network-isolated place,
not accessible from the public Internet,
which means only the development team has access to it.
If the project has a separate sponsor,
they don't have access to dev either --
it's considered a safe haven for the development team to try things out and experiment,
without worrying about consequences if somebody from outside the team saw it.

Because of the network isolation,
dev has its own copy of the database.
Usually, dev data is used solely for testing,
so it tends to get filled with goofy,
funny data as time goes by --
although it's not uncommon to copy some data for testing purposes from prod back to dev once in a while.
Because of that data separation,
dev is a safe place to play around and experiment.

It's assumed that teams will do most of their functional testing in dev;
later stages should focus more on non-functional tests like performance,
security, etc.,
and getting acceptance from sponsors if the project has them.
In general, it's a bad sign if a functional bug makes it out of dev.

In this modern day of microservices architecture,
dev also serves one more important purpose.
If you want to work on a single service in a system like that,
you shouldn't be required to stand up all of its service dependencies at the same time,
as that might lead to a huge chain.
For example, imagine you want to make a change to service A,
which calls service B in its implementation;
so, in your local development environment, you spin up both A and B,
but then it turns out B calls service C, etc.
In many cases, B or C might be owned by a different team,
and you might not know how to create local environments for them --
they might be following a completely different process from yours!

In these sort of microservice projects,
when you stand up a local development environment for A,
it will by default call service B in dev,
which allows you to break the dependency chain,
and make sure that any changes you make to A can be tested with only A's local environment.

### Pre-development

Because of this use case,
breaking the dev environment of your service might have terrible consequences if your service has many consumers --
you might break local development environments of other teams,
which will most likely block them from making any changes to their services for as long as your dev environment is down.

Because of that, some projects with a microservice architecture have a pre-dev,
which shares the databases with dev,
but allows teams to do a round of
[integration or end-to-end testing](/unit-acceptance-or-functional-demystifying-the-test-types-part1)
in their
[Deployment Pipelines](https://www.amazon.com/gp/product/0321601912)
before releasing to dev and potentially affecting their consumers there.

Of course, pre-dev, even though it's a shared environment,
is considered the private property of each team --
you should never take any service dependencies on the pre-dev environment of a different team.
Specifically, your own pre-dev environment,
if your service has one,
should call your dependencies in their dev environment,
*not* their pre-dev.

## User Acceptance Test

The UAT environment, often called just 'test' for short,
is the second shared testing environment.
In contrast to dev, it's not network-isolated,
and is very likely available from the public Internet
(which allows you to test your DNS setup before going to prod).

Since this is the first shared environment accessible outside the corporate network,
if the project has sponsors,
test is the environment they use for playing with new features and verifying they work as expected.
Test is also where you often do non-functional tests,
like performance testing, or security testing.

The big question with test is whether it shares the database
(or service dependencies, in case of microservices) with production,
or has its own, independent dataset.
Each solution has its pros and cons:
a separate database means you're not polluting your production database with test data when experimenting
(or when the sponsor is experimenting),
and any performance tests are guaranteed not to cause outages in production.
On the other hand, your performance tests will be less realistic,
as they will not exercise the same data patterns that are present in production,
which means their reliability will be lower.
You also won't test your production configuration in this environment if you decide to have a separate database
(or service dependencies).

### Staging / Pre-production

Because of that, in projects that have a separate database or dependencies from prod in test,
it's necessary to introduce one more shared environment: pre-prod,
sometimes also called 'staging'.
It's very similar to test,
but, like pre-dev for dev,
it always uses the same database as production
(or production dependencies, in the case of a microservices project).
Its usage is usually limited to testing the production configuration with some light functional testing with real data,
and automated performance tests.

Of course, testing in this environment has to be done with care,
as it can affect your users.

## Production

And finally, production -- the ultimate destination for your project,
where your end users interact with your product.

Production is the most important shared environment,
and the lifeblood of your product,
so I won't go into too much detail here.
I'll just say one thing:
make sure to not actually put the word 'prod' in any user-visible names,
like URLs!
While it's common to have the UAT environment for a project called MyProduct have an URL like `test.myproduct.com`,
do **not** make the URL of your production environment `prod.myproduct.com`!
Wouldn't you feel weird if your LinkedIn URL was `prod.linkedin.com/in/yourname`?
It should be just `myproduct.com` --
in that sense, prod is the default.
This rule should be adhered to even if your project is internal to your company,
and the production environment is not accessible from otuside your corporate network.

## Summary

There you have it --
those are the typical software environments I've seen used in many projects.
Interestingly, even though project may vary wildly between each other
(some may be websites, some just service APIs;
some may be rendered on the server, others will be Single-Page Applications, etc.),
the various environments used for developing them seem to pretty much always follow the above patterns.

One thing that's not very well standardized are the names, though.
While 'dev' is pretty universal,
some people call UAT 'staging',
even if it has a completely separate dataset from production.
Those should be fairly easy to spot, though,
and the general philosophy behind the various environments should be the same as in this article,
even if their names are different.

Did I miss any environments that you use in your projects?
Let me know in the comments!
