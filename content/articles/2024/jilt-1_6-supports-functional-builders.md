---
id: 77
layout: article.html
title: Jilt 1.6 supports Functional Builders
summary: |
   With the latest release, Jilt, my Java library for auto-generating Builder classes,
   now supports a new style of Builders, called Functional Builders.
created_at: 2024-06-22
---

[Jilt](https://github.com/skinny85/jilt),
my Java library for automatically generating Builder pattern classes,
has been garnering quite a bit of attention lately,
as I've written about in [two](/jilt-1_5-released)
recent [articles](/new-versions-of-jilt-released) on this blog.

A couple of months ago, [Thomas Schuehly](https://twitter.com/tschuehly)
opened [an issue](https://github.com/skinny85/jilt/issues/17)
about adding support for Functional Builders to Jilt.
Functional Builders are an alternative to the classic Java Builder pattern,
first introduced by
[Guillaume Laforge](https://twitter.com/glaforge)
(who is probably best known as the creator of the [Groovy programming language](https://www.groovy-lang.org/))
in an [article on his blog](https://glaforge.dev/posts/2024/01/16/java-functional-builder-approach).
Thomas suggested adding Functional Builders as the fourth supported Builder style to Jilt
(with the first three being [Classic](https://github.com/skinny85/jilt/blob/master/Readme.md#example),
[Staged](https://github.com/skinny85/jilt/blob/master/Readme.md#staged-builders), and
['Staged preserving order'](https://github.com/skinny85/jilt/blob/master/Readme.md#staged-but-preserving-order-builder-style)).

I thought this would be a good fit for the library, and so, after a bit of tinkering,
the newest Jilt release, `1.6`, includes support for Functional Builders!

Since this is a relatively new pattern
(the aforementioned [blog article](https://glaforge.dev/posts/2024/01/16/java-functional-builder-approach)
by Guillaume is only from January this year!),
let me first quickly describe the basics of how it works
(check out [Guillaume's article](https://glaforge.dev/posts/2024/01/16/java-functional-builder-approach)
for a full explanation),
and then show how we had to adapt it to fit the constraints Jilt operates under.

## The Functional Builder pattern

Functional Builders look quite different from classic Builders.
There is no separate instance that has setter method calls chained on it,
and no final call to the `build()` method at the end that returns an instance of the target class.

Functional Builders can be thought of as a way to implement the
[named parameters](https://en.wikipedia.org/wiki/Named_parameter)
programming language feature, which Java lacks.
Instead of a separate Builder, the constructor of the built class will be used to create an instance of it.
But, the property values will not be passed to that constructor directly;
instead, the argument to the constructor is
[variadic](https://docs.oracle.com/javase/8/docs/technotes/guides/language/varargs.html),
and its type is an interface nested inside the built class that has a single method,
returning `void`, and taking the built class as the only parameter
(kind of like a [Java 8 `Consumer`](https://docs.oracle.com/javase%2F8%2Fdocs%2Fapi%2F%2F/java/util/function/Consumer.html),
with the target class as the value of the generic type parameter).

To make things less abstract, let's use a concrete example:

```java
public final class FullName {
    public static interface FullNameConsumer {
        public void accept(FullName fullName);
    }

    public FullName(FullNameConsumer... consumers) {
        for (FullNameConsumer consumer : consumers) {
            consumer.accept(this);
        }

        // any validations and other logic go here...
    }

    // ...
}
```

So, where do we get implementations of this nested interface?
The built class will have static methods that return instances of this interface.
There will be a static method for each property of the built class,
with the same name as the property.
The static method will take one argument,
of the same type that the corresponding property has.
The returned instance of nested interface will,
in its `accept` method, set that property on the instance passed to it to the value of the static method argument.

Continuing our above example, it looks something like this:

```java
public final class FullName {
    private String firstName, middleName, lastName;

    public static FullNameConsumer firstName(final String firstName) {
        return new FullNameConsumer() {
            public void accept(FullName fullName) {
                fullName.firstName = firstName;
            }
        };
    }

    public static FullNameConsumer middleName(String middleName) {
       // we can use Java 8 lambda expressions
        return fullName -> {
            fullName.middleName = middleName;
        };
    }

    public static FullNameConsumer lastName(String lastName) {
       // since the lambda is a single statement,
       // you can skip the braces
        return fullName -> fullName.lastName = lastName;
    }

    // ...
}
```

Given all that, creating an instance of the target class is done through invoking its constructor,
and passing it the results of calling the static methods with the values of the properties you want to set, such as:

```java
FullName jfk = new FullName(
    FullName.firstName("John"),
    FullName.middleName("F"),
    FullName.lastName("Kennedy")
);
// jfk.firstName == "John"
// jfk.middleName == "F"
// jfk.lastName == "Kennedy"
```

And, using Java's [static imports](https://docs.oracle.com/javase/7/docs/technotes/guides/language/static-import.html),
we can approximate the named parameters language feature:

```java
import static mypackage.FullName.firstName;
import static mypackage.FullName.lastName;
import static mypackage.FullName.middleName;

FullName jfk = new FullName(
    firstName("John"),
    middleName("F"),
    lastName("Kennedy")
);
```

Notice that, although the nested interface must be public
(since it's used as a parameter of the public constructor),
so in theory can be implemented outside the target class,
as long as the fields of the target class are `private`,
only implementations from the static methods on the target class can modify those fields,
so you don't have to worry about other implementations potentially messing with your class's internals.

## Functional Builders in Jilt

To add this feature to Jilt,
and allow automatically generating classes that implement this pattern,
we need to modify it slightly to adapt it to the constraints that Jilt operates under:

1. As I [wrote before](/jilt-1_5-released#generate-tobuilder-methods),
   Jilt cannot modify hand-written classes,
   only generate new ones.
   So, we cannot generate the constructor in the target class,
   or the interface nested in it, or the static methods that return implementations of that interface.
2. The above pattern treats all properties as optional.
   The differentiation between optional and required properties is a staple of Jilt,
   and we would like to retain it for Functional Builders as well.
3. Since we can't modify the target class by generating the static methods inside of it,
   that means the above point, about the fields of the target class being accessible only in methods inside it,
   no longer holds, so we have to find a solution to that problem as well.

I reached out to Guillaume on Twitter,
and he was gracious enough to join the discussion
[in the issue](https://github.com/skinny85/jilt/issues/17#issuecomment-2028010315).
After some back and forth, we settled on the following design:

1. We generate a static factory method on the Builder class,
   similarly like we do for the other Builders in Jilt.
   However, in order to keep the spirit of the pattern,
   we change the return type of the static factory method for Functional Builders to be the built class directly,
   and not the Builder class.
2. The interfaces for the properties are generated inside a separate top-level interface, 
   not in the Builder class, same as for existing Staged Builders in Jilt.
3. Each required property has its own interface,
   while all optional properties share the same interface.
   The static factory method takes those required property interfaces as arguments first,
   in the same order as they were declared in the target class,
   and then the optional properties are the last, variadic, argument,
   which means they can be skipped, or provided in any order.
4. The generated interfaces take an instance of a Builder in their `accept` methods.
   The Builder has a field for each property, with the same name, that is `private`,
   and the Builder doesn't include any setter methods.
5. We generate the per-property static methods that return the interface instances also on the Builder class.
   This ensures these methods are the only ones that can mutate the Builder --
   any implementations outside the Builder won't have access to the `private` fields,
   and thus cannot change the instance passed to them in any way.
6. For the optional properties, since they share the same interface,
   we generate the static methods for them under an additional nested class of the Builder, called `Optional`,
   to make them more discoverable.

Since we moved all field mutations into the Builder,
we can safely make the target class completely immutable,
including making the fields `final`,
or using [Java 14+ Records](https://docs.oracle.com/en/java/javase/17/language/records.html).

In order to use this new style of Builder in Jilt,
you need to set the `style` attribute of the `@Builder`
annotation to the new `BuilderStyle.FUNCTIONAL` value:

```java
import org.jilt.Builder;
import org.jilt.BuilderStyle;
import org.jilt.Opt;

@Builder(style = BuilderStyle.FUNCTIONAL)
public final class FullName {
    public final String firstName;
    @Opt public final String middleName;
    public final String lastName;

    public FullName(String firstName,
            String middleName, String lastName) {
        this.firstName = firstName;
        this.middleName = middleName;
        this.lastName = lastName;
    }
}
```

This will generate a Builder that can be used like this:

```java
FullName jfk = FullNameBuilder.fullName(
    FullNameBuilder.firstName("John"), // required here
    FullNameBuilder.lastName("Kennedy"), // required here
    FullNameBuilder.Optional.middleName("F") // could be skipped
);
```

And with static imports:

```java
import static mypackage.FullNameBuilder.firstName;
import static mypackage.FullNameBuilder.lastName;
import static mypackage.FullNameBuilder.Optional.middleName;

FullName jfk = FullNameBuilder.fullName(
    firstName("John"), // required here
    lastName("Kennedy"), // required here
    middleName("F") // could be skipped
);
```

The first two arguments passed to `FullNameBuilder.fullName()`,
for `firstName` and `lastName`,
have to be present, since they correspond to required properties --
however, the third argument, for `middleName`,
is an optional property (the field was annotated with the `@Opt` annotation from Jilt),
so could have been skipped.

The `FullName` class could also be re-written to use Records:

```java
import org.jilt.Builder;
import org.jilt.BuilderStyle;
import org.jilt.Opt;

@Builder(style = BuilderStyle.FUNCTIONAL)
public record FullName(String firstName,
        @Opt String middleName, String lastName) {
}
```

This generates a Builder class that can be used in the same way as when `FullName` was a class.

### Functional `toBuilder`

In the [previous article](/jilt-1_5-released#generate-tobuilder-methods),
I described a new feature in Jilt version `1.5` --
the `toBuilder` attribute of the `@Builder` annotation.
The idea behind it is that you can now generate a Builder class with a static `toBuilder()`
method that takes an instance of the target class,
and returns an instance of the Builder,
initialized with values copied from the instance of the target class passed as the argument.
This is useful for creating a copy of an instance of the target class with just a few properties changed,
while still making the target class completely immutable.

However, since the Functional style doesn't use a Builder instance directly,
the way `toBuilder` works for this variant is different.

In the Functional style, the `toBuilder` method directly returns an instance of the target class,
similarly to the static factory method.
In order to modify the returned instance,
the `toBuilder` method has a second, variadic argument that is the base type for all the generated per-property nested interfaces
(both for required and optional properties).
This way, we can pass any number of interface instances to `toBuilder()` --
since the Builder instance will be initialized from an instance of the target class,
we consider all properties optional in this case.

So, continuing the `FullName` example from above:

```java
import org.jilt.Builder;
import org.jilt.BuilderStyle;
import org.jilt.Opt;

@Builder(style = BuilderStyle.FUNCTIONAL, toBuilder = "copy")
public final class FullName {
    public final String firstName;
    @Opt public final String middleName;
    public final String lastName;

    public FullName(String firstName,
            String middleName, String lastName) {
        this.firstName = firstName;
        this.middleName = middleName;
        this.lastName = lastName;
    }
}
```

The `toBuilder()` method can be used as follows:

```java
import static mypackage.FullNameBuilder.firstName;
import static mypackage.FullNameBuilder.lastName;
import static mypackage.FullNameBuilder.Optional.middleName;

FullName jfk = FullNameBuilder.fullName(
    firstName("John"),
    lastName("Kennedy"),
    middleName("F")
);
FullName rfk = FullNameBuilder.copy(jfk,
    firstName("Robert"));

// rfk.firstName == "Robert"
// rfk.middleName == "F"
// rfk.lastName == "Kennedy"
```

## Other changes

While Functional Builders are the marquee feature of this latest Jilt release,
it also includes a few smaller fixes that are worth mentioning.

### Propagate all annotations to setter methods

In version `1.4`, Jilt started
[treating properties annotated with `@Nullable` as optional automatically](/new-versions-of-jilt-released#-nullable-annotation-should-make-properties-optional),
without the need to explicitly annotate them with `@Opt`.
Part of that functionality was also propagating the `@Nullable` annotation into the parameter of the setter method that corresponds to that property --
otherwise, IDEs and static analysis tools might report warnings for passing potentially `null`
values into a method that doesn't indicate it accepts them.

As it turns out, there are other annotations beyond just `@Nullable`
that are useful for propagating into the setter methods --
for instance, if a property is marked as `@NotNull`,
it's helpful during static analysis if its setter parameter is annotated with that as well
(otherwise, you might accidentally pass something that allows `null` values to it,
and you wouldn't get any warnings in your build catching that potential bug).

Jilt `1.6` includes a change where all annotations
(that can be placed on parameters, of course)
are propagated to the setter method parameter corresponding to the given property,
not just `@Nullable`.

Thanks to [Diego Pedregal](https://www.linkedin.com/in/diegopedregal)
for [reporting this issue](https://github.com/skinny85/jilt/issues/20),
and [submitting a Pull Request](https://github.com/skinny85/jilt/pull/19) implementing it.

**Note**: there is a small bug with this feature in version `1.6`,
where some annotations, like [Lombok's `@NonNull`](https://projectlombok.org/api/lombok/NonNull),
are copied twice to the setter parameter.
If you get a compilation error when using Jilt `1.6` with an error message
similar to `<XYZ> is not a repeatable annotation`,
make sure to update to Jilt version `1.6.1`.

### Fix for `toBuilder` with boolean properties

When discussing the `toBuilder` functionality in the
[last article about Jilt](/jilt-1_5-released#generate-tobuilder-methods),
I described the algorithm Jilt uses for extracting the value of a given property from the target class.
However, I missed the pretty obvious fact that getters for boolean properties are typically named with the "is"
prefix instead of "get".

Jilt version `1.6` fixes this bug, so that getters for boolean properties that start with "is"
are correctly recognized in `toBuilder` methods.

Thanks to [radtke](https://github.com/radtke) for
[reporting this issue](https://github.com/skinny85/jilt/issues/18).

## Summary

So, those are all the changes included in [Jilt](https://github.com/skinny85/jilt) releases `1.6` and `1.6.1`.
I'd love any feedback you might have about these, and the library in general.

Note that Guillaume also wrote a [follow-up article on his blog](https://glaforge.dev/posts/2024/06/17/functional-builders-in-java-with-jilt),
discussing Jilt, and how it implements Functional Builders --
I'd encourage you to give it a read as well.
