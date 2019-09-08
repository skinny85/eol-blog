---
id: 40
layout: article.html
title: Specnaz 1.4.1 released!
summary: "
  This week, I've released version 1.4.1 of Specnaz,
  my Java and Kotlin testing library.
  In the article, I explain in depth the bug that caused the patch release,
  and how was it fixed -
  including an interesting discussion on dependencies vs. duplication."
created_at: 2019-09-08
---

It's been [over a year](/specnaz-1_4-released)
since I've last released a new version of [Specnaz](https://github.com/skinny85/specnaz),
my Java and Kotlin testing library.
This week, I've released a patch to that last version, `1.4`,
because of a [bug a Specnaz customer submitted](https://github.com/skinny85/specnaz/issues/10).
The issue only happens when you use Specnaz with [TestNG](http://testng.org/) as the execution engine.

## What's the issue?

To explain what the problem is,
I need to first dive a little bit deeper into how Specnaz integrates with test harnesses like JUnit and TestNG.

Specnaz tests are defined by writing them in a class implementing a special interface, called `Specnaz<Something>` -
the `<Something>` depends on which language bindings (Java or Kotlin)
you're using, and whether you're writing [parametrized tests](/specnaz-1_3-released#parametrized-tests) or not.
All of those interfaces define only default (that is, containing an implementation, not abstract) methods -
at this moment, 2 of them: `describes` and `xdescribes`,
but others, like `fdescribes`, could be added in the future.
The entry point to constructing a Specnaz specification is calling one of those
`describes` methods in the constructor of your test class.

Now, when running tests with JUnit,
the fact that your test class has these `describes` methods is not a big deal -
JUnit only considers `public`, `void`-returning methods without arguments as tests,
so they are simply ignored.
However, with TestNG, the situation is different.
TestNG allows test methods to have parameters,
and they will be injected by the framework,
provided it has enough information to infer where should it get values for them.
Of course, the Specnaz methods don't provide that information,
as they don't know anything about TestNG -
they're framework-agnostic by design.
And so, attempting to run the test class ends with failure.

To combat this, the Specnaz TestNG integration modules register a
[listener](https://static.javadoc.io/org.testng/testng/7.0.0/org/testng/IAlterSuiteListener.html)
that is invoked before the test suite is ran.
That listener inspects the collection of tests that comprise the suite,
and if it finds among them any classes that implement the `Specnaz<Something>` interface,
it instructs TestNG to ignore all methods with names ending in `"describes"` in that class.

That all works great, but the problem is that the listeners had a flaw.
There are many ways to define a test suite in TestNG,
and one of them is using [XML files in a special dialect](https://testng.org/doc/documentation-main.html#testng-xml).
As it turns out, the listeners were not behaving correctly in the case
the XML file was using the `<package>` element to define the test suite, like this:

```xml
<!DOCTYPE suite SYSTEM "https://testng.org/testng-1.0.dtd">
<suite name="Suite">
    <test name="Test">
        <packages>
            <package name="org.example"/>
        </packages>
    </test>
</suite>
```

This file tells TestNG to execute all tests it finds in the package `org.example`.
If a customer tried to use a file like that to run Specnaz tests in version `1.4`,
the listeners would not ignore the `describes` methods in Specnaz classes in the `org.example` package,
and the test suite would fail because of that.

This problem is fixed in version `1.4.1` of Specnaz.

## Dependencies vs. duplication

There is one more interesting aspect to this fix that I'd like to talk about.

Like I said above, each TestNG integration uses different interfaces as their entrypoints.
The `specnaz-testng` module, which is meant to be consumed from Java (and Groovy),
has `Specnaz` and `SpecnazParams` interfaces
(the latter one is for parametrized tests);
`specnaz-kotlin-testng`, which is for the [Kotlin programming language](https://kotlinlang.org),
has `SpecnazKotlin` and `SpecnazKotlinParams`, respectively.

Because of this, each integration has to define its own listener to ignore the `describes` methods in the suite,
based on what interface the test class implements.
So, the listener in `specnaz-testng` checks whether the class is a subclass of either `Specnaz` or `SpecnazParams`;
`specnaz-kotlin-testng` checks for `SpecnazKotlin` and `SpecnazKotlinParams`.

If you look at the code of those listeners
([[1]](https://github.com/skinny85/specnaz/blob/8bb85b6cfd1fe13f7ffeb0d098710d5b83c7d41d/src/main/specnaz-testng/src/main/java/org/specnaz/testng/SpecnazAlterSuiteListener.java#L13
),
[[2]](https://github.com/skinny85/specnaz/blob/8bb85b6cfd1fe13f7ffeb0d098710d5b83c7d41d/src/main/specnaz-kotlin-testng/src/main/kotlin/org/specnaz/kotlin/testng/SpecnazKotlinAlterSuiteListener.kt#L11
)),
you'll notice that,
other than being written in different programming languages
(Java vs. Kotlin),
the code is virtually identical;
the only difference are the interfaces we are checking for.

Now, many of you look at those listeners,
and immediately come up with a solution to remove the duplication that looks something like this:

```java
public abstract class AbstractAlterSuiteListener implements IAlterSuiteListener {
    @Override
    public void alter(List<XmlSuite> xmlSuites) {
        for (XmlSuite xmlSuite : xmlSuites)
            alterXmlSuite(xmlSuite);
    }
    
    // ...

    private void alterXmlClass(XmlClass xmlClass) {
        if (isSpecnazClass(xmlClass))
            xmlClass.getExcludedMethods().add(".*describes");
    }

    protected abstract boolean isSpecnazClass(XmlClass xmlClass);
}

public final class SpecnazAlterSuiteListener extends AbstractAlterSuiteListener {
    @Override
    protected boolean isSpecnazClass(XmlClass xmlClass) {
        return Specnaz.class.isAssignableFrom(xmlClass.getSupportClass()) ||
            SpecnazParams.class.isAssignableFrom(xmlClass.getSupportClass());
    }
}

public final class SpecnazKotlinAlterSuiteListener extends AbstractAlterSuiteListener {
    @Override
    protected boolean isSpecnazClass(XmlClass xmlClass) {
        return SpecnazKotlin.class.isAssignableFrom(xmlClass.getSupportClass()) ||
            SpecnazKotlinParams.class.isAssignableFrom(xmlClass.getSupportClass());
    }
}
```

This is fine, but has one downside:
since `AbstractAlterSuiteListener` is in the `specnaz-testng` module,
but `SpecnazKotlinAlterSuiteListener` is in the `specnaz-kotlin-testng` module,
this couples the `specnaz-testng` and `specnaz-kotlin-testng` modules very strongly with each other.

Now, Specnaz modules are structured in such a way that,
even though there is many of them,
you should only ever need to depend on a single one
(which depends on the language and testing framework you're using),
and the other required ones will be pulled in transitively.
However, nothing is preventing you from depending on two
(or more) of them in your configuration,
and if you do that, they can have different versions.
Now, if you couple `specnaz-testng` and `specnaz-kotlin-testng` so strongly,
it might happen that a combination of their versions,
like `1.4.` and `1.4.1`,
will not work when you attempt to use them together.
Duplicating the code avoids this issue.

This may seem like an extremely minor consideration,
but I feel like the abstract class approach is overkill in this case.
The duplication is very inconsequential;
removing it seems almost vein to me.
It's like a voice in your head that wants to pat you on the back for showing how smart you are:
"Wow, look at how beautifully you've modeled this problem with an abstract class and two implementations!
You're such a talented object-oriented programmer, good job!".

It's quite incredible to me that I'm even thinking about this issue.
I'm certain that at the beginning of my career,
I simply would have gone with the abstract class solution,
and not given it a second thought.


## Summary

So, that's all information about the `1.4.1` version of Specnaz.
It's fascinating to me how many details can go into something seemingly so minor as a patch release of a library.

What do you think of the dependency vs. duplication discussion?
Do you agree the coupling between `specnaz-testng` and `specnaz-kotlin-testng` modules is worse than the duplication,
or would you go with the abstract class solution?
Let me know in the comments below!
