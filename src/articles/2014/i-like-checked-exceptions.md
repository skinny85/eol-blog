---
id: 2
layout: article.html
title: I like checked exceptions
summary: "
	What better way to kick off a blog than with some clickbait! 
	In this article I talk about how I'm the only person on this planet
	that likes the concept of Java's checked exceptions, and I'll try
	to convince you that I'm not an idiot because of that."
created_at: 2014-09-10
---

Imagine a place where an AA meeting may take place. A dimly-lit, dusty room, sort of like a basement. The only source of light is a naked light bulb hanging from the ceiling. The room contains a bunch of old, rickety chairs forming a large circle around the middle. One of the attendants slowly stands up and says, "Hi, my name is Adam, and I like Java's checked exception mechanism". Everybody responds with a slow "Hi, Adam", said in unison. The speaker slunks back in his chair.

This is kind of how I felt when I decided to write an article explaining my fondness for checked exceptions. Java has many faults, documented meticulously in numerous articles on the web, usually with titles like "Java is dead" or "Why Java sucks". Of all these faults, however, I always felt that the checked exceptions concept was the most universally condemned one. The others always seemed to have some, however small, savings grace (or at least a logical reason for their existence - usually found in the design decisions made in Java's early years or the philosophy of growth its maintainers have adapted), brought up in the resulting discussion by some vehement defender of the language. But in the case of checked exceptions, people usually just acknowledge they were a terrible idea and move on. No other similar (statically-typed, garbage-collected, with exceptions) language inspired, at least in some part, by Java - C#, Scala, Kotlin, probably others I'm forgetting right now - has this feature. In fact, the only other language that has anything similar that I've ever heard of is M#, Microsoft's research language marketed as "C# for systems programming". In light of this unanimous bashing, admitting you like checked exceptions is kind of like admitting in the 90's you liked the Backstreet Boys - something you might do in the privacy of your own home, but never in public. And yet, this is exactly what this article does (and yes, A. J. was my favorite).

So, what good can I possibly see in this God-forsaken language feature? Well, it can be summed up with one sentence:

> Checked exceptions provide another axis for the compiler
> to prove my program is correct on the type system level.

I will try to illustrate what I mean by that with an example. But first I just wanted to say that even though I like the general concept, I believe Java made some mistakes in the actual implementation of checked exceptions, and it is those mistakes that are the cause of so much grievance with the feature. I will address those mistakes later on.

## A use-case for checked exceptions

Imagine you're building a social network site (cause, you know, we can never have enough of those). No social site would be complete without "friending" people. Let's say you decided to model this with a business logic method like this:

```java
void becomeFriends(UserId user1, UserId user2);
```

This method ties the users denoted by `user1` and `user2` in a friend relationship inside the data model you decided to use for the application. That model might be implemented by a relational database like Postgres, or a graph database like Neo4J - those are implementation details. It might also do other things - for example, send an email to the inviter that the invitation has been accepted. The method's purpose is to encapsulate all of that to its clients.

What is interesting about this method is that there are multiple reasons it may fail. And I don't mean "fail" as in there was an error connecting to the database, but some required domain conditions may not be satisfied at the time it was called. Some examples are:

* one of the user accounts might have been removed in the mean time (for example, someone sent out a friend request, and then immediately deleted his account before the other side had a chance to respond) or closed for violating the site's terms and conditions
* the users might already be in a friend relationship. This could easily happen if the invited user clicked on a link that said "Accept friend request" in an email that was sent to him by our site more than once
* the invite from one user to another that started the whole "become friends" workflow could not be found for this pair of users. This situation is less likely to happen - probably the only way it could happen is for someone (a hacker?) to directly call our REST endpoint that exposes this method. Even so, we must still handle it gracefully - otherwise we risk letting hackers befriend anyone on the entire site without their consent

I believe that checked exceptions are a really nice fit for modelling these kind of situations. You would usually create a separate `Exception` subclass for each of the possible error conditions, and throw it inside the implementation. Then the method signature would look something like this:

```java
void becomeFriends(UserId user1, UserId user2) throws UserNotFound,
	UsersAlreadyFriends, NoSuchInvite;
```

Now, imagine we are writing code responsible for handling the user clicking the aforementioned email link to accept the request. I can see it having a structure like this:

```java
try {
	becomeFriends(user1, user2);

	// shows a nice green bar with something like LinkedIn's
	// "You and 'John Doe' are now connected!" message
	showInfoBefriendedMessage();
} catch (UserNotFound e) {
	if (e.userId == user1) {
		// the inviter cannot be found - display some
		// message that that person has removed his account
		// with perhaps an option to send them an email to reconsider...?
		...
	} else { // the invitee was not found
		if (e.reason == "REMOVED") {
			// show a message that says something like
			// 'You have closed your account.'
			// maybe even a separate' Click _here_ to reopen it' button...?
			...
		} else {
			// that means you violated some EULA
			// show a big red warning saying that
			// and perhaps stating the exact violation
			...
		}
	}
} catch (UsersAlreadyFriends e) {
	// apparently the user clicked on the email link more than once
	// in that case everything is fine
	showInfoBefriendedMessage();
} catch (NoSuchInvite e) {
	// this is somewhat suspicious
	// don't display anything to the user, but maybe log it in
	// some internal "Potential attack" log
	...
}
```

I would say this code looks pretty well - the exceptions forced a nice separation of the different paths the code must take depending on the result of the `becomeFriends` operation. They can also contain data describing the error in more detail. All of that is true, however, regardless if we used the checked or unchecked variant of exceptions. What we gain by using the checked one is compile-time verification that we did in fact handle all possible domain failures.

To better illustrate how this might prove useful, imagine now that the above code was successfully deployed to production, and everything works as expected. After a while, you get a feature request: you need to add the capability to cancel invites after they were sent (apparently a lot of people send out invites by mistake, and then want to retract them). So, you start the implementation at the invite layer. You add another action (cancelling an invite) and another exception to be thrown from methods that search for existing invites (let's say you called it `InviteCancelled`). Once you do that, you should get a compile-time error in your `becomeFriends` method saying that you need to deal with that exception. You may simply decide to throw it out of this method as well. After that change, you will get another compile-time error about `InviteCancelled`, this time from the client of `becomeFriends` that we saw above. Here, you may want to add another catch clause, displaying a message to the user that the invite was cancelled (maybe cancelling required the user to enter a cause for the cancellation - you might want to show it here also).

I believe that when checked exceptions are used in a manner like this, they offer a powerful aid in making sure our code is correct. Those of us using statically-typed languages are aware of how much the type system can be of help in eliminating bugs. Checked exceptions are another way we can communicate our intent to it.

One of the possible problems of using this approach is that it may lead to method signatures looking like this:

```java
void someMethod() throws
	FirstLongNameException,
	SecondLongNameException,
	AnotherLongNameException,
	DifferentSuperLongNameException,
	LastLongNameException;
```

Add to that the fact that the client is sometimes not interested in why something went wrong, but only if it was successful or not, and you might get a lot of duplicated and verbose code in the client. In my experience, there are two ways to solve this:

1. If you're using Java 7 or above, you can use multi-catch.
2. If not, then you can arrange the exceptions in a hierarchy with a common parent, and then the client can simply catch the parent exception and put all the general error handling code in there. You might say that we lose the benefit of type safety this way, but in practice it's not a problem: the compiler still makes sure everything is caught somewhere, and we can always refine our error handling by adding another `catch` with a more specific class above the parent `catch` later.

As a side note, if the project was using a language other than Java - say, Scala - I would do it in a different way. I would make the method return some sealed abstract class instead of void, and would extend that class - once for success, and once for each of the possible errors (to say it in functional language terminology, I would make the return type an algebraic data type). This way is also type safe and much more concise (you might argue that the client may simply ignore the return value, which he can't do with an exception, but I think that's a minor point, and the exception handler block can always be an auto-generated one line: `e.printStackTrace()`, which is probably even worse than ignoring the return value). It also leaves exceptions to handle purely application errors, without mixing them with business logic errors, which I think is more elegant than combining these two different use cases. However, emulating something like that in Java would be very verbose, cumbersome for the client to use (because of no pattern matching) and not really type safe anymore, so I would say that using checked exceptions is more idiomatic in case of Java.

## What Java did wrong

Like I mentioned earlier, I believe Java made some fundamental mistakes in regards to the way checked exceptions were realized in the language. These mistakes fall, in my opinion, in one of two major groups:

1. Bad assignment of some concrete exceptions to the checked/unchecked groups.
2. Incorrectly designed exception hierarchy.

### Wrong exception kind

Joshua Bloch in his excellent book ["Effective Java"](https://www.amazon.com/Effective-Java-Joshua-Bloch/dp/0134685997)
formulates the following rule:

> Use checked exceptions for recoverable conditions
> and runtime exceptions for programming errors.

While I think that's sensible, I would add another one:

> Never use a checked exception in a situation
> where it's possible to statically prove that the code will never throw it.

Let me show you an example of what I mean by that. Imagine for a second that `IndexOutOfBoundsException` was checked. That would be a nightmare! You would have to deal with it in code like this:

```java
int[] array = new int[]{1, 2, 3};
array[0]; // don't forget IndexOutOfBoundsException!
```

, even though you can practically mathematically prove that that particular snippet cannot result in that exception being thrown.

Seems obvious when you put it that way, right? And yet, if you look in the Java standard library, you will find tons of places where this guideline is broken. `CloneNotSupportedException` is a prime example. You can be certain that, given this code:

```java
public final class CheckedExceptionsClass implements Cloneable {
	public CheckedExceptionsClass copy() throws CloneNotSupportedException {
	    return (CheckedExceptionsClass)clone();
	}
}
```

, the `copy()` method will never actually throw `CloneNotSupportedException`. And yet either the implementation or all of the clients are forced to write dead code dealing with it.

Another unwanted side-effect of this particular fault is that it conditions inexperienced Java programmers to treat checked exceptions as nuances which have to be dealt with in order to get to the "real" code. I mean, how many times have you seen code like this

```java
} catch (Exception e) {
	e.printStackTrace();
	return null;
}
```

scattered all around a project?

I think the combination of the two rules mentioned above gives a nice framework to make a decision which kind of exceptions you may want to throw in your API. If you're doing filesystem I/O, for example - there is no way to guarantee that won't fail, so these errors are good candidates for checked exceptions. On the other hand, if your application absolutely depends on reading some file, which is guaranteed to be present, and cannot function without it (think configuration) - there really is no point in using checked exceptions, and you should catch that I/O error and rethrow it as an unchecked one.

### Wrong exceptions hierarchy

I think the exception hierarchy in Java is flawed. As a quick reminder, is looks like this:

```shell-session
Object
	Throwable
		Error
		Exception
			RuntimeException
```

, while I would argue that something along the lines of

```shell-session
Object
	Throwable
		Error
		Exception
			CheckedException
			UncheckedException
```

would make for a much better solution.

The reason is that, in large part due to what I discussed above, `} catch (Exception e) {` is a common error-handling method. Well, that code has the unfortunate side effect of also catching all runtime exceptions, which - if you adhere to the previously quoted guideline - you don't want to do, as those constitute programming errors with which you want to fail as fast as possible. Of course, you can write `} catch (RuntimeException e) { throw e; }` above, but that is three more lines of boilerplate in an already verbose language, and a source of potential errors. FindBugs does has have a rule that makes sure you do this, but you can't depend on a project using static analysis tools (and you can't depend on the warnings being fixed even if it does use them). With this other hierarchy, you would simply write `} catch (CheckedException e) {`, and everything would work fine (you could potentially even forbid a statement like `} catch (Exception e) {` on the compiler level if you wanted maximum safety).

It is also my personal belief that making classes like `Exception` concrete is a mistake. I honestly see no gain in it at all, and it encourages bad error handling practices like

```java
throw new Exception("Too lazy to figure out a better class for this, yawn")
```

I think making each of those top-level classes abstract would've been a much nicer design.

## Summary

Checked exceptions are a cool concept, and I believe their bad rep stems mostly from mistakes that Java made in it's realization of that concept. I would love to see a language where these mistakes were corrected, and checked exceptions would get the respect they, in my opinion, deserve.
