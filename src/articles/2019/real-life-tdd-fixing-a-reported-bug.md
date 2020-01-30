---
id: 41
layout: article.html
title: "Real-life Test-Driven Development: fixing a reported bug"
summary: "
  Test-Driven Development is usually illustrated on simple, small examples,
  which might give the impression that it's a technique that doesn't apply well to more complex scenarios.
  In this article, I want to show how TDD works not on a synthetic example like a kata,
  but on an actual production bug that I encountered at my day job."
created_at: 2019-10-30
---

Test-Driven Development is one of the more divisive software development techniques.
It has its [staunch proponents](http://blog.cleancoder.com),
but also [very vocal critics](https://dhh.dk/2014/tdd-is-dead-long-live-testing.html).
The internet is full of articles arguing how TDD is either the
[best thing ever](https://www.youtube.com/watch?v=qkblc5WRn-U),
a [horrible idea](https://medium.com/@charleeli/why-tdd-is-bad-and-how-to-improve-your-process-d4b867274255),
and [everything](https://dev.to/ruairitobrien/does-test-driven-development-work-p54)
[in](https://henrikwarne.com/2019/09/29/when-tdd-is-not-a-good-fit)
[between](https://blog.cleancoder.com/uncle-bob/2014/04/30/When-tdd-does-not-work.html).

If you haven't heard about it before,
I would recommend [this article](http://butunclebob.com/ArticleS.UncleBob.TheThreeRulesOfTdd)
as an introduction, but the 10-second elevator pitch is as follows.
You reverse the generally accepted order of developing software;
instead of first writing the code, and then testing it,
you do it the other way around:
you start with the test,
and then write production code until that test
(and all of the ones you wrote before) pass.
Then you repeat that process,
until you've written all the production code you need.

If that description sounds weird to you,
that's probably because, without having experienced it yourself, it is!
It's a practice that seems very counterintuitive at first,
because it goes against the "obvious" way of writing software.
Because of this counter-intuitiveness,
TDD is famously difficult to grasp for beginners,
as it requires unlearning a bunch of habits that many developers have formed since they first started programming.

Probably for that reason, many articles and videos teaching TDD do so on a very small example,
like the famous [Roman numerals kata](https://remonsinnema.com/2011/12/05/practicing-tdd-using-the-roman-numerals-kata).
This is fine from a learning perspective,
but may give an impression that Test-Driven Development is applicable only in specifc, hand-picked cases
(a retort I've often heard from people learning it is:
"That's nice, but there's no way it could work for *my* project").

In this article, I hope to dispel that impression,
and show how I'm able use Test-Driven Development every day at work;
not on a kata example, but on a fix for a real production bug reported by a customer.
But before I tell that story,
let me give you some background about what is it exactly that I do.

## Background

I work for [Amazon Web Services](https://aws.amazon.com).
My team is responsible for a product called the [Cloud Development Kit](https://github.com/aws/aws-cdk).
The CDK is an open-source Infrastructure-as-Code framework that allows you to declare your AWS resources in a familiar programming language like Java, Python or TypeScript.

Part of my responsibilities is maintaining the CDK library for [AWS CodePipeline](https://aws.amazon.com/codepipeline).
If you're not familiar with it, CodePipeline is AWS' Continuous Delivery solution.
It allows you to model your release process, starting with your source code,
through building and testing,
and ending with deploying the built software to its target environments.
Let me briefly describe how the service works,
as it's actually important to the story -
feel free to skip down to the ['Issue'](#issue) paragraph below if you're already familiar with CodePipeline.

A CodePipeline deployment Pipeline consists of *Stages*.
Stages form a list.
Execution flows linearly between them -
a given Stage will start executing only when the previous one completes successfully.

Each Stage contains one or more *Actions*.
An Action is the basic unit of execution.
It can represent a source that triggers your Pipeline
(like a GitHub repository),
executing a build (for example, with [AWS CodeBuild](https://aws.amazon.com/codebuild)),
performing a deployment (possibly with something like [AWS CodeDeploy](https://aws.amazon.com/codedeploy)),
or any other action that you need to take in order to model your release process.
A Stage is considered to have executed successfully only when all Actions it contains have finished successfully.
The order in which the Actions execute in a Stage is determined by the `RunOrder` property;
Actions with a smaller `RunOrder` execute before those with a higher one.
The default `RunOrder`, if you don't provide a value for it, is `1`.
If two Actions in a given Stage have the same `RunOrder`,
they will execute concurrently.

Actions pass data to each other through something called *Artifacts*.
For example, the source Action that monitors your GitHub repository can output an Artifact that will contain all of the files of your project at a given commit.
That Artifact will be used as input into your build process,
which might produce a binary that is ready to be deployed.
So, the build Action will have a different Artifact as output,
that will then be used as the input to the deployment Action,
and so on and so forth.
You can model any release process by having Actions pass Artifacts between each other.

Now, I hope it's clear from the above description that the Artifact passing needs to fulfill certain conditions to be considered correct.
Some of them are:

* An Artifact must be used as an output in a previous Action before it can be passed as an input to a different Action.
  In this context, "previous" means either from an earlier Stage,
  or with a smaller `RunOrder` if both Actions belong to the same Stage.
* The same Artifact can never be used as an output more than once.

To help discover problems sooner in the development cycle,
the CodePipeline CDK library implements these validations -
if you break any of the above rules,
you will get an exception executing your CDK code.
And it was in these validations that a bug was lurking.

## Issue

On May 15 2019, CDK customer [Bogdan Ghidireac](https://github.com/ghidi)
submitted [a bug](https://github.com/aws/aws-cdk/issues/2549) to the project.
Bogdan had a pipeline with the following structure:
two source Actions in the first Stage,
and two build Actions in the second,
of which the first one, with `RunOrder` 1,
had an output Artifact that fed into the second,
which had `RunOrder` set to 2. This is clearly a correct CodePipeline,
however the CDK was reporting a validation error during execution.

Now, when I'm dealing with bugs,
usually the first thing I try to do is reproduce it.
So, I fired up Intellij, and wrote the following test,
that attempts to create a CodePipeline with an identical structure to the one described above:

```typescript
  "an Action's output can be used as input for an Action in the same Stage with a higher runOrder"(test: Test) {
    const stack = new Stack();

    const sourceOutput1 = new codepipeline.Artifact('sourceOutput1');
    const sourceOutput2 = new codepipeline.Artifact('sourceOutput2');
    const buildOutput1 = new codepipeline.Artifact('buildOutput1');

    new codepipeline.Pipeline(stack, 'Pipeline', {
      stages: [
        {
          stageName: 'Source',
          actions: [
            new FakeSourceAction({
              actionName: 'source1',
              output: sourceOutput1,
            }),
            new FakeSourceAction({
              actionName: 'source2',
              output: sourceOutput2,
            }),
          ],
        },
        {
          stageName: 'Build',
          actions: [
            new FakeBuildAction({
              actionName: 'build1',
              input: sourceOutput1,
              output: buildOutput1,
            }),
            new FakeBuildAction({
              actionName: 'build2',
              input: sourceOutput2,
              extraInputs: [buildOutput1],
              runOrder: 2,
            }),
          ],
        },
      ],
    });

    expect(stack).to(haveResourceLike('AWS::CodePipeline::Pipeline', {
      // no assertion needed – validation error
    }));

    test.done();
  },
```

Couple of notes about the above code:

* It uses [TypeScript](https://www.typescriptlang.org/) (like all sample code in this article),
  as that's the language CDK is written in.
  The test itself uses the [NodeUnit](https://www.npmjs.com/package/nodeunit) library
  (although we have an effort in the project to move to the [Jest](https://jestjs.io) framework),
  and the assertions are taken from a module in the project called [@aws-cdk/assert](https://www.npmjs.com/package/@aws-cdk/assert).
* I used two CodePipeline Action classes that are only available for tests,
  `FakeSourceAction` and `FakeBuildAction`.
  Of course, Bogdan couldn't have used them in his Pipeline,
  but the bug description made me strongly suspect the problem lay somewhere in the Artifacts logic rather than in any of the Action classes,
  so I thought using "fake" Actions wouldn't make a difference for reproducing this issue
  (spoiler alert: I was right, it didn't).

When I ran this test, it failed with the exact same error message Bogdan saw:
`Artifact 'buildOutput1' was used as input before being used as output`.
Since clearly this was not true -
`buildOutput1` was given as the output Artifact of the `build1` Action,
which executes before `build2`,
because of `RunOrder` being set to the default 1 value -
the bug was now confirmed and reproduced.

We are now in the "Red" part of the
[TDD cycle](https://www.codecademy.com/articles/tdd-red-green-refactor).
Time to look at production code!
Here's the part of the CodePipeline class that performs the Artifacts validation:

```typescript
  private validateArtifacts(): string[] {
    const ret = new Array<string>();

    const outputArtifactNames = new Set<string>();
    for (const stage of this.stages) {
      const sortedActions = stage.actions.sort((a1, a2) => a1.runOrder - a2.runOrder);

      // start with inputs
      for (const action of sortedActions) {
        const inputArtifacts = action.inputs;
        for (const inputArtifact of inputArtifacts) {
          if (!outputArtifactNames.has(inputArtifact.artifactName)) {
            ret.push(`Artifact '${inputArtifact.artifactName}' was used as input before being used as output`);
          }
        }
      }

      // then process outputs by adding them to the Set
      for (const action of sortedActions) {
        const outputArtifacts = action.outputs;
        for (const outputArtifact of outputArtifacts) {
          if (outputArtifactNames.has(outputArtifact.artifactName)) {
            ret.push(`Artifact '${outputArtifact.artifactName}' has been used as an output more than once`);
          } else {
            outputArtifactNames.add(outputArtifact.artifactName);
          }
        }
      }
    }

    return ret;
}
```

The algorithm is as follows: for every Stage,
we iterate through every Action in it,
in order of ascending `RunOrder`s, twice:
first to verify all inputs,
and then to add all outputs to a set,
which is used for input verification for the later Stages.

Can you spot what the bug is?
The problem with the above algorithm is that it fails if a given Artifact is used both as an output and an input for Actions in the same Stage.
That's exactly the situation  Bogdan reported,
and was captured in the above test:
`buildOutput1` is the output of `build1`,
while being used as the input for `build2`,
which are both in the `Build` Stage.

The bug is the double loop:
because we verify the inputs to all Actions in a given Stage are correct first,
any output Artifacts in that Stage will not be taken into account when doing that validation.

The solution?
The same code as before, but in only one loop!
Remember that we iterate through the Actions from the lowest `RunOrder` to the highest;
which means if we verify the inputs,
and then recognize the outputs of an Action in one iteration,
subsequent input verifications of Actions in that Stage will "see" those outputs from the previous Actions.

So, the change should be:

```diff
  private validateArtifacts(): string[] {
    const ret = new Array<string>();

    const outputArtifactNames = new Set<string>();
    for (const stage of this.stages) {
      const sortedActions = stage.actions.sort((a1, a2) => a1.runOrder - a2.runOrder);

      // start with inputs
      for (const action of sortedActions) {
        const inputArtifacts = action.inputs;
        for (const inputArtifact of inputArtifacts) {
          if (!outputArtifactNames.has(inputArtifact.artifactName)) {
            ret.push(`Artifact '${inputArtifact.artifactName}' was used as input before being used as output`);
          }
        }
-     }

      // then process outputs by adding them to the Set
-     for (const action of sortedActions) {
        const outputArtifacts = action.outputs;
        for (const outputArtifact of outputArtifacts) {
          if (outputArtifactNames.has(outputArtifact.artifactName)) {
            ret.push(`Artifact '${outputArtifact.artifactName}' has been used as an output more than once`);
          } else {
            outputArtifactNames.add(outputArtifact.artifactName);
          }
        }
      }
    }

    return ret;
}
```

That's right -- the entire fix is removing 2 lines of code!

But how do we make sure this indeed corrects the problem?
Some of you might be tempted to verify it manually -
create a CodePipeline similar to the one Bogdan had,
and see if it deploys and runs correctly.
But there is a much more efficient way to get feedback than that -
remember, we're using Test-Driven Development,
and we just wrote a new test covering this case,
which we saw fail!
So, all we have to do is re-run the tests.
That's exactly what I did when I was originally working on this issue,
and, lo and behold, the new test that was previously failing passed!

Importantly, all of the previously written tests in the CDK CodePipeline module passed as well.
When doing TDD, our goal is to have all tests passing in the "Green" phase,
not just the one we added in the "Red" phase.
This way, we can be certain the production fix not only corrected the reported problem,
but that it also didn't introduce any regressions in the process.

And so, we're done!
We are certain that the issue has been fixed,
and that the production change did not introduce any new bugs.
Finally, we have the last phase of the TDD cycle, "Refactor".
In this case, the production change was tiny,
and the test code looks fine to me as-is,
so the only adjustment I would make is moving the comments in the production code a little bit
(because of the removed lines, they are a little misplaced).

## Further reading

Of course, there were some fortunate circumstances in this bug that made writing a unit test for it easy.
If the problem manifested itself not during validation,
but later in the lifecycle
(for example, during deployment, or even during the Pipeline's runtime),
writing a test reproducing it would be much, much harder.
However, I think there's still value in the story -
in many projects, unit tests can cover a wide area of functionality,
and a similar process can be used with integration or even end-to-end tests
(see below).

If you want to learn more about Test-Driven Development,
I can recommend the following books:

* Kent Beck's ["Test-Driven Development: By Example"](https://www.amazon.com/gp/product/0321146530/ref=as_li_tl?ie=UTF8&tag=endoflineblog-20&camp=1789&creative=9325&linkCode=as2&creativeASIN=0321146530&linkId=2a5be095ac3298a61cf2a59842b64665)
* ["Extreme Programming Explained"](https://www.amazon.com/gp/product/0321278658/ref=as_li_tl?ie=UTF8&tag=endoflineblog-20&camp=1789&creative=9325&linkCode=as2&creativeASIN=0321278658&linkId=e9e65a372df2aa1ff5dd3ea3e2067ccf), also by Kent Beck, with Cynthia Andres
* ["Growing Object-Oriented Software, Guided by Tests"](https://www.amazon.com/gp/product/0321503627/ref=as_li_tl?ie=UTF8&tag=endoflineblog-20&camp=1789&creative=9325&linkCode=as2&creativeASIN=0321503627&linkId=ddfb1e4d66ed48d7afdb4063de0e7b32), by Steve Freeman and Nat Pryce (I [wrote about this book on this blog before](/recreating-the-code-from-the-goos-book-example-project)) -- especially if you want to see how TDD extends to non-unit tests

Thanks for reading!
