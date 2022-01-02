---
id: 61
layout: article.html
title: My perspective on the CDK opinions from the "AWS FM" podcast
summary: |
  Recently, the "AWS FM" podcast,
  hosted by Adam Elmore,
  had some guests on his show that discussed the Cloud Development Kit.
  A few of the guests concluded that they would not recommend using the CDK.
  In this article, I want to look at the reasons they provided for not using the CDK,
  and give my opinion on whether I agree with those reasons, or not.
created_at: 2021-12-31
---

Recently, [Adam Elmore](https://twitter.com/aeduhm),
host of the ["AWS FM" podcast](https://aws.fm),
had a few guests on his show that discussed the
[Cloud Development Kit](https://github.com/aws/aws-cdk).
Three of his guests --
[Ben Bridts](https://aws.fm/episodes/episode-9-ben-bridts),
[Ben Kehoe](https://aws.fm/episodes/episode-15-ben-kehoe), and
[Ian McKay](https://aws.fm/episodes/episode-16-ian-mckay) --
said they would not recommend using CDK for their projects.

While I don't want to question their recommendations --
definitely everyone should make an informed decision on the tools they use,
and choose the ones they think will be best for their circumstances --
I feel like some of the reasons they gave for not recommending the CDK did not resonate with my experience.
So, in this article, I wanted to dive a little deeper into each of provided reasons,
and give my personal perspective on them.

## Disclaimers

Before I dive into the reasons provided on the podcast for not using the CDK,
I want to give a few disclaimers first:

1. Please don't read this article as a critique of Adam, his podcast, or any of his guests.
  This is simply a debate on some technical topics.
  I think Adam's podcast is great,
  and his guests are all very smart people that I have a ton of respect for.
  I agree with 95% of what each of them said during their interviews.
  The fact that I don't agree with that last 5% does not diminish my respect for them in the slightest.
  I welcome these discussions, and this kind of real world-feedback,
  because I think it's absolutely crucial in making CDK the best product it can be.	
2. You can say that I'm biased, as I'm a member of the CDK team at AWS,
  and so naturally I'll always be for the product.
  That is certainly a valid point;
  my answer to it is that I hope the arguments I make below stand on their own technical merits,
  without being affected by who made them.
3. This is always true for any article on this blog, but let me repeat it once again,
  to make it absolutely clear:
  the opinions expressed in this article are solely my own,
  and do not reflect the position of Amazon or AWS in any way.

## Podcast reasons against using the CDK

Now, let's go through the list of reasons the podcast guests gave for not using the CDK:

### 1. Imperative code can be non-deterministic

Ben Kehoe said during [his interview](https://aws.fm/episodes/episode-15-ben-kehoe):

> If you're running a CDK program, you can go reach out to the internet.
> You can use a random number generator,
> you can do anything that's possible in the programming language that you're writing, 
> which means the CDK program doesn't need to produce the same output between different runs.

Ian McKay said during [his interview](https://aws.fm/episodes/episode-16-ian-mckay):

> That imperative code that is not guaranteed to output in the same way.
> And it doesn't potentially have the right exactness to it that you might want.

While it is true in theory that you can make the output of your CDK application non-deterministic by doing service calls,
or using things like a random number generator,
during its execution,
this is something that the CDK explicitly discourages.
The CDK strongly recommends that your application be deterministic,
meaning the same source always produces the same output.
That's why it has mechanisms like the [runtime context](https://docs.aws.amazon.com/cdk/v2/guide/context.html),
which are explicitly designed to facilitate this goal,
and that's why the execution of the CDK code is synchronous,
and not asynchronous, in the NodeJS runtime.
If you stick to the CDK defaults,
your applications will be deterministic.

If the argument is that it doesn't matter what the recommendation is,
because the user can always just ignore the recommendation,
and make the output non-deterministic anyway if they want to,
then I don't think there is an IaC tool that guarantees determinism without having some sort of back door that allows users to opt out of that guarantee.
Even CloudFormation, which uses a completely declarative language,
allows deploy-time non-determinism through
[Parameters](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/parameters-section-structure.html),
[dynamic references](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/dynamic-references.html),
[macros](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/template-macros.html),
and [Custom Resources](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/template-custom-resources.html),
the last two allowing you to execute arbitrary imperative code at deploy time.

### 2. The CDK abstractions should only be server-side, not client-side

Ben Bridts said during [his interview](https://aws.fm/episodes/episode-9-ben-bridts):

> So, if you look from outside and the way that some people try to use CDK is just,
> "Oh, I'm going to build some abstractions".
> And then another team can use those abstractions,
> and they don't need to worry about everything underneath.
> And that is true. If you do that in a managed service capacity.
> If you're in AWS and you're building a service or if you're a Managed Service Provider. (...)
> But if you're saying:
> "Oh, we're building the abstractions and now you can deploy it to your account and you own that" --
> then you're actually making a mistake there I think.
> Then you're taking away the opportunity for people to learn what's actually running underneath,
> and they will have problems later when they either have operational problems,
> have to debug something in production or you want to add something or want to deviate from what you already built.
> Suddenly, they have to learn everything.
> They have to learn everything, because they own it, right?
> It's their infrastructure that they're running.

Ben Kehoe said during [his interview](https://aws.fm/episodes/episode-15-ben-kehoe):

> But the thing that I'm really strongly against is developer intent remaining client side. (...)
> So things that constructs can do today should be representable in CloudFormation. (...)
> Another near term thing that we should hope to see on the CloudFormation roadmap is CDK constructs that don't have non-local effects should be able to be registered as CloudFormation types. (...)
> The other thing is, I think there are two different audiences for the CDK.
> There are people who are proficient with CloudFormation that can understand the output. (...)
> And those people then become advocates for the other audience,
> which is people who are new to AWS that don't know how to read CloudFormation.
> CDK is sort of trying to hide it from them.
> It means that they don't need to understand it,
> but that also then means that they don't fully know what's being deployed or understand it completely because they can't go read that template and fully understand it.

While I agree there is a lot of value in creating managed services,
as they offer the highest level of customer convenience,
client-side abstractions like the CDK definitely have their place.

One of the cornerstones of CDK is **composability**:
the fact that I can take two constructs,
wrap them in my own construct,
with any API that I want,
and distribute my construct as a library in the language I'm using.
In fact, that is exactly how the higher-level CDK constructs
(which we will talk about more below)
are implemented: they are simply a library of classes that wrap the lower-level,
CloudFormation constructs
(those that start with the `Cfn` prefix).
The only difference is that this library is vended by the CDK team itself,
but other than that, there's nothing special about it --
it doesn't use any magical CDK-team only backdoor that isn't available to other library authors.

If you required every construct to be backed by an AWS managed service or CloudFormation resource type,
this would effectively kill the ability for third-parties to create construct libraries,
because, naturally, only AWS can create new managed AWS services or built-in CloudFormation resource types.
We know that the ability to create new constructs, and release them as libraries,
is a huge part of CDK's value proposition to many customers --
[Construct Hub](https://constructs.dev) is a testament to that.
There are also many construct libraries that are not open source,
because they are used internally at companies,
implementing that company's best practices and common patterns.
So, removing this capability would be a huge blow to CDK's usefulness.

As for the need to understand the abstractions when things go wrong --
that is certainly true, but it's also true in scenarios when you're not using the CDK.
At least CDK allows you to get started quickly,
and learn things as you go and as you need them,
as opposed to requiring you to learn everything upfront,
before even getting anything running on AWS.

### 3. AWS CDK higher-level constructs are low quality

Ian McKay said during [his interview](https://aws.fm/episodes/episode-16-ian-mckay):

> And I think there's some other issues with the way that CDK itself was implemented.
> I don't personally believe that their opinionated rules and high level constructs were done very well.

I would love to dive in deeper with Ian,
to understand which constructs disappointed him,
and work together on how we can improve them.
Many CDK higher-level constructs are used by thousands of customers,
so if they have some glaring flaw,
the CDK team would love to know about it.

That's one of the great advantages of CDK being an open-source project:
any customer can open an issue describing their problems with a construct,
and we can work with them on understanding their usecase,
and improving the constructs,
to make sure they satisfy real-world requirements.

But, for the sake of argument, let's say that Ian is right,
and the higher-level construct he used was indeed bad.
That's not necessarily a reason to not use the CDK!

Another defining trait of the CK is **layering**:
the fact that the CDK is structured as a big stack of abstractions,
and every layer is built on top of the previous one.
There is no magic there, just classes being composed from other classes.

This means that CDK does not force you into using any specific abstraction:
you have to explicitly opt-in to using it.
And if you try a given construct,
and decide it's low quality, and you don't want to use it --
that's completely fine!
You can always discard it, and, if needed,
go down one layer of abstraction,
which gives you full control that the higher-level construct lacked.

You can do this all the way down to the automatically-generated,
low-level classes that start with the `Cfn` prefix.
That gives you full control over the output of your CDK code,
while still retaining all of the advantages of using a programming language
(auto-completion, type-safety, inline documentation, local variables, loops, functions, classes, etc.).

### 4. AWS CDK higher-level constructs don't have versioning

Ian McKay said during [his interview](https://aws.fm/episodes/episode-16-ian-mckay):

> And even when they [higher-level CDK constructs] were done well, they have no concept of versioning.
> So when an opinion changes, which does happen over time within the AWS ecosystem, there's no real way to communicate that or to version those opinions within the CDK constructs concept.

First, AWS CDK constructs do not implement versioning exactly because opinions on the best practices within AWS evolve with time.
If constructs were versioned,
then customers would have to opt-in to the new version explicitly,
instead of getting it automatically when they upgrade their CDK version,
which means they would have missed on the latest best practices unless they knew to look for them.
So, this is not an omissions, but a deliberate design decision.

And second, there is actually a mechanism for versioning,
if the best practice cannot be changed in a backwards compatible way:
[feature flags](https://docs.aws.amazon.com/cdk/v2/guide/featureflags.html).
Using them, the old behavior is preserved for existing applications,
but the new behavior becomes the default for new applications.

### 5. CDK supports many languages

Ian McKay said during [his interview](https://aws.fm/episodes/episode-16-ian-mckay):

> So CDK is now out for five or six different languages.
> How do you then cross between those programming languages that other people might be used to,
> especially within different organizations?
> So myself as a partner, I go into organizations and one might be doing CDK with Java, 
> but then the next one might be doing it with JavaScript or Python or something like that.

I understand it might be tricky,
when you're consulting on projects,
to keep switching languages,
as opposed to only dealing with something like the CloudFormation DSL.
However, I assume this sort of consulting requires also looking at runtime code,
not only at infrastructure code
(at the end of the day, the infrastructure is there to serve the business logic, after all),
and of course the language used for the runtime code can change between projects,
same as CDK code.
So I think you can't escape this inconvenience anyway,
regardless of what IaC tool you're using.

### 6. Methods like `grantRead` have non-local effects

Ben Kehoe said during [his interview](https://aws.fm/episodes/episode-15-ben-kehoe):

> One is, if we talk about things like `grantRead`,
> the effect of that call may not be local to where it is being called.
> That permission may end up in a stack that's very far away from the bucket that you're operating, that you're trying to grant.

Here, Ben is talking about a common pattern among the
[Layer 2](https://docs.aws.amazon.com/cdk/v2/guide/constructs.html#constructs_lib)
constructs.
Many of them have `grant*()` methods,
like `grantRead()`, `grantWrite()`, etc.,
that allow adding permissions to access a given resource,
like an S3 Bucket, without having to know in detail what IAM actions are required for each access type.

For an expression like `myResource1.grantRead(myResource2)`,
there are three possible results of that call:

1. The principal associated with `myResource2`
  (usually an IAM Role)
  will have permissions added to its identity policy.
2. The resource policy associated with `myResource1` will have permissions added to it.
3. Both of the above things will happen.

The exact result depends on the resource types of `myResource1` and `myResource2`,
and whether they are in the same account, or in different accounts.
This is another benefit of using the higher-level CDK constructs --
you don't have to know all of these low-level IAM details,
CDK will just do the right thing for you.

But, regardless of what is the exact result,
the effects of the call will be limited to `myResource1`, or `myResource2`
(or possibly both).
There are no possible effects that happen in Stacks that neither `myResource1` nor `myResource2` belong to.

### 7. CDK is too low level

Ben Kehoe said during [his interview](https://aws.fm/episodes/episode-15-ben-kehoe):

> The notion should be that what you want is that the CDK program that you write is the thing you bring to the cloud.
> And the cloud understands your program as a definition;
> the program is not a thing that produces a definition, it is the definition.
> And if you do that, you gain all sorts of things.
> That ideally your variable names are your resources logical IDs, why not?
> And drift detection, so if you said:
> "Here's my CDK program, this is my definition of my cloud application that I want".
> And you say, "Okay, great, I have deployed that,
> but somebody went and made some tweaks through the console --
> tell me how it's different".
> The ideal state is: produce for me a new CDK program that I can download,
> that I can do a file level diff with, and it says,
> "Here's the difference between a CDK program that produces what currently exists and what you define to be your desired state"
> and also, "Oh yeah, there's a new line here that modifies this definition".

I think what Ben is saying here is very interesting.
He paints a picture of a very compelling future.
I really hope we achieve it with the CDK.
In fact, if you read the preface to the community-written
[CDK  book](https://thecdkbook.com)
(which I highly recommend, BTW),
[Elad](https://twitter.com/emeshbi),
the creator of the CDK,
predicts that what Ben is envisioning will be one of the four major areas of CDK improvement in the future.

But, this is not a good reason to forgo using the CDK,
because no existing IaC tool offers the experience Ben is describing.
While I think CDK is uniquely positioned to deliver on this grand vision,
today, it's not a choice between this amazing experience, and the sub-optimal one CDK offers;
no IaC tool, neither CDK, nor a different one, delivers what Ben outlined in his interview.

## My reasons to not use CDK

Given everything I wrote above,
you might assume that I would simply always advocate for using the CDK,
regardless of the circumstances.
But that is not the case.
I think there are legitimate reasons for why you might decide that CDK is not the best fit in your particular situation:

### Reason #1: your team does not have anyone familiar with any CDK supported language

CDK deliberately uses familiar programming languages,
to piggy back on people's existing knowledge of them.
However, if there's no one on your team who knows any of the supported languages,
then CDK might not be the best fit for you.

I don't think it's impossible to invest in training to teach one of the languages CDK supports
(I've seen it done before),
as they are all pretty widely used,
and learning a given programming language might actually pay dividends later in other areas beyond just CDK code,
but I think this is a legitimate reason to not use CDK.

### Reason #2: you already have a lot of investment in another IaC product

If your team and/or organization has already invested a lot of time and effort into another IaC product,
the cost of switching to the CDK might be too big,
especially if you have a lot of custom tooling built around that IaC product.

### Reason #3: infrastructure is not a major problem for you

If you judge that infrastructure setup is not the primary bottleneck for your team/organization/project,
you might be better off investing your efforts into solving those other pain points first before adopting the CDK.

## Summary

So, those are my thoughts on the arguments the guests of the "AWS FM" podcast presented against using the CDK.
Let me repeat: I don't think there's anything wrong with expressing those opinions.
The justifications I gave in this article are also opinions, after all.

I hope this article gives you enough information that,
when time comes to make technical decisions on which tools to use for your project,
you will be able to make a choice that best fits your particular circumstances and constraints.
