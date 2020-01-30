---
id: 34
layout: article.html
title: Specnaz 1.4 released!
summary: Version 1.4 brings with it support for TestNG as the execution engine.
created_at: 2018-07-30
---

`1.4` is the newest release of [Specnaz](https://github.com/skinny85/specnaz), my testing library for Java, Kotlin and Groovy. This version ships with the number one requested feature for Specnaz -- supporting [TestNG](https://testng.org) in addition to JUnit as the test execution and reporting engine.

## TestNG in Java

To use the TestNG support, you need to, first of all, depend on the new `specnaz-testng` module instead of `specnaz-junit`.
Then, your spec class needs to implement the `SpecnazFactoryTestNG` interface from the `org.specnaz.testng` package.
It extends the "regular" `Specnaz` interface, and like it it contains one default
(that is, containing an implementation) method,
so you don't need to write any additional code in your spec class to implement it.
Your spec class also needs to be annotated with TestNG's `@Test` annotation.

Other than that, TestNG specs look exactly like other Specnaz tests: you call the `describes` method in your class's public, no-argument constructor, passing your specification in the form of a lambda expression as the second parameter to `describes`. Example:

```java
import org.specnaz.testng.SpecnazFactoryTestNG;
import org.testng.Assert;
import org.testng.annotations.Test;
import java.util.Stack;

@Test
public class StackSpec implements SpecnazFactoryTestNG {{
    describes("A Stack", it -> {
        Stack stack = new Stack<>();

        it.endsEach(() -> {
            stack.clear();
        });

        it.should("be empty when first created", () -> {
            Assert.assertTrue(stack.isEmpty());
        });

        it.describes("with 10 and 20 pushed on it", () -> {
            it.beginsEach(() -> {
                stack.push(10);
                stack.push(20);
            });

            it.should("have size equal to 2", () -> {
                Assert.assertEquals(stack.size(), 2);
            });

            it.should("have 20 as the top element", () -> {
                Assert.assertEquals((int) stack.peek(), 20);
            });
        });
    });
}}
```

Naturally, you can also write [parametrized tests](specnaz-1_3-released) in TestNG -
the only difference is that you need to implement the `SpecnazParamsFactoryTestNG` interface
from the `org.specnaz.params.testng` package instead of `SpecnazFactoryTestNG`.

## TestNG in Kotlin

Kotlin support for TestNG is very similar.
There's an equivalent of the `SpecnazFactoryTestNG` interface,
`SpecnazKotlinFactoryTestNG`,
in the `org.specnaz.kotlin.testng` package.

There's also an abstract class that's equivalent to `SpecnazKotlinJUnit`:
`SpecnazKotlinTestNG`, in the `org.specnaz.kotlin.testng` package,
which implements `SpecnazKotlinFactoryTestNG`,
and calls the `describes` method in its primary constructor.
Which means you can save some boilerplate, and one level of indentation,
if your test class doesn't need to extend a particular class
(note that you still need to annotate your spec class with TestNG's `@Test` annotation):

```kotlin
import org.specnaz.kotlin.testng.SpecnazKotlinTestNG
import org.testng.Assert
import org.testng.annotations.Test
import java.util.Stack

@Test
class StackSpec : SpecnazKotlinTestNG("A Stack", {
    var stack = Stack<Int>()

    it.endsEach {
        stack = Stack()
    }

    it.should("be empty when first created") {
        Assert.assertTrue(stack.isEmpty())
    }

    it.describes("with 10 and 20 pushed on it") {
        it.beginsEach {
            stack.push(10)
            stack.push(20)
        }

        it.should("have size equal to 2") {
            Assert.assertEquals(stack.size, 2)
        }

        it.should("have 20 as the top element") {
            Assert.assertEquals(stack.peek(), 20)
        }
    }
})
```

Similarly for parametrized TestNG Kotlin specs -
you have the `SpecnazKotlinParamsFactoryTestNG` interface in the `org.specnaz.kotlin.params.testng` package,
and the `SpecnazKotlinParamsTestNG` abstract helper class in the same package.

## TestNG limitations

Sadly, TestNG is not as flexible as JUnit, and has some inherent limitations when being used as the test execution engine for Specnaz:

*   TestNG doesn't support the same arbitrary test results trees as JUnit -- which means the reports will be flattened, regardless of the level of nesting in your specs. The reported name of each test will be all of descriptions, up to the root of the spec tree, concatenated with the test's own description.
*   All of the results will be reported under one root class, `SpecnazTests`, in the `org.specnaz.testng` package, completely discarding the original name of your spec class.

So, let's say you have the following test suite, consisting of 2 classes:

```java
@Test
public class FirstSpec implements SpecnazFactoryTestNG {{
    describes("First TestNG spec", it -> {
        it.should("run test nr one", () -> {
            // test body here...
        });

        it.describes("with a subgroup", () -> {
            it.should("run test nr two", () -> {
                // test body here...
            });
        });
    });
}}
```

```java
@Test
public class SecondSpec implements SpecnazFactoryTestNG {{
    describes("Second TestNG spec", it -> {
        it.should("run test nr three", () -> {
            // test body here...
        });
    });
}}
```

Executing this test suite will produce a result looking something like this:

![](img/testng-ide-report.png)

As you can see, the spec tree structure is not preserved in the results, unlike with JUnit, and the names of the spec classes are gone, replaced with `SpecnazTests`. Unfortunately, these are artifacts of how TestNG is organized internally, and there is nothing Specnaz can do to correct these.

## Summary

Like I said, TestNG support was the single most requested feature for [Specnaz](https://github.com/skinny85/specnaz). I hope even with the given limitations, it will prove useful, and open up opportunities to use Specnaz where it wasn't possible before.

If you've used Specnaz with TestNG (or even with JUnit, for that matter), I would love to hear about your experiences -- let me know in the comments!
