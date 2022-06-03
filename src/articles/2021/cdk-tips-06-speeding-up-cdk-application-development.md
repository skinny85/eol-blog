---
id: 59
layout: cdk-tips.html
title: CDK tips, part 6 – speeding up CDK application development
summary: |
  In part 6 of the 'CDK tips' series,
  we show how to accelerate deployments of code-only changes
  during development of CDK applications,
  using the new 'hotswap deployments' functionality.
created_at: 2021-10-09
---

When iterating on a Cloud Development Kit application,
the typical workflow used is:

1. Make a change to your CDK code.
2. Optional: run the `cdk diff` command to verify the changes made had the expected effect on the resulting CloudFormation template.
3. Run the `cdk deploy` command to apply these changes to your running instance of the application.
4. Verify whether the applied changes had the desired effect,
  by exercising your application -- for example,
  refreshing the webpage, or invoking a function
  (if your application is built on AWS Lambda).
  This could also be an automated test.

The bottleneck of this process is step 3.
CloudFormation deployments are usually fairly slow,
mainly because of the complicated lifecycle of resources involved in each deployment
(their updates might cause replacements,
failures might result in rollbacks of previously created or updated resources,
etc.).
A typical CloudFormation stack update takes on the order of minutes.
While that's tolerable if you're deploying infrequently,
when you want to iterate quickly on the code of your application,
it makes the feedback loop between making your changes,
and being able to try them out,
too long --
you want this cycle time to be measured in seconds,
not minutes.

Since CDK uses CloudFormation under the hood,
running `cdk deploy` is constrained by the CloudFormation stack update speed.
However, starting with
[version `1.122.0`](https://github.com/aws/aws-cdk/releases/tag/v1.122.0),
CDK ships with a way to shorten this feedback loop in some cases.

The feature is a new option added to the `cdk deploy` command,
called `--hotswap`.
It allows, under certain conditions,
to accelerate the deployment by skipping CloudFormation completely,
and updating the changed resources directly.
This has a pretty dramatic effect on the duration of the deployment.
The exact numbers vary based on many details like the resource type,
your network connection, etc.,
but for Lambda functions,
it's typical to see an order of magnitude speedup,
going from minutes to several seconds.

What are the conditions under which we can perform this accelerated deployment?
The most important factor is the type of change.
In general, only changes to the code of your application
(those represented in CDK by [Assets](https://docs.aws.amazon.com/cdk/latest/guide/assets.html)),
are supported.
The canonical example is a change only to the code of a Lambda function.
At the time of writing this article,
only Lambda function code changes are supported for hotswapping,
but support for other types of changes is coming,
like the definition of a StepFunctions State Machine,
or the code of an ECS Service.
Check out
[this page](https://github.com/aws/aws-cdk/blob/master/packages/aws-cdk/README.md#hotswap-deployments-for-faster-development)
for the most up-to-date list of the types of changes that support hotswapping.

If you invoke `cdk deploy --hotswap`,
and you made changes to your application that can't be hotswapped,
the tool will fall back to doing a full CloudFormation deployment.

And finally, one more important note.
Hotswap deployments deliberately introduce drift in your CloudFormation Stacks in order to speed up deployments.
For that reason, you should **never** use this feature for your production deployments;
it's meant only to be used for development purposes.
Your production deployments should always go through CloudFormation,
exactly like they do now.

I've also recorded a simple demo, showing the hotswap functionality in action:

<iframe width="560" height="315" frameborder="0"
  src="https://www.youtube.com/embed/XBfgvXEaUz0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  style="margin: auto; display: block; max-width: 100%;" allowfullscreen></iframe>

There's also another useful command that goes hand in hand with hotswapping: `watch`.
It's both a top-level command, invoked as `cdk watch`,
or an argument to the deploy command, as in `cdk deploy --watch`
(the two ways of invoking it are equivalent).
The idea behind the command is similar to watch modes in other tools,
like the TypeScript compiler, or the Jest testing framework.
It's a continuous process that, once started,
monitors the files of your project.
Whenever it detects one of those files changes,
it immediately triggers a `cdk deploy`,
without the need for invoking the command manually.
This further shortens the feedback loop when doing development on your private copy of a CDK application.

By default, the deployments triggered by `watch` are the faster hotswap deployments we talked about above.
If you'd rather use the command with CloudFormation deployments,
you can turn off hotswapping with the `--no-hotswap` switch:

```shell
$ cdk watch --no-hotswap MyDevStack
```

One thing to note here is that in order for the `watch` command to work,
you need to have a setting in your `cdk.json` file under a `"watch"` key.
If you're created your CDK application with the `cdk init` command with a recent
(anything newer than `1.122.0`)
version, chances are your application already has that key --
if not, you'll need to add it yourself.
The command has some defaults,
so the smallest valid value of that key is just an empty object:

```json
{
  "app": "<language-specific run command>",
  "watch": {}
}
```
You can specify what files you want the `watch` process to include when observing for changes,
and which to ignore, with the `"include"` and `"exclude"` keys of that object.
For example, for Java, you could do something like:

```json
{
  "app": "mvn -e -q compile exec:java",
  "watch": {
    "include": ["**/*.java"],
    "exclude": "**/*.class"
  }
}
```

As the example shows,
the `"watch"` object accepts as values both arrays, and single paths,
and allows specifying file blobs.
