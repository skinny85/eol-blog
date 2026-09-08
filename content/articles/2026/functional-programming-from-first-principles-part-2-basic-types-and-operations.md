---
id: 88
layout: article.html
title: Functional programming from first principles, part 2 – basic types and operations
summary: |
   In this part of the series,
   we learn about the built-in types that are
   needed in functional programming languages,
   and the pre-defined operations you can perform on them,
   including built-in functions invocation.
created_at: 2026-08-31
---

Now that we know the motivation behind functional programming,
let's start our exploration of coding in that style.
And to start coding, we need to have some basic types available.

Types in our programming language correspond to sets in the mathematical definition of functions.
So, to form our functions, we first need some sets!
This part of the series is where we start building our collection of them.

## Booleans

The simplest widely-used set in programming is the set of
[Boolean](https://en.wikipedia.org/wiki/Boolean_data_type) values.

Many imperative programming languages call this type `boolean`,
and make that a keyword.
But there's no reason it has to be one,
and we want to keep the set of keywords of our functional language to the minimum.
In addition, functional languages like consistency,
as we discussed in the previous part of the series,
and user-defined types are typically spelled starting with an uppercase letter in basically every language.
To maintain consistency, we want to spell built-in types with uppercase too.
In addition, we want to shorten the name,
the same way most languages have the `int` type instead of `integer`.
For all these reasons, we'll call this type `Bool`.

`Bool` has exactly two elements, `true` and `false`,
which we want to have available in any context without the need for any qualifications or imports,
so we do make those two keywords.
Some programming language spell them as `True` and `False`,
because Booleans can be expressed as an algebraic data type --
a topic we'll discuss in the next part of the series --
and thus don't have to be a keyword,
but we'll stick to the more common convention in our hypothetical language,
to make it more familiar to imperative programmers.

For the same familiarity reasons,
we'll have the typical C-based language built-in operations on Booleans:
`!` for negation, `||` for disjunction,
and `&&` for conjunction.

Some simple examples of Boolean expressions:

```js
!false // results in true
true && false // results in false
true || false // results in true
```

As can be seen above, we'll also follow C's convention for comments,
and use `//` to denote a line comment.

## Numbers

Numbers are more complicated in programming languages than in math,
because they need to deal with the details of how they are represented in a computer's finite memory.

Functional languages don't really differ in the requirements for numbers from imperative languages.
So, in our new language, we'll use a number scheme similar to other languages from the C family,
just making sure their naming conventions follow the same rules as `Bool` above:

- `Int` will represent 32-bit signed integers
- `Long` will represent 64-bit signed integers
- `Byte` will represent 8 bits (only used for dealing with binary data)
- `Float` will represent 32-bit floating point numbers
- `Double` will represent 64-bit floating point numbers

For numeric literals, we again won't do anything different from a C-like imperative language.
We'll support the common modern feature of allowing `_` between digits to make the final number easier to read
(so, you can write `1_000` to mean the same as `1000`,
similarly like we often write "1,000" for larger numbers in prose).
The default integer literal will mean the `Int` type,
and you can change it to `Long` with an `L` suffix
(`Byte` will use the typical ["implicit narrowing conversion"](https://docs.oracle.com/javase/specs/jls/se10/html/jls-5.html)
that other languages allow).
We allow hexagonal literals with the `0x` prefix,
and binary with `0b`
(but we skip the legacy feature of octal literals with a leading `0`).
The default floating point literal is `Double`,
but you can change it to `Float` with an `F` suffix.

We have the typical numerical operations:
`+` for addition, `-` for subtraction,
`*` for multiplication, `/` for division,
and `%` for modulo (remainder) division,
and also the standard comparison operators
(`==`, `!=`, `>`, `>=`, `<`, `<=`).

Some simple examples of numeric expressions:

```c
1 + 2 == 3
1.5 - 2.75 == -1.25
0x1_000L == 16 * 0x10 * 0b10_000L
```

## Characters

Another of the built-in simple types is a single character of a string.
Similarly to many other languages,
our new hypothetical language will use single quotes to denote character literals.
We'll call the type `Char`, to go along with the theme of shortening the type names.
We'll also allow using
[Unicode code points](/emoji-how-do-they-work#unicode) in the character literals:

```c
'A' == 'U+0041'
```

## Strings

Strings are the most complex built-in data type.
Our new hypothetical language will denote string literals by enclosing a sequence of characters in double quotes,
like in basically all other languages.

Strings typically provide concatenation as the only built-in operation.
Imperative languages typically re-use the `+` operator for concatenation,
while functional languages like to use a different operator for concatenation,
mostly for better type inference.
However, we'll just use `+` in our example language,
to make it more familiar for programmers coming from imperative languages.

We'll also support [string interpolation](https://en.wikipedia.org/wiki/String_interpolation),
where you can put code inside `${}` in the string literal,
and it will be evaluated, and inserted into the final string:

```kotlin
"80" + "'s" == "80's"
"1 + 2 is ${1 + 2}" == "1 + 2 is 3"
```

We'll call the type of strings `Str`,
analogous to `Int` and `Bool`.

## Unit

And finally, the last of the built-in simple types is a type with only a single value.
In functional languages, it's typically called "unit",
but the name of the type is denoted by an empty pair of parenthesis (`()`),
and that's also the same way to write the only value of that type,
which is confusingly also called "unit".

I actually never liked this convention,
and always thought it's needlessly contrived.
So, in our hypothetical language,
we'll use `Void` as the name of this single-element type,
and the `void` keyword to denote the only value of that type.
This makes it similar to imperative languages,
and better conveys this type's special role in the language.
It's rare to use the unit value directly anyway, as we'll see later in the series,
so I'm not too worried about changing the meaning of `void` from a type to a value.

## Function invocation

So, we have our collection of primitive types,
built into the language: Booleans,
numeric types, characters, strings, and unit.

While there are a few built-in operators for manipulating Booleans and numbers,
the remaining types typically require invoking built-in functions to achieve anything non-trivial with them
(with string concatenation being the lone exception).
Because of that, we need to specify how the syntax for function invocation works in our hypothetical language,
even though we're still very early in its design.

There are generally two approaches to the syntax of function invocations.
For imperative languages, you invoke a function by first having an expression that results in a function
(in the simplest case -- just the function's name), followed by parenthesis,
and then putting the arguments of the invocation inside the parenthesis,
separated by commas:

```js
functionName(1, 2.0, "a" + "bc")
```

However, functional languages typically have a different syntax,
more similar to how argument passing works in [Bash](https://stackoverflow.com/a/6212408):
the function expression (again, just its name in the simplest case) comes first,
and then the arguments, without any separation between them other than whitespace:

```haskell
functionName 1 2.0 ("a" + "bc")
```

Note that we need the parenthesis for that last argument,
since function invocation binds stronger than addition or concatenation in this syntax,
so without the parenthesis, the above expression would be equivalent to
`(functionName 1 2.0 "a") + "bc"`.

There are two main advantages of this syntax.
The first one is that function invocation is,
obviously, extremely common in functional programming languages.
So, the less syntax invocation has, the more succinct functional programs become.

The second one is how functional programming languages deal with multi-argument functions.
Instead of using the trick we described in [part 1](/functional-programming-from-first-principles-part-1-motivation)
with Cartesian products, they instead make all functions one-argument,
and a "multi-argument" function is a composition of one-argument functions that return other functions.

For example, if we had a simple `add` function that takes two integers and returns an integer,
functional languages would represent it as a function that takes a single integer argument,
and returns another function; that other function also takes a single integer argument, and returns an integer.
This concept is called [**currying**](https://en.wikipedia.org/wiki/Currying).

So, in Haskell, if we have:

```haskell
add :: Int -> Int -> Int
add x y = x + y
```

Even though `add` declares it takes two parameters,
you can invoke `add` with one argument,
and it's not an error;
that expression simply returns the "other" function from above,
that takes one integer and returns an integer.

So, `add 1 2` could also be written as `(add 1) 2`,
or even with an intermediate variable,
so something like `let addOne = add 1 in addOne 2`.
This feature is called **partial application**.

And while it's an interesting feature,
in our example language, we won't support it.
Beyond being very different from how functions work in imperative languages,
we want to express multi-argument functions with Cartesian products,
like we explained in [part 1](/functional-programming-from-first-principles-part-1-motivation),
which I think is considerably simpler than currying.
Partial application also makes error messages less clear,
and it can be easily replicated with [anonymous functions](https://wiki.haskell.org/Anonymous_function):
`add 1` is the same as `\x -> add 1 x`.
In fact, the anonymous function form is more general,
because it doesn't care about the order of the arguments in the function
(for example, using it, you can define a partial application of the second argument of a function,
not only the first: `\y -> someFunction y 2`).

Since we won't be supporting partial application,
we'll use the imperative notation for function invocation (with parenthesis)
in our hypothetical language,
mainly because my aim is to present functional ideas in a way that is as familiar to programmers using imperative languages as possible.
This is not that controversial of a choice;
many languages that are definitely considered functional,
like [Roc](https://www.roc-lang.org) or [Elixir](https://elixir-lang.org),
follow the same pattern.

## Modules

To make sure the built-in functions don't have to all live in one global namespace,
we will introduce the notion of _modules_ to our hypothetical language,
which for now will be simply containers of functions.
You access functions in a module with a period operator (`.`),
similarly to how object-oriented languages express access to class members.
Each of the built-in types will also have a module with the same name
that contains functions related to manipulating values of that type.

For example, to take a substring of a string,
you would invoke the `subStr` function from the `Str` module:

```js
Str.subStr("defragmentation", 2, 10) == "fragment"
```

We won't bother cataloging all available built-in functions;
we'll just assume we have the obvious ones present in other languages available,
and just use them, like we did with `subStr` above.

## Nested invocations

One thing that is not particularly easy
(in either the imperative or functional invocation syntax)
is chaining multiple invocations that operate on the results of the previous invocations.

For example, if we wanted to take a sub-string of a given string,
then reverse it, and then finally change it to all uppercase,
it would look something like:

```js
Str.toUpperCase(Str.reverse(Str.subStr("defragmentation", 2, 10))) == "TNEMGARF"
```

There are two possible solutions to this problem:
one is [uniform function call syntax](https://en.wikipedia.org/wiki/Uniform_function_call_syntax),
and the other is the [pipeline operator](https://batsov.com/articles/2025/05/22/the-origin-of-the-pipeline-operator).

In our hypothetical language, we will choose uniform function call syntax,
since it's more similar to how methods are invoked in object-oriented languages.
So, we can re-write the above expression to be more in an object-oriented style,
with the order of the functions in the program being the same as the order in which they will be invoked:

```js
"defragmentation"
    .subStr(2, 10)
    .reverse()
    .toUpperCase() == "TNEMGARF"
```

The above code is made possible by a simple rule:
a member of type `X` automatically changes expressions like
`x.f(a, b)` into `X.f(x, a, b)`,
where `X` is a module with the same name as the type of `x`.

Note that this is purely syntax sugar:
`Str.subStr` is not a method,
but a function that takes 3 arguments
(the first of type `Str`, the second and third of type `Int`),
and returns a value of type `Str`.

## Summary

So, these are the basic types that are needed for writing functional programs,
and the operations we can perform on them.

In the next part of the series,
we will see how can we create new types from these basic types,
and define new operations on them.
