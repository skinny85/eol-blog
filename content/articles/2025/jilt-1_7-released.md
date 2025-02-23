---
id: 81
layout: article.html
title: Jilt 1.7 released!
summary: |
   Jilt, my Java library for generating Builder pattern classes,
   keeps receiving more attention,
   and thus more feature requests and bug reports.
   The latest release, 1.7, addresses several raised issues:
   easier exclusion of the Builder generated code from code coverage,
   better support for changing the Builder class name with meta-annotations,
   and a fix for using toBuilder on a class with a private constructor.
created_at: 2025-02-23
---

The interest in [Jilt](https://github.com/skinny85/jilt),
my Java library for generating Builder pattern classes
(which I've written about [several](/new-versions-of-jilt-released)
[times](/jilt-1_5-released) in the recent
[past](/jilt-1_6-supports-functional-builders))
shows no signs of slowing down.
The latest release, `1.7`, includes several new features and bug fixes:

## Add `@JiltGenerated` to all Builders

One annoyance with using tools like Jilt that rely on code generation
is that, if you use a tool for measuring code coverage,
you have to make sure to exclude all that generated code from the code coverage report,
since otherwise the reported numbers will be skewed.
While these tools typically provide a way to exclude classes from being included in their reports,
it's still a manual step that users of Jilt have to remember to do.
In addition, Jilt did not allow recognizing Builder classes in any way other than based on their name,
and Builder classes can have arbitrary names,
so any provided exclusion pattern might potentially miss some of them.

For this reason, Jilt `1.7` now adds a new annotation, `@JiltGenerated`,
with [retention policy](https://docs.oracle.com/javase/8/docs/api/java/lang/annotation/RetentionPolicy.html)
set [to `CLASS`](https://docs.oracle.com/javase/8/docs/api/java/lang/annotation/RetentionPolicy.html#CLASS),
to all generated Builder classes.
This way, code coverage tools can be configured to exclude all classes containing that annotation.
[JaCoCo](https://www.jacoco.org/jacoco/trunk/index.html),
one of the most popular code coverage tools for Java,
actually automatically excludes all classes that are annotated with an annotation that contains the word "Generated"
anywhere in its name, so you don't need any additional configuration for the generated Builder classes to be excluded from code coverage when using JaCoCo.

Since `@JiltGenerated` is not used for anything by Jilt itself,
and the Java runtime ignores any annotations present on the class,
but not found at runtime,
this feature does not require any changes to your Maven or Gradle setup --
in particular, there's no need to add Jilt to the project's classpath at runtime.

Thanks to [Alexandre Navarro](https://x.com/alex_j_navarro)
for [suggesting this feature](https://github.com/skinny85/jilt/issues/28).

## Allow using `*` in the `@Builder`'s `className` attribute

Jilt has supported creating Builder meta-annotations since
[version `1.5`](/jilt-1_5-released#meta-annotations).
However, that version of this feature had one important limitation:
when changing the name of the generated Builder class with the `className`
attribute of the `@Builder` annotation,
that only supported providing a constant string for the class name,
which is insufficient for meta-annotations
(since the provided name of the generated Builder would cause a naming collision if the same meta-annotation was used on multiple classes in the same Java package).

The [`@BuilderInterfaces` annotation](https://github.com/skinny85/jilt?tab=readme-ov-file#builderinterfaces-annotation)
has a similar problem with its `innerNames` attribute,
which allows specifying the names of the generated interfaces used by the
[Staged](/type-safe-builder-pattern-in-java-and-the-jilt-library)
or [Functional](/jilt-1_6-supports-functional-builders) Builders.
The way that attribute solves this issue is by allowing using the `*`
character as a placeholder that gets substituted by the (capitalized)
name of the property that the interface corresponds to,
making it more of a pattern than just a simple name.

Starting with Jilt `1.7`, the `className` attribute of the `@Builder`
annotation now supports a similar pattern substitution,
where the `*` character gets replaced by the name of the class that the Builder is being generated for.
This makes that attribute usable with meta-annotations,
where you can make all generated Builder classes be named according to the provided pattern,
for example:

```java
import org.jilt.Builder;

@Builder(className = "*JiltBuilder")
public @interface MyBuilder {
}
```

Thanks (again) to [Alexandre Navarro](https://x.com/alex_j_navarro)
for [starting the discussion](https://github.com/skinny85/jilt/issues/28#issuecomment-2638853887)
that resulted in this feature.

## Fix mixing private constructors with `toBuilder`

Jilt has supported classes with private constructors,
and generating `toBuilder` methods,
also since [version `1.5`](/jilt-1_5-released).
However, using both of these features together didn't work --
it would generate code that wouldn't compile,
as the `toBuilder` method would try to create a local instance of the Builder class,
but since that class is abstract when the constructor of the target class is private,
it cannot be instantiated.

The solution to fix this issue is to add an extra parameter to the generated `toBuilder` method,
of the type of the Builder, if the target class has a private constructor.
Inside that method, the Builder instance pointed to by that parameter is used in the same way as the locally created
Builder instance from the non-private constructor version of `toBuilder`.
This allows hand-writing a `toBuilder` method on the target class that calls the generated one,
and passes a newly created Builder instance to it, which is probably a static nested class that is `private`,
so not available from outside the target class.

For example, using the same `User` class as in the
[original article](/jilt-1_5-released#support-for-private-constructors):

```java
import org.jilt.Builder;
import org.jilt.BuilderStyle;
import org.jilt.Opt;

public final class User {
    public final String email, username, firstName, lastName, displayName;

    @Builder(style = BuilderStyle.STAGED, toBuilder = "toBuilder")
    private User(String email, @Opt String username, String firstName,
            String lastName, @Opt String displayName) {
        // ...
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
    
    public UserBuilder toBuilder() {
        return UserBuilder.toBuilder(new InnerBuilder(), this);
    }
}
```

Thanks (again) to [Alexandre Navarro](https://x.com/alex_j_navarro)
for [reporting this issue](https://github.com/skinny85/jilt/issues/29).

## Summary

So, those are all the changes included in [Jilt](https://github.com/skinny85/jilt)
release `1.7`.
Let me know in the comments below if you have any feedback on them,
or the library in general.
