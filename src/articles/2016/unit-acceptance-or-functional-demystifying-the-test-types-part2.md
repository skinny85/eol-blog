---
id: 21
layout: article.html
title: Unit, acceptance or functional? Demystifying the test types - Part 2
summary: "In another four-part article series, I want to tackle the topic of
	various test types - clearly define their different kinds, and show some
	concrete examples of tests on various levels of abstraction. If you've
	ever wondered what does it mean to write a non-functional integration
	test, or what exactly is the 'unit' in 'unit tests', these are the
	articles for you. In Part 2, we cover everything you ever wanted to
	know about unit tests."
created_at: 2016-08-01
---

This is Part 2 of a 4-part article series about the different types of tests.

<ul class="parts-list">
	<li>[Part 1 - acceptance and functional tests](/unit-acceptance-or-functional-demystifying-the-test-types-part1)</li>
	<li>[Part 3 - integration tests](/unit-acceptance-or-functional-demystifying-the-test-types-part3)</li>
	<li>[Part 4 - end-to-end tests](/unit-acceptance-or-functional-demystifying-the-test-types-part4)</li>
</ul>

<hr class="parts-separator">

### Unit tests

**Unit tests** are probably the most commonly seen type of automated tests "in the wild" - mainly because they are the easiest kind to write. They are your first line of defense against bugs in this constant war that is software development. For being so common, however, there is very little agreement on what a unit test actually is. It's one of those things in software engineering that you immediately recognize when you see it, but which is very difficult to precisely define.

Kent Beck in his ["TDD: By Example"](https://www.amazon.com/dp/0321146530/) book defines unit tests as tests that are independent of one another - meaning, executing one should not have any effect on the result of another. The problem I have with this definition is that it should actually apply to all tests! For example, I could write two end-to-end tests that sign in as two different users into my application, and perform some independent actions (for example, they edit their profile data) - all using a real browser with the help of WebDriver. And while these tests cannot influence each other's results, no one in their right mind would call them unit tests. Conversely, I've seen many tests that execute strictly in memory, without any external dependencies, but which mutate a static field of a Java class - which means they can definitely alter the outcome of ones executing after them. Anybody who tried running their unit tests in parallel for the first time knows for sure what I'm talking about - the number of hidden dependencies between the tests that you discover during this process can be quite surprising.

Remember that Kent wrote his book in the 90s. For context, when people talked about automated testing before his book was released, they almost always meant pre-recorded UI tests that clicked on the screen in the same places and in the same sequence, over and over again. Which means that if one failed (for example, it was expecting to click the close button on a popup, but the popup never appeared), all of the subsequent ones would automatically fail as well.

Automated testing has advanced quite a lot since that time, and "be independent from one another" is a bar I hope all tests should clear now. That's why I don't think Kent's definition is that useful today.

The most prevalent, differentiating trait of unit tests that is pretty much universally agreed upon is **isolation**. This implies that these tests should avoid any interactions with the outside world - so, things like filesystems, databases, external APIs etc. are off-limits (we will come back to this vaguely defined notion of "the outside world" and make it more precise when discussing integration tests later, as it's a very important issue). In order to be able to achieve this isolation, we have a slew of object-oriented design techniques:

* [Separation of Concerns](http://enterprisecraftsmanship.com/2016/06/15/pragmatic-unit-testing/), so that classes either have business logic in them, or deal with The Outside World - but not intertwine both
* [Dependency Injection](https://sites.google.com/site/unclebobconsultingllc/blogs-by-robert-martin/dependency-injection-inversion)
* [Test Doubles](/testing-with-doubles-or-why-mocks-are-stupid-part-1)

#### The mythical 'unit'

Another common but frequently misunderstood aspect of unit tests is the mythical question: "What exactly is the 'unit' in unit tests??". You may laugh at this, saying it's a purely academic discussion. However, I disagree. How you answer this question has a profound impact on the quality of not only the individual tests that you write, but also your entire unit test suite.

If you adhere precisely to Kent's Beck definition of unit tests, then you have no choice than to conclude that the unit is... the test itself! While that's not a bad idea in and of itself, it's also not that useful in practice.

If you ask a random object-oriented programmer on the street this question, you will most likely get the following answer: "The 'unit' is the class". There's also a chance you might get: "The 'unit' is the method". Both of these are incorrect (with the second being "incorrecter"), and I'll illustrate why.

We will use the following Java example. Let's say you are creating a new implementation of the `java.util.List` interface, which will be a singly-linked list (you need a new class for this, because the standard `java.util.LinkedList` is implemented as a doubly-linked list, which is problematic for you, as you know this list will store a huge number of elements, and you want to avoid the memory overhead).

The code (very roughly) looks something like this:

```java
public class SinglyLinkedList<T> implements java.util.List<T> {
	private static class ListNode<T> {
		// some code here...
	}

	@Override
	public boolean isEmpty() {
		// some more code here...
	}

	@Override
	public void add(T elem) {
		doAdd(0, t);
	}

	private void doAdd(int index, T elem) {
		// implementation details...
	}

	// a lot more code here...
}
```

How would the unit tests look like for this code? Well, if the one responsible for them is the programmer who answered that the unit of tests is the method, they would probably look something like this:

```java
public class SinglyLinkedListTest {
	@Test
	public void testIsEmpty() {
		// ...
	}

	@Test
	public void testAdd() {
		// ...
	}

	// a lot more tests here...
}
```

(If he/she was very inexperienced, he/she might also want to change the `doAdd()` method to package-private and write a test for it as well. Let's give him/her some credit, and assume he/she won't make that mistake.)

Why is this bad? Because this division of tests makes no sense. The only way to completely test the `isEmpty` method, for example, is to add some elements to the list - which means calling the `add` method. In general - you don't test methods of classes; you test **behaviors**.

In this case, the behaviors you want to test are: `SinglyLinkedList` behaves like a correct `List` implementation. Knowing this, the corrected tests would look something like this:

```java
public class SinglyLinkedListTest {
	@Test
	public void newly_created_list_is_empty() {
		List<Integer> list = new SinglyLinkedList<>();

		assertThat(list).isEmpty();
	}

	@Test
	public void list_after_add_is_not_empty() {
		List<Integer> list = new SinglyLinkedList<>();
		list.add(1);

		assertThat(list).isNotEmpty();
	}

	@Test(expected = NullPointerException.class)
	public void adding_null_throws_null_pointer() {
		new SinglyLinkedList<Integer>().add(null);
	}

	// a lot more tests here...
}
```

Now, the programmer who thinks that the unit of tests should be the class would not fall for this trap. However, he/she would have a different problem. He/she would want to make the inner `ListNode` class package-private instead of private, and write tests for it as well.

This is exactly the same mistake as when trying to test the private `doAdd` method, and it stems from the same misunderstanding of what the unit of testing should be. If you realize that you should test behaviors, not classes or methods, then it's obvious that `ListNode` is NOT something to be tested; `ListNode` (as well as `doAdd`) is an **implementation detail**, and I hope I don't have to explain that you should NEVER test those.

Note that the same warning applies to classes that are not inner, or package-private. Even if you have public classes in your module, but they are not part of the behavior contract with the clients of said module - you should not write tests for them. Failing to adhere to this principle leads to large, brittle test suites that fail with every refactoring that you attempt to perform.

So, remember:

> The 'unit' in 'unit tests' means a **unit of behavior**.

#### The testing pyramid, and unit tests traits

There is a well-known diagram that illustrates what should be the ideal composition of your automated test suite. It comes from Mike Cohn's ["Succeeding with Agile"](https://www.amazon.com/dp/0321579364) book, and it looks like this:

![](img/testing-pyramid.png)

The pyramid recommends that the bulk of your automated tests be unit tests, with fewer integration tests, and finally fewer still end-to-end tests. And while people use this idea fairly often in various books and articles, I've never seen a really good explanation of WHY are these proportions recommended.

The reason is quite simple: it's because tests have certain characteristics which diminish when moving up the pyramid. These are:

<dl>
<dt>Speed</dt>
<dd>
Because of the isolation from anything outside, unit tests execute purely in memory, which means they are fast. A test suite comprised of thousands of unit tests can easily execute in a second or two on a modern laptop. And because they are fast, it also means they give quick feedback to the programmer working on the system. Integration and end-to-end tests are at least an order of magnitude (sometimes several) slower than that.
</dd>

<dt>Ease of writing</dt>
<dd>
As they are only concerned with their code, unit tests are the simplest ones to write. In Java, for example, all you need to know is the <code>@Test</code> annotation and a way of asserting things, and you're good to go. In contrast, integration and end-to-end tests are much more complex, both in terms of the pre-conditions set up of the system under test, and the tools used.
</dd>

<dt>Error locality</dt>
<dd>
When a unit test fails, it's usually quite simple to locate the cause of the failure. An integration or end-to-end test might fail because of one of a multitude of reasons - both in the test, and in the application itself.
</dd>

<dt>Ease of setup</dt>
<dd>
Unit tests should not require any complicated setup on the part of the developer - with most modern tools, you should be able to run them immediately after checking out the code from source control. In contrast, integration and end-to-end tests are usually much more sensitive to the environment they are running in, and might force a multi-step process of execution (for example, requiring doing a local deployment before observing the changes), further lengthening the feedback loop.
</dd>

<dt>Stability</dt>
<dd>
Because they execute in a deterministic, controlled environment, unit tests rarely give false positives, in general produce consistent and repeatable results, and are not flaky. Integration and end-to-end tests can fail intermittently, might break because of external conditions outside of their control (for example, network outages), and usually have complex (and often hidden) dependencies on the tested application, making them more fragile.
</dd>
</dl>

Wow! This is quite a list. After reading it, you might wonder why would anyone even bother with tests other than unit ones!

Of course, the other tests are a crucial element, and you cannot rely on unit tests alone. The one critical trait that increases when going up the pyramid, and the reason for having the other test types, is **reliability**.

While unit tests are very important, they cannot give you a lot of confidence in the entire application working as intended. That statement should be obvious if you think about the isolation requirement of unit tests - it means that a large part of the codebase (everything dealing with "the outside world") is not exercised by these tests at all.

Verifying that is the domain of integration and end-to-end tests, which we will cover in the subsequent parts.

<hr class="parts-separator">

This is Part 2 of a 4-part article series about the different types of tests.

<ul class="parts-list">
	<li>[Part 1 - acceptance and functional tests](/unit-acceptance-or-functional-demystifying-the-test-types-part1)</li>
	<li>[Part 3 - integration tests](/unit-acceptance-or-functional-demystifying-the-test-types-part3)</li>
	<li>[Part 4 - end-to-end tests](/unit-acceptance-or-functional-demystifying-the-test-types-part4)</li>
</ul>
