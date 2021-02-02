---
id: 55
layout: cdk-tips.html
title: CDK tips, part 5 – have a Stack instance per deployed stack
summary: |
  In part 5 of the "CDK tips" series,
  we talk about one of the most fundamental rules of using the CDK effectively,
  which is an especially huge mindset shift if you have previously worked with CloudFormation.
  That rule is: in your CDK code,
  you should always have a separate instance of the Stack class for each stack that is actually deployed to an AWS account.
created_at: 2021-02-10
---

The Cloud Development Kit uses [AWS CloudFormation](https://aws.amazon.com/cloudformation)
as its provisioning engine.
Because of this, many users arrive at the CDK by way of CloudFormation.
When you move from one tool in a domain
(in this case, Infrastructure as Code)
to another,
it's natural to want to take the domain-specific patterns you used in the previous tool with you to the new one.
However, doing that actually proves to be quite problematic in the case of CDK and CloudFormation,
as indiscriminately applying the patterns from CloudFormation to the CDK results in a sub-optimal experience.

To explain what I mean,
let's first look at the idiomatic way of working with CloudFormation.

## Hand-crafted single template file

In CloudFormation, your template is a single file that serves as the source of truth about your project's infrastructure.

The "single file" part is more of a necessity than a choice.
There's no reliable way to compose a CloudFormation template from multiple parts.
We have the [`AWS::Include` transform](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/create-reusable-transform-function-snippets-and-add-to-your-template-with-aws-include-transform.html),
but the issue with it is that it expects a template file in the Cloud,
in some S3 Bucket,
while what we want is composition of files locally on disk,
exactly like you compose programming language files when writing code.
Additionally, even with `AWS::Include`,
CloudFormation templates simply don't compose well,
because of the requirement that the logical IDs of the elements in the template have to be unique.

For these reasons, the template is at the center of the universe when using CloudFormation, and a project
(unless it's using some tools beyond just pure CloudFormation)
always has a single template file for each stack it consists of.

Of course, it's very rare for software to live only in production.
Typically, a project consists of [multiple environments](/software-project-environments).
This presents a bit of an issue, as you obviously need your testing environments to be different from your production environments --
but your project only has the one CloudFormation template!

For instance, let's say you're using [DynamoDB](https://aws.amazon.com/dynamodb)
as the backing datastore for your service.
Since in production, your service has pretty high traffic,
the provisioned capacity for your Table must also be appropriately big --
let's say, 50, for both reading and writing.
However, in the test environment, your service barely gets any requests --
the only traffic to it is just members of the team trying things out,
and maybe automated tests.
In this case, you don't want your Table in the testing environment to also be provisioned with 50 capacity units --
that would be wasteful.

So, how do you reconcile the need for having different provisioned capacities in different environments,
with the fact there is only one CloudFormation template for your stack?
The solution in the CloudFormation world are [Parameters](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/parameters-section-structure.html),
which can be used to change the behavior of the template at deploy time.
You declare them in their own section:

```yaml
Parameters:
  Prod:
    Type: String
    Description: Whether this environment is the production environment
    Default: false
```

They can be referenced from a [Condition](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/conditions-section-structure.html)
using the [`Ref` function](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-ref.html):

```yaml
Conditions:
  IsProd: !Equals [!Ref Prod, "true"]
```

And a Condition can be used in the [`Fn::If` function](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-conditions.html#intrinsic-function-reference-conditions-if):

```yaml
Resources:
  Table:
    Type: AWS::DynamoDB::Table
    Properties:
      ProvisionedThroughput:
        ReadCapacityUnits:  !If [IsProd, 50, 2]
        WriteCapacityUnits: !If [IsProd, 50, 2]
```

This template can be deployed to the testing environments without any additional configuration,
because we made the `Prod` Parameter `"false"` by default.
But in production, you have to make sure to pass the `Prod` Parameter as `"true"` when deploying,
which makes the `IsProd` Condition true,
which makes the above `Fn::If` expression return `50`.

So, this is the idiomatic way of using CloudFormation:

1. There is a single template file.
2. All differences between the various environments the project uses are encoded inside that one template.
3. The template's behavior is changed at deployment time by passing different values for its Parameters in the different environments.

## Generated single template file

Many customers who come to CDK from CloudFormation have the above model of the world in their heads,
and when they start using CDK,
they immediately want to recreate this familiar pattern.

So, their CDK code looks something like this:

```ts
import { App, CfnCondition, CfnParameter, Fn, Stack, Token } from '@aws-cdk/core';
import * as dynamodb from '@aws-cdk/aws-dynamodb';

const app = new App();

const stack = new Stack(app, 'MyStack');
const prod = new CfnParameter(stack, 'Prod', {
    description: 'Whether this environment is the production environment',
    default: 'false',
});
const isProd = new CfnCondition(stack, 'IsProd', {
    expression: Fn.conditionEquals(prod.value, 'true'),
});

const capacityUnits = Token.asNumber(Fn.conditionIf(isProd.logicalId, 50, 2));
new dynamodb.Table(stack, 'Table', {
    partitionKey: {
        name: 'Id',
        type: dynamodb.AttributeType.STRING,
    },
    readCapacity: capacityUnits,
    writeCapacity: capacityUnits,
});
// potentially many other resources...
```

This is pretty much a direct translation of the above CloudFormation template into CDK code.

To deploy this application to the different environments,
we need to do the same thing we did when using CloudFormation:
pass different values for the Parameters at deploy time.
Let's say the application is deployed to the AWS account `123` in the testing environment,
but account `456` in the production environment.
Let's also assume you have two [profiles](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html)
set up locally with credentials for the two accounts,
called `acc123` and `acc456`, respectively.

To deploy to the testing environment, you would invoke:

```shell
$ cdk deploy --profile acc123
```

And to production, it would be:

```shell
$ cdk deploy --profile acc456 --parameters MyStack:Prod=true
```

While this approach is already an improvement over pure CloudFormation --
notice that we can use an [L2 construct](https://docs.aws.amazon.com/cdk/latest/guide/constructs.html#constructs_lib)
for the DynamoDB Table,
which is higher-level than the corresponding CloudFormation resource,
and we can use a local variable to get rid of the duplication between setting the read and write capacity units that was present in the YAML template --
it's important to note that **this is not the idiomatic way to use CDK**.

The reason why is because the CDK completely flips the above CloudFormation model of the world on its head.

With CDK, the template is no longer hand-built;
it's now a generated artifact that's the result of executing your CDK application,
similarly to how binary executables are the build artifacts of compiling programming language code.
The source of truth is now the CDK code,
and the CloudFormation template becomes a mere implementation detail,
that you only have to look at when debugging issues with it --
exactly like you don't inspect the binaries output by your compiler unless there's a problem with them.

The fact that the template is now generated,
instead of being written manually,
removes the CloudFormation limitation that there can only be a single template file in the project,
and this in turn changes how we handle differences between the various environments of the project in the CDK.

## Generated multiple template files

So, if that is not the idiomatic way to write CDK code,
then what is?
That's simple: in the CDK,
you should have a different instance of the `Stack` class for each stack actually deployed to your AWS account.

So, continuing the above example,
instead of the CDK application having a single `Stack` object,
which is deployed with different commands,
the idiomatic way is to have multiple `Stack` objects,
one per deployed stack.
In our example, that would be two:
one in the test environment, and one in production.

To prevent any code duplication,
we will introduce our own stack class that extends the CDK's `Stack`.
The code looks something like this:

```ts
import { App, Construct, Stack, StackProps } from '@aws-cdk/core';
import * as dynamodb from '@aws-cdk/aws-dynamodb';

interface MyStackProps extends StackProps {
    readonly isProd?: boolean;
}

class MyStack extends Stack {
    constructor(scope: Construct, id: string, props?: MyStackProps) {
        super(scope, id, props);

        const capacityUnits = props?.isProd ? 50 : 2;
        new dynamodb.Table(this, 'Table', {
            partitionKey: {
                name: 'Id',
                type: dynamodb.AttributeType.STRING,
            },
            readCapacity: capacityUnits,
            writeCapacity: capacityUnits,
        });
        // potentially many other resources...
    }
}

const app = new App();

// test stack
new MyStack(app, 'MyTestStack', {
    // stackName (here and below) is optional,
    // we added it just to show it's possible to keep
    // the stack names the same as in the previous example
    stackName: 'MyStack',
    env: { account: '123', region: 'my-region' },
});

// prod stack
new MyStack(app, 'MyProdStack', {
    stackName: 'MyStack',
    env: { account: '456', region: 'my-region' },
    isProd: true,
});
```

As you can see, we translated the concepts from CloudFormation into their programming language
(in this case, TypeScript) equivalents.
What was previously a CloudFormation Parameter is now a property of our `MyStack` class,
passed through the `MyStackProps` interface
(which extends the common CDK Stack properties).
Based on the value of that `isProd` property,
which is `false` by default
(similarly to the Parameter),
we set the read and write capacity to either 2, or 50.
But notice that we simply use the features of our programming language to do that,
like `if` statements, or ternary operators --
we no longer need to rely on CloudFormation Conditions,
or the `Fn::If` function.

Notice also that we specified what account and region each of our stacks lives in.

The result of executing `cdk synth` on this code will be generating two similar,
yet separate CloudFormation template files --
you can find them in the `cdk.out` directory in the root of your project.

Now, because we moved all of the conditions and branching logic from the CloudFormation template and into our programming language
(in other words, we switched from deploy-time to build-time conditions),
deploying the stacks does not require passing any additional configuration beyond the correct AWS credentials:

```shell
# test stack
$ cdk deploy --profile acc123 MyTestStack
# production stack
$ cdk deploy --profile acc456 MyProdStack
```

Now, what are the advantages of this approach?
Why do we say this way is idiomatic in the CDK?

1. The accounts and regions of your environments are maintained in source control,
 achieving true Infrastructure as Code.
 Previously, the fact that the testing stack was in account `123`,
 but the production stack in `456`,
 was not actually noted in your source code,
 which meant it was stored in some other place.
 With this approach, everything about your application is mastered in its CDK code.
2. It's less error prone.
  In the previous approach,
  if you forgot to pass the `Prod` Parameter when deploying the production stack,
  and just executed `cdk deploy --profile acc456`,
  you would change the provisioned capacity of your production DynamoDB Table to 2,
  and most likely cause a production outage.
  You can't make that mistake with the latter approach.
3. This approach is aligned with how many CDK features work.
  For example, the [`fromLookup()` methods](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-ec2.Vpc.html#static-fromwbrlookupscope-id-options)
  require you to provide the account and region your stack is in;
  the [CDK Pipelines module](https://docs.aws.amazon.com/cdk/api/latest/docs/pipelines-readme.html)
  needs a separate instance of a `Stack` object for each stack actually deployed in the pipeline, etc.
4. Because we switched to build-time conditions,
  it's much easier to unit test your infrastructure.
  For example, you could write a unit test that confirms your production stack has read and write capacity always set to 50.

## Developer stacks

Does this mean you should never use Stacks without the `env` property set --
what the CDK calls ["environment-agnostic" stacks](https://docs.aws.amazon.com/cdk/latest/guide/environments.html)?
No!
There are many situations in which they are useful.
One is example apps --
CDK applications that are meant to demonstrate how to accomplish a specific goal using the CDK,
and not an actual application serving production traffic.
The [CDK examples GitHub repository](https://github.com/aws-samples/aws-cdk-examples),
for instance,
contains many of these sample apps.

Another are developer stacks --
stacks that are used by individual developers on the team to play around with the application,
and try out their changes in a safe environment before publishing them.
Their usage looks something like this:

```ts
interface MyStackProps extends StackProps {
    readonly isProd?: boolean;
}

class MyStack extends Stack {
    constructor(scope: Construct, id: string, props?: MyStackProps) {
        super(scope, id, props);

        // code identical as above...
    }
}

const app = new App();

// developer stack
new MyStack(app, 'MyDevStack', {
    stackName: 'MyStack',
});

// test stack
new MyStack(app, 'MyTestStack', {
    stackName: 'MyStack',
    env: { account: '123', region: 'my-region' },
});

// prod stack
new MyStack(app, 'MyProdStack', {
    stackName: 'MyStack',
    env: { account: '456', region: 'my-region' },
    isProd: true,
});
```

With this setup in place,
when a developer on the project needs to modify the application's infrastructure in some way,
they can make the changes to the `MyStack` class locally,
execute `cdk deploy MyDevStack`,
and use that local developer stack to validate their changes had the desired effect --
all while being sure they will not break any of the project's shared environments.

## Summary

While the CDK uses CloudFormation under the hood,
it changes some of the fundamental assumptions that drive many CloudFormation practices.
Because of that, some things that you might be used to from the CloudFormation world are best left behind when transitioning to the CDK.
I understand this shift might be a little disconcerting at first,
as is the case with any change.
But I think embracing the differences,
and using the CDK in an idiomatic way,
will make your experience with the tool much smoother.
