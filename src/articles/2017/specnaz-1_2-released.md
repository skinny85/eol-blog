---
id: 31
layout: article.html
title: Specnaz 1.2 released!
summary: "In the last post of 2017, I wanted to talk about the newest
	release of Specnaz, my Java and Kotlin testing library."
created_at: 2017-12-31
---

My testing library [Specnaz](https://github.com/skinny85/specnaz) has recently had its third release, version 1.2 (I've blogged about the library previously [here](/specnaz-my-java-testing-library) and [here](/specnaz-1_1-released)).

This release contains several new features:

### 1. Focusing tests

When working with a tree-like structure, it's much harder to run only a single test (for example, to debug why it's failing). The solution similar libraries like [RSpec](http://rspec.info/) and [Jasmine](https://jasmine.github.io/) use to handle this problem is to allow what's called **focusing** tests.

When a unit contains at least one focused test, then only focused tests will be ran when executing that unit - all other tests will be ignored. This way, you can temporarily mark a particular, interesting test (or an entire group of them) as 'focused', and this way diagnose much more easily why does it behave the way it does (the other tests won't add their noise into your research). After you've figured it out, you can remove the focus, and re-run the unit, again executing all of the tests.

The way you mark your tests as 'focused' in those other libraries is to add the letter 'f' to the name of the test-defining function or method. Specnaz stays true to this tradition, and so you can now use `fshould` and `fdescribes` calls in your code:

```
describes("A focused test", it -> {
    it.fshould("execute this test", () -> {
        // this will be executed
    });

    it.should("not execute this test", () -> {
    	// this will NOT be executed
        fail("this should not have been called");
    });

    it.fdescribes("with a focused subgroup", () -> {
    	it.should("execute all tests in that subgroup, even without fshould", () -> {
    		// this will be executed as well
    	});
    });
});
```

Note that both `fshould` and `fdescribes` are deprecated - the idea is that you should use this capability only temporarily, to diagnose a tricky test, and remove it after that. The thinking behind marking those methods as 'deprecated' is that it makes it more likely you'll notice if you accidentally forget to remove them.

### 2. Ignoring tests

In a similar vein, it's often helpful to completely skip certain tests. In 'vanilla' JUnit, you can annotate a method with the `@Ignore` annotation - however, you can't place annotations on method calls in Java, and Specnaz uses method calls (as opposed to method declarations) to define tests.

Again taking example after RSpec and Jasmine, you can now add the letter 'x' in front of a call to `should` or `describes` to mark either a test or a group of them, respectively, as ignored.

```
describes("An ignored test", it -> {
    it.should("execute this test", () -> {
        // this will be executed
    });

    it.xshould("not execute this test", () -> {
    	// this will NOT be executed
        fail("this should not have been called");
    });

    it.xdescribes("with an ignored subgroup", () -> {
    	it.should("not execute any tests in that subgroup, even without xshould", () -> {
            // this will NOT be executed
            fail("this should not have been called");
        });
    });
});
```

There is also an `xdescribes` variant of the top-level `describes` (the one you call in the constructor or in the initializer block), which gives you the option to easily ignore an entire class of tests with one character.

### 3. More `shouldThrow` capabilities

The `shouldThrow` method, introduced in version 1.1, has been enhanced with extra capabilities. You can now formulate assertions on the received Exception by calling methods on the `ThrowableExpectations` object that `shouldThrow` returns, further refining under what conditions does the test pass:

```
it.shouldThrow(NumberFormatException.class,
        "when creating a Long from the string 'long'", () -> {
    new Long("long");
}).withMessageContaining("long").withoutCause();
```

### That's it!

Those are all of the new features introduced in Specnaz 1.2. Of course, all of them are available in [Kotlin](https://kotlinlang.org/) in addition to Java.

Happy 2018!
