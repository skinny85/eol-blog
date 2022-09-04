---
id: 13
layout: article.html
title: Testing with Doubles, or why Mocks are Stupid – Part 2
summary: "In Part 2 of this four-part series, we explore when you should
	use each kind of Test Double. First up – Stubs!"
created_at: 2015-11-30
---

[Part 1](/testing-with-doubles-or-why-mocks-are-stupid-part-1) | [Part 3](/testing-with-doubles-or-why-mocks-are-stupid-part-3) | [Part 4](/testing-with-doubles-or-why-mocks-are-stupid-part-4)

In [Part 1](/testing-with-doubles-or-why-mocks-are-stupid-part-1), we saw the definition of the various kinds of Test Doubles. What was not covered, however, were the guidelines on when to prefer using one over the other (or, alternatively, why do we actually need more than one kind?). Part 2 and [3](/testing-with-doubles-or-why-mocks-are-stupid-part-3) deal with this topic.

## Object methods classification

But before we can answer that question, we need to introduce a classification of methods in object-oriented programming. All methods can be characterised on two axises:

1.  Depending on the direction, methods can be either _incoming_ or _outgoing_. When somebody calls a method on your object, it's considered incoming; when your object calls methods on it's collaborators, they're outgoing. This classification obviously depends on the perspective of the object you're looking from -- one object's outgoing message is another object's incoming one. As we're talking about tests, we usually consider this classification from the point of view of the class under test -- so the behaviors we want to test are incoming, while the calls made to dependencies are outgoing.
2.  A method can be either a _Query_ or a _Command_. Queries don't affect the receiver's state, and are executed for their return value; Commands tell the object to do something (and thus change it's internal state), and are executed for their side-effects. Command methods may or may not also return a value to the caller.

Obviously, as this is an article about Test Doubles, our class under test has some inconvenient dependencies that we need to deal with. So, we have two basic cases: testing incoming Queries with an outgoing Query dependency, and testing incoming Commands with an outgoing Command dependency.

### Testing an incoming Query method with outgoing Query dependencies

Imagine you're creating an object which is supposed to translate some text from one language to another. To make the translation, you have an external service:

```java
public interface DictionaryService {
	Map<String, String> lookupWords(Set<String> words);
}
```

This service returns a mapping from each word in the `Set` given as the argument to it's translation -- if a translation couldn't be found, the word itself is used as the value. Your object is supposed to return a `String` with each word from the original text substituted by it's translation (OK, so this probably won't put Google Translate out of business, but bear with me -- it's just an example). The implementation might look something like this:

```java
public class Translator {
	private final DictionaryService dictionaryService;

	public Translator(DictionaryService dictionaryService) {
		this.dictionaryService = dictionaryService;
	}
	
	public String translate(String text) {
		String[] words = text.split("\\s+");
		Set<String> wordBag = Sets.newHashSet(words);
		Map<String, String> translations = dictionaryService.lookupWords(wordBag);

		return Stream.of(words).map(translations::get).collect(Collectors.joining(" "));
	}
}
```

We want to unit-test this piece of code. Let's see how each Test Double fares in this.

##### Attempt #1 – Mock

A test using a Mock would looke something like this:

```java
@Test
public void test_with_mock() throws Exception {
	DictionaryService dictionaryService = mock(DictionaryService.class);
	Translator translator = new Translator(dictionaryService);

	translator.translate("A dog chases a cat");

	verify(dictionaryService).lookupWords(Sets.newHashSet("A", "dog", "chases", "a", "cat"));
}
```

This test passes, but it has some pretty obvious flaws:

*   it doesn't test anything after the call to `lookupWords` -- in particular, it doesn't verify that the result of the Query is what we expect
*   it practically duplicates the implementation, making it very fragile. For example, notice that we send both "a" and "A" to the `DictionaryService` -- that's very wasteful. What if we later want to detect that situation, and only send the lowercase versions? If we make that change to the production code (obviously taking into account proper capitalization), the functionality will work correctly, but this test will fail. This is what's called a [Change-detector test](http://googletesting.blogspot.com.es/2015/01/testing-on-toilet-change-detector-tests.html), and it's a very, very bad thing.

So a Mock doesn't really work here. How would a test using a Stub look like?

##### Attempt #2 – Stub

```java
@Test
public void test_with_stub() throws Exception {
	DictionaryService dictionaryService = mock(DictionaryService.class);
	when(dictionaryService.lookupWords(any(Set.class))).thenReturn(ImmutableMap.of(
			"A", "A", "a", "a", "dog", "god", "chases", "sesahc", "cat", "tac"));

	Translator translator = new Translator(dictionaryService);
	String result = translator.translate("A dog chases a cat");

	assertThat(result).isEqualTo("A god sesahc a tac");
}
```

This test is a lot better. A bigger part of the code is covered (including verifying the Query result), and the test is less brittle -- it can actually help us refactor the production code without breaking.

However, while better, this test is still far from perfect:

*   Notice that if we did in fact make the change of not sending both "a" and "A" to the `dictionaryService`, the `Map` returned by the Stub would be incorrect (the entry with "A" as the key should not be present). In this particular code it doesn't matter -- but that might not be true in all cases.
*   It doesn't verify that we correctly call `dictionaryService.lookup`, which the mocking test did. Theoretically, we can change the stubbing line from `any(Set.class)` to `eq(newHashSet("A", "dog", "chases", "a", "cat"))`, but then we're back to the same britleness that we wanted to avoid in the first place.

Is there a way to have your mocking cake and eat it too?

##### Attempt #3 – Fake

While yes, there is:

```java
@Test
public void test_with_fake() throws Exception {
	DictionaryService dictionaryService = new DictionaryService() {
		@Override
		public Map<String, String> lookupWords(Set<String> argument) {
			return argument.stream().collect(Collectors.toMap(s -> s,
					s -> new StringBuilder(s).reverse().toString()));
		}
	};
	Translator translator = new Translator(dictionaryService);
	String result = translator.translate("A dog chases a cat");

	assertThat(result).isEqualTo("A god sesahc a tac");
}
```

This Fake `DictionaryService` does the translation by simply reversing it's input words, similarly to the Stub. The difference is that it doesn't just blindly return the same `Map` every time it's called -- this code is actually a correct implementation of the `DictionaryService` (at least from a purely API standpoint -- it's obviously pretty poor when judging the quality of the translation!). And because of that, this test will not be brittle -- it will adapt and stay passing as we correctly refactor the production code, and become red when we make a mistake in that refactoring. This is the kind of test that we want!

And so, my recommendation is:

> For testing incoming Query methods,
> assert on the results of the Query,
> and avoid Mocks for outgoing dependencies,
> preferring Stubs (or Fakes) instead.

## End of Part 2

That's it for Part 2. In [Part 3](/testing-with-doubles-or-why-mocks-are-stupid-part-3) , we'll tackle testing an incoming Command method with outgoing Command dependencies.

[Part 1](/testing-with-doubles-or-why-mocks-are-stupid-part-1) | [Part 3](/testing-with-doubles-or-why-mocks-are-stupid-part-3) | [Part 4](/testing-with-doubles-or-why-mocks-are-stupid-part-4)
