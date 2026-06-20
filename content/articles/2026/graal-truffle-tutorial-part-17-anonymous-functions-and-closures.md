---
id: 86
layout: truffle-tutorial.html
title: "Graal Truffle tutorial part 17 – anonymous functions and closures"
summary: |
   In the seventeenth part of the GraalVM Truffle tutorial,
   we add support for anonymous functions, including closures,
   to our language.
created_at: 2026-06-20
---

## Introduction

When we first added the ability to declare functions to EasyScript,
our simplified subset of JavaScript,
all the way back in [part 7](/graal-truffle-tutorial-part-7-function-definitions),
we deliberately disallowed defining functions nested inside other functions.
The reason for this ban is that allowing nested functions requires the language to implement a concept called
[closures](https://en.wikipedia.org/wiki/Closure_(computer_programming%29),
which adds a significant amount of complexity to the language's implementation.

In this part, we will learn how to implement closures with GraalVM's Truffle language implementation framework.

## The call stack

In order to understand what problem closures solve,
we first have to understand how function calls work in high-level programming languages.

When a function is called, a new frame is created, and pushed onto the call stack.
That frame in Truffle is represented by the
[`VirtualFrame` class](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/frame/VirtualFrame.html)
instances that we've seen in the `execute*()`
methods of our AST Nodes from the
[very first part of the tutorial](/graal-truffle-tutorial-part-1-setup-nodes-calltarget).

The frame contains both the arguments it was called with,
and the local variables of the function.
That's why we had to pass a
[`FrameDescriptor` instance](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/frame/FrameDescriptor.html)
when creating
[the `RootNode`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/nodes/RootNode.html)
for a user-defined function:
so that the runtime knew how much space it had to allocate for the frame of that particular function.

For example, let's consider the following JavaScript code that calculates the 10th Fibonacci number,
using the iterative algorithm, and prints it out:

```js
function fib(n) {
    if (n < 2) {
        return n;
    }
    let a = 0, b = 1, i = 2;
    while (i <= n) {
        let f = a + b;
        a = b;
        b = f;
        i = i + 1;
    }
    return b;
}

function main() {
    let f10 = fib(10);
    console.log(f10);
}

main();
```

This is how the call stack changes during the execution of that program:

![](img/truffle/part-17/call-stack.png)

The call stack starts empty.
Then, the code `main();` gets executed,
and it creates a new frame for the `main` function,
which contains no arguments, and a single local variable `f10`.

Then, the `main` function calls `fib(10)`,
so the runtime pushes a new frame onto the stack,
for the `fib` function, which takes a single argument `n`,
and has four local variables: `a`, `b`, `i`, and `f`,
so its frame needs to be considerably larger than the frame for `main`.
The call stack now contains two frames.

The `fib` function executes its logic,
and eventually returns the value `55` to its caller, `main`.
At that point, the frame for `fib` is popped from the stack,
and the value `55` is stored in the local variable `f10`.

Then, `main` calls `console.log(f10)`,
which creates a new frame for the `log` function,
which takes a single argument, and has no local variables
(`console.log` is an internal function, so in reality it's more complicated,
but for this example, it doesn't really matter).

After `conosole.log` finishes executing,
its frame is popped from the stack,
and then `main` also finishes executing,
and its frame is popped as well,
leaving the call stack empty again,
and the whole program terminates.

## Nested functions

The crucial piece here is that,
once the function returns,
its frame is popped from the stack,
which means that its arguments and local variables are no longer accessible.
Now, this is not a problem if references to those variables cannot escape the function body,
which is the case for the `main` and `fib` functions above.
However, once we introduce anonymous functions,
or the possibility to nest function definitions inside other functions,
then things become more complicated.

The classis example of that is the following JavaScript code,
which defines a function that returns another function,
that is used for adding a fixed number to its argument:

```js
function makeAdder(n) {
    function add(arg) {
        return n + arg;
    }
    return add;
}
```

Here, the inner function references the variable `n`,
which is defined in the outer function `makeAdder`.
Now, if we call `makeAdder(5)`,
it will create a new frame for `makeAdder`,
which will contain the argument `n` with the value `5`.
Then, the inner function will be created,
and returned to the caller of `makeAdder`.
At that point, if `makeAdder` is implemented like any other function,
the frame for `makeAdder` will be popped from the call stack,
and the variable `n` will no longer be accessible.
However, the inner `add` function still needs to be able to access `n`,
otherwise it won't be able to compute the result!

## Closures

So, what's the solution to this problem?
As is so often the case in computer science,
the solution is to add another level of indirection.

Instead of storing the local variables and arguments directly in the frame,
they need to be stored in a separate object,
which is typically called an "environment".
The frame then contains a reference to that environment object,
instead of the variables themselves, in a dedicated slot
(similar to like we store the `this` reference in the first argument of each function call since
[part 11](/graal-truffle-tutorial-part-11-strings-static-method-calls)).

When the outer function is called,
the runtime creates a new environment object,
and stores the values of the arguments and the local variables in that object.
The runtime also creates a new object for the inner function,
and stores a reference to the environment of the outer function in that new inner object.
This way, the environment of the outer function is kept accessible,
even after the outer function returns, and its frame is popped from the call stack,
so the inner function can still access the outer's variables through that environment.
The environment will eventually be garbage collected,
once the inner function is no longer reachable by the calling code.

This might sound a little abstract,
so let's walk through a specific example.
Let's see how the following code gets executed:

```js
function makeAdder(n) {
    function add(arg) {
        return n + arg;
    }
    return add;
}

function main() {
    const add3 = makeAdder(3);
    console.log(add3(2));
}

main();
```

The call stack goes through the following changes during the execution of that code:

![](img/truffle/part-17/closure-stack.png)

The stack starts empty.
First, `main` is called, and a frame for it is pushed onto the call stack,
with no arguments, and one local variable (`add3`).
Then `makeAdder(3)` gets called,
which has one argument `n`, and one local variable `add`.
However, since `makeAdder` contains a nested function that is a closure (`add`),
its frame stack needs to be different:
instead of containing the space for the argument and local variable,
it contains a single reference to a variable `env`,
which is where the argument and local variable are stored.
Once `makeAdder` returns a reference to the `add` local variable,
which points to a function, its frame is popped from the call stack,
but the object pointed to by `env` is still available,
and the `add3` local variable is changed to point to the `add`
property of that object.

When the function pointed to by `add3` gets called with the argument `2`,
its frame is pushed onto the call stack,
but it retains a reference to the `env` object,
and so it can find the correct value of the `n`
argument when `makeAdder` was originally called.
Using that value, `add3` returns `5`,
and that value is passed to the `console.log`
method that displays it.
Once `console.log` and `main` finish,
their frames are popped from the call stack.
When the frame for `main` is popped,
there are no more references to the `env`
object created when `makeAdder(3)` was called,
and so that object can be safely garbage collected.

## Implementation plan

Now, if we wanted to implement this functionality from scratch,
it would be a lot of work.
We would have to change how reading and writing both function arguments and local variables works for parents of closures
(they would have to be read from this environment object instead of directly from the frame, like they are now),
and we would have to make sure to create these environment objects,
and store references to them.

However, the authors of the Truffle framework realized closures are an important feature that many languages will need,
and so they added capabilities to make implementing them easier.
The most important of these is the
[`materialize()` method the `VirtualFrame` interface](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/frame/Frame.html#materialize(%29),
which turns the frame that is passed to the `execute*()`
methods into that environment object we mentioned above.
Even more importantly, any writes that come through the `VirtualFrame`
instance that `materialize()` was called on are visible also on the returned
[`MaterializedFrame`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/frame/MaterializedFrame.html),
which means you don't have to make any changes to the parent of the closure
(to make it access its arguments and local variables through the environment object) --
it can keep accessing them through the `VirtualFrame`,
and everything will still work.

## `FunctionObject`

In order to use the `MaterializedFrame`,
we need to add it as a public field to EasyScript's `FunctionObject`:

```java
import com.oracle.truffle.api.CallTarget;
import com.oracle.truffle.api.frame.MaterializedFrame;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.object.Shape;

@ExportLibrary(InteropLibrary.class)
public final class FunctionObject extends JavaScriptObject {
    public final CallTarget callTarget;
    public final int argumentCount;
    public final MaterializedFrame materializedFrame;
    private final FunctionDispatchNode functionDispatchNode;

    public FunctionObject(Shape shape, ClassPrototypeObject functionPrototype,
            CallTarget callTarget, int argumentCount, MaterializedFrame materializedFrame) {
        super(shape, functionPrototype);

        this.callTarget = callTarget;
        this.argumentCount = argumentCount;
        this.materializedFrame = materializedFrame;
        this.functionDispatchNode = FunctionDispatchNodeGen.create();
    }

    // ...
}
```

We will pass it as `null` for non-closure functions,
and non-`null` for closure functions.
We use it in the dispatch Node,
passing it as a second argument to the underlying closure if it's not `null`,
and offsetting the remaining arguments by an extra index in that case:

```java
import com.oracle.truffle.api.nodes.Node;

public abstract class FunctionDispatchNode extends Node {
    // ...

    private static Object[] extendArguments(
            Object[] arguments, Object receiver, FunctionObject function) {
        int extraArgs = function.materializedFrame == null ? 1 : 2;
        int extendedArgumentsLength = function.argumentCount + extraArgs;
        Object[] ret = new Object[extendedArgumentsLength];
        ret[0] = receiver;
        if (function.materializedFrame != null) {
            ret[1] = function.materializedFrame;
        }
        for (int i = extraArgs; i < extendedArgumentsLength; i++) {
            int j = i - extraArgs;
            ret[i] = j < arguments.length ? arguments[j] : Undefined.INSTANCE;
        }
        return ret;
    }
}
```

## Function declaration expressions and statements

In previous parts of the tutorial,
the two components of evaluating a function's definition:
creating (and caching) a `FunctionObject` for it,
and then saving it in the global scope,
were both contained in one class,
`FuncDeclStmtNode`, since the language only allowed global function definitions.
But now, since we want to add
[lambda expressions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions)
and nested functions, this assumption no longer holds,
and so we need to separate them.

The first component is a new function expression.
We have it work in two modes: one for non-closures,
where we can cache the entire `FunctionObject`,
and one for closures, where we need to materialize the frame,
and thus can only cache the `CallTarget`,
but we need to re-create the `FunctionObject`
with the materialized frame each time:

```java
import com.oracle.truffle.api.CallTarget;
import com.oracle.truffle.api.CompilerDirectives;
import com.oracle.truffle.api.CompilerDirectives.CompilationFinal;
import com.oracle.truffle.api.frame.FrameDescriptor;
import com.oracle.truffle.api.frame.MaterializedFrame;
import com.oracle.truffle.api.frame.VirtualFrame;

public final class FuncDefExprNode extends EasyScriptExprNode {
    private final FrameDescriptor frameDescriptor;
    private final UserFuncBodyStmtNode funcBody;
    private final String funcName;
    private final int argumentCount;
    private final boolean isClosure;

    @CompilationFinal
    private CallTarget cachedCallTarget;

    @CompilationFinal
    private FunctionObject cachedFunction;

    public FuncDefExprNode(FrameDescriptor frameDescriptor, UserFuncBodyStmtNode funcBody, 
            String funcName, int argumentCount, boolean isClosure) {
        this.frameDescriptor = frameDescriptor;
        this.funcBody = funcBody;
        this.funcName = funcName;
        this.argumentCount = argumentCount;
        this.isClosure = isClosure;
    }

    @Override
    public Object executeGeneric(VirtualFrame frame) {
        if (this.cachedCallTarget == null) {
            CompilerDirectives.transferToInterpreterAndInvalidate();

            var truffleLanguage = this.currentTruffleLanguage();
            var funcRootNode = new StmtBlockRootNode(truffleLanguage,
                    this.frameDescriptor, this.funcBody, this.funcName);
            this.cachedCallTarget = funcRootNode.getCallTarget();

            if (!this.isClosure) {
                ShapesAndPrototypes shapesAndPrototypes = this.currentLanguageContext().shapesAndPrototypes;
                this.cachedFunction = new FunctionObject(shapesAndPrototypes.rootShape,
                        shapesAndPrototypes.functionPrototype, this.cachedCallTarget,
                        this.argumentCount, /* materializedFrame */ null);
            }
        }

        if (!this.isClosure) {
            return this.cachedFunction;
        } else {
            MaterializedFrame materializedFrame = frame.materialize();
            ShapesAndPrototypes shapesAndPrototypes = this.currentLanguageContext().shapesAndPrototypes;
            return new FunctionObject(shapesAndPrototypes.rootShape, shapesAndPrototypes.functionPrototype,
                    this.cachedCallTarget, this.argumentCount, materializedFrame);
        }
    }
}
```

With `FuncDefExprNode` now in place,
we can refactor `FuncDeclStmtNode` to use it as a child Node:

```java
import com.oracle.truffle.api.dsl.NodeChild;
import com.oracle.truffle.api.dsl.NodeField;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.library.CachedLibrary;
import com.oracle.truffle.api.object.DynamicObject;
import com.oracle.truffle.api.object.DynamicObjectLibrary;

@NodeChild(value = "containerObjectExpr", type = EasyScriptExprNode.class)
@NodeChild(value = "funcDefExpr", type = FuncDefExprNode.class)
@NodeField(name = "funcName", type = String.class)
public abstract class FuncDeclStmtNode extends EasyScriptStmtNode {
    protected abstract String getFuncName();

    @Specialization(limit = "2")
    protected Object declareFunction(DynamicObject containerObject, Object func,
            @CachedLibrary("containerObject") DynamicObjectLibrary objectLibrary) {
        objectLibrary.putConstant(containerObject, this.getFuncName(), func, 0);
        return Undefined.INSTANCE;
    }

    // ...
}
```

And introduce a new statement for function definitions nested in other functions.
In that case, we need to save the resulting `FunctionObject`
not in the global object,
but as a local variable of the current frame
(we'll allocate the slot in the frame during parsing,
as we do for other local variables):

```java
import com.oracle.truffle.api.dsl.NodeChild;
import com.oracle.truffle.api.dsl.NodeField;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.instrumentation.Tag;

@NodeChild(value = "funcDefExpr", type = FuncDefExprNode.class)
@NodeField(name = "nestedFuncFrameSlot", type = int.class)
public abstract class NestedFuncDeclStmtNode extends EasyScriptStmtNode {
    protected abstract int getNestedFuncFrameSlot();

    protected NestedFuncDeclStmtNode() {
        super(null);
    }

    @Specialization
    protected Object declareNestedFunction(VirtualFrame frame, Object func) {
        frame.setObject(this.getNestedFuncFrameSlot(), func);
        return Undefined.INSTANCE;
    }

    @Override
    public boolean hasTag(Class<? extends Tag> tag) {
        return false;
    }
}
```

## Frame

So, we now have the basic functionality in place,
where we pass the `MaterializedFrame`
as the second argument (after `this`) to closures.
But now, we need to modify the way closures read the function arguments and local variables of their parent functions,
to use that `MaterializedFrame` second argument.

However, this is tricky, because we want to leverage type specializations when reading and writing those parent local variables,
the same way we do it for "regular" local variables since
[part 7](/graal-truffle-tutorial-part-7-function-definitions).
But we don't want to introduce duplication,
and have two almost identical Node classes.

The solution here is a variant of a technique we previously used with the
[`GlobalScopeObjectExprNode` from part 10](/graal-truffle-tutorial-part-10-arrays-read-only-properties).
We introduce a new Node that will return the correct
[`Frame` instance](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/frame/Frame.html),
depending on how many levels of nesting we read or write the variables from.
Since, unlike `GlobalScopeObjectExprNode`, we will have multiple different classes in this hierarchy,
we introduce a separate abstract superclass with its own `execute*()` method:

```java
import com.oracle.truffle.api.frame.Frame;
import com.oracle.truffle.api.frame.VirtualFrame;

public abstract class AbstractFrameGetNode extends EasyScriptNode {
    public abstract Frame executeFrame(VirtualFrame frame);
}
```

The first implementation is for accessing local variables defined on the same level,
which simply returns the current frame:

```java
import com.oracle.truffle.api.frame.Frame;
import com.oracle.truffle.api.frame.VirtualFrame;

public final class CurrentFrameGetNode extends AbstractFrameGetNode {
    @Override
    public Frame executeFrame(VirtualFrame frame) {
        return frame;
    }
}
```

The second implementation reads the `MaterializedFrame`
from the second argument in the frame,
put there by `FunctionDispatchNode`.
However, we don't use the frame directly,
but instead we get it from another instance of `AbstractFrameGetNode`,
so that we can compose them,
and thus read variables from any level of nesting:

```java
import com.oracle.truffle.api.frame.Frame;
import com.oracle.truffle.api.frame.MaterializedFrame;
import com.oracle.truffle.api.frame.VirtualFrame;

public final class ParentFrameGetNode extends AbstractFrameGetNode {
    @Child @SuppressWarnings("FieldMayBeFinal")
    private AbstractFrameGetNode currentOrParentFrameGetNode;

    public ParentFrameGetNode(AbstractFrameGetNode currentOrParentFrameGetNode) {
        this.currentOrParentFrameGetNode = currentOrParentFrameGetNode;
    }

    @Override
    public Frame executeFrame(VirtualFrame frame) {
        return (MaterializedFrame) this.currentOrParentFrameGetNode.executeFrame(frame).getArguments()[1];
    }
}
```

With this hierarchy in place,
we can add it as a child Node to `ReadFunctionArgExprNode`,
and use it to read function arguments from the `Frame`
received from executing the `AbstractFrameGetNode` child,
instead of the `VirtualFrame` passed as an argument to
`executeGeneric()`:

```java
import com.oracle.truffle.api.frame.Frame;
import com.oracle.truffle.api.frame.VirtualFrame;

public final class ReadFunctionArgExprNode extends EasyScriptExprNode {
    @Child @SuppressWarnings("FieldMayBeFinal")
    private AbstractFrameGetNode currentOrParentFrameGetNode;

    public final int index;

    public final String argName;

    public ReadFunctionArgExprNode(AbstractFrameGetNode currentOrParentFrameGetNode, int index, String argName) {
        this.currentOrParentFrameGetNode = currentOrParentFrameGetNode;
        this.index = index;
        this.argName = argName;
    }

    @Override
    public Object executeGeneric(VirtualFrame frame) {
        Frame currentOrParentFrame = this.currentOrParentFrameGetNode.executeFrame(frame);
        // we are guaranteed the argument array has enough elements,
        // because of the logic in FunctionDispatchNode
        return currentOrParentFrame.getArguments()[this.index];
    }
}
```

This way, the same `ReadFunctionArgExprNode` can be used for both
closures, and non-closures
(the difference between the two being only a different `AbstractFrameGetNode` instance used).

We do something very similar for `WriteFunctionArgExprNode`
(which is almost identical to `ReadFunctionArgExprNode`),
and for `LocalVarReferenceExprNode` --
but in this last case, we need to use it in a specialization method:

```java
import com.oracle.truffle.api.dsl.NodeChild;
import com.oracle.truffle.api.dsl.NodeField;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.frame.Frame;

@NodeChild(value = "currentOrParentFrameGetNode", type = AbstractFrameGetNode.class)
@NodeField(name = "frameSlot", type = int.class)
public abstract class LocalVarReferenceExprNode extends EasyScriptExprNode {
    protected abstract int getFrameSlot();

    @Specialization(guards = "currentOrParentFrame.isInt(getFrameSlot())")
    protected int readInt(Frame currentOrParentFrame) {
        return currentOrParentFrame.getInt(this.getFrameSlot());
    }

    @Specialization(guards = "currentOrParentFrame.isDouble(getFrameSlot())", replaces = "readInt")
    protected double readDouble(Frame currentOrParentFrame) {
        return currentOrParentFrame.getDouble(this.getFrameSlot());
    }

    @Specialization(guards = "currentOrParentFrame.isBoolean(getFrameSlot())")
    protected boolean readBool(Frame currentOrParentFrame) {
        return currentOrParentFrame.getBoolean(this.getFrameSlot());
    }

    @Specialization(replaces = {"readInt", "readDouble", "readBool"})
    protected Object readObject(Frame currentOrParentFrame) {
        return currentOrParentFrame.getObject(this.getFrameSlot());
    }
}
```

We also make a similar change to `LocalVarAssignmentExprNode`.

## Parsing

And finally, we need to make changes to our parser
(which, in our simplified implementation, also performs static analysis).

While JavaScript has two different forms of anonymous functions,
we'll simplify, and only implement the more modern,
[arrow function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions) form,
which means we need a new type of expression:

```shell-session
expr1 : ID '=' expr1                                   #AssignmentExpr1
      | object=expr5 '.' ID '=' rvalue=expr1           #PropertyWriteExpr1
      | arr=expr5 '[' index=expr1 ']' '=' rvalue=expr1 #ArrayIndexWriteExpr1
      | '(' args=func_args ')' '=>' stmt_block         #LambdaExpr1          // new
      | expr2                                          #PrecedenceTwoExpr1
      ;
```

During parsing, we now need to keep track of the level of nesting for each function argument and local variable:

```java
public final class EasyScriptTruffleParser {
    private int functionNestingLevel = 0;

    private static abstract class FrameMember {}
    private static final class FunctionArgument extends FrameMember {
        public final int argumentIndex;
        public final int nestingLevel;

        FunctionArgument(int argumentIndex, int nestingLevel) {
            this.argumentIndex = argumentIndex;
            this.nestingLevel = nestingLevel;
        }
    }
    private static final class LocalVariable extends FrameMember {
        public final int variableIndex;
        public final DeclarationKind declarationKind;
        public final int nestingLevel;

        LocalVariable(int variableIndex, DeclarationKind declarationKind, int nestingLevel) {
            this.variableIndex = variableIndex;
            this.declarationKind = declarationKind;
            this.nestingLevel = nestingLevel;
        }
    }

    private List<EasyScriptStmtNode> parseVarDeclStmt(EasyScriptParser.VarDeclStmtContext varDeclStmt) {
        DeclarationKind declarationKind = DeclarationKind.fromToken(varDeclStmt.kind.getText());
        List<EasyScriptParser.BindingContext> varDeclBindings = varDeclStmt.binding();
        List<EasyScriptStmtNode> ret = new ArrayList<>(varDeclBindings.size());
        for (EasyScriptParser.BindingContext varBinding : varDeclBindings) {
            String variableId = varBinding.ID().getText();
            var bindingExpr = varBinding.expr1();
            EasyScriptExprNode initializerExpr;
            if (bindingExpr == null) {
                if (declarationKind == DeclarationKind.CONST) {
                    throw new EasyScriptException("Missing initializer in const declaration '" + variableId + "'");
                }
                // if a 'let' or 'var' declaration is missing an initializer,
                // it means it will be initialized with 'undefined'
                initializerExpr = new UndefinedLiteralExprNode();
            } else {
                initializerExpr = this.parseExpr1(bindingExpr);
            }

            if (this.state == ParserState.TOP_LEVEL) {
                // this is a global variable
                ret.add(GlobalVarDeclStmtNodeGen.create(
                        this.createSourceSection(varDeclStmt),
                        GlobalScopeObjectExprNodeGen.create(),
                        initializerExpr,
                        variableId,
                        declarationKind));
            } else {
                // this is a local variable (either of a function, or on the top-level)
                var frameSlotId = new LocalVariableFrameSlotId(variableId, ++this.localVariablesCounter);
                int frameSlot = this.frameDescriptor.addSlot(FrameSlotKind.Illegal, frameSlotId, declarationKind);
                if (this.localScopes.peek().putIfAbsent(variableId, new LocalVariable(frameSlot, declarationKind, this.functionNestingLevel)) != null) {
                    throw new EasyScriptException("Identifier '" + variableId + "' has already been declared");
                }
                LocalVarAssignmentExprNode assignmentExpr = LocalVarAssignmentExprNodeGen.create(
                        new CurrentFrameGetNode(), initializerExpr, variableId, frameSlot);
                ret.add(new ExprStmtNode(assignmentExpr,
                        this.createSourceSection(varDeclStmt), /* discardExpressionValue */ true));
            }
        }
        return ret;
    }

    // ...
}
```

When encountering a reference to a variable,
we have to compare its nesting level to the current nesting level,
and create a number of `ParentFrameGetNode`s
equal to the difference between the two.
This way, we can support referencing function arguments and local variables at arbitrary levels of nesting:

```java
public final class EasyScriptTruffleParser {
    private EasyScriptExprNode parseReference(String variableId) {
        FrameMember frameMember = this.findFrameMember(variableId);
        if (frameMember == null || frameMember instanceof ClassPrototypeMember) {
            // we know for sure this is a reference to a global variable
            return GlobalVarReferenceExprNodeGen.create(GlobalScopeObjectExprNodeGen.create(), variableId);
        } else if (frameMember instanceof FunctionArgument) {
            var functionArgument = (FunctionArgument) frameMember;
            AbstractFrameGetNode currentOrParentGetFrameNode = this.establishCurrentOrParentGetFrameNode(functionArgument.nestingLevel);
            return new ReadFunctionArgExprNode(currentOrParentGetFrameNode, functionArgument.argumentIndex, variableId);
        } else {
            var localVariable = (LocalVariable) frameMember;
            AbstractFrameGetNode currentOrParentFrameGetNode = this.establishCurrentOrParentGetFrameNode(localVariable.nestingLevel);
            return LocalVarReferenceExprNodeGen.create(currentOrParentFrameGetNode, localVariable.variableIndex);
        }
    }

    private AbstractFrameGetNode establishCurrentOrParentGetFrameNode(int referenceNestingLevel) {
        AbstractFrameGetNode currentOrParentFrameGetNode = new CurrentFrameGetNode();
        for (int i = 0; i < this.functionNestingLevel - referenceNestingLevel; i++) {
            currentOrParentFrameGetNode = new ParentFrameGetNode(currentOrParentFrameGetNode);
        }
        return currentOrParentFrameGetNode;
    }
    
    // ...
}
```

We do the same for assignment expressions.

And finally, we need to parse the function expressions,
deciding which ones we treat as closures.
In EasyScript, we'll make it simple:
we'll treat every anonymous function and function declared inside another function as a closure
(in your own language, you probably want to do some more sophisticated static analysis,
since not all anonymous and nested functions need to be closures,
only those that actually reference any non-global variable outside its lexical scope):

```java
public final class EasyScriptTruffleParser {
    private EasyScriptStmtNode parseFuncDeclStmt(EasyScriptParser.FuncDeclStmtContext funcDeclStmt) {
        return this.parseSubroutineDecl(funcDeclStmt.subroutine_decl(),
                GlobalScopeObjectExprNodeGen.create());
    }

    private EasyScriptStmtNode parseSubroutineDecl(EasyScriptParser.Subroutine_declContext subroutineDecl,
            EasyScriptExprNode containerObjectExpr) {
        String subroutineName = subroutineDecl.name.getText();
        boolean isNestedFunction = this.state == ParserState.FUNC_DEF;
        // make the default a characteristic value,
        // so we can easily find where it came from if we accidentally use it
        // (without assigning it the correct value first)
        int nestedFuncFrameSlot = -123;
        if (isNestedFunction) {
            // reserve a slot in the FrameDescriptor of the parent function for the nested function
            var frameSlotId = new LocalVariableFrameSlotId(subroutineName, ++this.localVariablesCounter);
            DeclarationKind declarationKind = DeclarationKind.LET;
            nestedFuncFrameSlot = this.frameDescriptor.addSlot(FrameSlotKind.Object, frameSlotId, declarationKind);
            if (this.localScopes.peek().putIfAbsent(subroutineName, new LocalVariable(nestedFuncFrameSlot, declarationKind, this.functionNestingLevel)) != null) {
                throw new EasyScriptException("Identifier '" + subroutineName + "' has already been declared");
            }
        }

        FuncDefExprNode funcDefExprNode = this.parseFuncDefExpr(
                subroutineDecl.args, subroutineDecl.stmt_block(),
                subroutineName, this.createSourceSection(subroutineDecl),
                /* isClosure */ isNestedFunction);

        return isNestedFunction
                ? NestedFuncDeclStmtNodeGen.create(
                        funcDefExprNode,
                        nestedFuncFrameSlot)
                : FuncDeclStmtNodeGen.create(
                        containerObjectExpr,
                        funcDefExprNode,
                        subroutineName);
    }

    private FuncDefExprNode parseLambdaExpr(EasyScriptParser.LambdaExpr1Context lambdaExpr) {
        return this.parseFuncDefExpr(lambdaExpr.args, lambdaExpr.stmt_block(), null,
                this.createSourceSection(lambdaExpr), /* isClosure */ true);
    }

    private FuncDefExprNode parseFuncDefExpr(
        EasyScriptParser.Func_argsContext args, EasyScriptParser.Stmt_blockContext stmtBlock,
        String funcName, SourceSection sourceSection, boolean isClosure
    ) {
        // save the current state of the parser (before entering the function)
        FrameDescriptor.Builder previousFrameDescriptor = this.frameDescriptor;
        ParserState previousParserState = this.state;

        // initialize the new state
        this.frameDescriptor = FrameDescriptor.newBuilder();
        this.state = ParserState.FUNC_DEF;
        this.functionNestingLevel++;

        var localVariables = new HashMap<String, FrameMember>();
        // add each parameter to the map, with the correct index
        List<TerminalNode> funcArgs = args.ID();
        int argumentCount = funcArgs.size();
        // all arguments need to be offset by 1 because of 'this',
        // and closures need offset by 2, to account for the parent frame
        int offset = isClosure ? 2 : 1;
        // first, initialize the locals with function arguments
        for (int i = 0; i < argumentCount; i++) {
            localVariables.put(funcArgs.get(i).getText(), new FunctionArgument(i + offset, this.functionNestingLevel));
        }
        this.localScopes.push(localVariables);

        // parse the statements in the function definition
        List<EasyScriptStmtNode> funcStmts = this.parseStmtsList(stmtBlock.stmt());

        FrameDescriptor frameDescriptor = this.frameDescriptor.build();
        // bring back the old state
        this.frameDescriptor = previousFrameDescriptor;
        this.state = previousParserState;
        this.localScopes.pop();
        this.functionNestingLevel--;

        return new FuncDefExprNode(
                frameDescriptor,
                new UserFuncBodyStmtNode(funcStmts, sourceSection),
                funcName, argumentCount, isClosure);
    }

    // ...
}
```

## Benchmark

Now that we have the implementation,
let's measure how performant closures are.
We'll use a simple countdown function for the benchmark,
similar to what we use for exceptions in
[part 15](/graal-truffle-tutorial-part-15-exceptions).

To make sure we have a point of reference for the numbers,
we'll have several variants of the benchmark.

The first variant is a baseline that doesn't use nested functions or closures at all:

```js
function countDownBaseline(n) {
    let count = 0;
    for (let i = n; i > 0; i = i - 1) {
        count = count + 1;
    }
    return count;
}
```

The second variant is a nested function,
but not a closure:

```js
function countDownNested(n) {
    function countDownInternal(n) {
        let count = 0;
        for (let i = n; i > 0; i = i - 1) {
            count = count + 1;
        }
        return count;
    }
    return countDownInternal(n);
}
```

The third is a nested function that is a closure:

```js
function countDownClosure(n) {
    let count = 0;
    function countDownInternal() {
        for (let i = n; i > 0; i = i - 1) {
            count = count + 1;
        }
    }
    countDownInternal();
    return count;
}
```

And finally, an anonymous function that is also a closure:

```js
function countDownLambda(n) {
    let count = 0;
    (() => {
        for (let i = n; i > 0; i = i - 1) {
            count = count + 1;
        }
    })();
    return count;
}
```

Here are the results when running the benchmark on my laptop:

```shell-session
Benchmark                                 Mode  Cnt    Score    Error  Units
ClosureBenchmark.count_down_baseline_ezs  avgt    5  674.853 ± 15.058  us/op
ClosureBenchmark.count_down_baseline_js   avgt    5  720.268 ±  6.003  us/op
ClosureBenchmark.count_down_closure_ezs   avgt    5  725.877 ± 24.909  us/op
ClosureBenchmark.count_down_closure_js    avgt    5  795.591 ± 20.808  us/op
ClosureBenchmark.count_down_lambda_ezs    avgt    5  718.803 ± 42.839  us/op
ClosureBenchmark.count_down_lambda_js     avgt    5  708.936 ± 19.386  us/op
ClosureBenchmark.count_down_nested_ezs    avgt    5  715.177 ± 14.053  us/op
ClosureBenchmark.count_down_nested_js     avgt    5  682.771 ± 30.691  us/op
```

The results for all 4 benchmarks are pretty much identical,
so closures don't carry a performance penalty in Truffle.

## Summary

So, this is how you implement closures with Truffle.

As usual, all the code from the article is
[available on GitHub](https://github.com/skinny85/graalvm-truffle-tutorial/tree/master/part-17).

In the next part of the series,
we will learn how to implement
[tail-call optimization](https://en.wikipedia.org/wiki/Tail_call)
in Truffle.
