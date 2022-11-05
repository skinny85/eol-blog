---
id: 67
layout: article.html
title: Big Tech uses neither Agile nor Waterfall
summary: |
   In this article,
   I want to expand on the points Gergely Orosz
   from the Pragmatic Engineer newsletter made in his article
   "How Big Tech Runs Tech Projects and the Curious Absence of Scrum",
   and explain why these companies, for the most part,
   don't use Agile (and thus, Scrum).
created_at: 2022-10-31
---

Recently [Gergely Orosz](https://twitter.com/GergelyOrosz),
the author of the [Pragmatic Engineer newsletter](https://www.pragmaticengineer.com),
wrote a post on his blog titled
["How Big Tech Runs Tech Projects and the Curious Absence of Scrum"](https://blog.pragmaticengineer.com/project-management-at-big-tech).
It's a great article, but reading it,
I couldn't shake the feeling that an important reason for the absence of Agile in these companies was missing from it.
Because of that, I decided to add my two cents to the discussion with this article.

I think my experience gives me a unique perspective on this topic.
I've worked for two Big Tech companies
(Amazon and Apple),
and also for a more traditional software development consultancy that did a lot of work in the public sector,
where customers pretty much always require their contractors to use Waterfall.
So, during my career, I've encountered approaches to project management from all ends of the Agile-Waterfall spectrum.

## Agile Manifesto background

The [Agile Manifesto](https://agilemanifesto.org)
was released to the world in 2001.
However, the experiences that shaped the perspectives of its signatories on software development happened predominantly in the 80s and 90s.
Those experiences took place in traditional companies that were created before computers became an integral part of our lives,
and who were trying to adapt their business and processes to take advantage of this new digital revolution.
As an example, [C3](https://en.wikipedia.org/wiki/Chrysler_Comprehensive_Compensation_System),
the project that is the poster child for [Extreme Programming](http://www.extremeprogramming.org),
one of the subgroups within the authors of the Agile Manifesto,
was developed between 1993 and 1997 for the auto maker Chrysler --
a great example of a "traditional" company taking advantage of the new computing technology.

Agile's main focus was bridging the divide between the "new"
experts who were developing software,
and the "old" employees, who hailed from the pre-software era --
in particular, this group often included the management of the company.
The "new" people were treated with mistrust by the "old" guard.
The "new" folks used esoteric terms that sounded like gibberish to everyone outside of their group,
and dealt with complex technical areas that only they understood.
They also wanted to change a lot of things about how the company operated,
thinking they could make things more efficient.
This was unsettling to management at these traditional companies,
which was accustomed to dealing with predictable,
repetitive work that they could feel, touch and judge the effects of,
and which struggled to manage something as abstract as software delivery.

This strained relationship between the "old" and "new" employees
is best epitomized by Scott Adam's comic strip ["Dilbert"](https://dilbert.com),
where we see the struggles of a typical engineer dealing with his non-technical,
"pointy-haired" boss.
The manager is predictably clueless about the intricacies of software development,
but too stubborn to admit any shortcomings in his knowledge.
As you can expect, many hilarious moments ensue.

Agile was touted as the cure to this problem;
a way to develop a working relationship between the two sides based on clear rules,
and it promised, as long as those rules were being adhered to by both parties,
that everyone will benefit from adopting this methodology.
The "new" employees will no longer be barraged with a never-ending stream of requests from management,
and constantly interrupted to answer questions about the status of the deliverables.
The "old" employees were promised a predictable pace of delivery,
seeing progress (through demos) often --
at most every few weeks --
and the opportunity to give feedback during the delivery process,
not only at its end.

## New kind of company

In the 1990s, a seismic event in tech history took place: the dotcom boom.
This is when the Internet started becoming mainstream,
and millions of users were connected to the World Wide Web for the first time.
This boom gave rise to a new kind of company:
one where computers were not an addition to some existing business model,
but where software _became_ the business model,
being the company's main (and often only) product.
Many startups launched during that era:
Google, Amazon, eBay, Yahoo -- are Internet giants to this day.
None of them used Agile, as that term was not coined yet.
However, they were able to deliver world-changing innovation at a pace unheard of in traditional,
pre-tech companies.

After the dotcom bubble burst in the early 2000s,
basically all successful software startups founded in later years --
companies like Facebook, Uber, Twitter, Netflix, Stripe, AirBnB, and many others --
followed the playbook of the Internet boom's early giants,
and that meant foregoing Agile for the most part.

The reason why these companies didn't need Agile is because the main problem Agile aimed to solve --
bridging the divide between tech and non-tech employees --
does not exist at these companies.
They are started with software at its core,
not as a supplement to a different business.
More often than not, at least one of the founders of the company is technical.
Many of these companies are extremely engineer-driven,
to a degree unthinkable in traditional enterprises --
Facebook is a great example,
which Gergely covered in a
[different newsletter article](https://newsletter.pragmaticengineer.com/p/facebook).
Management at these companies is also typically technical,
often coming from an engineering background.
And this extends to the executive suite,
with titles like Director or Vice President of Engineering,
and Chief Technical Officer
(if traditional companies even had these positions,
the "engineering" and "technical" parts of the titles did not refer to software).
To use Dilbert terminology,
these companies no longer had "pointy-haired" bosses,
and so, a methodology whose main strength is establishing processes to work with them efficiently isn't very compelling.

At this point, you might ask: sure, but why not adopt Agile anyway?
The "pointy-haired" bosses are gone, yes,
but surely Agile also has benefits beyond just establishing a way to work with them?
The answer is that you can,
and some modern tech companies like Shopify are famous for using Agile.
But the problem is that the world of software development has progressed quite a bit in the 20 years since the Agile Manifesto was first signed.
Here are some modern software development practices that did not exist back then:

- [Continuous Deployment](https://www.amazon.com/dp/0321601912)
  pipelines that go straight from source code check-in,
  through many test stages where they are validated with
  [unit](/unit-acceptance-or-functional-demystifying-the-test-types-part2),
  [integration](/unit-acceptance-or-functional-demystifying-the-test-types-part3)
  and [end-to-end](/unit-acceptance-or-functional-demystifying-the-test-types-part4) tests,
  to production, without the need for any manual steps
  (assuming all validations pass)
- Metrics collection and automated alarming
- Gradual deployments, like
  [Blue/Green](https://www.redhat.com/en/topics/devops/what-is-blue-green-deployment),
  that are automatically rolled back if any issues are detected through the metrics system
- Code reviews, with automated validation checks and
  [ephemeral environments](https://ephemeralenvironments.io)
- [Feature Flags](https://martinfowler.com/articles/feature-toggles.html),
  where code behavior can be changed and monitored in real time,
  without having to perform a potentially lengthy deployment

If you're using these practices,
Agile will add quite a bit of overhead to your software delivery process.
If you're deploying to production safely 5 times a day with your Continuous Deployment pipeline --
are you really getting a lot of value from a three-week Scrum sprint?

## So, you're doing Waterfall?

Many people, when they hear that a given company doesn't use Agile,
automatically assume that must mean it uses Waterfall.
In their mind, there's a simple dichotomy:
either you're practicing Agile, or you're not,
and if you're not, that means you must be using Waterfall.
As someone who worked on Waterfall projects,
let me be clear: what Big Tech is doing is **not** Waterfall.
There are many different ways to manage projects thare are not Waterfall;
Agile is one of them, but it's not the only one.

For those of you fortunate enough to never have worked on a Waterfall project,
let me describe how it typically looks like.
A customer, such as a public institution,
wants to build a new system.
They give the contract to a consulting company.
The contract gives 3 years for the project to be built.
The first year is spent exclusively on designing the system.
There will be hundreds of hours of meetings,
and thousands of pages of documents produced in this process,
describing how the system should work,
sometimes in absurd level of details.
The documents will contain many architecture, UML, and sequence diagrams.
However, zero code will be written during this first year.

The second year is all about implementing this grand design.
Because the enterprise architects who wrote the design documents wanted to put as many modern software-development buzzwords in there,
like "microservices", "high availability", "modularity", "fault tolerance", etc.,
the project will need to be divided into multiple sub-systems,
each developed by an independent team in complete isolation from each other.
There is a lot of work -- the design is HUGE --
and not a lot of time,
because we're already at least one year into the project
(and often more, as the design phase typically runs over its initial one-year estimate).
Because of the time pressure,
there is very little emphasis placed on quality --
there are no automated tests, and no practices like code reviews.
The expectations are that we'll have time to fix all of that in the last phase.

Finally, in the last year
(which might be the third year of the project,
but also later than that,
because the implementation phase often takes longer than the planned one year)
is when the different sub-systems get integrated with each other and tested.
This is the first time the teams responsible for the various submodules attempt to assemble them into one coherent system.
Of course, that's difficult to do, because every team interpreted the design document slightly differently,
and so nothing really works together
(the inefficiency of doing this after development, not during,
is why the practice of
[Continuous Integration](https://en.wikipedia.org/wiki/Continuous_integration)
was created).
Concurrently, a different team performs manual tests on the system.
Since basically nothing works, naturally they file thousands of bugs.
The developers, now busy putting out fires everywhere,
don't have time to look through so many bug reports,
especially since they know a lot of the problems without having to read about them.
At the same time, a separate operations team is busy setting up the infrastructure the system is deployed to --
and of course, they run into issues and delays there too,
usually because they need to use the products from a big-name company that won the contest for supplying the platform for this project,
and they are difficult to use, and poorly documented.

Because of all these problems, the project is in a state of panic,
and everyone is working late nights and weekends.
Obviously, even less attention is given to quality now than before,
as the time crunch becomes more and more pronounced.
Of course, it's impossible to fix all of the reported bugs,
because there's way too many of them.
Worse yet, at this point, the project is usually already late --
in some cases, multiple years.
So, management is pressuring to release as soon as possible,
despite the known bugs, hoping to get more time to fix them after the release.

After a heroic push, and typically much later than 3 years after starting it,
the team finally declares the project released.
This is the first time the customer has a chance to try it out,
and give their feedback.
It quickly becomes obvious that the design actually misunderstood the customer's requirements,
and the system does not work the way they thought it would.
Additionally, as it's been at least 3 years since the project started,
the styles and trends in software have changed during that time,
and the brand-new system looks old and out of date the moment it launches.
Add to that the myriad of known bugs,
and the customer is not happy with the results.
The software team is also not happy,
considering they are on the verge of burnout after at least two years of constant crunch time.

I've worked on projects that were managed like this,
and let me make it very clear:
_no one_ would run a project this way in Big Tech.
These companies all have a variety of mechanisms in place to ensure a disaster like the one described above doesn't happen.
The exact details differ from company to company;
Amazon, for example, is famous for its
[Working Backwards](https://www.amazon.com/dp/1250267595) process,
including writing
[Press Releases and Frequently Asked Questions lists](https://medium.com/intrico-io/strategy-tool-amazons-pr-faq-72b3e49aa167)
before the project is even started,
and for having [single-threaded leaders](https://aws.amazon.com/blogs/enterprise-strategy/two-pizza-teams-are-just-the-start-accountability-and-empowerment-are-key-to-high-performing-agile-organizations-part-2),
to list just a few practices.

All Big Techs place emphasis on incremental delivery,
and gathering feedback and data
(both qualitative, as well as quantitative)
from their customers, and learning from that data.
They have many tools at their disposal,
like private betas and previews,
to release something early,
even before its 100% ready, to get that feedback quickly.
Planning for more than one year in advance is also very rare,
as software tends to move fast,
much quicker than "traditional" businesses.
If something is a big project that will take more than one year,
it's split into smaller pieces that can be delivered within a year,
which allows better tracking of progress,
and adjusting course as the feedback from the delivered parts comes in
(and trends in the industry change).

### What about deadlines?

The main reason people often come to the conclusion that Big Tech uses Waterfall is that many projects in those companies have a deadline attached to them.
But, I think that conclusion is incorrect.
Agile often involves project with deadlines too.
In fact, one of the selling points of the most popular Agile methodology,
Scrum, is that its fixed-size sprints mesh well with deadlines
(mostly by showing you really quickly that the project won't be delivered on time in its initial full scope).

Additionally, deadlines in Big Tech are often not an arbitrary cruelty that management inflicts upon their engineers,
but a necessity --
for example, if you want to announce a launch during a conference,
like AWS' re:Invent, or Apple's World-Wide Developer Conference
(and you almost always want to do that, if you have that option,
as releasing during a conference basically guarantees it will see high usage from customers).

But, crucially, even with these high-profile events on the horizon,
it still happens that projects miss their deadline.
If the current customer experience is deemed not good enough to be released,
the project will get cut from the conference.
That's not ideal, of course,
but the potential damage to the company's reputation from releasing something below a certain quality threshold is deemed much worse.

## Summary

So, that's my explanation of why Big Tech doesn't use Agile
(and, by extension, Scrum).
But, that doesn't mean these companies use Waterfall;
in reality, each company uses their own custom methodology,
molded through years of experience to fit their specific needs and circumstances.
Some examples are Amazon's [Working Backwards](https://www.amazon.com/dp/1250267595) process,
or Basecamp's [Shape Up](https://basecamp.com/shapeup) methodology.
These processes are designed to take advantage of modern software development practices,
like [Continuous Deployment pipelines](https://www.amazon.com/dp/0321601912),
[Feature Flags](https://martinfowler.com/articles/feature-toggles.html),
[Blue/Green deployments](https://www.redhat.com/en/topics/devops/what-is-blue-green-deployment),
etc.,
to achieve a more agile software delivery process than fixed-length,
multi-week sprints could ever provide.
