---
id: 45
layout: article.html
title: Improve your tests with Specnaz
summary: |
  There was an article on Reddit recently talking about how upgrading to JUnit 5 can help you write better tests.
  I thought it would be fun to write a similar article,
  but instead of JUnit 5,
  talking about Specnaz,
  my Java and Kotlin testing library.
created_at: 2020-03-15
---

There was an [article on Reddit](https://98elements.com/blog/improve-your-tests-with-junit-5)
recently talking about how upgrading to JUnit 5 can help you write better tests.
I thought it would be fun to write a similar article,
but instead of JUnit 5, talking about [Specnaz](https://github.com/skinny85/specnaz),
my Java and Kotlin testing library.

Note that I've purposefully structured this article to mirror the original.

## Architecture

Specnaz as a product is structured in a modular way.
There is a core API module that contains all of the classes used for writing tests,
and a separate module for each test framework Specnaz integrates with.
Specnaz can be used with either JUnit 4, TestNG,
or JUnit 5 as the test execution engine --
whichever you prefer
(or, whichever you're already using!).

## Running tests

Importantly, Specnaz is structured in a way that regardless of which test execution engine you're using,
you only ever need to depend on a single Specnaz module --
the other necessary ones will be pulled in automatically.
Following the example from the original article,
here's a sample Gradle configuration for using Specnaz with JUnit 5 as the test execution engine:

```groovy
plugins {
    id 'java'
}

sourceCompatibility = JavaVersion.VERSION_8

repositories {
    mavenCentral()
    jcenter()
}

dependencies {
    implementation 'com.google.guava:guava:28.0-jre'

    testCompile 'org.junit.jupiter:junit-jupiter:5.5.2'
    testCompile 'org.specnaz:specnaz-junit-platform:1.5'
    testCompile 'org.assertj:assertj-core:3.14.0'
}

test {
    useJUnitPlatform()
}
```

## Writing tests

### JUnit assertions

Specnaz deliberately doesn't ship with an assertion library.
The idea is to separate concerns,
and not force you into using any specific assertion style.
In the simplest case,
you can just use the assertion capabilities built into the test execution engine you're using;
so all examples from the original article that use JUnit 5 `assertTrue` and `assertAll` methods can be used with Specnaz as well.

### 3rd party libraries

Of course, you don't have to limit yourself to only the built-in assertion capabilities;
Specnaz is designed to be compatible with third-party assertion libraries,
so you're free to use any of them you want.
Popular choices are [Hamcrest](http://hamcrest.org/JavaHamcrest),
or [AssertJ](https://assertj.github.io/doc),
used in the original article.

### Test order

In Specnaz, tests (in one group)
execute in a stable, but unspecified, order.
This is by design, and there is no way to change that behavior.
This is a deliberate decision --
I think writing tests in a way that forces them to be executed in a particular order is a bad practice,
and so Specnaz does not include the capability to express that.

### Test lifecycle

Specnaz has all of the classic lifecycle methods that you expect to see in a modern testing framework:

* `beginsAll` executed once before all tests in a given group,
* `beginsEach` executed before each test,
* test methods (`should`, `shouldThrow`),
* `endsEach` executed after each test,
* `endsAll` executed once after all tests in a given group.

```java
it.beginsAll(() -> {
    System.out.println("Initialize tests");
    counter = 1;
});

it.beginsEach(() -> {
    System.out.println("Test no. " + counter + " will be run...");
});

it.should("some test", () -> {
    counter++;
});

it.should("some other test", () -> {
    counter++;
});

it.endsEach(() -> {
    System.out.println("Test finished.");
});

it.endsAll(() -> {
    System.out.println("All test finished");
});
```

The output of executing that test suite will be:

```shell-session
Initialize tests
Test no. 1 will be run...
Test finished.
Test no. 2 will be run...
Test finished.
All test finished
```

Specnaz always re-uses the same instance of the class for each test,
which is equivalent to JUnit's 5 `@TestInstance(TestInstance.Lifecycle.PER_CLASS)`
annotation.

### Display name and nested classes

These two things are the biggest advantages of using an RSpec/Jasmine test structure over the "classic" JUnit structure.
Test names are arbitrary strings, not limited to valid Java identifiers,
and nesting is extremely easy and concise,
thanks to Java 8 lambda expressions:

```java
class ObjectRepositoryTest {{
  describes("An object", it -> {
    it.describes("when exists", () -> {
      it.should("be found by id: %1, test no. %2", (String id, Integer i) -> { })
        .provided(p2("1", 1), p2("2", 2));

      it.should("be retrieved by id: %1 with expected name %2",
        (String id, String name) -> { })
        .provided(p2("1", "Name of first"), p2("2", "Second object's name"));
    });

    it.describes("when does not exist", () -> {
      it.should("not be found", () -> { });
    });
  });
}}
```

I think it's a lot more concise than the
[JUnit 5 version from the original article](https://98elements.com/blog/improve-your-tests-with-junit-5#display-name-and-nested-classes),
and doesn't suffer from the duplication between the method name,
the `@DisplayName` annotation, and the `@ParametrizedTest` annotation.

### Conditional execution

Tests in Specnaz can be disabled by switching the `should`
(or `describes`) method to `xshould` (or `xdescribes`).

Specnaz also supports JUnit 5 test assumptions:

```java
it.should("respect assumptions", () -> {
  assumeTrue(7 > 8);
  fail("fail");
}); // this test will be skipped
```

Specnaz doesn't have its own mechanism for filtering tests,
as those capabilities are usually built into the build tools used for executing tests
(for example, [here's the Gradle documentation on the topic](https://docs.gradle.org/current/dsl/org.gradle.api.tasks.testing.Test.html)).

### Data driven tests

Parametrized tests are one of the most important Specnaz features.
I think it's also a great case study of how the RSpec/Jasmine structure is superior to the "classic" JUnit test structure.
Compare this JUnit 5 example from the original article:

```java
@ParameterizedTest
@ArgumentsSource(EmployeeSet.class)
void testMethodParametersWithProvider(String p1, Employee p2) {
  assertAll(
    () -> assertTrue(p1.startsWith("p")),
    () -> assertTrue(p2.getDateOfEmployment().isBefore(LocalDate.now()))
  );
}

class EmployeeSet implements ArgumentsProvider {
  @Override
  public Stream<? extends Arguments> provideArguments(ExtensionContext context) {
    return Stream.of(
      Arguments.of("p1", Employee.of("Joe", Department.FINANCE, LocalDate.of(2019, 02, 01))),
      Arguments.of("p2", Employee.of("Ann", Department.IT, LocalDate.of(2018, 12, 01)))
    );
  }
}
```

to its Specnaz equivalent:

```java
it.should("work with parameters", (String p1, Employee p2) -> {
  assertAll(
    () -> assertTrue(p1.startsWith("p")),
    () -> assertTrue(p2.getDateOfEmployment().isBefore(LocalDate.now()))
  );
}).provided(
  p2("p1", Employee.of("Joe", Department.FINANCE, LocalDate.of(2019, 02, 01))),
  p2("p2", Employee.of("Ann", Department.IT, LocalDate.of(2018, 12, 01)))
);
```

Notice how much simpler the Specnaz version is.
You don't have to deal with a ton of annotations like `@ParametrizedTest`,
`@MethodSource`, `@ArgumentsSource`, `@ValueSource`, `@NullAndEmptySource`,
`@EnumSource`, `@CsvSource`, `@CsvFileSource`, ...
There are no `ArgumentConverter`s or `ArgumentsAggregator`s or weird conversion rules between Strings and custom classes.
We just have straightforward Java code -- objects being passed to methods.

Additionally, the Specnaz code is actually type safe at compile time!
For instance, if you try to change the `"p2"` string in the above example to the integer `2`,
you will get a compile-time error that the types don't match.
In JUnit 5, that would be a runtime failure
(with most likely a very confusing error message).

Finally, it's interesting to think about JUnit 5's `@RepeatedTest` feature.
Because Specnaz tests are simply regular Java code,
there is no need to have something like that built into the framework;
instead, you can achieve the same result with code similar to:

```java
for (int i = 0; i < 3; i++) {
  int currentRepetition = i + 1;
  it.should("repeat this test 3 times (repetition #" + currentRepetition + ")", () -> {
    assertTrue(currentRepetition > 0);
  });
}
```

## Conclusion

I consider JUnit 5 to be only an incremental improvement over JUnit 4.
While it does add some niceties,
it doesn't fundamentally change the way you structure your tests.
That's why I don't see many teams migrating their existing test suites from JUnit 4 to 5 --
there doesn't seem to be enough gains to warrant dealing with all of the breaking changes between the versions.

Specnaz, because it abandons the class-based structure of JUnit in favor of the function-based structure of libraries like RSpec or Jasmine,
is able to solve a lot of the fundamental problems with JUnit in a way that is simply not possible while staying inside the confines of the old structure.
Seemingly difficult issues like readable test names, nested tests,
and parametrized tests that require a lot of different annotations,
verbosity and reflection magic to be supported in the class-based structure become straightforward,
concise and natural in the function-based structure,
while gaining additional capabilities like compile-time type safety that are straight up impossible to express in the class-based structure.

If you only have experience with writing tests using the classic, class structure,
I urge you to give [Specnaz](https://github.com/skinny85/specnaz) a shot --
you might be surprised by how easy and concise does the RSpec/Jasmine function structure make many things that are traditionally difficult to achieve in JUnit or TestNG.
