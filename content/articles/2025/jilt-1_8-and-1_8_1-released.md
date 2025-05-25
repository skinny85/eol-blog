---
id: 83
layout: article.html
title: Jilt 1.8 and 1.8.1 released!
summary: |
   Jilt, my Java library for generating Builder pattern classes,
   continues to evolve with new features and improvements.
   The latest releases, 1.8 and 1.8.1, bring incremental processing support for Gradle,
   better code coverage handling, and a fix for recursive generic type bounds.
created_at: 2025-05-25
---

[Jilt](https://github.com/skinny85/jilt),
my Java library for generating Builder pattern classes,
had two new releases in April, `1.8` and `1.8.1`,
which include a few small improvements:

## Incremental processing support for Gradle

One of the biggest benefits of using
[Gradle](https://gradle.org)
for your project is its incremental build support,
which significantly improves performance on bigger codebases,
since Gradle only performs the minimum amount of work required to rebuild your project
(recompiling only those parts that were actually changed).

However, until release `1.8`, Jilt did not correctly register itself with Gradle as an incremental annotation processor,
even though it fulfilled all of the criteria for something Gradle calls an
[isolated processor](https://docs.gradle.org/current/userguide/java_plugin.html#isolating_annotation_processors).

This has been corrected in these latest releases,
so you should see an improvement in compilation performance when using Gradle if you upgrade to `1.8` or later --
just the version upgrade is enough,
no additional configuration is required to take advantage of this feature.

Thanks to [iyanging](https://github.com/iyanging)
for [suggesting this feature](https://github.com/skinny85/jilt/issues/35).

## Better code coverage handling

In the [previous article about Jilt](/jilt-1_7-released#add-jiltgenerated-to-all-builders),
I described how, starting with version `1.7`,
Jilt adds the `@JiltGenerated`
annotation to all classes it generates,
which makes it easier to exclude them from code coverage reports.

However, as it turns out, one class was missed in this process --
for the [Functional Builder style](/jilt-1_6-supports-functional-builders),
the class that contains the static methods that correspond to the optional properties of the built class.
Since it's nested in the Builder class,
which was annotated with `@JiltGenerated`,
I thought it would be excluded transitively,
but I guess nested classes don't inherit annotations from their outer classes.

Version `1.8` fixes this issue,
and makes sure the `@JiltGenerated` annotation is present on that nested class for optional properties as well.

## Fix for Recursive Generic Type Bounds

Version `1.8.1`
includes a fix for a bug that would cause an infinite loop when compiling a class that contains a recursive generic type bounds,
for example:

```java
import org.jilt.Builder;

@Builder
public class Node<T extends Node<T>> {
    private final T parent;
    private final String name;

    public Node(T parent, String name) {
        this.parent = parent;
        this.name = name;
    }
}
```

Before version `1.8.1`, Jilt would get stuck in an infinite loop while trying to process this class.
The exact reason for the additional processing is that Jilt needs to rename the type parameters in
some cases to account for a bug in a dependent library (JavaPoet),
which I [wrote about before](/new-versions-of-jilt-released#problems-with-generic-classes).
Version `1.8.1` stops that processing in the correct spot,
so that it doesn't loop infinitely.

Thanks to [kevinshale66](https://github.com/kevinshale66)
for [reporting this issue](https://github.com/skinny85/jilt/issues/43).

## Summary

So, those are all the changes included in [Jilt](https://github.com/skinny85/jilt)
releases `1.8` and `1.8.1`.
Let me know in the comments below if you have any feedback on them,
or the library in general.
