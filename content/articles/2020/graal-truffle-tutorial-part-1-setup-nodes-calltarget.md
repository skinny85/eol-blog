---
id: 50
layout: truffle-tutorial.html
title: Graal Truffle tutorial part 1 – setup, Nodes, CallTarget
summary: |
  In the (actual) first part of the Truffle tutorial,
  we'll go through downloading and installing GraalVM locally,
  and then we'll start learning Truffle by implementing the addition of integer literals.
  Just that simple task will introduce us to the foundational Truffle APIs:
  Node, RootNode and CallTarget.
created_at: 2020-09-24
---

Now that we
[know what Truffle (and Graal) is](/graal-truffle-tutorial-part-0-what-is-truffle),
let's get started with a simple example that shows the basic Truffle features:
`Node`, `RootNode`, and `CallTarget`.

To make the concepts in this series more concrete,
I'll be showing code of a Truffle implementation of a language I call EasyScript,
which is a very simplified subset of JavaScript.
We'll start with basics expressions in this part,
and add more features to the language as the series progresses.

Let's begin by setting up GraalVM.

## GraalVM setup

We need a GraalVM installation on our local machine.
The free Community Edition works fine if you don't have the paid Enterprise Edition.
You can download it from here: https://github.com/graalvm/graalvm-ce-builds/releases
(we need one of the binaries whose name starts with `graalvm-ce`).
The example code I'll be showing in these blog posts uses Java 11 features,
so make sure to download a version for Java 11.

Once you've downloaded the correct archive for your operating system and extracted it somewhere on your machine,
you need to set the `JAVA_HOME`
environment variable to point to the directory containing the uncompressed contents:

```shell-session
$ export JAVA_HOME=/path/to/extracted/archive
```

You can verify the installation works by executing the `java`
command using `JAVA_HOME`:

```shell-session
$ $JAVA_HOME/bin/java -version

openjdk version "17.0.5" 2022-10-18
OpenJDK Runtime Environment GraalVM CE 22.3.0 (build 17.0.5+8-jvmci-22.3-b08)
OpenJDK 64-Bit Server VM GraalVM CE 22.3.0 (build 17.0.5+8-jvmci-22.3-b08, mixed mode, sharing)
```

## AST

Now that we have the necessary tools installed,
let's talk about the basic Truffle concepts.

A language's compiler is usually visualized as a pipeline,
where each stage's output is used as the input to the next stage:

- The first stage is the **lexer**,
  whose input is a stream of characters obtained from reading the source files.
  It produces a stream of **tokens** as output.
- The second stage is the **parser**,
  that takes that stream of tokens as input,
  and produces an **abstract syntax tree** (AST)
  as output.
- The third stage is **semantic analysis**,
  that takes the AST as input,
  and produces the **symbol table**,
  and optionally the **annotated AST**,
  as output.
- The fourth stage is the **intermediate code generator**,
  that takes the the symbol table,
  and either the regular or annotated AST,
  as inputs,
  and produces an **intermediate code representation** as its output.
  For example, the
  [Static Single Assignment form](https://en.wikipedia.org/wiki/Static_single_assignment_form)
  that I mentioned in the
  [previous article of the series](/graal-truffle-tutorial-part-0-what-is-truffle)
  is a popular intermediate representation.
- The fifth stage is the **optimizer**,
  that takes this intermediate code as input,
  and produces the same type of intermediate representation,
  but (hopefully!) one that is more efficient when executed than the input it received,
  by applying a whole slew of various optimizations to it.
  This is traditionally the biggest and most complicated stage of compilation.
- And finally, the last stage is the **code generator**,
  that takes the intermediate representation as input,
  and emits from it the final code in whatever format the compiler supports.
  Some popular output formats are assembly, machine code,
  Java bytecode, or [LLVM bitcode](https://llvm.org/docs/BitCodeFormat.html).

To simplify the process of implementing languages,
Truffle replaces everything after stage 3.
It asks you to create an interpreter of the abstract syntax tree
(either annotated, or regular --
it's up to the language author to decide,
Truffle doesn't care about that distinction).
Because of this, the concept of the AST is central to Truffle.

If you've never seen an abstract syntax tree before,
here's an example.
Let's say we have the following JavaScritpt code:

```js
function factorial(n) {
    if (n < 3)
        return n;
    return n * factorial(n - 1);
}
```

The AST for this code will look something like:

```shell-session
FunctionNode(name: "factorial", arguments: ["n"])
    StatementBlockNode
        IfStatementNode
            LessThanNode
                ReferenceNode(name: "n")
                IntLiteralNode(value: 3)
            ReturnStatementNode
                ReferenceNode(name: "n")
        ReturnStatementNode
            MultiplyNode
                ReferenceNode(name: "n")
                FunctionCallNode
                    ReferenceNode(name: "factorial")
                    SubtractNode
                        ReferenceNode(name: "n")
                        IntLiteralNode(value: 1)
```

As we can see,
there are different kinds of nodes,
with different attributes
(for example, `FunctionNode` has two attributes,
`name` and `arguments`;
`IntLiteralNode` has one attribute, `value`).
As with all trees, the nodes also have children.
Some node types have a set number of children
(for example, both `LessThanNode` and `SubtractNode` always have 2 children,
as they're binary operations),
while others have a variable number of children
(like `StatementBlockNode`, that can have arbitrary many children,
each being a statement in the block).

A Truffle language implementation consists of an interpreter of such an AST.
In this series, we'll explore the various APIs Truffle offers for representing and executing that interpreter.

## Truffle `Node`

A vertex in the AST is represented in Truffle by the `Node`
class from the `com.oracle.truffle.api.nodes` package.
It's an abstract class that you're supposed to extend.
Usually, each node kind like we've seen above will become a separate subclass of `Node` in the class hierarchy
(so, there'll be a subclass for `IfStatementNode`,
a separate one for `LessThanNode`, etc.).

When you subclass `Node`,
you might be surprised that the class doesn't have any abstract methods.
Since these nodes are meant to be interpreted,
you might expect some abstract `interpret` method that you have to override.
But it doesn't work that way.
Instead, Truffle expects you to define that interpretation method yourself
(the reason it does that are type specializations,
which are specific to the language being implemented;
we will cover specializations in detail in later parts of the tutorial).
For that reason, it's very common to define your own abstract superclass for all node kinds of your language.

We'll do that for EasyScript here.
In this first iteration,
our language will be extremely simple:
it will only allow the addition of integer literals
(so, expressions like `1 + 2 + 3`).
Because of that, our superclass will define the interpret method to return `int`:

```java
import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.nodes.Node;

public abstract class EasyScriptNode extends Node {
    public abstract int executeInt(VirtualFrame frame);
}
```

Truffle places pretty strict requirements on the "interpret" method.
It has to start with `execute`,
and take a `frame` as the only argument
(a `VirtualFrame` corresponds to an activation record on the call stack,
and is used for things like local variables.
We'll talk about it in more detail in later parts of the tutorial).

Our first node is the integer literal node,
and it's very simple:

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
}
```

And the second one is the addition node:

```java
import com.oracle.truffle.api.frame.VirtualFrame;

public final class AdditionNode extends EasyScriptNode {
    @SuppressWarnings("FieldMayBeFinal")
    @Child
    private EasyScriptNode leftNode, rightNode;

    public AdditionNode(EasyScriptNode leftNode, EasyScriptNode rightNode) {
        this.leftNode = leftNode;
        this.rightNode = rightNode;
    }

    @Override
    public int executeInt(VirtualFrame frame) {
        int leftValue = this.leftNode.executeInt(frame);
        int rightValue = this.rightNode.executeInt(frame);
        return leftValue + rightValue;
    }
}
```

The most interesting part here is the `@Child` annotation.
That's how you tell Truffle those attributes are actually subnodes of the AST.
Interestingly, they cannot be `final`,
as Truffle needs the capability to rewrite parts of the AST as it gathers profiling information about your code,
hence the `@SuppressWarnings("FieldMayBeFinal")`.
However, during partial evaluation,
they will be treated as effectively final,
thanks to the `@Child` annotation.

## Entrypoint -- `RootNode`

So, are we done --
can we write a unit test that interprets a simple expression?
Not so fast.
While we have nodes to represent parts of the AST,
we're missing a top-level node that acts as the entrypoint for the interpreter.
Those kinds of nodes are represented in Truffle as subclasses of `RootNode`
(which is itself a subclass of `Node`),
from the same package `com.oracle.truffle.api.nodes`.

A `RootNode` represents a callable AST.
Most commonly, those are functions or methods,
but they also represent the top-level language entrypoints
(for example, in Java,
you can execute a class,
which will invoke its static `main` method;
in NodeJs, you can execute the given code with the `-e` switch,
like `node -e 'console.log("Hello, world!");'`; etc.).

Interestingly, `RootNode` _does_ have an abstract `execute`
method that you have to override.
In our case, it will be easy to implement --
we will just delegate straight to an `EasyScriptNode`
that we get through the constructor:

```java
import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.nodes.RootNode;

public final class EasyScriptRootNode extends RootNode {
    @SuppressWarnings("FieldMayBeFinal")
    @Child
    private EasyScriptNode exprNode;

    public EasyScriptRootNode(EasyScriptNode exprNode) {
        super(null);

        this.exprNode = exprNode;
    }

    @Override
    public Object execute(VirtualFrame frame) {
        return this.exprNode.executeInt(frame);
    }
}
```

## Invokable element -- `CallTarget`

So, now we have to be done, right?
Now we can finally write our first unit test?
Nope, there's one more Truffle API we need to learn first,
and that is the concept of `CallTarget`s.

`CallTarget`s are a layer of indirection that wrap `RootNode`s.
Unlike nodes,
this is an interface whose instances are created by calling methods on other instances,
not an abstract class that you're supposed to extend.
They are used for:

* gathering profiling information about your code;
* passing arbitrary arguments when performing the call,
  which allows the language to implement things like passing arguments from the command line to the entrypoint function,
  like Java does with the `String[]` parameters to the `main` method,
  for example;
* and creating the `VirtualFrame` object that is passed to its underlying
  `RootNode`'s `execute` method.

Historically, `CallTarget`s were created by calling the `createCallTarget()`
static factory method of the `TruffleRuntime` interface,
which is a singleton you obtained by calling `getRuntime()`
on the `Truffle` class,
and passing it a `RootNode` instance.
However, starting in version `22` of GraalVM,
this API has been removed,
and you now get references to `CallTarget`s from `RootNode`s
by calling their `getCallTarget()` methods.

With this information,
we are finally ready to write our unit test:

```java
import com.oracle.truffle.api.CallTarget;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

public class ExecuteNodesTest {
    @Test
    public void adds_12_and_34_correctly() {
        EasyScriptNode exprNode = new AdditionNode(
            new IntLiteralNode(12),
            new IntLiteralNode(34));
        var rootNode = new EasyScriptRootNode(exprNode);
        CallTarget callTarget = rootNode.getCallTarget();

        var result = callTarget.call();

        assertEquals(46, result);
    }
}
```

Phew! It was a lot of work,
but we finally managed to add `12` and `34` together using Truffle!

All the code from the article is
[available on GitHub](https://github.com/skinny85/graalvm-truffle-tutorial/blob/master/part-01).

## Next article

In [part 2](/graal-truffle-tutorial-part-2-introduction-to-specializations) of the series,
we'll introduce one of the most important concepts in Truffle --
**specializations**.
