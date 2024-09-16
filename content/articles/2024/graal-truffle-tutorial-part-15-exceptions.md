---
id: 78
layout: truffle-tutorial.html
title: "Graal Truffle tutorial part 15 – exceptions"
summary: |
   In the fifteenth part of the Truffle tutorial,
   we implement exception handling - throwing them, catching them,
   and making sure they provide the correct stack traces.
   Along the way, we will learn about new Truffle concepts like source sections,
   stack trace elements, and more.
created_at: 2024-08-31
---

## Introduction

In the [previous chapter](/graal-truffle-tutorial-part-14-classes-3-inheritance-super)
of the tutorial on GraalVM Truffle,
we finished the implementation of classes in EasyScript,
our simplified subset of JavaScript.

But there is an important kind of class that has additional capabilities in many languages:
[exceptions](https://en.wikipedia.org/wiki/Exception_handling).
These are special objects that are used for signaling error conditions that the given piece of code does not know how to handle.

Since exceptions are a popular feature present in many languages,
including JavaScript, we will show how to implement them in Truffle.
As part of that implementation, we will introduce a few new Truffle concepts,
like the [`SourceSection` class](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/source/SourceSection.html),
the [`StackTrace` class](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/TruffleStackTrace.html),
and the [`TruffleStackTraceElement` class](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/TruffleStackTraceElement.html).

## Parsing

As usual, we start with the
[ANTLR grammar](https://www.antlr.org) changes.
There are two statements related to exceptions:
`throw`, which raises an exception,
and `try`-`catch`, which handles exceptions.

The tricky part of `try`-`catch` is that that statement can also have a `finally` part,
which is a block of code that executes regardless whether the
`try` part resulted in an exception being thrown, or not.
The reason that is tricky to parse is that,
while `finally` is optional after `try`-`catch`,
there is also another form of `try` where `catch` is missing --
but in that case, `finally` is required.
The way we handle that is by having two grammar rules --
one where `catch` is required, but `finally` is optional,
and another where `catch` is not allowed, but `finally` is required:

```shell-session
stmt :                                                                'throw' expr1 ';'? #ThrowStmt
     | 'try' t=stmt_block 'catch' '(' ID ')' c=stmt_block ('finally' f=stmt_block)? ';'? #TryCatchStmt
     |                                    'try' t=stmt_block 'finally' f=stmt_block ';'? #TryFinallyStmt
     ...

stmt_block : '{' stmt* '}' ;

...
```

## The `throw` statement

The simplest part of exception handling is raising an exception.
In Truffle, the exception we raise must extend `AbstractTruffleException`,
otherwise it will be considered a bug in your interpreter
(for example, if you forgot to check a value for potentially being `null`,
and that resulting in a `NullPointerException`).

Fortunately, we already have an exception in our implementation that extends
`AbstractTruffleException` -- `EasyScriptException`.
Up to this part, we've only been using it for built-in errors,
like having a `const` variable without an initializer,
or reading a property of `undefined` --
however, we can repurpose it to handle user-defined exceptions as well.

In JavaScript, raising exceptions is accomplished with the `throw` statement.
Unlike in many languages, JavaScript allows raising any value,
not only a subclass of a specific class, like `Throwable` in Java.
In order to handle that capability, we add a `value` field to `EasyScriptException`
that we will use later in the `catch` statement:

```java
import com.oracle.truffle.api.exception.AbstractTruffleException;
import com.oracle.truffle.api.nodes.Node;

public final class EasyScriptException extends AbstractTruffleException {
    public final Object value;

    public EasyScriptException(Object value) {
        this.value = value;
    }

    // these two constructors are for the built-in errors,
    // and were defined in previous parts

    public EasyScriptException(String message) {
        this(null, message);
    }

    public EasyScriptException(Node location, String message) {
        super(message, location);
        
        this.value = null;
    }
}
```

The implementation of the `throw` statement itself is very simple:
we evaluate the expression for the value being thrown,
and then use Java's `throw` statement to raise an instance of `EasyScriptException`:

```java
import com.oracle.truffle.api.frame.VirtualFrame;

public final class ThrowStmtNode extends EasyScriptStmtNode {
    @SuppressWarnings("FieldMayBeFinal")
    @Child
    private EasyScriptExprNode exceptionExpr;

    public ThrowStmtNode(EasyScriptExprNode exceptionExpr) {
        this.exceptionExpr = exceptionExpr;
    }

    @Override
    public Object executeStatement(VirtualFrame frame) {
        Object value = this.exceptionExpr.executeGeneric(frame);
        throw new EasyScriptException(value);
    }
}
```

## Filling polyglot stack traces

With that in place, we can try executing some EasyScript code with a `throw` statement.
We will use the [`Source` class](https://www.graalvm.org/truffle/javadoc/org/graalvm/polyglot/Source.html)
and the [`Context.eval(Source)` method](https://www.graalvm.org/truffle/javadoc/org/graalvm/polyglot/Context.html#eval(org.graalvm.polyglot.Source%29),
instead of the
[`Context.eval(String, String)` method](https://www.graalvm.org/truffle/javadoc/org/graalvm/polyglot/Context.html#eval(java.lang.String,java.lang.CharSequence%29)
which we used in previous parts of the series,
as we want to make sure the line numbers in the source code are preserved in the stack trace:

```java
import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.Source;
import java.io.File;

Source source = Source
    .newBuilder("ezs", new File("exceptions-nested.js"))
    .build();
Context context = Context.create();
context.eval(source);
```

Where `exceptions-nested.js` is:

```js
function main() {
    f1();
}
function f1() {
    let x = f2();
    return x;
}
function f2() {
    return f3();
}
function f3() {
    throw 'Exception in f3()';
}
main();
```

The start of the stack trace we see when this code executes looks as follows:

```shell-session
org.graalvm.polyglot.PolyglotException
	at <ezs> null(Unknown)
	at <ezs> null(Unknown)
	at <ezs> null(Unknown)
	at <ezs> null(Unknown)
	at <ezs> null(Unknown)
	at org.graalvm.sdk/org.graalvm.polyglot.Context.eval(Context.java:399)
	...
```

Clearly, this is missing some crucial information, so we need to fix this stack trace.

The first thing we can do is override the
[`getName()` method of `RootNode`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/nodes/RootNode.html#getName(%29).
Truffle will call this method whenever an uncaught exception passes through the
[`execute()` method of `RootNode`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/nodes/RootNode.html#execute(com.oracle.truffle.api.frame.VirtualFrame%29):

```java
import com.oracle.truffle.api.frame.FrameDescriptor;
import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.nodes.RootNode;

public final class StmtBlockRootNode extends RootNode {
    @SuppressWarnings("FieldMayBeFinal")
    @Child
    private EasyScriptStmtNode blockStmt;

    private final String name;

    public StmtBlockRootNode(EasyScriptTruffleLanguage truffleLanguage,
            FrameDescriptor frameDescriptor, BlockStmtNode blockStmt, String name) {
        this(truffleLanguage, frameDescriptor, (EasyScriptStmtNode) blockStmt, name);
    }

    public StmtBlockRootNode(EasyScriptTruffleLanguage truffleLanguage,
            FrameDescriptor frameDescriptor, UserFuncBodyStmtNode blockStmt, String name) {
        this(truffleLanguage, frameDescriptor, (EasyScriptStmtNode) blockStmt, name);
    }

    private StmtBlockRootNode(EasyScriptTruffleLanguage truffleLanguage,
            FrameDescriptor frameDescriptor, EasyScriptStmtNode blockStmt, String name) {
        super(truffleLanguage, frameDescriptor);

        this.blockStmt = blockStmt;
        this.name = name;
    }

    @Override
    public Object execute(VirtualFrame frame) {
        return this.blockStmt.executeStatement(frame);
    }

    @Override
    public String getName() {
        return this.name;
    }
}
```

For user-defined functions or methods, we will pass their name as the value of the `name` parameter,
and for the top-level code inside a file,
we use the `:program` string, same as the GraalVM JavaScript implementation.

This makes the stack trace look as follows:

```shell-session
org.graalvm.polyglot.PolyglotException
	at <ezs> f3(Unknown)
	at <ezs> f2(Unknown)
	at <ezs> f1(Unknown)
	at <ezs> main(Unknown)
	at <ezs> :program(Unknown)
	at org.graalvm.sdk/org.graalvm.polyglot.Context.eval(Context.java:399)
	...
```

This is better, but we are still missing the source information in parentheses.
You can specify that by overriding the
[`getSourceSection()` method of `Node`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/nodes/Node.html#getSourceSection(%29)
to point to the place in the text of the source code that this Node corresponds to.

Thankfully, the parsing technology we use,
[ANTLR](https://www.antlr.org), preserves this information in the
`start` and `stop` fields of the 
[`ParserRuleContext` class](https://javadoc.io/doc/org.antlr/antlr4-runtime/4.7/org/antlr/v4/runtime/ParserRuleContext.html#start),
which all classes generated from the grammar extend.

So, in our parser, we can create a helper method that creates a
`SourceSection` instance from a given parse element
(note that we need to add `1` to the ending position,
as ANTLR uses 0-based indexing for it,
while Truffle needs 1-based indexes):

```java
import com.oracle.truffle.api.source.SourceSection;
import org.antlr.v4.runtime.ParserRuleContext;

public final class EasyScriptTruffleParser {
    // ...

    private SourceSection createSourceSection(ParserRuleContext parseElement) {
        return this.source.createSection(
                parseElement.start.getLine(), parseElement.start.getCharPositionInLine() + 1,
                parseElement.stop.getLine(), parseElement.stop.getCharPositionInLine() + 1);
    }
}
```

Since we now need to hold on to the original `Source` to implement this `createSourceSection()` helper method,
we change our parser API slightly to pass it to our instance when constructing it:

```java
import com.oracle.truffle.api.source.Source;

public final class EasyScriptTruffleParser {
    private final Source source;

    private EasyScriptTruffleParser(Source source, ShapesAndPrototypes shapesAndPrototypes) {
        this.source = source;

        // ...
    }

    // ...
}
```

With the `createSourceSection()` helper method in place, we can create a `SourceSection` when parsing a given language construct,
and pass it to the Truffle Node that will be created for it.
In theory, every Node can override `getSourceSection()`; in our implementation,
we'll only do it for the few statement Nodes that can result in exceptions being thrown
(`ExprStmtNode`, `ReturnStmtNode`, and `ThrowStmtNode`),
to save on some repeated code
(of course, feel free to expand that list in your own language's implementation).
Here's an example for `ThrowStmtNode` from above:

```java
public final class EasyScriptTruffleParser {
    // ...

    private ThrowStmtNode parseThrowStmt(EasyScriptParser.ThrowStmtContext throwStmt) {
        return new ThrowStmtNode(this.parseExpr1(throwStmt.expr1()),
                this.createSourceSection(throwStmt));
    }
}
```

```java
import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.source.SourceSection;

public final class ThrowStmtNode extends EasyScriptStmtNode {
    @SuppressWarnings("FieldMayBeFinal")
    @Child
    private EasyScriptExprNode exceptionExpr;

    private final SourceSection sourceSection;

    public ThrowStmtNode(EasyScriptExprNode exceptionExpr, SourceSection sourceSection) {
        this.exceptionExpr = exceptionExpr;
        this.sourceSection = sourceSection;
    }

    @Override
    public Object executeStatement(VirtualFrame frame) {
        Object value = this.exceptionExpr.executeGeneric(frame);
        throw new EasyScriptException(value);
    }

    @Override
    public SourceSection getSourceSection() {
        return this.sourceSection;
    }
}
```

This makes the stack trace look like:

```shell-session
org.graalvm.polyglot.PolyglotException
	at <ezs> f3(Unknown)
	at <ezs> f2(exceptions-nested.js:9:100-111)
	at <ezs> f1(exceptions-nested.js:5:50-62)
	at <ezs> main(exceptions-nested.js:2:22-26)
	at <ezs> :program(exceptions-nested.js:14:164-170)
	at org.graalvm.sdk/org.graalvm.polyglot.Context.eval(Context.java:399)
	...
```

In order to fix that last element,
we need to pass the `throw` Node into the `AbstractTruffleException`
that we raise in `ThrowStmtNode`, alongside the value, so that the message is filled correctly:

```java
import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.source.SourceSection;

public final class ThrowStmtNode extends EasyScriptStmtNode {
    @SuppressWarnings("FieldMayBeFinal")
    @Child
    private EasyScriptExprNode exceptionExpr;

    private final SourceSection sourceSection;

    public ThrowStmtNode(EasyScriptExprNode exceptionExpr, SourceSection sourceSection) {
        this.exceptionExpr = exceptionExpr;
        this.sourceSection = sourceSection;
    }

    @Override
    public Object executeStatement(VirtualFrame frame) {
        Object value = this.exceptionExpr.executeGeneric(frame);
        throw new EasyScriptException(value, this);
    }

    @Override
    public SourceSection getSourceSection() {
        return this.sourceSection;
    }
}
```

Since `AbstractTruffleException` expects a String for the message,
we use the `EasyScriptTruffleStrings.toString()` method seen in the
[previous parts](/graal-truffle-tutorial-part-13-classes-2-fields-this-constructors#field-writes)
to convert the provided value to a String:

```java
import com.oracle.truffle.api.exception.AbstractTruffleException;
import com.oracle.truffle.api.nodes.Node;

public final class EasyScriptException extends AbstractTruffleException {
    public final Object value;

    public EasyScriptException(Object value, Node node) {
        super(EasyScriptTruffleStrings.toString(value), node);

        this.value = value;
    }

    // ...
}
```

This finally fills the entire stack trace:

```shell-session
Exception in f3()
	at <ezs> f3(exceptions-nested.js:12:135-160)
	at <ezs> f2(exceptions-nested.js:9:100-111)
	at <ezs> f1(exceptions-nested.js:5:50-62)
	at <ezs> main(exceptions-nested.js:2:22-26)
	at <ezs> :program(exceptions-nested.js:14:164-170)
	at org.graalvm.sdk/org.graalvm.polyglot.Context.eval(Context.java:399)
	...
```

## The `try` statement

But, raising exceptions is only half of the story --
the other half is handling them.
For that, we use the `try` statement.

The `try` statement has three parts: the (required) block for the `try`,
the (optional) `catch` block that is executed when an exception is caught,
and the (optional) `finally` block that executes,
regardless whether an exception was thrown from the `try` block,
or not.

The interesting part is the `catch` statement,
since, if it executes, it needs to assign the thrown value that has been caught
to the local variable with the name included in the `catch` statement.
The way we handle that is by creating a new local variable during parsing of the `catch` statement:

```java
public final class EasyScriptTruffleParser {
    // ...

    private TryStmtNode parseTryCatchStmt(EasyScriptParser.TryCatchStmtContext tryCatchStmt) {
        // parse the 'try' statement block
        BlockStmtNode tryBlockStmt = this.parseStmtBlock(tryCatchStmt.t);

        BlockStmtNode finallyBlockStmt = tryCatchStmt.f == null
                ? null
                : this.parseStmtBlock(tryCatchStmt.f);

        // add the 'catch' identifier as a local variable
        String exceptionVar = tryCatchStmt.ID().getText();
        var frameSlotId = new LocalVariableFrameSlotId(exceptionVar, ++this.localVariablesCounter);
        int frameSlot = this.frameDescriptor.addSlot(FrameSlotKind.Object, frameSlotId, DeclarationKind.LET);
        if (this.localScopes.peek().putIfAbsent(exceptionVar, new LocalVariable(frameSlot, DeclarationKind.LET)) != null) {
            throw new EasyScriptException("Identifier '" + exceptionVar + "' has already been declared");
        }

        // parse the 'catch' statement block
        BlockStmtNode catchBlockStmt = this.parseStmtBlock(tryCatchStmt.c);

        return new TryStmtNode(tryBlockStmt, frameSlot, catchBlockStmt, finallyBlockStmt);
    }
}
```

We pass the integer slot that was assigned to the local variable from the `catch`
statement into `TryStmtNode`,
and then we use it when we catch the exception.
We assign that local variable the contents of the `value`
field of the caught `EasyScriptException`
that we populated in the `throw` statement.

Since Java has the same type of exception handling as JavaScript,
the code looks very natural;
we just have to check whether we have the `try`-`catch` form
(with the optional `finally`), or the `try`-`finally` form
(without `catch`):

```java
import com.oracle.truffle.api.frame.VirtualFrame;

public final class TryStmtNode extends EasyScriptStmtNode {
    @SuppressWarnings("FieldMayBeFinal")
    @Child
    private BlockStmtNode tryStatements;

    private final Integer exceptionVarFrameSlot;

    @SuppressWarnings("FieldMayBeFinal")
    @Child
    private BlockStmtNode catchStatements;

    @SuppressWarnings("FieldMayBeFinal")
    @Child
    private BlockStmtNode finallyStatements;

    public TryStmtNode(BlockStmtNode tryStatements, BlockStmtNode finallyStatements) {
        this(tryStatements, null, null, finallyStatements);
    }

    public TryStmtNode(BlockStmtNode tryStatements, Integer exceptionVarFrameSlot,
            BlockStmtNode catchStatements, BlockStmtNode finallyStatements) {
        this.tryStatements = tryStatements;
        this.exceptionVarFrameSlot = exceptionVarFrameSlot;
        this.catchStatements = catchStatements;
        this.finallyStatements = finallyStatements;
    }

    @Override
    public Object executeStatement(VirtualFrame frame) {
        if (this.exceptionVarFrameSlot == null) {
            try {
                return this.tryStatements.executeStatement(frame);
            } finally {
                // we now that the 'finally' block is not null if 'catch' block is null
                this.finallyStatements.executeStatement(frame);
            }
        } else {
            try {
                return this.tryStatements.executeStatement(frame);
            } catch (EasyScriptException e) {
                frame.setObject(this.exceptionVarFrameSlot, e.value);
                return this.catchStatements.executeStatement(frame);
            } finally {
                if (this.finallyStatements != null) {
                    this.finallyStatements.executeStatement(frame);
                }
            }
        }
    }
}
```

Since the condition determining whether the given `try` statement has a `catch` block or not is compilation-final,
the entire `if` will actually be eliminated when this Node gets JIT-compiled,
and only the appropriate branch will be left.

## Built-in error types

While JavaScript allows throwing any value,
it also comes with an error hierarchy:
the [`Error` class](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error),
and [its subclasses](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error#error_types).
We will implement only the [`TypeError` subclass](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypeError)
as a representative example.

In order for the parser and runtime to know about these new classes,
we create a new class, `ErrorPrototypes`:

```java
public final class ErrorPrototypes {
    public final ClassPrototypeObject errorPrototype, typeErrorPrototype;
    public final Map<String, ClassPrototypeObject> allBuiltInErrorClasses;

    public ErrorPrototypes(
            ClassPrototypeObject errorPrototype,
            ClassPrototypeObject typeErrorPrototype) {
        this.errorPrototype = errorPrototype;
        this.typeErrorPrototype = typeErrorPrototype;
        this.allBuiltInErrorClasses = Map.of(
                "Error", errorPrototype,
                "TypeError", typeErrorPrototype
        );
    }
}
```

As we need to add all built-in classes as global variables with the same name as the class,
we create a `Map` of their names as keys, and their prototypes as values,
which we surface through the slightly modified `ShapesAndPrototypes` class from
[part 13](/graal-truffle-tutorial-part-13-classes-2-fields-this-constructors#handling-built-in-objects-and-functions):

```java
import com.oracle.truffle.api.object.Shape;

public final class ShapesAndPrototypes {
    public final Shape rootShape, arrayShape;
    public final ObjectPrototype objectPrototype;
    public final ClassPrototypeObject functionPrototype, arrayPrototype, stringPrototype;
    public final ErrorPrototypes errorPrototypes;
    public final Map<String, ClassPrototypeObject> allBuiltInClasses;

    public ShapesAndPrototypes(Shape rootShape, Shape arrayShape,
            ObjectPrototype objectPrototype, ClassPrototypeObject functionPrototype,
            ClassPrototypeObject arrayPrototype, ClassPrototypeObject stringPrototype,
            ErrorPrototypes errorPrototypes) {
        this.rootShape = rootShape;
        this.arrayShape = arrayShape;
        this.objectPrototype = objectPrototype;
        this.functionPrototype = functionPrototype;
        this.arrayPrototype = arrayPrototype;
        this.stringPrototype = stringPrototype;
        this.errorPrototypes = errorPrototypes;

        Map<String, ClassPrototypeObject> allBuiltInClasses = new HashMap<>();
        allBuiltInClasses.put("Object", objectPrototype);
        allBuiltInClasses.putAll(errorPrototypes.allBuiltInErrorClasses);
        this.allBuiltInClasses = Collections.unmodifiableMap(allBuiltInClasses);
    }
}
```

We change the parser to accept an instance of `ShapesAndPrototypes`
instead of the root `Shape` and `Object` prototype separately, like in the previous parts,
and use the `allBuiltInClasses` field to register all built-in classes,
so that they can be extended by user-defined classes:

```java
import com.oracle.truffle.api.source.Source;

public final class EasyScriptTruffleParser {
    private EasyScriptTruffleParser(Source source, ShapesAndPrototypes shapesAndPrototypes) throws IOException {
        // we add a global scope, in which we store the class prototypes
        Map<String, FrameMember> classPrototypes = new HashMap<>();
        for (Map.Entry<String, ClassPrototypeObject> builtInClassEntry :
                shapesAndPrototypes.allBuiltInClasses.entrySet()) {
            classPrototypes.put(builtInClassEntry.getKey(),
                    new ClassPrototypeMember(builtInClassEntry.getValue()));
        }

        // ...
    }

    // ...
}
```

We create the prototypes for these classes in the Truffle Language implementation for this part.
All `Error` types have a constructor that takes a string `message`
as the first argument, which gets assigned to a `message` property of the object,
and also a `name` property, equal to the name of the class.
In JavaScript code, it looks something like this:

```js
class Error {
    constructor(message) {
        this.message = message;
        this.name = 'Error';
    }
}

class TypeError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TypeError';
    }
}
```

We need to initialize the error prototypes with such a constructor.
We basically re-create the above JavaScript code by creating the appropriate Truffle Nodes "by hand",
since this happens before we can parse any JavaScript code:

```java
import com.oracle.truffle.api.frame.FrameDescriptor;
import com.oracle.truffle.api.object.DynamicObject;
import com.oracle.truffle.api.object.DynamicObjectLibrary;
import com.oracle.truffle.api.TruffleLanguage;

@TruffleLanguage.Registration(id = "ezs", name = "EasyScript")
public final class EasyScriptTruffleLanguage extends
        TruffleLanguage<EasyScriptLanguageContext> {
    private DynamicObject createGlobalScopeObject(DynamicObjectLibrary objectLibrary) {
        // add a constructor to all Error types
        for (Map.Entry<String, ClassPrototypeObject> entry :
                this.shapesAndPrototypes.errorPrototypes.allBuiltInErrorClasses.entrySet()) {
            objectLibrary.putConstant(
                    entry.getValue(),
                    "constructor",
                    // error subtype constructor
                    new FunctionObject(
                            this.rootShape,
                            this.functionPrototype,
                            new StmtBlockRootNode(
                                    this,
                                    FrameDescriptor.newBuilder().build(),
                                    new BlockStmtNode(List.of(
                                            // this.message = args[1];
                                            new ExprStmtNode(PropertyWriteExprNodeGen.create(
                                                    new ThisExprNode(),
                                                    new ReadFunctionArgExprNode(1),
                                                    "message"
                                            ), null),
                                            // this.name = <name>;
                                            new ExprStmtNode(PropertyWriteExprNodeGen.create(
                                                    new ThisExprNode(),
                                                    new StringLiteralExprNode(entry.getKey()),
                                                    "name"
                                            ), null)
                                    )),
                                    "constructor").getCallTarget(),
                            1),
                    0);
        }

        // ...
    }

    // ...
}
```

## Reading properties of the thrown object

When an object is used in the `throw` statement
(for example, one of those built-in errors we saw above),
the exception being thrown should construct its message from the `name`
and `message` properties of the object.
However, this shouldn't apply to throwing non-object values,
so we need to switch our implementation of the `throw` statement to use specializations:

```java
import com.oracle.truffle.api.dsl.Executed;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.library.CachedLibrary;
import com.oracle.truffle.api.object.DynamicObjectLibrary;
import com.oracle.truffle.api.source.SourceSection;

public abstract class ThrowStmtNode extends EasyScriptStmtNode {
    @SuppressWarnings("FieldMayBeFinal")
    @Child
    @Executed
    protected EasyScriptExprNode exceptionExpr;

    private final SourceSection sourceSection;

    protected ThrowStmtNode(EasyScriptExprNode exceptionExpr, SourceSection sourceSection) {
        this.exceptionExpr = exceptionExpr;
        this.sourceSection = sourceSection;
    }

    @Specialization(limit = "2")
    protected Object throwJavaScriptObject(JavaScriptObject value,
            @CachedLibrary("value") DynamicObjectLibrary nameObjectLibrary,
            @CachedLibrary("value") DynamicObjectLibrary messageObjectLibrary) {
        Object name = nameObjectLibrary.getOrDefault(value, "name", null);
        Object message = messageObjectLibrary.getOrDefault(value, "message", null);
        throw new EasyScriptException(name, message, value, this);
    }

    @Specialization
    protected Object throwNonJavaScriptObject(Object value) {
        throw new EasyScriptException(value, this);
    }

    @Override
    public SourceSection getSourceSection() {
        return this.sourceSection;
    }
}
```

In accordance with [Truffle recommendations](https://www.graalvm.org/latest/graalvm-as-a-platform/language-implementation-framework/DynamicObjectModel/#caching-considerations),
we use two different cached `DynamicObjectLibrary` instances:
one for the `name` property, and another for the `message` property.

We need a new `EasyScriptException` constructor in order to handle this case:

```java
import com.oracle.truffle.api.exception.AbstractTruffleException;
import com.oracle.truffle.api.nodes.Node;

public final class EasyScriptException extends AbstractTruffleException {
    public final Object value;

    // ...

    public EasyScriptException(Object name, Object message, JavaScriptObject javaScriptObject, Node node) {
        super(EasyScriptTruffleStrings.toString(name) + ": " + EasyScriptTruffleStrings.toString(message), node);

        this.value = javaScriptObject;
    }
}
```

## Changing built-in errors

In JavaScript, many built-in error conditions,
like accessing a property of `undefined`,
assigning a negative length to an array, etc.,
result in a specific instance of a subclass of `Error`
being thrown -- for example,
accessing a property of `undefined` raises `TypeError`.

The tricky part of implementing this is correctly creating an instance of a subtype of `Error`,
since, like we saw above, those classes have a specific constructor in EasyScript.
But, we don't have an easy way to invoke that constructor from Java code inside a Node specialization!

So, we use a small trick: we create a subclass of `JavaScriptObject`
that basically re-implements that constructor in Java:

```java
import com.oracle.truffle.api.object.DynamicObjectLibrary;
import com.oracle.truffle.api.object.Shape;

public final class ErrorJavaScriptObject extends JavaScriptObject {
    public final String name, message;

    public ErrorJavaScriptObject(String name, String message,
            DynamicObjectLibrary dynamicObjectLibrary,
            Shape shape, ClassPrototypeObject prototype) {
        super(shape, prototype);

        this.name = name;
        this.message = message;
        dynamicObjectLibrary.put(this, "name", EasyScriptTruffleStrings.fromJavaString(name));
        dynamicObjectLibrary.put(this, "message", EasyScriptTruffleStrings.fromJavaString(message));
    }
}
```

And then we use this subclass in the implementation of the Node for reading properties,
in the specialization that handles attempting to read a property of `undefined`:

```java
import com.oracle.truffle.api.dsl.Cached;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.library.CachedLibrary;
import com.oracle.truffle.api.object.DynamicObjectLibrary;

public abstract class CommonReadPropertyNode extends EasyScriptNode {
    // ...

    @Specialization(guards = "interopLibrary.isNull(target)", limit = "2")
    protected Object readPropertyOfUndefined(
            Object target, Object property,
            @CachedLibrary("target") InteropLibrary interopLibrary,
            @CachedLibrary(limit = "2") DynamicObjectLibrary dynamicObjectLibrary,
            @Cached("currentLanguageContext().shapesAndPrototypes") ShapesAndPrototypes shapesAndPrototypes) {
        var typeError = new ErrorJavaScriptObject(
                "TypeError",
                "Cannot read properties of undefined (reading '" + property + "')",
                dynamicObjectLibrary,
                shapesAndPrototypes.rootShape,
                shapesAndPrototypes.errorPrototypes.typeErrorPrototype);
        throw new EasyScriptException(typeError, this);
    }

    // ...
}
```

In order to correctly populate the exception message,
we need to add one more constructor to `EasyScriptException`:

```java
import com.oracle.truffle.api.exception.AbstractTruffleException;
import com.oracle.truffle.api.nodes.Node;

public final class EasyScriptException extends AbstractTruffleException {
    public final Object value;

    public EasyScriptException(ErrorJavaScriptObject errorJavaScriptObject, Node node) {
        super(errorJavaScriptObject.name + ": " + errorJavaScriptObject.message, node);

        this.value = errorJavaScriptObject;
    }

    // ...
}
```

## Filling guest stack traces

Previously, we saw how the Truffle runtime fills the stacktrace of an exception in the polyglot context.
However, it's also often useful to access the stack trace of an exception inside the guest language itself
(for example, to log it when handling an exception, when we don't plan on re-throwing it).
In order to do that in JavaScript, we can use the non-standard (but widely supported)
[`stack` property](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/stack)
that gets filled when an object is thrown.

**Note**: in JavaScript, that property is filled when an instance of `Error`
or one of its subclasses is created. However, that makes the Truffle code a little more complex,
so in EasyScript, we'll do it when the object is thrown instead.

In order to get access to the guest stack trace,
we can use the
[`TruffleStackTrace.getStackTrace()` method](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/TruffleStackTrace.html#getStackTrace(java.lang.Throwable%29),
passing it the `JavaScriptException` we have created.
That gives us a `List` of
[`StackTraceElement` instances](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/TruffleStackTraceElement.html)
which we can render as a `TruffleString`:

```java
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.library.CachedLibrary;
import com.oracle.truffle.api.nodes.Node;
import com.oracle.truffle.api.nodes.RootNode;
import com.oracle.truffle.api.object.DynamicObjectLibrary;
import com.oracle.truffle.api.strings.TruffleString;
import com.oracle.truffle.api.strings.TruffleStringBuilder;
import com.oracle.truffle.api.TruffleStackTrace;
import com.oracle.truffle.api.TruffleStackTraceElement;

public abstract class ThrowStmtNode extends EasyScriptStmtNode {
    // ...

    @Specialization(limit = "2")
    protected Object throwJavaScriptObject(
            JavaScriptObject value,
            @CachedLibrary("value") DynamicObjectLibrary nameObjectLibrary,
            @CachedLibrary("value") DynamicObjectLibrary messageObjectLibrary,
            @CachedLibrary("value") DynamicObjectLibrary stackObjectLibrary) {
        Object name = nameObjectLibrary.getOrDefault(value, "name", null);
        Object message = messageObjectLibrary.getOrDefault(value, "message", null);
        var easyScriptException = new EasyScriptException(name, message, value, this);
        stackObjectLibrary.put(value, "stack", this.formStackTrace(name, message, easyScriptException));
        throw easyScriptException;
    }

    @TruffleBoundary
    private TruffleString formStackTrace(Object name, Object message, EasyScriptException easyScriptException) {
        TruffleStringBuilder sb = EasyScriptTruffleStrings.builder();
        sb.appendJavaStringUTF16Uncached(String.valueOf(name));
        if (message != Undefined.INSTANCE) {
            sb.appendJavaStringUTF16Uncached(": ");
            sb.appendJavaStringUTF16Uncached(String.valueOf(message));
        }
        List<TruffleStackTraceElement> truffleStackTraceEls = TruffleStackTrace.getStackTrace(easyScriptException);
        for (TruffleStackTraceElement truffleStackTracEl : truffleStackTraceEls) {
            sb.appendJavaStringUTF16Uncached("\n\tat ");

            Node location = truffleStackTracEl.getLocation();
            RootNode rootNode = location.getRootNode();
            String funcName = rootNode.getName();
            // we want to ignore the top-level program RootNode name in this stack trace
            boolean isFunc = !":program".equals(funcName);
            if (isFunc) {
                sb.appendJavaStringUTF16Uncached(funcName);
                sb.appendJavaStringUTF16Uncached(" (");
            }

            SourceSection sourceSection = location.getEncapsulatingSourceSection();
            sb.appendJavaStringUTF16Uncached(sourceSection.getSource().getName());
            sb.appendJavaStringUTF16Uncached(":");
            sb.appendJavaStringUTF16Uncached(String.valueOf(sourceSection.getStartLine()));
            sb.appendJavaStringUTF16Uncached(":");
            sb.appendJavaStringUTF16Uncached(String.valueOf(sourceSection.getStartColumn()));

            if (isFunc) {
                sb.appendJavaStringUTF16Uncached(")");
            }
        }
        return sb.toStringUncached();
    }
}
```

Since our stack trace inside EasyScript needs to be a `TruffleString`,
we use the [`TruffleStringBuilder` class](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/strings/TruffleStringBuilder.html)
instead of a regular `StringBuilder`.
As constructing an instance of `TruffleStringBuilder`
requires providing an encoding for it,
we encapsulate creating one inside a new method in our utility class,
`EasyScriptTruffleStrings`, introduced in [part 11](/graal-truffle-tutorial-part-11-strings-static-method-calls#string-runtime-representation):

```java
import com.oracle.truffle.api.strings.TruffleString;
import com.oracle.truffle.api.strings.TruffleStringBuilder;

public final class EasyScriptTruffleStrings {
    private static final TruffleString.Encoding JAVA_SCRIPT_STRING_ENCODING = TruffleString.Encoding.UTF_16;

    // ...

    public static TruffleStringBuilder builder() {
        return TruffleStringBuilder.create(JAVA_SCRIPT_STRING_ENCODING);
    }
}
```

Following the GraalVM JavaScript implementation,
we don't use the `:program` name for the top-level script in the stack trace inside EasyScript,
but simply omit the function name in that case.

Since we only overrode the [`getSourceSection()` method](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/nodes/Node.html#getSourceSection(%29)
in a few Node subclasses,
we instead use the [`Node.getEncapsulatingSourceSection()` method](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/nodes/Node.html#getEncapsulatingSourceSection(%29)
which traverses up to the parent Node until it finds one with a non-`null` `SourceSection`.

This results in the stack traces inside EasyScript looking very similar to the polyglot ones,
for example:

```shell-session
Error: Exception in f3()
	at f3 (exceptions-nested.js:12:5)
	at f2 (exceptions-nested.js:9:5)
	at f1 (exceptions-nested.js:5:5)
	at main (exceptions-nested.js:2:5)
	at exceptions-nested.js:14:7
```

## Benchmark

While exceptions are inherently slow
(operations like gathering the stack trace are slow,
the method for formatting the stack trace into a string requires a `@TruffleBoundary`
annotation, etc.),
we can still write a simple benchmark using them --
count until receiving an exception:

```js
class Countdown {
    constructor(start) {
        this.count = start;
    }
    decrement() {
        if (this.count <= 0) {
            throw new Error('countdown has completed');
        }
        this.count = this.count - 1;
    }
}
function countdown(n) {
    const countdown = new Countdown(n);
    let ret = 0;
    for (;;) {
        try {
            countdown.decrement();
            ret = ret + 1;
        } catch (e) {
            break;
        }
    }
    return ret;
}
```

Running `countdown` with `n` equal to 1 million in both JavaScript and EasyScript results in the following numbers on my laptop:

```shell-session
Benchmark                                                Mode  Cnt    Score    Error  Units
CountdownBenchmark.count_down_with_exception_ezs         avgt    5  921.898 ± 32.561  us/op
CountdownBenchmark.count_down_with_exception_js          avgt    5  928.523 ±  8.294  us/op
```

As we can see, both EasyScript and the GraalVM JavaScript implementation have basically identical performance,
which means we at least didn't introduce some obvious inefficiency to EasyScript.

## Summary

So, this is how exceptions work in Truffle.

As usual, all the code from the article is
[available on GitHub](https://github.com/skinny85/graalvm-truffle-tutorial/tree/master/part-15).

In the next part of the series,
we will talk about adding support for debugging your language.
