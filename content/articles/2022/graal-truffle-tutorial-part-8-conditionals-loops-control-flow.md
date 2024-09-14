---
id: 64
layout: truffle-tutorial.html
title: Graal Truffle tutorial part 8 – conditionals, loops, control flow
summary: |
   In the eight part of the Truffle tutorial,
   we implement comparison operators, "if" statements,
   loops, and "return", "break" and "continue" statements.
created_at: 2022-06-30
---

In the
[previous article](/graal-truffle-tutorial-part-7-function-definitions)
of the series,
we allowed EasyScript programmers to define their own functions.
However, the language did not offer many features for them to use in those functions.
We allowed local variable declarations,
adding numbers, calling other functions -- and that's pretty much it.

In this part, we will change all that,
and finally make EasyScript
[Turing complete](https://en.wikipedia.org/wiki/Turing_completeness).
We will implement the `if` JavaScript statement that allows executing different code based on some condition,
and also constructs like `while` and `for` which enable executing the same block of code in a loop.
To enable that, we will have to add boolean expression like "equals" and "less than"
to our Truffle language.
Finally, we will also add support for `return`, `break` and `continue` statements.

Our goal is to interpret the following JavaScript program:

```js
function fib(n) {
    if (n < 2)
        return n;

    var a = 0, b = 1;
    for (let i = 2; i <= n; i = i + 1) {
        const f = a + b;
        a = b;
        b = f;
    }
    return b;
}
fib(7);
```

This is the iterative version of calculating the
[Fibonacci sequence](https://en.wikipedia.org/wiki/Fibonacci_number),
so executing this program should return `13`.

## Grammar

Our language's grammar will require a lot of changes.

First of all, we need to introduce no fewer than eight new statement types:

```shell-session
stmt :         kind=('var' | 'let' | 'const') binding (',' binding)* ';'? #VarDeclStmt
     |                                                         expr1 ';'? #ExprStmt
     |       'function' name=ID '(' args=func_args ')' '{' stmt* '}' ';'? #FuncDeclStmt
     |                                               'return' expr1? ';'? #ReturnStmt   // new
     |                                                 '{' stmt* '}' ';'? #BlockStmt    // new
     |    'if' '(' cond=expr1 ')' then_stmt=stmt ('else' else_stmt=stmt)? #IfStmt       // new
     |                               'while' '(' cond=expr1 ')' body=stmt #WhileStmt    // new
     |                 'do' '{' stmt* '}' 'while' '(' cond=expr1 ')' ';'? #DoWhileStmt  // new
     | 'for' '(' init=stmt? ';' cond=expr1? ';' updt=expr1? ')' body=stmt #ForStmt      // new
     |                                                       'break' ';'? #BreakStmt    // new
     |                                                    'continue' ';'? #ContinueStmt // new
     ;
```

We also need new comparison operations, and to parse them correctly,
we need to introduce two more precedence levels to our expression grammar:

```shell-session
expr1 : ID '=' expr1                                       #AssignmentExpr1
      | expr2                                              #PrecedenceTwoExpr1
      ;
expr2 : left=expr2 c=('===' | '!==') right=expr3           #EqNotEqExpr2         // new
      | expr3                                              #PrecedenceThreeExpr2
      ;
expr3 : left=expr3 c=('<' | '<=' | '>' | '>=') right=expr4 #ComparisonExpr3      // new
      | expr4                                              #PrecedenceFourExpr3
      ;
expr4 : left=expr4 '+' right=expr5                         #AddExpr4
      | '-' expr5                                          #UnaryMinusExpr4
      | expr5                                              #PrecedenceFiveExpr4
      ;
expr5 : literal                                            #LiteralExpr5
      | ID                                                 #SimpleReferenceExpr5
      | ID '.' ID                                          #ComplexReferenceExpr5
      | expr5 '(' (expr1 (',' expr1)*)? ')'                #CallExpr5
      | '(' expr1 ')'                                      #PrecedenceOneExpr5
      ;
```

So, the lowest precedence are the equality and inequality operators
(so that `a < b === c > d` is parsed as `(a < b) === (c > d)`),
and then the arithmetic comparison operators
(so that `a + b >= c + d` is parsed as `(a + b) >= (c + d)`).

**Note**: JavaScript has two types of (in)equality, `==` / `!=` and `===` / `!==`,
but those former ones have some
[pretty crazy behavior](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Equality_comparisons_and_sameness#loose_equality_using),
so we'll only implement the latter two.

## Parsing

In a common theme with the last few parts of the series,
our parsing logic will again have to become more complex to implement these new capabilities.

The first challenge is that it's now possible for local variables to also appear on the top level,
not only in function definitions
(for example, imagine a loop like `for (let i = 0; i < n; i = i + 1)` on the top level).
In order to handle that, we will now have a `FrameDescriptor`
saved in a field of our parser class always,
not only when parsing a function definition,
and we'll create new `FrameSlot`s in this top-level `FrameDescriptor`.
We will also have to return that `FrameDescriptor` from our entrypoint `parse` static method,
along with the Node representing the block of statements,
which means we need a new class to represent the results of parsing:

```java
import com.oracle.truffle.api.frame.FrameDescriptor;
import org.antlr.v4.runtime.BailErrorStrategy;
import org.antlr.v4.runtime.CharStreams;
import org.antlr.v4.runtime.CommonTokenStream;

public final class ParsingResult {
    public final BlockStmtNode programStmtBlock;
    public final FrameDescriptor topLevelFrameDescriptor;

    public ParsingResult(BlockStmtNode programStmtBlock, FrameDescriptor topLevelFrameDescriptor) {
        this.programStmtBlock = programStmtBlock;
        this.topLevelFrameDescriptor = topLevelFrameDescriptor;
    }
}

public final class EasyScriptTruffleParser {
    public static ParsingResult parse(Reader program) throws IOException {
        var lexer = new EasyScriptLexer(CharStreams.fromReader(program));
        lexer.removeErrorListeners();
        var parser = new EasyScriptParser(new CommonTokenStream(lexer));
        parser.removeErrorListeners();
        parser.setErrorHandler(new BailErrorStrategy());

        var easyScriptTruffleParser = new EasyScriptTruffleParser();
        List<EasyScriptStmtNode> stmts = easyScriptTruffleParser.parseStmtsList(parser.start().stmt());
        return new ParsingResult(
                new BlockStmtNode(stmts),
                easyScriptTruffleParser.frameDescriptor.build());
    }

    // ...
}
```

The second challenge is that we can now have arbitrary scopes nested in each other,
in code such as:

```js
for (let i = 1; i <= n; i = i + 1) {
    // first scope
    if (i === n) {
        // second scope
        let i; // shadows the i from the upper scope
    } else {
        // third scope
    }
}
```

And each of these nested scopes can contain variables that are visible only in that scope.
What is more, those variables can have the same name as variables from an outer scope,
which means we can't just use the variable name as the identifier of the `FrameSlot`
(as these need to be unique in a given `Frame`).

All of this means our state will have to become much more complicated.
Previously, the state was just a `FrameDescriptor.Builder`,
which was not `null` only if we were parsing a function definition,
and a `Map<String, FrameMember>` that stored all arguments and local variables of a function.
But now, we need four fields to represent the state:

```java
import com.oracle.truffle.api.frame.FrameDescriptor;

public final class EasyScriptTruffleParser {
    // ...

    private enum ParserState { TOP_LEVEL, NESTED_SCOPE_IN_TOP_LEVEL, FUNC_DEF }
    private ParserState state;

    private FrameDescriptor.Builder frameDescriptor;
    private Stack<Map<String, FrameMember>> localScopes;
    private int localVariablesCounter;

    private EasyScriptTruffleParser() {
        this.state = ParserState.TOP_LEVEL;
        this.frameDescriptor = FrameDescriptor.newBuilder();
        this.localScopes = new Stack<>();
        this.localVariablesCounter = 0;
    }
    
    // ...
}
```

We can't rely anymore on the `frameDescriptor` field to distinguish whether we're parsing the global scope,
or a function definition, so we introduce an enum for that purpose.
Instead of a simple flat map for the local variables,
we now have a stack of maps.
Every time we enter a new scope, we push a new map onto the stack;
every time we leave a scope, we pop the last map off.

To find either a local variable, or a function argument, in that stack of maps,
we can't simply search the top-most one;
we have to search all of them, starting from the top one:

```java
public final class EasyScriptTruffleParser {
    // ...

    private FrameMember findFrameMember(String memberName) {
        for (var scope : this.localScopes) {
            FrameMember ret = scope.get(memberName);
            if (ret != null) {
                return ret;
            }
        }
        return null;
    }
}
```

Finally, we maintain an integer counter of the local variables,
and we increment it for every variable we encounter.
Using this counter, we can guarantee that we'll generate a unique frame slot
identifier for every variable
(we'll form the identifier by combining the variable name and the unique counter value,
instead of just the counter value --
even though it's guaranteed to be unique --
for easier debugging).

### Parsing a statement block

```java
public final class EasyScriptTruffleParser {
    // ...

    private BlockStmtNode parseStmtBlock(EasyScriptParser.BlockStmtContext blockStmt) {
        return parseStmtBlock(blockStmt.stmt());
    }

    private BlockStmtNode parseStmtBlock(List<EasyScriptParser.StmtContext> stmts) {
        ParserState previousParserState = this.state;

        if (this.state == ParserState.TOP_LEVEL) {
            this.state = ParserState.NESTED_SCOPE_IN_TOP_LEVEL;
        }
        this.localScopes.push(new HashMap<>());

        List<EasyScriptStmtNode> ret = this.parseStmtsList(stmts);

        this.state = previousParserState;
        this.localScopes.pop();

        return new BlockStmtNode(ret);
    }
}
```

To parse a block of statements between curly braces,
we first save the previous state,
then enter the `NESTED_SCOPE_IN_TOP_LEVEL` state if this is a block on the top level
(because we have to now treat variable declarations as local instead of global),
and push a new map of variables onto the stack of scopes.
We then call our main parsing method, `parseStmtsList()`, recursively,
and finally return a `BlockStmtNode`,
which is unchanged from the
[last article](/graal-truffle-tutorial-part-7-function-definitions#parsing-a-function-declaration).

### Parsing `for` loops

Parsing a `for` loop is very similar to parsing a statement block,
because `for` also introduces a new scope
(in code like `for (let a = 0; ...`,
the `a` variable is only visible inside the loop statement):

```java
public final class EasyScriptTruffleParser {
    // ...

    private ForStmtNode parseForStmt(EasyScriptParser.ForStmtContext forStmt) {
        ParserState previousParserState = this.state;

        if (this.state == ParserState.TOP_LEVEL) {
            this.state = ParserState.NESTED_SCOPE_IN_TOP_LEVEL;
        }
        this.localScopes.push(new HashMap<>());

        var ret = new ForStmtNode(
                this.parseStmt(forStmt.init),
                this.parseExpr1(forStmt.cond),
                this.parseExpr1(forStmt.updt),
                this.parseStmt(forStmt.body));

        this.state = previousParserState;
        this.localScopes.pop();

        return ret;
    }
}
```

## Adding booleans to the language

To enable comparison operators,
we need to add support for boolean expressions to EasyScript.

We start by adding `boolean` to the `TypeSystem` class we've been using since
[part 3](/graal-truffle-tutorial-part-3-specializations-with-truffle-dsl-typesystem#the-typesystem-class):

```java
import com.oracle.truffle.api.dsl.ImplicitCast;
import com.oracle.truffle.api.dsl.TypeSystem;

@TypeSystem({
        boolean.class,
        int.class,
        double.class,
})
public abstract class EasyScriptTypeSystem {
    @ImplicitCast
    public static double castIntToDouble(int value) {
        return value;
    }
}
```

And then we need a new `execute*()` method in our superclass of all expressions:

```java
import com.oracle.truffle.api.dsl.TypeSystemReference;
import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.nodes.UnexpectedResultException;

@TypeSystemReference(EasyScriptTypeSystem.class)
public abstract class EasyScriptExprNode extends EasyScriptNode {
    public abstract Object executeGeneric(VirtualFrame frame);

    public boolean executeBool(VirtualFrame frame) {
        Object value = this.executeGeneric(frame);
        // 'undefined' is falsy
        if (value == Undefined.INSTANCE) {
            return false;
        }
        if (value instanceof Boolean) {
            return (Boolean) value;
        }

        // a number is falsy when it's 0
        if (value instanceof Integer) {
            return (Integer) value != 0;
        }
        if (value instanceof Double) {
            return (Double) value != 0.0;
        }
        // all other values are truthy
        return true;
    }

    public int executeInt(VirtualFrame frame) throws UnexpectedResultException {
        return EasyScriptTypeSystemGen.expectInteger(this.executeGeneric(frame));
    }

    public double executeDouble(VirtualFrame frame) throws UnexpectedResultException {
        return EasyScriptTypeSystemGen.expectDouble(this.executeGeneric(frame));
    }
}
```

The interesting thing is that `executeBool()` doesn't throw `UnexpectedResultException`.
That's because, in JavaScript, every value can be interpreted as a boolean.
Like our default implementation shows, only `undefined`, `false`, and `0` are interpreted as `false`,
while all other values are `true`
(when we add support for strings to EasyScript, we'll have to update this code,
as an empty string is also `false` in JavaScript).

Of course, when we can implement `executeBool()` more efficiently,
we will override that default implementation --
for example, here's how we do it in the integer literal Node:

```java
import com.oracle.truffle.api.frame.VirtualFrame;

public final class IntLiteralExprNode extends EasyScriptExprNode {
    private final int value;

    public IntLiteralExprNode(int value) {
        this.value = value;
    }

    @Override
    public boolean executeBool(VirtualFrame frame) {
        return this.value != 0;
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

In addition, we'll have to take into account booleans in our local variable assignment with a specialization for handling them:

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
        int frameSlot = this.getFrameSlot();
        frame.getFrameDescriptor().setSlotKind(frameSlot, FrameSlotKind.Int);
        frame.setInt(frameSlot, value);
        return value;
    }

    @Specialization(replaces = "intAssignment",
            guards = "frame.getFrameDescriptor().getSlotKind(getFrameSlot()) == Illegal || " +
                    "frame.getFrameDescriptor().getSlotKind(getFrameSlot()) == Double")
    protected double doubleAssignment(VirtualFrame frame, double value) {
        int frameSlot = this.getFrameSlot();
        frame.getFrameDescriptor().setSlotKind(frameSlot, FrameSlotKind.Double);
        frame.setDouble(frameSlot, value);
        return value;
    }

    @Specialization(guards = "frame.getFrameDescriptor().getSlotKind(getFrameSlot()) == Illegal || " +
            "frame.getFrameDescriptor().getSlotKind(getFrameSlot()) == Boolean")
    protected boolean boolAssignment(VirtualFrame frame, boolean value) {
        int frameSlot = this.getFrameSlot();
        frame.getFrameDescriptor().setSlotKind(frameSlot, FrameSlotKind.Boolean);
        frame.setBoolean(frameSlot, value);
        return value;
    }

    @Specialization(replaces = {"intAssignment", "doubleAssignment", "boolAssignment"})
    protected Object objectAssignment(VirtualFrame frame, Object value) {
        int frameSlot = this.getFrameSlot();
        frame.getFrameDescriptor().setSlotKind(frameSlot, FrameSlotKind.Object);
        frame.setObject(frameSlot, value);
        return value;
    }
}
```

And similarly for referencing local variables in `LocalVarReferenceExprNode`.

**Note**: JavaScript has some weird edge cases where a boolean value can be used in a numeric context --
for example, `3 + true` evaluates to `4`.
I won't bother with these though,
as they just add complexity to the implementation,
while not really illustrating anything about Truffle that we haven't seen before.

## Comparison operators

Comparison operators are very straightforward to implement.
We start with a common superclass of binary operations that will save us repeating some annotations:

```java
import com.oracle.truffle.api.dsl.NodeChild;

@NodeChild("leftSide")
@NodeChild("rightSide")
public abstract class BinaryOperationExprNode extends EasyScriptExprNode {
}
```

Using it, equality (`===`) looks as follows:

```java
import com.oracle.truffle.api.dsl.Fallback;
import com.oracle.truffle.api.dsl.Specialization;

public abstract class EqualityExprNode extends BinaryOperationExprNode {
    @Specialization
    protected boolean intEquality(int leftValue, int rightValue) {
        return leftValue == rightValue;
    }

    @Specialization(replaces = "intEquality")
    protected boolean doubleEquality(double leftValue, double rightValue) {
        return leftValue == rightValue;
    }

    @Specialization
    protected boolean boolEquality(boolean leftValue, boolean rightValue) {
        return leftValue == rightValue;
    }

    @Fallback
    protected boolean objectEquality(Object leftValue, Object rightValue) {
        return leftValue == rightValue;
    }
}
```

Greater than or equal (`>=`) is even simpler:

```java
import com.oracle.truffle.api.dsl.Fallback;
import com.oracle.truffle.api.dsl.Specialization;

public abstract class GreaterOrEqualExprNode extends BinaryOperationExprNode {
    @Specialization
    protected boolean intGreaterOrEqual(int leftValue, int rightValue) {
        return leftValue >= rightValue;
    }

    @Specialization(replaces = "intGreaterOrEqual")
    protected boolean doubleGreaterOrEqual(double leftValue, double rightValue) {
        return leftValue >= rightValue;
    }

    @Fallback
    protected boolean objectGreaterOrEqual(Object leftValue, Object rightValue) {
        return false;
    }
}
```

Similarly like with addition,
we don't worry about edge cases like whether `true > false`,
or if `undefined >= undefined` --
we just return `false` in all those cases.

## `if` statement

The `if` statement is a fundamental part of any programming language --
the ability to execute different code based on some condition is crucial to expressing complex programs.
Despite its huge significance, the implementation of the statement is really simple:

```java
import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.profiles.ConditionProfile;

public final class IfStmtNode extends EasyScriptStmtNode {
    @Child private EasyScriptExprNode conditionExpr;
    @Child private EasyScriptStmtNode thenStmt;
    @Child private EasyScriptStmtNode elseStmt;
    private final ConditionProfile condition = ConditionProfile.createCountingProfile();

    public IfStmtNode(EasyScriptExprNode conditionExpr, EasyScriptStmtNode thenStmt,
            EasyScriptStmtNode elseStmt) {
        this.conditionExpr = conditionExpr;
        this.thenStmt = thenStmt;
        this.elseStmt = elseStmt;
    }

    @Override
    public Object executeStatement(VirtualFrame frame) {
        if (this.condition.profile(this.conditionExpr.executeBool(frame))) {
            return this.thenStmt.executeStatement(frame);
        } else {
            return this.elseStmt == null
                    ? Undefined.INSTANCE
                    : this.elseStmt.executeStatement(frame);
        }
    }
}
```

We check the condition, and, if it's satisfied,
we execute the "then" part;
if it's not, and an "else" part was provided,
we execute that.

The only new thing in the `if` implementation is the `ConditionProfile`.
It allows recording the behavior of conditions,
and potentially using that decision during partial evaluation.
For example, if Graal sees that a given condition was executed 100 times,
and it was `true` every time,
it might generate different code than if it was 50-50.

## Return statement

In the
[previous article](/graal-truffle-tutorial-part-7-function-definitions#simplifications)
of the series,
we took a small shortcut:
we made user-defined functions return the value of the last statement they executed.
But of course, that's not really how JavaScript functions work;
you need to use the `return` statement for a function,
otherwise it will always evaluate to `undefined`.
In this part, we will fix that simplification.

The way operations like `return` are implemented in Truffle interpreters are exceptions.
When you think about it, that makes sense: a `return`
statement has to stop execution of an entire block of statements,
but it might appear deep into a stack of nested `execute*()` calls.
The simplest way to stop the execution of that entire call stack is with an exception.

When using an exception for control flow like that,
we have to signify that to Truffle by extending the `ControlFlowException` class:

```java
import com.oracle.truffle.api.nodes.ControlFlowException;

public final class ReturnException extends ControlFlowException {
    public final Object returnValue;

    public ReturnException(Object returnValue) {
        this.returnValue = returnValue;
    }
}
```

Then, the `return` statement itself is very simple:
we evaluate the expression we were given,
and throw that exception:

```java
import com.oracle.truffle.api.frame.VirtualFrame;

public final class ReturnStmtNode extends EasyScriptStmtNode {
    @Child
    private EasyScriptExprNode returnExpr;

    public ReturnStmtNode(EasyScriptExprNode returnExpr) {
        this.returnExpr = returnExpr;
    }

    @Override
    public Object executeStatement(VirtualFrame frame) {
        Object returnValue = this.returnExpr.executeGeneric(frame);
        throw new ReturnException(returnValue);
    }
}
```

That exception is then caught, and used as the return value,
in the class that represents the body of a user-defined function:

```java
import com.oracle.truffle.api.frame.VirtualFrame;

public final class UserFuncBodyStmtNode extends EasyScriptStmtNode {
    @Children
    private final EasyScriptStmtNode[] stmts;

    public UserFuncBodyStmtNode(List<EasyScriptStmtNode> stmts) {
        this.stmts = stmts.toArray(new EasyScriptStmtNode[]{});
    }

    @Override
    @ExplodeLoop
    public Object executeStatement(VirtualFrame frame) {
        for (EasyScriptStmtNode stmt : this.stmts) {
            try {
                stmt.executeStatement(frame);
            } catch (ReturnException e) {
                return e.returnValue;
            }
        }
        return Undefined.INSTANCE;
    }
}
```

## `break` and `continue`

There are two other statements that are similar to `return` -- `break` and `continue`.
As a quick refresher, they both can only be used inside loops.
`break` means "stop the loop",
regardless of whether the loop condition is still `true`,
while `continue` says "stop the current iteration, and proceed to the next one" --
of course, only if the loop condition is still true.

They are also implemented with exceptions:

```java
import com.oracle.truffle.api.nodes.ControlFlowException;

public final class BreakException extends ControlFlowException {
}

public final class ContinueException extends ControlFlowException {
}
```

And the statement Nodes implementing them are probably the simplest we've seen so far:

```java
import com.oracle.truffle.api.frame.VirtualFrame;

public final class BreakStmtNode extends EasyScriptStmtNode {
    @Override
    public Object executeStatement(VirtualFrame frame) {
        throw new BreakException();
    }
}

public final class ContinueStmtNode extends EasyScriptStmtNode {
    @Override
    public Object executeStatement(VirtualFrame frame) {
        throw new ContinueException();
    }
}
```

We will catch these two exceptions when implementing the Nodes for loops.

## `while` and `do`-`while` loops

And with that, we are now ready to tackle our first types of loop statements.
Since loops are so common in many languages,
Truffle actually has a helper for implementing them,
called `LoopNode`.
Using it, you simply provide the implementation of an interface called `RepeatingNode`,
which has one abstract method where you execute one iteration of your loop,
and then return a `boolean` signifying whether the loop should continue for another iteration.
Truffle handles invoking your `RepatingNode` as many times as needed,
profiling the loop, and using `LoopNode` also means Graal knows this is a loop,
and can use some additional optimizations when compiling it,
like automatic loop unrolling.

So, our `while` Node looks as follows:

```java
import com.oracle.truffle.api.Truffle;
import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.nodes.LoopNode;
import com.oracle.truffle.api.nodes.Node;
import com.oracle.truffle.api.nodes.RepeatingNode;

public final class WhileStmtNode extends EasyScriptStmtNode {
    @Child private LoopNode loopNode;

    public WhileStmtNode(EasyScriptExprNode conditionExpr, EasyScriptStmtNode bodyStmt) {
        this.loopNode = Truffle.getRuntime().createLoopNode(
            new WhileRepeatingNode(conditionExpr, bodyStmt));
    }

    @Override
    public Object executeStatement(VirtualFrame frame) {
        this.loopNode.execute(frame);
        return Undefined.INSTANCE;
    }

    private static final class WhileRepeatingNode extends Node implements RepeatingNode {
        @Child private EasyScriptExprNode conditionExpr;
        @Child private EasyScriptStmtNode bodyStmt;

        public WhileRepeatingNode(EasyScriptExprNode conditionExpr, EasyScriptStmtNode bodyStmt) {
            this.conditionExpr = conditionExpr;
            this.bodyStmt = bodyStmt;
        }

        @Override
        public boolean executeRepeating(VirtualFrame frame) {
            if (!this.conditionExpr.executeBool(frame)) {
                return false;
            }
            try {
                this.bodyStmt.executeStatement(frame);
            } catch (BreakException e) {
                return false;
            } catch (ContinueException e) {
            }
            return true;
        }
    }
}
```

We first execute the condition expression, and, if it's `true`,
execute one iteration of the body of the loop.
We handle `BreakException` and `ContinueException`
by either terminating the loop, or continuing with the next iteration, respectively.

`do`-`while` is almost identical, the only difference is that we change the order:
we first execute the body of the loop, and only then check the condition:

```java
import com.oracle.truffle.api.Truffle;
import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.nodes.LoopNode;
import com.oracle.truffle.api.nodes.Node;
import com.oracle.truffle.api.nodes.RepeatingNode;

public final class DoWhileStmtNode extends EasyScriptStmtNode {
    @Child private LoopNode loopNode;

    public DoWhileStmtNode(EasyScriptExprNode conditionExpr, EasyScriptStmtNode bodyStmt) {
        this.loopNode = Truffle.getRuntime().createLoopNode(
            new DoWhileRepeatingNode(conditionExpr, bodyStmt));
    }

    @Override
    public Object executeStatement(VirtualFrame frame) {
        this.loopNode.execute(frame);
        return Undefined.INSTANCE;
    }

    private static final class DoWhileRepeatingNode extends Node implements RepeatingNode {
        @Child private EasyScriptExprNode conditionExpr;
        @Child private EasyScriptStmtNode bodyStmt;

        public DoWhileRepeatingNode(EasyScriptExprNode conditionExpr, EasyScriptStmtNode bodyStmt) {
            this.conditionExpr = conditionExpr;
            this.bodyStmt = bodyStmt;
        }

        @Override
        public boolean executeRepeating(VirtualFrame frame) {
            try {
                this.bodyStmt.executeStatement(frame);
            } catch (BreakException e) {
                return false;
            } catch (ContinueException e) {
            }
            return this.conditionExpr.executeBool(frame);
        }
    }
}
```

That makes its implementation even more straightforward than `while`.

## `for` loops

And finally, we come to the most complicated loop -- the `for`.
While it looks intimidating, the actual implementation is very similar to `while`,
just broken down into several steps:

1. Execute the initialization statement, if it was provided.
2. In the repeating Node:
    - Execute the condition, if provided, and terminate the loop if it's `false`.
    - Execute the body of the loop, handling `break` and `continue`.
    - Execute the update expression, if it was provided.

This is how that looks like in code:

```java
import com.oracle.truffle.api.Truffle;
import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.nodes.LoopNode;
import com.oracle.truffle.api.nodes.Node;
import com.oracle.truffle.api.nodes.RepeatingNode;

public final class ForStmtNode extends EasyScriptStmtNode {
    @Child private EasyScriptStmtNode initStmt;
    @Child private LoopNode loopNode;

    public ForStmtNode(EasyScriptStmtNode initStmt, EasyScriptExprNode conditionExpr,
            EasyScriptExprNode updateExpr, EasyScriptStmtNode bodyStmt) {
        this.initStmt = initStmt;
        this.loopNode = Truffle.getRuntime().createLoopNode(
                new ForRepeatingNode(conditionExpr, updateExpr, bodyStmt));
    }

    @Override
    public Object executeStatement(VirtualFrame frame) {
        if (this.initStmt != null) {
            this.initStmt.executeStatement(frame);
        }
        this.loopNode.execute(frame);
        return Undefined.INSTANCE;
    }

    private static final class ForRepeatingNode extends Node implements RepeatingNode {
        @Child private EasyScriptExprNode conditionExpr;
        @Child private EasyScriptExprNode updateExpr;
        @Child private EasyScriptStmtNode bodyStmt;

        public ForRepeatingNode(EasyScriptExprNode conditionExpr, EasyScriptExprNode updateExpr,
                EasyScriptStmtNode bodyStmt) {
            this.conditionExpr = conditionExpr;
            this.updateExpr = updateExpr;
            this.bodyStmt = bodyStmt;
        }

        @Override
        public boolean executeRepeating(VirtualFrame frame) {
            if (this.conditionExpr != null &&
                    !this.conditionExpr.executeBool(frame)) {
                return false;
            }
            try {
                this.bodyStmt.executeStatement(frame);
            } catch (BreakException e) {
                return false;
            } catch (ContinueException e) {
            }
            if (this.updateExpr != null) {
                this.updateExpr.executeGeneric(frame);
            }
            return true;
        }
    }
}
```

## Summary

Phew! We covered a lot of ground today,
but we made EasyScript much more powerful in the process.

As usual, all of the code from the article
[is available on GitHub](https://github.com/skinny85/graalvm-truffle-tutorial/tree/master/part-08).

In the next part of the series,
we will talk about benchmarking your language's implementation to measure how fast it is,
and diagnosing performance issues.
