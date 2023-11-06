---
id: 71
layout: article.html
title: History and future of Infrastructure as Code
summary: |
   In this article, I want to discuss Infrastructure as Code -
   the history of the practice,
   why it's important, what benefits does it bring,
   and what innovations are being developed in this very active area of software engineering.
created_at: 2023-05-13
---

Infrastructure as Code is a fascinating domain of software development.
While as a discipline it's still relatively young,
not only has it already undergone several paradigm-shifting transformations in its short lifetime,
but I think it's one of the hottest areas of software development innovation today,
with several players -- ranging from Big Tech to young startups --
creating new approaches that, if fully realized,
have a chance of completely transforming the way we write and deploy software.

In this article, I want to do a deep dive into the topic of Infrastructure as Code:
what is it, what benefits does it bring, what were those paradigm-shifting transformations that it went through already,
and what the future might hold for it.

## What is Iac?

Let's start with explaining the concept.
Infrastructure as Code is an umbrella term for a set of practices and tools that aim to apply the same rigor
and learnings from application development to the domain of infrastructure provisioning and maintenance.

"Infrastructure" here is deliberately ambiguous,
but we can define it as everything that is needed in the environment to run a given application,
but that is not part of the application itself.
Some common examples are: servers, configuration, networking, databases, storage, etc.
We'll also see more examples later in the article.

The practices of Infrastructure as Code mirror those of runtime code.
These include things like:
versioning with source control,
automated testing,
CI/CD deployment pipelines,
local development for rapid feedback, etc.

What advantages do we get from following these practices for infrastructure?

- **Performance**. If you need to provision or change a large amount of infrastructure,
  IaC will always be faster than a human manually performing the same operations.
- **Reproducibility**. Humans are notoriously bad at performing the same tasks over and over in a reliable way.
  If we need to do the same thing a hundred times,
  it's very likely we'll get distracted, and mess something up along the way.
  IaC doesn't suffer from this issue.
- **Documentation**. Your IaC code doubles as the documentation of the architecture of your system.
  This becomes crucial when the size of the team maintaining the system grows --
  you don't want to rely on tribal knowledge, or have only a few team members who know how the system's infrastructure works.
  As an additional bonus, this documentation can never become out-of-date,
  unlike typical documentation.
- **Audit history**. With IaC, since you version control your infrastructure code the same way as your application code
  (which is sometimes referred to as [GitOps](https://about.gitlab.com/topics/gitops)),
  it gives you history that you can look at to see how your infrastructure changed over time,
  and a way to roll back to a safe spot if any change causes issues.
- **Testability**. Infrastructure code can be tested, just like application code.
  You can test it at all levels, so
  [unit](/unit-acceptance-or-functional-demystifying-the-test-types-part2),
  [integration](/unit-acceptance-or-functional-demystifying-the-test-types-part3) and
  [end-to-end](/unit-acceptance-or-functional-demystifying-the-test-types-part4) tests.

Now, let's talk about the major phases that IaC tooling went through since the inception of the practice.

## First generation: declarative, host provisioning

**Examples**:
[Chef](https://docs.chef.io),
[Puppet](https://www.puppet.com/blog/what-is-infrastructure-as-code),
[Ansible](https://www.ansible.com)

The first generation of infrastructure as code tools were all about **host provisioning**.
This makes a lot of sense, since infrastructure for software systems,
at its lowest level of abstraction, consists of individual machines.
So, the first tools in this space focused on configuring those machines.

The infrastructure resources that these tools manage are familiar concepts from Unix:
files, packages from a package manager like
[Apt](https://ubuntu.com/server/docs/package-management)
or [RPM](https://rpm.org),
users, groups, permissions, init services, and so on.

Here's an example of an
[Ansible playbook](https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_intro.html)
for creating a Java service:

```yaml
- hosts: app
  tasks:
  - name: Update apt-get
    apt: update_cache=yes

  - name: Install Apache
    apt: name=apache2 state=present

  - name: Install Libapache-mod-jk
    apt: name=libapache2-mod-jk state=present

  - name: Install Java
    apt: name=default-jdk state=present

  - name: Create Tomcat node directories
    file: path=/etc/tomcat state=directory mode=0777
  - file: path=/etc/tomcat/server state=directory mode=0775

  - name: Download Tomcat 7 package
    get_url: url=http://apache.mirror.digionline.de/tomcat/tomcat-7/v7.0.92/bin/apache-tomcat-7.0.92.tar.gz dest='/etc/tomcat'
  - unarchive: src=/etc/tomcat/apache-tomcat-7.0.92.tar.gz dest=/etc/tomcat/server copy=no

  - name: Configuring Mod-Jk & Apache
    replace: dest=/etc/apache2/sites-enabled/000-default.conf regexp='^</VirtualHost>' replace="JkMount /status status \n JkMount /* loadbalancer \n JkMountCopy On \n </VirtualHost>"

  - name: Download sample Tomcat application
    get_url: url=https://tomcat.apache.org/tomcat-7.0-doc/appdev/sample/sample.war dest='/etc/tomcat/server/apache-tomcat-7.0.92/webapps' validate_certs=no

  - name: Restart Apache
    service: name=apache2 state=restarted

  - name: Start Tomcat nodes
    command: nohup /etc/tomcat/server/apache-tomcat-7.0.92/bin/catalina.sh start
```

The level of abstraction this playbook operates on is a single computer with Linux as its operating system.
We declare what Apt packages we want to install,
what files we want to create
(there are multiple ways of creating them:
directly at a given path for directories,
downloading from a given URL, extracting files from an archive,
or editing an existing file according to a regular expression substitution),
what system services or commands we want to run, etc.
In fact, if you squint just a little bit,
this playbook looks very similar to a Bash script.
The main difference is that the playbook is declarative --
it describes what it wants to happen,
like a given Apt package being installed on the machine.
This is different from a script, which contains commands to execute.
While the difference is small, it's important;
it makes the playbook [idempotent](https://en.wikipedia.org/wiki/Idempotence),
which means, even if it failed somewhere in the middle
(maybe `tomcat.apache.org` had a momentary outage, and so the download from it failed),
you can restart it, and the steps that executed successfully previously will recognize that fact,
and pass without doing anything, which is generally not the case with a Bash script.

Now, these tools were very important,
and moved the software development industry forward in many important ways.
However, the fact that they work on the level of an individual host is a huge limitation.
That means you either have to manage these hosts manually,
negating a lot of the benefits of Infrastructure as Code,
or need to combine these tools with something that manages the hosts themselves,
such as [Vagrant](https://developer.hashicorp.com/vagrant/tutorials/getting-started)
for local development, or
[OpenStack](https://www.openstack.org)
for shared environments, such as production.
For example, if you wanted to create a classic
[three-tier architecture](https://en.wikipedia.org/wiki/Multitier_architecture#Three-tier_architecture),
you would create 3 virtual machines types,
each with its own Ansible playbook,
that would configure the hosts according to the role they played in the architecture.

The next phase of IaC tools would get rid of this limitation.

## Second generation: declarative, Cloud

**Examples**:
[CloudFormation](https://aws.amazon.com/cloudformation),
[Terraform](https://www.terraform.io),
[Azure Resource Manager](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/overview)

The introduction of the Cloud in the mid-2000s was a landmark event in software development history.
In many ways, I think we're still processing how big of a revolution it really was.

Suddenly, the issues with managing hosts were solved.
You didn't need to run and operate your own OpenStack cluster to automate management of virtual machines;
the cloud providers would handle all of that for you.

But even more importantly,
the Cloud immediately raised the level of abstraction at which we designed our systems.
It was no longer just a matter of assigning different roles to hosts.
If you needed [publish-subscribe resources](https://en.wikipedia.org/wiki/Publish%E2%80%93subscribe_pattern),
there was no point provisioning a virtual machine,
and installing the [ZeroMQ](https://zeromq.org/download) package from Apt on it;
instead, you used [Amazon SNS](https://aws.amazon.com/sns).
If you wanted to store some files, you didn't designate a bunch of hosts as your storage layer;
instead, you created an [S3 bucket](https://aws.amazon.com/s3).
And so on, and so forth.

Instead of **host provisioning** being front and center,
we entered a phase of **configuring managed services**.
And since the tools from the previous generation were designed to only work on the level of an individual host,
a new approach was needed.

To solve this issue, tools like CloudFormation and Terraform emerged.
Similarly to the first generation, they are also declarative;
but unlike them, the level of abstraction they operate on is not files and packages on a single machine,
but instead individual resources that belong to different managed services,
their properties, and their relationships with each other.

For example, here's a CloudFormation template that defines an
[AWS Lambda function](https://aws.amazon.com/pm/lambda) triggered by an
[SQS queue](https://aws.amazon.com/sqs):

```yaml
AWSTemplateFormatVersion: 2010-09-09
Resources:
  LambdaFunction:
    Type: AWS::Lambda::Function
    Properties:
      Code:
        S3Bucket: my-source-bucket
        S3Key: lambda/my-java-app.zip
      Handler: example.Handler
      Role: !GetAtt LambdaExecutionRole.Arn
      Runtime: java17
      Timeout: 60
      MemorySize: 512
  MyQueue:
    Type: AWS::SQS::Queue
    Properties:
      VisibilityTimeout: 120
  LambdaFunctionEventSourceMapping:
    Type: AWS::Lambda::EventSourceMapping
    Properties:
      BatchSize: 10
      Enabled: true
      EventSourceArn: !GetAtt MyQueue.Arn
      FunctionName: !GetAtt LambdaFunction.Arn
  LambdaExecutionRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service:
                - lambda.amazonaws.com
            Action:
              - sts:AssumeRole
      Policies:
        - PolicyName: allowLambdaLogs
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - logs:*
                Resource: arn:aws:logs:*:*:*
        - PolicyName: allowSqs
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - sqs:ReceiveMessage
                  - sqs:DeleteMessage
                  - sqs:GetQueueAttributes
                  - sqs:ChangeMessageVisibility
                Resource: !GetAtt MyQueue.Arn
```

This CloudFormation template looks very different from the Ansible playbook we saw above.
It doesn't contain any mention of files, packages, or init services;
instead, it speaks the language of managed services.
We provision resources of type `AWS::Lambda::Function` and `AWS::SQS::Queue`.
We don't define what hosts these things will execute on,
and how those hosts are configured --
all we are concerned about is that the managed services the Cloud vendor provides are used in the correct way.

However, the thing that it has in common with Ansible is its declarative nature.
We don't write a call to the SQS API to [create a queue](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_CreateQueue.html) --
we just declare we want a queue with the `VisibilityTimeout`
property set to `120`,
and the deployment engine
(CloudFormation in this case)
takes care of the details of which AWS APIs have to be called to achieve that goal.
If we later decide we want to modify the queue
(maybe we want the timeout to be `240`, not `120`),
or get rid of it completely,
we simply change the template,
and the engine will figure out the necessary API calls to update or delete it, respectively.

These tools were a huge milestone in the evolution of Infrastructure as Code,
and raised the level of abstraction from the previous generation considerably.
However, they too have some downsides.

The first issue is that to achieve their declarative nature,
they use a custom [DSL](https://en.wikipedia.org/wiki/Domain-specific_language),
in the case of CloudFormation, in either JSON or YAML format.
This means that all the facilities of a general-purpose programming language,
like variables, functions, loops, `if` statements, classes, etc.
are not available in that DSL.
This means there's no easy way to reduce duplication;
for example, if we wanted to have not one,
but three queues with identical configuration in our app,
we can't just write a loop that executes three times;
we have to copy&paste the same definition three times,
which isn't ideal.
It also means it's not possible to split the template into logical units;
there's no way to designate a given group of resources as the storage layer,
another group as the frontend layer, etc. --
all resources belong to one flat namespace.

The other issue with these tools is that,
while they were definitely higher-level than the host provisioning from the first generation,
they still required you to specify all details of all resources you used in your system.
For instance, you've probably noticed that in the above example template,
besides the Lambda and SQS resources,
which is what we are mainly concerned about,
we also have these event mapping and [IAM](https://aws.amazon.com/iam) resources.
This is required "glue" in order to connect SQS to Lambda,
and correctly configuring these "glue"resources is not trivial.
For example, there's a very specific set of permissions
(`sqs:ReceiveMessage`, `sqs:DeleteMessage`, `sqs:GetQueueAttributes`, and `sqs:ChangeMessageVisibility`)
that you need to grant to the IAM role in the context of which the function is executing in order to be able to successfully trigger it from a given queue.

In a way, this is a very low-level concern;
however, because of the aforementioned lack of abstraction facilities in the DSL,
there are really no tools available that would allow us to hide these implementation details.
So, every time you need to create a new Lambda function triggered by an SQS queue,
you would have no choice but to essentially duplicate that fragment with those 4 permissions.
For this reason, these templates have a tendency to quickly become verbose,
and contain a lot of repetition inside them.

## Third generation: imperative, Cloud

**Examples**:
[AWS CDK](https://aws.amazon.com/cdk),
[Pulumi](https://www.pulumi.com),
[SST](https://sst.dev)

All downsides of the tools from the second generation can be traced back to the fact that they use a custom DSL
that lacks the typical abstraction facilities, such as:
variables, functions, loops, classes, methods, etc.,
that we are used to when using general-purpose programming languages.
So, the main idea behind the third generation of Infrastructure as Code tools was simple:
if general-purpose programming languages have these facilities already,
why don't we use them to define infrastructure,
instead of a custom JSON or YAML DSL?

For example, let's look at a Cloud Development Kit program equivalent to the above CloudFormation template
(I'll be using TypeScript for this example,
but any other CDK-supported language would look very similar):

```ts
class LambdaStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const func = new lambda.Function(this, 'Function', {
            code: lambda.Code.fromBucket(
                s3.Bucket.fromBucketName(this, 'CodeBucket', 'my-source-bucket'), 
                'lambda/my-java-app.zip'),
            handler: 'example.Handler',
            runtime: lambda.Runtime.JAVA_17,
        });

        const queue = new sqs.Queue(this, 'Queue', {
            visibilityTimeout: cdk.Duration.minutes(2),
        });

        func.addEventSource(new lambda_events.SqsEventSource(queue));
    }
}

const app = new cdk.App();
new LambdaStack(app, 'LambdaStack');
```

The first interesting thing about this CDK code is that it's much shorter than its equivalent CloudFormation template --
around 20 lines of TypeScript, compared to around 60 lines of YAML, so roughly a 3 to 1 ratio.
And this is for a very simple example;
as your infrastructure grows more complex,
this ratio becomes bigger and bigger --
I've seen ratios as high as 30 to 1 in some cases.

And second, the CDK code is much higher-level than the CloudFormation template.
Notice that the details of how to trigger the function from the queue are elegantly encapsulated by the combination of the
`addEventSource()` method and the `SqsEventSource` class.
Both of those APIs are type safe - you can't pass an SNS topic to `SqsEventSource` by mistake,
as the compiler won't allow that.
Notice also that we didn't have to mention IAM anywhere in the code --
the CDK took care of all of those details for us,
so we don't have to know which exact 4 permissions are needed to allow a function to be triggered by a queue.

All of this is possible because of the abstractions that high-level programming languages allow us to build.
I can take a piece of repeated or complicated code, put it in a class or function,
and present my project with a clean, simple API that neatly encapsulates all the messy implementation details inside it,
just like the `SqsEventSource` class, created and maintained by the CDK team, does.
If this is something that other projects might benefit from,
I can take my abstraction, package it as a library in the programming language it's written in,
and distribute it through my language's package manager,
like [npmjs.com](https://www.npmjs.com) for JavaScript / TypeScript,
or [Maven Central](https://central.sonatype.com) for Java,
so that others can depend on it,
exactly like we distribute libraries for application code.
I can even add it to the catalog of available open-source CDK libraries at
[constructs.dev](https://constructs.dev),
so that it's easier to find.

## Fourth generation: Infrastructure from Code

**Examples**:
[Wing](https://www.winglang.io),
[Dark](https://darklang.com),
[Eventual](https://www.eventual.ai/cloud),
[Ampt](https://www.getampt.com),
[Klotho](https://klo.dev)

While the third-generation Infrastructure as Code tools were a huge leap in making the Cloud more accessible
(I might be biased here, as a former member of the CDK team at AWS,
but I don't think that statement is far from the truth),
they still left some room for improvement.

Their first disadvantage is that they operate, for the most part,
on the level of the individual Cloud services.
So, while they make it easy to use Lambda or SQS,
you still have to know what these services are,
and why you would consider using them.

In this modern era of the Cloud,
we've seen an explosion in the number of services offered by each vendor.
AWS alone has more than 200 of them.
With such a huge variety available,
choosing the right one for your requirements becomes harder and harder.
Should I run my container on AWS Lambda, AWS EKS, or AWS AppRunner?
Should I use Google Cloud Functions, or Google Cloud Run?
What circumstances make one a better fit vs the other?

Many developers don't have such detailed knowledge of the offerings of each Cloud vendor,
especially since these tend to change often,
as new services (or new features of existing services) are introduced, and old ones deprecated.
But what they do have is a good grasp of the fundamentals of system design.
So, they know they need a stateless HTTP service horizontally scaled behind a load balancer,
a NoSQL document store, a caching layer, a static website frontend, etc.
The tools from the third generation would be too low-level for them; 
ideally, they would like to describe their infrastructure in these high-level system architecture terms,
and then delegate the details of how to best realize that architecture on a given Cloud provider to their IaC tool.

And the second disadvantage of the third-generation tools is that they completely separate infrastructure code from the application code.
For instance, in the CDK example above,
the code of the Lambda function is completely disconnected from its infrastructure definition.
And while CDK has the concept of
[Assets](https://docs.aws.amazon.com/cdk/v2/guide/assets.html)
that allow the two types of code to live in the same version control repository,
they still cannot interface with each other.
In a sense, this is duplication --
the fact that my application code uses an SQS queue places an implicit requirement on my infrastructure code to correctly provision that queue.
But like with all duplication and implicit requirements,
this can cause issues when the two sides get accidentally out of sync
(for example, if I delete the queue from my infrastructure code,
but forget to update my application code to no longer use it),
and there's no help from the compiler of my language in catching these mistakes before I deploy my changes,
and potentially cause an issue.

The fourth generation of IaC tools aims to fix both of these problems.
Their main premise is that in this era of the modern Cloud,
the distinction between infrastructure and application code doesn't make much sense anymore.
Since both sides talk in the language of managed services,
any resource that I want to use in my application code needs to be present in my infrastructure code,
like we saw with the Lambda and SQS example.

So, these tools unify the two.
Instead of separate infrastructure and application code,
they eliminate the former, leaving only application code,
and the infrastructure is completely derived from the application code.
For that reason, this approach is called Infrastructure **from** Code,
as opposed to **as** Code
(it's also known by the name
[Framework-defined Infrastructure](https://vercel.com/blog/framework-defined-infrastructure)).

Let's look at two examples of IfC tools.

### Eventual

The first is [Eventual](https://docs.eventual.ai),
a TypeScript library which defines several generic building blocks of modern Cloud applications:
Services, APIs, Workflows, Tasks, Events, and a few others.
You can create an arbitrarily complex application from these generic building blocks by composing them together,
just like Lego bricks.
The Eventual deployment engine knows how to translate these building blocks into AWS resources,
such as Lambda functions,
[API gateways](https://aws.amazon.com/api-gateway),
[StepFunction state machines](https://aws.amazon.com/step-functions),
[EventBridge rules](https://aws.amazon.com/eventbridge), etc.
The details of how that translation happens are hidden by the library abstractions,
and so, as a user of it, you don't have to worry about those details --
you just use the provided building blocks,
and the deployment is handled for you by the library.

Here's a simple example showing an Event, Subscription, Task, Workflow and API:

```ts
import { event, subscription, task, workflow, command } from "@eventual/core";

// define an Event
export interface HelloEvent {
    message: string;
}
export const helloEvent = event<HelloEvent>("HelloEvent");

// get notified each time the event is emitted
export const onHelloEvent = subscription("onHelloEvent", {
    events: [helloEvent],
}, async (event) => {
    console.log("received event:", event);
});

// a Task that formats the received message
export const helloTask = task("helloTask", async (name: string) => {
    return `hello ${name}`;
});

// an example Workflow that uses the above Task
export const helloWorkflow = workflow("helloWorkflow", async (name: string) => {
    // call the Task to format the message
    const message = await helloTask(name);

    // emit an Event, passing it some data
    await helloEvent.emit({
        message,
    });

    return message;
});

// create a REST API for POST /hello <name>
export const hello = command("hello", async (name: string) => {
    // trigger the above Workflow
    const { executionId } = await helloWorkflow.startExecution({
        input: name,
    });

    return { executionId };
});
```

### Wing

A different approach is to create a completely new general-purpose programming language:
one that is designed to execute not on a single machine,
like all other languages that were created before the Cloud came along,
but one built from the ground up to run distributed over many machines,
in a manner that is native to the Cloud.
[Wing](https://docs.winglang.io),
the language created by the company [Monada](https://www.linkedin.com/company/monadahq),
co-founded by the creator of the AWS CDK,
[Elad Ben-Israel](https://twitter.com/emeshbi), is one such language.

It manages to merge infrastructure and application code by introducing the concept of execution phases.
Preflight, the default phase, corresponds roughly to "build time",
and is when your infrastructure code executes;
inflight corresponds to "run time",
when your application code runs,
and is meant to execute in the Cloud.
The inflight code can use objects defined in preflight code,
through a sophisticated reference mechanism implemented by the Wing compiler.
However, the inflight phase cannot create new preflight objects,
and can only use specific APIs of these objects that are explicitly marked with the `inflight` modifier.
The Wing compiler makes sure your program abides by these rules,
so if you try to break them, it will fail compilation,
giving you rapid feedback about the correctness of your application.

So, the same example of a serverless function triggered by a queue that we saw above would look something like the following in Wing:

```ts
bring cloud;

let queue = new cloud.Queue(timeout: 2m);
let bucket = new cloud.Bucket();

queue.addConsumer(inflight (item: str): str => {
    // get an item from the bucket with the name equal to the message
    let object = bucket.get(item);
    // do something with 'object'...
});
```

This code is quite high-level --
we don't even mention a serverless function resource explicitly anywhere,
we just write our application code inside an anonymous function,
annotated with the `inflight` modifier.
That anonymous function gets deployed inside a serverless function,
and executes in the Cloud
(or in a local simulator that ships with Wing,
to provide a fast development experience).

Notice also that we can't use the wrong resource by mistake in our application code --
for example, an SNS topic instead of a SQS queue,
as there is no `Topic` object defined in the preflight code,
so there's no way for us to reference one in inflight code.
Similarly, you can't use the `bucket.get()`
method in preflight code,
as that is an inflight-only API.
This way, the language itself prevents us from making many mistakes that would go undetected if the infrastructure and application code were separate.

If you want to learn more about this new trend of Infrastructure from Code,
I would recommend [this article](https://klo.dev/state-of-infrastructure-from-code-2023)
from [Ala Shiban](https://twitter.com/alashiban), the co-founder of [Klotho](https://klo.dev),
another tool in this space.

## Summary

So, that's the history and latest developments in the Infrastructure as Code domain.
I think it's worth paying close attention to,
as it's one of the hottest areas in software engineering today,
even incorporating the recent advancements in AI into some of the products,
like [EventualAI](https://www.eventual.ai),
and [Pulumi Insights](https://www.pulumi.com/docs/intro/insights).

I think many new approaches will come out of this area in the near future that will have a profound effect on how we write and ship software.

If you want to read more about this topic,
[this article](https://yehudacohen.substack.com/p/exploring-the-emerging-cloud-development)
by [Yehuda Cohen](https://twitter.com/funwiththecloud)
is a very long and detailed exploration of the Infrastructure as Code landscape as it pertains to the Cloud.
