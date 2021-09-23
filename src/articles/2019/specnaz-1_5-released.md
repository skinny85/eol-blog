---
id: 42
layout: article.html
title: Specnaz 1.5 released!
summary: "
  November saw the release of a new version of Specnaz,
  my Java and Kotlin testing library.
  This relase brings with it one major feature –
  support for JUnit 5 as the test execution engine."
created_at: 2019-11-30
---

When I first released [Specnaz](https://github.com/skinny85/specnaz),
my testing library for Java, Kotlin and Groovy,
[back in 2016](/specnaz-my-java-testing-library),
it leveraged JUnit 4 as its execution engine.
It made perfect sense: you really don't want to waste time re-writing all of that boring-yet-necessary infrastructure
(test runners, result reporters, build tool plugins, IDE plugins, etc.),
and piggy-backing on existing solutions lowers the barrier for adoption of a new tool like Specnaz considerably.

JUnit 4 was the obvious choice;
it's to this day the most popular Java testing framework,
and its [Runner API](https://github.com/junit-team/junit4/wiki/Test-runners)
makes implementing custom testing solutions a breeze,
even ones who look so radically different from the "standard" JUnit tests like Specnaz ones do.

However, even since the beginning,
I structured the project in a way that clearly separated the core logic of executing a Specnaz spec from the JUnit 4 integration code,
anticipating that JUnit 4 might not always be the only supported execution engine.
This paid dividends last year,
when, by popular demand,
I was able to add support for [running Specnaz specs with TestNG](/specnaz-1_4-released).

While JUnit 4 was the obvious choice back in 2016,
today that same choice would be anything but obvious.
JUnit 4 is effectively abandonware,
having had its last stable release in 2014.
Its development team is completely focused on its successor,
JUnit 5, which, after spending 2 years in beta,
finally had a General Availability release in September of 2017.

Since then, the momentum has visibly shifted to JUnit 5 as the future,
and JUnit 4 being relegated pretty much exclusively to legacy projects.
With this momentum shift,
it was important that Specnaz follow suit,
as I don't want the project to be seen as only working with old and crufty technologies.
So, with the release of version `1.5`,
Specnaz now supports JUnit 5 as the third test execution engine.

## JUnit 5 with Java

To use the JUnit 5 support in Java,
you need to depend on the new module `specnaz-junit-platform`
instead of the JUnit 4 `specnaz-junit` one.
In your spec class, you do the usual thing:
implement the `Specnaz` interface,
and then the call the `describes` method in the
`public`, no-argument constructor of the class.
The only JUnit 5-specific thing you need to do is annotate the class with the
`Testable` annotation from the `org.junit.platform.commons.annotation` package in the `junit-platform` module.
Here's an example of the `StackSpec` from the main Specnaz ReadMe using JUnit 5:

```java
import org.junit.platform.commons.annotation.Testable;
import org.specnaz.Specnaz;
import java.util.Stack;
import static org.assertj.core.api.Assertions.assertThat;

@Testable
public class StackSpec implements Specnaz {{
    describes("A Stack", it -> {
        Stack<Integer> stack = new Stack<>();

        it.endsEach(() -> {
            stack.clear();
        });

        it.should("be empty when first created", () -> {
            assertThat(stack).isEmpty();
        });

        it.describes("with 10 and 20 pushed on it", () -> {
            it.beginsEach(() -> {
                stack.push(10);
                stack.push(20);
            });

            it.should("have size equal to 2", () -> {
                assertThat(stack).hasSize(2);
            });

            it.should("have 20 as the top element", () -> {
                assertThat(stack.peek()).isEqualTo(20);
            });
        });
    });
}}
```

[Parametrized tests](/specnaz-1_3-released#parametrized-tests) are pretty much identical;
the only difference is implementing the `SpecnazParams` interface instead of `Specnaz`.
Everything else, including the `@Testable` annotation,
remain the same.

## JUnit 5 in Kotlin

The JUnit 5 support in Kotlin is very similar to the Java one.
There is the new `specnaz-kotlin-junit-platform` module that you need to depend on,
and your spec class has to implement the `SpecnazKotlin` interface instead of `Specnaz`,
like always when writing specs in Kotlin.
Other than that, things are pretty much identical to the Java experience:
you annotate your class with the `@Testable`,
and call the `describes` method in the constructor, as usual:


```kotlin
import org.junit.platform.commons.annotation.Testable
import org.specnaz.kotlin.SpecnazKotlin
import java.util.Stack
import org.assertj.core.api.Assertions.assertThat

@Testable
class StackSpec : SpecnazKotlin {
    init {
        describes("A Stack") {
            var stack = Stack<Int>()

            it.endsEach {
                stack = Stack()
            }

            it.should("be empty when first created") {
                assertThat(stack).isEmpty()
            }

            it.describes("with 10 and 20 pushed on it") {
                it.beginsEach {
                    stack.push(10)
                    stack.push(20)
                }

                it.should("have size equal to 2") {
                    assertThat(stack.size).isEqualTo(2)
                }

                it.should("have 20 as the top element") {
                    assertThat(stack.peek()).isEqualTo(20)
                }
            }
        }
    }
}
```

In addition, there is a `SpecnazKotlinJUnitPlatform` class,
which is analogous to the `SpecnazKotlinJUnit` class from the `specnaz-junit` module and the `SpecnazKotlinTestNG` class from the `specnaz-testng` module.
It implements the `SpecnazKotlin` interface,
is already annotated with the `@Testable` annotation,
and calls the `describes` method in its primary constructor --
which means you can save a little boilerplate code,
and some indentation,
if your spec class does not need to extend a particular class.
Here's the same `StackSpec` class above, but using `SpecnazKotlinJUnitPlatform`:

```kotlin
import org.specnaz.kotlin.junit.platform.SpecnazKotlinJUnitPlatform
import java.util.Stack
import org.assertj.core.api.Assertions.assertThat

class StackKotlinSpec : SpecnazKotlinJUnitPlatform("A Stack", {
    var stack = Stack<Int>()

    // the spec body is the same as above...
})
```

[Parametrized tests](/specnaz-1_3-released#parametrized-tests) are very similar to their Java counterparts:
you either implement the `SpecnazKotlinParams` interface and annotate your class with the `@Testable` annotation,
or you extend the `SpecnazKotlinParamsJUnitPlatform`
class from the `org.specnaz.kotlin.params.junit.platform` package.

## Further information

For more details about the JUnit 5 support,
check out the [Specnaz reference documentation on the topic](https://github.com/skinny85/specnaz/blob/master/docs/reference-manual.md#junit-5).
There is also an [examples directory](https://github.com/skinny85/specnaz/tree/master/src/examples)
in the main distribution that contains some simple working tests with JUnit 5.
