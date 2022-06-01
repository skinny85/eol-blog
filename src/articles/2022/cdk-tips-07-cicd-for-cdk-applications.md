---
id: 63
layout: cdk-tips.html
title: CDK tips, part 7 – CI/CD for CDK applications
summary: |
  In part 7 of the 'CDK tips' series,
  we talk about implementing Continuous Integration
  and Continuous Delivery/Deployment for your CDK applications.
created_at: 2022-05-31
---

When developing a CDK application,
it's typical to use the CDK CLI commands from your development machine to deploy testing versions of your application,
like we saw in the
[previous article in the series](/cdk-tips-06-speeding-up-cdk-application-development).
However, when it comes to deploying to production,
doing so by invoking `cdk deploy` has some disadvantages.

It might work if you're the only developer working on a given application,
or if the team is small, and located in the same physical place;
but in these modern times,
it's very common for development teams to be distributed all over the world.
In such a situation,
you don't want to rely on developers having to run
`cdk deploy` from their development machines,
as that goes against the spirit of Infrastructure as Code,
and introduces the possibility of making mistakes
(like running `cdk deploy` with some local changes,
not reflected in source code),
or simply running into conflicts from deployments by coincidence happening at the same time.
You want these deployments to happen in a reliable, automated, repeatable fashion;
and this is where Continuous Delivery and Deployment come in.

When using CI/CD,
you define a
[Deployment Pipeline](https://www.amazon.com/gp/product/0321601912)
that starts with the source code of your CDK application.
Any time a code change is published to your version control repository,
the Pipeline triggers, builds your code,
then performs CDK synthesis,
which generates artifacts like
[Assets](https://docs.aws.amazon.com/cdk/v2/guide/assets.html)
and CloudFormation templates,
and finally deploys those artifacts into the correct environments,
all without requiring any manual actions to be taken by humans.

CI/CD is an important practice in modern software development,
and CDK applications are no different in that regard.
So, in this article, I want to give a few pointers about implementing CI/CD specifically for CDK applications.

## 1. Use the CDK Pipelines library

CDK ships with a library,
called [Pipelines](https://aws.amazon.com/blogs/developer/cdk-pipelines-continuous-delivery-for-aws-cdk-applications),
that implements many of the best practices outlined here.
I recommend using it if possible.
This library uses [AWS CodePipeline](https://aws.amazon.com/codepipeline)
as the primary implementation of your Deployment Pipeline.
If you don't want to use CodePipeline,
the API of the library is provider-agnostic,
and allows multiple implementations;
for example, there is an (experimental)
[implementation that uses GitHub Actions](https://github.com/cdklabs/cdk-pipelines-github).

## 2. Decide how you want to deploy

There are two major ways of performing a deployment with CDK.
One is using the `cdk deploy` command,
and the other is through a pure CloudFormation deployment.

The one thing that differentiates a CDK deploy from a CloudFormation deployment are
[Assets](https://docs.aws.amazon.com/cdk/v2/guide/assets.html).
With `cdk deploy`, Assets are taken care of automatically by the CDK CLI,
while with CloudFormation, you need to deploy Assets separately,
before you deploy the actual Stack.

That would suggest that using `cdk deploy` is the preferred way,
but CloudFormation deployments have one significant advantage: security.
Deployments usually run with very wide permissions, often Admin permissions,
as it's in general very difficult to know what is the exact set of permissions needed to deploy a given CloudFormation template
(it greatly depends on what resources are present inside of it).
That poses some risk when running `cdk deploy` with those permissions --
the CDK CLI NPM package has quite a large dependency closure
(see [here](https://npmgraph.js.org/?q=aws-cdk)),
and any vulnerability in any of those dependencies might potentially put those credentials in jeopardy.

In addition, even if the CDK CLI was to remove all of its third-party dependencies,
`cdk deploy` would still not be perfectly safe -- because of Docker Assets.
The process of building an image from a Dockerfile can run arbitrary code when performing operations like installing packages from a package manager,
so any vulnerability in them might also jeopardize your credentials.

For these reasons, the decision on what deployment method to use should be done consciously,
weighing the tradeoffs between ease of use and security risks.
If you decide you want to use CloudFormation deployments,
and handle Assets separately, you'll probably need the
[`cdk-assets` command](https://www.npmjs.com/package/cdk-assets).

If you use the CDK Pipelines library that I mentioned above,
that decision will be made for you --
the library uses CloudFormation deployments.
If you look at the generated CodePipeline,
you will see a separate "PublishAssets" stage that comes before every deployment stage,
which takes care of deploying the Assets the application uses.

## 3. Synthesize your application only once

An important principle when creating your Deployment Pipeline is to only run the CDK `synthesis`
command once.
Synthesis is the process of generating artifacts needed for deployment --
what's called the [Cloud Assembly](https://docs.aws.amazon.com/cdk/v2/guide/apps.html#apps_cloud_assembly) --
from your CDK code.

If you've decided that you'll use CloudFormation deployments,
then synthesizing once is very easy.
You simply reference the generated CloudFormation template files that are present in the `cdk.out` directory,
where the Cloud Assembly is stored by default during synthesis.

However, if you've decided to use the CDK CLI to deploy,
it's easy to accidentally invoke synthesis multiple times,
because the `deploy` command also invokes the `synth` command.
So, if you have `cdk synth` in the first part of your Pipeline,
and then, let's say, `cdk deploy MyStack` in a subsequent part,
that second command will re-synthesize your application.
That's not optimal, as it risks creating a different output on the second synthesis run,
not to mention it's inefficient to perform redundant work,
and synthesis can take a non-trivial amount of time,
especially for larger applications.

Fortunately, it's very easy to avoid multiple syntheses,
by using the `--app` command-line option,
which also has a `-a` shorthand.
That option allows you to provide a directory that contains the Cloud Assembly.
So, assuming you have the output of the synthesis step available in your deployment step,
and you're using the default `cdk.out` output directory,
invoking the following command:

```shell
$ cdk deploy -a cdk.out MyStack
```

Will deploy the template for the Stack called `MyStack`
using the Cloud Assembly stored in the `cdk.out` directory,
without performing synthesis again.

Additionally, the `synth` step in your Deployment Pipeline is also a great place to run unit tests for your infrastructure code.
The CDK ships with an
[`assertions` library](https://aws.amazon.com/blogs/developer/testing-cdk-applications-in-any-language),
in all programming languages CDK supports,
that allows you to easily write unit and snapshot tests confirming your code generates the expected CloudFormation templates.
I strongly recommended using these capabilities.

## 4. Use Stages to group Stacks

In a
[previous article in the series](/cdk-tips-05-have-a-stack-instance-per-deployed-stack),
I recommended using separate Stacks for each
[environment](/software-project-environments)
your project supports (development, test, prod, etc.).
However, for simplicity and length considerations,
I omitted an important detail from that article:
how to organize your Stacks if your application consists of more than one of them?
The need for multiple Stacks happens often as the application grows in size --
for example, the article in this series about
[unblocking cross-Stack references](/cdk-tips-03-how-to-unblock-cross-stack-references)
demonstrates a common scenario,
where we put the storage resources in a different Stack than the compute resources.

The tool used for this purpose in the CDK is the
[`Stage` class](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.Stage.html).
A Stage is basically a container for your Stacks that groups them into logical units.
When using Stages, you instantiate them in the top-level entrypoint of your application,
instead of individual Stacks,
which allows you to eliminate any duplication.

To continue the example of a Producing and Consuming Stack from the
[article about cross-Stack references](/cdk-tips-03-how-to-unblock-cross-stack-references),
using Stages in this case would look something like this:

```ts
class MyStage extends cdk.Stage {
    constructor(scope: Construct, id: string, props?: cdk.StageProps) {
        super(scope, id, props);

        const producingStack = new ProducingStack(this, 'ProducingStack');
        new ConsumingStack(this, 'ConsumingStack', {
            bucket: producingStack.bucket,
        });
    }
}

const app = new cdk.App();

// test Stage
new MyStage(app, 'MyTestStage', {
    env: {
        account: 'test-account',
        region: 'test-region',
    },
});

// prod Stage
new MyStage(app, 'MyProdStage', {
    env: {
      account: 'prod-account',
      region: 'prod-region',
    },
});

// developer Stage
new MyStage(app, 'MyDevStage');
```

This is very similar to the example from the
["organizing your Stack instances"](/cdk-tips-05-have-a-stack-instance-per-deployed-stack)
article, just using Stages instead of instantiating Stacks directly.
This allows you to eliminate all duplication --
you don't have to repeat instantiating the producing Stack,
and then passing the Bucket from the producing to the consuming Stack.
You can do it once in the `MyStage` class,
and then instantiate that class multiple times.

Note that you can still use the CDK CLI with Stages in the same way as you use it for Stacks.
For example, if you're using `cdk deploy` for deployments,
you can deploy all Stacks from the test Stage,
in the correct dependency order,
by invoking `cdk deploy MyTestStage/*`.

The same goes for that last,
[developer](/cdk-tips-05-have-a-stack-instance-per-deployed-stack#developer-stacks), Stage.
For example, if you wanted to use the
[`cdk watch` command](/cdk-tips-06-speeding-up-cdk-application-development)
with this application, you would simply invoke:

```shell
$ cdk watch MyDevStage/*
```

And that will deploy the developer Stacks to your private AWS account every time any file is changed in your project,
using the quicker "hotswap" deployments.

If you're using the aforementioned CDK Pipelines library,
then you'll have no choice but to use the `Stage` class,
but I recommend using it to eliminate duplication even if you're not using that library.

## 5. Use test environments as gates before production

When doing CI/CD, it's imperative to not deploy straight to production,
but instead utilize test environments,
in order to ensure the given set of changes is safe to go out.
A Deployment Pipeline makes rolling out changes very efficient,
but that has the flip side of also being very efficient at breaking your application if you're not careful.

I mentioned above that writing unit tests for your CDK code is a best practice.
And while that's certainly true, only unit tests are not enough to make sure your application is functioning correctly.
So, in the Deployment Pipeline, you should first roll out your changes to at least one testing environment,
and then run
[integration](/unit-acceptance-or-functional-demystifying-the-test-types-part3)
or
[end-to-end](/unit-acceptance-or-functional-demystifying-the-test-types-part4)
tests on that environment to ensure the changes are safe.
Only after the tests pass, should the Pipeline continue with the deployment to production.

If you don't feel enough confidence in your automated tests
(or simply don't have any yet),
you can substitute them with a manual approval step in your Pipeline,
where a human is expected to verify the application in the testing environment is behaving as expected,
and then approve the change to promote it to production.
However, I would treat that only as a temporary stopgap --
requiring a human intervention for each change will reduce your release velocity dramatically,
and is also error prone
(humans are notoriously bad at performing repetitive tasks reliably),
so I would aim for replacing this procedure with automated tests at some point in the future.

## 6. Make sure the Pipeline itself is self-modifying

Whichever engine you use to implement your Deployment Pipeline,
it's important to make sure the Pipeline itself is also deployed in a continuous fashion --
meaning, its structure is represented in source code,
and any changes to that structure are deployed automatically,
without requiring any human intervention.

If you're using the CDK Pipelines library,
you get this capability for free:
the resulting CodePipeline is fully defined in your CDK application,
and any changes to it are deployed through a self-mutation step that occurs right after the synthesis step.

If you're not using the CDK Pipelines library,
you need to make sure your chosen CI/CD platform supports Infrastructure as Code deployments.

## Summary

To summarize, the six guidelines for successful CI/CD for CDK apps are:

1. Use the CDK Pipelines library if possible.
2. Decide how you want to deploy your Stacks.
3. Synthesize your application once, and run unit tests in that step.
4. Use Stages to organize your Stacks without any duplication.
5. Deploy to test environment(s) first, and gate promotion to production with automated tests.
6. Make sure the Deployment Pipeline itself is continuously deployed too.

I hope these are helpful when implementing CI/CD for your own CDK applications!
