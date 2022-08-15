---
id: 65
layout: article.html
title: Software engineer career levels
summary: |
  In this article,
  I describe a set of software engineer levels that have become a de-facto standard among many tech companies:
  starting with an intern, through entry- and mid-level engineer,
  to senior, staff, principal, and distinguished engineer.
  I go into details of the scope of responsibilities at each level,
  and what does it take to move from one level to the next.
created_at: 2022-08-15
---

Before [I left Amazon](https://twitter.com/adam_ruka/status/1525202858932461568) for Apple,
I had the honor of being promoted to the position of Senior Software Development Engineer.
I wanted to share what I learned from going through the promotion process by writing about the typical career levels that many tech companies use for software development roles.

While there are definitely small variations between companies
(for example, both Google and Meta have senior staff engineers in addition to "regular" staff engineers;
Amazon doesn't have a staff engineer level at all,
but instead has both principal and senior principal positions; etc.),
many of them have arrived at a relatively similar set of standard levels.
In this article, I want to dive deeper into these levels:
what is their scope of responsibilities,
how much ambiguity you face on each,
what are the requirements for being a high-performer on a given level,
and, finally, what does it take to move from one to the next.

## Why have levels at all?

But before I get to discussing the actual levels,
I want to address a question that often comes up when discussing this topic:
do we need job levels at all?

There are a lot of companies that pride themselves on being completely flat,
and having only a single title for all software engineers they employ.
And some people view the software engineer career ladder as just another corporate invention,
a result of unnecessary bureaucracy that just adds overhead,
and which rewards people who are good at "office politics".

But, in my opinion, career levels make a lot of sense once the company reaches a certain size,
and I think there are two main reasons why.

The first is that it gives people a clear path of growth.
When you have a defined career ladder,
people know where on that ladder they are today,
and they can learn, by observing and getting support from their colleagues on the next level,
what do they need to do to get there themselves.
For many engineers -- myself included --
growing in their career is very important,
potentially as important, or sometimes even more important,
as the actual compensation they receive.

And compensation brings me to the second reason why I think having these levels is beneficial.
What should come as no surprise,
higher rungs on the ladder correspond to higher total compensation.
Well-defined levels allow you to reward people according to clear, merit-based criteria,
while a completely flat hierarchy risks rewarding the best negotiators over the top performers,
which can breed resentment, and negatively affect team morale.
And I think having your compensation based on merit is what most employees want --
I know I do!

## Career levels

### I. Engineering intern

The first level in the career ladder is the engineering intern.
An internship is usually the first opportunity for someone to write code in the "real world",
as opposed to solving educational exercises.
Because of that, an internship has a few key differences from a full-time position.

#### Scope & ambiguity

The first is the scope.
Interns almost never work on the same areas that full-time employees do.
Instead, they have a **custom project** prepared specifically for them.
It might be related to what the rest of the team is working on,
but it could also be something completely separate,
crafted intentionally so that it can be completed within the limited timeframe of the internship
(typically 3 months).
The less integrated the intern project is with the rest of team's work,
the higher the chance it will be abandoned after the internship ends,
which is not a good experience for either side --
for that reason, teams usually try really hard to carve out something from their charter that the intern can pick up.

The other big difference between an intern and a full-time employee is that interns almost always get assigned a dedicated mentor from the team they join.
It's the mentor's responsibility to make sure the internship goes smoothly:
they are there every day to answer any questions the intern might have,
to make sure they have all of the necessary resources at their disposal,
perform code reviews of the intern's submissions,
and guide them if they run into any problems.
Remember: interns are still at the beginning of their software development careers,
and so many things that experienced engineers take for granted,
like using version control, or writing tests, or code reviews,
or knowledge of frontend technologies like HTML, CSS, and JavaScript,
or knowledge of backend technologies like relational databases, SQL, HTTP APIs, JSON over REST, etc. --
many of these things might be brand new to an intern.
Hell, they might not know the programming language that's used by the team!
So it's very important that the intern has a person that they can reach out to about anything related to their project.

The ambiguity level of the intern project should be low enough that any issues can be resolved by talking to the mentor.
Interns are not expected to set up and run meetings with other engineers,
and to create alignment --
those things only become requirements on higher career levels.
Having said that,
it's pretty common for interns to spend a portion of their internship coming up with a design for their project,
in collaboration with their mentor,
and then to present that design to the reset of the team,
and get feedback --
this gives interns a good preview of what the job of a full-time software engineer looks like.

#### Example work

Let's say the team the intern has joined is responsible for owning some components on a large, public website.
Occasionally, your team has to troubleshoot customer issues.
That troubleshooting might require accessing the production database to see what is the current state,
or maybe diving into the logs to see the events for a given customer,
or analyzing the distributed traces the application produces.
So the intern project might be to create an internal tool used by the engineers on the team to help with this troubleshooting process.
It might be a simple website available only on the internal company network.
On the website, you can input the identifier of a customer,
and the website gives you data pertaining to that customer,
aggregated from all of the above sources --
database, logs, and traces --
sorted chronologically, with the latest on top.

This is a good intern project, because it's related to the core business of the team,
while not being something critical that must be delivered under a strict deadline --
which means, even if the project turns out too big to be completed during the internship,
the impact on the team will be minimal.
It's not available publicly,
so it will be subject to relatively light load,
and any issues with it, like availability or security problems,
will have no effect on production.
At the same time, it's ambiguous enough that it requires a small design,
and also allows the intern to make some impactful decisions,
like choosing the frontend technology stack,
and designing the user experience of the website.

#### Moving to the next level

If the internship goes well,
the candidate will be offered a full-time position as an entry-level software engineer
(if they are a student at the time of the internship,
the offer will be contingent on them graduating first).

### II. Entry-level engineer

Entry-level engineers, often also called "Engineers 1",
are generally hired with either no, or three or less years, of industry experience.
Given that, on some level,
the expectations of how much knowledge an entry level engineer has when starting on the job are similar to an intern. Of course, the big difference between an engineer 1 and an intern is that engineers 1 work on the same things the rest of the team works on --
they are no longer assigned tailor-made projects,
or a dedicated mentor, like interns are.

#### Scope & ambiguity

The scope at which engineers 1 operate is generally **tasks**.
They get assigned well-defined pieces of work from the projects the team is currently working on
(we'll talk about projects more below, when we get to senior engineers).
They are not expected to get involved with the high-level choices of how the team operates --
concerns like "why is the team working on this project currently",
or "why is this task the most important one to work on right now",
only appear on higher rungs of the career ladder.

The level of ambiguity of their work is generally related to the technical implementation details.
So, while the _outcome_ that a given task should achieve is well defined,
it's common for engineers 1 to have a lot of freedom in making technical choices on _how_ to achieve that outcome.
It's expected that, when faced with major decisions in this area,
engineers 1 will propose a solution,
and consult with more senior members on the team about their proposal,
to make sure there are no problems with it,
or a better alternative wasn't missed.
Improving at this,
and showing good judgement when faced with these decisions,
is an important aspect of engineers 1 moving to the next level.

Given that engineers 1 are often hired with no or very little prior industry experience,
it's expected that they will need support from the more experienced people on the team
(in fact, the performance evaluations of more senior people on the team are influenced by how well they help the more junior members).
So, things like their code reviews requiring more revisions before they are shipped,
or their design documents requiring more iterations before they are approved by the team,
are completely normal and expected.

#### Example work

A good example of an engineer 1 task might be adding the capability to store secondary emails
(in addition to the primary email)
of a customer's profile inside the database layer of a system.
By itself, this task doesn't have any business value --
it needs to be combined with other tasks to form a user story,
like allowing the customer to set secondary emails from their profile page.
So this is a small part of a larger feature,
but the engineer 1 is only responsible for their part,
and not the feature as a whole --
it's expected that that responsibility lies with someone more senior on the team.

This task has some technical ambiguity,
because there are many ways to store this information in a database.
You can use a string with a well-defined separator character that delineates the items.
You can use a dedicated list type if your database supports it.
Or, if you're using a relational database,
maybe the cleanest design is a completely new table,
and the final list of all emails a given user has is generated with a SQL statement that `JOIN`s
this new table with the user profile table.

All of these choices have certain implications and tradeoffs.
It's up to the engineer 1 to understand the possible options and their relative advantages and disadvantages,
pick one and propose it,
consult their choice with a more senior member of the team,
get their signoff, and finally implement the chosen solution.

#### Moving to the next level

Engineers 1 are expected to get promoted to the next level at some point --
in basically all tech companies, entry-level is not a "career" position,
which means one you can stay at indefinitely while being at the company.

To get to the next level, which is mid-level engineer,
the engineer 1 has to prove they can be trusted to act independently to deliver production-quality designs and code.
So, they need to get a good handle on all of the tools and processes that their team uses,
they need to become adept at making sound technical decisions,
and they need to understand the quality level that their code has to reach in order to get through code reviews with relatively few iterations. 
Once they do all of that,
that's when they're ready to be promoted to the next level.

### III. Mid-level engineer

Mid-level engineers, often called "Engineers 2",
are the next level in the career ladder after entry-level engineers.
Typically, you need at least 3 years total of industry experience to be considered for this level,
although some high-performers can be promoted from engineer 1 faster than that.

Engineers 2 are the workhorses of their teams.
They perform the brunt of the development work.
They have enough experience to know the tools and the processes of the team inside-out,
and are either already well-versed in the codebase,
or their experience allows them to get up to speed quickly.
All of this means they are typically very efficient at shipping features.
This is also the career level at which you code the most --
as an engineer 1, you still spend a lot of time learning,
while at senior and above,
you have a lot more non-coding responsibilities like mentoring, reviews, meetings, etc.

#### Scope & ambiguity

The scope at which engineers 2 work is typically **features**.
Instead of being handed a specific technical task,
like engineers 1 are,
the inputs to their work are usually business requirements.
It's up to the engineer 2 to translate these business requirements into specific technical solutions,
and to implement them.

The ambiguity level that engineers 2 deal with is typically feature-level system design.
Business requirements can be translated into code in many ways;
engineers 2 need to break up a feature into specific technical tasks,
and propose an implementation for each of them.
If a task is complex enough,
engineers 2 are expected to write a design proposal on how they plan to handle it,
get it reviewed,
and build consensus to arrive at a solution that is accepted by their team.

The expectations for engineers 2 are substantially higher than entry-level engineers.
There is no more leeway for code reviews or designs --
it's generally expected that code and solutions proposed by engineers 2 will be of high quality,
and accepted within the team with at most a small amount of changes.

#### Example work

A good example of engineer 2-level work can be a feature to allow users to add secondary email addresses to their profile.
You might recognize this as the task from the description of the engineer 1 level above.
But of course, storing these emails in the database is only a small part of this feature:

- You also need to update the code that reads the database
  (depending on the solution chosen for the storage layer,
  that might mean parsing a string to a list using the separator character,
  or performing a `JOIN` SQL query with the newly created table).
- You need changes to the user profile UI,
  to allow users to add secondary emails.
- You need to actually _use_ the secondary emails for something;
  the password reset flow seems like a good first candidate
  (you can modify it to allow specifying a secondary email to send the password reset link to).

So this one feature encompasses many separate technical tasks.
The engineer 2 is responsible for the entirety of this feature --
from coming up with the design,
through implementing it,
to finally owning it when it gets deployed to production.

Note that that doesn't necessarily mean they have to implement every task of a feature themselves --
they can delegate tasks to other engineers, including engineers 1.
In fact, this delegation skill is an important part of engineers 2 getting promoted.

#### Moving to the next level

Whether or not engineer 2 is a "career" level or not depends on the specific company.
It used to not be one at Amazon, but that was changed in 2019.
I believe it's still not a final level at Google, for example.

The move from engineer 2 to the next level is a difficult one,
much more difficult than from entry-level to mid-level engineer.
To make this leap, an engineer needs to broaden their scope of influence so that it becomes bigger than what they can deliver by themselves.
This can be a difficult transition, because, like we established above,
engineers 2 often become very, very proficient at delivering high-quality code quickly.
And this can lead them into a trap, sometimes called "Engineer 2.5":
as they level up from engineer 1 to an average-performing engineer 2 to a high-performing engineer 2,
each step in that ladder is achieved by focusing on improving the hard skills of delivery.
But to reach the "senior" title,
delivery skills, while definitely important, by themselves are actually not enough --
improvements in "softer" skills like design, planning, communication, mentoring, etc. become required.
So, it's not enough to just become better at the thing you are already doing --
you need to start doing new things, and that is always a challenge.
Even if the engineer is writing beautiful, defect-free code that always gets merged on the first iteration of all their code reviews,
even if everything they ship has 100% code coverage by using Test-Driven Development,
even if they deliver more features than four engineers 1 combined --
all that alone will not be enough to ensure their promotion to the next level.

What is needed is stepping away from the focus being purely on individual delivery,
and starting to think about the broader picture --
mainly on the team level.

### IV. Senior engineer

The simplest characterization of "senior software engineer"
is that this is the first career level on which your work responsibilities grow beyond what a single person can deliver by themselves.
Typically, you need at least 5 years of industry experience to be considered for this level.

#### Scope & ambiguity

The scope at which senior engineers operate is **projects**.
That means taking some large, ambitious business vision,
and doing the hard work of turning that vision into reality expressed through code.

What that entails in practice is typically a many-step process:
- Formalizing the business requirements.
- Doing research, sometimes with prototypes or Proof of Concepts.
- Creating a document outlining the design of the software fulfilling the requirements.
- Getting that design reviewed, iterating on it, and finally getting it approved.
- Contacting other team(s) whose software needs to be modified to deliver this project,
  driving towards consensus with them that the changes are acceptable,
  and negotiating who and when will make those changes.
- Formulating a project plan that divides the work into smaller pieces,
  ideally including milestones and estimates for all of them.
- Leading a squad of several engineers over the course of a few months to actually build the software outlined in the plan.
- Doing the coding work on the implementation, along with the rest of the squad
  (senior engineers often take on the most difficult and ambiguous pieces of the project).
- Regularly reporting the status of the project to its stakeholders.
- Maintaining the project after its launch through operational support.
- Tracking the business metrics of the delivered project,
  and using them to inform further business and technical strategy.

A lot of this,
especially breaking down the entirety of the project into smaller chunks,
and leading a team to deliver them,
might seem similar to splitting features into tasks,
and delegating from the mid-level engineer level description.
Given that, a natural question might be:
is there a strict line between a "feature" and a "project"?
In my opinion, there is, and the differentiating factor is their size.

While a feature can be split between multiple engineers,
to deliver it faster,
it doesn't have to be -- it's more a matter of choice,
and weighing the relative priorities in the team against each other.
However, a project is so large that it simply _has to_ involve more than one person --
it would be infeasible for a single engineer to deliver it in any reasonable time.

As the above list shows, senior engineers need to deal with a lot of ambiguity,
at all stages of the project's lifecycle.
This level also adds many challenges compared to the previous one,
and many of these are not strictly technical.
Things like clarifying business requirements,
driving a design to conclusion through many potential rounds of back-and-forth and varying opinions,
leading meetings with other teams and building consensus with them,
becoming a leader responsible for the smooth functioning of a squad of engineers,
reporting the status to stakeholders,
planning for and tracking business metrics --
all of these things become requirements on this level.
For these reasons, some companies refer to senior engineers as "tech leads".

On this level, mentoring and coaching also become much more important.
Senior engineers are expected to take an active role in the functioning of the team they belong to,
and that means responsibilities like implementing process improvements,
and also building individual relationships with team members,
and helping them get to the next level.

At the same time, senior engineers still stay connected to the details.
They pick up coding tasks like any other team member,
and they are expected to deliver quickly and with high quality.

#### Example work

Let's say we're still on the team that owns components on the big, public website.
Right now, users can log into the website by creating a new account,
and providing their email, and a password.
But, the business leadership wants to streamline this process,
and allow users to log in using third-party providers,
without having to create a new account.
In the first version, they want to support three of them:
Google, Microsoft and Apple.
Implementing this would be a good example of a senior engineer-level project.

A senior engineer would most likely start by researching the documentation the third-party providers supply about integrating with their systems.
Maybe do a quick Proof of Concept integrating with one of them,
to get a feel of how the process works.
The Proof of Concept might also help to clarify what changes will be needed to the current authentication service,
which is owned by a different team --
the senior engineer will need to get that team on board with whatever plan she comes up with.

From the research, it's pretty clear that a new service will be needed that talks to the third-party providers.
So, the senior engineer will need to design this service.
There are many interesting questions here:
what API do we want to present for consumers of this service?
Do we want one service, or three separate ones,
each talking to a different third-party provider?
What data storage will the service(s) use?
Are there any scaling considerations we want to be aware of?
The senior engineer will have to answer all of these questions, and more,
in her design document,
and review this document with the rest of the team,
and perhaps even with some more experienced engineers outside the team,
if the technical risks are deemed serious enough.

After the document gets approved,
the senior engineer will need to come up with a project plan.
This also has some interesting questions, for instance:
do we handle all three providers in parallel,
or do we start with one,
and then use the foundations integrating with that one provided to do the remaining two in parallel?
The previously conducted research should help with this decision.
Part of the project plan might be the secondary emails feature that we talked about above,
in the description of the mid-level engineer --
it seems sensible to allow users who created their account before we supported third-party providers to now add their
` @icloud.com` or ` @outlook.com` addresses to their profile.

Once the plan is finalized,
the work on implementing the project can begin.
It will be executed by a dedicated squad of engineers,
lead by the senior engineer,
who needs to make sure all members are clear on what needs to be accomplished in each task,
to react if any unexpected problems arise, etc.
The senior engineer will track the progress her squad is making against the milestones outlined in the plan,
and periodically report a summary of the status to the project's stakeholders.

Finally, after the code is written and deployed to production,
the senior engineer will make sure to track the metrics related to the project,
both for operational purposes, like latency, percentage of errors, etc.,
but also for business purposes.
She would make sure to track such metrics as the relative numbers of the three providers
(are they all roughly equally popular,
or is one much more (or much less) popular than the others?),
what percentage of new customers use one of the third-party providers
(versus signing up the "old" way, with an email and password), etc.
These metrics are important data to report to the business leadership,
as it might inform the company's future strategy in this area.

#### Moving to the next level

At every tech company that I know of, senior engineer is always a "career" level,
which means you don't have to strive for a promotion anymore if you're happy on that level --
you can stay on it indefinitely while working for the company.

To move to the next level,
senior engineers need to broaden their scope,
and expand their sphere of influence beyond their immediate team,
to the entire group of teams that owns a given product.
This is a big change,
which requires a large perspective shift.
While going from entry-level engineer to senior engineer is certainly not easy,
it's a relatively straightforward progression --
you're going from delivering tasks to delivering features to delivering projects.
But a staff engineer is almost a different job than a senior engineer,
and requires a very different mindset.

### V. Staff Engineer

Staff engineers
(a term taken from the military,
where you have [staff officers](https://www.britannica.com/topic/staff-officer))
are the next level after senior engineers.
Typically, you need at least 7 years of industry experience to be considered for this level.

#### Scope & ambiguity

The scope at which staff engineers operate is typically **product**.
In big companies, a single product is usually jointly owned by multiple teams,
each responsible for a specific part of it.
A staff engineer is no longer focused only on what their immediate team owns,
like a senior engineer --
instead, they have a much broader picture that encompasses the entire product,
and all teams that maintain it.

While interacting with other teams,
and building consensus among them,
is part of the responsibilities of senior engineers,
it's the absolute "bread and butter" for staff engineers.

**Note**: some common words mean different things in different companies.
When I use the term _team_ in this article,
I specifically mean a [small, two-pizza team](https://docs.aws.amazon.com/whitepapers/latest/introduction-devops-aws/two-pizza-teams.html),
a concept first introduced by Amazon,
which most tech companies today have adopted as their smallest organizational unit.
If in your company, a "team" means 40 people or more,
then obviously the organizational level at which staff and above engineers work on will be called something else than what I call it here.
But, while the names might differ,
the general scope of responsibilities and amount of ambiguity encountered at each level should be the same.

There are many ways to influence a product,
and so staff engineer responsibilities are much more ambiguous than those of senior engineers.
It's typical to frame the various types of work staff engineers perform as **archetypes**.
Here are some common ones:

- **The Area Curator**: some engineers work in a given area of the product for long enough that they become the "go-to"
  person for any team that needs to make changes in that area.
  They can provide feedback on design documents, do code reviews,
  or even inform business strategy by judging what changes are feasible
  (and which are not) to implement in that area, and how long will they realistically take.
- **The Paratrooper**: these engineers are considered very experienced in the area the product operates in,
  either because of their long tenure with the organization that developed the product,
  or through similar experiences in other organizations or companies.
  Given their wide expertise,
  they are "dropped", like a paratrooper,
  to any area of the product that is deemed the most important at the moment;
  that might be a project that is struggling,
  a complex design problem with no good solution,
  or a difficult issue with the product, current or future
  (scaling issues, like "at this rate of growth, we will exceed our compute capacity in 2 years",
  are often good examples of future problems).
- **The Tool Vendor**: it's common for multiple teams to solve the same problems.
  Tool Vendors recognize this duplication of effort as an issue,
  and build a common solution that multiple teams use.
  Sometimes, they can even form a completely new team,
  dedicated to the continued maintenance of the tool they created.
- **The Architect**: we talked about projects in the senior engineer description above,
  but we never explained where these projects come from,
  and who decides on their relative priority.
  While business management definitely has a lot of input into this,
  the Architect would be the person from the technical side involved in these decisions.
  Some projects are also so big that they require work from more than one team.
  Typically, there is a dedicated role, the Technical Program Manager (TPM),
  that is responsible for coordinating them;
  however, they sometimes need support from someone with engineering expertise,
  and the Architect would serve that role.
- **The Subject-Matter Expert**: some people have a relatively small niche that they are a world-class expert at.
  For example, imagine someone that has ten years of video encoding experience.
  A video streaming company that really needs that expertise would most likely hire that person at least at a staff engineer level.

Note that engineers don't necessarily map one-to-one to archetypes --
the same engineer can fulfill more than one archetype,
all depending on what exactly is the most pressing need at a given moment.

#### Example work

Let's say an engineer worked on the public website that added the third-party authentication providers
(the project from the senior engineer level description above),
but, after that work is completed,
she decided to switch to a different team in the same company.
The product this new team owns is part of a mobile app.
The engineer hears that another team in the same organization also wants to integrate with third-party authentication providers in the mobile app.
Seeing an opportunity, the engineer reaches out to that other team,
and lets them know about the similar project she was involved with in her previous team.
The engineer comes up with a design that would generalize the service created for the public website so that it could be used by the mobile app too,
in this way saving a lot of duplicated effort.
She convinces both teams --
the one she used to work with, and the one from her new product --
that using this new service is preferable to each team building their own.
She successfully lobbies leadership to fund this project,
and to allow her to form and lead a team around implementing this new service,
and maintaining it after it has been launched.

#### Moving to the next level

To move to the next level,
the staff engineer needs to broaden their scope yet again,
this time from a product to an entire organization.
As most companies promote based on demonstrating consistent performance on the next level,
this is a tricky thing to do,
and often requires a stroke of luck,
like stepping in to help with an organization-wide project,
or starting a large initiative yourself,
and working on making it a success.

### VI. Principal engineer

Principal engineers are the next level after staff engineers.
I don't think I've ever heard of a principal with less than 10 years total of industry experience.

#### Scope & ambiguity

In big companies, there are usually multiple organizations,
each organization owning multiple products,
with multiple teams owning each product.
The scope at which principal engineers operate is that **organization**.

This is a very high-level position,
and usually involves relatively little coding,
maybe besides some small prototypes or Proof of Concepts.
The work of a principal engineer comes down to answering high-level concerns,
such as:

- How is the organization doing, from a technical perspective?
  Are there any common themes in the complaints that different teams are reporting?
  Can we address those common pain points?
  If so, how -- should we buy an off-the-shelf tool, or should we build one ourselves?
- Are there any scaling challenges we are facing --
  both technically, with the growth of the usage of our systems,
  but also as an organization, as we are adding more people?
  If there are, how can we address them?
- We have an idea for a big project that will involve changes in multiple products.
  Only a principal engineer has enough scope to technically manage an endeavour so large.
- How is our portfolio of products doing?
  Are we missing something, and should start a new one?
  Or is the opposite true --
  we're spread too thin, and we need to sunset some products that are not doing that well?
- How are the individual teams doing?
  Are they overworked, and we need to ramp up hiring?
  Or is the opposite true, and the organization is too fragmented and siloed,
  and we should consolidate some smaller teams into bigger ones?

Of course, while the questions themselves are fairly simple,
the answers to them might be very complex,
and result in huge organizational changes.
That's why, at this level, having good judgement is a core requirement.
If a decision to make any large changes is made,
principal engineers are expected to lead implementing those changes.

#### Example work

We talked above about multiple products needing to integrate with third-party authentication providers.
But perhaps that is just part of a wider strategy in the organization.
The principal engineer wants to attract new enterprise customers,
and from talking with them, they know that authentication is a major issue for them.
Enterprises don't want their employees to create new accounts and passwords in each system used by the company --
instead, they want to use their corporate Single-Sign On (SSO) service,
and have a single account be used to log in into all their tools.

So, the third-party authentication providers is one part of a bigger strategy to move into the enterprise segment of the market.
Delivering these projects will allow onboarding companies that use either Google Workspaces or Microsoft Office 365 products as the foundation of their employee databases.
But that is just a part of the market,
and so the principal engineer is already thinking of the next wave of projects that will need to be started in the products the organization owns --
allowing federation through arbitrary authentication providers,
not only Google, Microsoft and Apple.
That will allow onboarding the biggest enterprises who use their custom in-house Single-Sign On solutions.
This will be a lot of work, from a technical perspective --
much more difficult than implementing the fixed set of third-party authentication providers --
but these are also the customers who typically spend the most
(because of their size),
so the effort should be well worth it, in the long run.

#### Moving to the next level

Getting promoted as a principal engineer is very difficult.
The next level is so high that it can't really accommodate too many positions,
even in large companies.
You need to demonstrate a great track record of doing large,
successful improvements to your organization,
and "successful" is judged on the basis of business results on this level.
Even with that track record present,
you basically need either a re-organization,
or a vacancy from someone quitting or retiring to open up.
And even then, you might get passed up for an external hire with an even better resume than yours,
who will scoop up the position.

### VII. Distinguished engineer

After principal engineers, we have distinguished engineers.
There are no hard and fast rules about this,
but I don't expect so see a distinguished engineer that hasn't worked at least 20 years in the industry.

#### Scope & ambiguity

This is an extremely high position,
equivalent to a Vice President in the management track,
and is realistically the "top of the mountain"
for an individual contributor.

At this level, your scope is an entire department of a large company,
which consists of many organizations under it,
each organization owning multiple products.
The distinguished engineer is responsible for setting the technical strategy of that department,
usually planning for many years in advance.

There is also an important exception to this rule.
Some companies hire distinguished engineers because of their huge contributions in other areas of computer science,
not directly related to their work with the company.
Examples are Guido van Rossum,
the creator of the Python programming language,
at Microsoft, or James Gosling,
the original developer of Java,
at Amazon.

#### Example work

An example of what a distinguished engineer might be working on is the "enterprise market" strategy we discussed above.
The distinguished engineer comes to the conclusion that their department should focus on the enterprise customer for the next few years.
In some organizations, that means integrating with Single-Sign On providers,
like we saw above in the principal engineer description;
but perhaps the challenges of enterprise adoption are different in other organizations that own different products.
For example, enterprises are often sensitive to data custody issues,
and don't like entrusting other companies with their most confidential data.
So, perhaps products that store data need to build features that allow enterprises to choose where is the data held,
so that it's never directly accessible to anyone outside the company that owns it.

Of course, that is a pretty high-level direction;
the principal engineers in the affected organization(s) would be tasked with working out the details of how exactly to turn this high-level vision into concrete changes in the products their organizations own,
and it's very likely each product will need a dedicated design for this aspect,
taking into account its distinct characteristics.

### VIII. Engineering Fellow

Beyond distinguished engineer,
there is one more individual contributor level that I'm aware of:
the Engineering Fellow.
This is more of a title than a position,
and is bestowed to employees who have made exceptional contributions to a company.
In many ways, it's similar to a tenured professor in academia.
It gives its recipient pretty much complete freedom in how they want to work.
Engineering Fellows don't really have a "boss" anymore in the traditional sense of that word,
beyond maybe the CEO,
and their scope is the entire **company**.
They have complete freedom in choosing what to work on.
They already created so much value for the company,
that even if they decide to stop showing up for work completely,
their contributions would still have payed for their salary many times over.

A good example of Engineering Fellows are
[Sanjay Ghemawat and Jeff Dean](https://www.newyorker.com/magazine/2018/12/10/the-friendship-that-made-google-huge),
the pair responsible for writing many of Google's core services in the company's early years.

## Summary

So, these are the standard career levels used at many tech companies today.
I hope it's clear from the description why these only become useful once the company reaches a certain size.
If you have a total of five engineers in your company,
there is no distinction between team, product, organization, and department,
and so there's no point in introducing separate senior, staff, principal and distinguished engineer levels --
it would be complete overkill.
But, once the company grows, and these organizational structures start to naturally emerge,
then it's a good time to start developing a more fine-grained career ladder that reflects the organizational structure of the company.
