---
id: 36
layout: article.html
title: Evolving public APIs based on Type-Safe Builders
summary: "
	The Type-Safe Builder pattern is well understood when used within the confines of a single project.
	But what happens when you expose it as part of the public API of your module -
	how do you handle that API's evolution over time?
	This article covers that topic in great depth."
created_at: 2018-11-17
---

I've written about the
[Type-Safe Builder pattern variant](/type-safe-builder-pattern-in-java-and-the-jilt-library)
(sometimes also called the Staged, or Telescopic, or Step Builder) before on this blog.
The [TL;DR](https://www.urbandictionary.com/define.php?term=TL%3BDR%3A)
is that it's a modified version of the well-know
[Builder design pattern](https://en.wikipedia.org/wiki/Builder_pattern)
that uses the type system to ensure,
at compile time,
that an instance of a class cannot be constructed before a value has been provided for all of its required properties.

Today, I want to tackle the problem of evolving Type-Safe Builder APIs while preserving backwards compatibility.
As is commonly the case when discussing these Builders,
there is quite a lot of code involved,
and in the article I'm showing only a small part of it,
for brevity.
The [full code is on GitHub](https://github.com/skinny85/future-proof-step-builder) if you want to check it out.

## Problem statement

Discussions of using the Type-Safe Builder pattern are most commonly restricted to the Builder class being utilized only within the confines of a single project.
In that context, the type-system guarantees it provides also double as a safety net when evolving the code with time.
So, for example, if we introduce a breaking change to how a class is supposed to be constructed
(let's say, we remove a previously required property),
the compiler will help us by reporting every place in our project which constructs the class incorrectly -
exactly like it does with other breaking changes,
like adding a new argument to an existing method.
That is great, and one of the reasons for using this pattern.

However, the focus shifts if we decide to use a Type-Safe Builder as part of the public API of code that we distribute to others, like a library.
In that situation, breaking changes  become rare,
restricted to [major version bumps](https://semver.org/#spec-item-8)
of the library;
instead, the main concern becomes how to safely release changes that do preserve backwards compatibility.

In the domain that Type-Safe Builders operate in,
there are 2 categories of these backwards-compatible changes we commonly encounter:

1. Adding a new, optional, property to a class.
2. Changing a required property of a class to an optional one.

(**Note**: we don't concern ourselves with adding a new required property,
or changing an optional property to required,
or removing a property (optional or required) here -
all of these are examples of non-backwards compatible changes,
and using the Builder pattern cannot change that.)

How does the Type-Safe Builder handle these 2 categories of evolution?
Well, the first one is easy -- the new optional property will be added to the last interface,
the one that contains setters for all of the existing optional properties
(and the `build` method), so we're good there.
The second one, however, is more problematic.
Because the Type-Safe Builder fixes the order of the required properties,
we cannot suddenly move them to this last interface with the `build` method,
as that would make all of the existing code setting it earlier not compile anymore.
For example, if we look at how is the Type-Safe Builder for the `User` class from the
[previous article](/type-safe-builder-pattern-in-java-and-the-jilt-library#optional-properties) used:

```java
User user = UserBuilder.user()
    .email("joey@example.com")  // required
    .firstName("John") // required
    .lastName("Smith") // required
    .build();
```

It's pretty clear we can't make the `email` property optional -
if we made that change, the above code would no longer compile,
as the call to `email("joey@example.com")` would have to come after the last required property (`lastName` in this case) has been set.

Interestingly, the `TYPE_SAFE_UNGROUPED_OPTIONALS` [Type-Safe Builder style from the Jilt library](https://github.com/skinny85/jilt#type-safe-with-ungrouped-optionals-style)
actually does handle this case!
If you change `email` to optional when using that style,
the above code would still compile.
It supports adding a new optional property (point #1 above) as well.

So, are we done?
Is the answer simply: "use the `TYPE_SAFE_UNGROUPED_OPTIONALS` style"
for public-facing APIs?
Not quite.

The issue is that this solution is still very rigid when it comes to the order of the properties.
Continuing the example from above,
after changing `email` to optional,
that property can only be set as the first one in the Builder.
If you don't set it as the first one,
you won't have another chance to do it -
`email` will always be `null` then.

Why is that a problem?
Well, there are some natural orderings between some sets of properties -
`firstName` -> `lastName`, `createDate` -> `updateDate` -> `deleteDate`,
`initialBalance` -> `endingBalance`, etc.
In all those cases, you can reasonably expect your customers to have an intuition on the order they need to provide the properties in.
Even in the `User` example above,
the `email` -> `username` -> `firstName` -> `lastName` -> `displayName` order seems fine -
maybe not obvious, but at least reasonable.

However, there are many classes for which there is no intuitive order you can specify their properties in.
If you have a class with properties `apple`, `banana`, `strawberry`,
there is no obvious order you can impose on them that will be clear to the clients of your Builder.
If you have a class with 10, or 15, or more properties
(and these are the kind of classes for which Builders make the most sense),
it seems very unlikely the clients of your API will figure out the correct order for such a large set of properties.

What is more, even if you *do* have a natural ordering between the properties of your class,
you might not want to enforce it.
For example, let's say you're vending a library that is a client for a service you own,
and you decide to use Type-Safe Builders for the library's API.
Furthermore, let's assume you're not writing the client by hand,
but automatically generating it from some service description format,
like a ~~Swagger~~[Open API](https://www.openapis.org/) specification.
In this kind of situation,
you definitely don't want to fix the order of the properties to be the same as the order of the declarations in the specification -
somebody updating the specification in the future will not expect the order of the declarations to matter,
and basing your public API on that order will make it extremely fragile.

In those cases, the `TYPE_SAFE_UNGROUPED_OPTIONALS` style is too restricting.

## Achieving order independence

So, to sum up what we want to achieve:
we want a Type-Safe Builder that allows evolving the API by adding new optional properties
and changing required ones to optional,
while not setting in stone the order of the properties.
How might a Builder like that look?

The key are the intermediate interfaces used to force all of the required properties to be provided before constructing an instance of the target class.
In the previously discussed Type-Safe Builders,
they are very simple -
there is an interface for each required property of the class
(the `TYPE_SAFE_UNGROUPED_OPTIONALS` style has an interface for each optional property as well),
and then a final interface containing the `build` method.

If we want achieve order independence,
our interfaces need to be more sophisticated than that.
Instead of each corresponding to a single property,
they now need to encode in themselves a state,
specifying how many of the required properties were provided up to this point.
Let's name those interfaces `B_x_y_Interf`,
where 'x_y' is a sequence of numbers denoting how many required properties have already been provided
(for example, `B_2_Interf` means only the second required property has been provided,
and `B_1_2_3_Interf` means the first 3 required properties have been provided).
Because we don't care about the order the required properties were given in
(for example, it's the same for us whether the first property was provided after the second,
or the second after the first),
only that they were given,
we'll always write the sequence as sorted, ascending
(so, we'll never have `B_2_1_Interf` -- only ever `B_1_2_Interf`).

How do we move between the interfaces?
In the previous Builders,
it was obvious -- each property interface was followed by the next property's interface,
forming a linear chain.
Here, though, things get a little more complicated.

The interfaces form a small [finite state machine](https://en.wikipedia.org/wiki/Finite-state_machine).
Each interface contains a setter for every property,
both required and optional
(we cannot treat the two differently,
as that would make it impossible to achieve order independence,
like we've seen for the "traditional" Type-Safe Builders).
The setters differ in their return types.
When providing a required property that we haven't seen yet,
we transition to a new state -
we add a new number to our sequence.
For example, if we're in `B_1_Interf`,
and we call the setter for the second required property,
it will have the return type `B_1_2_Interf`.
However, in `B_1_Interf`,
the return type of the setter for the first required property,
and for every optional property,
will be simply `B_1_Interf` again,
as providing these do not advance us closer to our goal of having all required properties provided.

We also need 2 more states -- the initial state,
let's call it `StarterBuilderInterf`,
where 0 required properties were so far provided,
and the final interface,
let's call it `FinalBuilderInterf`,
where all of the required properties have been provided.
This is the one (and only one) interface that will contain the `build` method.

To make it a little less abstract,
here's a visualization of the state machine for a Builder with 3 required properties:

<img src="/assets/builders-state-machine.jpg" style="width: 50%">

The numbers next to the arrows indicate setting which required property results in the given transition.

Finally, here's how it looks like in code.
We are using the class mentioned above,
`User`, from the [first article](/type-safe-builder-pattern-in-java-and-the-jilt-library).
To recap, it has 5 properties, all Strings;
3 of them -- `email`, `firstName` and `lastName` -- are required,
while 2 -- `username` and `displayName` -- are optional.

```java
interface StarterBuilderInterf {
    B_1_Interf email(String email);
    B_2_Interf firstName(String firstName);
    B_3_Interf lastName(String lastName);
    StarterBuilderInterf username(String username);
    StarterBuilderInterf displayName(String displayName);
}

interface B_1_Interf {
    B_1_Interf email(String email);
    B_1_2_Interf firstName(String firstName);
    B_1_3_Interf lastName(String lastName);
    B_1_Interf username(String username);
    B_1_Interf displayName(String displayName);
}

interface B_2_Interf {
    B_1_2_Interf email(String email);
    B_2_Interf firstName(String firstName);
    B_2_3_Interf lastName(String lastName);
    B_2_Interf username(String username);
    B_2_Interf displayName(String displayName);
}

interface B_3_Interf {
    B_1_3_Interf email(String email);
    B_2_3_Interf firstName(String firstName);
    B_3_Interf lastName(String lastName);
    B_3_Interf username(String username);
    B_3_Interf displayName(String displayName);
}

interface B_1_2_Interf {
    B_1_2_Interf email(String email);
    B_1_2_Interf firstName(String firstName);
    FinalBuilderInterf lastName(String lastName);
    B_1_2_Interf username(String username);
    B_1_2_Interf displayName(String displayName);
}

interface B_1_3_Interf {
    B_1_3_Interf email(String email);
    FinalBuilderInterf firstName(String firstName);
    B_1_3_Interf lastName(String lastName);
    B_1_3_Interf username(String username);
    B_1_3_Interf displayName(String displayName);
}

interface B_2_3_Interf {
    FinalBuilderInterf email(String email);
    B_2_3_Interf firstName(String firstName);
    B_2_3_Interf lastName(String lastName);
    B_2_3_Interf username(String username);
    B_2_3_Interf displayName(String displayName);
}

interface FinalBuilderInterf {
    FinalBuilderInterf email(String email);
    FinalBuilderInterf firstName(String firstName);
    FinalBuilderInterf lastName(String lastName);
    FinalBuilderInterf username(String username);
    FinalBuilderInterf displayName(String displayName);
    User build();
}
```

(Full code [here](https://github.com/skinny85/future-proof-step-builder/blob/master/src/main/java/three_required_props/interfaces_variant/UserBuilderInterfaces.java))

I hope you can see how this fulfills our original requirements for backwards-compatible evolution.
Adding a new optional property does not change the interface layout -
it simply adds a new setter to each interface,
with the return type of that setter being always just the interface the setter is declared in,
like it is for `username` and `displayName` above.

Changing a required property to optional *does* change the interface layout,
but since every interface contains setters for all optional properties,
this change cannot break existing code.

## Builder class trick

Now, there is an interesting problem that comes up when you actually try to implement these interfaces in your Builder class.
If you just try to go:

```java
public class UserBuilder implements
		StarterBuilderInterf,
		B_1_Interf,
		B_2_Interf,
		B_3_Interf,
		B_1_2_Interf,
		B_1_3_Interf,
		B_2_3_Interf,
		FinalBuilderInterf {
	// ...
}
```

you'll actually get an error from the compiler.
It will say that the declarations of the setter methods clash with each other.
And it's right! If you look at `email(String email)` in `StarterBuilderInterf`,
it returns `B_1_Interf`;
but `email(String email)` from `B_2_Interf` returns `B_1_2_Interf`, a different type,
and it's no wonder the compiler doesn't know how to reconcile the two.

That seems pretty dire.
Does that mean we need a separate implementing class for each of those interfaces?
That would be quite cumbersome,
not to mention very inefficient,
as we would need to create a new class instance every time a required property was provided the first time.

Fortunately, there is a way out of this.
The trick is to leverage the fact that starting in Java 6,
method overrides [are covariant in their return types](https://www.geeksforgeeks.org/covariant-return-types-java/).
Now, if we make the last interface, `FinalBuilderInterf`,
extend all of the remaining interfaces:

```java
interface FinalBuilderInterf extends
		StarterBuilderInterf,
		B_1_Interf,
		B_2_Interf,
		B_3_Interf,
		B_1_2_Interf,
		B_1_3_Interf,
		B_2_3_Interf {
	// actual code same as above...
}
```		

we can simply make `UserBuilder` implement only `FinalBuilderInterf`:

```java
public class UserBuilder implements FinalBuilderInterf {
	// ...

	public FinalBuilderInterf email(String email) {
		this.email = email;
		return this;
	}

	// other setters are analogous...
}
```

And everything compiles!

Of course, we use the same tricks to force our customers to go through the interface types instead of the concrete type:
we make the Builder constructor private,
and introduce a static factory method that returns `StarterBuilderInterf`:

```java
public class UserBuilder implements FinalBuilderInterf {
	public static StarterBuilderInterf user() {
		return new UserBuilder();
	}

	private UserBuilder() {
	}

	// ...
}
```

This typechecks, as a `FinalBuilderInterf` (which `UserBuilder` is) is also a `StarterBuilderInterf` (through interface inheritance).

Full code of the `UserBuilder` [can be found here](https://github.com/skinny85/future-proof-step-builder/blob/master/src/main/java/three_required_props/interfaces_variant/UserBuilder.java).

## Interfaces overload

So, this is great -- we've achieved our objective of Type-Safety
(we cannot call `build` until all of the required properties have been set)
while making it possible to evolve the built class in a backwards-compatible way.
There is only one small wrinkle...

How many interfaces do you think this needs?

If we look at the diagram of the state machine for 3 required properties again:

<img src="/assets/builders-state-machine.jpg" style="width: 50%">

We can deduce it.
Let's say the target class has `n` required properties.
On each level, we need to maintain state that `k` required properties have been provided so far.
How many interfaces do we need for that?
I hope it's clear that the answer is [`n` choose `k`](https://en.wikipedia.org/wiki/Binomial_coefficient).
That's for a single level.
In total, we need a sum from `k=0` to `k=n` of `n choose k`.
The result of that sum is [2 to the power of `n`](https://en.wikipedia.org/wiki/Binomial_coefficient#Sums_of_the_binomial_coefficients).

That's not good news.
That means that using this method for a class with 6 required properties would require us to generate 64 interfaces!
That is a huge number of interfaces needed for a relatively small number of required properties.

Perhaps that's fine for your use case -
maybe your classes have very few required properties,
or the extra interfaces overhead doesn't seem like a problem.
If this sounds like a dealbreaker, however, don't worry -
there is a way to reduce this 2 to the power of `n` number to... simply 2.
That's right, regardless of how many required properties your target class has,
there is a way to ensure type-safety with just 2 extra interfaces.

Intrigued? Read on.

## Inlining the intermediate interfaces

So, how can we get rid of these intermediate interfaces?
There are 2 crucial observations we meed to make in order to achieve that.

The first one is noticing that all of the intermediate interfaces have exactly the same structure.
They return a specific type for each of the required property setters,
and always return the interface itself for each of the optional properties.
Example from above:

```java
interface B_1_Interf {
    B_1_Interf email(String email);
    B_1_2_Interf firstName(String firstName);
    B_1_3_Interf lastName(String lastName);
    B_1_Interf username(String username);
    B_1_Interf displayName(String displayName);
}

// ...

interface B_2_3_Interf {
    FinalBuilderInterf email(String email);
    B_2_3_Interf firstName(String firstName);
    B_2_3_Interf lastName(String lastName);
    B_2_3_Interf username(String username);
    B_2_3_Interf displayName(String displayName);
}
```

But this means we can use Java generics to get rid of the duplication.
We introduce a new interface with a type parameter for each required property of the built class.
It will indicate what type the given intermediate interface returns for that property's setter.
Continuing the example of the `User` Builder,
it looks like this:

```java
interface BuilderInterf<R1, R2, R3> {
    R1 email(String email);
    R2 firstName(String firstName);
    R3 lastName(String lastName);
    BuilderInterf<R1, R2, R3> username(String username);
    BuilderInterf<R1, R2, R3> displayName(String displayName);
}
```

Now, all of the intermediate interfaces can be expressed using this one interface,
like so:

```java
interface B_1_Interf extends BuilderInterf<
	B_1_Interf, B_1_2_Interf, B_1_3_Interf> {
}

// ...

interface B_2_3_Interf extends BuilderInterf<
	FinalBuilderInterf, B_2_3_Interf, B_2_3_Interf> {
}
```

The second crucial observation is that the intermediate interfaces are only ever used in the return type of the static factory method of the Builder class.
The Builder class itself only implements the `FinalBuilderInterf`,
and uses it as the return type for its setters,
so it doesn't care about the intermediate interfaces at all.

Since we have the generic `BuilderInterf` type now,
we can use the fact that Java's methods can also have type parameters,
and express each intermediate state in the finite state machine we previously used an interface for as a separate type parameter.

Let's see how this looks on our `User` example.
To comply with Java's conventions,
we'll use `T_x_y` as the name of the type parameter corresponding to the `B_x_y_Interf` interface.
We'll also use `T` as the actual return type,
corresponding to `StarterBuilderInterf`.
Of course, we keep `FinalBuilderInterf` as an interface
(we need to put the `build` method somewhere!).
So, we'll have:

```java
T extends BuilderInterf<T_1, T_2, T_3>
T_1 extends BuilderInterf<T_1, T_1_2, T_1_3>
T_2 extends BuilderInterf<T_1_2, T_2, T_2_3>
T_3 extends BuilderInterf<T_1_3, T_2_3, T_3>
T_1_2 extends BuilderInterf<T_1_2, T_1_2, FinalBuilderInterf>
T_1_3 extends BuilderInterf<T_1_3, FinalBuilderInterf, T_1_3>
T_2_3 extends BuilderInterf<FinalBuilderInterf, T_2_3, T_2_3>
```

So, the entire static factory method looks like the following:

```java
public class UserBuilder implements FinalBuilderInterf {
	@SuppressWarnings("unchecked")
	public static <
			T extends BuilderInterf<T_1, T_2, T_3>,
			T_1 extends BuilderInterf<T_1, T_1_2, T_1_3>,
			T_2 extends BuilderInterf<T_1_2, T_2, T_2_3>,
			T_3 extends BuilderInterf<T_1_3, T_2_3, T_3>,
			T_1_2 extends BuilderInterf<T_1_2, T_1_2, FinalBuilderInterf>,
			T_1_3 extends BuilderInterf<T_1_3, FinalBuilderInterf, T_1_3>,
			T_2_3 extends BuilderInterf<FinalBuilderInterf, T_2_3, T_2_3>
	> T user() {
		return (T) new UserBuilder();
	}

	// ...
}
```

Now tell me this isn't the craziest method signature in Java that you've ever seen!

But it all works.
We need an unchecked cast in there,
of course, as we're casting to a type parameter that only exists at compile time -
but we know it's correct from the way we've defined the other type parameters,
so we can safely suppress the warning.

Also, to make it typecheck,
we need to make `FinalBuilderInterf` extend `BuilderInterf`:

```java
interface FinalBuilderInterf extends BuilderInterf<
        FinalBuilderInterf, FinalBuilderInterf, FinalBuilderInterf> {
    FinalBuilderInterf username(String username);
    FinalBuilderInterf displayName(String displayName);
    User build();
}
```

(We need to also covariantly override the optional properties setters,
as otherwise calling them would move our `FinalBuilderInterf` back to the `BuilderInterf` type,
which doesn't contain the `build` method!)

We're taking advantage of Java's type inference for methods here,
which means when calling `UserBuilder.user()`,
you don't have to provide any of the crazy type variables we've defined -
the language will infer them for you.

Full code is [here](https://github.com/skinny85/future-proof-step-builder/tree/master/src/main/java/three_required_props/static_fact_meth_variant),
there are also some tests [here](https://github.com/skinny85/future-proof-step-builder/blob/master/src/test/java/three_required_props/static_fact_meth_variant/UserUsageTest.java)
if you want to play with the resulting Builder yourself.

## Trouble in Buildtown

So, did we solve it?
We have a way to represent a Type-Safe Builder that allows for backwards-compatible evolution of the built class' API,
and we only need 2 additional interfaces to enforce that type-safety.
Nothing left to do but pop the champagne,
and implement this new Builder style in the [Jilt library](https://github.com/skinny85/jilt), right?

Not so fast.
Presently, I decided to *not* include either of the styles described above in Jilt.
And the reason is that I have 2 issues with these Builders.

1.  Firstly, the customer experience of using them is not great.
    One of the strengths of Type-Safe Builders was always that they made it crystal clear to consumers of your API what is the minimal set of properties they are required to provide in order to instantiate your class.
    With these order-independent Builders,
    that strength is gone.
    If you have a class with 10 properties,
    but only 2 of them are required,
    your customers will not know which 2 are the required ones without looking at the documentation of the class.
    And if you're making your clients rely on the documentation,
    you might as well forgo Type-Safe Builders altogether,
    and just implement runtime checks that validate whether all of the required properties were set before calling `build`.

    Now, if you're willing to give up on some of the API evolution guarantees,
    there is a way to improve this.
    You simply remove the setters for the optional properties from all interfaces except `FinalBuilderInterf`.
    This no longer allows you to change a required property to optional
    (but adding a new optional property works fine).
    However, your clients experience improves considerably -
    they will immediately know which properties they have to provide
    (vs. which ones they *might* provide).

2.  Secondly, while it's true these Builders are backwards compatible,
    that guarantee only holds for complete expressions that result in an instance of the target class,
    not for the intermediate expressions that are part of constructing that instance.
    For example, take this expression from the `UserBuilder`:

    ```java
    B_1_Interf b = UserBuilder().user().email("email@example.com");
    ```

    Now, if we change `email` to be optional,
    the right-hand side of the assignment remains fine;
    the problem, however,
    is that the resulting type will change from `B_1_Interf` to `StarterBuilderInterf`,
    and the entire code will fail to compile!

    However, adding a new optional property does preserve backwards compatibility of even the intermediate expressions.
    Note that this is consistent with the "improve the client experience" plan from point #1 above.

    It's worth to point out that this flaw also affects the `TYPE_SAFE_UNGROUPED_OPTIONALS` Builder from Jilt -
    but in an opposite way!
    When introducing a new optional property,
    we need to create a new interface for it,
    and so change the return type of some the existing methods to this new interface,
    which of course has the potential to break things.
    But changing a property from required to optional simply adds more methods to the interface corresponding to that method,
    and so is fully backwards compatible.

    You might consider these musing to be stupid -
    who might be interested in using intermediate results of a Builder?
    But I don't agree.
    When exposing a public API,
    you really can't predict how your clients will use it.
    Perhaps they want to extract some common property setting logic to a method,
    to avoid duplication?
    That sounds perfectly reasonable to me,
    and breaking them with what we claim is a backwards-compatible change is unacceptable.

## Decision matrix

So, the situation is quite interesting.
We were unable to achieve the ideal of a Type-Safe Builder that allows perfect backwards-compatible evolution alongside its target class.
As is often the case in computer science,
we don't have a clear best solution -
just a number of choices with different tradeoffs.
A quick guideline summing up the possibilities could look something like this.

If you want to use Type-Safe Builders as part of a public API you are vending,
you have the following options:

* If you're fine with freezing the order of the required properties,
  and limiting the API evolution to only adding new optional properties
  (never changing a required property to optional),
  use the "standard" Type-Safe Builder
  (the `TYPE_SAFE` [style from Jilt](https://github.com/skinny85/jilt#type-safe-builders)).
* If you're fine with freezing the order of *all* properties
  (both required and optional),
  and limiting the API evolution to only changing required properties to optional
  (never adding new optional properties),
  use the `TYPE_SAFE_UNGROUPED_OPTIONALS` [style from Jilt](https://github.com/skinny85/jilt#type-safe-with-ungrouped-optionals-style).
* If you don't want to freeze the order of the properties,
  and you're OK with restricting the API evolution to only adding new optional properties
  (never changing a required property to optional),
  use one of the order-independent styles presented in this article.
  Consider enforcing providing all of the required properties before allowing to set the first optional property
  (in other words, only have the optional setters in the `FinalBuilderInterf` interface)
  to improve your API clients experience.
* If your use case is not covered by any of the above,
  it's most likely not a good fit for a Type-Safe Builder.
  Resort to providing your clients a classic Builder,
  with runtime validations that check whether all of the required properties were set before attempting to construct an instance.

## Summary

Uff. If this doesn't exhaust the topic of Type-Safe Builders,
I don't know what will!

I'm curious of your opinion on the subject.
What do you think of these order-independent Builders?
Are they worthy of getting a style in the [Jilt library](https://github.com/skinny85/jilt)?
If so, which ones?
The ones with the exponential number of interfaces,
or the ones with the weird static factory method return type?
Should the optional setters be in all interfaces,
or just the one with the `build` method?
Or should it be possible to express all 4 combinations in Jilt??
Let me know in the comments below!
