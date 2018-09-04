---
id: 30
layout: article.html
title: Specnaz 1.1 released!
summary: "I've recently released version 1.1 of my Java and Kotlin
	testing library, Specnaz."
created_at: 2017-07-31
---

I've recently released the second version of my test and specification library for Java and Kotlin, Specnaz. Find it on GitHub here:

<p style="text-align: center;">
[github.com/skinny85/specnaz](https://github.com/skinny85/specnaz)
</p>

This release contains one new feature: the `shouldThrow` test method. It's similar in concept to the `expected` attribute of JUnit's `@Test` annotation: it allows you to declare a test that succeeds only if it throws a particular Exception.

Simple example:

```
public class StackSpec extends SpecnazJUnit {{
    describes("A Stack", it -> {
        Stack<Integer> stack = new Stack<>();

        it.shouldThrow(EmptyStackException.class, "when popping an empty Stack", () -> {
            stack.pop();
        });
    });
}}
```

The description of the test will be prefixed with "should throw &lt;ExpectedExceptionClass&gt;", so take that into account when writing the test - for instance, the above example will have the description: "should throw EmptyStackException when popping an empty Stack".

Another thing is that, just like with JUnit's <code>@Test.expected</code>, the actual Exception can be of the class of the expected Exception, or it can be a subclass of it; so, the above example could have been also written as:

```
it.shouldThrow(RuntimeException.class, "when popping an empty Stack", () -> {
    stack.pop();
});
```

, and it would still pass.

This feature is also available from Kotlin, but works a tiny bit differently in that language. Because Kotlin has reified generics, we can pass the expected Exception class as a type parameter instead of a `Class` instance, which makes it a little more concise:

```
class StackSpec : SpecnazKotlinJUnit("A Stack", {
    var stack = Stack<Int>()

    it.shouldThrow<EmptyStackException>("when popping an empty Stack") {
        stack.pop()
    }
})
```

So, enjoy throwing Exceptions in tests! Let me know what you think of this new feature (and Specnaz in general) in the comments.
