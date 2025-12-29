---
id: 85
layout: article.html
title: Jilt 1.9 (and others) released!
summary: |
   Jilt, my Java library for generating Builder pattern classes,
   had several new releases in recent months.
   The latest changes include copying JavaDocs to setter methods,
   allowing placing the Builder annotation on abstract methods,
   handling checked exceptions,
   and making it possible to use the toBuilder attribute
   of the Builder annotation with Lombok's Getter annotation.
created_at: 2025-12-29
---

[Jilt](https://github.com/skinny85/jilt),
my Java library for generating Builder pattern classes,
had not one, not two, but _four_ releases since
[I last wrote about it](/jilt-1_8-and-1_8_1-released)
in May of this year.
The changes included in those four releases are:

## Copy JavaDocs to setter methods

Before version `1.9`,
Jilt never added [JavaDocs](https://en.wikipedia.org/wiki/Javadoc)
to any of the classes
(or interfaces) it generated.

However, that's not ideal if the property in the class being built contained some JavaDocs,
since the information contained in them will be missing from the generated Builder code.

For that reason, version `1.9` changes that behavior,
and copies any JavaDoc present on the property to the setter method of the generated Builder for that property.

The logic of the copying is as follows:

* If `@Builder` was placed on a class,
  the copied JavaDoc will be taken from the JavaDoc of the field
  corresponding to the setter property.
* If `@Builder` was placed on a
  [record](https://docs.oracle.com/en/java/javase/17/language/records.html),
  constructor, or static method,
  the copied JavaDoc will be taken from the
  [`@param` tag](https://docs.oracle.com/javase/8/docs/jdk/api/javadoc/doclet/com/sun/javadoc/ParamTag.html)
  for the given property (if one was provided, of course).

Thanks to [markvr](https://github.com/markvr) for
[requesting this feature](https://github.com/skinny85/jilt/issues/72).

## Allow placing `@Builder` on abstract methods

In [Jilt version `1.5`](/jilt-1_5-released#support-for-private-constructors),
we added support for placing `@Builder` on private constructors or static methods,
which results in generating an abstract Builder that you need to "manually"
extend in the built class (so that the private constructor or static method can be accessed).

However, in some cases, it's useful to trigger this behavior on a purely abstract method,
without a method body.
The main usecase I've seen for placing `@Builder` on a method without a body
is a generic method that returns a subclass of a parent class that defines the set of properties for their subclasses,
something like:

```java
import org.jilt.Builder;

abstract class JiltContext {
    @Builder(className = "SomeBaseClassBuilder", packageName = "my.package")
    abstract <T extends SomeBaseClass> T produceInstance(
            String prop1, int prop2, boolean prop3, ...);
}

class Subclass1 extends SomeBaseClass {
    static class Subclass1Builder extends SomeBaseClassBuilder<Subclass1> {
        @Override
        public Subclass1 build() {
            return new Subclass1(this.prop1, this.prop2, this.prop3, ...);
        }
    }

    // ...
}

class Subclass2 extends SomeBaseClass {
    static class Subclass2Builder extends SomeBaseClassBuilder<Subclass2> {
        @Override
        public Subclass2 build() {
            return new Subclass2(this.prop1, this.prop2, this.prop3, ...);
        }
    }

    // ...
}
```

Thanks to [Diego Pedregal](https://www.linkedin.com/in/diegopedregal) for
[requesting this feature](https://github.com/skinny85/jilt/issues/50).

## Handling checked exceptions

When placing `@Builder` on constructors or static methods,
it might happen that that constructor or method declares it throws some checked exception(s).
In those cases, generating a `build()`
method in the naive way would result in non-compiling code,
since the checked exceptions need either to be handled,
or re-declared as being thrown.

Jilt version `1.8.4` fixes this issue,
and uses the second solution mentioned above: so now,
when `@Builder` is placed on a constructor or static method that declares throwing checked exceptions,
the generated `build()`
method will re-declare it throws the same checked exceptions as that constructor or static method does.

For example:

```java
import java.io.IOException;
import org.jilt.Builder;

public class A {
    @Builder
    public A() throws IOException {
        // ...
    }
}
```

Will generate:

```java
import java.io.IOException;

public class ABuilder {
    // ...

    public A build() throws IOException {
        return new A();
    }
}
```

Thanks to [Oliver Kopp](https://mastodon.acm.org/@koppor)
for [reporting this issue](https://github.com/skinny85/jilt/issues/59).

## Lombok getters and `toBuilder`

When you set the [`toBuilder` attribute of the `@Builder` annotation](/jilt-1_5-released#generate-tobuilder-methods),
the Builder instance returned from that method must have each property initialized from the provided instance of the target class.
However, it's sometimes tricky to determine how to extract the value of a given property from the target class,
since properties can be accessed in multiple ways:
through classic getters, through record-style getters, or through a field directly if it's `public`
(or possibly package-private, when the Builder is in the same package as the target class).

Jilt tries to be clever, and determine which way of access should be used for each property.
However, there is a special case that is particularly tricky to figure out,
and that is combining Jilt with [Lombok's getter generation](https://projectlombok.org/features/GetterSetter) feature.
Since both Lombok and Jilt are annotation processors,
and the [order of execution of annotation processors is unspecified](https://stackoverflow.com/a/29235021),
it can happen that Jilt executes before Lombok,
and so, the getter for a given property might not have been generated yet at the time Jilt executes.
This is made even more complicated by the fact that when using the
[`@Value` annotation](https://projectlombok.org/features/Value),
it's typical to leave the fields of the class package-private,
and then Lombok changes them to `private` (and `final`) after it runs.

Jilt version `1.8.3` fixes this edge case,
so that using `@Getter` (and `@Value`) in combination with `toBuilder`
correctly uses the property's getter to initialize the returned Builder instance,
regardless of the order in which Jilt and Lombok run in.

Thanks to [singloon](https://github.com/singloon) for
[reporting this issue](https://github.com/skinny85/jilt/issues/45).

## Summary

So, these are all the changes in Jilt versions
[`1.8.2`](https://central.sonatype.com/artifact/cc.jilt/jilt/1.8.2),
[`1.8.3`](https://central.sonatype.com/artifact/cc.jilt/jilt/1.8.3),
[`1.8.4`](https://central.sonatype.com/artifact/cc.jilt/jilt/1.8.4),
and [`1.9`](https://central.sonatype.com/artifact/cc.jilt/jilt/1.9).

Let me know if you have feedback on any of these changes.
For instance, regarding the JavaDoc copying,
should Jilt add even more JavaDocs to the generated code?
For example, to the top-most level of the generated Builder classes (and interfaces)?

Leave a comment below!
