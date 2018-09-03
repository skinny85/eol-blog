---
id: 20
layout: article.html
title: Unit, acceptance or functional? Demystifying the test types - Part 1
summary: "In another four-part article series, I want to tackle the topic of
	various test types - clearly define their different kinds, and show some
	concrete examples of tests on various levels of abstraction. If you've
	ever wondered what does it mean to write a non-functional integration
	test, or what exactly is the 'unit' in 'unit tests', these are the
	articles for you. In Part 1, we talk about what exactly are acceptance
	and functional tests."
created_at: 2016-07-21
---

This is Part 1 of a 4-part article series about the different types of tests.

<ul class="parts-list">
	<li>[Part 2 - unit tests](/unit-acceptance-or-functional-demystifying-the-test-types-part2)</li>
	<li>[Part 3 - integration tests](/unit-acceptance-or-functional-demystifying-the-test-types-part3)</li>
	<li>[Part 4 - end-to-end tests](/unit-acceptance-or-functional-demystifying-the-test-types-part4)</li>
</ul>

<hr class="parts-separator">

There is a huge amount of vocabulary surrounding automated tests. Unit tests, integration tests, system tests, acceptance tests, functional tests, UI tests... It's easy to get lost in all of the jargon, and miss the forest for the trees. However, I don't think the topic is that complicated - once you understand the underlying principles, it's fairly easy to remember which is which.

The problem, as I see it, is that when people think about the different types of tests, they only take into account one way of classifying them: how much of the application is being tested (so the unit-integration-system tests spectrum). However, the fact is that there are other ways in which tests differ, completely orthogonal to that scale - and this is where the other test types come from.

## Acceptance

Let's start with acceptance tests, because I think they're the most misunderstood group. **Acceptance tests** are simply those tests that are essential to the proper functioning of your software. The idea is that you would never purposefully release a new version of the application if it didn't pass all of the acceptance tests.

The key thing to understand here is that these tests don't have to be automated - and in fact, in a lot of bigger, less IT-savvy industries (the public sector is usually the prime example), they often aren't. Nonetheless, they are aceptance tests all the same.

Now, when it comes to automated testing, acceptance tests usually bring to mind end-to-end tests with browser automation like Selenium. And while that is often the case, it's important to remember it's not part of the definition. For example, there might be automated non-functional (we discuss these in more detail below) tests that are part of the acceptance suite, and these would most likely not be ran through a browser; and if you're not building a web application, but a library for other programmers to use, it might very well be that your unit tests are in fact your acceptance tests - there are no "end-to-end" tests you can write in this case.

So, if those are acceptance tests, what are non-acceptance tests? From the definition, those are all of the tests that are not essential to pass in order for the software to meet it's intended purpose. For example, shrink-wrap software like operating systems back in the day (think Windows 95) shipped with hundreds or even thousands of known bugs - however, since they weren't show-stopper defects, they were prioritized lower than the critical ones, and there was not enough time to fix them before the release deadline.

This kind of classification of issues - into "blocker" and "non-blocker" ones - is fairly common when doing manual tests. Now, when it comes to automation, obviously test writing and maintenance have real costs - so you don't really want to spend much resources on tests that you are OK with to fail. Also, you want your test suite to give you a definite answer - "Can we release this or not?" - and not require human intervention after every run to look at the results and decide whether these failures are acceptable or not. That is also the reason that unit and integration tests are almost always considered part of the acceptance test suite - while a failing unit test does not necessarily mean a user-facing problem, it's just simpler to treat it as such, and block the release until the test is either fixed or deleted.

Another popular Agile practice that can be considered non-acceptance testing is exploratory testing. It's usually focused on gaining insights into the workings of the system, to asses things like usability and accessibility - not just to judge the correctness of the software with a simple, binary "passes-fails" answer.

## Functional

I mentioned these in the above description already. **Functional tests** are all the tests that concern themselves with whether the application does what it's supposed to do correctly. In other words, they verify that the functionality the software is providing is working as intended. For example, if your application is an e-commerce website, a functional test might be one that signs in as a user, purchases something on the site, and then verifies that the payment went through, and that the item was scheduled for shipping to the given address.

You might be scratching your head at this point. "Aren't those end-to-end tests?". If the application being tested is an e-commerce website, then yes, most likely functional tests would mean end-to-end tests. However, like I alluded to above already - a functional test for a library might actually mean a unit or integration test.

More importantly, there are other sort of requirements for an application, that are not directly tied to verifying functional correctness. Some examples of those **non-functional** criteria might be:

* performance (these come in various flavors - load tests, stress tests, throughput tests, scalability tests, and a lot more)
* resilience (if we turn off this server, will the application still work?)
* security (is this field immune to SQL injection?)
* portability (does it run the same on each platform we want to support?)

There are also many others.

It's also interesting to think about how orthogonal those concepts are to automation. While performance tests are almost always automated (as it's very difficult to apply a given load to a system using actual people), security tests usually aren't, because they cannot prove that the application is secure - only that it's authors could not break it. That's why security testing is often done by a third-party, who use a combination of automated and manual techniques to try and breach the application.

## Unit-to-system tests

So, we've covered acceptance and functional tests. The remaining axis is the most well-known, the one I mentioned in the beginning of the article - the unit-to-system tests spectrum, the one that is concerned with how much of the application code is being exercised in each test.

Now, there are multiple theories on how many layers are actually in this hierarchy. Often people add acceptance and/or functional tests to it. We, however, know already that these are completely orthogonal classifications, and will not commit that mistake.

My thesis is the following: there are only three types of tests in this hierarchy. These are: unit, integration and end-to-end (which are synonymous with system) tests. We will explore each group in more detail in the subsequent articles in the series.

<hr class="parts-separator">

This is Part 1 of a 4-part article series about the different types of tests.

<ul class="parts-list">
	<li>[Part 2 - unit tests](/unit-acceptance-or-functional-demystifying-the-test-types-part2)</li>
	<li>[Part 3 - integration tests](/unit-acceptance-or-functional-demystifying-the-test-types-part3)</li>
	<li>[Part 4 - end-to-end tests](/unit-acceptance-or-functional-demystifying-the-test-types-part4)</li>
</ul>
