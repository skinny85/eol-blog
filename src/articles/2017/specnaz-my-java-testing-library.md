---
id: 25
layout: article.html
title: Specnaz - my Java testing library
summary: "In this article I want to introduce Specnaz,
	a library that I recently created for writing tests inspired by
	JavaScript's Jasmine and Ruby's RSpec, made possible by
	the features introduced in Java 8 like lambda expressions
	and default methods."
created_at: 2017-01-30
---

I recently released version `1.0` of a Java testing library that I've created. It's called Specnaz, it's licensed under Apache v2, and available on my GitHub:

<p style="text-align: center;">
[github.com/skinny85/specnaz](https://github.com/skinny85/specnaz)
</p>

Now, when undertaking something like this, it seems to me that it's a good idea to explain what is the reasoning behind creating, in this case, yet another testing library. How is it different from already existing solutions? What value does it add?

In Specnaz's case, that's very easy to answer, as the library has been created because of particular pain points that my team at Amazon felt when doing fairly large-scale unit and integration testing in Java, and it was designed to alleviate those pain points.

But to properly explain that, I need to start at the beginning.

## JUnit test structure

JUnit is probably the most popular Java library in existence. While it was originally conceived somewhere around 1997, it is still ubiquitous in the Java world, twenty years later.

Let's take a look at a simple example of tests written using JUnit:

```java
public class ExampleTest {
    @Test
    public void testAddition() {
        Assert.assertEquals(3, 1 + 2);
    }

    @Test
    public void testSubtraction() {
        Assert.assertEquals(-1, 1 - 2);
    }

    @Before
    public void setUp() throws Exception {
        // Code executed before each test
    }

    @AfterClass
    public static void tearDown() throws Exception {
        // Code executed after all tests 
    }
}
```

I assume almost everybody (even if not a Java developer - that's how influential JUnit is) should recognize the basic structure. It has some variations, but can roughly be summarized as follows:

* Tests are grouped inside a class. The class is the basic unit of execution.
* Instance methods of the class annotated with `@Test` form the individual test cases. The name of the method will become the name of each test case.
* The class can have methods (instance and static) pertaining to the lifecycle of the test execution - called before or after either every test or all the tests in the class. These methods are collectively known as "fixtures".

This structure has become a _de-facto_ standard. For Java developers, it's like water to fish - we don't really see it consciously anymore, and just assume this is the way things are. Even alternatives to JUnit, like [TestNG](http://testng.org/doc/index.html) or [Spock](http://spockframework.org/), which are very different in a lot of respects from JUnit (especially Spock, as it uses a lot of advanced Groovy features which cannot be emulated in Java) have not fundamentally deviated from this basic structure.

## Limitations of the JUnit structure

While there is nothing inherently wrong with this way of forming tests (obviously, given the magnitude of its popularity), there are situations when one runs into the limits of its expressivity. Let me show you 2 concrete examples that my team struggled with.

### Similar but different preconditions

Here's a small excerpt from one of our test classes:

```java
@Test
public void customer_approving_enables_version_and_updates_agreement() {
    String versionId = newVersionForVendor();
    versionRepository.vendorResourceValidated(versionId,
        testResourceId, testResourceId, vendor, false);
    versionRepository.vendorReviewed(versionId, vendor);
    versionRepository.vendorApproved(versionId, vendor, false);
    versionRepository.customerReviewed(versionId, customer);

    versionRepository.customerApproved(versionId, customer, true);

    // ...
}

@Test
public void customer_rejecting_doesnt_enable_version_and_updates_agreement() {
    String versionId = newVersionForVendor();
    versionRepository.vendorResourceValidated(versionId,
        testResourceId, testResourceId, vendor, false);
    versionRepository.vendorReviewed(versionId, vendor);
    versionRepository.vendorApproved(versionId, vendor, false);
    versionRepository.customerReviewed(versionId, customer);

    versionRepository.customerRejected(versionId, "Too expensive", customer);

    // ...
}
```

Let me explain. This just shows the 'given-when' part of the test (we'll get to the 'then' part below). These are tests for something called an `AgreementVersion` [Repository](https://lostechies.com/jimmybogard/2009/09/03/ddd-repository-implementation-patterns/). An Agreement Version goes through a lifecycle (it's validated, then reviewed and approved by a Vendor, and finally reviewed and approved/rejected by a Customer). These tests verify that the appropriate state transitions leave the system in the correct state.

As is obvious, these tests suffer from a large degree of duplication - the entire 'given' part is exactly the same. Now, you might be thinking, "Well, duh, just put that part in a `@Before` method", but it's not that simple. I've shown you only a small snippet of that class, but it contains a lot more tests - including those that do not have exactly the same preconditions, because they are checking a different part of the Agreement Version lifecycle. For example, one checks what happens when a Customer tries to approve a Version without reviewing it first; another is testing that a Vendor rejecting instead of approving the Version works correctly.

We could try to shoehorn these into the JUnit structure by splitting them into separate classes according to what should be in the `@Before` method, but that will lead to a combinatorial explosion of test classes, each of which has to be named, and it would make finding a test for a particular Agreement Version Repository functionality quite difficult. Worst of all, this solution would not actually reduce the duplication at all - just spread it around multiple files.

### Assertion overload

Here is the remaining part of that first test shown above:

```java
@Test
public void customer_approving_enables_version_and_updates_agreement() {
    // 'Given' and 'When' part of the test shown above

    validateAgreement(agreement, agreement.activeAgreementVersion,
        ImmutableMap.of("id", versionId,
            "versionStatus", ENABLED,
            "rejectComment", agreementVersion.rejectComment,
            "versionNumber", 1,
            "startDate", testStartToday));
    assertThat(agreement.lastSupplierApprovedVersion.id)
        .isEqualTo(agreement.activeAgreementVersion.id);
    assertThat(agreement.lastSubmittedVersion.id)
        .isEqualTo(agreement.activeAgreementVersion.id);

    validateRelationship(relationship, HAS_AGREEMENT, agreementVersion,
        relationship.lastActiveAgreementVersion,
        null, ImmutableMap.of(ENABLED, 1));
    assertThat(relationship.lastSupplierApprovedAgreementVersion.id)
        .isEqualTo(relationship.lastActiveAgreementVersion.id);
    assertThat(relationship.lastSubmittedAgreementVersion.id)
        .isEqualTo(relationship.lastActiveAgreementVersion.id);
}
```

The precise details here are not that important. Basically, after completing the lifecycle of the Agreement Version, we want to verify that the system is in the correct state. Now, it involves so many assertions because the application uses a NoSQL database, and the data model needed to be denormalized in several places to support effective reads.

I'm pretty sure that I don't have to convince you that this gigantic block of assertions is not a great way to structure tests. And yet, there is really not much more we can do within the confines of the standard JUnit structure. We can attempt to split the assertions each into its own test method, but that has all of the downsides that the above mentioned splitting based on preconditions has. In reality, it's even worse, as this adds another factor to the combinatorial explosion of classes that we need - and quite a big factor, in fact (a new class for each test).

## Alternatives to the JUnit structure

It seems we have hit a brick wall - there doesn't seem to be a clean way of expressing these sort of tests in the shape that the JUnit architecture forces on us. Instead of trying to artificially fit the square peg of our tests into the round hole of JUnit, maybe it's better to step back and reevaluate whether we absolutely need to use the JUnit architecture at all.

If we survey the testing landscape of technologies outside the JVM, we see something interesting. While JUnit (or, more generally, [xUnit](https://en.wikipedia.org/wiki/XUnit)) definitely has an influence (for example, [NUnit](https://www.nunit.org/) in the .NET world), it's not the only game in town. For a popular alternative that spawned its own lineage of imitators in other languages, we can look at [Ruby's RSpec](http://rspec.info/):

```ruby
RSpec.describe "Using an array as a stack" do
  def build_stack
    []
  end

  before(:example) do
    @stack = build_stack
  end

  it 'is initially empty' do
    expect(@stack).to be_empty
  end

  describe "after an item has been pushed" do
    before(:example) do
      @stack.push :item
    end

    it 'allows the pushed item to be popped' do
      expect(@stack.pop).to eq(:item)
    end
  end
end
```

Even though Ruby is an object-oriented language, like Java, the above example demonstrates that the structure of RSpec tests is quite different than JUnits:

* There is no top-level class that the tests are grouped under.
* Consequently, testcases and fixtures are not defined by methods, but by passing anonymous functions (the `do-end` blocks, if you're not familiar with Ruby) to RSpec-provided functions like `before`, `it` and `describe`. Because of that, testcase names are human-readable strings, not limited to valid method names.
* The structure is tree-like, not flat as in JUnit - the `describe` blocks can be arbitrarily nested inside each other.

While these differences might seem minor, they have far-reaching consequences, as we will see shortly.

Now, it's not difficult to guess why doesn't JUnit's design resemble RSpec's more - in 1997, nobody dreamt of having concise anonymous function syntax in the Java language. However, with the advent of Java 8 and lambda expressions, there is no reason we can't use a structure similar to that in our Java code.

And this is where Specnaz enters the picture.

## Using the Specnaz structure

I'm not going to describe exactly how does writing tests in Specnaz look like, as it would make this already long article unbearable. Instead, I'll link to the [library documentation](https://github.com/skinny85/specnaz/blob/master/docs/reference-manual.md), and show how we can leverage its capabilities to solve the problems outlined above.

### Similar but different preconditions - use nested `describes`

Here's the same test snippet that we've seen above, repeated here for convenience:

```java
@Test
public void customer_approving_enables_version_and_updates_agreement() {
    String versionId = newVersionForVendor();
    versionRepository.vendorResourceValidated(versionId,
        testResourceId, testResourceId, vendor, false);
    versionRepository.vendorReviewed(versionId, vendor);
    versionRepository.vendorApproved(versionId, vendor, false);
    versionRepository.customerReviewed(versionId, customer);

    versionRepository.customerApproved(versionId, customer, true);

    // ...
}

@Test
public void customer_rejecting_doesnt_enable_version_and_updates_agreement() {
    String versionId = newVersionForVendor();
    versionRepository.vendorResourceValidated(versionId,
        testResourceId, testResourceId, vendor, false);
    versionRepository.vendorReviewed(versionId, vendor);
    versionRepository.vendorApproved(versionId, vendor, false);
    versionRepository.customerReviewed(versionId, customer);

    versionRepository.customerRejected(versionId, "Too expensive", customer);

    // ...
}
```

And here's a potential refactoring using Specnaz:

```java
it.describes("with a Vendor Agreement", () -> {
    it.beginsEach(() -> {
        versionId = newVersionForVendor();
    });
    it.describes("that is validated, reviewed and approved by the Vendor", () -> {
        it.beginsEach(() -> {
            versionRepository.vendorResourceValidated(versionId,
                testResourceId, testResourceId, vendor, false);
    		versionRepository.vendorReviewed(versionId, vendor);
            versionRepository.vendorApproved(versionId, vendor, false);
        });
        it.describes("and Customer reviewed", () -> {
            it.beginsEach(() -> {
                versionRepository.customerReviewed(versionId, customer);
            });
            it.should("enable version and update agreement when Customer approved", () -> {
                versionRepository.customerApproved(versionId, customer, true);

                // ...
            });
            it.should("not enable version and update agreement when Customer rejected", () -> {
                versionRepository.customerRejected(versionId, "Too expensive", customer);

                // ...
            });
        });
    });
});
```

We've taken advantage of the tree-like structure to nest the previously flat statements inside each other. Because the groups share fixtures, we moved our 'given' code to `beginsEach` methods. This has a few important consequences:

* We got rid of all the repetition. Because of the fixture sharing, simply creating a new nested context ensures that it receives all of the same lifecycle callbacks that its parent does.
* This structure is easy to extend in the future. For example, if we wanted to test the behavior for Versions that were validated and Vendor reviewed and approved but not Customer reviewed, we could simply create a new context with `describes` at the appropriate level, and just start writing new tests inside it.
* This structure is very flexible - for example, notice that because we're not interested in testing Versions between the validated and Vendor reviewed and approved states, we just collapsed those 3 transitions into one `beginsEach`, thus saving ourselves 2 levels of indentation.
* We get nice names (which can be any strings, not only valid Java method names, improving readability) - both for the test cases, as well as the nested groups themselves, which make it a lot easier to follow what was the intention of each setup statement.

### Assertion overload - use `beginsAll`

Here's the second problematic snippet again:

```java
@Test
public void customer_approving_enables_version_and_updates_agreement() {
    // 'Given' and 'When' part of the test...

    validateAgreement(agreement, agreement.activeAgreementVersion,
        ImmutableMap.of("id", versionId,
            "versionStatus", ENABLED,
            "rejectComment", agreementVersion.rejectComment,
            "versionNumber", 1,
            "startDate", testStartToday));
    assertThat(agreement.lastSupplierApprovedVersion.id)
        .isEqualTo(agreement.activeAgreementVersion.id);
    assertThat(agreement.lastSubmittedVersion.id)
        .isEqualTo(agreement.activeAgreementVersion.id);

    validateRelationship(relationship, HAS_AGREEMENT, agreementVersion,
        relationship.lastActiveAgreementVersion,
        null, ImmutableMap.of(ENABLED, 1));
    assertThat(relationship.lastSupplierApprovedAgreementVersion.id)
        .isEqualTo(relationship.lastActiveAgreementVersion.id);
    assertThat(relationship.lastSubmittedAgreementVersion.id)
        .isEqualTo(relationship.lastActiveAgreementVersion.id);
}
```

And a potential re-write in Specnaz:

```java
it.describes("when a new Agreement Version is approved by the Customer", () -> {
    it.beginsAll(() -> {
        // 'Given' and 'When' part of the test...
    });

    it.should("update the lastSupplierApproved Version of the Agreement", () -> {
        assertThat(agreement.lastSupplierApprovedVersion.id)
            .isEqualTo(agreement.activeAgreementVersion.id);
    });

    it.should("update the lastSubmitted Version of the Agreement", () -> {
        assertThat(agreement.lastSubmittedVersion.id)
            .isEqualTo(agreement.activeAgreementVersion.id);
    });

    // ...
});
```

I've only shown 2 assertions from the original example for brevity, but I hope the idea is clear. A few things to note about this solution:

* Because `beginsAll` methods are executed once (per group), this refactoring does not incur any runtime penalty.
* The original only checked assertions up to the failing one. So, if the second one would fail, the rest would not be executed. In this solution, all assertions pass and fail independently.
* Similarly to above, the framework forces us to label every assertion with a human-readable description, which is some help when something does fail.
* You can combine this pattern with the previous one of nesting `describes` blocks - you just have to split the 'given' and 'when' parts of the test into separate `beginsAll` calls on different nesting levels, and change the `beginsEach` to `beginsAll`.

## Alternative solutions

While those 2 examples showed how to use Specnaz to re-structure your tests, I wasn't the only one who had the idea to leverage lambda expressions to create a tool in the same vein as RSpec in the Java world. There are other libraries you can also try:

* [Spectrum](https://github.com/greghaskins/spectrum)
* [JarSpec](https://github.com/hgcummings/jarspec)
* [J8Spec](https://github.com/j8spec/j8spec)
* [Oleaster](https://github.com/mscharhag/oleaster)

If you're writing in [Kotlin](https://kotlinlang.org/) (which Specnaz supports as a first-class language, BTW), in addition to the ones above, you can also use:

* [Spek](https://github.com/JetBrains/spek)
* [KSpec](https://github.com/raniejade/kspec)
* [Aspen](https://github.com/dam5s/aspen)

While I think these other libraries make the mistake of trying to imitate RSpec or [Jasmine](https://jasmine.github.io/) too closely, instead of doing things in a more idiomatic Java way (for example, they use static instead of instance methods - but that's a topic for an entire new article, so I'll just leave it at that), they are in places more mature and feature rich than Specnaz, so if you find something missing in Specnaz, perhaps give these a try.

## Summary

I hope I managed to demonstrate that stepping beyond the standard JUnit structure can often result in more readable and [DRY](https://en.wikipedia.org/wiki/Don't_repeat_yourself) tests. I would encourage you to give [Specnaz](https://github.com/skinny85/specnaz) a try the next time you're struggling with formulating some tests in "vanilla" JUnit. If you do, I would love to hear about your experiences and any feedback you might have about the library, so let me know in the comments!
