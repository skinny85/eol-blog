---
id: 73
layout: article.html
title: New versions of Jilt released
summary: |
   For the first time in six years, I've added some features to Jilt,
   my Java library for generating Builder pattern classes.
created_at: 2024-01-28
---

I first introduced [Jilt](https://github.com/skinny85/jilt),
my Java library for generating Builder pattern classes,
in an [article on this blog](/type-safe-builder-pattern-in-java-and-the-jilt-library) back in 2017.
And while it has been downloaded thousands of times since then,
it has received only minor updates during that time,
like [making it work with Java 9 and later](https://github.com/skinny85/jilt/issues/6).
The last release containing any  functional changes
[happened in 2018](/jilt-1_1-released) -- six years ago.

However, a [recent Tweet](https://twitter.com/maciejwalkowiak/status/1743214197440221356)
from [Maciej Walkowiak](https://maciejwalkowiak.com),
of [Spring Cloud](https://spring.io/projects/spring-cloud) fame,
and the resulting activity around it,
has resulted in a surge of interest in Jilt,
and a few issues raised by its new customers.
Given the uptick in activity,
I figured it would be a good idea to address those issues in the library,
and actually add some functionality to it for the first time in six years.

So, let's discuss all the changes included in
[Jilt's newest release, `1.4`](https://github.com/skinny85/jilt/blob/master/Changelog.md#version-14---2024-01-28).

## Support for `record` Builders

The [first problem](https://github.com/skinny85/jilt/issues/9)
was that placing the `@Builder` annotation directly on `record` declarations
(introduced in [Java 14](https://docs.oracle.com/en/java/javase/14/language/records.html))
did not work.

So, the following code:

```java
import org.jilt.Builder;

@Builder
public record Person(String firstName,
        String lastName, LocalDate dateOfBirth) {
}
```

Would result in the following error reported by Jilt during compilation:

```shell-session
error: @Builder can only be placed on classes, constructors or static methods
```

As it turns out, the fix was just a
[tiny adjustment](https://github.com/skinny85/jilt/commit/444ea596344c944a8cb49d77b262a414feed15cb)
in the setup code --
all the code generation logic works the same way for records as it does for classes,
so no changes were needed to be made there.

Thanks to [Maciej Walkowiak](https://maciejwalkowiak.com) for reporting this issue.

(Technically speaking, this change was included in the previous release,
`1.3`, but since it was the only change in that version,
I felt it didn't really deserve a separate article)

## Terminology changes

Historically, I've always used the name "Type-Safe"
to refer to the Builder variant that ensures each required property
has been provided before constructing the instance of the target class.
However, looking at the [above Twitter thread](https://twitter.com/maciejwalkowiak/status/1743214197440221356),
it's clear that the Java community has settled on the name "Staged" for this concept.
Since a user [reported this as an issue](https://github.com/skinny85/jilt/issues/10),
I figured it's better to be consistent with the widely-adopter nomenclature,
and so I've added a new constant to the `BuilderStyle` enum, called `STAGED`.

In addition, I also took this opportunity to clarify the advantages of the `TYPE_SAFE_UNGROUPED_OPTIONALS` style.
I think I didn't do a good-enough job explaining under which circumstances you would use it over `STAGED`,
and the name I've originally chosen for it did not help with that.
So, I've also added a new value to the `BuilderStyle` enum with the name `STAGED_PRESERVING_ORDER`
as a replacement for `TYPE_SAFE_UNGROUPED_OPTIONALS`,
and updated its documentation to better explain its advantages
(mainly, that it allows changing a required property to optional without breaking existing code that used the previously-generated Builder).

Note that this change was made in a backwards-compatible way:
only new values were added to the enum,
the existing `TYPE_SAFE` and `TYPE_SAFE_UNGROUPED_OPTIONALS` values have not been modified,
their behavior has remained exactly as it was before,
and they have not been deprecated.

Thanks to [vprudnikov](https://github.com/vprudnikov) for
[reporting the issue](https://github.com/skinny85/jilt/issues/10).

## Problems with generic classes

As it turns out, Jilt could not be used for generic
(that is, taking type parameters) classes --
the resulting Builder would not preserve the type parameters
(it would use them in the return type of the `build()` method,
but it would never declare them, so the generated code wouldn't compile).

The [original issue](https://github.com/skinny85/jilt/issues/5)
was reported back in 2022, but I lost track of it,
since the original requester said he would provide an reproduction, but never did.
However, I found it while working on the other issues mentioned in this article,
and decided it was worth fixing as well.

So, for a class such as:

```java
import org.jilt.Builder;

@Builder
public final class Wrapper<T> {
    public final T item;
    
    public Wrapper(T item) {
        this.item = item;
    }
}
```

Jilt will now generate the following Builder:

```java
@Generated("Jilt-1.4")
public class WrapperBuilder<T> {
    private T item;

    public static <T> WrapperBuilder<T> wrapper() {
        return new WrapperBuilder<T>();
    }

    public WrapperBuilder<T> item(T item) {
        this.item = item;
        return this;
    }

    public Wrapper<T> build() {
        return new Wrapper<T>(item);
    }
}
```

Interestingly, this issue also surfaced a bug in
[JavaPoet](https://github.com/square/javapoet),
a library Jilt depends on for code generation.
When generating a Staged Builder for a class with type parameters,
there's an edge case where the return type in the method declaration
of the interfaces generated for making sure the given required property has been set
is shadowed by the type parameter.
This happens when the name of the field or parameter the property is derived from
is the same (after uppercasing its first letter)
as the name of the type parameter.

Here's an example of a class that demonstrates this problem:

```java
import org.jilt.Builder;
import org.jilt.BuilderStyle;

@Builder(style = BuilderStyle.STAGED)
public final class Pair<First, Second> {
    public final First first;
    public final Second second;

    public Pair(First first, Second second) {
        this.first = first;
        this.second = second;
    }
}
```

This generates the following per-property interfaces:

```java
@Generated("Jilt-1.4")
public interface PairBuilders {
    interface First<First, Second> {
        Second<First, Second> first(First first);
    }

    interface Second<First, Second> {
        Optionals<First, Second> second(Second second);
    }

    interface Optionals<First, Second> {
        Pair<First, Second> build();
    }
}
```

The issue here is that the `Second` in the return type of the `first()`
method in the `First` interface refers here to the type parameter,
which shadows the next interface in the chain.
The correct thing here would be to qualify the type name with the name of the enclosing interface,
so JavaPoet should generate the return type as `PairBuilders.Second`.
I've [opened a bug](https://github.com/square/javapoet/issues/997) about it to the project.

Thanks to [Thibault Urien](https://github.com/ThibaultUrien)
and [Giacomo Baso](https://github.com/gbaso)
for reporting and commenting on the issue.

## `@Nullable` annotation should make properties optional

A recent trend that's gaining popularity in the Java ecosystem is using annotations to denote whether a given variable,
field or parameter can be `null` or not.
Some people like to use the `Optional` type,
introduced in [Java 8](https://docs.oracle.com/javase/8/docs/api/java/util/Optional.html),
for that purpose,
but the problem is that an `Optional` instance can still be `null` itself,
and the Java maintainers like Brian Goetz have clearly said that
[this is not the idiomatic way to use that type](https://www.reddit.com/r/java/comments/13rv1t2/why_exactly_does_brian_goetz_not_recommend_the).

Typically, you would use the annotation `@Nullable` to denote that a given value can be `null`,
and the annotation `@NonNull` (or `@NotNull`) that it cannot be `null`
(many people also follow the convention that not specifying any annotation implies the value cannot be `null`,
which saves you _a lot_ of typing).
This allows IDEs and build tools to emit warnings or errors when violating the annotation-based rules
(for example, passing the result of a method with the return type annotated as `@Nullable`
into a parameter annotated with `@NonNull`).

This is relevant for Jilt, since `null` is the default value for optional properties of reference types
if a value has not been provided for them before constructing the instance of the target class.
So, if a given field or property is marked as `@Nullable`, it's natural to treat it as an optional property.
However, before the `1.4` release, Jilt had no awareness of `@Nullable` annotations,
and thus you always had to add the `@Opt` annotation explicitly in order to make the property optional,
which could get tedious if a class has many properties.

In `1.4`, I've decided to change this behavior, and now any property generated from a field or
constructor/static method parameter annotated with `@Nullable` is automatically considered optional,
without having to explicitly add the `@Opt` annotation to it.

The tricky part about this is that there is not a single set of these annotations that are widely considered standard in the Java community.
Instead, the situation is more similar to logging, where you have multiple competing alternatives,
like [SLF4J](https://www.slf4j.org), or [Log4J2](https://logging.apache.org/log4j/2.x).
In the case of `null`-permitting annotations, you have [JSR-305](https://jcp.org/en/jsr/detail?id=305),
[JetBrains annotations](https://www.jetbrains.com/help/idea/annotating-source-code.html),
[and `jspecify`](https://jspecify.dev).
However, in a stroke of luck, all of them use the same name, `@Nullable`,
for the `null`-permitting annotation.
So, in Jilt, we simply respect any annotation with the name `Nullable`,
regardless of what package it belongs to.
This means that, in theory, you could define your own `@Nullable` annotation if you wanted to,
and Jilt would recognize it, and automatically make the property annotated with it optional!

In addition to making the property optional, Jilt also propagates the `@Nullable` annotation to the generated setter
methods for that property, to make sure the IDEs and build tools don't report false positives when passing values to them.

Thanks (again) to [Maciej Walkowiak](https://maciejwalkowiak.com) for reporting this issue.

## Summary

So, those are all the changes included in [Jilt](https://github.com/skinny85/jilt) release `1.4`.
I'd love any feedback you might have about these, and the library in general.
