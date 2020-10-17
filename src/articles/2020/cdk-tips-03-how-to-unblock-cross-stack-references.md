---
id: 51
layout: cdk-tips.html
title: CDK tips, part 3 – how to unblock cross-stack references
summary: |
  In part 3 of the "CDK tips" series,
  I want to talk about dealing with a common problem:
  getting stuck while trying to remove a reference between two CloudFormation Stacks,
  which results in the dreaded
  "Export cannot be deleted as it is in use by another Stack"
  error message.
created_at: 2020-10-10
---

One of the more powerful capabilities the CDK offers are automatic cross-stack references.
It's built on a CloudFormation feature where you can designate a given
[Output](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/outputs-section-structure.html)
(that can refer to a late-bound value,
like a name that will be generated only at deploy time)
to be exported from one Stack,
and then reference it in a different Stack using the
[`Fn::ImportValue` intrinsic](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-importvalue.html).
Of course, this implies that the Stack with the export has to be deployed before the Stack that reads it.

The CDK makes using this feature considerably easier than in pure CloudFormation.
All you have to do is pass an object from one Stack to another, and reference it there.
The CDK will generate a name for the export
(as they have to be unique in a given AWS account-region combination)
in the producing Stack,
and then use that same name in the consuming Stack in the `Fn::ImportValue` expression.
It will also add a dependency between the producing and consuming Stacks,
to ensure they are deployed in the correct order.

Here's a simple example:

**Note**: all of the code in this article is in TypeScript,
but the concepts I'm talking about are the same in every language CDK supports.

```ts
import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as s3 from '@aws-cdk/aws-s3';

class ProducingStack extends cdk.Stack {
	public readonly bucket: s3.IBucket;

	constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
		super(scope, id, props);

		this.bucket = new s3.Bucket(this, 'Bucket');
	}
}

interface ConsumingStackProps extends cdk.StackProps {
	readonly bucket: s3.IBucket;
}

class ConsumingStack extends cdk.Stack {
	constructor(scope: cdk.Construct, id: string, props: ConsumingStackProps) {
		super(scope, id, props);

		const func = new lambda.Function(this, 'Function', {
			// details not really important...
		});

		// this is what causes the cross-stack reference to be created!
		props.bucket.grantReadWrite(func);
	}
}

const app = new cdk.App();
const producingStack = new ProducingStack(app, 'ProducingStack');
const consumingStack = new ConsumingStack(app, 'ConsumingStack', {
	bucket: producingStack.bucket,
});
```

## Removing a reference

Normally, this all happens transparently behind the scenes,
and you don't have to worry about the details of how it's implemented that I explained above.
However, there is a specific case where this abstraction breaks down,
and that is when you actually want to remove the cross-stack reference from Stacks that are already deployed.

If you remove the code that causes the reference to be created from the consuming Stack
(in the above example, that would be the `props.bucket.grantReadWrite(func);` line),
and assuming those Stacks were both previously deployed,
you might find that executing `cdk deploy '*'` now fails.
That happens when the producing Stack is selected to be deployed first --
either because there's a different reference between the two Stacks than the one that was just removed,
or just because the producing Stack is picked to be deployed first arbitrarily.
No matter the reason, the effect is the same --
the producing Stack fails to deploy with the error
"Export cannot be deleted as it is in use by another Stack".
What makes that error even more surprising is the fact that the code of the producing Stack was never modified!

The problem here is that CloudFormation has validations that prevent an export referenced in another Stack from being removed.
And while the code of the producing Stack did not change,
its resulting template actually did.
You see, when the code that referenced the resource in the consuming Stack was removed,
the CDK machinery stopped generating the Output that exported that reference from the producing Stack,
as there was no reason for having it anymore.
During `cdk deploy '*'`,
CloudFormation noticed that the template of the producing Stack no longer contained that Output,
and so attempted to delete it --
but that export is actually still referenced in the deployed consuming Stack,
which was not yet updated with the latest generated template!
Hence it triggers the above validation,
and the entire operation fails.

<img src="/img/cross-stack-cdk-reference-update.png" width="50%">

This "deadlock" might initially seem impossible to get out of.
But there is a way to break it.

The key to resolving it is to split the update into two steps.
In the first one, you remove the reference from the consuming Stack,
while keeping the exports in the producing Stack.
Once the updated template without the references is deployed in the consuming Stack,
the exports are not referenced anymore,
and can be safely deleted from the producing Stack in step two.

The tricky part is step one,
because removing the reference in the consuming Stack will also stop the CDK machinery from generating the exports in the producing Stack.
For that reason, you have to create the exports manually yourself in the producing Stack.
Since the exports don't serve any purpose other than making the deployment succeed,
I call this pattern "dummy exports".

You create exports by using the `CfnOutput` class with the `exportName` property filled.
Both the `exportName`,
and the logical ID of the Output itself need to be exactly the same as the names the CDK generated for them.
You can use the `overrideLogicalId()` method of `CfnOutput` to make sure it has the correct name.

The simplest way to find out what those names should be is to just use any name at first,
and then run `cdk diff` --
you can then copy the auto-generated names you see in the output of that command to your code.
Keep running `cdk diff` until it shows no edits or deletions in the producing Stack -- only additions
(the consuming Stack will have edits -- don't worry about those).

For instance, here's how we would create the "dummy exports"
for the above example code:

```ts
import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as s3 from '@aws-cdk/aws-s3';

class ProducingStack extends cdk.Stack {
	public readonly bucket: s3.IBucket;

	constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
		super(scope, id, props);

		this.bucket = new s3.Bucket(this, 'Bucket');

		// create the "dummy export"
		const bucketArnOutput = new cdk.CfnOutput(this, 'BucketArnOutput', {
			value: this.bucket.bucketArn,
			exportName: 'ProducingStack:ExportsOutputFnGetAttBucket83908E77Arn063C8555',
		});
		// rename the Output to have the same as the auto-generated CDK one
		bucketArnOutput.overrideLogicalId('ExportsOutputFnGetAttBucket83908E77Arn063C8555');
	}
}

interface ConsumingStackProps extends cdk.StackProps {
	readonly bucket: s3.IBucket;
}

class ConsumingStack extends cdk.Stack {
	constructor(scope: cdk.Construct, id: string, props: ConsumingStackProps) {
		super(scope, id, props);

		const func = new lambda.Function(this, 'Function', {
			// details not really important...
		});

		// we remove the reference to the Bucket coming from the producing Stack
		// props.bucket.grantReadWrite(func);
	}
}

const app = new cdk.App();
const producingStack = new ProducingStack(app, 'ProducingStack');
const consumingStack = new ConsumingStack(app, 'ConsumingStack', {
	bucket: producingStack.bucket,
});
```

If you previously deployed the two Stacks,
running `cdk diff` with the above code should show no differences in the producing Stack,
and differences in the consuming Stack related to the fact that we removed from it the reference to the shared S3 Bucket.

Now, running `cdk deploy '*'` should succeed,
and update the deployed consuming Stack so that it no longer contains the `Fn::ImportValue`
intrinsic referring to the exports from the producing Stack.

After that deployment of the consuming Stack completes,
the "dummy exports" are no longer needed;
and so, you can safely remove them from the producing Stack's code
(along with the resource that was previously shared if you no longer need it,
like the S3 Bucket in our example).
Applying that change with `cdk deploy '*'` should succeed,
and finally remove those exports from the producing Stack.

And that's the entire process of removing a cross-stack reference between two deployed CDK Stacks!

## Code walkthrough

To make all of this more concrete,
I've prepared a simple CDK example project demonstrating this process.
It walks you through creating the first reference,
trying to replace it (and failing),
and then successfully splitting the replacement into two steps:
removing the references first
(with the aid of the "dummy exports" pattern),
and then removing the exports themselves.

[Check it out on GitHub](https://github.com/skinny85/cdk-reference-unblocking).

Special thanks to Rico Huijbers for his invaluable help with co-authoring this article.
