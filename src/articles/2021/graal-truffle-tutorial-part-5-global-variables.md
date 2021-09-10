---
id: 58
layout: truffle-tutorial.html
title: Graal Truffle tutorial part 5 – global variables
summary: |
  In the fifth part of the Truffle tutorial,
  we add support for global variables to our EasyScript language.
created_at: 2021-06-30
---

At the end of [part 4](/graal-truffle-tutorial-part-4-parsing-and-the-trufflelanguage-class)
of the series,
a program in our EasyScript language consisted entirely of a single expression,
built from addition and numeric literals,
like `1 + 2 + 3.0`.
In this part of the series,
we will move one step closer towards making EasyScript a real language by adding support for variables.
This will require changing EasyScript programs from a single expression to a list of _statements_.

Our goal is to be able to execute the following JavaScript program:

```js
var a = 0;
let b = 1;
const c = 2.0;
a + b + c
```

Since we still don't have a way to print anything to the screen in our language,
as we don't have function calls yet,
we will say that executing a program like that returns the result of executing the last statement --
in the above case, that would be `3.0`.

Implementing variables will require quite a large amount of changes --
our grammar will need expanding,
we will learn about implementing values used in GraalVM polyglot bindings,
and add support for the JavaScript `undefined` concept to EasyScript.
Let's dive right in, because there's a lot to do!

## Grammar

Our language's grammar will need a few more elements --
most importantly, we will have to introduce the concept of 'statements' to it.
It will also need a new type of expression,
as assignment is an expression in JavaScript.

Our ANTLR grammar looks as follows:

```shell-session
grammar EasyScript ;

@header{
package com.endoflineblog.truffle.part_05;
}

start : stmt+ EOF ;

stmt : kind=('var' | 'let' | 'const') binding (',' binding)* ';'?     #DeclStmt
     |                                                 expr1 ';'?     #ExprStmt
     ;

binding : ID ('=' expr1)? ;

expr1 : ID '=' expr1               #AssignmentExpr1
      | expr2                      #PrecedenceTwoExpr1
      ;
expr2 : left=expr2 '+' right=expr3 #AddExpr2
      | expr3                      #PrecedenceThreeExpr2
      ;
expr3 : literal                    #LiteralExpr3
      | ID                         #ReferenceExpr3
      | '(' expr1 ')'              #PrecedenceOneExpr3
      ;

literal : INT | DOUBLE | 'undefined' ;

fragment DIGIT : [0-9] ;
INT : DIGIT+ ;
DOUBLE : DIGIT+ '.' DIGIT+ ;

fragment LETTER : [a-zA-Z$_] ;
ID : LETTER (LETTER | DIGIT)* ;

// skip all whitespace
WS : (' ' | '\r' | '\t' | '\n' | '\f')+ -> skip ;
```

A few notes about the grammar:

* The result of parsing will now be a list of statements.
  Lists are very easy to implement in ANTLR:
  you use `+` for non-empty lists,
  and `*` for potentially empty lists.
  You can use the `+` and `*` on non-terminals,
  terminals, or a combination of both,
  by grouping them in parenthesis.
* JavaScript allows declaring multiple variables in one statement
  (in code like `let a = 1, b = 2;`).
  For that reason, the declaration statement contains a list of bindings,
  instead of just a single one.
* To make sure an expression like `a = 1 + 1` is parsed as `a = (1 + 1)` and not `(a = 1) + 1`,
  we have to introduce expression precedence.
  Since addition binds stronger than assignment,
  we make assignment have precedence 1,
  and addition precedence 2.
  (We introduce a third precedence level to make sure addition is always parsed as left-associative --
  because of things like rounding errors,
  [addition of floating-point numbers is actually not associative](https://en.wikipedia.org/wiki/Associative_property#Nonassociativity_of_floating_point_calculation),
  unlike mathematical addition)
* JavaScript has very complicated rules regarding when are semicolons required --
  basically, they are optional if the statements starting on the subsequent line parse correctly,
  and required if they don't.
  Since implementing that is strictly a parsing issue
  (which, like
  [I mentioned before](/graal-truffle-tutorial-part-4-parsing-and-the-trufflelanguage-class),
  is not the focal point of this series),
  I've gone with a simplified version here,
  and made the semicolons optional at the end of statements.
  It's not exactly the same semantics as in JavaScript,
  but it gets us close enough.
* The initializer part of the declaration is optional in JavaScript for non-`const` variables --
  for example, it's legal to write `let a;`
  (not `const a;` though).
  That fact is reflected in our grammar.
  A variable without an initializer has the value `undefined`.

## Parsing

Similarly like we did in the
[previous article](/graal-truffle-tutorial-part-4-parsing-and-the-trufflelanguage-class),
we introduce a class that performs parsing by first invoking ANTLR,
and then translating the received parse tree to the Truffle AST nodes:

```java
public enum DeclarationKind {
    VAR, LET, CONST;

    public static DeclarationKind fromToken(String token) {
        switch (token) {
            case "var": return DeclarationKind.VAR;
            case "let": return DeclarationKind.LET;
            case "const": return DeclarationKind.CONST;
            default: throw new EasyScriptException("Unrecognized variable kind: '" + token + "'");
        }
    }
}

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
        return parseStmtList(parser.start().stmt());
    }

    private static List<EasyScriptStmtNode> parseStmtList(List<EasyScriptParser.StmtContext> stmts) {
        return stmts.stream()
                .flatMap(stmt -> stmt instanceof EasyScriptParser.ExprStmtContext
                        ? Stream.of(parseExprStmt((EasyScriptParser.ExprStmtContext) stmt))
                        : parseDeclStmt((EasyScriptParser.DeclStmtContext) stmt))
                .collect(Collectors.toList());
    }

    private static ExprStmtNode parseExprStmt(EasyScriptParser.ExprStmtContext exprStmt) {
        return new ExprStmtNode(parseExpr1(exprStmt.expr1()));
    }

    private static Stream<EasyScriptStmtNode> parseDeclStmt(EasyScriptParser.DeclStmtContext declStmt) {
        DeclarationKind declarationKind = DeclarationKind.fromToken(declStmt.kind.getText());
        return declStmt.binding()
                .stream()
                .map(binding -> {
                    String variableId = binding.ID().getText();
                    var bindingExpr = binding.expr1();
                    EasyScriptExprNode initializerExpr;
                    if (bindingExpr == null) {
                        if (declarationKind == DeclarationKind.CONST) {
                            throw new EasyScriptException("Missing initializer in const declaration '" + variableId + "'");
                        }
                        initializerExpr = new UndefinedLiteralExprNode();
                    } else {
                        initializerExpr = parseExpr1(bindingExpr);
                    }
                    return GlobalVarDeclStmtNodeGen.create(initializerExpr, variableId, declarationKind);
                });
    }

    private static EasyScriptExprNode parseExpr1(EasyScriptParser.Expr1Context expr1) {
        // the parts dealing with expressions omitted for brevity...
```

We introduce an enum that represents each kind of variable in JavaScript
(`var` / `let` / `const`).
When we encounter a variable declaration statement,
we return a `Stream` of Truffle AST Nodes,
to handle a single declaration containing multiple variables --
we transform code like `let a, b;` to the equivalent `let a; let b;`.
When a variable declaration does not have an initializer,
we create it with the `undefined` literal as the initializer
(except if it's a `const`,
in which case we error out).

## `TruffleLanguage`

Our implementation of `TruffleLanguage` will need to store the global variables somewhere.
The storage itself will be pretty simple --
we create a new class, `GlobalScopeObject`,
that saves the variables in a private `Map<String, Object>` field,
and exposes an API for creating, updating and reading the variables
(which corresponds to declarations, assignment expressions,
and reference expressions, respectively):

```java
public final class GlobalScopeObject {
    private final Map<String, Object> variables = new HashMap<>();
    private final Set<String> constants = new HashSet<>();

    public boolean newVariable(String name, Object value, boolean isConst) {
        Object existingValue = this.variables.putIfAbsent(name, value);
        if (isConst) {
            this.constants.add(name);
        }
        return existingValue == null;
    }

    public boolean updateVariable(String name, Object value) {
        if (this.constants.contains(name)) {
            throw new EasyScriptException("Assignment to constant variable '" + name + "'");
        }
        Object existingValue = this.variables.computeIfPresent(name, (k, v) -> value);
        return existingValue != null;
    }

    public Object getVariable(String name) {
        return this.variables.get(name);
    }
}
```

The interesting question is:
how do we surface this `GlobalScopeObject` instance to the AST Nodes that will read and write to it?

One way could be to store this `GlobalScopeObject` instance in the `TruffleLanguage` instance itself.
Another would be to use the `Context` type parameter of `TruffleLanguage`,
which we have not used up to this point,
leaving it as `Void`.
Because of how GraalVM language interoperability works
(which we discuss in detail below),
the latter option is preferable.
So, we introduce an `EasyScriptLanguageContext`
class that contains `GlobalScopeObject` as a `public` `final` field.
We return an instance of this class from the `createContext()`
method in our `TruffleLanguage` class:

```java
public final class EasyScriptLanguageContext {
    public final GlobalScopeObject globalScopeObject;

    public EasyScriptLanguageContext() {
        this.globalScopeObject = new GlobalScopeObject();
    }
}

@TruffleLanguage.Registration(id = "ezs", name = "EasyScript")
public final class EasyScriptTruffleLanguage extends
        TruffleLanguage<EasyScriptLanguageContext> {
    @Override
    protected CallTarget parse(ParsingRequest request) throws Exception {
        List<EasyScriptStmtNode> stmts = EasyScriptTruffleParser.parse(request.getSource().getReader());
        var rootNode = new EasyScriptRootNode(this, stmts);
        return Truffle.getRuntime().createCallTarget(rootNode);
    }

    @Override
    protected EasyScriptLanguageContext createContext(Env env) {
        return new EasyScriptLanguageContext();
    }
}
```

## Truffle AST Nodes

Let's now see how do the Truffle AST Nodes look for these variable operations.

### Code organization

Before we show the code of the actual Nodes,
a quick note about organizing the code of your language implementation.

We will need to introduce a new kind of Nodes representing Statements,
and also a few new types of expression Nodes.
While up to this point, we simply kept the Nodes in the same Java package as the rest of the classes in the language implementation,
this would become very messy with all of these new Node classes.

I would like to show you a way of organizing your language implementation code into Java packages that makes it very easy to tell where everything is,
and which is quickly becoming a standard in the Truffle world:

```shell-session
basepackage
     |--- TruffleLanguage class
     |--- parser class
     |--- TypeSystem class
     |--- ...
     |--- basepackage.runtime
               |--- Undefined class
               |--- other runtime classes...
     |--- basepackage.nodes
               |--- RootNode class
               |--- basepackage.nodes.exprs
                         |--- expression Node classes...
               |--- basepackage.nodes.stmts
                         |--- statement Node classes...
```

This layout keeps everything organized and easy to find,
and also scales nicely when you start supporting built-in functions
(which we will get to soon, I promise!).

### Statement Nodes

We will introduce a new abstract base class that all statements will extend:

```java
public abstract class EasyScriptStmtNode extends Node {
    public abstract Object executeStatement(VirtualFrame frame);
}
```

It only has a single `execute*()` method,
unlike the expression Nodes.
To make sure we don't confuse it with the `execute*()` methods from the expression Nodes,
we call it `executeStatement()`,
but, of course, the name can be anything you want
(as long as it starts with the word "execute").

The simplest kind of statement is the expression statement:

```java
public final class ExprStmtNode extends EasyScriptStmtNode {
    @SuppressWarnings("FieldMayBeFinal")
    @Child
    private EasyScriptExprNode expr;

    public ExprStmtNode(EasyScriptExprNode expr) {
        this.expr = expr;
    }

    @Override
    public Object executeStatement(VirtualFrame frame) {
        return this.expr.executeGeneric(frame);
    }
}
```

It simply returns the result of executing the expression it wraps.

The second kind of statement is the variable declaration statement:

```java
import com.oracle.truffle.api.dsl.CachedContext;
import com.oracle.truffle.api.dsl.NodeChild;
import com.oracle.truffle.api.dsl.NodeField;
import com.oracle.truffle.api.dsl.Specialization;

@NodeChild(value = "initializerExpr", type = EasyScriptExprNode.class)
@NodeField(name = "name", type = String.class)
@NodeField(name = "declarationKind", type = DeclarationKind.class)
public abstract class GlobalVarDeclStmtNode extends EasyScriptStmtNode {
    public abstract EasyScriptExprNode getInitializerExpr();
    public abstract String getName();
    public abstract DeclarationKind getDeclarationKind();

    @Specialization
    protected Object assignVariable(
            Object value,
            @CachedContext(EasyScriptTruffleLanguage.class) EasyScriptLanguageContext context) {
        String variableId = this.getName();
        boolean isConst = this.getDeclarationKind() == DeclarationKind.CONST;
        if (!context.globalScopeObject.newVariable(variableId, value, isConst)) {
            throw new EasyScriptException(this, "Identifier '" + variableId + "' has already been declared");
        }
        // we return 'undefined' for statements that declare variables
        return Undefined.INSTANCE;
    }
}
```

This class uses the Truffle DSL that we learned about in
[part 3](/graal-truffle-tutorial-part-3-specializations-with-truffle-dsl-typesystem),
but utilizes a few things we haven't seen before.

The first is the `@NodeField` annotation.
It's similar to `@NodeChild` --
it allows us to tell the DSL that the generated Node class should have a field with the given name and type.
The difference between `@NodeField` and `@NodeChild` is that `@NodeField`
does not result in the generated field being annotated with `@Child`,
and so it can be marked `final`.

The fields will be populated by getting their value from the generated `create()`
static factory method.
The parameters for `@NodeField`s will be added to the `create()` method after all of the `@NodeChild` parameters --
so, in our case, `create()` will have the signature:

```java
public final class GlobalVarDeclStmtNodeGen extends GlobalVarDeclStmtNode {
    public static GlobalVarDeclStmtNode create(
            EasyScriptExprNode initializerExpr,
            String name, DeclarationKind declarationKind) {
        // ...
```

To use the field in the abstract superclass of the generated class,
we declare an abstract getter for it,
like we do here with `getName()` and `getDeclarationKind()`.
The DSL will implement these methods in the generated subclass.
In fact, the same 'getter' trick works for `@NodeChild` fields as well,
like we do here with `getInitializerExpr()`.

(We could have made the getters `protected` if we wanted to,
but we will call these from the `RootNode` -- see below --
and so we made them `public`)

The second new element of the Truffle DSL used here is the `@CachedContext` annotation,
which allows us to get a reference to the current `TruffleLanguage` context,
and, through that context,
the `GlobalScopeObject` instance in which we store the global variables.
The Truffle DSL populates this parameter in the generated subclass by calling the
[`lookupContextReference()` method](https://javadoc.io/static/org.graalvm.truffle/truffle-api/21.2.0/com/oracle/truffle/api/nodes/Node.html#lookupContextReference-java.lang.Class-)
of the Node superclass.

### Expression Nodes

We need to add new expression classes to our language.
The first, and simplest, is the `undefined` literal expression:

```java
public final class UndefinedLiteralExprNode extends EasyScriptExprNode {
    @Override
    public int executeInt(VirtualFrame frame) throws UnexpectedResultException {
        throw new UnexpectedResultException(Undefined.INSTANCE);
    }

    @Override
    public double executeDouble(VirtualFrame frame) throws UnexpectedResultException {
        throw new UnexpectedResultException(Undefined.INSTANCE);
    }

    @Override
    public Object executeGeneric(VirtualFrame frame) {
        return Undefined.INSTANCE;
    }
}
```

We return `Undefined.INSTANCE` in `executeGeneric()`,
and throw `UnexpectedResultException` for the remaining `execute*()` methods.

The second new expression node is the assignment expression:

```java
@NodeChild(value = "assignmentExpr")
@NodeField(name = "name", type = String.class)
public abstract class GlobalVarAssignmentExprNode extends EasyScriptExprNode {
    protected abstract String getName();

    @Specialization
    protected Object assignVariable(
            Object value,
            @CachedContext(EasyScriptTruffleLanguage.class) EasyScriptLanguageContext context) {
        String variableId = this.getName();
        if (!context.globalScopeObject.updateVariable(variableId, value)) {
            throw new EasyScriptException(this, "'" + variableId + "' is not defined");
        }
        return value;
    }
}
```

It's very similar to the `GlobalVarDeclStmtNode`,
but updates the variable in `context.globalScopeObject` instead of creating it.

The third new expression node is the reference to a variable:

```java
@NodeField(name = "name", type = String.class)
public abstract class GlobalVarReferenceExprNode extends EasyScriptExprNode {
    protected abstract String getName();

    @Specialization
    protected Object readVariable(
            @CachedContext(EasyScriptTruffleLanguage.class) EasyScriptLanguageContext context) {
        String variableId = this.getName();
        var value = context.globalScopeObject.getVariable(variableId);
        if (value == null) {
            throw new EasyScriptException(this, "'" + variableId + "' is not defined");
        }
        return value;
    }
}
```

We also need to change our addition node,
to account for the presence of `undefined`:

```java
@NodeChild("leftNode")
@NodeChild("rightNode")
public abstract class AdditionExprNode extends EasyScriptExprNode {
    @Specialization(rewriteOn = ArithmeticException.class)
    protected int addInts(int leftValue, int rightValue) {
        return Math.addExact(leftValue, rightValue);
    }

    @Specialization(replaces = "addInts")
    protected double addDoubles(double leftValue, double rightValue) {
        return leftValue + rightValue;
    }

    @Fallback
    protected double addWithUndefined(Object leftValue, Object rightValue) {
        return Double.NaN;
    }
}
```

We add a third specialization that's annotated with `@Fallback`,
which means it uses the negation of all the other specialization activation conditions
(you can only have a single `@Fallback` specialization).
In that specialization, we return `Double.NaN`,
which is how JavaScript addition behaves when at least one of its constituents is `undefined`.

### `RootNode`

And finally, we have our `RootNode`.
It takes an instance of `TruffleLanguage` and a list of statements in its constructor.
It passes the `TruffleLanguage` to its `RootNode` superclass with a `super()` call.
In the `execute()` method,
it evaluates all of the statements,
and returns the result of executing the last one.
It also has another very important responsibility --
it implements [variable hoisting](https://developer.mozilla.org/en-US/docs/Glossary/Hoisting).

In JavaScript, `var` declarations are always moved to the beginning of the block they belong to.
They are initialized with the `undefined` value.
This means code like this:

```js
const a = b;
var b = 1;
```

is actually valid in JavaScript,
and gets transformed to:

```js
var b = undefined;
const a = b;
b = 1;
```

The `EasyScriptRootNode` implements these semantics by transforming the list of statements it receives.
It gathers them into two groups,
with all `var` declarations being split into a declaration that goes into the first group,
and an assignment expression that goes into the second group.
All non-`var` statements go into the second group.
The final list of statements consists of the entire first group,
followed by the second group.

There is also another interesting edge case that hoisting surfaces.
Usually, the result of executing a statement consisting of an assignment expression is the value assigned to the variable --
so, evaluating `let a; a = 3;` returns `3`.
However, when that assignment expression is created because of splitting a hoisted declaration into the variable creation and assignment,
that assignment should return `undefined` instead.
In other words, the code `var b = 3;`,
even though it executes as `var b = undefined; b = 3;`,
should return `undefined`, not `3`.

To make that possible, we add an option to the `ExprStmtNode`
to disregard the value of the expression that its child evaluates to,
and always return `undefined` instead:

```java
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

Our `RootNode` uses this functionality by passing `true` to the second argument of the `ExprStmtNode`
constructor for assignments created as a result of splitting a hoisted declaration:

```java
public final class EasyScriptRootNode extends RootNode {
    @Children
    private final EasyScriptStmtNode[] stmtNodes;

    public EasyScriptRootNode(EasyScriptTruffleLanguage truffleLanguage,
            List<EasyScriptStmtNode> stmtNodes) {
        super(truffleLanguage);

        List<GlobalVarDeclStmtNode> varDeclarations = new ArrayList<>();
        List<EasyScriptStmtNode> remainingStmts = new ArrayList<>();
        for (EasyScriptStmtNode stmtNode : stmtNodes) {
            if (stmtNode instanceof GlobalVarDeclStmtNode) {
                var varDeclaration = (GlobalVarDeclStmtNode) stmtNode;
                if (varDeclaration.getDeclarationKind() == DeclarationKind.VAR) {
                    varDeclarations.add(GlobalVarDeclStmtNodeGen.create(
                            new UndefinedLiteralExprNode(), varDeclaration.getName(), DeclarationKind.VAR));

                    remainingStmts.add(new ExprStmtNode(
                            GlobalVarAssignmentExprNodeGen.create(
                                    varDeclaration.getInitializerExpr(), varDeclaration.getName()),
                            true));

                    continue;
                }
            }
            remainingStmts.add(stmtNode);
        }

        this.stmtNodes = Stream.concat(
                varDeclarations.stream(),
                remainingStmts.stream()
        ).toArray(EasyScriptStmtNode[]::new);
    }

    @Override
    public Object execute(VirtualFrame frame) {
        Object ret = Undefined.INSTANCE;
        for (EasyScriptStmtNode stmtNode : this.stmtNodes) {
            ret = stmtNode.executeStatement(frame);
        }
        return ret;
    }
}
```

The one new Truffle thing about this class is the `@Children` annotation.
It's basically identical to `@Child`,
but used in case the Node has a variable amount of subnodes,
like in our case.

You might be surprised to see an array used for storing the children,
but Truffle actually requires that!
Arrays are much easier to convert to native code than collections like `List`.
Because arrays are mutable in Java,
we can also mark the entire field as `final`
(which you can't do for `@Child` fields).

The way I've dealt with this in `EasyScriptRootNode` is a pretty common pattern in Truffle:
the class takes a collection in its constructor,
but converts it to an array internally.

## `Undefined` polyglot class

The JavaScript `undefined` value is represented by the `Undefined` class.
Since there's only ever a single member of the `undefined` type,
the class is a singleton --
that's why we always refer to it as `Undefined.INSTANCE`.
But that's not the end of the story with this class.

Since it can now be returned as the result of evaluating EasyScript
(in a program like `let a; a`),
we need to make it a language interop value,
so that it can be handled correctly by the GraalVM polyglot API.

We do that by implementing the `TruffleObject` interface from the
`com.oracle.truffle.api.interop` package
(it's a marker interface, so doesn't have any methods),
and annotating the class with the `@ExportLibrary`
annotation from the `com.oracle.truffle.api.library` package,
passing it the class of `InteropLibrary`
from the `com.oracle.truffle.api.interop` package,
and then implementing the messages from that library.

The complete list of messages can be found in the
[documentation for `InteropLibrary`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/interop/InteropLibrary.html).
You implement messages by adding instance methods to the class,
and annotating them with `@ExportMessage`.
Note that the `receiver` object is implied to be the instance of your implementing class,
so your implementations should skip the first argument compared to the library methods.

The name of the method in the implementing class must match the name from the library,
or you can use the `name` attribute of `@ExportMessage` to change it.
For example, the
[`isNull()` message](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/interop/InteropLibrary.html#isNull-java.lang.Object-)
can be implemented by a method declared as `@ExportMessage boolean isNull()`,
or by `@ExportMessage(name = "isNull") boolean representsNull()`.

Note that the methods implementing the messages do not have to be `public`.
It's common practice to make them package-private,
to not pollute the public API of the class.

In our `Undefined` class, we need to implement the
[`isNull()` message](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/interop/InteropLibrary.html#isNull-java.lang.Object-),
to return `true`.
We also implement the
[`toDisplayString()` message](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/interop/InteropLibrary.html#toDisplayString-java.lang.Object-boolean-),
which is what the `Value` class that wraps our polyglot instance uses when `toString()` is called on it;
we just return the `"undefined"` string from that method.

In summary, the code for our class looks as follows:

```java
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.TruffleObject;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.library.ExportMessage;

@ExportLibrary(InteropLibrary.class)
public final class Undefined implements TruffleObject {
    public static final Undefined INSTANCE = new Undefined();

    private Undefined() {
    }

    @Override
    public String toString() {
        return "Undefined";
    }

    @ExportMessage
    boolean isNull() {
        return true;
    }

    @ExportMessage
    Object toDisplayString(@SuppressWarnings("unused") boolean allowSideEffects) {
        return "undefined";
    }
}
```

This allows us to write the following unit test:

```java
    @Test
    public void correctly_returns_undefined() {
        Context context = Context.create();
        Value result = context.eval("ezs",
                "var a; " +
                "a"
        );

        assertTrue(result.isNull());
        assertEquals("undefined", result.toString());
    }
```

## Surfacing the global bindings

With all of the above code in place,
we can execute the program we set as our goal at the beginning of the article:

```java
    @Test
    public void evaluates_statements() {
        Context context = Context.create();
        Value result = context.eval("ezs",
                "var a = 0; " +
                "let b = 1; " +
                "const c = 2.0; " +
                "a + b + c"
        );

        assertEquals(3.0, result.asDouble(), 0.0);
    }
```

However, there's one more thing we should do to make EasyScript a good citizen of the GraalVM polyglot ecosystem.
The `Context` class allows retrieving the global variables of a given language with the
[`getBindings(String languageId)` method](https://www.graalvm.org/truffle/javadoc/org/graalvm/polyglot/Context.html#getBindings-java.lang.String-).
We should allow this capability for EasyScript as well;
in order to do that,
we have to add a few elements to our implementation.

First of all, we need to override the
[`getScope()` method](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/TruffleLanguage.html#getScope-C-) in our `TruffleLanguage` class.
We need to return an object allowing access to the global variables from it,
which is `GlobalScopeObject` in our case.
Conveniently, the `getScope()` method receives the language context as its argument,
so, because of the way we designed our classes,
we can just return `contex.globalScopeObject` from it:

```java
@TruffleLanguage.Registration(id = "ezs", name = "EasyScript")
public final class EasyScriptTruffleLanguage
        extends TruffleLanguage<EasyScriptLanguageContext> {
    // ...

    @Override
    protected Object getScope(EasyScriptLanguageContext context) {
        return context.globalScopeObject;
    }
}
```

The second set of changes required is implementing the interop library in the `GlobalScopeObject`,
similarly like we did in the `Undefined` class.
We start with implementing the `TruffleObject` marker interface.
Because we return this object from the `getScope()` method in `TruffleLanguage`,
the first message that we have to implement is the
[`isScope()` message](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/interop/InteropLibrary.html#isScope-java.lang.Object-)
to return `true`.
That in turn requires implementing a few other messages:
* [`hasMembers()`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/interop/InteropLibrary.html#hasMembers-java.lang.Object-)
  for which we just return `true`,
* [`isMemberReadable(String member)`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/interop/InteropLibrary.html#isMemberReadable-java.lang.Object-java.lang.String-)
  for which we return `true` if a variable with the provided name exists,
* [`readMember(String member)`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/interop/InteropLibrary.html#readMember-java.lang.Object-java.lang.String-)
  for which we just return the value of the variable
  (and throw `UnknownIdentifierException` if it doesn't exist),
* [`toDisplayString()`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/interop/InteropLibrary.html#toDisplayString-java.lang.Object-boolean-)
  that we saw already in `Undefined`,
* [`hasLanguage()`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/interop/InteropLibrary.html#hasLanguage-java.lang.Object-)
  and [`getLanguage()`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/interop/InteropLibrary.html#getLanguage-java.lang.Object-),
  to signify our value belongs to the `EasyScriptTruffleLanguage` class,
* and finally, [`getMembers()`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/interop/InteropLibrary.html#getMembers-java.lang.Object-boolean-),
  which returns a different object which is meant to hold the collection of all the names of our variables
  (_not_ their values -- this message has a pretty confusing name,
  in my opinion!).
  That object must implement the [`hasArrayElements()` message](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/interop/InteropLibrary.html#hasArrayElements-java.lang.Object-),
  which in turn requires
  [`getArraySize()`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/interop/InteropLibrary.html#getArraySize-java.lang.Object-),
  [`isArrayElementReadable(long index)`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/interop/InteropLibrary.html#isArrayElementReadable-java.lang.Object-long-)
  and [`readArrayElement(long index)`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/interop/InteropLibrary.html#readArrayElement-java.lang.Object-long-),
  all of which basically amount to implementing a simple version of an array or a list.
  We usually write a separate class whose instance we return from this method --
  it doesn't need to be public,
  you can safely make it package-private.

Taking it all together, our class now looks as follows:

```java
@ExportLibrary(InteropLibrary.class)
public final class GlobalScopeObject implements TruffleObject {
    private final Map<String, Object> variables = new HashMap<>();
    private final Set<String> constants = new HashSet<>();

    // ...

    @ExportMessage
    boolean isScope() {
        return true;
    }

    @ExportMessage
    boolean hasMembers() {
        return true;
    }

    @ExportMessage
    boolean isMemberReadable(String member) {
        return this.variables.containsKey(member);
    }

    @ExportMessage
    Object readMember(String member) throws UnknownIdentifierException {
        Object value = this.variables.get(member);
        if (null == value) {
            throw UnknownIdentifierException.create(member);
        }
        return value;
    }

    @ExportMessage
    Object getMembers(@SuppressWarnings("unused") boolean includeInternal) {
        return new GlobalVariableNamesObject(this.variables.keySet());
    }

    @ExportMessage
    Object toDisplayString(@SuppressWarnings("unused") boolean allowSideEffects) {
        return "global";
    }

    @ExportMessage
    boolean hasLanguage() {
        return true;
    }

    @ExportMessage
    Class<? extends TruffleLanguage<?>> getLanguage() {
        return EasyScriptTruffleLanguage.class;
    }
}

@ExportLibrary(InteropLibrary.class)
final class GlobalVariableNamesObject implements TruffleObject {
    private final List<String> names;

    GlobalVariableNamesObject(Set<String> names) {
        this.names = new ArrayList<>(names);
    }

    @ExportMessage
    boolean hasArrayElements() {
        return true;
    }

    @ExportMessage
    long getArraySize() {
        return this.names.size();
    }

    @ExportMessage
    boolean isArrayElementReadable(long index) {
        return index >= 0 && index < this.names.size();
    }

    @ExportMessage
    Object readArrayElement(long index) throws InvalidArrayIndexException {
        if (!this.isArrayElementReadable(index)) {
            throw InvalidArrayIndexException.create(index);
        }
        return this.names.get((int) index);
    }
}
```

With this code in place,
we can write the following unit test retrieving EasyScript's global bindings:

```java
    @Test
    public void surfaces_global_bindings() {
        this.context.eval("ezs",
                "var a = 1; " +
                "let b = 2 + 3; " +
                "const c = 4.0; "
        );

        Value globalBindings = this.context.getBindings("ezs");
        assertFalse(globalBindings.isNull());
        assertTrue(globalBindings.hasMembers());
        assertTrue(globalBindings.hasMember("a"));
        assertEquals(Set.of("a", "b", "c"), globalBindings.getMemberKeys());

        Value b = globalBindings.getMember("b");
        assertEquals(5, b.asInt());
    }
```

## Summary

Phew! Something seemingly so simple as global variables turned out to be a lot of work,
but we finally managed to power through it.

As usual, the full working code from the article
[is available on GitHub](https://github.com/skinny85/graalvm-truffle-tutorial/tree/master/part-05).

In the next part of the series,
we will finally add function calls to the language,
so make sure you don't miss it!
