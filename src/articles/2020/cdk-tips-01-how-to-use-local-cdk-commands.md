---
id: 47
layout: article.html
title: CDK tips, part 1 – how to use local CDK commands
summary: |
  I'm starting a new series with practical tips on working with the Cloud Development Kit.
  In part 1,
  I'll be talking about how to use a local version of the CDK command line.
created_at: 2020-06-22
---

My day job at AWS is working on the
[Cloud Development Kit](https://github.com/aws/aws-cdk) team.
CDK is an open-source Infrastructure-as-Code solution for provisioning AWS resources using familiar programming languages like JavaScript (and TypeScript),
Python, and Java.

I want to start a series of articles with some practical tips on working with the CDK,
each focused on one aspect of the framework.
In the first one,
I'll talk about the different ways to approach the CDK CLI commands.

## CDK structure

Let me explain exactly what I mean when I say "CDK CLI commands".

The CDK,
from a high-level,
is divided into two main components.
The first one are construct libraries.
Those are the software modules that you use directly in your CDK code.
They are listed as dependencies of your project in the build tool for the language you're writing your CDK code in.
For example, the CDK team vends a library for each AWS service,
containing functionality related to that service.
So, if you need to manage
[S3 Buckets](https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingBucket.html)
in your CDK app,
and you're using Java,
you would add a dependency to your `pom.xml` or `build.gradle`
file on the
[`software.amazon.awscdk`:`s3` module](https://search.maven.org/artifact/software.amazon.awscdk/s3);
if you were using JavaScript or TypeScript,
its equivalent would be the
[`@aws-cdk/aws-s3` NPM package](https://www.npmjs.com/package/@aws-cdk/aws-s3), etc.
There is a version of that S3 library for each language supported by the CDK.
There are also other libraries,
written and released independently of the core CDK product,
like [a module](https://github.com/alexpulver/cdk-chalice)
for using AWS Chalice with the CDK,
and hundreds (if not thousands)
of others.

The second high-level component of the CDK is the command-line interface;
it's what actually implements commands like `cdk deploy`,
`cdk synth`, and others.
It's quite different than the construct libraries.
It doesn't have a version for each supported language;
it only exists in the
[`aws-cdk` JavaScript package](https://www.npmjs.com/package/aws-cdk).
This means that,
in order to use the CDK,
you need to have NodeJS installed,
even if you're using a language other than JavaScript or TypeScript.

## Commands location -- global

So, how do you get the CDK CLI on your machine?
The ['Getting Started' guide for CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html#getting_started_install)
suggests installing the `aws-cdk` package globally.
This means invoking `npm` with the `-g` switch,
like `npm install -g aws-cdk`.
This installs the package in a shared `node_modules` folder,
usually in your home directory,
and makes it available in your `PATH` environment variable.
This way, you can invoke `cdk <command>` from anywhere in your terminal.

And while there's nothing wrong with that method,
it has a few downsides.
Number one,
installing packages globally has
[kind of a bad reputation](https://www.smashingmagazine.com/2016/01/issue-with-global-node-npm-packages)
in the Node community.
Some developers even go so far as to have a rule stating to never install packages globally.

And secondly,
the command `npm install -g aws-cdk` will install the latest version of the `aws-cdk` package,
which might be later than the version of the core construct libraries you're using in your project.
And while that shouldn't cause any issues --
the CDK CLI strives to maintain backwards compatibility,
so it should always be safe to upgrade it --
it's not perfectly in the spirit of Infrastructure as Code,
where we try to keep all aspects of our application under source control.
This is especially true if you're executing CDK code as part of a
[Deployment Pipeline](https://www.amazon.com/gp/product/0321601912),
for example in [AWS CodePipeline](https://aws.amazon.com/codepipeline),
or with [GitHub Actions](https://github.com/features/actions) --
using the latest version of a package makes your build unnecessarily non-reproducible.

## Commands location -- local

So, if not `npm install -g`, what is the alternative?
It's to have an explicit dependency on the `aws-cdk` package in a `package.json` file that's part your project,
and then have a `script` section inside of it,
that invokes that local package.
It looks something like this:

```json
{
    "devDependencies": {
        "aws-cdk": "1.44.0"
    },
    "scripts": {
        "cdk": "cdk"
    }
}
```

With this setup,
you can now run `npm install` to get a project-specific copy of the `aws-cdk` package.
You'll be guaranteed that it will be installed in the version that you specified
(`1.44.0` in our example).
If you ever want to migrate to a newer version,
you can do it through a code change,
which can be properly versioned,
and rolled back in the unlikely event that it causes some issues.

To use the local version of the `aws-cdk` package when working with your project,
instead of just invoking `cdk <command>` like before,
you run `npm run cdk <command>`,
or `yarn cdk <command>` if you're using [Yarn](https://yarnpkg.com).

If you used the `cdk init` command to create your project with either `javascript`
or `typescript` passed as the value of the `--language` parameter,
you get this configuration out of the box,
so there' nothing special you have to do in order to use local CDK commands.

With other languages, my recommendation is to actually add a `package.json`
file to your project,
with the same contents as the snippet above,
even if it uses a language that has nothing to do with NodeJS,
like Java or Python.
Since you need a dependency on a NodeJS runtime anyway to run CDK,
even for non-Node languages,
I think making it explicit is a good idea.

For example, I've created a GitHub template repository
for a CDK Java application using Gradle
(the templates that CDK ships with for Java use Maven):
https://github.com/skinny85/cdk-java-gradle-template.
You'll see that includes a
[`package.json` file](https://github.com/skinny85/cdk-java-gradle-template/blob/master/package.json)
in addition to the standard Gradle files like `build.gradle`,
`settings.gradle`, etc.
So, the full workflow for running a project using that template in a CI environment would be something like:

```shell
npm install # install the CDK CLI locally
./gradlew build # compile the Java code, and run unit tests
npm run cdk synth # synthesize the resulting CloudFormation template 
```

## CDK init and NPX

There is one area where the globally-installed CDK CLI is very valuable,
and that is when starting a new project.
The `aws-cdk` package contains the `init` command,
which creates a basic scaffolding of a working CDK project in a given language.

When running `cdk init`,
you obviously can't use a local version of the CLI,
because there's no "local" yet --
you're just creating the project!

Fortunately, the Node ecosystem already has a solution for the problem of invoking commands from a package without the need for installing it globally:
the [`npx` tool](https://www.npmjs.com/package/npx),
which ships with all modern distributions of NodeJS.
So, instead of invoking `cdk init --language=<lang>`
you would call `npx cdk init --language`,
and `npx` will download the latest version of the `aws-cdk` package,
and store it in a temporary directory.
The end effect will be the same,
without the need for installing anything globally.
After the project has been initiated,
you can switch to using the local version of the CLI,
as described above.

(BTW, you can also keep using the same `npx cdk`
command for invoking the local version of the CLI;
if `npx` finds the package it needs in a local `node_modules`,
it will use it directly instead of downloading it from [npmjs.org](https://npmjs.org).
`npx` is a little shorter than `npm run`,
and also has better behavior than `npm` when passing long-form options
(those that start with `--`)
to the underlying command --
in `npm`, you have to separate them with an initial `--`,
or they'll be swallowed by the `npm`
command instead of being passed to the invoked executable,
while `npx` doesn't have this problem)

## Summary

So, I would recommend having a `package.json` file as part of your CDK project,
even if it's written in a non-Node language like Java or Python.
With that, you can use either `npm run cdk` or `npx cdk`,
instead of just `cdk`,
to call the locally-installed CLI commands,
guaranteeing they will have the exact version you specified in `package.json`.
This ensures perfect reproducibility of your builds,
both locally and in your CI environment.
