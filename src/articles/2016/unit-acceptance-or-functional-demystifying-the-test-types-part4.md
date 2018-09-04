---
id: 23
layout: article.html
title: Unit, acceptance or functional? Demystifying the test types - Part 4
summary: "In another four-part article series, I want to tackle the topic of
	various test types - clearly define their different kinds, and show some
	concrete examples of tests on various levels of abstraction. If you've
	ever wondered what does it mean to write a non-functional integration
	test, or what exactly is the 'unit' in 'unit tests', these are the
	articles for you. We close the series in this Part 4 with end-to-end
	tests."
created_at: 2016-11-30
---

This is Part 4 of a 4-part article series about the different types of tests.

<ul class="parts-list">
    <li>[Part 1 - acceptance and functional tests](/unit-acceptance-or-functional-demystifying-the-test-types-part1)</li>
    <li>[Part 2 - unit tests](/unit-acceptance-or-functional-demystifying-the-test-types-part2)</li>
    <li>[Part 3 - integration tests](/unit-acceptance-or-functional-demystifying-the-test-types-part3)</li>
</ul>

<hr class="parts-separator">

### End-to-end tests

**End-to-end tests** are the final frontier of automated testing - the highest-level tests that you can reasonably expect to write. Their purpose is to exercise as much of the target application as is feasible, in order to have the highest confidence in it working as intended.

#### What's in a name?

It's difficult to provide one, precise definition of what an end-to-end test is. End-to-end tests are known under several names, and I think it's interesting to analyze them, as each emphasizes a different characteristic of theirs:

##### End-to-end tests

**End-to-end** says that we will involve all of our external dependencies in the test - we don't want to mock any of them.

While we can have integration tests verifying we can correctly talk to Thing A, and other integration tests checking that for Thing B, there is still a risk that Thing A and Thing B will not work when used together. End-to-end tests are there to check that.

##### System tests

End-to-end tests are commonly referred to as **system tests** in literature. This emphasizes the fact that we will use our entire codebase during the test - again, we will not mock anything out.

The difference between this point and the previous one is that now we are referring to our own code, not 'the outside world', because we want to verify the code works correctly across our own module boundaries (for example, that the JavaScript frontend correctly communicates with the Java backend).

Integration tests also leave certain things untested - configuration being probably the prime example.

Finally, 'system tests' usually imply we will need to deploy the system, which also means we will be testing this essential part of the project.

##### UI tests

End-to-end tests are often times called **UI tests**. This name underlines the fact that we will be interacting with the application in the tests exactly like the users are - through its user interface (for example, the browser in the case of a Web application).

This is very important, as the UI layer (like the HTML templates that we use, or the windowing code in the case of desktop applications) is almost never exercised in any other tests - usually because the technologies those layers use are (at least traditionally) not built with testability in mind.

Even if we could call the UI layer in our unit tests, it would still not give us the full confidence in it working as expected. It's one thing to assert the resulting HTML has a specific structure, but another completely what is it that the browser renders to the user (if you're still not convinced, let me propose the following thought exercise: how many ways can you imagine of hiding an element on a web page using a combination of HTML, CSS and JavaScript?).

#### On the diagram and the pyramid

If we wanted to visualize end-to-end tests on the diagrams from the [integration tests article](/unit-acceptance-or-functional-demystifying-the-test-types-part3), they would look something like this:

<img src="img/tests-post-diag-ver4.png" style="width: 85%">

An end-to-end test isn't focused on validating a specific area of the code - instead it looks at your application more from a use case perspective, and will cut across all of the layers of your application and the external dependencies needed to exercise that use case. The e-commerce website test from [part 1](/unit-acceptance-or-functional-demystifying-the-test-types-part1) (sign in as a user, purchase something on the site, verify that the payment went through and that the item was scheduled for shipping) is a typical example - running that test involves interacting with a lot of code, including the UI, and most likely several external dependencies along the way.

The diagram also nicely illustrates the downsides of end-to-end tests, as alluded to in the [unit tests article](/unit-acceptance-or-functional-demystifying-the-test-types-part2). The line is very long, which means they are slow. It also crosses a lot of external entities that are outside of your direct control, which makes them fragile (in reality, because of the need to use tools that allow programmatic control of the user interface, they are even more fragile than the diagram suggests).

Of course, while the downsides are real, that doesn't mean the correct answer is to forego writing them altogether. End-to-end tests are critical to ensuring the correctness of your software, and you can't realistically achieve Continuous Delivery/Deployment (which should be the goal for most software projects, I assume) without them.

Also, end-to-end tests have one other great advantage over unit and integration tests. Because they are so high level, they are fantastic aids when doing refactoring. They usually depend on very little (if any) specific code in the application, and thus afford great freedom when changing it, without introducing false negatives (that is, tests that failed not because the refactoring introduced an error, but because the test itself needed changing after the refactoring).

#### The tools of end-to-end tests

Because end-to-end tests, as we established, need to programmatically control the user interface, they require a whole set of tools that are not needed for unit or integration testing. What is more, those tools are specific to the user interface technology the project is built with - there isn't (and cannot ever exist) a "universal" UI testing solution.

So, for example, if you're building an application using Java's Swing toolkit, you can use a library like [WindowLicker](http://wiki.c2.com/?WindowLicker). If you're doing Android development, you'll probably need [Espresso](https://google.github.io/android-testing-support-library/docs/espresso/). In the .NET ecosystem, there's Visual Studio Coded UI Test. Etc, etc.

If you're writing a web application, you'll almost assuredly use some implementation of the [WebDriver W3C standard](https://www.w3.org/TR/webdriver/) for controlling the browser. The most popular one is [Selenium](http://www.seleniumhq.org/), although it's rarely used directly - usually you write your tests in some specialized wrapper library, which add some additional functionality on top of the standard WebDriver capabilities. For example, if you're developing an [AngularJS](https://angularjs.org/) application, you'll most likely use [Protractor](http://www.protractortest.org/#/) for the end-to-end tests.

Now, if you're doing web development in the JVM ecosystem (and don't have a strong reason to use a different wrapper, like in the Angular example above), I strongly recommend one particular solution: the [Geb Groovy library](http://www.gebish.org/). It recently celebrated [its 1.0 release](https://twitter.com/GebFramework/status/785389405217427456), but don't let that fool you - it has been around for many years, and is a battle-tried and tested solution. I've used it at my [previous job](http://pragmatists.pl/), and also introduced it to my team at Amazon - both times, it has proven itself to be fantastic. I can't recommend it enough.

Whatever UI technology you are considering, make sure to research what does the end-to-end test story for that technology look like. I would even go so far as to say that a big difference in this aspect might be a legitimate reason for choosing one technology over the other.

#### To deploy or not to deploy?

End-to-end tests have an interesting tension built into them. On the one hand, you want them to be an aid to developers when they are doing development locally on their machines (possibly even doing test-first if using something like the extended TDD cycle from the ['GOOS' book](/recreating-the-code-from-the-goos-book-example-project)). Which means the tests should start the application locally before executing (otherwise, you are forcing developers to remember to do a deployment themselves each time they do a code change, which is not optimal). This implies you have a programmatic way of starting the application locally, which, depending on the technology you use, might be a project in and of itself (however, there are things that can help you there as well - [Docker](/optimizing-development-with-docker) might be one, for example).

On the other hand, you also want them to run in your Continuous Integration/Delivery/Deployment pipeline - which means they should execute against a given environment, not start a new one.

I think the way to handle this issue is to have some custom logic in your end-to-end tests. By default, they start the application locally, but there's a configuration switch (probably something like an environment variable) that turns this behavior off. The tests run in the CI/CD environment with that switch on.

Sadly, in my experience, this is usually not how things turn out. Because of how difficult starting the application programmatically is in a lot of technologies, what usually ends up happening is that the UI tests are independent of the application deployment, which means they are not really useful for local development.

When you are investing heavily in end-to-end tests, make sure you think about not only how they help you with Continuous Delivery, but also how will they be used by developers in their day-to-day work.

#### On black and white boxes

Another dimension of classifying tests that some people introduce is the blackbox vs. whitebox scale. 'Whitebox' in this sense means that we use some internal knowledge about the implementation that we posses as the authors of the application in the tests, which would be unavailable to regular users. 'Blackbox' is the opposite of that - we pretend we have no knowledge of how the application works, treating it like the proverbial 'black box', and test strictly from the outsider's perspective.

Now, because end-to-end tests execute through the application's UI, exactly the same way users interact with it, some people conclude that they have to be strictly 'blackbox', and can only perform actions that a real user could perform. This is a mistake.

It leads to absurd workarounds, like every UI test beginning with clicking through to the shopping cart to remove all items left there by the previous test, or every new user registered in the test needing to be approved by separately logging in as the administrator. The result of blindly following this philosophy is a slow, brittle test suite.

The fact that end-to-end tests work through the UI does not make them special in any way. They should be treated exactly like the other tests, and designed with the same principles of quality code (modularity, abstraction, [DRY](https://en.wikipedia.org/wiki/Don't_repeat_yourself) etc.) as them. That includes thinking about how to set up the needed preconditions in the test, and how to clean them up afterwards.

Very often, the best way to achieve that is using the same business logic modules that are used in production code. Sometimes, it might mean writing specialized ones used exclusively in tests - it's not optimal, but still miles better than needlessly clicking around dozens of times before and/or after each test. It's often also the only way to formulate sensible assertions about the system state after performing some action through the UI.

As an example, here's a test from a [workshop I gave about Geb](/lessons-from-leading-a-conference-workshop-warsjawa-2014):

```
@ContextConfiguration(locations = ["classpath:spring/business-config.xml"])
@RunWith(SpringJUnit4ClassRunner.class)
@ActiveProfiles("jdbc")
class Test_05_PetClinic_Add_Owner extends GebTest {
    @Autowired
    ClinicService clinicService

    @Test
    void add_another_davis_owner() {
        int davises = searchForDavises()

        to NewOwnerPage

        saveOwner(lastName: 'Davis')

        at ShowOwnerPage
        Assert.assertEquals(davises + 1, searchForDavises())
    }

    private int searchForDavises() {
        clinicService.findOwnerByLastName('Davis').size()
    }
}
```

This test adds a new Owner (this was a test for the famous PetClinic example application) using the browser, like a normal user would. However, the assertion uses the internal application business logic to check that the action performed through the UI had the expected result. This makes the test considerably faster and less brittle compared to if we stubbornly wanted to assert that fact using the UI. It also avoids coupling the test for the new Owner form with other views, which makes the entire suite more stable.

### Closing remarks

This article concludes the 4-chapter test epic. I hope you found at least one new or useful thing somewhere in the series. If there's anything you feel I left out, or something that you disagree with me strongly, I would love to hear your feedback in the comments.

<hr class="parts-separator">

This is Part 4 of a 4-part article series about the different types of tests.

<ul class="parts-list">
    <li>[Part 1 - acceptance and functional tests](/unit-acceptance-or-functional-demystifying-the-test-types-part1)</li>
    <li>[Part 2 - unit tests](/unit-acceptance-or-functional-demystifying-the-test-types-part2)</li>
    <li>[Part 3 - integration tests](/unit-acceptance-or-functional-demystifying-the-test-types-part3)</li>
</ul>
