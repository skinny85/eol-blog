---
id: 12
layout: article.html
title: Testing with Doubles, or why Mocks are Stupid - Part 1
summary: "This is Part 1 of a four-part article series about using Test Doubles
	(Mocks, Stubs, Spies etc.) in unit tests. Part 1 defines the concept of a
	Test Double and talks about their various types."
created_at: 2015-11-10
---

[Part 2](/testing-with-doubles-or-why-mocks-are-stupid-part-2) | [Part 3](/testing-with-doubles-or-why-mocks-are-stupid-part-3) | [Part 4](/testing-with-doubles-or-why-mocks-are-stupid-part-4)

Test Doubles (Mocks, Stubs, Fakes etc.), are an essential tool when writing unit tests. Their purpose is to be substituted for dependencies of the class or classes under test which are, for some reason, inconvenient to use in tests (exactly like a stunt double is substituted for a regular actor during dangerous scenes). There are basically two situations when that might be needed:

1.  The dependency is or uses an entity external to the code itself. E-mail services are a canonical example - we don't want to send out real e-mails every time we run our tests! Dependencies that use a database are another common one - we probably don't want to connect to a real database somewhere in our unit tests, as that would make them dependent on that database's state. And what if the DB is down, for some reason, or the network has a failure? These kind of concerns are usually the domain of integration or end-to-end, not unit tests (note, however, that in the particular case of databases, there are solutions that let you control them from your unit tests - in-memory databases like H2 come to mind as one example).
2.  The real dependency is slow or unreliable (for example, it depends on some state of the local filesystem). Of course, "slow" is subjective, so it's hard to come up with any definite rules for this case. For instance, there are schools of testing that say any dependency that does any I/O (even if it's all done locally) should automatically be substituted with a Test Double in unit tests - but this is a rather extreme view, and not one that is widely accepted.

Given the importance of the concept and how often it's employed, there is a large number of misconceptions around Test Doubles. Number one on that list is confusion about what exactly are the different kinds of them (Mocks, Stubs, Fakes etc.), and how do they differ from each other. I think it stems in large part from the fact that in Java-land, all of them can be created using one, very popular, library: [Mockito](http://mockito.org/), which of course means they are all called Mocks, regardless of their actual type.

If this was just a naming problem, then it really wouldn't be that big of a deal; however, this confusion often results in the incorrect usage of the various flavors of Test Doubles, which leads to verbose, brittle and generally low-quality tests.

In this article series, I hope to clear up all the confusion. In this first part, we'll go through each type of Test Double, explaining what purpose they are meant to serve in unit tests and showing concrete code examples. In the [second](/testing-with-doubles-or-why-mocks-are-stupid-part-2) and [third](/testing-with-doubles-or-why-mocks-are-stupid-part-3) parts, we'll discuss the use cases which lend themselves to using each type of Test Double. And [finally](/testing-with-doubles-or-why-mocks-are-stupid-part-4), we'll talk a little about the downsides of Test Doubles, and what dangers using (and over-using) them pose to your tests.

## The various types of Test Doubles

The first thing that I would recommend you do is read Martin Fowler's great [Mocks Aren't Stubs](http://martinfowler.com/articles/mocksArentStubs.html) article, if you don't know it already. It's a little dated (no wonder, since it's from 2007), but it's still a great and very important read.

After you're done with that, we'll discuss what are the commonly encountered types of Test Doubles.

#### Dummy

A **Dummy** is the simplest Test Double that there is. It's only purpose is to satisfy the compiler of a statically-typed language - it's not meant to be actually used, only passed around. A straightforward example of a Dummy in Java could be:

```
public class DummyEmailService implements EmailService {
	@Override
	public void sendEmail(Message message) {
		throw new AssertionError(
			format("DummyEmailService.sendEmail(%s)", message));
	}
}
```

Obviously, a Dummy can only be used if the code paths exercised by the test don't call methods on it. The trouble is, to know that you actually have to look at the implementation of the class or classes that you're testing, which breaks encapsulation. This is actually a weakness shared by all Test Doubles (to various degrees), and a topic we'll be coming back to multiple times in these articles.

#### Mock

A **Mock** is an object which records the methods called on it, and allows later verification that the recorded calls match some criteria, such as: the order of calls, their number, the values of parameters, and the absence of any unexpected calls. This way of asserting is called **behavior verification**, which means checking the correctness of a class through analyzing its interactions - in contrast to **state verification**, which uses the object's state to achieve that.

If you wanted to write a Mock in Java yourself, it would look something like this:

```
public class MockEmailService implements EmailService {
	private int calledCount = 0;
	private Message lastMessage;

	@Override
	public void sendEmail(Message message) {
		calledCount++;
		lastMessage = message;
	}

	public void verifyWasCalledOnceWith(Message message) {
		assertEquals(format("Expected to be called once but was called %d times", calledCount),
			1, calledCount);
		assertEquals(lastMessage, message);
	}
}
```

Just looking at this simple example makes it clear that writing Mocks from scratch would require a considerable effort and a lot of repetitive, boiler-platey code. For this reason, nobody really does it this way, instead relying on mocking libraries. These libraries often generate synthetic objects (that is, ones not belonging to any compile-time class), which save you the hassle of needing to write any code whatsoever to use them. Like I already mentioned, in the Java world, the most popular solution seems to be [Mockito](http://mockito.org/) - probably thanks to it's concise, fluent and easy to use API. The equivalent functionality to our Java class above would look something like this inside a test:

```
public class SomeTestClass {
	@Test
	public void someTest() {
		// set up the mock
		EmailService mockEmailService = mock(EmailService.class);

		// use the mock in the test...

		// verification
		verify(mockEmailService, times(1)).sendEmail(eq(expectedMessage));
		verifyNoMoreInteractions(mockEmailService);
	}
}
```

I think Mockito is one of the better examples of what a modern, carefully crafted Java API can look like. It's really a joy to use - if you aren't already familiar with it, I highly recommend you give it a try. As you can see, we need only a few lines of code to simulate what we previously achieved with a custom, test-only Java class, and this shorter code actually gives us a lot more powerful verification and matching capabilities (have a look in the [Mockito documentation](http://mockito.github.io/mockito/docs/current/org/mockito/Mockito.html) for some examples of exactly how powerful it is).

#### Stub

A **Stub** is also an artificial object - one which is pre-programmed to respond to a method call in a particular way (for example, to always return the same value, or to throw an exception when called with a particular argument). Here's an example of a Stub in Java:

```
public class StubHttpRequest implements HttpServletRequest {
	private final String key, val;

	public StubHttpRequest(String key, String val) {
		this.key = key;
		this.val = val;
	}

	@Override
	public Map getParameterMap() {
		return ImmutableMap.of(key, new String[]{val});
	}

	// rest of the class skipped...
}
```

This Stub allows you to set a particular key-value pair as the (sole) contents of a `Map` returned by the `getParameterMap()` method of `HttpServletRequest`. It can be handy when unit testing some servlet.

And here we come to the confusing part - because Mockito, which is clearly a mocking library (I mean, it's even in the name), can be used to create Stubs as well:

```
HttpServletRequest reqStub = mock(HttpServletRequest.class);
when(reqStub.getParameterMap()).thenReturn(ImmutableMap.of(key, new String[]{val}));
```

Obviously, since it's Mockito, the syntax is readable and lightweight. Still, in some situations, writing a class might be preferable, especially if there's a lot of stubbing required, and the stub is reused a lot.

#### Fake

A **Fake** is an actual implementation of a dependency, but one specifically designed to be used only for tests, not in production code. Martin in his article gives as an example a [Repository](http://dddcommunity.org/resources/ddd_terms/) that works with an in-memory database. I personally don't love that example, as the actual database used by a Repository sounds more like a configuration option than a public characteristic of a class to me. However, I would give a very similar example, one I actually used myself several times before: a Repository that uses a `Map` to store and retrieve Entities, without a database. It looks something like this:

```
class MapUserRepository implements UserRepository {
	private final Map<Long, User> store = new HashMap<>();
	private long sequenceId = 0;

	@Override
	public User find(long id) throws NoSuchUser {
		User user = store.get(id);
		if (user == null)
			throw new NoSuchUser(id);
		return user;
	}

	@Override
	public long addUser(String email, int age) throws DuplicateEmail {
		if (store.values().stream().anyMatch(u -> checkNotNull(email).equals(u.getEmail())))
			throw new DuplicateEmail(email);

		store.put(++sequenceId, new User(email, age));

		return sequenceId;
	}

	// ...
	// whatever else you need
}
```

As you can see, this class has some actual logic embedded inside it. This is a very important trait of a Fake, and one that clearly distinguishes it from dumb Mocks and Stubs. The implementation might be simple, but it actually is a fully-fledged and correct `UserRepository` from the API standpoint. For example, it throws `NoSuchUser` when you query for a non-existant `id`, or does not allow storing Users with duplicate emails. Because of this, you can't really replicate it with Mockito - this is code you actually have to write. Keep this in mind, as it's an important point that we will come back to later.

#### Spy

A **Spy** is a wrapper around the real object, which either adds some behaviors useful in tests, or allows you to override only part of the object's original definition (in contrast to the other Doubles, which always replace the original object completely). They are used when you need to have the actual dependency present (a common use case is writing tests for legacy code, which you can't or don't want to change), but augmented in some way. A simple example in Java:

```
public class SpyEmailService implements EmailService {
	private final EmailService delegate;
	private int count;

	public SpyEmailService(EmailService emailService) {
		delegate = emailService;
	}

	@Override
	public void sendEmail(Message message) {
		count++;
		delegate.sendEmail(message);
	}

	public int count() {
		return count;
	}
}
```

You can also create Spies with Mockito:

```
EmailService spyEmailService = spy(realEmailService);
```

Spies are a lot more common in dynamic languages, like JavaScript. This is also another source of terminology confusion, as some JavaScript testing libraries (ekhm, Jasmine, ekhm) use the term Spy to refer to any Test Double - in particular, what we here call Mocks.

As Spies use the real dependency underneath, their usage is fairly specialized, and so I won't focus on them too much in these articles.

## End of Part 1

That's all for the introduction and presenting the Test Double types. In [Parts 2](/testing-with-doubles-or-why-mocks-are-stupid-part-2) and [3](/testing-with-doubles-or-why-mocks-are-stupid-part-3), we'll look at what kind of tests lend themselves to using each of those Test Double variants.

[Part 2](/testing-with-doubles-or-why-mocks-are-stupid-part-2) | [Part 3](/testing-with-doubles-or-why-mocks-are-stupid-part-3) | [Part 4](/testing-with-doubles-or-why-mocks-are-stupid-part-4)
