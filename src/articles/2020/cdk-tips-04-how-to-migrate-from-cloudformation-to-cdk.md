---
id: 53
layout: cdk-tips.html
title: CDK tips, part 4 – how to migrate from CloudFormation to CDK
summary: |
  In part 4 of the "CDK tips" series,
  we show how to migrate an already existing CloudFormation Stack to be managed by the Cloud Development Kit.
created_at: 2020-12-01
---

The CDK allows you to express your infrastructure using high-level,
object-oriented code in familiar programming languages like JavaScript/TypeScript, Python and Java.
When that code gets executed,
it produces one or more [CloudFormation templates](https://aws.amazon.com/cloudformation/resources/templates) as a result.
When invoking a command like `cdk deploy`,
it's the CloudFormation service that performs the actual provisioning of the AWS resources defined by the CDK code.

Given that, a natural question a lot of CDK users ask is how to go in the opposite direction:
migrate an existing CloudFormation Stack to be managed through the CDK.
Many AWS customers have significant investment in CloudFormation already,
and they don't want to start from scratch when moving to
(or just trying out) the CDK.

The CDK has a dedicated module to help with this migration,
called [CloudFormation-Include](https://docs.aws.amazon.com/cdk/api/latest/docs/cloudformation-include-readme.html).
There is an article on the AWS blog that shows how to use it:
https://aws.amazon.com/blogs/developer/migrating-cloudformation-templates-to-the-aws-cloud-development-kit.

I also recently gave a talk at a
[Berlin AWS User Group meetup](https://www.meetup.com/berlinawsug/events/266783692),
during which I showed a live demo of moving a CloudFormation Stack deployed through the Serverless Application Repository to the CDK.
Unfortunately, that presentation was not recorded.
I liked how the demo went so much, however,
that I decided to make a video going through it again:

<iframe width="560" height="315" frameborder="0"
  src="https://www.youtube.com/embed/bTC8XV5aLTo"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  style="margin: auto; display: block; max-width: 100%;" allowfullscreen></iframe>

I hope it's helpful in demonstrating how to migrate a real-life,
running application from CloudFormation to CDK,
without any downtime, or incurring additional charges for new resources.

Let me know what you think of the video!
