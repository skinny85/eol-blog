---
id: 44
layout: article.html
title: Why do Java static final fields have default values?
summary: |
  In the Java programming language,
  static final fields can never be reassigned after the class they belong to has been loaded.
  Given that, you might be surprised that they go through a two-phase initialization process:
  they are first assigned their type's default value,
  and only after that their ultimate value.
  This sounds surprising at first – why bother initializing something that is constant twice?
  But as it turns out, there are some subtleties in Java that make this necessary.
  In this article, we dive into those corner-cases.
created_at: 2020-01-31
---

The concept of `final` fields and variables is pretty simple in Java.
A variable or field marked `final` can only be assigned once.
For example:

```java
final int f1 = 3; // fine
final int f2;
f2 = 4; // also fine

f1 = 5; // does not compile!
f2 = 6; // does not compile!
```

A special subset of these are `static` `final` fields.
They are typically initialized on declaration, like `f1` above.
That initial value is assigned to the field when the class is loaded by the Java Virtual Machine,
which happens when the executing program first references this class.
After loading, the values of these fields cannot be changed.

Another well-known characteristic of the Java language is that all variables and fields have a well-defined value,
even if that variable or field was not explicitly initialized by the programmer.
Unlike in languages like C,
where an uninitialized variable has some undetermined, semi-random value in it,
values in Java are automatically created by the runtime with a deterministic value.
This can have a potential performance penalty,
but during the language's design,
it was deemed that referencing undeterministic values is such a source of subtle bugs,
and potentially even security vulnerabilities,
that it was worth it to take a possible performance hit in order to eliminate that entire class of errors.
The default value is `0` for all numeric types and `char`,
`false` for `boolean`, and `null` for reference types.

This deterministic nature of Java variables is specified in
[article 4.12.5 of the Java Specification](https://docs.oracle.com/javase/specs/jls/se8/html/jls-4.html#jls-4.12.5).
The relevant part is (emphasis mine):

> Each **class variable**, instance variable, or array component is initialized with a default value when it is created (§15.9, §15.10.2): (...)

You might be surprised that `static` `final` fields are not excluded from that list
(the specification calls `static` fields "class variables").
I mean, if those values are assigned only when the class is loaded,
and then can never be changed,
surely we can get rid of that performance penalty in their case,
and not require `static` `final` fields to be initialized twice:
first with their type's default value,
and then with their, well, final value?

That's what I thought until recently.
However, while working on some edge cases during class loading.
I realized that there are actually very legitimate reasons for the two-stage initialization of `static` `final` fields!
Here's three that I'm aware of:

### Case 1 – cyclic references

Take a look at the following Java program:

```java
class A {
    static final int fieldA = B.fieldB;
}

class B {
    static final int fieldB = A.fieldA;
}
```

At first, you might be surprised - is that sort of cycle even allowed??
But as it turns out, yes, this is perfectly valid Java code --
it does not cause any infinite loops in the JVM or anything like that.
In fact, because of the default value rule,
it's guaranteed that `A.fieldA` and `B.fieldB` will both be set to `0`.

### Case 2 – initialization ordering

Another edge case is that the order of initializing the fields is the same as their order in the source code.
Which means you can actually reference a `static` `final` field before its initializer had a chance to run!
Simple example:

```java
class Example {
    static final int field1 = method1();
    static final int field2 = method2();

    private static int method1() {
        if (field2 != 0)
            throw new IllegalStateException();
        else
            return 5;
    }

    private static int method2() {
        return 6;
    }
}
```

The above class loads correctly, with `field1` equal to `5` and `field2` equal to `6`.
But as you can see, because of the initialization ordering,
`method1` has access to `field2` before its initializer had a chance to execute.
So, if it weren't for the default value guarantee,
we would observe some undetermined value in `field2` at that point.
In this case, there are actually 2 values observed by the program of `field2` --
first `0`, then `6`, even though it's marked as `static` `final`!

### Case 3 – static initializers

Like I said above, `static` `final` fields can,
but don't have to, have initializers.
If a field like that doesn't have an initializer,
then it means it has to be assigned a value in the **static initializer** --
a special block of code, preceded by the `static` keyword,
that appears inside the class body.
A static initializer will be executed once,
when the class is loaded by the Java Virtual Machine.
Since it's a block of code,
it has free access to all `static` `final` fields --
including those that haven't been initialized yet!
That's another way for the program to observe the two states of a `static` `final` field:

```java
class Static {
    static final int field1;
    static final int field2;

    static {
        if (Static.field2 != 0) // just field2 doesn't compile here!
            throw new IllegalStateException();
        
        field1 = 5;
        field2 = 6;
    }
}
```

Interestingly, the compiler tries to defend against this a little bit --
just referencing `field2` gives the error "variable field2 might not have been initialized".
However, referencing the field with the class qualifier,
like another class would, is enough to throw off the compiler,
and observe the default value of the `static` `final` field.

## Summary

I think this topic is an interesting case study.
Often in programming, problems appear to us as being very simple on their surface
(this often manifests itself with asking questions like "Why aren't you just doing X?"),
and we're surprised when their actual implementation is not as simple as we thought it should be.
However, in many cases, that's because we simply don't understand the problem deeply enough to appreciate all of its complexities and corner cases.
That's exactly what happened to me --
before running into the above scenarios,
I never thought it was possible to observe the value of a `static` `final` field before it was assigned its ultimate value.

Next time you're tempted to say "Why aren't you just doing X?",
maybe try to do a quick deep-dive, and think "In what cases would doing X not be good enough?".
