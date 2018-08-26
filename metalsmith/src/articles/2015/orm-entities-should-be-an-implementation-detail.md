---
id: 9
layout: article.html
title: ORM entities should be an implementation detail
summary: "In a shockingly non-Git related article, I talk about an
	anti-pattern I've noticed is pretty common on projects that use
	Object-Relational Mapping, and which may be a big reason why ORMs get such
	a bad rep."
created_at: 2015-08-03
---

At a [job interview](/life-update-job-and-location-change) lately, I was asked a fairly non cookie-cutter question: "What do you think of Hibernate?". I thought the conversation that ensued as a result was very interesting, but necessarily short because of the circumstances. As I didn't manage to present all of my ideas on the matter at the time (and this is a topic that I have given a lot of thought), I decided to write this article to get them out of my system.

My answer will probably disappoint you. I'm definitely not of the (somewhat popular lately) opinion that Hibernate (and all ORMs, in general) are terrible. This won't be an 'ORMs considered harmful' style article (and really, who still uses the old cliché 'considered harmful' title structure? Please, have some class).

My stance on the topic is pretty close to what <a href="http://martinfowler.com/bliki/OrmHate.html" target="_blank">Martin Fowler</a> had to say about the subject. The simple fact is that object-relational impedance mismatch is real, and thus ORMs will always be big and complex - because the problem that they are trying to solve is big and complex. I also think that, when used wisely, they can provide you nice returns for a relatively small effort investment.

Having said all that, in the course of my career I have seen many projects where an ORM caused significant damage. When I reflected about what was it that made the usage of ORMs in those projects so harmful, I always came to the conclusion that there was one root cause, always the same, of all those problems - the cardinal sin of ORM usage, if you will. It can be summarized as not adhering to this one simple rule:

```
Your use of an ORM should be an implementation detail of your model.
```

In the rest of the article I try to explain exactly what I mean by that.

## Example #1

To prevent the discussion from being too abstract, I'll illustrate my points with concrete examples of common ways that ORMs are used. They'll be using Java and standard JPA ORM techniques. The details aren't that important, and the points I'll make should be pretty general, but I think it'll be easier to illustrate some issues showing a pseudo real-life example than just describing them in broad terms. I'll try to use examples that should be fairly standard modeling issues that you are faced with when working on real-life problems.

Let's say you're writing a system for a discussion board, like a classic Internet forum (or <a href="http://reddit.com" target="_blank">Reddit</a>, if you're too young to know what a forum is ;p). So, you naturally have a `User` class. Users have some data associated with them (username, email, age, yada yada yada), and they can create Posts, and write Comments on Posts. So, you whip out the old IDE, and 3 minutes later you have your model:

```
public class User {
	@Id
	@GeneratedValue
	private long id;

	private String username;

	private String email;

	private int age;

	@OneToMany(fetch = FetchType.LAZY, mappedBy = "owner")
	private List<Post> posts;

	@OneToMany(fetch = FetchType.LAZY, mappedBy = "owner")
	private List<Comment> comments;

	// getters & setters omitted
}
```

I think this should be fairly standard JPA code for this sort of problem.

The first user story you need to implement is pretty basic - a User should be able to see his profile information when he enters the 'My Profile' page (there shouldn't be anything about his comments or posts in there). Because we're good programmers, we abstract the database layer in a DAO, and so our code looks something like this:

```
public class UserDao {
	@PersistenceContext
	private EntityManager entityManager;

	@Transactional
	public User find(long id) {
		return entityManager.find(User.class, id);
	}
}
```

Then, in the presentation layer, you call the DAO with the parameter read from the URL, and then use the returned entity to fill out the view template.

Pretty standard, right? I think practically everybody who did server-side Java should find this familiar. I know I've written code like this myself before. It's an incredibly popular solution to this kind of problem. And it sucks. It sucks big time. Even though our application is tiny, we've already managed to make a mess of it.

The first flaw is that because our entity will also be used for writing, it obviously has all the setters that will be needed to perform those writes. What do these setters, called on an entity returned by `UserDao.find()`, accomplish? Nothing! They are absolutely useless in this context. Their only purpose is to confuse anybody who looks at the view code after the original author is done with it.

Secondly, because our two relationships were defined lazily (which is fine, as we don't need the related entities in this use case), if we ever call the getter for `posts` or `comments`, we will get a `LazyInitializationException`. Again - we don't have to call these methods right now, but there's nothing preventing a programmer using our class from doing that. What is more, at some point in the future, when implementing other user stories, we WILL need to have those fields populated. And what will most likely end up happening is that we will add a new method to `UserDao`, something like `User findWithPosts(long id)`, which will return an entity with the `posts` field filled. At that point, we're pretty much screwed. A programmer looking to modify any client of `UserDao` now has to look at it's implementation to determine which methods can and can't be called in this particular context - a complete violation of encapsulation.

You may think these issues are relatively minor. "So you have some methods that don't do anything and some that shouldn't be called. Big deal! Just don't call them". But I don't agree. This is a textbook example of incidental complexity. I've shown a deliberately simple and tiny example, but now I want you to imagine a large system, with hundreds of entities, written in such a style. It's pretty much a disaster. A programmer who starts working on such a project feels like he got dropped in the middle of a minefield - any tiny step he makes results in an exception blowing up in his face. I bet a lot of you know exactly what I'm talking about. For those of you lucky souls that don't, I can personally say I had this sort of experience multiple times in my career, and let me tell you - it's not very pleasant.

How can we make this better? Well, the first idea is to always populate all the fields of the `User` class. That seems wasteful, and is basically treating the symptoms instead of the cause. We could use <a href="https://developer.jboss.org/wiki/OpenSessionInView?_sscc=t" target="_blank">Open Session In View</a>, but that usually creates more trouble than it solves, and is today widely regarded as an <a href="http://stackoverflow.com/questions/1103363/why-is-hibernate-open-session-in-view-considered-a-bad-practice" target="_blank">anti-pattern</a>.

Here is my proposed solution. Let's create a separate class...

```
public class UserBaseInfo {
	private final long id;
	private final String username, email;
	private final int age;

	// constructor & getters omitted
}
```

... and make `UserDao.find(long)` return an instance of that class instead of `User` (obviously the values for the construction of `UserBaseInfo` will be taken from the `User` entity retrieved by JPA). Notice that this way, the client of `UserDao` has no idea of the existence of the `User` entity. You could make it package-private, if you wanted to. This hiding solves all the troubles we had before: there are no useless setters that the client can call, and no weird, proxied fields that may cause `LazyInitializationException`. When the time comes that we need the posts of a user, we're ready: we create a class...

```
public class UserBaseInfoWithPosts extends UserBaseInfo {
	private final List<Post> posts;

	// constructor & getter omitted
}
```

... and make `UserDao.findWithPosts(long)` return an instance of this class. This way, the type system encodes and enforces how can the various parts of `User` be accessed. The contract between `UserDao` and its clients is also pretty clear: "You can call this first method, which is fast but doesn't have all the data, or this other one, which does have the data but is more expensive".

Notice also that this suddenly frees us from being tied to an ORM at all. If one day you decide you want to get rid of Hibernate and use <a href="http://www.jooq.org/" target="_blank">jOOQ</a> instead, you absolutely can, and the client code doesn't even have to be recompiled. If you wanted to do the same with the previous version, the `User` class would have to be kept, even though it wouldn't serve any purpose in the implementation anymore.

This idea is nothing revolutionary. You can think of it as <a href="http://martinfowler.com/bliki/CQRS.html" target="_blank">Command-Query Responsibility Segregation</a> on the "micro" scale, where we explicitly use a different class for querying and a different one for commands.

I guess some of you may frown that I created a separate class, and worry that in a big application, there might be lots of those additional classes, and you might not like the extra work involved in creating them. That is somewhat accurate. Java is particularly bad at this; if you use Scala, for example (or Kotlin), creating a class like that is super lightweight:

```
case class UserBaseInfo(id: Long, username: String, email: String, age: Int)
```

And you get immutability, the constructor, all the getters, `equals` and `hashCode`, for free (plus a bunch of other stuff not available in Java, like pattern matching). Groovy has something similar with the `@Immutable` annotation. In Java, you can use the <a href="https://projectlombok.org" target="_blank">Lombok</a> library to ease the burden. Or, just buckle down and write the damn thing. I promise you the short-term pain of writing some fairly boilerplate code will more than pay for itself in the long-term with how much clearer, more maintainable and easier to on-board the project will be.

Now, if you are REALLY opposed to the thought of writing those additional classes in Java, I would advise using a small cheat. Basically, you create an interface...

```
public interface UserBaseInfo {
	long getId();
	String getUsername();
	String getEmail();
	int getAge();
}
```

... make `User` implement it, and then change the return type of `UserDao.find(long)` to `UserBaseInfo`. This way, you get the type safety and encapsulation with (almost) no additional code. However, I consider this solution an abuse of interfaces, and wouldn't really be too happy to see this kind of code in one of my projects.

## Thinking about the big picture

Let us step back a little, and analyze what is the root cause of trouble when you expose your persistence entities to layers of your application other than the domain model. I thought about this topic a lot, and I think I came up with a sensible answer.

When you really think about it, an ORM entity is nothing else than a translation of an SQL table to the programming language of your choice (in this case, Java). Each part of the application that uses the entity then has an implicit dependency on that table structure. That is why it's so important to isolate the knowledge about your entities to the smallest part of your application as possible - ideally, strictly to your domain model.

Java programmers like to make fun of PHP, ridiculing the fact that bad PHP programs often have SQL queries embedded directly in the view templates. They like to think that the "standard" way of doing things in Java (the one shown above) keeps things nicely layered and modular. What they don't realize, however, is that by exposing the entities directly to the view layer, they are doing basically the same thing as the PHP guys. The fact that the table and column names are hidden away by annotations on the class does not actually mean the encapsulation level is any higher in this case.

## Wait, there's more (suckiness) - example #2

You still might not be convinced that any of the problems I've described are actually serious enough to be something to worry about. The thing is, we've only considered reading from the database so far. Let me tell you that the issues you get when you allow your entities to spill all over your application during reading are NOTHING compared to the clusterfuck that ensues when actually writing to the database enters the picture.

Let's continue with our discussion platform example. You now have to implement a pretty basic functionality of the site - allowing a User to publish a Post. Since we're good <a href="http://dddcommunity.org/" target="_blank">Domain-Driven Design</a> practitioners, we have a nice method in the `User` class for that:

```
public void post(Post newPost) {
	if (this.posts == null) {
		this.posts = new ArrayList<>();
	}
	this.posts.add(newPost);
	newPost.changeOwner(this);
	// possibly other stuff - for example, publishing a Domain Event
}
```

Then, in our view layer, we show the user a form with some fields to fill out, and register a handler on the 'Submit' button similar to the following:

```
Post newPost = new Post();
newPost.setTitle(form.getTitle());
newPost.setContent(form.getContent());

User poster = userDao.findWithPosts(userId);
poster.post(newPost);
userDao.save(poster);
```

And in `UserDao`:

```
public User save(User user) {
	if (user.getId() == 0) {
		entityManager.persist(user);
		return user;
	} else {
		return entityManager.merge(user);
	}
}
```

Again, I hope those of you who have some experience with Java Enterprise Edition will find this code at least somewhat familiar. This is fairly typical stuff. And it sucks horribly, even worse than the previous example.

The first problem is that first call to `userDao`. Notice that it has to be `findWithPosts`, not simply `find` - because `find` would result in `post` throwing `LazyInitializationException`. More incidental complexity.

The second issue is that this code doesn't actually work - the Post will not be saved to the database. It's because `newPost` is in a detached state when we're calling `userDao.save()`, and so the persistence provider will not synchronize this instance with the database.

This particular problem could be solved by setting the `cascade` attribute of the `@OneToMany` annotation to `CascadeType.MERGE`. However, that might be problematic for a couple of reasons: 1) the entity code might be in an external module that cannot be modified directly; 2) it might be managed by some other programmer/team, and we don't want to interfere with their code; 3) finally, adding that annotation might break other use cases of the entity (for example, it can potentially lead to creating duplicate posts in the database). Luckily (well, the use of this word might be debatable in this context, as we'll shortly see...), there is another way to fix this situation, without modifying the `User` entity code. It looks like this:

```
Post newPost = new Post();
newPost.setTitle(form.getTitle());
newPost.setContent(form.getContent());

User poster = userDao.findWithPosts(userId);
poster.post(newPost);
userDao.save(poster);
postDao.save(newPost);
```

Can you spot the difference? We've added one innocuous little line that saves the post to the database after calling `userDao.save(poster)`. And it works! The developer is happy, because he didn't have to change the code in `User`, and thus calls it a day with the functionality done.

I imagine a lot of you have seen this kind of code "in the wild". I know I have. And it's hell. It's virtually impossible, in a big system written in this kind of style, to figure out the precise sequence of method calls needed to correctly perform any kind of data persistence. So what do you do? You copy & paste it from some other part of the codebase, which does roughly the same thing. Persistence code pretty quickly becomes this voodoo magic - weird sequence of invocations, with judicious use of things like `entityManager.flush()` and `entityManager.clear()` thrown in here and there for good measure, which nobody really understands anymore and which everyone is afraid to touch, as it might break in the weirdest way (and in the weirdest place).

So how would I approach solving this problem? Well, I would completely re-structure this solution. The client code present in the view would look something like this:

```
userService.post(userId, form.getTitle(), form.getContent());
```

That's it - this is everything that the view needs to perform this operation. `UserService` is a Domain Service which encapsulates the action of creating a new post. Notice in particular that there's (again) no direct mention of any JPA entity class. There is the variable `userId`, which represents some notion of identity - however, this signifies an Entity with a capital 'E', the one that DDD talks about, and not a Hibernate entity or anything like that. All we're saying is, "The user identified by userId created a new post with the given title and content". That is all - we have no idea of the existence of any User or Post entities. What is more, not only do we not know about them - we don't want to know. Hell, for all we care the implementation might use a Document Store instead of a SQL database and save the post directly in the User aggregate - in that case there probably wouldn't even be two classes used for that mapping. The point is all of that are implementation details of the model, which do not concern the view in any way.

As you can guess, all of the ugliness of the persistence is tucked away in that `post` method:

```
@Transactional
public class UserService {
	// ...

	public void post(long userId, String title, String content) {
		User poster = userRepository.find(userId);
		Post newPost = postRepository.create(title, content);
		poster.post(newPost);
	}
}
```

You might say that this code is very similar to what we had before, and you wouldn't be far off - the biggest difference is probably that we can use explicit transactions and thus save some manual saving to the database. There is a huge difference, however, when it comes to how this code is organized. Previously, it resided in the view of the application - the client of the actual business layer was responsible for correctly invoking the persistence mechanisms. Now, all of those ugly details are encapsulated inside the domain layer, where they belong. This persistence code can be easily unit or even integration tested in complete isolation from the view, which makes checking and figuring out all the corner cases that come up during persistence that much easier. Any optimizations that might be done (for example, it might be faster to search for `poster` with `findWithPosts` instead of `find`) are confined strictly to the implementation.

Again, if we want to change the mechanisms by which we do persistence, the client code will not be affected at all. Notice, however, that we use two Hibernate entities in this code, `User` and `Post`, and thus any changes in one of them will affect the other. This isn't bad in any way - it's just a natural consequence of the relationship between these two concepts. This is where DDD's notion of Aggregates and how to model them enters the picture.

## Wrapping up

So, to recap: I think ORMs are fine, provided you are careful with not leaking the entity classes to too many parts of your application. Because ORM entities are an almost literal translation of an SQL table to a programming language, any code that uses them has an implicit dependency on the database schema, and we naturally want to limit those kind of dependencies to the narrowest scope we possibly can - ideally, just our domain model. Try to structure your model in terms of the operations it permits, not the classes that are used to persist the effects of those operations. At the same time, remember that the clients of your model will often need to read data for presentation purposes, so make sure you provide them with a proper API for doing that which does not depend on too many implementation details, as that makes the whole system brittle and hard to maintain.

Or, in other words: you know you're using an ORM correctly if nobody besides yourself (that is, the model author) has any idea that you're actually using one.
