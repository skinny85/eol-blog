---
id: 87
layout: article.html
title: Functional programming from first principles, part 1 – motivation
summary: |
   In this new article series,
   we explore the functional programming language paradigm:
   what it is, how it differs from other paradigms,
   and what are the advantages of structuring your programs in a functional manner.
   We will explore all these topics through the lens of creating a brand-new
   functional programming language from scratch,
   and seeing how the constraints of functional programming shape its design.
created_at: 2026-07-26
---

[Functional programming](https://en.wikipedia.org/wiki/Functional_programming)
is considered one of the four major programming language paradigms.
The typical classification divides all programming languages into either
**imperative** or **declarative**.
Imperative languages can be further subdivided into **procedural**
(examples of which are: C, Go, and Rust)
and **object-oriented**
(examples: [Smalltalk](https://en.wikipedia.org/wiki/Smalltalk), C++, and Java),
while declarative languages can be subdivided into
**logical** (examples of which are:
[Prolog](https://en.wikipedia.org/wiki/Prolog) and [Rocq](https://en.wikipedia.org/wiki/Rocq)),
and **functional** (examples: [Haskell](https://www.haskell.org),
[Elm](https://elm-lang.org), and [Idris](https://idris-lang.org)).

In this article series, we will focus on that last group --
functional programming languages:
their purpose, design, and how they are different from other kinds of languages.
We will explore all these topics through the lens of creating a brand-new
functional programming language from scratch,
and seeing how the constraints of functional programming shape its design.

The goal of this article series is to present functional programming concepts in a way
that is accessible to programmers familiar with imperative languages,
show what the differences are between functional and imperative approaches,
what are the strengths of functional languages,
and illustrate the different tradeoffs one can make when designing a functional language.

Note that this is not a course on learning programming from scratch;
it assumes that you know how to program already,
and that you're familiar with at least one language from the imperative family.

## Mathematical definition of functions

Functional programming takes its name from the concept of a
[function](https://en.wikipedia.org/wiki/Function_(mathematics%29) in mathematics.
Because of these formal underpinnings,
there is often some math involved when discussing functional programming concepts.
Don't be discouraged by this; the math is generally not that difficult,
and having strong formal underpinnings really helps validate that a given aspect of the language is well-designed.

So, what is a function in math?
It's a mapping between two [sets](https://en.wikipedia.org/wiki/Set_(mathematics%29)
that satisfies two conditions:

1. Each element of the first set
   (called the **domain**) is mapped to something in the second set
   (called the **codomain**) -- no element is "left out".
   This condition is called **totality**.
2. Each element of the domain is mapped to **exactly one** element of the codomain
   (never to zero elements, which is covered by totality already,
   but also not to more than one element).
   This condition is called **univalency** ("single-valueness").

Importantly, a function, while it "operates" on sets,
is also a set itself (in this case,
it is the set of [ordered pairs](https://en.wikipedia.org/wiki/Ordered_pair)
that define the mapping between the function's domain and codomain).
This trait is an important aspect of the composability of functions,
and allows higher-order functions --
functions that take as arguments, or return, other functions.

Now, this definition covers only functions that take a single argument.
However, I hope it's clear that it's easy to extend it to work for multiple arguments as well.
Let's say we have multiple sets `X1`, `X2`, ..., `XN` and `Y`,
and we want to define a function with `N` arguments that returns `Y`.
We can simply form a new set `X` that is the
[Cartesian product](https://en.wikipedia.org/wiki/Cartesian_product) of the `N` sets:
`X = X1 x X2 x ... x XN`, and say our "`N`-argument function" is from this new set `X` to `Y`.

The idea behind functional programming is to assemble your program from these functions.
Now, there is a conceptual difference between mathematical functions and programming language functions --
the latter involve **computation**.
In math, we can simply write `f: R -> R, f(x) = x * x`,
and that "magically" denotes an infinite set of pairs that map every real number to its square.
But in programming, when we write `f(2.3456)`, we don't immediately know what that "maps" to;
we need to calculate the square of `2.3456`,
using rules for multiplying floating point numbers,
and only then do we get a result.

However, that difference is mostly conceptual.
On some level, the fact that some computation is needed before producing a result doesn't really matter --
as long as the computation is deterministic,
and always produces the same result in a finite amount of time,
it's pretty much equivalent to the mathematical notion of the set of pairs.
In computer science, we don't really deal with infinity --
all programs are finite, and make a finite amount of computations before producing their result,
so we don't "need" functions to be infinite sets of pairs in the real world,
like they are in the mathematical world.

Since other programming languages also often use the term "function",
but in a less-precise way, we sometimes refer to these mathematical-like functions as
**pure functions**, to distinguish the two.

### Examples

Let's look at a few examples of different mappings between two sets,
and determine whether they are functions or not.

<img src="/img/fp/func-example-1.png" style="width: 50%">

In this function, the domain is a set of three characters (`A`, `2`, and `!`),
and the codomain is character type (`Letter`, `Digit`, and `Punctuation`).
The function maps each character from the domain to their type.

<img src="/img/fp/func-example-2.png" style="width: 50%">

In this function, the domain is a set of three numbers (`1`, `2`, and `3`),
while the codomain is their sign (which can be `Negative`, `Zero`, or `Positive`).
This function maps all three numbers from the domain to `Positive`,
since they are all greater than zero.
This still conforms to the definition of a function:
there are no requirements that every element of the codomain must be used in a mapping,
or that different elements of the domain must map to different elements of the codomain.

<img src="/img/fp/func-example-3.png" style="width: 50%">

This example shows a non-function, since we can't map `Prolog` to its type,
because the codomain is missing `Logical` programming languages.
All elements of the domain must be mapped to something in the codomain,
so this mapping violates the totality condition from above,
and thus is not a proper function.

<img src="/img/fp/func-example-4.png" style="width: 50%">

This example is also not a function.
It maps the numbers `1`, `1/2` and `e` to numerical sets they belong to
(`Integers`, `Rationals` and `Reals`).
The problem is that `Integers` are a subset of `Rationals`
(every integer is also a rational),
and `Rationals` are a subset of `Reals`.
So, `1` would have to map to all 3 sets,
and `1/2` would have to map to `Rationals` and `Reals`.
This violates the univalency condition,
and thus this mapping is also not a function.

<img src="/img/fp/func-example-5.png" style="width: 50%">

This is an example of a "two-argument" function,
representing simple addition of integers.
We have two input sets, `X1 = {1, 2}` and `X2 = {4, 7}`.
The "two-argument" function is not from the elements of either `X1`
or `X2` to `Y`, but instead from the elements of the
[Cartesian product](https://en.wikipedia.org/wiki/Cartesian_product) of `X1` and `X2`,
which is `{ (1, 4), (1, 7), (2, 4), (2, 7) }`
(I'm using `(a, b)` to denote an
[ordered pair of elements](https://en.wikipedia.org/wiki/Ordered_pair),
since the [accepted way of expressing that with sets](https://en.wikipedia.org/wiki/Ordered_pair#Kuratowski's_definition),
which is written as `{ {a}, {a, b} }`,
can be a little hard to read).
Since the function represents addition,
we map `(1, 4)` to `5`, `(1, 7)` to `8`,
`(2, 4)` to `6`, and `(2, 7)` to `9`.
The set that is this function can be written out as:
`{ ((1, 4), 5), ((1, 7), 8), ((2, 4), 6), ((2, 7), 9) }`.

## Advantages of functional programming

So, we've arrived at a formal definition of a function.
But how does that help us with creating a programming language?

The crucial aspect of these "pure functions"
is that they naturally compose.
If you have two functions with compatible domains and codomains,
`f: X -> Y` and `g: Y -> Z`,
you can immediately define a third function,
`h: X -> Z, h(x) = g(f(x))`.
So, any function you define can be composed with any other function,
including any built-in ones provided by the language,
to create new functions.

Why is this a good way to assemble programs?
Because it forces you to use a single tool -- function composition --
for everything in your program,
which has a certain elegance and regularity that is missing from imperative programming languages.
This allows you to code at a higher-level --
you don't have to be concerned with the minutia of how the concepts you're using
(like sets and functions) are implemented,
but can instead describe what the program needs to accomplish at a high level
(that's why functional programming belongs to the declarative family of languages),
using strictly functions and (immutable) sets and function composition,
and the language's compiler and runtime will convert that high-level description
into the low-level code that computers need to execute your program.

Compare that to a typical imperative language like Java.
Let's say you want to express the behavior of updating a field of a class.
To make the example concrete, let's say we want to double the value of a field called `f`
of type `int` in a class called `C`.

There are many different ways to express that in Java:

1. It can be an instance method on the `C` class:

   ```java
   class C {
       int f;

       void doubleF() {
           this.f *= 2;
       }
   }
   ```

2. It can be a static method of the `C` class,
   that takes an instance of `C` as the argument:

   ```java
   class C {
       static void doubleF(C c) {
           c.f *= 2;
       }
   
       int f;
   }
   ```

3. It can be a static method of a different class than `C`,
   but in the same package as `C`, so it still has access to `f`:

   ```java
   class InSamePackageAsC {
       static void doubleF(C c) {
           c.f *= 2;
       }
   }
   ```

4. It can be a static method of a different class that is in a different package than `C`,
   so it doesn't have direct access to `f`,
   but `C` defines `public` getters and setters for `f`:

   ```java
   class InDifferentPackageThanC {
       static void doubleF(C c) {
           c.setF(c.getF() * 2);
       }
   }
   ```

5. It can be a static method of a different class that is in a different package than `C`,
   but `C` is immutable, and defines a [`with`-style](https://projectlombok.org/features/With)
   setter for `f` that returns a new instance of `C` with `f` changed:

   ```java
   class InDifferentPackageThanC {
       static C doubleF(C c) {
           return c.withF(c.getF() * 2);
       }
   }
   ```

6. It can be an instance method of `C`,
   but `C` is immutable, and the implementation uses the `with`-style setter:

   ```java
   class C {
       final int f;
   
       // constructor and withF() method...
   
       C doubleF() {
           return this.withF(this.f * 2);
       }
   }
   ```

This is a very simple example (`doubleF` doesn't even take any arguments),
but we already have 6 different ways this simple functionality can be expressed in the language,
and you can argue that the first 4 options that return `void`
can be further split into even more sub-options,
based on the different potential return types
(should `doubleF` return the new value of `f`, or the instance of `C` that was changed,
or something else?).

You can say that my list is silly,
because there's an obvious solution out of the 6 options,
which you would always choose.
But what if other code you need to interact with,
like a library that is your dependency,
has a different opinion on the matter?
The wide variety of options to express the same thing means you need to be aware of all the language features that make these options possible,
since you might be forced to work with an API that uses completely different idioms than what your own code would choose.

## Features of functional programming languages

So far, we have focused mainly on the mathematical underpinnings of functional programming.
But how does that impact the actual features of a functional language?

As is often the case, being a functional language is not a black and white distinction,
but rather a spectrum.
As functional programming has become more and more popular over the years,
many ideas from those languages have been incorporated into imperative languages as different features.

I would describe the "functionalness" of a language as a series of levels,
each level requiring the previous one.
What level a given language achieves can be thought of as their "functional score";
the higher the score, the more functional a given language is.

### Level 1: Functions as first-class values

On the basic level, for a language to be considered at least a little bit functional,
it needs to support functions as first-class values.
This means that functions should be treated similarly to other built-in primitive types like
booleans, integers, or strings.

Practically, it means that functions need to satisfy a few conditions to be considered first-class in a given language:

1. Functions can be passed to other functions as arguments.
2. Functions can be returned from other functions.
3. The language has function literals (similarly to number or string literals),
   often called lambda expressions, or anonymous functions.

Today, almost all languages, including imperative ones,
support all 3 of the above features.
Java was the lone exception for a long time,
but it finally got lambda expressions with Java 8,
released in 2014.

### Level 2: Immutability

The next level after functions as first-class values is immutability.

In the mathematical definition of functions,
there is no notion of mutation:
you can form new sets, but you cannot change the existing ones,
or their elements, in any way.

Eliminating mutation greatly simplifies the mathematical model of sets and functions,
and this simplification also extends to programming languages.
Not having to think about values changing during the execution of your program eliminates an entire big class of state management-related bugs.
The downside is a potential performance penalty in cases where mutation would be preferable,
but functional programming languages deliberately make this tradeoff,
and favor the correctness benefits over the possible performance penalty.
That's why they are generally not a good fit for cases where there is a lot of state,
and performance is critical, such as games, simulations, or neural networks.

Because of these performance concerns,
the support for immutability,
unlike first-class functions,
which have become a pretty much universally accepted feature in languages,
including imperative ones,
is much more varied.
In Rust, for instance, immutability is the default.
Java has pretty excellent support for immutability,
with its `final` keyword that can be applied to variables,
fields, and classes, but mutability is still the default.
But other modern imperative languages, like Go,
have no support for immutability.

### Level 3: Purity

Mutability is a special-case of a more general concept: **side effects**.
The idea of side effects is that a given piece of code,
like a function, is executed not for the value it computes,
but to perform some action that has an effect on the rest of the program.
Examples of these actions can be mutating a variable or a value,
but there are many other effects,
like: reading a file,
writing to the console,
performing an HTTP request, etc.
In general, any input/output operation,
like reading from or writing to a socket, is a side effect.

In imperative languages,
side effects are typically represented by functions that return `void`.
Functions that are executed primarily for their side effects are sometimes called **procedures**,
although this term is not widely used.

The idea behind purity is to completely disallow code that performs side-effects.
A purely functional language will only allow defining and calling functions that compute values,
and using those returned values, without ever performing any side effects.

You might be surprised: is that even possible?
How do you read files or write to the console with only pure functions?
The answer to this question is a fascinating topic,
and we will explore it in detail in later parts of this series.

While first-class functions and immutability are common features,
purity is the ["Great Filter"](https://en.wikipedia.org/wiki/Great_Filter)
of programming languages,
in the sense that only a few of them support this level,
since it forces the language to take a pretty radical shape
(at least compared to imperative languages).
Many languages that are definitely considered functional,
like [OCaml](https://ocaml.org) or [Clojure](https://clojure.org), are not pure.
Some examples of purely functional languages are,
most famously, [Haskell](https://www.haskell.org),
but also [PureScript](https://www.purescript.org)
and [Elm](https://elm-lang.org).

### Level 4: Default laziness

While you might think purity is already the most radical idea you can imagine having in a language,
there is one more functional level that purity enables,
and that is **default laziness**.

To understand laziness, let's first explore its inverse,
which is typically called **eagerness**.

In most programming languages,
if you have a complex expression that involves a function call,
like `f(g(x), h(y))`, you expect the arguments to `f`
to be evaluated before `f` is called.
So, the order of execution of the functions in the above code in an eager language would be:
`g`, `h`, and then finally `f`.

However, imagine that `f` was a function that didn't always need both of its arguments to return a value.
For example, if `f` was the [exponentiation function](https://en.wikipedia.org/wiki/Exponentiation),
it could first check its second argument, the exponent: if it's equal to zero,
we don't even care about the first argument, we can just return `1` immediately.
So, the code for `exponentiation` could look something like:

```ts
function exponentiation(base: number, exponent: number): number {
    if (exponent == 0) {
        return 1;
    }
    // remainder of the function logic here...
}
```

Now, in an eager language, if we called `exponentation(g(x), 0)`,
the `g(x)` function would still be called,
even though it's technically not needed to return `1` from that function.
All imperative languages are eager.

However, lazy languages change that behavior,
and only evaluate expressions that are explicitly used.
So, in the above `exponentation(g(x), 0)` code,
`g(x)` would never be called, since it's not needed to return `1`.

Lazy languages achieve this by representing expressions not as intermediate values,
but by [thunks](https://en.wikipedia.org/wiki/Thunk) --
special objects that encapsulate delayed computations,
and only execute the calculations when their value is explicitly requested.

Note that purity is an essential prerequisite for laziness,
because, if a language allows side effects in functions,
laziness changes the semantics of the code.
Imagine if `g` was defined as:

```ts
function g(x: number): number {
    console.log("g function called with argument:", x);
    return x * Math.sqrt(x);
}
```

If we did not execute `g(x)` in `exponentation(g(x), 0)`,
the side effect of printing to the console would also not be executed
(or could be executed in a different order compared to where it appears in the code,
based on when the values produced by the side effects are first used,
which would be confusing).
That's why laziness only really makes sense in a pure language,
when we know `g` can only compute its return value,
and cannot perform any side effects.

While laziness is a powerful concept that allows writing some interesting and elegant code
(for example, laziness allows defining "infinite" data structures,
since only a finite number of their elements will ever be requested,
and the remaining ones can be represented by a thunk that will never be evaluated,
like this "infinite" list of [Fibonacci](https://en.wikipedia.org/wiki/Fibonacci_number)
numbers: `fibs = 0 : 1 : zipWith (+) fibs (tail fibs)`),
it also has some [non-intuitive consequences on the performance and memory usage](https://stackoverflow.com/a/24705697)
of code that uses it.
Because of that, laziness is even rarer than purity;
[Haskell](https://www.haskell.org) is the only non-research language I know of that is lazy by default.

In our hypothetical language that we'll be designing in this article series,
we will make laziness easy to use, but not the default;
users will have to explicitly signal that a given variable or function parameter is lazily evaluated.

## Summary

So, those are the basic features of functional programming languages.

In the next part of the series,
we will start building the universe of sets that allow us to define these functions:
the primitive data types provided by our programming language,
and the operations that can be performed on them.
