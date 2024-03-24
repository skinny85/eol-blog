---
id: 75
layout: article.html
title: Jilt version 1.5 released!
summary: |
   When it rains, it pours!
   The interest in Jilt, my library for generating Builder classes in Java,
   continues to be high, and so a new release, version 1.5, has been published,
   adding a few new features, and fixing one bug.
created_at: 2024-03-25
---

Two months ago, [I wrote](/new-versions-of-jilt-released)
about how a resurgence of interest in [Jilt](https://github.com/skinny85/jilt),
an open-source Java library that I created eight years ago for automatically generating Builder classes,
has resulted in a release of it with new functionality for the first time since 2018.

Well, the interest in the library has remained high,
and a few issues have been raised in the project's repository since January.
I've managed to resolve several of them,
and published a [new release, `1.5`](https://github.com/skinny85/jilt/blob/master/Changelog.md#version-15---2024-03-23),
with those changes.

Let's quickly go through the highlights of this latest release.

## Generate `toBuilder()` methods

There is a common pattern that is often used with [Lombok](https://projectlombok.org),
where the target class is generated with a method called `toBuilder()`
that returns an instance of the Builder initialized with the values of properties taken from the instance that `toBuilder()` was called on.
This is useful to create a copy of the target instance with only a few properties changed,
without having to make the class itself mutable with setters, for example:

```java
Person person = new Person(/* ... */);
Person copiedPerson = person.toBuilder()
    .name("John") // example of changing a single property when copying the instance
    .build();
```

In the above example, `copiedPerson` will be almost identical to `person`,
with the only exception being the `name` property, which will be set to `"John"`.

Unfortunately, annotation processors cannot modify hand-written classes, only create new ones.
Yes, Lombok manages to sidestep this limitation, but it does it in a way that
[is considered a hack](https://notatube.blogspot.com/2010/11/project-lombok-trick-explained.html),
which I don't want Jilt to replicate,
and so it cannot add the `toBuilder()` method to the target class.

However, we can employ a simple trick to get around this limitation.
We can inverse the control flow: instead of making the instance method return a Builder,
we can pass that instance to a static factory method of the Builder:

```java
Person person = new Person(/* ... */);
Person copiedPerson = PersonBuilder.toBuilder(person)
    .name("John")
    .build();
```

In version `1.5.` of Jilt, that method will be generated when the new `toBuilder`
attribute of the `@Builder` annotation is set.
That attribute allows you to control the name of that generated method.
For the `Person` example above, it would look something like:

```java
@Builder(toBuilder = "toBuilder")
public class Person {
    // ...
}
```

But any valid Java method name can be used, not only `"toBuilder"`.
The default value of the `toBuilder` attribute is the empty string,
which means this method won't be generated unless you set the attribute explicitly.

The interesting part is how the generated method initializes the properties of the Builder from the instance of the target class.
Jilt uses the following algorithm to find values in the target instance,
for each property of the Builder:

1. If the target class has a getter for that property
   (a no-argument method whose name starts with the word "get",
   and then the (capitalized) name of the property), use it.
2. If the target class has a no-argument method whose name is equal to the name of the property, use it
   (this is the case that covers Java 14+ `record` types).
3. Finally, if the previous two steps didn't find an appropriate method,
   assume you can read the field of the target class from the Builder,
   with a name identical to the property name
   (this is the case when the target class surfaces this property as a `public final` field).

Note that this method doesn't return a Staged builder,
but a classic one (where you are free to set the properties in any order,
and call the `build()` method at any point),
since the assumption is that all properties, including required ones,
have already been set from the provided instance.

Thanks to [Alexandre Navarro](https://twitter.com/alex_j_navarro) for
[submitting this feature request](https://github.com/skinny85/jilt/issues/16).

## Meta-annotations

In some cases, you may want to re-use the same Builder configuration for multiple classes.
For example, you might decide that every value class in your project should use a Staged Builder,
with `"set"` as the prefix for setter methods, `"create"` as the name of the build method,
and `"B_"` as the prefix of the per-property interface names used for the Builder stages.
In such situations, instead of repeating the same annotations in multiple places,
in Jilt `1.5`, you can instead define your own annotation and annotate it with `@Builder` and `@BuilderInterfaces`:

```java
import org.jilt.Builder;
import org.jilt.BuilderInterfaces;
import org.jilt.BuilderStyle;

@Builder(style = BuilderStyle.STAGED, setterPrefix = "set", buildMethod = "create")
@BuilderInterfaces(innerNames = "B_*")
public @interface MyBuilder {
}
```

And then, you can place this `MyBuilder` so-called _meta annotation_ wherever `@Builder` can be placed
(so, a class, constructor, or static method),
and the effect will be as if that element was annotated with the same `@Builder` and `@BuilderInterfaces`
values as `@MyBuilder` is annotated with, thus avoiding any duplication in your code:

```java
@MyBuilder // uses @Builder and @BuilderInterfaces values from @MyBuilder
public final class MyValueClass {
    // ...
}
```

Thanks to [Diego Pedregal](https://www.linkedin.com/in/diegopedregal)
for not only [creating this feature request](https://github.com/skinny85/jilt/issues/14),
but going above and beyond,
and actually [submitting a Pull Request](https://github.com/skinny85/jilt/pull/15)
implementing this functionality!

## Support for `private` constructors

In some cases, you might want to force customers of a class to instantiate it only through its Builder,
and not through any other means, like its constructor, or static factory method.
When writing the Builder code by hand, you would typically achieve this by making the constructor of the class `private`,
and making Builder a nested class of the main class.

But, as we already talked above when discussing the `toBuilder()` method,
well-behaved annotation processors cannot modify existing classes,
so generating a class nested inside a hand-written class is not possible without Lombok-like hacks.

However, while we cannot generate the nested class,
we can make it easier to write the nested Builder manually.
In the `1.5` version of Jilt, if you place the `@Builder`
annotation on a `private` constructor or static factory method,
the generated code changes: the Builder class becomes abstract,
the fields are `protected` instead of `private`, and the `build()` method is made abstract too.
With this, you can extend the Builder class in a nested class of the main class,
and you only have to override the `build()` method to call the `private` constructor,
using the fields of the parent Builder class as values of the properties,
to make your Builder class no longer abstract.
You can also provide a static factory method in your class that returns the Builder instance,
conventionally called just `builder()`, which allows you to make the nested class `private` as well.

For example, if we wanted to make the constructor of the `User` class from the
[Jilt main ReadMe](https://github.com/skinny85/jilt#optional-properties) `private`,
it would look something like this:

```java
public final class User {
    public final String email, username, firstName, lastName, displayName;

    @Builder(style = BuilderStyle.STAGED)
    private User(String email, @Opt String username, String firstName,
            String lastName, @Opt String displayName) {
        this.email = email;
        this.username = username == null ? email : username;
        this.firstName = firstName;
        this.lastName = lastName;
        this.displayName = displayName == null
                ? firstName + " " + lastName
                : displayName;
    }

    private static class InnerBuilder extends UserBuilder {
        @Override
        public User build() {
            return new User(email, username, firstName, lastName, displayName);
        }
    }

    public static UserBuilders.Email builder() {
        return new InnerBuilder();
    }
}
```

With the above code, the only way to create an instance of `User` would be to use the `User.builder()`
static method, and then instantiate it through the (Staged, in this case) Builder.

Thanks to [Aurélien Mino](https://twitter.com/AurelienMino) for
[submitting this feature request](https://github.com/skinny85/jilt/issues/13).

## JSpecify's `@Nullable` annotations were not recognized

In the [previous article](/new-versions-of-jilt-released#-nullable-annotation-should-make-properties-optional)
discussing the `1.4` release,
I've described how Jilt started automatically treating fields and parameters annotated with
`@Nullable` as optional.
The idea was to make this behavior generic,
not tied to any specific `@Nullable` annotation,
since there are many competing libraries in this space.

However, it was reported that Jilt was not properly recognizing `@Nullable` from one of those libraries,
[JSpecify](https://jspecify.dev).
As it turns out, JSpecify annotations work a little differently from other entrants in this area,
as they actually belong to the type, instead of to the field or parameter
(more precisely, they belong to the _type usage_ --
the difference between a type declaration and a type usage is most apparent with generic types,
like with `List<T>` vs `List<String>`).

This issue has been fixed in Jilt `1.5`,
and so now JSpecify annotations are treated the same as other `@Nullable` annotations.
Thanks (again) to [Alexandre Navarro](https://twitter.com/alex_j_navarro) for
[reporting the issue](https://github.com/skinny85/jilt/issues/11#issuecomment-2002620000).

## Summary

So, those are all the changes included in [Jilt](https://github.com/skinny85/jilt) release `1.5`.
I'd love any feedback you might have about these, and the library in general.
