---
id: 37
layout: article.html
title: Spring best practices
summary: "
	In the wake of Netflix' announcement that they are standardizing on Spring Boot as their microservice framework of choice,
	I thought it would be interesting to share some best practices that I personally discovered through many years of hands-on experience with Java's premiere application framework."
created_at: 2019-01-13
---

Recently, Netflix blogged that it's adopting [Spring Boot as their officially recommended JVM application framework](https://medium.com/netflix-techblog/netflix-oss-and-spring-boot-coming-full-circle-4855947713a0).
To commemorate the occasion,
I wanted to provide some tips on using Spring that I learned the hard way during my tenure working with the framework.

Spring sometimes gets flak from the developer community.
People complain that it's bloated,
they make fun of classes like [AbstractSingletonProxyFactoryBean](https://twitter.com/hashtag/abstractsingletonproxyfactorybean), etc.
However, I think a lot of the criticisms it receives don't make it justice.
True, it is big.
But understand that the project was first released in 2003,
and so it's more than natural that it accrued some cruft in that long time.
In fact, considering its age, I would say it's in remarkably good shape!
I don't think we use many frameworks to this day that were first released in 2003.
I think a crucial factor in maintaining this health is the quality of its code, which is legendary.
If you're looking for an example of a great Java codebase to study,
you can't do much better than Spring.
Its documentation has also always been top notch.

Spring's emergence as an alternative to Java Enterprise Edition was a monumental event,
and I strongly believe it was one of the factors that made Java so dominant in server-side web programming.
But on the flip side,
this amount of attention always comes with a lot of pressure,
and groups lobbying to add features to the project important to them,
without always considering their impact on the framework as a whole.
And because of Spring's admirable commitment to preserving backwards compatibility,
once a feature has landed,
it's generally supported for all eternity,
which increases the project's size.

But don't worry!
If you use the below tips,
you should be able to leverage the strengths of the framework,
while at the same time avoiding its historical sharp edges.

Without further ado, on with the tips!

## 1. DO NOT: use Spring's XML Bean definition support

Spring is famous for allowing you to define your dependencies in XML.
However, I would recommend against using this functionality.
Its flaws include:

* XML is known to be verbose, and Spring's Bean dialect is no exception to that rule.
  In larger projects, the configuration file has a tendency to quickly balloon in size to thousands of lines.
* XML is opaque, unlike programming language code --
  it cannot be discovered in any other way than reading the appropriate documentation.
  Quick test -- do you remember from memory all of the
  [namespace declarations](https://docs.spring.io/spring/docs/3.0.x/spring-framework-reference/html/xsd-config.html)
  that are required to be included in the root element?
  Yeah, me neither.
* Also unlike a programming language, it doesn't have a type system,
  which means all mistakes that you make setting up your dependencies will only be discovered at runtime,
  when the Spring container attempts to start,
  which is a relatively slow operation.
  This lengthens the feedback loop considerably,
  especially for someone just starting with Spring.

XML made sense as a configuration mechanism in 2003,
when Java was on version 1.4,
and we didn't have either generics or annotations in the language.
But in 2019, there really is no reason to use it anymore.

"But Adam", you might say, "I actually like the XML config!
It makes my code more modular!", like [this commenter on Reddit](https://www.reddit.com/r/programming/comments/a7nggt/netflix_standardizes_on_spring_boot_as_java/ec5j79y/).
And I agree with you completely!
But XML is not the way to accomplish that.
The way is actually to...

## 2. DO: use Spring's Java configuration

Instead of XML,
you should be using [Spring's support for expressing configuration in Java](https://docs.spring.io/spring/docs/3.0.0.M4/reference/html/ch03s11.html).
Both have the same capabilities,
but the Java functionality solves all of the above issues with XML:
it's more concise
(yes, XML is actually the one thing that is more verbose than Java),
it's a real programming language,
so you can use things like variables, methods, etc.
to reduce duplication and make your config more readable,
and finally, the type system helps make to sure your configuration is correct,
and aids with refactoring.

Here's how configuration in Java looks like:

```java
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ExampleConfig {
    // You can use all of the standard DI annotations inside this class.
    @Autowired
    private SomeClass someClass;
    
    // This is the definition of a Bean of type AnotherClass.
    // As shown, method arguments are another way to pass in dependencies.
    @Bean
    public AnotherClass anotherClass(SomeClass someClass) {
        return new AnotherClass(someClass);
    }

    // Other definitions...
}
```

But using Spring's Java config is just one part of the equation.
The other is making sure you structure your non-config classes in the correct way.
Which leads me to my third tip:

## 3. DO NOT: use Spring inside your domain classes

One crucial mistake that I see a lot of people making is structuring their business logic classes in a way that makes them depend on Spring.
A common way to introduce that sort of dependency is by using annotations like
`@Component`, `@Autowired`, `@Service`, etc.

Why is this bad?
Well, it goes back to what we discussed above,
about writing modular code.
You don't want your domain-specific classes to know anything about Spring --
they should work the same,
regardless of which dependency injection container you're using.
Not following this rule leads to classes that are too big,
and mix different concerns,
like business logic and Inversion of Control configuration.

There's no need for that.
You business logic class should just declare the dependencies they need,
and the configuration of the container should take care of wiring them all up,
like we saw above.

So, instead of `AnotherClass` looking like this:

```java
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class AnotherClass {
	@Autowired
	private SomeClass someClass;

	// Logic using SomeClass...
}
```

...make it just a regular Java class that doesn't know anything about Spring:

```java
public final class AnotherClass {
	private final SomeClass someClass;

	public AnotherClass(SomeClass someClass) {
		this.someClass = someClass;
	}

	// Logic using SomeClass...
}
```

and only worry where to get an instance of `SomeClass` inside your config class.

This point also has a corollary:

## 4. DO NOT: use entire classpath scanning

Spring can scan all classes in your application to discover Beans
(like the version of `AnotherClass` above annotated with `@Component`)
automatically.
I would strongly advise against using this functionality.
First of all, classpath scanning is an expensive operation,
which negatively affects your application's startup time.
But even worse, it introduces what in programming is sometimes called "spooky action at a distance".
For instance, you can add a new dependency to your project,
and, without any actual code change,
your application might no longer start,
because of a conflicting Bean definition --
or, even worse, it will start,
but its behavior will now change,
because a different implementation of some Bean will be injected.

I hope I don't have to explain why this isn't a great place to be.
I think making your dependencies explicit,
while incurring a small verbosity cost up front,
pays dividends later on,
especially that diagnosing dependency injection failures is famously difficult and time consuming,
orders of magnitude longer than that initial upfront cost.

## 5. DO: use things like @Autowired in Spring-specific classes

Now, you might read my above advice as "Just never use `@Autowired`, ever".
But that's not what I'm saying at all!
Annotations like `@Autowired` do have their place --
I've even included one in the example configuration class above.
My point was to keep it out of your *business logic* classes.
But a `@Configuration` class is not a business logic class --
it's something intrinsically tied to Spring,
so it makes perfect sense to use all of the available Spring features when dealing with it.

Another example where this often comes up are Spring web MVC Controller classes.
I sometimes see code reviews where people advise using `javax.inject.@Inject` instead of `@Autowired` in Controller classes,
because the former is part of a standard,
while the latter is Spring-specific.
That makes no sense!
The Controller class is already Spring-specific,
using annotations like `@Controller`, `@RequestMapping`, etc.
If you wanted to move to a different framework,
you would have to rewrite it anyway,
so using `@Inject` over `@Autowired` doesn't have any advantages there.

So, when writing Spring-specific classes like configuration or web MVC Controllers,
feel free to use the whole gamut of Spring features,
including things like `@Resource`, `@Autowired`, etc.
I'm even OK with using classpath scanning to discover the Controller classes,
so you don't need the boilerplate of including them in you configurations,
but I would limit the scanning to a well-defined set of packages that the Controllers live in,
which doesn't include your business logic code.

## 6. DO: use Spring Test

Spring has a fantastic module called `spring-test` that allows you to easily integration test virtually all Spring-specific parts of your application.
Using it, you can do things like stand up your IoC container to make sure the configuration is correct,
substitute using a production SQL database with an in-memory one without changing your application code,
send requests to your web MVC Controllers,
and much more.

Check out the [Spring documentation on testing](https://docs.spring.io/spring/docs/current/spring-framework-reference/testing.html)
for details.
I would strongly suggest always using this package when dealing with Spring in your application.

## Summary

So, a TL;DR version of the tips is:

* Use Spring's Java configuration instead of XML.
* Only depend on Spring features like `@Autowired` and classpath scanning in Spring-specific classes like web MVC Controllers,
  never in your business logic code.
* Always use `spring-test` in tandem with Spring in your production code.

Do you agree with these tips?
Do you feel like I left out any important best practices?
Let me know in the comments below!
