---
id: 52
layout: truffle-tutorial.html
title: Graal Truffle tutorial part 2 – introduction to specializations
summary: |
  In the second part of the Truffle tutorial,
  we introduce one of the most important concepts for achieving high performance with Truffle –
  specializations.
created_at: 2020-11-16
---

In the [previous article](/graal-truffle-tutorial-part-1-setup-nodes-calltarget),
we started the implementation of a Truffle interpreter for EasyScript,
our simplified subset of JavaScript.
The first step was handling addition of integer numbers.
And while a simple case like `12 + 34` is handled correctly,
our implementation actually contains a bug.

## The issue with `int`s

The problem is that we implemented addition with the `int` Java type,
which is 32 bits.
However, JavaScript actually uses 64-bit floating-point numbers.
This means that our implementation is incorrect with regards to things like overflow.
It can be showed with the following simple test:

```java
import com.oracle.truffle.api.CallTarget;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

public class OverflowTest {
    @Test
    public void adding_1_to_int_max_overflows() {
        EasyScriptNode exprNode = new AdditionNode(
                new IntLiteralNode(Integer.MAX_VALUE),
                new IntLiteralNode(1));
        var rootNode = new EasyScriptRootNode(exprNode);
        CallTarget callTarget = rootNode.getCallTarget();

        var result = callTarget.call();

        assertEquals(Integer.MIN_VALUE, result);
    }
}
```

As this test shows, when we add `1` to `Integer.MAX_VALUE`,
it overflows and results in `Integer.MIN_VALUE`.
However, that's not what happens in JavaScript;
when you execute `node -p '2147483647 + 1'`,
you get back `2147483648`, not `-2147483648`.

## Naive solution

One way to fix this problem is to simply switch from using `int`s to `double`s everywhere.
And while that would certainly be correct,
it would not be optimal from a performance perspective.

Operations like addition, multiplication, division, etc.
on floating-point numbers like `double`
are more expensive in terms of CPU cycles than the equivalent operations on integers.
We know that JavaScript code uses integers frequently:
in loops like `for (let i = 0; i < n; i++)`,
for array indexes, for string lengths, etc.
If we used `double`s in all those cases,
our implementation would be simpler,
but we would be making the language unnecessarily slower.

## Optimal solution

Fortunately, there is a way to make the implementation both efficient,
and semantically correct.
The technique to achieve that is **specialization**.

What that means is that a given Node in the AST can deliberately decide to handle only a subset of all possible inputs.
For example, in the case of EasyScript,
a Node can decide it only handles the addition of 32-bit integers.
That special-casing means that when the Node gets JITted,
the compiler can produce very efficient machine code for it;
in our case, that would be machine code for adding 32-bit integers,
instead of 64-bit floating-point numbers.

Of course, the key to this technique is that specialization is _speculative_.
The generated native code must check some assumptions every time it's executed,
and when they stop being true
(for example, we're passed two integers whose sum overflows `Integer.MAX_VALUE`),
the code needs to _deoptimize_.
That means jumping back from machine code back to the interpreter code,
and discarding the previously generated machine code
(deoptimization is a common technique for all JIT compilers,
as many of the optimizations they perform are speculative).
The code might be JIT-compiled again in the future, of course --
just resulting in different machine code this time.

## Specialization states

What that means in practice is that our Nodes become small state machines.
They begin in the _uninitialized_ state when they are first interpreted,
and, depending on the results of executing their children,
transition into different states where they handle some subset of all possible inputs.
If the node is in a state that handles a given subset of inputs,
we say the specialization for that subset is _active_.
If the node is in a state that handles all possible inputs,
we call that the _generic_ state.

In JIT literature, you might come across this state machine being called an **inline cache**
(or sometimes a **polymorphic inline cache**,
although this longer term is a actually less precise than the shorter one).
The "inline" here refers to the fact that the cache is kept in the AST node itself,
as opposed to being global for the entire program.

If there is a single active specialization,
we say that the inline cache is *monomorphic* --
which is the best possible case from a performance optimization perspective.
If the number of active specializations is larger than one,
but still relatively small
(how small exactly usually depends on the exact JIT compiler and its version being discussed,
but the cutoff is generally somewhere around four),
we say the cache is in a *polymorphic* state.
That's worse from a performance perspective than monomorphic,
but not the worst;
that would be the *megamorphic* state,
which is when the number of active specializations exceeds that above "small" threshold.
The optimizing compiler usually has some tricks up its sleeve to improve the performance of polymorphic cases,
but gives up completely for megamorphic ones,
and simply emits the obvious (and slow) code.

If you're interested in learning more about inline caches,
I would recommend
[this blog article](https://mrale.ph/blog/2015/01/11/whats-up-with-monomorphism.html)
by Vyacheslav Egorov --
he talks about V8,
the optimizing JavaScript runtime that is part of the Chrome browser,
but most of what he says is broadly applicable to all JIT compilers for all dynamically-typed languages.

Let's draw this state machine for our current EasyScript implementation.
Since we have to introduce `double`s anyway to handle `int`s overflowing,
let's also add `double` literals to the language.
With that feature,
the state machine diagram for our `AdditionNode` looks like this:

![Uninitialized, Integer and Double states diagram](/img/truffle-specialization-fsm.png)

We can examine the various state transitions on a specific example.
Let's say we have the following function:

(And yes, I realize we don't support defining functions in EasyScript yet.
We'll get there, I promise!)

```js
function add(a, b) {
    return a + b; // <--- AdditionNode instance
}
```

Depending on the arguments `add` is called with,
the `AdditionNode` in its body changes its specialization state.

It starts, before the program is executed, in the uninitialized state.
When the first call to the function during program execution is `add(1, 2)`,
it transitions to the `Integer` state,
where only the `int` specialization is active.
As long as `add` gets called with arguments that are integers whose sum is between `Integer.MIN_VALUE` and `Integer.MAX_VALUE`,
the `AdditionNode` remains in the `Integer` state.
If it gets JIT-compiled in that state,
it will produce very efficient machine code that only deals with adding 32-bit integers.

But if `add` is later called during program execution with at least one `double` argument, like `2.5`,
it transitions from the `Integer` state to `Double`,
which is the generic state in our case
(since `double`s are a superset of `int`s).
If the node was JIT-compiled in the previous `Integer` state,
that code will deoptimize,
and be replaced with a jump back to the Java interpreter code.
If the node gets JIT-compiled again,
this time it will generate machine code for adding 64-bit floating-point numbers.

## Specializations finiteness

Now, the fact that `Double` is the final state is not trivially obvious.
You might ask,
given the following sequence of calls:

```js
add(1.5, 2.5);
add(1, 2);
```

Why doesn't that last call result in a transition back to the `Integer` state?
For all we know, the next parts of the program call `add(5, 10)` a hundred times,
and in that case the `Integer` state would result in generating more efficient code.

The reason why there is no transition back to the `Integer` state is the speculative nature of its JIT compilation.
In theory, every time the compiler generates native code when the `int` specialization is active,
that code can be invalidated later in the program execution --
if `add` is called with arguments that can't be represented by `int`s.
If we transitioned back to the `Integer` state every time `add` was called with small `int` arguments,
we also risk this deoptimization happening again later.
And deoptimization is an extremely expensive operation,
as it involves basically throwing away the previously generated machine code,
and going back to slow JVM bytecode.

Because of how expensive it is,
the number of times code needs to be deoptimized should be kept to a minimum.
That's why it's better to risk generating suboptimal machine code in some cases,
than trying to generate the optimal one,
but risk getting stuck in a cycle where deoptimization happens constantly as the specialization state bounces between `Integer` and `Double`.
If that happens, any performance gains from executing better native code would be eradicated by the huge deoptimization penalty.

For those reasons, the specialization states must have the property of _finiteness_:
a node can only have a finite number of possible transitions before reaching the generic state.
Our diagram from above has this property:
you can have at most 2 transitions before reaching the generic `Double` state.
Note, however, that if we added a transition from `Double` back to `Integer`,
this property would no longer hold.

## Specializations in Truffle

Let's see how you express specializations in Truffle,
using on our EasyScript implementation as an example.

The first step to implementing specializations is to have multiple `execute*()` methods.
Along the `int`-returning `executeInt` from [part 1](/graal-truffle-tutorial-part-1-setup-nodes-calltarget),
we'll also add `executeDouble` that returns a `double`.
We'll also add an `executeGeneric` that returns an `Object`,
which is not strictly necessary right now, but the Truffle DSL
(which we discuss in the next article)
requires it,
and we will need it for handling complex types like strings, objects, arrays, etc. later anyway,
so we might as well add it now.

This is what our base node class looks like:

```java
import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.nodes.Node;
import com.oracle.truffle.api.nodes.UnexpectedResultException;

public abstract class EasyScriptNode extends Node {
    public abstract int executeInt(VirtualFrame frame) throws UnexpectedResultException;

    public abstract double executeDouble(VirtualFrame frame);

    public abstract Object executeGeneric(VirtualFrame frame);
}
```

You might notice that `executeInt` throws `UnexpectedResultException`.
This is an exception that's used in Truffle to indicate that the Node's value cannot be represented in the given type;
this happens when the number that is the result of executing the given node doesn't fit in an `int`.

The integer literal node is the again the simplest --
we simply return its value in all cases:

```java
import com.oracle.truffle.api.frame.VirtualFrame;

public final class IntLiteralNode extends EasyScriptNode {
    private final int value;

    public IntLiteralNode(int value) {
        this.value = value;
    }

    @Override
    public int executeInt(VirtualFrame frame) {
        return this.value;
    }

    @Override
    public double executeDouble(VirtualFrame frame) {
        return this.value;
    }

    @Override
    public Object executeGeneric(VirtualFrame frame) {
        return this.value;
    }
}
```

The new floating-point literal node is almost as simple:

```java
import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.nodes.UnexpectedResultException;

public final class DoubleLiteralNode extends EasyScriptNode {
    private final double value;

    public DoubleLiteralNode(double value) {
        this.value = value;
    }

    @Override
    public double executeDouble(VirtualFrame frame) {
        return this.value;
    }

    @Override
    public Object executeGeneric(VirtualFrame frame) {
        return this.value;
    }

    @Override
    public int executeInt(VirtualFrame frame) throws UnexpectedResultException {
        throw new UnexpectedResultException(this.value);
    }
}
```

The only difference from the integer literal node is that we throw
`UnexpectedResultException` for `executeInt`,
as we can't return a `double` value as an `int`.
Notice that we pass the node's value when throwing the exception.

Finally, we need to implement `AdditionNode`.
It will be quite complicated, so we'll show the code in fragments.

We'll start with declaring an enum representing the state in our state machine:

```java
import com.oracle.truffle.api.CompilerDirectives;

public final class AdditionNode extends EasyScriptNode {
    @SuppressWarnings("FieldMayBeFinal")
    @Child
    private EasyScriptNode leftNode, rightNode;

    private enum SpecializationState { UNINITIALIZED, INT, DOUBLE }

    @CompilerDirectives.CompilationFinal
    private SpecializationState specializationState;

    public AdditionNode(EasyScriptNode leftNode, EasyScriptNode rightNode) {
        this.leftNode = leftNode;
        this.rightNode = rightNode;
        this.specializationState = SpecializationState.UNINITIALIZED;
    }

    // ...
}
```

Notice that the field representing the state is annotated with `@CompilerDirectives .CompilationFinal`.
This directive tells Graal to treat this field as a constant during partial evaluation,
even though it's not marked as `final`.
This is crucial in making sure that efficient machine code is generated for each active specialization.

We start with the `executeDouble` method, which is very simple:

```java
import com.oracle.truffle.api.frame.VirtualFrame;

public final class AdditionNode extends EasyScriptNode {
    // ...

    @Override
    public double executeDouble(VirtualFrame frame) {
        double leftValue = this.leftNode.executeDouble(frame);
        double rightValue = this.rightNode.executeDouble(frame);
        return leftValue + rightValue;
    }

    // ...
}
```

`executeInt` is much more complicated,
because we have to handle the `UnexpectedResultException` in all cases:

```java
import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.nodes.UnexpectedResultException;

public final class AdditionNode extends EasyScriptNode {
    // ...

    @Override
    public int executeInt(VirtualFrame frame) throws UnexpectedResultException {
        int leftValue;
        try {
            leftValue = this.leftNode.executeInt(frame);
        } catch (UnexpectedResultException e) {
            this.activateDoubleSpecialization();
            double leftDouble = (double) e.getResult();
            throw new UnexpectedResultException(leftDouble + this.rightNode.executeDouble(frame));
        }

        int rightValue;
        try {
            rightValue = this.rightNode.executeInt(frame);
        } catch (UnexpectedResultException e) {
            this.activateDoubleSpecialization();
            double rightDouble = (double) e.getResult();
            throw new UnexpectedResultException(leftValue + rightDouble);
        }

        try {
            return Math.addExact(leftValue, rightValue);
        } catch (ArithmeticException e) {
            this.activateDoubleSpecialization();
            throw new UnexpectedResultException((double) leftValue + (double) rightValue);
        }
    }

    private void activateDoubleSpecialization() {
        this.specializationState = SpecializationState.DOUBLE;
    }

    // ...
}
```

`Math.addExact` performs integer addition,
but throws `ArithmeticException` if the sum overflows.
In that case, we resort back to operating on `double`s.

Finally, we have `executeGeneric`.
In case any specialization is already active,
we delegate to the appropriate `execute*()` method.
If not, we call `executeGeneric` on the children of the node:

```java
import com.oracle.truffle.api.CompilerDirectives;
import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.nodes.UnexpectedResultException;

public final class AdditionNode extends EasyScriptNode {
    // ...

    @Override
    public Object executeGeneric(VirtualFrame frame) {
        if (this.specializationState == SpecializationState.INT) {
            try {
                return this.executeInt(frame);
            } catch (UnexpectedResultException e) {
                this.activateDoubleSpecialization();
                return e.getResult();
            }
        }
        if (this.specializationState == SpecializationState.DOUBLE) {
            return this.executeDouble(frame);
        }
        // uninitialized case
        Object leftValue = this.leftNode.executeGeneric(frame);
        Object rightValue = this.rightNode.executeGeneric(frame);
        CompilerDirectives.transferToInterpreterAndInvalidate();
        return this.executeAndSpecialize(leftValue, rightValue);
    }

    private Object executeAndSpecialize(Object leftValue, Object rightValue) {
        if (leftValue instanceof Integer && rightValue instanceof Integer) {
            try {
                int result = Math.addExact((int) leftValue, (int) rightValue);
                this.activateIntSpecialization();
                return result;
            } catch (ArithmeticException e) {
                // fall through to the double case below
            }
        }
        this.activateDoubleSpecialization();
        // one or both of the values might be Integers,
        // because of the && above, and the possibility of overflow
        return convertToDouble(leftValue) + convertToDouble(rightValue);
    }

    private void activateIntSpecialization() {
        this.specializationState = SpecializationState.INT;
    }

    private static double convertToDouble(Object value) {
        if (value instanceof Integer) {
            return ((Integer) value).doubleValue();
        }
        return (double) value;
    }
}
```

The `transferToInterpreterAndInvalidate()` call is another Graal hint,
telling it that,
if the code for this Node was JIT-compiled before it was first executed
(so when the specialization state was still "uninitialized"),
reaching here should invalidate that machine code and jump back into the interpreter.
We have to do that, as `executeAndSpecialize()` mutates the `specializationState` field,
which we told Graal can be treated as a constant during partial evaluation.

If you're curious how this code get JITted,
the fact that `specializationState` is treated as a constant is crucial.
This allows Graal to eliminate the `if` expressions that check the value of this field:
either by getting rid of checking the condition if it sees it always evaluates to `true`,
or by [eliminating the entire `if` statement](https://en.wikipedia.org/wiki/Dead_code_elimination)
if it knows its condition is always  `false`.
Thanks to that, the resulting machine code is much smaller than the original interpreter code,
and it applies only to a subset of all inputs --
for example, always dealing with the numbers as `int`s.

Of course, all of those optimizations are speculative,
and the assumption checking is implemented with Java exceptions.
`catch` blocks are always treated specially when JITting;
they implicitly cause deoptimization
(unless they're for one of a few exception types used for control flow,
which we'll see in later parts of the series),
so we can safely activate a different specialization in their bodies,
without having to explicitly call `transferToInterpreterAndInvalidate()`.

We can verify our implementation now handles integer overflow correctly with a unit test:

```java
import com.oracle.truffle.api.CallTarget;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

public class OverflowTest {
    @Test
    public void adding_1_to_int_max_does_not_overflow() {
        EasyScriptNode exprNode = new AdditionNode(
                new IntLiteralNode(Integer.MAX_VALUE),
                new IntLiteralNode(1));
        var rootNode = new EasyScriptRootNode(exprNode);
        CallTarget callTarget = rootNode.getCallTarget();

        var result = callTarget.call();

        assertEquals(Integer.MAX_VALUE + 1D, result);
    }
}
```

You can check out the [full code on GitHub](https://github.com/skinny85/graalvm-truffle-tutorial/tree/master/part-02).

## Next article

So, we've managed to implement JavaScript addition with correct handling of `int` overflow, 
without compromising performance in case the values fit into 32 bits,
using specializations.
But it took us over 100 lines of code to achieve it,
and we haven't even covered the entire semantics of the 'plus' operator in JavaScript yet,
which allows string concatenation, and even adding arbitrary values
(for example, the expression `{} + []` is valid in JavaScript).

In the [next part](/graal-truffle-tutorial-part-3-specializations-with-truffle-dsl-typesystem) of the series, we'll see how to use the
[Truffle DSL](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/dsl/package-summary.html)
to achieve exactly the same result,
but with a fraction of the code.
