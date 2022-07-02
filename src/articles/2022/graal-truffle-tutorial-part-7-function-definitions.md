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

You have the "function" keyword,
followed by the name of the function,
and then its arguments, in parenthesis.
The body of the function is a block of statements, between brackets;
the function can include their own local variables,
which live only for the duration of the function call.

## Challenges

Now, allowing function definitions introduces a lot of complexity into our implementation.

In the language version from the previous article,
when we saw the usage of a variable like `a`
(regardless whether it was a reference, or an assignment),
we were certain that it meant a global variable called `a`.
However, with function definitions,
now seeing a variable like `a` might mean three different things:

1. A reference to a global variable `a`.
2. A reference to an argument of the function called `a`.
3. A reference to a local variable of the function with the name `a`.

The problem with these different types of references is that they are implemented differently in our Truffle interpreter.
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
inside `addTwo` is a reference to a global variable,
while the reference to `a` is a function argument.
There is no reason to check whether `two` is a local variable,
or a function argument, at runtime.

This sort of examination of the program is called
**static analysis** in the programming language implementation domain.
While it's most important for statically-typed languages,
as this is the place where type checking is implemented,
it's also important for dynamically-typed languages,
as we can see from the above example.

Usually, this phase is implemented separately in the compiler,
but, to keep our interpreter simple, we will do it in the parsing step.

Note that JavaScript's [variable hoisting](https://developer.mozilla.org/en-US/docs/Glossary/Hoisting)
makes things a little bit more tricky.
Take the following code:

```js
const a = 2;
function f() {
    var b = a;
    var a = 1;
    return b;
}
```

At first glance, it might seem that the reference to `a`
in the definition of `b` is a reference to the global variable `a`;
however, because of hoisting, that code will actually be rewritten to:

```js
const a = 2;
function f() {
    var b, a;
    b = a;
    a = 1;
    return b;
}
```

And so, the reference to `a` in `b = a` is actually the reference to the local variable `a`
(which shadows the global variable `a` inside the definition of `f`),
and so calling `f` will return `undefined`.

## Frame descriptors and slots

We mentioned above that local variables are stored in the `VirtualFrame` object,
but not in the same place as the function's arguments.
If not there, then where?

They are stored in something called _auxiliary slots_;
basically a map,
whose keys are instances of the `FrameSlot` class,
and the values are the current values of the local variables.
You create instances of the `FrameSlot`
class by using another class, `FrameDescriptor`.

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

A `FrameDescriptor` is created by invoking its constructor directly,
without any arguments.
You can create and retrieve `FrameSlot`s from it by invoking methods on the created `FrameDescriptor` instance.
Now, the important thing to know is that while retrieving and storing values inside the `VirtualFrame`
with `FrameSlot`s is a fast operation that gets JIT-compiled into efficient machine code,
actually creating and finding the slots in the descriptor is slow code that never gets JIT compiled.
For those reasons, it's important to create the slots before the execution starts,
during static analysis.

Once the `FrameSlot`s have been created from a `FrameDescriptor` instance,
that instance is passed to the `RootNode` Truffle class.
When the `CallTarget` that wraps that `RootNode` is invoked,
it will create a `VirtualFrame` instance with the appropriate number of slots
(and of the correct types, if we've provided that information to the slots),
using the information it got from the root node's `FrameDescriptor` instance.

## Simplifications

To make this already long article somewhat manageable in size,
we'll make two simplifications in this part,
which we will eliminate later in the series:

1. We won't implement a `return` statement yet --
  the function will return the result of evaluating the last statement of its body.
  Since this is the same behavior as for the entire program,
  this will allow us to re-use that one class to implement both.
  We will add this statement when we handle control flow in the next article of the series.
2. We will not allow nested functions
  (that is, functions defined inside another function).
  Their presence complicates the implementation quite a bit;
  for an example, taking a look at this code:

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
    argument passed to `makeAdder` survives after the invocation of `makeAdder`
    finishes -- it gets "captured" in the `adder` function returned by `makeAdder`.
    This sort of function is called a **closure**,
    and we will devote an entire article to implementing them later in the series.

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
public final class EasyScriptTruffleParser {
    public static List<EasyScriptStmtNode> parse(Reader program) throws IOException {
        var lexer = new EasyScriptLexer(new ANTLRInputStream(program));
        // remove the default console error listener
        lexer.removeErrorListeners();
        var parser = new EasyScriptParser(new CommonTokenStream(lexer));
        // remove the default console error listener
        parser.removeErrorListeners();
        // throw an exception when a parsing error is encountered
        parser.setErrorHandler(new BailErrorStrategy());
        return new EasyScriptTruffleParser().parseStmtsList(parser.start().stmt());
    }

    private final Map<String, Object> functionLocals;
    private FrameDescriptor frameDescriptor;

    private EasyScriptTruffleParser() {
        this.functionLocals = new HashMap<>();
    }
```

We store the local variables in the `functionLocals` field.
The keys are the variable names;
the values, for function arguments, are the integer index of the argument
(the first one gets `0`, the second one `1`, etc.),
and for local variables, the `FrameSlot`
created using the frame descriptor stored in the `frameDescriptor` field.

### Hoisting edge cases

Parsing statements will have to take hoisting into account.

Note that, while we implemented hoisting in article for global variables,
we made a shortcut.
We only hoisted `var` declarations, leaving `const` and `let` where they are.
However, that's not strictly correct; according to the JS standards,
`const` and `let` are hoisted too,
just initialized in such a way that throws an exception if they are read before being initialized.
In a language with only variable declarations,
where the control flow always goes linearly from top to bottom,
that's equivalent to not hoisting them at all,
and that's why we made that simplification;
however, once functions come into play, things get more complicated.
For example, look at this code:

```js
let v = f();
function f() {
    return v;
}
```

Suddenly, it *is* possible to access the variables before they are initialized,
so we need to correctly implement hoisting for all variable declarations,
not just `var`.

### Parsing a block of statements -- first loop

To correctly handle variable hoisting,
we need to iterate through all statements in a block
(which can be either the entire program,
or the body of a function) twice.

In the first loop, we only handle function declarations,
and gather the variable bindings,
ignoring their initializer expressions:

```java
    private List<EasyScriptStmtNode> parseStmtsList(List<EasyScriptParser.StmtContext> stmts) {
        var funcDecls = new ArrayList<FuncDeclStmtNode>();
        var varDecls = new ArrayList<EasyScriptStmtNode>();
        for (EasyScriptParser.StmtContext stmt : stmts) {
            if (stmt instanceof EasyScriptParser.FuncDeclStmtContext) {
                funcDecls.add(this.parseFuncDeclStmt((EasyScriptParser.FuncDeclStmtContext) stmt));
            } else if (stmt instanceof EasyScriptParser.VarDeclStmtContext) {
                EasyScriptParser.VarDeclStmtContext varDeclStmt = (EasyScriptParser.VarDeclStmtContext) stmt;
                List<EasyScriptParser.BindingContext> varDeclBindings = varDeclStmt.binding();
                DeclarationKind declarationKind = DeclarationKind.fromToken(varDeclStmt.kind.getText());
                for (EasyScriptParser.BindingContext varBinding : varDeclBindings) {
                    String variableId = varBinding.ID().getText();
                    if (this.frameDescriptor == null) {
                        varDecls.add(new GlobalVarDeclStmtNode(variableId, declarationKind));
                    } else {
                        FrameSlot frameSlot;
                        try {
                            frameSlot = this.frameDescriptor.addFrameSlot(variableId, declarationKind, FrameSlotKind.Object);
                        } catch (IllegalArgumentException e) {
                            throw new EasyScriptException("Identifier '" + variableId + "' has already been declared");
                        }
                        if (this.functionLocals.put(variableId, frameSlot) != null) {
                            throw new EasyScriptException("Identifier '" + variableId + "' has already been declared");
                        }
                        varDecls.add(new LocalVarDeclStmtNode(frameSlot, declarationKind));
                    }
                }
            }
        }
```

Here, we can see the `FrameSlot` being created from the `FrameDescriptor`
when we encounter a variable declaration inside a function definition
(we have to handle errors with duplicate variables too).

We store the kind of the declaration (`var`, `const` or `let`)
in the slot when creating it --
the slot has an `info` field, of type `Object`, that allows storing extra information within it --
because we need to make sure we disallow re-assigning local `const` variables.
We also save the name of the local variable in the `functionsLocals` map,
which we will use below to determine whether a given reference is to a local,
or global, variable.

#### Local variable declaration

`LocalVarDeclStmtNode` looks as follows:

```java
public final class LocalVarDeclStmtNode extends EasyScriptStmtNode {
    public static final Object DUMMY = new Object();

    private final FrameSlot frameSlot;

    public LocalVarDeclStmtNode(FrameSlot frameSlot) {
        this.frameSlot = frameSlot;
    }

    @Override
    public Object executeStatement(VirtualFrame frame) {
        frame.setObject(this.frameSlot, this.frameSlot.getInfo() == DeclarationKind.VAR
            ? Undefined.INSTANCE : DUMMY);
        return Undefined.INSTANCE;
    }
}
```

The initial value for local variables is saved in the `VirtualFrame` object under the correct  `frameSlot`.
The value is `undefined` for `var` variables,
and a magical "dummy" value for `const` and `let`
variables that will be treated specially by the expression Node for reading local variables
(it will cause an error to be thrown),
which we will see below.

#### Global variable declaration

The implementation of `GlobalVarDeclStmtNode` is interesting.
We need a reference from it to the current Truffle language context,
to create a new variable in the global scope.
In the previous parts of the series,
we got that reference using the `@CachedContext` annotation.
But that annotation can only be placed on specialization methods,
and we don't have a child expression anymore in this version of `GlobalVarDeclStmtNode` --
because of hoisting, we discard the initializer from the declaration.

Fortunately, there's also a different way to get a reference to the current context without having to use specializations.
It can be accomplished using the `ContextReference` class.
That class has a `get()` method that returns the context for the given Node.
To make it easier to access, it's common to store the `ContextReference`
instance in a `static` field of the context class,
and add a `static` method that uses it:

```java
public final class EasyScriptLanguageContext {
    private static final TruffleLanguage.ContextReference<EasyScriptLanguageContext> REF =
            TruffleLanguage.ContextReference.create(EasyScriptTruffleLanguage.class);

    public static EasyScriptLanguageContext get(Node node) {
        return REF.get(node);
    }

    public final GlobalScopeObject globalScopeObject = new GlobalScopeObject();
}
```

Once we have that, we can create a helper method in the base class that all of our Nodes inherit from:

```java
public abstract class EasyScriptNode extends Node {
    protected final EasyScriptLanguageContext currentLanguageContext() {
        return EasyScriptLanguageContext.get(this);
    }
}
```

This way, we can simply call `currentLanguageContext()` in our `GlobalVarDeclStmtNode` to get access to the global scope:

```java
public final class GlobalVarDeclStmtNode extends EasyScriptStmtNode {
    private final String variableId;
    private final DeclarationKind declarationKind;

    public GlobalVarDeclStmtNode(String variableId, DeclarationKind declarationKind) {
        this.variableId = variableId;
        this.declarationKind = declarationKind;
    }

    @Override
    public Object executeStatement(VirtualFrame frame) {
        EasyScriptLanguageContext context = this.currentLanguageContext();
        if (!context.globalScopeObject.newVariable(this.variableId, this.declarationKind)) {
            throw new EasyScriptException(this, "Identifier '" + this.variableId + "' has already been declared");
        }
        return Undefined.INSTANCE;
    }
}
```

`GlobalScopeObject` is very similar to what it was in the previous parts of the series,
the only difference is that it needs to initialize `const` and `let`
variables with a special value,
similarly to what happens in `LocalVarDeclStmtNode`:

```java
@ExportLibrary(InteropLibrary.class)
public final class GlobalScopeObject implements TruffleObject {
    private static final Object DUMMY = new Object();

    private final Map<String, Object> variables = new HashMap<>();
    private final Set<String> constants = new HashSet<>();

    public boolean newVariable(String name, DeclarationKind declarationKind) {
        Object existingValue = this.variables.put(name, declarationKind == DeclarationKind.VAR
                ? Undefined.INSTANCE : DUMMY);
        if (declarationKind == DeclarationKind.CONST) {
            this.constants.add(name);
        }
        return existingValue == null;
    }

    public boolean updateVariable(String name, Object value) {
        Object existingValue = this.variables.put(name, value);
        if (existingValue == DUMMY) {
            // the first assignment to a constant is fine
            return true;
        }
        if (this.constants.contains(name)) {
            throw new EasyScriptException("Assignment to constant variable '" + name + "'");
        }
        return existingValue != null;
    }
```

As you can see, when writing to a global variable,
we check whether its previous value was the dummy --
if so, we allow it even for `const` variables,
which normally shouldn't be re-assigned
(but if their previous value was the dummy,
we know this is the first assignment that is the result of splitting the `const` declaration to implement hoisting).

### Parsing a block of statements -- second loop

Finally, we can get back to our parser.
In the second loop through all of the statements in a given block,
we gather all expression statements,
and turn every variable declaration we encounter into an assignment expression:

```java
        var exprStmts = new ArrayList<ExprStmtNode>();
        for (EasyScriptParser.StmtContext stmt : stmts) {
            if (stmt instanceof EasyScriptParser.ExprStmtContext) {
                exprStmts.add(this.parseExprStmt((EasyScriptParser.ExprStmtContext) stmt));
            } else if (stmt instanceof EasyScriptParser.VarDeclStmtContext) {
                EasyScriptParser.VarDeclStmtContext varDeclStmt = (EasyScriptParser.VarDeclStmtContext) stmt;
                List<EasyScriptParser.BindingContext> varDeclBindings = varDeclStmt.binding();
                DeclarationKind declarationKind = DeclarationKind.fromToken(varDeclStmt.kind.getText());
                for (EasyScriptParser.BindingContext varBinding : varDeclBindings) {
                    String variableId = varBinding.ID().getText();
                    var bindingExpr = varBinding.expr1();
                    EasyScriptExprNode initializerExpr;
                    if (bindingExpr == null) {
                        if (declarationKind == DeclarationKind.CONST) {
                            throw new EasyScriptException("Missing initializer in const declaration '" + variableId + "'");
                        }
                        initializerExpr = new UndefinedLiteralExprNode();
                    } else {
                        initializerExpr = this.parseExpr1(bindingExpr);
                    }
                    EasyScriptExprNode assignmentExpr = this.frameDescriptor == null
                            ? GlobalVarAssignmentExprNodeGen.create(initializerExpr, variableId)
                            :  LocalVarAssignmentExprNodeGen.create(initializerExpr,
                                    this.frameDescriptor.findFrameSlot(variableId));
                    exprStmts.add(new ExprStmtNode(assignmentExpr, /* discardExpressionValue */ true));
                }
            }
        }
```

Depending on whether we're parsing the program itself,
or a function definition,
the assignment is either to a global variable represented by `GlobalVarAssignmentExprNode`
(which is unchanged from when it was introduced in a previous part of the series),
or to a local variable:

```java
@NodeChild("initializerExpr")
@NodeField(name = "frameSlot", type = FrameSlot.class)
public abstract class LocalVarAssignmentExprNode extends EasyScriptExprNode {
    protected abstract FrameSlot getFrameSlot();

    @Specialization
    protected int intAssignment(VirtualFrame frame, int value) {
        FrameSlot frameSlot = this.getFrameSlot();
        frame.getFrameDescriptor().setFrameSlotKind(frameSlot, FrameSlotKind.Int);
        frame.setInt(frameSlot, value);
        return value;
    }

    @Specialization(replaces = "intAssignment")
    protected double doubleAssignment(VirtualFrame frame, double value) {
        FrameSlot frameSlot = this.getFrameSlot();
        frame.getFrameDescriptor().setFrameSlotKind(frameSlot, FrameSlotKind.Double);
        frame.setDouble(frameSlot, value);
        return value;
    }

    @Fallback
    protected Object objectAssignment(VirtualFrame frame, Object value) {
        FrameSlot frameSlot = this.getFrameSlot();
        frame.getFrameDescriptor().setFrameSlotKind(frameSlot, FrameSlotKind.Object);
        frame.setObject(frameSlot, value);
        return value;
    }
}
```

We use specializations if the local variables happen to have an `int` or `double` type.
We note the type in the frame descriptor before we save the value in the frame --
we will use that information in the Node for reading a local variable, below.

Finally, we return a list of statement Nodes that is the result of parsing a statement block:

```java
        var result = new ArrayList<EasyScriptStmtNode>(funcDecls.size() + varDecls.size() + exprStmts.size());
        result.addAll(funcDecls);
        result.addAll(varDecls);
        result.addAll(exprStmts);
        return result;
    }
```
    
As you can see, we change the order, to correctly implement hoisting:
first are the function declarations
(it's legal in JavaScript to call a function before it was declared),
then the variable declarations (without initializers),
and then finally all of the remaining statements,
including the assignments from the variable declarations.

### Parsing a function declaration

```java
    private FuncDeclStmtNode parseFuncDeclStmt(EasyScriptParser.FuncDeclStmtContext funcDeclStmt) {
        if (this.frameDescriptor != null) {
            throw new EasyScriptException("nested functions are not supported in EasyScript yet");
        }
        List<TerminalNode> funcArgs = funcDeclStmt.args.ID();
        int argumentCount = funcArgs.size();
        for (int i = 0; i < argumentCount; i++) {
            this.functionLocals.put(funcArgs.get(i).getText(), i);
        }
        this.frameDescriptor = new FrameDescriptor();
        List<EasyScriptStmtNode> funcStmts = this.parseStmtsList(funcDeclStmt.stmt());
        FrameDescriptor frameDescriptor = this.frameDescriptor;
        this.functionLocals.clear();
        this.frameDescriptor = null;
        return new FuncDeclStmtNode(funcDeclStmt.name.getText(),
                frameDescriptor, new BlockStmtNode(funcStmts), argumentCount);
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

Then, we create a new `FrameDescriptor` and save it in the `frameDescriptor` field.
That means, when we call `parseStmtsList()`,
we will now parse variable declarations as local variables,
instead of global ones.

Finally, we save the `frameDescriptor` field in a local variable,
reset our fields after parsing the body of the function
(by setting `frameDescriptor` to `null`,
and clearing the `functionLocals` map),
and return a Node that implements a function declaration.

`FuncDeclStmtNode` looks as follows:

```java
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
        var func = new FunctionObject(Truffle.getRuntime().createCallTarget(funcRootNode), this.argumentCount);
        var context = this.currentLanguageContext();
        context.globalScopeObject.newFunction(this.funcName, func);
        return Undefined.INSTANCE;
    }
}
```

We create a new `FunctionObject`,
the same class that we used for the built-in functions in the previous article.
Since we need a new a `CallTarget` for `FunctionObject`,
we have to create a new `RootNode`.
`StmtBlockRootNode` is very simple:

```java
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
we employ a similar trick to what we did for retrieving the context from a Node above,
just now with a `LanguageReference` instead of a `ContextReference`.

The `newFunction` method in `GlobalScopeObject` is extremely simple:

```java
@ExportLibrary(InteropLibrary.class)
public final class GlobalScopeObject implements TruffleObject {
    // ...

    public void newFunction(String name, FunctionObject func) {
        this.variables.put(name, func);
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
    private EasyScriptExprNode parseAssignmentExpr(EasyScriptParser.AssignmentExpr1Context assignmentExpr) {
        String variableId = assignmentExpr.ID().getText();
        Object paramIndexOrFrameSlot = this.functionLocals.get(variableId);
        EasyScriptExprNode initializerExpr = this.parseExpr1(assignmentExpr.expr1());
        if (paramIndexOrFrameSlot == null) {
            return GlobalVarAssignmentExprNodeGen.create(initializerExpr, variableId);
        } else {
            if (paramIndexOrFrameSlot instanceof Integer) {
                return new WriteFunctionArgExprNode((Integer) paramIndexOrFrameSlot, initializerExpr);
            } else {
                FrameSlot frameSlot = (FrameSlot) paramIndexOrFrameSlot;
                if (frameSlot.getInfo() == DeclarationKind.CONST) {
                    throw new EasyScriptException("Assignment to constant variable '" + variableId + "'");
                }
                return LocalVarAssignmentExprNodeGen.create(initializerExpr, frameSlot);
            }
        }
    }
```

If the assignment is to a global or local variable,
we use the `GlobalVarAssignmentExprNode`
and `LocalVarAssignmentExprNode` classes that we've seen above,
respectively.
But if the assignment is to a function argument,
we use the `WriteFunctionArgExprNode` class:

```java
public final class WriteFunctionArgExprNode extends EasyScriptExprNode {
    private final int index;

    @SuppressWarnings("FieldMayBeFinal")
    @Child
    private EasyScriptExprNode initializerExpr;

    public WriteFunctionArgExprNode(int index, EasyScriptExprNode initializerExpr) {
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

To handle this case, we need to modify the `FunctionDispatchNode`
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
    private EasyScriptExprNode parseReference(String variableId) {
        Object paramIndexOrFrameSlot = this.functionLocals.get(variableId);
        if (paramIndexOrFrameSlot == null) {
            return GlobalVarReferenceExprNodeGen.create(variableId);
        } else {
            return paramIndexOrFrameSlot instanceof Integer
                    ? new ReadFunctionArgExprNode((Integer) paramIndexOrFrameSlot)
                    : LocalVarReferenceExprNodeGen.create((FrameSlot) paramIndexOrFrameSlot);
        }
    }
```

This is where we use the information about the frame slot we saved in `LocalVarDeclStmtNode`:

```java
@NodeField(name = "frameSlot", type = FrameSlot.class)
public abstract class LocalVarReferenceExprNode extends EasyScriptExprNode {
    protected abstract FrameSlot getFrameSlot();

    @Specialization(guards = "frame.isInt(getFrameSlot())")
    protected int readInt(VirtualFrame frame) {
        return FrameUtil.getIntSafe(frame, this.getFrameSlot());
    }

    @Specialization(guards = "frame.isDouble(getFrameSlot())", replaces = "readInt")
    protected double readDouble(VirtualFrame frame) {
        return FrameUtil.getDoubleSafe(frame, this.getFrameSlot());
    }

    @Fallback
    protected Object readObject(VirtualFrame frame) {
        Object ret = FrameUtil.getObjectSafe(frame, this.getFrameSlot());
        if (ret == LocalVarDeclStmtNode.DUMMY) {
            throw new EasyScriptException("Cannot access '" + this.getFrameSlot().getIdentifier() + "' before initialization");
        }
        return ret;
    }
}
```

We use the `FrameUtil` class that is built into the framework that allows retrieving the value of the given type from the frame.
We also make sure the value is not the magical one that `const` and `let`
variables are initialized with in `LocalVarDeclStmtNode`,
and if it is, we throw an exception.

## Summary

So, this is how to implement user-defined functions in Truffle.
As you can see, most of the complexity in the implementations comes from the static analysis needed to determine whether a given reference is to a local,
or global, variable.
The code in the Nodes themselves is relatively straightforward,
and doesn't really use many features we haven't seen before --
the new elements in this part are mainly the APIs related to storing different values in the `VirtualFrame` instance.

As usual, all of the code in the article
[is available on GitHub](https://github.com/skinny85/graalvm-truffle-tutorial/tree/master/part-07).

In the [next part](/graal-truffle-tutorial-part-8-conditionals-loops-control-flow)
of the series,
we will add loops and control flow to our language.
