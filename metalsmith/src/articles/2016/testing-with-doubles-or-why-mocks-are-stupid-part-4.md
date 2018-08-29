---
id: 16
layout: article.html
title: Testing with Doubles, or why Mocks are Stupid - Part 4
summary: "I close out this 4-part epic with a discussion of the
	downsides of Test Doubles, and how over-using them can damage
	your tests."
created_at: 2016-01-16
---

[Part 1](/testing-with-doubles-or-why-mocks-are-stupid-part-1) | [Part 2](/testing-with-doubles-or-why-mocks-are-stupid-part-2) | [Part 3](/testing-with-doubles-or-why-mocks-are-stupid-part-3)

In [the](/testing-with-doubles-or-why-mocks-are-stupid-part-1) [previous](/testing-with-doubles-or-why-mocks-are-stupid-part-2) [articles](/testing-with-doubles-or-why-mocks-are-stupid-part-3) in this series, we looked at the different types of Test Doubles and seen a lot of examples of using them. In this closing post, I want to switch gears a little bit and talk about the reasons why you might want to consider NOT using them.

## The perils of Test Doubles

I hope that my examples from the previous articles, if they managed nothing else, at least proved that creating Test Doubles with modern tools like Mockito is very easy - even in Java, a language known for being extremely verbose. It's even easier in dynamic languages like Ruby or JavaScript. Because of this convenience (and the awesome advice in this series, of course), you might find yourself be tempted to use Doubles everywhere you can in your test code.

My advice is simple - don't. Personally, I use Doubles only in situations where I have absolutely no choice. If I do have a choice, I will always prefer using the real object to an artificial one - even at the cost of increased setup complexity and lengthened test execution time.

Throughout this article series, I've touched upon various problems that Test Doubles can cause already. What I want to do right now is enumerate them precisely, and expand on each one.

In my view, Test Doubles have three big flaws:

1.  They lower the fidelity of your tests by changing objects between test and production environments.
2.  They don't respect invariants of the classes that they are substituting, resulting in fragile, encapsulation-breaking tests.
3.  They violate the [DRY](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself) principle and don't account for changes in your dependencies.

### 1. Doubles are liars

The first, most obvious problem with Test Doubles is that the tests using them have much lower reliability. Tell me, would you be OK with releasing code that used an external service, which you never actually called - only unit tested with mocks? I know I wouldn't.

Even if you stay true to the API you are doubling, real objects might have behaviors that they exhibit, that aren't explicitly stated in their API contract - but are, never the less, true. That's why it's very easy to break the contract of a method when mocking it. A classic example is that a lot of methods never return `null` (even if they never state so explicitly), but often (for example, in Mockito), the default when creating a mock is returning `null`. Suddenly, your tests fail in a way that would never happen in production. There are many other similar discrepancies that can occur - for example, a method may return a list, but it might actually never return an empty one. You have to make sure to account for that when stubbing.

A similar issue is that there might be differences between what the documented API says, and the actual behavior of the object.

Another thing that's very hard to simulate correctly with Doubles are the exceptions that methods throw. Java is actually not bad here, with it's checked exceptions mechanism. However, even in Java, it's very, very common for methods to throw additional unchecked exceptions, which may or may not be documented. These can be as simple as throwing `IllegalArgumentException` when a required argument is given as `null`, to wrapping network or database access errors, not to mention framework exceptions from things like JPA, EJB or Spring. There is absolutely no way of knowing what those exceptions are, other than using the actual dependency, and then encoding what you found out in the mocks.

Finally, Doubles completely subvert the process of actually instantiating your dependencies - which in many cases, is not trivial. This is especially true for objects representing remote resources in a lot of older Java technologies (like remote EJBs). Such objects quite often have many hidden dependencies, heavily relying on, for example, the environment they are run in (meaning they would behave completely differently in your tests and in the production application server, for instance).

### 2. Mocks are Stupid (and so are Stubs)

We saw this flaw manifesting itself multiple times already. For example, in [Part 3](/testing-with-doubles-or-why-mocks-are-stupid-part-3#code-change-section), when discussing testing Command methods. Just as a reminder: the interface was extended with an additional method, and the invariant was: `addToWatchList(x)` is equivalent to `addToWatchList(x, Status.NORMAL)`. Obviously, an artificial Mock object has no idea of that, and there is no way to encode this kind of knowledge in him. So what can we do? Theoretically, we could encode the invariant by somehow verifying a logical combination of method calls instead of just one call (so in this case, we need to check that either `addToWatchList(long)` or `addToWatchList(long, Status)`) was called). However, that would require a lot of not very readable, boilerplate-y and error-prone code to achieve. So in practice, what will most likely happen instead? We will crack open the implementation of the code we want to test, see which methods it calls, and verify those. That is a clear violation of encapsulation, and leads to change-detector tests, which offer no help with refactoring, and in time actually become a burden for the project, instead of an aid.

Stubs are no better. For example, let's see the example `HttpServletRequest` Stub from [Part 1](/testing-with-doubles-or-why-mocks-are-stupid-part-1#stub) again:

```
HttpServletRequest reqStub = mock(HttpServletRequest.class);
when(reqStub.getParameterMap()).thenReturn(ImmutableMap.of(key, new String[]{val}));
```

Can you spot was is wrong with this class? The `HttpServletRequest` has a whole bunch of methods dealing with parameters. One of them is `getParameterMap()`, seen above; another is `getParameterValues(String)`, which returns all of the values for a particular parameter. Now, there's a pretty obvious invariant between `getParameterMap` and `getParameterValues`:

```
// for every HttpServletRequest 'request' and String 'x':
request.getParameterMap().get(x)
// returns an array with the same contents as
request.getParameterValues(x)
```

This is something that should be very straightforward for any human implementing this interface - but an artificial Stub has no way of knowing something like that, and will happily return `null` when asked for `getParameterValues(x)`. So, if in the production code we do a change from `request.getParameterMap().get("xxx")` to (the more readable, and possibly more efficient) `request.getParameterValues("xxx")`, our tests might suddenly fail, even though the application would work correctly when deployed.

This is what I meant with the 'Mocks are Stupid' title. The problem with both Mocks and Stubs is that they are dumb objects, who have no idea of the invariants of the class they are doubling. They blindly respond the way they were set up, even when that way makes no sense. That's the reason I tried to show in each example how using Fakes might alleviate this problem. That's because a Fake is an actual class, not an artificial object, and the code in it can be written to satisfy the invariants of the API that we're doubling.

If you're still not convinced, let me propose a little thought experiment. Imagine you have a class that uses a `java.util.List<String>` internally, and for some reason you want to mock that dependency with Mockito instead of using a real implementation like `ArrayList<String>`. That would be a complete nightmare! For instance, every time `add(String)` would be called, you would have to change the behavior of `get(int)` for the index equal to the list's length before the insertion. I'm not even sure you could achieve something like that with Mockito. And that's just the interaction between two methods of the mocked interface - think about how hard implementing `add(String, int)` or `remove(int)` would be. So, what would most likely happen? Obviously, we would open the code of the tested method, look what calls it made to the `List`, and mock only those instead. The resulting test would have a pretty big chance of breaking on each and every refactoring to the tested method.

Here is a good rule of thumb - if you have to open the actual code of a method or class, in order to write a test for it (instead of just it's API and/or documentation), it's a pretty big red flag indicating you're violating object encapsulation, and your test will be fragile.

You may think this example is absurd, and it kind of is. But I see this happening all the time - except with application-specific types, instead of something like `List`.

To be absolutely clear - I'm not saying Fakes are perfect. They have their own set of problems: they require writing actual code, while using Mockito directly doesn't; they can get de-synchronized with the real implementations; and finally, because there's actual code involved, it can have bugs, which might lead to false results in tests. But short of using the real objects, I don't know a better way of ensuring high-quality tests. You need to judge, on a case by case basis, whether an investment in writing a separate class is worth it. There are some signs you can look for in your tests, that indicate it might be time to extract a Fake - the most important of these are when you find yourself repeating the same stubbings and/or verifications in multiple places, when your test class starts to amass a lot of helper methods inside it, and if you notice that the tests often break when refactoring.

### 3. Mocks degrade with time

One of the greatest assets of having a large suite of tests for a project is to guard ourselves from regressions in already working functionality. A regression can happen in multiple ways:

1. From a mistake in refactoring existing code.
2. From an incorrect change done when adding new functionality.
3. From a breaking change in something external to our system.

The first flaw of Test Doubles I discussed (their fragility) robs us of detecting errors from the first source (by introducing false negatives in over-specified tests). This last flaw takes away the last two points.

If there's one thing constant in software development, it's change. Things change all the time. So, it's only logical that your dependencies change as well. The thing is, when you use mocks, you violate the DRY principle. Suddenly, the behavior of your dependencies has two sources of truth. Your production code uses the real one, while you tests - whatever it is that the mocking was set up to do. And what might end up happening is what is always the danger when duplicating knowledge like that - the two sources might get out of sync. This has two consequences. One, the reliability of the tests suffers even more - when they fail to catch real production issues related to the dependencies. And two, it might lead to situations where we maintain production code exercised in tests, but which is in fact dead in the real system, as the actual dependencies never produce the values needed to branch into that specific part of the code. This is something that might be incredibly difficult to untangle in a large codebase with heavily over-mocked tests.

This is a very undesirable situation to find yourself in, and the only way to fix it is for a developer to update the Doubles (along with the tests, usually) so that they better reflect the current reality. Until things change again, of course, and the entire cycle repeats itself.

### The more you mock, the lower you sink

Naturally, all of these downsides of Test Doubles are magnified as their numbers increase in a single test. Ideally, you would only ever use up to exactly one Double in a single test. In practice, this is often hard to achieve (although I would say that the necessity of using multiple Doubles might be a code smell indicating the class under test has too many responsibilities). Just remember that with each new Double that you introduce, the test's fragility goes up, while it's reliability goes down.

There is one particular case of over-mocking that I think is especially dangerous, and that is when you need to return a mocked object from another mocked object. I'm talking about code like this:

```
SomeClass firstMock = mock(SomeClass.class);
OtherClass secondMock = mock(OtherClass.class);
when(secondMock.someMethod()).thenReturn(firstMock);
```

If you're ever in a situation that you need to write something like that, I think it's a good idea to step back and really think whether a test like this adds any value. It might be better to approach the problem differently - for example, write an integration or end-to-end test instead.

## Closing thoughts

Wow. This turned out to be quite an epic. Believe it or not, but I actually originally envisioned this to be one article. However, as the wall of text kept growing, I first split it into two, then three, and finally arrived at this four-piece structure. The individual articles are still pretty long, but I couldn't come up with another breakdown that I liked, so I left it like this.

Based on my observations, improper usage of Test Doubles is one of the biggest problems people encounter when doing unit testing. I also suspect they contribute, at least in part, to some of the criticisms that are sometimes laid out against unit tests in general. All of that slows down the adoption of practices like Test-Driven Development, which are near and dear to my heart. I think Test Doubles are like a lot of things in programming - useful and important, but also easy to get wrong. I hope these articles will be helpful in getting the good out of them while avoiding the bad.

[Part 1](/testing-with-doubles-or-why-mocks-are-stupid-part-1) | [Part 2](/testing-with-doubles-or-why-mocks-are-stupid-part-2) | [Part 3](/testing-with-doubles-or-why-mocks-are-stupid-part-3)
