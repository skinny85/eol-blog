---
id: 32
layout: article.html
title: Specnaz 1.3 released!
summary: "The blog is turning into a newsletter about Specnaz!
	Release 1.3 is a big one, bringing JUnit Rules support
	and the capability to define parametrized
	(sometimes also called data-driven) tests."
created_at: 2018-03-28
---

At what point I'll get sick of writing about [Specnaz](https://github.com/skinny85/specnaz)? Hard to say, but this third post in a row will be the last one in the series - the next one won't be about Specnaz, I promise.

Version `1.3` is a major release, bringing with it two long-awaited features to the library: JUnit Rules support, and the capability to define parametrized (sometimes also called data-driven) tests. Let's dive right in.

## JUnit Rules support

[JUnit Rules](https://github.com/junit-team/junit4/wiki/rules) is a way of wrapping the execution of JUnit tests with your own code. You can add custom code before and/or after the test executes, fail tests that would otherwise pass, or the opposite - make failing ones pass under some conditions. The API allows you to package your logic into a class that can then be re-used between many tests.

Over the years, a large ecosystem of third-party Rules has emerged that allows you to easily integrate your tests with libraries like [Mockito](http://site.mockito.org/), [Spring](https://spring.io/) or [Dropwizard](http://www.dropwizard.io/). Because using these third-party Rules is so convenient, it was important that Specnaz support them as well.

Well, I'm happy to say that, with the release of version 1.3, it now does. Here's an example of integrating with Mockito:

```java
public class MockitoExampleSpec extends SpecnazJUnit {
    public Rule<MockitoRule> mockitoRule = Rule.of(
    	() -> MockitoJUnit.rule());

    @Mock
    private List<Integer> listMock;

    {
        describes("Using the JUnit Mockito Rule in Specnaz", it -> {
            it.should("initialize fields annotated with @Mock", () -> {
                when(listMock.get(0)).thenReturn(400 + 56);

                assertEquals(456, (int) listMock.get(0));
            });
        });
    }
}
```

Check out the documentation for that feature [here](https://github.com/skinny85/specnaz/blob/master/docs/reference-manual.md#junit-rules), as there are some subtle differences in the way the Rules work in 'vanilla' JUnit and in Specnaz (mainly related to the different object lifecycle in the two libraries).

## Parametrized tests

Parametrized (sometimes also called data-driven) tests are an important way of reducing duplication in tests. You define the test body once, but instead of hard-coding the inputs and outputs, you make them parameters of the test. Afterwards, you specify with what parameters you want that test to execute, and that will result in a separate test case for every set of parameters you provided.

JUnit ships with a [Parametrized Runner](https://github.com/junit-team/junit4/wiki/parameterized-tests) that allows you to define data-driven tests. However, the experience that that class offers leaves a few things to be desired - so many, in fact, that there exists a separate library just for that functionality, [JUnitParams](https://github.com/Pragmatists/JUnitParams) (created, incidentally, by the CEO of the company I worked at before Amazon, [Pragmatists](http://pragmatists.pl/)).

The lambda-based structure of tests that Specnaz uses lends itself perfectly to defining parametrized tests. Instead of passing a no-argument lambda to the `should` method, you can now pass a lambda expecting between one and nine arguments to `should`, and use those arguments as parameters inside the test body. To specify the values for the parameters, you need to call the `provided` method on the object that `should` returns. As arguments to `provided`, you supply instances of the `ParamsX` class, where `X` is the arity of the lambda you gave to `should` (so, if you called `should` with a 3-argument lambda, you need to supply instances of the `Params3` class).

Each of the `ParamsX` classes has a static factory method called `pX` (so, `p2` for `Params2`, `p3` for `Params3`, etc.), which, combined with Java's static imports, allows you concisely create instances of them. A separate test case will be executed and reported for each instance of the appropriate `ParamsX` class you supply to `provided`.

Putting all of the above together, we get something that looks like this:

```java
import org.specnaz.params.junit.SpecnazParamsJUnit;
import static org.specnaz.params.Params2.p2;

public class FibonacciSpec extends SpecnazParamsJUnit {{
    describes("Fibonacci spec", it -> {
        it.should("show Fib(%1) = %2", (Integer input, Integer result) -> {
            assertThat(Fibonacci.fib(input)).isEqualTo(result);
        }).provided(
            p2(0, 0), p2(1, 1), p2(2, 1), p2(3, 2), p2(4, 3),
            p2(5, 5), p2(6, 8), p2(7, 13), p2(8, 21)
        );
    });
}}
```

A couple of things to note about the above code:

*   It's fairly concise - at least more concise than the JUnit equivalent. The parameters are also per-test, instead of being global to the entire class.
*   It's completely type-safe (also unlike the JUnit equivalent) - if you try to change the integer `21` to a String, for example, the code will no longer compile. And, thanks to Java's type inference, the types only need to be specified once - on the parameters of the lambda passed to `should`.
*   We used the special placeholders `%1` and `%2` in the test description. These will be replaced at runtime by the values of the parameters at the appropriate index, counting from one - so, the last test above will be reported with the description `should show Fib(8) = 21`.
*   `provided` is overloaded, accepting either variadic arguments as above, or a Collection of the appropriate `ParamsX` instances, which is more useful when generating the parameters programmatically (by reading a file, for example).

In addition to parametrized `should` (and `shouldThrow`), you can also define parametrized `describes`, this way creating an entire parametrized sub-tree of tests.

Detailed documentation about this feature can be found [here](https://github.com/skinny85/specnaz/blob/master/docs/reference-manual.md#parametrized-test-support).

## Third time's the charm

So, these are all of the new features in the `1.3` release of Specnaz. I think they really take the library to the next level in terms of making it more expressive and powerful. I encourage you to give [Specnaz](https://github.com/skinny85/specnaz) a shot, and, if you do, I would love to hear back from you about your experiences using it!
