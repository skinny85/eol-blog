---
id: 29
layout: article.html
title: The Type-Safe Builder pattern in Java, and the Jilt library
summary: "The Builder pattern is one of the most commonly
	used design patterns when programming in Java. In this article,
	I want to talk about a variation of that pattern called the
	Type-Safe (also known as Staged, or Telescopic) Builder, and
	present an annotation processing library I created that aids
	with implementing it, called Jilt."
created_at: 2017-06-30
---

The Builder pattern is one of the most widely employed patterns from the original ['Gang of Four'](https://en.wikipedia.org/wiki/Design_Patterns) design patterns book. It's particularly prevalent in Java, most likely because that language lacks the named and optional parameters features. In this article, I'll quickly introduce the pattern for those unfamiliar with it, and also discuss what are its limitations, and how those limitations can be overcome by using a variant of the pattern called the Type-Safe (or Staged, or Telescopic) Builder. I'll also present [Jilt](https://github.com/skinny85/jilt), a Java annotation processor library I developed that was specifically designed to help with implementing this pattern.

This article is quite long and contains a fair amount of code, so I've created a [GitHub repository](https://github.com/skinny85/type-safe-builder-example) with the complete code shown in the examples below - use it if you want to follow along, or if some snippet doesn't make sense without the larger context.

## What is the Builder pattern?

Say you have a class `User` in your Java system. It has 5 properties: `email`, `username`, `firstName`, `lastName` and `displayName`, all of type `String`. It's a Value class: it doesn't have much behavior, its main function is to aggregate the 5 properties. Something like this:

```
public class User {
	private String email, username, firstName, lastName, displayName;

	// rest of the class omitted for now...
}
```

While this class is quite simple, there is already an interesting question concerning its design: what API will we present to clients for creating instances of this class?

In the early days of Java, we would probably use the JavaBeans convention: the class would have a public no-argument constructor, and the values of the properties would be assigned with setters:

```
User user = new User();
user.setEmail("joey@example.com");
user.setUsername("john_smith");
user.setFirstName("John");
user.setLastName("Smith");
user.setDisplayName("joey");
```

But that's not the way we write Java code today. It's verbose, introduces state where there shouldn't be any, and doesn't leverage the type system in any sensible way - for example, if we forgot to set the `email` property, we wouldn't get any warning from the compiler about that fact.

Modern Java style prefers immutable objects, so our `User` class would most likely look something like this:

```
public final class User {
	// I'm using public fields for brevity
	public final String email, username, firstName, lastName, displayName;

	public User(String email, String username, String firstName,
			String lastName, String displayName) {
		this.email = email;
		this.username = username;
		this.firstName = firstName;
		this.lastName = lastName;
		this.displayName = displayName;
	}
}
```

And you would create instances of it using the constructor:

```
User user = new User("joey@example.com",
	"john_smith", "John", "Smith", "joey");
```

This approach is fine, but not perfect. For one thing, we don't see the property names anymore. That hurts readability and, more importantly, makes the code error prone - for example, if we forget the order of the parameters, we can easily switch `email` and `username` around by mistake, and we'll have a pretty subtle bug on our hands. Another thing is that it's typical to keep the number of method (including constructors) parameters fairly low. Five is already kind of stretching it, and if the class were to get many new properties in the future, things would get quite cumbersome with the constructor.

The Builder pattern is the typical solution to these problems. You can think of it as separating out the concern of constructing a class from the class itself. We define a new class, called `UserBuilder`, whose sole responsibility is to help us create instances of `User`. It will have an instance field for each field of `User`, and a public setter for each of those fields. After setting the values of the properties, we obtain an instance of `User` by invoking the `build` method on the Builder. It looks like this:

```
public class UserBuilder {
	private String email, username, firstName, lastName, displayName;

	public UserBuilder email(String email) {
		this.email = email;
		return this;
	}

	// rest of the setters are analogous...

	public User build() {
		return new User(email, username, firstName, lastName, displayName);
	}
}
```

(Full code: [here](https://github.com/skinny85/type-safe-builder-example/tree/master/01-classic-user-builder))

Notice that, unlike with JavaBeans, each setter returns `this` - the method receiver. This is an example of a [Fluent Interface](https://martinfowler.com/bliki/FluentInterface.html), and allows you to chain the setter methods without the verbosity of constantly repeating the receiver:

```
User user = new UserBuilder()
	.email("joey@example.com")
	.username("john_smith")
	.firstName("John")
	.lastName("Smith")
	.displayName("joey")
	.build();
```

You can also make `UserBuilder` a (static) nested class inside `User`. When doing it that way, you can make the `User` constructor private (because of the way access modifiers work in Java, `UserBuilder` will still be able to invoke it), and this way enforce that creating instances of `User` is only possible through `UserBuilder`.

Another common thing is to add a static factory method to the Builder, with a name usually equal to the uncapitalized name of the built class:

```
public class UserBuilder {
	public static UserBuilder user() {
		return new UserBuilder();
	}

	// rest of the class is the same as above...
}
```

This, combined with Java's static imports feature, allows you to write nice reading code like this:

```
import static com.example.UserBuilder.user;

User user = user()
	.email("joey@example.com")
	.username("john_smith")
	.firstName("John")
	.lastName("Smith")
	.displayName("joey")
	.build();
```

## Builder limitations

So, that's the Builder pattern in a nutshell. While it fixes some of the problems with using a pure constructor approach, it's not perfect.

The main problem is that we lose the compile-time guarantee that we had with the constructor that all of the fields will have a value provided. Sure, when the built class has 5 properties, like `User` above, it's not hard to spot if we miss one. But imagine you want to build an instance of this class:

```
public final class AgreementVersion {
	private final String marketplaceId;
	private final Customer customer;
	private final Supplier supplier;
	private final String createdBy;
	private final LocalDate startDate;
	private final String supplierContact;
	private final String description;
	private final String id;
	private final String agreementId;
	private final int versionNumber;
	private final LocalDate createdDate;
	private final LocalDateTime updatedTime;
	private final AgreementVersionStatus versionStatus;
	private final Map<String, String> priceSheetResources;
	private final boolean isVendorReviewed;
	private final boolean isCustomerReviewed;
	private final boolean hasWarnings;

	// constructors, getters, equals & hashCode etc.
}
```

This is a (slightly abridged) actual class from a project I was involved in recently. To save you some counting, it has a whooping 17 properties. Imagine trying to use a Builder for that class - just making sure you have all 17 of the properties set would be quite a challenge, especially if you're unfamiliar with this class.

So, it seems like we're not there yet. We want the nice fluent DSL of a Builder, but with the compile-time guarantees that constructor instantiation provides, and we want it to scale to any number of properties. Can we have our cake, and eat it too?

## Type-Safe Builder

This is exactly what the Type-Safe Builder pattern variant tries to accomplish. The idea is to leverage Java's type system to make sure (at compile time) that all of the properties are set before the instance of the built class is constructed.

The way to do that is to create an interface for each property of the built class (it's typical to make them inner interfaces of some grouping interface to avoid polluting the global namespace too much). Each of those interfaces will have just one method - the setter for that particular property. The return type of that method will be the interface for the next property, forming a chain. There will also be one extra interface at the end - this one will contain the final `build` method.

For example, for the `AgreementVersion` class above, it would look like this:

```
public interface AgreementVersionBuilders {
	public interface MarketplaceId {
		public Customer marketplaceId(String marketplaceId);
	}

	public interface Customer {
		public Supplier customer(Customer customer); 
	}

	// remaining properties...

	public interface HasWarnings {
		public Build hasWarnings(boolean hasWarnings);
	}

	public interface Build {
		public AgreementVersion build();
	}
}
```

Now, the Builder class itself is very similar to the "classic" Builder. The main difference is that it implements all of those interfaces above, and so the setters have a different declared type - although the implementation is the same. For our `AgreementVersion` case, it looks like this:

```
public class AgreementVersionBuilder implements
		AgreementVersionBuilders.MarketplaceId,
		AgreementVersionBuilders.Customer,
		// ...
		AgreementVersionBuilders.HasWarnings,
		AgreementVersionBuilders.Build {
	private String marketplaceId;
	private Customer customer;
	// ...
	private boolean hasWarnings;

	@Override
	public AgreementVersionBuilders.Customer marketplaceId(String marketplaceId) {
		this.marketplaceId = marketplaceId;
		return this;
	}

	@Override
	public AgreementVersionBuilders.Supplier customer(Customer customer) {
		this.customer = customer;
		return this;
	}

	// ...

	@Override
	public AgreementVersionBuilders.Build hasWarnings(boolean hasWarnings) {
		this.hasWarnings = hasWarnings;
		return this;
	}

	@Override
	public AgreementVersion build() {
		return new AgreementVersion(marketplaceId, customer,
			/* ... */, hasWarnings);
	}
}
```

There is one more detail. We want the customers of the Builder to use our interfaces, not the concrete Builder class - without that, we will not get any help from the type system. To achieve that, we make the constructor of the Builder private, and have a static factory method that returns an instance of it - its declared type, however, is the interface for the first property of the built class. So, for `AgreementVersionBuilder`:

```
public class AgreementVersionBuilder implements
		/* interfaces as above... */ {
	public static AgreementVersionBuilders.MarketplaceId agreementVersion() {
		return new AgreementVersionBuilder();
	}

	private AgreementVersionBuilder() {
	}

	// rest of the class as listed above
}
```

(Full code: [here](https://github.com/skinny85/type-safe-builder-example/tree/master/02-type-safe-agreement-version-builder))

Now, using this Builder is pretty much identical to the classic one (with the only difference being you have to use the static factory method, not the constructor):

```
AgreementVersion av = AgreementVersionBuilder.agreementVersion()
	.marketplaceId("...")
	.customer(someCustomer)
	// ...
	.hasWarnings(false)
	.build();
```

However, note one very important thing. Because we're operating on the interface types, not the concrete Builder type, there is no way for use to skip setting some property (or even change the order in which they are set). If we comment out any of the setter lines above, the code will stop compiling. The type system prevents us from forgetting to initialize any of the properties. This is especially powerful when using an IDE for development - its AutoComplete will suggest the correct property to set at any point, which means it's not necessary to remember the exact order of the properties.

So, we have achieved our goal - we have a fluent Builder DSL, but with compile-time guarantees that all of the properties of the built class will be set before creating an instance of that class. This is what the Type-Safe Builder pattern allows you to achieve.

## Optional properties

But that is not all. The Type-Safe Builder is extremely useful when dealing with classes that have optional properties.

When I say "optional properties", I mean properties that the client can, but doesn't have to, provide in order to construct a valid instance of the target class - they might have a default, they can be optional etc.

Optional properties are very difficult to express solely with constructors, for two reasons. First, because of the combinatorial explosion of the numbers of constructor overloads that you need. For example, if you have a class with six properties, three of which are optional, you would need a total of 8 constructors:

* 1 with all 6 parameters
* 1 with 3 parameters (skipping all of the optional ones)
* 3 with 5 parameters (skipping one of the optional properties each)
* 3 with 4 parameters (providing one of the optional properties each)

That's a huge number of constructors for a small class! Imagine you had the `AgreementVersion` class above with 17 properties, half of which were optional.

There is also the second, even bigger, problem. If at least 2 of those optional properties have the same type, you cannot actually express the various options using constructor overloading. The signature of the constructors would be the same, and that would violate Java overloading rules. So, you have to resort to using static factory methods, and then you get into problems with how to name them, etc. - it becomes a mess very quickly.

The Type-Safe Builder pattern allows you to express optional properties in a very elegant way.

As an example, let's get back to the `User` class from the beginning of the article. Let's say that the `username` and `displayName` properties are now optional - if the client doesn't provide an explicit `username`, we will use the email address in its place, and if `displayName` is skipped, we'll set it to `firstName` concatenated with `lastName` (with a space in between). So, the class now looks like this:

```
public final class User {
	// Once again, we use public fields instead of getters for brevity
	public final String email, username, firstName, lastName, displayName;

	public User(String email, String username, String firstName,
			String lastName, String displayName) {
		this.email = requireNonNull(email);
		this.username = username == null ? email : username;
		this.firstName = requireNonNull(firstName);
		this.lastName = requireNonNull(lastName);
		this.displayName = displayName == null
			? firstName + " " + lastName
			: displayName;
    }
}
```

A Type-Safe Builder for a class with optional properties is only slightly modified compared to those we already saw above. The difference is that the setters for the optional properties don't have their own interfaces, but are instead grouped together in the last interface (the one containing the `build` method). This allows you to set them or not, depending on what you want to achieve, after all of the required properties have already been set.

For our `User` above, it looks as follows:

```
public interface UserBuilders {
    interface Email {
        FirstName email(String email);
    }

    interface FirstName {
        LastName firstName(String firstName);
    }

    interface LastName {
        Build lastName(String lastName);
    }

    interface Build {
        Build username(String username);
        Build displayName(String displayName);
        User build();
    }
}
```

The `UserBuilder` itself is unchanged (minus the slightly modified signatures of the optional setter methods). You can use it as follows:

```
User user = UserBuilder.user()
    .email("joey@example.com")  // these 3 lines are mandatory (required properties)
    .firstName("John")
    .lastName("Smith")
//  .username(null) // these 2 lines can be commented out...
    .displayName(null) //...or not (optional properties)
    .build();
```

(Full code: [here](https://github.com/skinny85/type-safe-builder-example/tree/master/03-type-safe-user-builder-optional-props))

This way, we have embedded the knowledge which properties of the class are required, and which are optional, directly into the type system. The compiler prevents us (and, more importantly, other users of our classes) from ever getting this distinction wrong.

## The Jilt library

So, this is all great. We have leveraged Java's type system, and came up with safe, discoverable APIs to create instances of our classes. There is only one small wrinkle: achieving all of this takes a lot of boring, practically boilerplate code. And this is where Jilt enters the picture.

Jilt is an open source library I developed to help with implementing the Builder pattern. You'll find it on GitHub:

<p style="text-align: center;">
[https://github.com/skinny85/jilt](https://github.com/skinny85/jilt)
</p>

Jilt is a Java annotation processor that generates the class or classes needed to implement the Builder pattern at compile time. It supports both the classic, and the Type-Safe variants of the pattern.

I won't repeat the documentation found under the link above on how to use Jilt. Instead, I want to demonstrate how easy Jilt makes it to implement all of the examples I've used thus far in the article.

The classic Builder for the `User` with all 5 properties being required:

```
import org.jilt.Builder;

@Builder
public final class User {
	// rest of the code same as above...
}
```

The Type-Safe Builder for the `AgreementVersion` class:

```
import org.jilt.Builder;
import org.jilt.BuilderStyle;

@Builder(style = BuilderStyle.TYPE_SAFE)
public final class AgreementVersion {
	// rest of the code same as above...
}
```

The Type-Safe Builder for the `User` class with 2 optional properties:

```
import org.jilt.Builder;
import org.jilt.BuilderStyle;
import org.jilt.Opt;

public final class User {
    public final String email, username, firstName, lastName, displayName;

    @Builder(style = BuilderStyle.TYPE_SAFE)
    public User(String email, @Opt String username, String firstName,
                String lastName, @Opt String displayName) {
		// rest of the code same as above...
    }
}
```

(Full code: [here](https://github.com/skinny85/type-safe-builder-example/tree/master/04-jilt-builders))

As you can see, adding a couple of annotations is enough for Jilt to generate all of the code you need to implement the Builder pattern for you, without any repetitiveness or boilerplate. If that sounds interesting, please check out the [project's GitHub page](https://github.com/skinny85/jilt) for the full documentation on how to use Jilt.

## Summary

And so, this is the Type-Safe Builder pattern variant. Do you think it's useful? What is your opinion on automatically generating code for it with Jilt? I would love to hear from you in the comments section below.
