---
id: 80
layout: truffle-tutorial.html
title: "Graal Truffle tutorial part 16 – debuggers"
summary: |
   In the sixteenth part of the GraalVM Truffle tutorial,
   we add support for debugging your language using Chrome DevTools.
created_at: 2025-01-29
---

## Introduction

In the [previous part](/graal-truffle-tutorial-part-15-exceptions)
of the tutorial on GraalVM Truffle,
we added support for exceptions to EasyScript,
our simplified subset of JavaScript.
While tackling that functionality,
we learned about the
[`SourceSection` class](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/source/SourceSection.html)
that represents a specific location in the source code of your language.

But the usefulness of `SourceSection`s goes beyond just providing line numbers to exceptions --
they are a crucial element of making your language implementation debuggable.
This is a huge advantage of building your language on top of a platform like GraalVM Truffle --
you get access to infrastructure that you can use to implement functionality common to all languages,
such as support for debuggers,
with a fraction of the effort it would take if you had to build it all from scratch.

Debuggers are an example of a more general GraalVM concept called _tools_,
sometimes also referred to as
[_instruments_](https://www.graalvm.org/latest/graalvm-as-a-platform/implement-instrument).
We will cover implementing your own tools in a future part of the series --
for now, we will focus on adding support for instruments to your language.

## Instrumentation

The key to adding support for tools in GraalVM is the concept of
[_instrumentation_](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/instrumentation/package-summary.html).
Instrumentation is a way to add listeners to Nodes that observe and react to certain events,
and is how debuggers, profilers, and other tools can perform their work.

The main way to add instrumentation to your Nodes is by making them implement the
[`InstrumentableNode` interface](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/instrumentation/InstrumentableNode.html).
That interface has two abstract methods:
[`isInstrumentable()`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/instrumentation/InstrumentableNode.html#isInstrumentable(%29),
which determines whether the given Node can be used in a tool,
and [`createWrapper()`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/instrumentation/InstrumentableNode.html#createWrapper(com.oracle.truffle.api.instrumentation.ProbeNode%29),
which is how tools interact with the Nodes of your language.
`createWrapper()` returns an instance of the
[`WrapperNode` interface](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/instrumentation/InstrumentableNode.WrapperNode.html),
which offers tools a well-known API they can use to interact with your language's Nodes,
since the `Node` class itself doesn't place many restrictions on the interface of its subclasses.

Typically, you would have to write a lot of boilerplate code to implement `WrapperNode`.
But the Truffle DSL that we've seen since
[part 3](/graal-truffle-tutorial-part-3-specializations-with-truffle-dsl-typesystem)
of the series helps here too --
you just have to annotate your Node classes with the
[`@GenerateWrapper` annotation](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/instrumentation/GenerateWrapper.html),
and the DSL will create all the necessary code for you.

You typically implement `InstrumentableNode` in a parent Node class.
While you can do it for expressions as well, in EasyScript,
we'll limit ourselves to statements,
which are the basic unit of execution inside a debugger.

In order for the debugger to understand which of the EasyScript `Node` subclasses are statements,
we can use [`Tag`s](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/instrumentation/Tag.html),
which is a way in Truffle to categorize Nodes according to the role they play in the language.
To mark a Node as having a specific `Tag`,
you need to override the
[`hasTag()` method from the `InstrumentableNode` interface](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/instrumentation/InstrumentableNode.html#hasTag(java.lang.Class%29),
and return `true` when the argument is the
[`StandardTags.StatementTag` class](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/instrumentation/StandardTags.StatementTag.html).

Since all Nodes that provide one of the `StandardTags`
also need to provide a `SourceSection`, we will add a field for it to `EasyScriptStmtNode`,
and use that field in the implementation of the
[`Node.getSourceSection()` method](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/nodes/Node.html#getSourceSection(%29).
This means we need to modify all statement Node subclasses to pass a `SourceSection`
in their constructors to the superclass.

Taking all that into consideration, `EasyScriptStmtNode` becomes:

```java
import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.instrumentation.GenerateWrapper;
import com.oracle.truffle.api.instrumentation.InstrumentableNode;
import com.oracle.truffle.api.instrumentation.ProbeNode;
import com.oracle.truffle.api.instrumentation.StandardTags;
import com.oracle.truffle.api.instrumentation.Tag;
import com.oracle.truffle.api.source.SourceSection;

@GenerateWrapper
public abstract class EasyScriptStmtNode extends EasyScriptNode
        implements InstrumentableNode {
    private final SourceSection sourceSection;

    protected EasyScriptStmtNode(SourceSection sourceSection) {
        this.sourceSection = sourceSection;
    }

    @Override
    public boolean isInstrumentable() {
        return true;
    }

    @Override
    public WrapperNode createWrapper(ProbeNode probe) {
        return new EasyScriptStmtNodeWrapper(this.sourceSection,
            this, probe);
    }

    @Override
    public boolean hasTag(Class<? extends Tag> tag) {
        return tag == StandardTags.StatementTag.class;
    }

    @Override
    public SourceSection getSourceSection() {
        return this.sourceSection;
    }

    public abstract Object executeStatement(VirtualFrame frame);
}
```

While we want the debugger to be able to stop on almost all statements,
a few of them are special, and we want the debugger to skip them.
One example is a function declaration -- there's little point in stepping into one
(a function _invocation_ is a different story, but not a function _declaration_).
For that reason, we make sure to pass a `null` `SourceSection` to `EasyScriptStmtNode`
from `FuncDeclStmtNode`, and also override the `hasTag()` method in it to always return `false`
(since Nodes providing standard tags must have a `SourceSection`):

```java
import com.oracle.truffle.api.instrumentation.Tag;

public abstract class FuncDeclStmtNode extends EasyScriptStmtNode {
    // ...

    protected FuncDeclStmtNode() {
        // deliberately pass 'null' here,
        // as we don't want the debugger to stop on function declarations
        super(null);
    }

    @Override
    public boolean hasTag(Class<? extends Tag> tag) {
        // since we don't provide a SourceSection for function declarations,
        // we need to stop providing a 'StatementTag' for them
        return false;
    }
}
```

Similarly, class declarations are also not interesting,
for the same reasons as function declarations.
Since we don't have a dedicated statement for class declarations,
unlike function declarations, but use the `GlobalVarDeclStmtNode`
class containing a `ClassDeclExprNode` instead,
we will also override the `hasTag()` method in
`GlobalVarDeclStmtNode` to check whether it has a non-`null` `SourceSection`,
and only provide the `StatementTag` if it does.
We'll make sure to pass a `null` `SourceSection` to the `GlobalVarDeclStmtNode`
constructor when parsing a class declaration
(we still want the debugger to stop on non-class global variable declarations,
since their initializers might be complex expressions that we might want to step through,
so we'll make sure to pass a non-`null` `SourceSection` for non-class global variable declarations):

```java
import com.oracle.truffle.api.instrumentation.Tag;
import com.oracle.truffle.api.source.SourceSection;

public abstract class GlobalVarDeclStmtNode extends EasyScriptStmtNode {
    // ...

    protected GlobalVarDeclStmtNode(SourceSection sourceSection) {
        super(sourceSection);
    }

    @Override
    public boolean hasTag(Class<? extends Tag> tag) {
        // Global variables representing class declarations don't provide a SourceSection,
        // since we don't want the debugger to stop on them.
        // For that reason, make sure to return the standard Statement tag only if we have a SourceSection
        return this.getSourceSection() != null && super.hasTag(tag);
    }
}
```

In addition to `StatementTag`,
there is another important standard tag:
[the `RootTag`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/instrumentation/StandardTags.RootTag.html).
It's used to distinguish function calls from other kinds of statements,
which is important when using debugger features such as "Step Over"
(which ignores function calls, and proceeds to the next statement)
and "Step Into" (which jumps to the first line of the next function that is called).

In the case of EasyScript, that means that we need to add the `RootTag`
to the Node that represent the body of a user-defined function, `UserFuncBodyStmtNode`:

```java
import com.oracle.truffle.api.instrumentation.StandardTags;
import com.oracle.truffle.api.instrumentation.Tag;
import com.oracle.truffle.api.source.SourceSection;

public final class UserFuncBodyStmtNode extends EasyScriptStmtNode {
    @Children
    private final EasyScriptStmtNode[] stmts;

    public UserFuncBodyStmtNode(List<EasyScriptStmtNode> stmts,
            SourceSection sourceSection) {
        super(sourceSection);

        this.stmts = stmts.toArray(new EasyScriptStmtNode[]{});
    }

    @Override
    public boolean hasTag(Class<? extends Tag> tag) {
        return tag == StandardTags.RootTag.class;
    }

    // ...
}
```

And also to `BlockStmtNode`, but only for those instances that represent the main code of the program:

```java
import com.oracle.truffle.api.instrumentation.StandardTags;
import com.oracle.truffle.api.instrumentation.Tag;
import com.oracle.truffle.api.source.SourceSection;

public final class BlockStmtNode extends EasyScriptStmtNode {
    @Children
    private final EasyScriptStmtNode[] stmts;

    private final boolean programBlock;

    public BlockStmtNode(List<EasyScriptStmtNode> stmts) {
        this(stmts, null);
    }

    public BlockStmtNode(List<EasyScriptStmtNode> stmts,
            SourceSection sourceSection) {
        this(stmts, false, sourceSection);
    }

    public BlockStmtNode(List<EasyScriptStmtNode> stmts,
            boolean programBlock, SourceSection sourceSection) {
        super(sourceSection);

        this.stmts = stmts.toArray(new EasyScriptStmtNode[]{});
        this.programBlock = programBlock;
    }

    @Override
    public boolean hasTag(Class<? extends Tag> tag) {
        return this.programBlock && 
            tag == StandardTags.RootTag.class;
    }

    // ...
}
```

All tags that Nodes return `true` for in `hasTag()`
need to be specified in the `@ProvidedTags`
annotation placed on the `TruffleLanguage` class:

```java
import com.oracle.truffle.api.TruffleLanguage;
import com.oracle.truffle.api.instrumentation.ProvidedTags;
import com.oracle.truffle.api.instrumentation.StandardTags;

@ProvidedTags({
    StandardTags.StatementTag.class, StandardTags.RootTag.class
})
@TruffleLanguage.Registration(id = "ezs", name = "EasyScript")
public final class EasyScriptTruffleLanguage extends
        TruffleLanguage<EasyScriptLanguageContext> {
    // ...
}
```

And finally, in order for the debugger to work correctly,
we also need to add a `SourceSection` to our `RootNode`,
`StmtBlockRootNode`:

```java
import com.oracle.truffle.api.frame.FrameDescriptor;
import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.nodes.RootNode;
import com.oracle.truffle.api.source.SourceSection;

public final class StmtBlockRootNode extends RootNode {
    @SuppressWarnings("FieldMayBeFinal")
    @Child
    private EasyScriptStmtNode blockStmt;

    private final String name;
    private final SourceSection sourceSection;

    public StmtBlockRootNode(EasyScriptTruffleLanguage truffleLanguage,
            FrameDescriptor frameDescriptor, EasyScriptStmtNode blockStmt,
            String name, SourceSection sourceSection) {
        super(truffleLanguage, frameDescriptor);

        this.blockStmt = blockStmt;
        this.name = name;
        this.sourceSection = sourceSection;
    }

    @Override
    public Object execute(VirtualFrame frame) {
        return this.blockStmt.executeStatement(frame);
    }

    @Override
    public String getName() {
        return this.name;
    }

    @Override
    public SourceSection getSourceSection() {
        return this.sourceSection;
    }
}
```

We create all of these source sections in the parser,
same way as in the [previous part of the series](/graal-truffle-tutorial-part-15-exceptions#filling-polyglot-stack-traces).

With this in place, we can write a simple Java program that executes a given JavaScript program,
using the same [`Context` class](https://www.graalvm.org/truffle/javadoc/org/graalvm/polyglot/Context.html)
that we've been using for writing unit tests:

```java
import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.Source;
import org.graalvm.polyglot.Value;
import java.io.File;

public class Main {
    public static void main(String[] args) throws Exception {
        Source source = Source
                .newBuilder("ezs", new File("my-file.js"))
                .build();

        try (Context context = Context
                .newBuilder()
                .option("inspect", "4242")
                .build()) {
            Value result = context.eval(source);
            System.out.println(result.toString());
        }
    }
}
```

We add the `"inspect"` option when creating the `Context`,
which is a way to start the debugger listening on the given port
(note that you need the
[`chromeinspector` dependency](https://search.maven.org/search?q=g:org.graalvm.tools%20AND%20a:chromeinspector)
added to your project in order for this to work).

When you execute the above program,
you will see a message in the console that tells you the generated URL under which you can access the debugger,
similar to:

```shell
Debugger listening on ws://127.0.0.1:4242/V6PM2FwwtClp1taZbQuXF0FL9PcTWxoCaATDNIFyxks
For help, see: https://www.graalvm.org/tools/chrome-debugger
E.g. in Chrome open: devtools://devtools/bundled/js_app.html?ws=127.0.0.1:4242/V6PM2FwwtClp1taZbQuXF0FL9PcTWxoCaATDNIFyxks
```

If you copy & paste the `devtools://devtools/bundled/js_app.html?ws=127.0.0.1:4242/V6PM2...`
URL and open it in Chrome,
you should see your code,
and the debugger stopped at the first line of the program,
similar to:

<img src="/img/truffle/part-16/chrome-devtools.png" style="width: 50%;">

From there, you should be able to use this debugger like any other:
step through your code using "Step Over", "Step Into" and "Step Out Of" functionality,
set breakpoints by clicking on the line numbers in the margin,
and continue execution until the next breakpoint.

## Show function arguments and local variables

One thing you might notice is currently missing from the debugger --
a feature you've probably seen when using other similar tools --
is showing the values of function arguments and local variables at the statement the code is suspended on
(currently, only the global variables are shown in the "Scope" section of the debugger).

We can fix it by adding a scope, similar to the global scope, to each statement.
To do that, we first need to add the capability to find the block a given statement belongs to,
since those variables are always scoped to a particular block.
We will add this capability to the parent of all statement Nodes,
the `EasyScriptStmtNode` class,
by walking up the Node tree using the
[`Node.getParent()` method](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/nodes/Node.html#getParent(%29):

```java
import com.oracle.truffle.api.instrumentation.GenerateWrapper;
import com.oracle.truffle.api.instrumentation.InstrumentableNode;
import com.oracle.truffle.api.nodes.Node;

@GenerateWrapper
public abstract class EasyScriptStmtNode extends EasyScriptNode
        implements InstrumentableNode {
    // ...

    public final Node findParentBlock() {
        Node parent = this.getParent();
        while (parent != null) {
            if (parent instanceof BlockStmtNode || parent instanceof UserFuncBodyStmtNode) {
                break;
            }
            Node grandParent = parent.getParent();
            if (grandParent == null) {
                // we know that parent is a RootNode here
                // (specifically, a StmtBlockRootNode)
                break;
            }
            parent = grandParent;
        }
        return parent;
    }
}
```

So, `findParentBlock()` will return one of three possible values:

1. An instance of `UserFuncBodyStmtNode`, if the given statement is on the first level of a user-defined function or method.
2. An instance of `BlockStmtNode`, if the statement is on the second or lower level of a user-defined function or method,
   or is anywhere inside the main code of the program (outside a user-defined function or method).
3. An instance of `StmtBlockRootNode` in all other cases (like stepping over the return from a function or method).

The scope for a given statement will be created from the value returned by
`findParentBlock()`. It's provided to the GraalVM runtime by implementing a
[library we haven't seen yet, `NodeLibrary`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/interop/NodeLibrary.html) --
more specifically, its
[`hasScope()`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/interop/NodeLibrary.html#hasScope(java.lang.Object,com.oracle.truffle.api.frame.Frame%29)
and [`getScope()` methods](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/interop/NodeLibrary.html#getScope(java.lang.Object,com.oracle.truffle.api.frame.Frame,boolean%29):

```java
import com.oracle.truffle.api.dsl.Cached;
import com.oracle.truffle.api.dsl.Cached.Shared;
import com.oracle.truffle.api.frame.Frame;
import com.oracle.truffle.api.instrumentation.GenerateWrapper;
import com.oracle.truffle.api.instrumentation.InstrumentableNode;
import com.oracle.truffle.api.interop.NodeLibrary;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.library.ExportMessage;
import com.oracle.truffle.api.nodes.Node;

@GenerateWrapper
@ExportLibrary(value = NodeLibrary.class)
public abstract class EasyScriptStmtNode extends EasyScriptNode
        implements InstrumentableNode {
    // ...

    @ExportMessage
    boolean hasScope(Frame frame,
            @Cached(value = "this.findParentBlock()", adopt = false, allowUncached = true)
            @Shared("thisParentBlock")
            Node thisParentBlock) {
        return !(thisParentBlock instanceof StmtBlockRootNode);
    }

    @ExportMessage
    Object getScope(Frame frame,
            boolean nodeEnter,
            @Cached(value = "this.findParentBlock()", adopt = false, allowUncached = true)
            @Shared("thisParentBlock")
            Node thisParentBlock) {
        return thisParentBlock instanceof BlockStmtNode
                ? new BlockDebuggerScopeObject((BlockStmtNode) thisParentBlock, frame)
                : new FuncDebuggerScopeObject((UserFuncBodyStmtNode) thisParentBlock, frame);
    }
}
```

We use the
[`@Cached` annotation](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/dsl/Cached.html)
to avoid re-calculating the parent block of a given statement,
since the Node structure is immutable within a specific program,
and also
[`@Shared`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/dsl/Cached.Shared.html),
which we first saw in
[part 11](/graal-truffle-tutorial-part-11-strings-static-method-calls#method-implementation),
to calculate the parent block of given statement once across multiple exported messages.

We need to specify `adopt = false` in the `@Cached` annotation,
since otherwise the found block would be re-parented onto the current statement,
which we don't want.

The scope objects themselves are very similar to the global scope object we've seen since
[part 5](/graal-truffle-tutorial-part-5-global-variables).
They need to be
[`TruffleObject`s](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/interop/TruffleObject.html)
that export the
[`InteropLibrary`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/interop/InteropLibrary.html),
and provide objects with the
[`getMembers()` message](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/interop/InteropLibrary.html#getMembers(java.lang.Object,boolean%29).
The main difference is that these members aren't the result of evaluating EasyScript expressions,
but instead need to be found by traversing the Nodes of the block the statement belongs to.

Since both types of scopes are every similar,
we will introduce a common abstract superclass that contains the common logic:

```java
import com.oracle.truffle.api.TruffleLanguage;
import com.oracle.truffle.api.frame.Frame;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.TruffleObject;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.library.ExportMessage;
import java.util.Objects;

@ExportLibrary(InteropLibrary.class)
abstract class AbstractDebuggerScopeObject implements TruffleObject {
    static int MEMBER_CACHE_LIMIT = 4;

    protected final Frame frame;

    AbstractDebuggerScopeObject(Frame frame) {
        this.frame = frame;
    }

    @ExportMessage
    boolean isScope() {
        return true;
    }

    @ExportMessage
    boolean hasLanguage() {
        return true;
    }

    @ExportMessage
    Class<? extends TruffleLanguage<?>> getLanguage() {
        return EasyScriptTruffleLanguage.class;
    }

    /* We need this method to satisfy the Truffle DSL validation. */
    @ExportMessage
    Object toDisplayString(boolean allowSideEffects) {
        throw new UnsupportedOperationException();
    }

    @ExportMessage
    boolean isMemberInsertable(String member) {
        return false;
    }

    @ExportMessage
    boolean hasMembers() {
        return true;
    }

    // ...
}
```

The members that `AbstractDebuggerScopeObject` provides are of type `RefObject`,
which is another abstract `TruffleObject` class that represents either a local variable or a function argument:

```java
import com.oracle.truffle.api.frame.Frame;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.TruffleObject;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.library.ExportMessage;
import com.oracle.truffle.api.source.SourceSection;

@ExportLibrary(InteropLibrary.class)
public abstract class RefObject implements TruffleObject {
    public final String refName;
    private final SourceSection refSourceSection;

    public RefObject(String refName,
            SourceSection refSourceSection) {
        this.refName = refName;
        this.refSourceSection = refSourceSection;
    }

    public abstract Object readReference(Frame frame);
    public abstract void writeReference(Frame frame, Object value);

    @ExportMessage
    boolean isString() {
        return true;
    }

    @ExportMessage
    String asString() {
        return this.refName;
    }

    @ExportMessage
    boolean hasSourceLocation() {
        return this.refSourceSection != null;
    }

    @ExportMessage
    SourceSection getSourceLocation() {
        return this.refSourceSection;
    }
}
```

We have two subclasses of `RefObject` -- one for function argument references:

```java
import com.oracle.truffle.api.frame.Frame;
import com.oracle.truffle.api.source.SourceSection;
import java.util.Objects;

public final class FuncArgRefObject extends RefObject {
    private final int funcArgIndex;

    public FuncArgRefObject(String refName,
            SourceSection refSourceSection,
            int funcArgIndex) {
        super(refName, refSourceSection);
        this.funcArgIndex = funcArgIndex;
    }

    @Override
    public Object readReference(Frame frame) {
        return frame.getArguments()[this.funcArgIndex];
    }

    @Override
    public void writeReference(Frame frame, Object value) {
        frame.getArguments()[this.funcArgIndex] = value;
    }

    @Override
    public boolean equals(Object other) {
        if (!(other instanceof FuncArgRefObject)) {
            return false;
        }
        FuncArgRefObject that = (FuncArgRefObject) other;
        return this.funcArgIndex == that.funcArgIndex;
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(this.funcArgIndex);
    }
}
```

And another for local variable references:

```java
import com.oracle.truffle.api.frame.Frame;
import com.oracle.truffle.api.source.SourceSection;

public final class LocalVarRefObject extends RefObject {
    private final int localVarSlot;

    public LocalVarRefObject(String refName,
            SourceSection refSourceSection,
            int localVarSlot) {
        super(refName, refSourceSection);
        this.localVarSlot = localVarSlot;
    }

    @Override
    public Object readReference(Frame frame) {
        Object result = frame.getValue(this.localVarSlot);
        // in some cases, the values of local variables might not be populated yet
        // (if we are on a statement before the declaration of the variable inside the block)
        return result == null ? Undefined.INSTANCE : result;
    }

    @Override
    public void writeReference(Frame frame, Object value) {
        frame.setObject(this.localVarSlot, value);
    }
}
```

(We use `FuncArgRefObject` in a `Set`,
and so we need to override `equals` and `hashCode` for it,
but we don't need to do that for `LocalVarRefObject`, so we skip it)

In order to provide the members in `AbstractDebuggerScopeObject`,
we introduce an abstract method that we will implement in the two subclasses:

```java
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.TruffleObject;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.library.ExportMessage;

@ExportLibrary(InteropLibrary.class)
abstract class AbstractDebuggerScopeObject implements TruffleObject {
    @ExportMessage
    Object getMembers(boolean includeInternal) {
        RefObject[] references = this.getReferences();
        return new RefObjectsArray(references);
    }

    protected abstract RefObject[] getReferences();

    // ...
}
```

`RefObjectsArray` is a very simple `TruffleObject` that implements the
[array messages from `InteropLibrary`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/interop/InteropLibrary.html#hasArrayElements(java.lang.Object%29):

```java
import com.oracle.truffle.api.CompilerDirectives.CompilationFinal;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.InvalidArrayIndexException;
import com.oracle.truffle.api.interop.TruffleObject;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.library.ExportMessage;

@ExportLibrary(InteropLibrary.class)
final class RefObjectsArray implements TruffleObject {
    @CompilationFinal(dimensions = 1)
    private final RefObject[] references;

    RefObjectsArray(RefObject[] references) {
        this.references = references;
    }

    @ExportMessage
    boolean hasArrayElements() {
        return true;
    }

    @ExportMessage
    long getArraySize() {
        return this.references.length;
    }

    @ExportMessage
    boolean isArrayElementReadable(long index) {
        return index >= 0 && index < this.references.length;
    }

    @ExportMessage
    Object readArrayElement(long index) throws InvalidArrayIndexException {
        if (this.isArrayElementReadable(index)) {
            return this.references[(int) index];
        } else {
            throw InvalidArrayIndexException.create(index);
        }
    }
}
```

Like we said in the series previously,
it's not a good idea to use polymorphic methods like `RefObject`'s
`readReference()` and `writeReference()`,
as they don't play well with partial evaluation.
In order to mitigate that issue,
we will use specializations when implementing the `InteropLibrary`,
messages in `AbstractDebuggerScopeObject`,
like we first saw in
[part 13 of the series](/graal-truffle-tutorial-part-13-classes-2-fields-this-constructors#writing-the-length-property-of-arrays),
and cache the `RefObject` we find,
which should get rid of polymorphism in those cases
(same way polymorphism is eliminated for EasyScript `Node` subclasses).

For example, for reading members:

```java
import com.oracle.truffle.api.dsl.Cached;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.frame.Frame;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.TruffleObject;
import com.oracle.truffle.api.interop.UnknownIdentifierException;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.library.ExportMessage;
import java.util.Objects;

@ExportLibrary(InteropLibrary.class)
abstract class AbstractDebuggerScopeObject implements TruffleObject {
    // ...

    @ExportMessage(name = "isMemberReadable")
    static final class MemberReadable {
        @Specialization(limit = "MEMBER_CACHE_LIMIT", guards = "cachedMember.equals(member)")
        static boolean isMemberReadableCached(
                AbstractDebuggerScopeObject receiver,
                String member,
                @Cached("member")
                String cachedMember,
                @Cached("isMemberReadableUncached(receiver, member)")
                boolean cachedResult) {
            return cachedResult;
        }

        @Specialization(replaces = "isMemberReadableCached")
        static boolean isMemberReadableUncached(
                AbstractDebuggerScopeObject receiver,
                String member) {
            return receiver.hasReferenceCalled(member);
        }
    }

    @ExportMessage(name = "readMember")
    static final class ReadMember {
        @Specialization(limit = "MEMBER_CACHE_LIMIT", guards = "cachedMember.equals(member)")
        static Object readMemberCached(
                AbstractDebuggerScopeObject receiver,
                String member,
                @Cached("member")
                String cachedMember,
                @Cached("receiver.findReference(member)")
                RefObject refObject)
                throws UnknownIdentifierException {
            return readMember(receiver, cachedMember, refObject);
        }

        @Specialization(replaces = "readMemberCached")
        @TruffleBoundary
        static Object readMemberUncached(
                AbstractDebuggerScopeObject receiver,
                String member)
                throws UnknownIdentifierException {
            RefObject refObject = receiver.findReference(member);
            return readMember(receiver, member, refObject);
        }

        private static Object readMember(
                AbstractDebuggerScopeObject receiver,
                String member,
                RefObject refObject)
                throws UnknownIdentifierException {
            if (refObject == null) {
                throw UnknownIdentifierException.create(member);
            }
            return refObject.readReference(receiver.frame);
        }
    }

    private boolean hasReferenceCalled(String member) {
        return this.findReference(member) != null;
    }

    RefObject findReference(String member) {
        RefObject[] refObjects = this.getReferences();
        for (var refObject : refObjects) {
            if (Objects.equals(refObject.refName, member)) {
                return refObject;
            }
        }
        return null;
    }
}
```

And similarly for writing them:

```java
import com.oracle.truffle.api.dsl.Cached;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.frame.Frame;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.TruffleObject;
import com.oracle.truffle.api.interop.UnknownIdentifierException;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.library.ExportMessage;

@ExportLibrary(InteropLibrary.class)
abstract class AbstractDebuggerScopeObject implements TruffleObject {
    // ...

    @ExportMessage(name = "isMemberModifiable")
    static final class MemberModifiable {
        @Specialization(limit = "MEMBER_CACHE_LIMIT", guards = "cachedMember.equals(member)")
        static boolean isMemberModifiableCached(
                AbstractDebuggerScopeObject receiver,
                String member,
                @Cached("member")
                String cachedMember,
                @Cached("isMemberModifiableUncached(receiver, member)")
                boolean cachedResult) {
            return cachedResult;
        }

        @Specialization(replaces = "isMemberModifiableCached")
        static boolean isMemberModifiableUncached(
                AbstractDebuggerScopeObject receiver,
                String member) {
            return receiver.hasReferenceCalled(member);
        }
    }

    @ExportMessage(name = "writeMember")
    static final class WriteMember {
        @Specialization(limit = "MEMBER_CACHE_LIMIT", guards = "cachedMember.equals(member)")
        static void writeMemberCached(
                AbstractDebuggerScopeObject receiver,
                String member,
                Object value,
                @Cached("member")
                String cachedMember,
                @Cached("receiver.findReference(member)")
                RefObject refObject)
                throws UnknownIdentifierException {
            writeMember(receiver, member, refObject, value);
        }

        @Specialization(replaces = "writeMemberCached")
        static void writeMemberUncached(
                AbstractDebuggerScopeObject receiver,
                String member,
                Object value)
                throws UnknownIdentifierException {
            RefObject refObject = receiver.findReference(member);
            writeMember(receiver, member, refObject, value);
        }

        private static void writeMember(
                AbstractDebuggerScopeObject receiver,
                String member,
                RefObject refObject,
                Object value)
                throws UnknownIdentifierException {
            if (refObject == null) {
                throw UnknownIdentifierException.create(member);
            }
            refObject.writeReference(receiver.frame, value);
        }
    }
}
```

### Finding references

The `getReferences()` method is implemented in the two subclasses of `AbstractDebuggerScopeObject`,
`FuncDebuggerScopeObject`:

```java
import com.oracle.truffle.api.frame.Frame;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.library.ExportMessage;

@ExportLibrary(InteropLibrary.class)
public final class FuncDebuggerScopeObject extends AbstractDebuggerScopeObject {
    private final UserFuncBodyStmtNode userFuncBodyStmtNode;

    public FuncDebuggerScopeObject(UserFuncBodyStmtNode userFuncBodyStmtNode,
            Frame frame) {
        super(frame);
        this.userFuncBodyStmtNode = userFuncBodyStmtNode;
    }

    @Override
    protected RefObject[] getReferences() {
        return this.userFuncBodyStmtNode.getFuncArgAndLocalVarRefs();
    }

    @ExportMessage
    Object toDisplayString(boolean allowSideEffects) {
        return this.userFuncBodyStmtNode.getRootNode().getName();
    }
}
```

And `BlockDebuggerScopeObject`:

```java
import com.oracle.truffle.api.dsl.Cached;
import com.oracle.truffle.api.dsl.Cached.Shared;
import com.oracle.truffle.api.frame.Frame;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.UnsupportedMessageException;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.library.ExportMessage;
import com.oracle.truffle.api.nodes.Node;
import com.oracle.truffle.api.nodes.RootNode;

@ExportLibrary(InteropLibrary.class)
public final class BlockDebuggerScopeObject extends AbstractDebuggerScopeObject {
    // needs to be package-private,
    // as it's used in @Cached expressions
    final BlockStmtNode blockStmtNode;

    public BlockDebuggerScopeObject(BlockStmtNode blockStmtNode, Frame frame) {
        super(frame);
        this.blockStmtNode = blockStmtNode;
    }

    @Override
    protected RefObject[] getReferences() {
        return this.blockStmtNode.getLocalVarRefs();
    }

    @ExportMessage
    Object toDisplayString(boolean allowSideEffects,
            @Cached(value = "this.blockStmtNode.findParentBlock()", adopt = false, allowUncached = true)
            @Shared("nodeGrandParentBlock")
            Node nodeGrandParentBlock) {
       return nodeGrandParentBlock instanceof RootNode
            ? ((RootNode) nodeGrandParentBlock).getName()
            : "block";
    }

    @ExportMessage
    boolean hasScopeParent(
            @Cached(value = "this.blockStmtNode.findParentBlock()", adopt = false, allowUncached = true)
            @Shared("nodeGrandParentBlock")
            Node nodeGrandParentBlock) {
        return !(nodeGrandParentBlock instanceof StmtBlockRootNode);
    }

    @ExportMessage
    Object getScopeParent(
            @Cached(value = "this.blockStmtNode.findParentBlock()", adopt = false, allowUncached = true)
            @Shared("nodeGrandParentBlock")
            Node nodeGrandParentBlock)
            throws UnsupportedMessageException {
        if (nodeGrandParentBlock instanceof BlockStmtNode) {
            return new BlockDebuggerScopeObject((BlockStmtNode) nodeGrandParentBlock, this.frame);
        } else if (nodeGrandParentBlock instanceof UserFuncBodyStmtNode) {
            return new FuncDebuggerScopeObject((UserFuncBodyStmtNode) nodeGrandParentBlock, this.frame);
        } else {
            throw UnsupportedMessageException.create();
        }
    }
}
```

Since `BlockDebuggerScopeObject` can have parent blocks,
it implements the
[`hasScopeParent()`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/interop/InteropLibrary.html#hasScopeParent(java.lang.Object%29)
and [`getScopeParent()` messages](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/interop/InteropLibrary.html#getScopeParent(java.lang.Object%29)
from the `InteropLibrary`,
with similar logic to the one we've seen in `EasyScriptStmtNode.getScope()`.

The main logic of finding references is implemented in
`UserFuncBodyStmtNode` and `BlockStmtNode`,
because we want to cache the results
(since the structure of the program's AST never changes),
but we can't do it inside the scope objects themselves,
as new scope instances are constantly created as the debugger moves to different statements of the program.

We'll start with `UserFuncBodyStmtNode`,
as it's a little simpler:

```java
import com.oracle.truffle.api.CompilerDirectives;
import com.oracle.truffle.api.CompilerDirectives.CompilationFinal;
import com.oracle.truffle.api.nodes.Node;
import com.oracle.truffle.api.nodes.NodeUtil;
import com.oracle.truffle.api.nodes.NodeVisitor;
import java.util.HashSet;
import java.util.Set;

public final class UserFuncBodyStmtNode extends EasyScriptStmtNode {
    @CompilationFinal(dimensions = 1)
    private RefObject[] findFuncArgRefsCache;

    // ...

    public RefObject[] getFuncArgAndLocalVarRefs() {
        if (this.findFuncArgRefsCache == null) {
            CompilerDirectives.transferToInterpreterAndInvalidate();
            this.findFuncArgRefsCache = this.findFuncArgAndLocalVarRefs();
        }
        return this.findFuncArgRefsCache;
    }

    private RefObject[] findFuncArgAndLocalVarRefs() {
        Set<FuncArgRefObject> funcArgs = new HashSet<>();
        // The first argument is always special - it represents 'this'.
        // We'll never encounter 'this' below, because we check for ReadFunctionArgExprNode,
        // while 'this' has its own Node (ThisExprNode)
        funcArgs.add(new FuncArgRefObject("this", null, 0));
        NodeUtil.forEachChild(this, new NodeVisitor() {
            @Override
            public boolean visit(Node visitedNode) {
                if (visitedNode instanceof ReadFunctionArgExprNode) {
                    var readFunctionArgExprNode = (ReadFunctionArgExprNode) visitedNode;
                    funcArgs.add(new FuncArgRefObject(
                         readFunctionArgExprNode.argName,
                         readFunctionArgExprNode.getSourceSection(),
                         readFunctionArgExprNode.index));
                    return true;
                }
                return NodeUtil.forEachChild(visitedNode, this);
            }
        });

        var localVarNodeVisitor = new LocalVarNodeVisitor();
        NodeUtil.forEachChild(this, localVarNodeVisitor);

        var allReferences = new RefObject[funcArgs.size() +
             localVarNodeVisitor.localVarRefs.size()];
        var i = 0;
        for (var funcArg : funcArgs) {
            allReferences[i++] = funcArg;
        }
        for (var localVar : localVarNodeVisitor.localVarRefs) {
            allReferences[i++] = localVar;
        }
        return allReferences;
    }
}
```

We gather both function arguments and local variables in `findFuncArgAndLocalVarRefs()`.
We start with function (or method) arguments.
We use the
[`NodeUtil.forEachChild()` method](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/nodes/NodeUtil.html#forEachChild(com.oracle.truffle.api.nodes.Node,com.oracle.truffle.api.nodes.NodeVisitor%29)
to gather all `ReadFunctionArgExprNode` instances,
which represent expressions that read the value of a given argument.
We use a `Set` to de-duplicate if an argument is referenced more than once inside the function or method body.
Note that this means that any argument that is not referenced in the function body will not be shown in the debugger --
however, I think that's acceptable, since if an argument is never read, there's no reason to show it
(it can't affect the function execution in any way).

After the function arguments, we gather the local variables defined on the first level of the function,
using not an anonymous class implementing the
[`NodeVisitor` interface](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/nodes/NodeVisitor.html),
like we did for function arguments,
but, since we will need the same logic in `BlockStmtNode`,
we create a regular, named class, `LocalVarNodeVisitor`.
After gathering the local variables,
we combine them with the function arguments into a single array,
and cache the results in `UserFuncBodyStmtNode`
as a compilation-final field (since it is an array, we need to specify its dimension,
which in this case is `1`):

```java
import com.oracle.truffle.api.nodes.Node;
import com.oracle.truffle.api.nodes.NodeUtil;
import com.oracle.truffle.api.nodes.NodeVisitor;
import java.util.ArrayList;
import java.util.List;

public final class LocalVarNodeVisitor implements NodeVisitor {
    public final List<LocalVarRefObject> localVarRefs = new ArrayList<>(4);
    private boolean inDeclaration = false;

    @Override
    public boolean visit(Node visistedNode) {
        if (visistedNode instanceof ExprStmtNode) {
            var exprStmtNode = (ExprStmtNode) visistedNode;
            if (exprStmtNode.discardExpressionValue) {
                this.inDeclaration = true;
            }
            NodeUtil.forEachChild(visistedNode, this);
            this.inDeclaration = false;
            return true;
        }
        // Write to a variable is a declaration unless it exists already in a parent scope.
        if (this.inDeclaration && visistedNode instanceof LocalVarAssignmentExprNode) {
            var lvaen = (LocalVarAssignmentExprNode) visistedNode;
            localVarRefs.add(new LocalVarRefObject(
                 lvaen.getSlotName(),
                 lvaen.getSourceSection(),
                 lvaen.getFrameSlot()));
            return true;
        }
        // Recur into any Node except a block of statements.
        if (!(visistedNode instanceof BlockStmtNode)) {
            NodeUtil.forEachChild(visistedNode, this);
        }
        return true;
    }
}
```

To find local variable declarations,
we search for `ExprStmtNode` instances that have the `discardExpressionValue`
property set to `true`
(which we make `public` in this part of the series,
so that it can be accessed from `LocalVarNodeVisitor`),
and have a child of type `LocalVarAssignmentExprNode`
(this will cover all local variable declarations,
since they all need to be initialized,
at least with `undefined` if they don't have an explicit initializer).

We do something similar in `BlockStmtNode`,
but the main difference is that we need to also consider the parent blocks of the given block,
and combine the local variables from all of them into a single array:

```java
import com.oracle.truffle.api.CompilerDirectives;
import com.oracle.truffle.api.CompilerDirectives.CompilationFinal;
import com.oracle.truffle.api.nodes.NodeUtil;

public final class BlockStmtNode extends EasyScriptStmtNode {
    // ...

    @CompilationFinal(dimensions = 1)
    private RefObject[] findLocalVarRefsCache;

    public RefObject[] getLocalVarRefs() {
        if (this.findLocalVarRefsCache == null) {
            CompilerDirectives.transferToInterpreterAndInvalidate();
            this.findLocalVarRefsCache = this.findLocalVarRefs();
        }
        return this.findLocalVarRefsCache;
    }

    private RefObject[] findLocalVarRefs() {
        var localVarNodeVisitor = new LocalVarNodeVisitor();
        NodeUtil.forEachChild(this, localVarNodeVisitor);
        RefObject[] variables = localVarNodeVisitor.localVarRefs.toArray(new RefObject[0]);

        Node parentBlock = this.findParentBlock();
        RefObject[] parentVariables = parentBlock instanceof BlockStmtNode
             ? ((BlockStmtNode) parentBlock).getLocalVarRefs()
             : (parentBlock instanceof UserFuncBodyStmtNode
                 ? ((UserFuncBodyStmtNode) parentBlock).getFuncArgAndLocalVarRefs()
                 : null);
        if (parentVariables == null || parentVariables.length == 0) {
            return variables;
        }

        RefObject[] allVariables = new RefObject[variables.length + parentVariables.length];
        System.arraycopy(variables, 0, allVariables, 0, variables.length);
        System.arraycopy(parentVariables, 0, allVariables, variables.length, parentVariables.length);
        return allVariables;
    }
}
```

In order to construct the `RefObject` instances,
we change both `ReadFunctionArgExprNode` and `LocalVarAssignmentExprNode`
to save the name of the variable they reference:

```java
import com.oracle.truffle.api.frame.VirtualFrame;

public final class ReadFunctionArgExprNode extends EasyScriptExprNode {
    public final int index;
    public final String argName;

    public ReadFunctionArgExprNode(int index, String argName) {
        this.index = index;
        this.argName = argName;
    }

    @Override
    public Object executeGeneric(VirtualFrame frame) {
        return frame.getArguments()[this.index];
    }
}
```

```java
import com.oracle.truffle.api.dsl.ImportStatic;
import com.oracle.truffle.api.dsl.NodeChild;
import com.oracle.truffle.api.dsl.NodeField;
import com.oracle.truffle.api.frame.FrameSlotKind;

@NodeChild("initializerExpr")
@NodeField(name = "slotName", type = String.class)
@NodeField(name = "frameSlot", type = int.class)
@ImportStatic(FrameSlotKind.class)
public abstract class LocalVarAssignmentExprNode extends EasyScriptExprNode {
    public abstract String getSlotName();
    public abstract int getFrameSlot();

    // ...
}
```

With this code in place,
you should see both function arguments and local variables in the debugger:

<img src="/img/truffle/part-16/debugger-variables.png" style="width: 50%;">

## Debugger unit tests

A really nice feature of debugger support in Truffle is that you can write unit tests that verify it works correctly.
You need to add a (test) dependency on the
[`org.graalvm.truffle:truffle-tck` library](https://search.maven.org/search?q=g:org.graalvm.truffle%20AND%20a:truffle-tck)
to your project, and with that, you can programmatically control a debugger in your unit tests.

Here's a simple example, illustrating some of the capabilities:

```java
import com.oracle.truffle.api.debug.Breakpoint;
import com.oracle.truffle.api.debug.DebuggerSession;
import com.oracle.truffle.api.debug.SuspendAnchor;
import com.oracle.truffle.tck.DebuggerTester;
import org.graalvm.polyglot.Source;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

public class DebuggerTest {
    private DebuggerTester debuggerTester;

    @BeforeEach
    void setUp() {
        this.debuggerTester = new DebuggerTester();
    }

    @AfterEach
    void tearDown() {
        this.debuggerTester.close();
    }

    @Test
    void debugger_test() {
        Source source = Source.create("ezs", PROGRAM_CONTENTS);

        try (DebuggerSession debuggerSession = this.debuggerTester.startSession()) {
            debuggerSession.suspendNextExecution();
            debuggerSession.install(Breakpoint.newBuilder(source.getURI())
                 .lineIs(17)
                 .build());
            this.debuggerTester.startEval(source);

            this.debuggerTester.expectSuspended(event -> {
                assertEquals(":program", event.getTopStackFrame().getName());
                event.prepareContinue();
            });

            this.debuggerTester.expectSuspended(event -> {
                assertEquals(17, event.getSourceSection().getStartLine());
                assertEquals(SuspendAnchor.BEFORE, event.getSuspendAnchor());
                event.prepareStepOver(1);
            });

            this.debuggerTester.expectSuspended(event -> {
                assertEquals(18, event.getSourceSection().getStartLine());
                assertFalse(event.getTopStackFrame().getScope().getDeclaredValues().iterator().hasNext());
                event.prepareContinue();
            });

            this.debuggerTester.expectDone();
        }
    }
}
```

You can set breakpoints, continue execution, Step Over/Into/Out of functions,
and inspect the values the debugger has access to in the local scope.
And while the test debugger doesn't always perfectly simulate the behavior of Chrome DevTools,
it's still very worthwhile to write unit tests with it,
as it has some validations that are not performed by the real debugger,
and which make finding issues in your language's debugger support easier.

## Summary

So, this is how you can add debugger support to your language implemented with Truffle.

As usual, all the code from the article is
[available on GitHub](https://github.com/skinny85/graalvm-truffle-tutorial/tree/master/part-16).

In the next part of the series,
we will learn how to implement anonymous functions,
including [closures](https://en.wikipedia.org/wiki/Closure_(computer_programming%29),
in your Truffle language.
