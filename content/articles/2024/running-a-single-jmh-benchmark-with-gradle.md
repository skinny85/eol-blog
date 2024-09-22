---
id: 79
layout: article.html
title: "Running a single JMH benchmark with Gradle"
summary: |
   The Gradle build system makes it very easy to use the JMH library to write benchmarks for your Java code.
   However, one tricky thing when combining Gradle and JMH is the ability to run a single benchmark when invoking your build.
   In this article, I'll show a simple setup that,
   with just a few lines of code in your build script,
   allows you to easily select what benchmark you want to invoke when running your Gradle build.
created_at: 2024-09-21
---

The [JMH library](https://openjdk.org/projects/code-tools/jmh)
is the gold standard for performance benchmarking code on the Java Virtual Machine.
Writing reliable benchmarks on this platform is particularly tricky,
as the [JIT compilation](https://en.wikipedia.org/wiki/Just-in-time_compilation)
it uses means the performance of your program can change dramatically with time,
as the code changes from being interpreted to executing natively.
Fortunately, JMH makes it easy to warm up the JVM correctly so that only JIT-compiled code gets actually measured.

Using JMH with the [Gradle build system](https://gradle.org)
is very easy --
there is a [plugin](https://plugins.gradle.org/plugin/me.champeau.jmh) that sets up everything for you,
including creating a separate
[SourceSet](https://docs.gradle.org/current/dsl/org.gradle.api.tasks.SourceSet.html),
so that your benchmarks are neatly isolated from your production and test code.

However, there is one downside of JMH with Gradle:
out of the box, it doesn't provide a simple way to run a single benchmark.
When executing the `jmh` Gradle task,
it by default runs the entire benchmark suite of a given project.
If you have many benchmarks defined, it might take a long time to execute them all.

Often, we are working on a particular part of the codebase,
and we want to quickly run a single benchmark while iterating on the production code,
to confirm whether we are on the right track,
and our changes achieve the expected performance results.
We want to run the entire benchmark suite only at the end,
after finishing with the production code,
to confirm our changes did not introduce a performance regression.

The JMH Gradle plugin allows specifying what subset of benchmarks to invoke
with the `includes` option.
So, you could specify the pattern you need directly in your Gradle file:

```groovy
jmh {
    includes = ["MyBenchmark"]
    // remaining JMH options go here...
}
```

The filter in the `includes` property is pretty flexible --
you can specify the unqualified name of your benchmark class,
or a substring of the name, or even a regular expression --
so, both `"MyBench"` and `"MyBench.*"` above would have worked as well.

(The `includes` property takes an array, not a single value,
but I don't find that capability particularly useful,
as the multiple patterns are combined with the "and" logical operator,
instead of "or", and thus you can't just specify `["MyBenchmark1", "MyBenchmark2"]`
to run two benchmarks --
if you try, JMH will fail with the error message
`No matching benchmarks. Miss-spelled regexp?`.
This is a weird decision, in my opinion, but there's nothing we can do about it,
and so I think the ability to specify multiple patterns is not really needed.)

With the above changes to the `build.gradle` file,
running `./gradlew jmh` would only execute benchmarks inside classes whose simple name matches `MyBenchmark`.

While that works, it hard-codes the filter directly in your build script,
which is not ideal -- you might forget to remove it after you're done iterating on a specific benchmark,
which would effectively disable the remainder of your benchmark suite.
In addition, whenever you wanted to change the benchmark you are interested in,
you'd have to remember to change it in the build script as well.

The trick we can use here to avoid hard-coding the pattern in the `jmh`
block is to leverage the [`-P` option](https://docs.gradle.org/current/userguide/project_properties.html#sec:project_properties)
when invoking Gradle, which allows us to set the value of a given property.
Then, we can read the value of that property from within the build script by using the
[`Project.findProperty()` method](https://docs.gradle.org/current/dsl/org.gradle.api.Project.html#org.gradle.api.Project:findProperty(java.lang.String%29).
So, we can use that value to pass to the `includes` options.
We have to make sure to handle the case where the property was not passed
(in which case, `findProperty()` will return `null`).

So, if we use a property called `jmhIncludes` to control which benchmark should run,
the Gradle script looks as follows:

```groovy
String jmhIncludes = findProperty("jmhIncludes")
jmh {
    if (jmhIncludes != null) {
        includes = [jmhIncludes]
    }
    // remaining JMH options go here...
}
```

And we can invoke the script to run the benchmark called `MyBenchmark` as follows:

```shell
$ ./gradlew jmh -PjmhIncludes=MyBenchmark
```

If we skip the `-PjmhIncludes` argument,
the `includes` option won't be set,
and thus all benchmarks will be executed.

And, that's it! A simple way to run a single JMH benchmark when using Gradle as your build system.
