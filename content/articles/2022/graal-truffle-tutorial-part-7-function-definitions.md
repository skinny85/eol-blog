---
id: 62
layout: truffle-tutorial.html
title: Graal Truffle tutorial part 7 – function definitions
summary: |
   In the seventh part of the Truffle tutorial,
   we expand on the ability to call built-in functions by allowing defining new functions.
created_at: 2022-04-30
---

In the
[previous article](/graal-truffle-tutorial-part-6-static-function-calls)
of the series,
EasyScript started supporting functions by allowing calling a small set of built-in ones.
The natural next step in our implementation is allowing the users of the language to define their own functions.

Function definitions look as follows in JavaScript:

```js
function add(a, b) {
    let sum = a + b;
    return sum;
}
```

We have the "function" keyword, followed by the name of the function,
and then its arguments, in parentheses.
The body of the function is a block of statements, between brackets;
the function can include their own local variables,
which live only for the duration of the function call.

## Challenges

Now, allowing function definitions introduces a lot of complexity into our implementation.

In the language version from the previous article,
when we saw the usage of a variable like `a`
(regardless whether it was in a reference, or in assignment),
we were certain that it meant a global variable called `a`.
However, with function definitions,
now seeing a variable like `a` might mean three different things:

1. A reference to a global variable `a`.
2. A reference to an argument of the function called `a`.
3. A reference to a local variable of the function with the name `a`.

The problem with these different types of references is that they are implemented differently in Truffle interpreters.
Global variables are stored in a separate `GlobalScopeObject`,
while function arguments are kept in the `Frame` object,
in the `arguments` array.
Local variables are also stored in the `Frame` object,
as we'll see below, albeit in a different place than the `arguments` array.

## Naive solution

So, what would be the simplest solution to this problem?

Well, since we know all 3 places a given reference can be stored in,
we can simply search through all of them at runtime.
We can start with trying to find a local variable with the name `a`;
if there is no local variable with that name,
we can check the function arguments,
and if there is no argument with that name,
we know that the variable is global
(or doesn't exist at all).

And while that would certainly work,
the problem is that it would be an inefficient solution.
Every reference to a global variable from inside a function definition, for example,
would always have to go through two unsuccessful reads at runtime before it was eventually found.

## Optimal solution -- static analysis

The key insight here that allows us to eliminate this overhead is that we can decide what each reference to a variable is just by analyzing the structure of the program --
we don't have to wait until runtime to do it.

For example, for this code:

```js
const two = 2;
function addTwo(a) {
    return two + a;
}
```

Just by looking at that program,
we can say with certainty that the reference to `two`
inside `addTwo()` is a reference to a global variable,
while the reference to `a` is a function argument.
There is no reason to check whether `two` is a local variable,
or a function argument, at runtime.

This sort of examination of the program is called
**static analysis** in the domain of implementing programming languages.
While it's most important for statically-typed languages,
as this is where type checking happens,
it's also important for dynamically-typed languages,
as we can see from the above example.

Usually, this phase is implemented separately in the compiler,
but, to keep our interpreter simple, we will do it in the parsing step.

## Frame descriptors and slots

We mentioned above that local variables are stored in the `VirtualFrame` object,
but not in the same place as the function's arguments.
If not there, then where?

They are stored in something called _indexed slots_;
basically [a map](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Map.html)
inside the `VirtualFrame`.
The keys of that map historically were instances of a class called `FrameSlot`.
However, that class has been removed in GraalVM version `22`,
and now the map is keyed by integers,
the same way function arguments are.
These integer keys are related to another important class, `FrameDescriptor`.

The frame descriptor can be thought of as containing the static analysis information about a frame.
For example, in the following JavaScript function:

```js
function hypotenuse(a, b) {
    var aa = a * a;
    var bb = b * b;
    return Math.sqrt(aa + bb);
}
```

While we can't statically know what the values of the local variables are,
since they depend on the arguments passed to the function at runtime,
we do know at compile time that every invocation of `hypotenuse()`
will need room in its frame for two local variables, `aa` and `bb`.
Since JavaScript is a dynamically-typed language,
we don't know in advance what types those slots should have --
depending on the arguments `hypotenuse()` is called with,
they could be either integers, or `double`s.
We will use specializations to allow Graal and Truffle to speculate on their types in order to squeeze out the maximum performance out of this code,
like [we do for expressions](/graal-truffle-tutorial-part-2-introduction-to-specializations).

To create these indexed slots in the frame,
we will use a [Builder class](https://en.wikipedia.org/wiki/Builder_pattern)
for `FrameDescriptor`s, the
[`FrameDescriptor.Builder` class](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/frame/FrameDescriptor.Builder.html).
You create instances of it by calling the
[`newBuilder()` static factory method](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/frame/FrameDescriptor.html#newBuilder(%29)
of `FrameDescriptor`.

You create slots in the frame descriptor by calling the
[`addSlot()` method of `FrameDescriptor.Builder`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/frame/FrameDescriptor.Builder.html#addSlot(com.oracle.truffle.api.frame.FrameSlotKind,java.lang.Object,java.lang.Object%29),
and you get back the integer number reserved for that slot.
The important thing to know is that while retrieving and storing values inside the `VirtualFrame`
is a fast operation that gets JIT-compiled into efficient machine code,
actually creating and finding the slots in the descriptor builder is slow code that never gets JIT compiled.
For those reasons, it's important to use the descriptor builder before execution starts,
during static analysis, but only use the descriptor itself at runtime.

Once the frame slots have been created in the `FrameDescriptor.Builder` instance,
we call its
[`build()` method](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/frame/FrameDescriptor.Builder.html#build(%29),
which returns a `FrameDescriptor`.
That `FrameDescriptor` instance is then passed to the `RootNode` Truffle class.
When the `CallTarget` that wraps that `RootNode` is invoked,
it will create a `VirtualFrame` instance with the appropriate number of slots
(and of the correct types, if we've provided that information to the slots),
using the information it got from the root node's `FrameDescriptor` instance.

## Simplifications

To make this already long article at least somewhat manageable in size,
we'll make three simplifications in this part,
which we will eliminate later in the series:

1. We won't implement a `return` statement yet --
  the function will return the result of evaluating the last statement of its body.
  Since this is the same behavior as for the entire program,
  this will allow us to re-use one class, `BlockStmtNode` (see below), to implement both.
  We will add the `return` statement when we handle control flow in the
  [next article](/graal-truffle-tutorial-part-8-conditionals-loops-control-flow#return-statement)
  of the series.
2. We will not allow nested functions
  (that is, functions defined inside another function).
  Their presence complicates the implementation quite a bit;
  for an example, take this code:

    ```js
    function makeAdder(add) {
        function adder(arg) {
            return arg + add;
        }
        return adder;
    }
    const add3 = makeAdder(3);
    console.log(add3(2));
    ```

    This program will print out `5`.
    The difficulty of implementing it is that the `3`
    argument passed to `makeAdder()` survives after the invocation of `makeAdder()`
    finishes -- it gets "captured" in the `adder()` function returned by `makeAdder()`.
    This sort of function is called a **closure**,
    and we will devote an entire article to implementing them later in the series.
3. We will not support the
   ["magical" `arguments`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/arguments)
   variable in function definitions, as we don't support arrays in EasyScript yet.

## Grammar

Our language's grammar will only need a small change:
adding a new type of statement, the function declaration statement:

```shell-session
stmt :   kind=('var' | 'let' | 'const') binding (',' binding)* ';'? #VarDeclStmt
     |                                                   expr1 ';'? #ExprStmt
     | 'function' name=ID '(' args=func_args ')' '{' stmt* '}' ';'? #FuncDeclStmt // new
     ;
func_args : (ID (',' ID)* )? ; // new
binding : ID ('=' expr1)? ;
```

## Parsing

The entrypoint to our parser will still be a static factory method.
However, the parser itself will now need to be stateful,
because we need to track what local variables and arguments we've seen so far in a function definition
(we don't have to track global variables --
we'll just assume anything that is not local is global):

```java
import com.oracle.truffle.api.frame.FrameDescriptor;
import org.antlr.v4.runtime.BailErrorStrategy;
import org.antlr.v4.runtime.CharStreams;
import org.antlr.v4.runtime.CommonTokenStream;

public final class EasyScriptTruffleParser {
    public static List<EasyScriptStmtNode> parse(Reader program) throws IOException {
        var lexer = new EasyScriptLexer(CharStreams.fromReader(program));
        // remove the default console error listener
        lexer.removeErrorListeners();
        var parser = new EasyScriptParser(new CommonTokenStream(lexer));
        // remove the default console error listener
        parser.removeErrorListeners();
        // throw an exception when a parsing error is encountered
        parser.setErrorHandler(new BailErrorStrategy());
        return new EasyScriptTruffleParser().parseStmtsList(parser.start().stmt());
    }

    private static abstract class FrameMember {}
    private static final class FunctionArgument extends FrameMember {
        public final int argumentIndex;
        FunctionArgument(int argumentIndex) {
            this.argumentIndex = argumentIndex;
        }
    }
    private static final class LocalVariable extends FrameMember {
        public final int variableIndex;
        public final DeclarationKind declarationKind;
        LocalVariable(int variableIndex, DeclarationKind declarationKind) {
            this.variableIndex = variableIndex;
            this.declarationKind = declarationKind;
        }
    }

    private final Map<String, FrameMember> functionLocals;
    private FrameDescriptor.Builder frameDescriptor;

    private EasyScriptTruffleParser() {
        this.functionLocals = new HashMap<>();
    }

    // ...
}
```

We store the variables local to a function in the `functionLocals` field.
Since both function arguments and local variables are indexed with integer numbers,
we introduce a private class, `FrameMember`,
with two subclasses, `FunctionArgument` and `LocalVariable`,
that allow us to distinguish between the two
(for local variables, we also save the type of the declaration,
to detect assignments to `const` variables).
We also save `FrameDescriptor.Builder` in a field,
which will be used to create slots in the function's frame for storing the local variables.

### Parsing a block of statements

In JavaScript, like in many other languages,
it's legal to call a function before it's defined.
In order to support that in EasyScript,
we need to do two loops through the list of statements on the top level.
In the first loop, we only handle function declarations;
in the second one, we handle the remaining statement types:

```java
import com.oracle.truffle.api.frame.FrameSlotKind;

public final class EasyScriptTruffleParser {
    // ...

    private List<EasyScriptStmtNode> parseStmtsList(List<EasyScriptParser.StmtContext> stmts) {
        var funcDecls = new ArrayList<FuncDeclStmtNode>();
        for (EasyScriptParser.StmtContext stmt : stmts) {
            if (stmt instanceof EasyScriptParser.FuncDeclStmtContext) {
                funcDecls.add(this.parseFuncDeclStmt((EasyScriptParser.FuncDeclStmtContext) stmt));
            }
        }

        var nonFuncDeclStmts = new ArrayList<EasyScriptStmtNode>();
        for (EasyScriptParser.StmtContext stmt : stmts) {
            if (stmt instanceof EasyScriptParser.ExprStmtContext) {
                nonFuncDeclStmts.add(this.parseExprStmt((EasyScriptParser.ExprStmtContext) stmt));
            } else if (stmt instanceof EasyScriptParser.VarDeclStmtContext) {
                EasyScriptParser.VarDeclStmtContext varDeclStmt = (EasyScriptParser.VarDeclStmtContext) stmt;
                DeclarationKind declarationKind = DeclarationKind.fromToken(varDeclStmt.kind.getText());
                List<EasyScriptParser.BindingContext> varDeclBindings = varDeclStmt.binding();
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

                    if (this.frameDescriptor == null) {
                        // this is a global variable
                        nonFuncDeclStmts.add(GlobalVarDeclStmtNodeGen.create(initializerExpr, variableId, declarationKind));
                    } else {
                        // this is a function-local variable,
                        // which we turn into an assignment expression
                        int frameSlot = this.frameDescriptor.addSlot(FrameSlotKind.Illegal, variableId, declarationKind);
                        if (this.functionLocals.putIfAbsent(variableId, new LocalVariable(frameSlot, declarationKind)) != null) {
                            throw new EasyScriptException("Identifier '" + variableId + "' has already been declared");
                        }
                        LocalVarAssignmentExprNode assignmentExpr = LocalVarAssignmentExprNodeGen.create(initializerExpr, frameSlot);
                        nonFuncDeclStmts.add(new ExprStmtNode(assignmentExpr, /* discardExpressionValue */ true));
                    }
                }
            }
        }

        // return the function declarations first, and then the remaining statements
        var result = new ArrayList<EasyScriptStmtNode>(funcDecls.size() + nonFuncDeclStmts.size());
        result.addAll(funcDecls);
        result.addAll(nonFuncDeclStmts);
        return result;
    }
}
```

Here, we can see the frame slot being created from the `FrameDescriptor.Builder`
when we encounter a variable declaration inside a function definition
(we have to handle errors with duplicate variables too,
including a local variable having the same name as a function argument,
which is not allowed in JavaScript).

We store the kind of the declaration (`var`, `const` or `let`)
in the slot when creating it --
the slot has an `info` field, of type `Object`, that allows storing extra information within it --
because we need to make sure we disallow re-assigning local `const` variables.
We also save the name of the local variable in the `functionLocals` map,
which we will use below to determine whether a given reference is to a local,
or global, variable.

Since a frame slot is created at parse time, not at runtime,
we don't need a local equivalent of `GlobalVarDeclStmtNode`
(which is unchanged from when it was first introduced in
[part 5](/graal-truffle-tutorial-part-5-global-variables#statement-nodes)) --
so, we transform a local variable declaration into a local variable assignment:

```java
import com.oracle.truffle.api.dsl.ImportStatic;
import com.oracle.truffle.api.dsl.NodeChild;
import com.oracle.truffle.api.dsl.NodeField;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.frame.FrameSlotKind;
import com.oracle.truffle.api.frame.VirtualFrame;

@NodeChild("initializerExpr")
@NodeField(name = "frameSlot", type = int.class)
@ImportStatic(FrameSlotKind.class)
public abstract class LocalVarAssignmentExprNode extends EasyScriptExprNode {
    protected abstract int getFrameSlot();

    @Specialization(guards = "frame.getFrameDescriptor().getSlotKind(getFrameSlot()) == Illegal || " +
            "frame.getFrameDescriptor().getSlotKind(getFrameSlot()) == Int")
    protected int intAssignment(VirtualFrame frame, int value) {
        var frameSlot = this.getFrameSlot();
        frame.getFrameDescriptor().setSlotKind(frameSlot, FrameSlotKind.Int);
        frame.setInt(frameSlot, value);
        return value;
    }

    @Specialization(replaces = "intAssignment",
            guards = "frame.getFrameDescriptor().getSlotKind(getFrameSlot()) == Illegal || " +
                    "frame.getFrameDescriptor().getSlotKind(getFrameSlot()) == Double")
    protected double doubleAssignment(VirtualFrame frame, double value) {
        var frameSlot = this.getFrameSlot();
        frame.getFrameDescriptor().setSlotKind(frameSlot, FrameSlotKind.Double);
        frame.setDouble(frameSlot, value);
        return value;
    }

    @Specialization(replaces = {"intAssignment", "doubleAssignment"})
    protected Object objectAssignment(VirtualFrame frame, Object value) {
        var frameSlot = this.getFrameSlot();
        frame.getFrameDescriptor().setSlotKind(frameSlot, FrameSlotKind.Object);
        frame.setObject(frameSlot, value);
        return value;
    }
}
```

We use specializations if the local variables happen to have an `int` or `double` type.
We use the `guards` attribute of `@Specialization` to make sure they are only activated if the frame slot
has the correct type (or has not yet been initialized,
which is represented by the `Illegal` frame slot kind --
that's why each specialization sets the appropriate kind,
even though it might be redundant).
If an object is assigned to a given local variable at any time,
we stop further specializations, and work on the boxed object exclusively.

Note that in order to write that `guards` expression,
we have to statically import the constants from the `FrameSlotKind` Truffle enum.
We do that with the `@ImportStatic` annotation.

There's a small edge case here --
a declaration of a local variable should return `undefined` when executed,
while an assignment should return the value assigned.
To distinguish a regular assignment from an assignment created from a declaration,
we add a second constructor parameter to `ExprStmtNode`
that allows discarding the value of the expression,
and returning `undefined` always:

```java
import com.oracle.truffle.api.frame.VirtualFrame;

public final class ExprStmtNode extends EasyScriptStmtNode {
    @SuppressWarnings("FieldMayBeFinal")
    @Child
    private EasyScriptExprNode expr;
    private final boolean discardExpressionValue;

    public ExprStmtNode(EasyScriptExprNode expr) {
        this(expr, false);
    }

    public ExprStmtNode(EasyScriptExprNode expr, boolean discardExpressionValue) {
        this.expr = expr;
        this.discardExpressionValue = discardExpressionValue;
    }

    @Override
    public Object executeStatement(VirtualFrame frame) {
        Object exprResult = this.expr.executeGeneric(frame);
        return this.discardExpressionValue ? Undefined.INSTANCE : exprResult;
    }
}
```

### Parsing a function declaration

```java
import com.oracle.truffle.api.frame.FrameDescriptor;
import org.antlr.v4.runtime.tree.TerminalNode;

public final class EasyScriptTruffleParser {
    // ...

    private FuncDeclStmtNode parseFuncDeclStmt(EasyScriptParser.FuncDeclStmtContext funcDeclStmt) {
        if (this.frameDescriptor != null) {
            throw new EasyScriptException("nested functions are not supported in EasyScript yet");
        }
        List<TerminalNode> funcArgs = funcDeclStmt.args.ID();
        int argumentCount = funcArgs.size();
        for (int i = 0; i < argumentCount; i++) {
            this.functionLocals.put(funcArgs.get(i).getText(), new FunctionArgument(i));
        }
        this.frameDescriptor = FrameDescriptor.newBuilder();
        List<EasyScriptStmtNode> funcStmts = this.parseStmtsList(funcDeclStmt.stmt());
        FrameDescriptor frameDescriptor = this.frameDescriptor.build();
        this.functionLocals.clear();
        this.frameDescriptor = null;
        return new FuncDeclStmtNode(funcDeclStmt.name.getText(),
                frameDescriptor, new BlockStmtNode(funcStmts), argumentCount);
    }
}
```

First, like I mentioned above, we check whether this is a function inside a function,
which we don't allow in this article.
Then, we put all function arguments in the `functionLocals` map,
mapping their names to the index in the frame they will be found under.
Note that, duplicate function arguments shadow each other --
this is consistent with how it works in JavaScript,
for example the following code:

```js
function f(a, a) {
    return a;
}
f(1, 23);
```

Will return `23`, not `1`
(although note that
[JavaScript strict mode](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode)
turns duplicate arguments into a syntax error instead).

Then, we create a new `FrameDescriptor.Builder` and save it in the `frameDescriptor` field.
That means, when we call `parseStmtsList()`,
we will now parse variable declarations as local variables,
instead of global ones.

Finally, we save the `FrameDescriptor` created from the `frameDescriptor` field in a local variable,
reset our fields after parsing the body of the function
(by setting `frameDescriptor` to `null`,
and clearing the `functionLocals` map),
and return a Node that implements a function declaration,
passing it the list of statements that comprise the function's body,
wrapped as a single `EasyScriptStatement`:

```java
import com.oracle.truffle.api.frame.VirtualFrame;

public final class BlockStmtNode extends EasyScriptStmtNode {
    @Children
    private final EasyScriptStmtNode[] stmts;

    public BlockStmtNode(List<EasyScriptStmtNode> stmts) {
        this.stmts = stmts.toArray(new EasyScriptStmtNode[]{});
    }

    @Override
    @ExplodeLoop
    public Object executeStatement(VirtualFrame frame) {
        Object ret = Undefined.INSTANCE;
        for (EasyScriptStmtNode stmt : this.stmts) {
            ret = stmt.executeStatement(frame);
        }
        return ret;
    }
}
```

`FuncDeclStmtNode` looks as follows:

```java
import com.oracle.truffle.api.frame.VirtualFrame;

public final class FuncDeclStmtNode extends EasyScriptStmtNode {
    private final String funcName;
    private final FrameDescriptor frameDescriptor;
    private final int argumentCount;

    @SuppressWarnings("FieldMayBeFinal")
    @Child
    private BlockStmtNode funcBody;

    public FuncDeclStmtNode(String funcName, FrameDescriptor frameDescriptor, BlockStmtNode funcBody, int argumentCount) {
        this.funcName = funcName;
        this.frameDescriptor = frameDescriptor;
        this.funcBody = funcBody;
        this.argumentCount = argumentCount;
    }

    @Override
    public Object executeStatement(VirtualFrame frame) {
        var truffleLanguage = this.currentTruffleLanguage();
        var funcRootNode = new StmtBlockRootNode(truffleLanguage, this.frameDescriptor, this.funcBody);
        var func = new FunctionObject(funcRootNode.getCallTarget(), this.argumentCount);
        var context = this.currentLanguageContext();
        context.globalScopeObject.newFunction(this.funcName, func);
        return Undefined.INSTANCE;
    }
}
```

We create a new `FunctionObject`,
the same class that we used for the built-in functions from the
[previous article](/graal-truffle-tutorial-part-6-static-function-calls#functionobject).
Since we need a new a `CallTarget` for `FunctionObject`,
we have to create a new `RootNode`.
`StmtBlockRootNode` is very simple:

```java
import com.oracle.truffle.api.frame.FrameDescriptor;

public final class StmtBlockRootNode extends RootNode {
    @SuppressWarnings("FieldMayBeFinal")
    @Child
    private BlockStmtNode blockStmt;

    public StmtBlockRootNode(EasyScriptTruffleLanguage truffleLanguage,
            BlockStmtNode blockStmt) {
        this(truffleLanguage, null, blockStmt);
    }

    public StmtBlockRootNode(EasyScriptTruffleLanguage truffleLanguage,
            FrameDescriptor frameDescriptor, BlockStmtNode blockStmt) {
        super(truffleLanguage, frameDescriptor);

        this.blockStmt = blockStmt;
    }

    @Override
    public Object execute(VirtualFrame frame) {
        return this.blockStmt.executeStatement(frame);
    }
}
```

It has two constructors, because we also use it as the root Node for the entire program
(in which case we don't have a `FrameDescriptor`).

Since we need a `TruffleLanguage` instance to create the `RootNode` from `FuncDeclStmtNode`,
we employ a similar trick to what we did for retrieving the context from a Node in
[part 5](/graal-truffle-tutorial-part-5-global-variables#statement-nodes),
just now with the
[`LanguageReference` class](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/TruffleLanguage.LanguageReference.html)
instead of with
[`ContextReference`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/TruffleLanguage.ContextReference.html).

The `newFunction` method in `GlobalScopeObject` is extremely simple:

```java
@ExportLibrary(InteropLibrary.class)
public final class GlobalScopeObject implements TruffleObject {
    private final Map<String, Object> variables = new HashMap<>();

    // ...

    public void newFunction(String name, FunctionObject func) {
        this.variables.put(name, func);
    }
}
```

We don't have to do any checking for duplicates,
because it's actually legal in JavaScript to override functions;
for example, this program:

```js
function f() { return 1; }
function f() { return 2; }
console.log(f());
```

Will execute without any errors,
even in strict mode, and print out `2`.

### Parsing an assignment expression

When we encounter an assignment,
we have to check whether it's a local (including function arguments),
or global, variable:

```java
public final class EasyScriptTruffleParser {
    // ...

    private EasyScriptExprNode parseAssignmentExpr(EasyScriptParser.AssignmentExpr1Context assignmentExpr) {
        String variableId = assignmentExpr.ID().getText();
        FrameMember frameMember = this.functionLocals.get(variableId);
        EasyScriptExprNode initializerExpr = this.parseExpr1(assignmentExpr.expr1());
        if (frameMember == null) {
            return GlobalVarAssignmentExprNodeGen.create(initializerExpr, variableId);
        } else {
            if (frameMember instanceof FunctionArgument) {
                return new WriteFunctionArgExprNode(initializerExpr, ((FunctionArgument) frameMember).argumentIndex);
            } else {
                var localVariable = (LocalVariable) frameMember;
                if (localVariable.declarationKind == DeclarationKind.CONST) {
                    throw new EasyScriptException("Assignment to constant variable '" + variableId + "'");
                }
                return LocalVarAssignmentExprNodeGen.create(initializerExpr, localVariable.variableIndex);
            }
        }
    }
}
```

If the assignment is to a global or local variable,
we use either `GlobalVarAssignmentExprNode`
(which is unchanged from when it was introduced in a
[previous part](/graal-truffle-tutorial-part-5-global-variables#expression-nodes)
of the series),
or `LocalVarAssignmentExprNode` that we've seen above, respectively.
But if the assignment is to a function argument,
we use the `WriteFunctionArgExprNode` class:

```java
import com.oracle.truffle.api.frame.VirtualFrame;

public final class WriteFunctionArgExprNode extends EasyScriptExprNode {
    private final int index;

    @SuppressWarnings("FieldMayBeFinal")
    @Child
    private EasyScriptExprNode initializerExpr;

    public WriteFunctionArgExprNode(EasyScriptExprNode initializerExpr, int index) {
        this.index = index;
        this.initializerExpr = initializerExpr;
    }

    @Override
    public Object executeGeneric(VirtualFrame frame) {
        Object value = this.initializerExpr.executeGeneric(frame);
        frame.getArguments()[this.index] = value;
        return value;
    }
}
```

But this raises an interesting question.
Like we saw in the previous article,
when calling a function in JavaScript,
you don't have to provide all declared arguments.
But in those cases, the `arguments` array in the `VirtualFrame`
might not have enough elements to perform the write.
Like in the following code:

```js
function f(a, b) {
    b = 3;
    return b;
}
f(1);
```

To handle this case, we need to modify the `FunctionDispatchNode` from the
[previous article](/graal-truffle-tutorial-part-6-static-function-calls#functiondispatchnode)
to make sure we extend the array of arguments before performing the call:

```java
public abstract class FunctionDispatchNode extends Node {
    // ...

    private static Object[] extendArguments(Object[] arguments, FunctionObject function) {
        if (arguments.length >= function.argumentCount) {
            return arguments;
        }
        Object[] ret = new Object[function.argumentCount];
        for (int i = 0; i < function.argumentCount; i++) {
            ret[i] = i < arguments.length ? arguments[i] : Undefined.INSTANCE;
        }
        return ret;
    }
}
```

### Parsing a reference expression

And finally, we need to handle referencing variables:

```java
public final class EasyScriptTruffleParser {
    // ...

    private EasyScriptExprNode parseReference(String variableId) {
        FrameMember frameMember = this.functionLocals.get(variableId);
        if (frameMember == null) {
            return GlobalVarReferenceExprNodeGen.create(variableId);
        } else {
            return frameMember instanceof FunctionArgument
                    ? new ReadFunctionArgExprNode(((FunctionArgument) frameMember).argumentIndex)
                    : LocalVarReferenceExprNodeGen.create(((LocalVariable) frameMember).variableIndex);
        }
    }
}
```

This is where we use the information about the frame slot we saved in `LocalVarAssignmentExprNode`:

```java
import com.oracle.truffle.api.dsl.NodeField;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.frame.VirtualFrame;

@NodeField(name = "frameSlot", type = int.class)
public abstract class LocalVarReferenceExprNode extends EasyScriptExprNode {
    protected abstract int getFrameSlot();

    @Specialization(guards = "frame.isInt(getFrameSlot())")
    protected int readInt(VirtualFrame frame) {
        return frame.getInt(this.getFrameSlot());
    }

    @Specialization(guards = "frame.isDouble(getFrameSlot())", replaces = "readInt")
    protected double readDouble(VirtualFrame frame) {
        return frame.getDouble(this.getFrameSlot());
    }

    @Specialization(replaces = {"readInt", "readDouble"})
    protected Object readObject(VirtualFrame frame) {
        return frame.getObject(this.getFrameSlot());
    }
}
```

## Summary

So, this is how to implement user-defined functions in Truffle.
As you can see, most of the complexity in the implementations comes from the static analysis needed to determine whether a given reference is to a local,
or global, variable.
The code in the Nodes themselves is relatively straightforward,
and doesn't really use many features we haven't seen before --
the new elements in this part are mainly the APIs related to storing different values in the `VirtualFrame` instance.

As usual, all code from the article is
[available on GitHub](https://github.com/skinny85/graalvm-truffle-tutorial/tree/master/part-07).

In the [next part](/graal-truffle-tutorial-part-8-conditionals-loops-control-flow)
of the series,
we will add loops and control flow to our language.
