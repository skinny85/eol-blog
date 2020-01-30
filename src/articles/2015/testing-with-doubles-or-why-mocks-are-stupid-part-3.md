---
id: 15
layout: article.html
title: Testing with Doubles, or why Mocks are Stupid – Part 3
summary: "In this penultimate article of the series, we look at testing
	an incoming Command method with outgoing dependencies."
created_at: 2015-12-30
---

[Part 1](/testing-with-doubles-or-why-mocks-are-stupid-part-1) | [Part 2](/testing-with-doubles-or-why-mocks-are-stupid-part-2) | [Part 4](/testing-with-doubles-or-why-mocks-are-stupid-part-4)

In [Part 2](/testing-with-doubles-or-why-mocks-are-stupid-part-2), we tackled testing an incoming Query method with an outgoing Query dependency -- using Test Doubles, of course. We now want to do the same, but for an incoming Command method.

If the Command has an outgoing Query dependency, then we can use the same techniques we saw for the Query method. The interesting case is if the dependency is itself a Command.

### Testing an incoming Command method with outgoing Command dependency

To illustrate the problem, we'll use another example. Let's say you're developing an online blind auctioning system. Users place their bids, and the highest one wins. We have the following external service API for placing an order for the winning bid:

```java
public interface OrderService {
	BigDecimal WATCH_THRESHOLD = ... // some constant

	Order placeOrder(long itemId, String userId, BigDecimal price);
	
	void addToWatchList(long orderId);
}

public class Order {
	public final long orderId;
	public final BigDecimal finalPrice;

	public Order(long orderId, BigDecimal finalPrice) {
		this.orderId = orderId;
		this.finalPrice = finalPrice;
	}
}
```

The logic of this API is very simple: the Order returned has some price, which might be higher than what the winning bid was (for example, the item might have some shipping costs). If the final price is higher than `WATCH_THRESHOLD`, we figure this is a high-risk sell, and we want to monitor it more closely -- so we need to call `addToWatchList()`, passing in the returned order ID.

Our task is to implement an `Auction` class, which has two methods: `bid(String userId, BigDecimal amount)` which registers a bid with the given amount with the given user, and `close()`, which closes the auction, determines the winner, and does the appropriate `OrderService` calls. Once an auction is closed, calling `close()` again should have no effect. A possible implementation:

```java
public class Auction {
	private final long itemId;
	private final OrderService orderService;
	private final Map<String, BigDecimal> bids;
	private boolean closed;
	
	public Auction(long itemId, OrderService orderService) {
		this.itemId = itemId;
		this.orderService = orderService;
		bids = new HashMap<>();
		closed = false;
	}

	public void bid(String userId, BigDecimal amount) {
		bids.put(userId, amount);
	}

	public void close() {
		if (isClosed())
			return;
		markAsClosed();

		Map.Entry<String, BigDecimal> winningBid = bids.entrySet().stream()
				.max((e1, e2) -> e1.getValue().compareTo(e2.getValue()))
				.get(); // let's ignore ties and no bids for the sake of simplicity
		Order order = orderService.placeOrder(
			itemId, winningBid.getKey(), winningBid.getValue());
		if (WATCH_THRESHOLD.compareTo(order.finalPrice) < 0)
			orderService.addToWatchList(order.orderId);
	}

	public boolean isClosed() {
		return closed;
	}

	private void markAsClosed() {
		closed = true;
	}
}
```

We now want to unit test this piece of code. A Stub worked best the last time, why don't we try it first?

##### Attempt #1 – Stub

```java
@Test
public void test_with_stub() throws Exception {
	BigDecimal bigPrice = WATCH_THRESHOLD.add(BigDecimal.ONE);
	OrderService orderService = mock(OrderService.class);

	when(orderService.placeOrder(eq(3L), eq("user1"), eq(BigDecimal.TEN)))
			.thenReturn(new Order(5, bigPrice));
	doThrow(new IllegalArgumentException("addToWatchList() called with wrong argument"))
			.when(orderService).addToWatchList(anyLong());
	doNothing()
			.when(orderService).addToWatchList(eq(5L));

	Auction auction = new Auction(3, orderService);
	auction.bid("user1", BigDecimal.TEN);
	auction.bid("user2", BigDecimal.ONE);

	auction.close();

	assertThat(auction.isClosed()).isTrue();
}
```

I hope you'll agree: this test is terrible.

* the setup is very long, making the test unreadable
* because we're using Stubs, the only verification we can do is on the state of the object under test, which is often not enough (like in this particular case)
* it doesn't actually cover the code correctly -- if we changed the production code and removed the call to `OrderService.addToWatchList()`, it would still pass

All of this leads us to an important lesson: Stubs are not a good fit when testing Commands.

##### Attempt #2 – Mock

The problem with the previous test is obvious -- we wanted to verify what calls were being made, and we tried simulating doing that with Stubs. But there is actually a Test Double specifically for that purpose -- Mocks!

```java
@Test
public void test_with_mock() throws Exception {
	BigDecimal bigPrice = WATCH_THRESHOLD.add(BigDecimal.ONE);
	OrderService orderService = mock(OrderService.class);
	when(orderService.placeOrder(anyLong(), anyString(), any(BigDecimal.class)))
			.thenReturn(new Order(5, bigPrice));

	Auction auction = new Auction(3, orderService);
	auction.bid("user1", BigDecimal.TEN);
	auction.bid("user2", BigDecimal.ONE);
	auction.close();

	assertThat(auction.isClosed()).isTrue();
	verify(orderService).placeOrder(eq(3L), eq("user1"), eq(BigDecimal.TEN));
	verify(orderService).addToWatchList(5);
}
```

This test is a lot better. It's relatively short, reads well (notice that stubbing forces us to reverse the usual order -- first we setup the call, then execute it, while verifying doesn't have this problem), and covers the entire code.

However, "better" does not mean "perfect". I can see at least two places where this test could be improved:

* Because the `placeOrder` Command returns a value, we need to do some stubbing still to "wire" `placeOrder` and `addToWatchList` together (so, the `Order` returned by `placeOrder` has ID 5, which is then verified to be the argument to `addToWatchList`). In this case it's fairly simple, but can quickly get hairy if you need to wire together like this a complex object API with more than two methods (or if they have a large number of arguments).
* The test doesn't verify the order in which the `OrderService` methods were called -- again, in this particular case it doesn't look very likely to be a problem (mainly because one method's return value is used as the argument to the other), but I can easily imagine a situation where checking that is very important. Mockito actually allows you to verify this, but it requires a lot more code, which would make the test look considerably less pleasant.

So, how would I correct these faults?

##### Attempt #3 – Fake

```java
@Test
public void test_with_fake() throws Exception {
    BigDecimal bigPrice = WATCH_THRESHOLD.add(BigDecimal.ONE);
    FakeOrderService fakeOrderService = new FakeOrderService(5, bigPrice);

    Auction auction = new Auction(3, fakeOrderService);
    auction.bid("user1", BigDecimal.TEN);
    auction.bid("user2", BigDecimal.ONE);
    auction.close();

    assertThat(auction.isClosed()).isTrue();
    fakeOrderService.verifyPlaceOrderWasCalled(3, "user1", BigDecimal.TEN);
    fakeOrderService.verifyAddToWatchListWasCalled(5);
}
```

This test is short, sweet and obviously cheating. Let me show you the Fake:

```java
public class FakeOrderService implements OrderService {
    private final long orderId;
    private final BigDecimal finalPrice;
    private final OrderService orderServiceMock;
    private Order order;

    public FakeOrderService(long orderId, BigDecimal finalPrice) {
        this.orderId = orderId;
        this.finalPrice = finalPrice;
        orderServiceMock = mock(OrderService.class);
    }

    @Override
    public Order placeOrder(long itemId, String userId, BigDecimal price) {
        orderServiceMock.placeOrder(itemId, userId, price);
        order = new Order(orderId, finalPrice);
        return order;
    }

    @Override
    public void addToWatchList(long orderId) {
        if (order == null)
            throw new IllegalStateException("addToWatchList() called before placeOrder()!");
        orderServiceMock.addToWatchList(orderId);
    }

    public void verifyPlaceOrderWasCalled(long itemId, String userId, BigDecimal winningBid) {
        verify(orderServiceMock).placeOrder(itemId, userId, winningBid);
    }

    public void verifyAddToWatchListWasCalled(long orderId) {
        verify(orderServiceMock).addToWatchList(orderId);
    }

    public void verifyAddToWatchListWasNotCalled() {
        verify(orderServiceMock, never()).addToWatchList(anyLong());
    }
}
```

Because we had a separate class at our disposal, we were able to encapsulate a big part of the plumbing and take it out of the test. This Fake actually uses Mockito internally, but that's just an implementation detail that provides good error messages while keeping the code short -- we might as well have written all of the validations by hand.

Now, if we wanted to test the negative case (when `addToWatchList` should not be called), we don't have to worry about repeating the setup -- we just use our Fake, and the test is as short as the positive case one.

The downside of this approach is obvious: this Fake is quite a lot of code. Is it worth it, or is it better to simply use a Mock instead? There's no easy answer to this question. This is something that needs to be judged on a case-by-case basis. For instance, if `Auction` had a lot of tests (think something like 20), I think having this kind of utility class would make the tests a lot clearer and more [DRY](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself). Theoretically, you can use utility methods on the test class to achieve something similar, but in my experience, test utility methods are quite clunky (for example, what if you decided you wanted to split the tests into two classes, one for cases that should call `addToWatchList`, and the other for those who shouldn't? If these two classes need to share any utility methods, you now need to extract them to a common superclass. And what if these tests already had a superclass? Things can get messy). Separate classes are more readable and more reusable.

<div id="code-change-section"></div>

Having a class instead of a dumb Mock can also make the tests easier to adapt to future changes. To illustrate what I mean by that, let me propose the following thought experiment. Let's say `OrderService` changes slightly, and it now looks like this:

```java
public interface OrderService {
	BigDecimal WATCH_THRESHOLD = ... // same constant as before
	BigDecimal VIP_THRESHOLD = ... // new constant, bigger than the previous one

	Order placeOrder(long itemId, String userId, BigDecimal price);
	
	void addToWatchList(long orderId);

	void addToWatchList(long orderId, Status status);

	enum Status { NORMAL, VIP }
}
```

The idea is simple: we have two watch lists now, a normal one and a VIP one. If the final price is above the VIP threshold, it's added to the VIP one. If not -- the same rules should apply as they did previously. To keep backwards compatibility, the old `addToWatchList(long)` method is kept, and it's equivalent to calling `addToWatchList(long, NORMAL)`.

Now, if our new code in `Auction` looks like this:

```java
if (VIP_THRESHOLD.compareTo(order.finalPrice) < 0)
	orderService.addToWatchList(order.orderId, VIP);
else if (WATCH_THRESHOLD.compareTo(order.finalPrice) < 0)
	orderService.addToWatchList(order.orderId);
```

then we're golden -- all of the old tests still pass. But what if somebody decides to do the following refactoring:

```java
if (WATCH_THRESHOLD.compareTo(order.finalPrice) < 0)
	orderService.addToWatchList(order.orderId,
		VIP_THRESHOLD.compareTo(order.finalPrice) < 0 ? VIP : NORMAL);
```

Suddenly, all of our Mock tests are red, even though functionally the code does the same thing.

One of the biggest advantages of writing tests is the ability to refactor and improve the production code, while the tests act as insurance that you haven't broken anything. But if you write your tests in a way that makes them fail after EVERY change to the production code, then you've actually entered into a zone where the tests not only don't add any value, but actually subtract it -- because you are spending time maintaining them, while not getting any of the benefits back. This is a pretty horrible place to be.

Just for comparison, how would our Fake handle this situation?

```java
@Override
public void addToWatchList(long orderId) {
	addToWatchList(orderId, Status.NORMAL);
}

@Override
public void addToWatchList(long orderId, Status status) {
	if (order == null)
		throw new IllegalStateException("addToWatchList() called before placeOrder()!");
	orderServiceMock.addToWatchList(orderId, status);
}

public void verifyAddToWatchListWasCalled(long orderId) {
	verifyAddToWatchListWasCalled(orderId, Status.NORMAL);
}

public void verifyAddToWatchListWasCalled(long orderId, Status status) {
	verify(orderServiceMock).addToWatchList(orderId, status);
}
```

First of all, we get a compilation failure instead of a runtime one -- always a better place to be. We add two new overrides, `addToWatchList` and `verifyAddToWatchListWasCalled`, each taking an additional parameter -- the `Status` of the watched order, and we have the old versions delegate to the new ones with a `Status.NORMAL`. Because we had a real class at our disposal, we were able to correctly implement the `OrderService` API, and so our tests will not be fragile, and will facilitate any correct refactorings of `Auction` that we decide to undertake.

#### State vs. behavior verification

There's also one more thing I wanted to mention here. Notice that in the tests, we always assert on the changed state of `Auction` after calling `close()`. This is a good practice whenever the Command has some visible side-effect on the receiver.

What might seem a good idea is doing a similar assertion on the changed state of your outgoing Command dependency. For example, imagine that `OrderService` had a method for querying the watch lists -- something like:

```java
public interface OrderService {
	// ...

	List<Watch> watchLists();
}
```

, which returns all of the sales that we are currently watching. Instead of checking that we are calling `addToWatchList()` with the correct Order ID, you might be tempted to instead call `watchLists()` and search for a Watch with that Order ID -- so, assert on the changed state of the `OrderService` instead of relying on behavior verification.

In general, this is a bad idea. Firstly, it complicates your Test Doubles considerably -- you're basically forced to use a Fake in this case (otherwise, you're asserting on something you set up yourself to be returned, which makes the test practically worthless). Secondly, you are coupling the tests of one class (in this case, `Auction`) to the API of another (`OrderService`) very strongly. I can imagine, for example, that `addToWatchList()` has some logic inside it, and it might decide to not add the sale to the watched list after all (simple case when that might happen: if the user making the sale has already a high reputation ranking). This can lead to a pretty big divergence between the behavior of your dependencies in production code and in tests.

## Summary

And so, to sum up my recommendation:

> For testing incoming Command methods,
> assert on the changed state of the
> class under test, if possible; do NOT
> assert on the state of dependencies,
> instead preferring behavior verification
> with Mocks (or Fakes) instead.

In the [last, fourth, part](/testing-with-doubles-or-why-mocks-are-stupid-part-4) of the series, I will talk a little bit about the downsides of Test Doubles and the risks associated with over-mocking your tests.

[Part 1](/testing-with-doubles-or-why-mocks-are-stupid-part-1) | [Part 2](/testing-with-doubles-or-why-mocks-are-stupid-part-2) | [Part 4](/testing-with-doubles-or-why-mocks-are-stupid-part-4)
