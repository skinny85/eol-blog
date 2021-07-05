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
our EasyScript language consisted entirely of addition expressions and numeric literals.
But having only expressions is not how programming languages generally work --
they consist of statements, and usually a series of them.
In this part of the series,
we will move one step closer towards making EasyScript a real language by adding support for variables.

Our goal is to be able to execute the following JavaScript program:

```js
var a = 0;
let b = 1;
const c = 2.0;
b + c
```

Since we still don't have a way to print anything to the screen in our language,
as we don't have function calls yet,
we will say that executing a program like that returns the result of executing the last statement --
in the above case, that would be `3.0`.

Implementing variables will require quite a large amount of changes --
our grammar will become much more complicated,
we will finally use the `VirtualFrame` argument of the `execute*()` methods,
and also learn about `FrameDescriptor`s and `FrameSlot`s.
Let's dive right in, because there's a lot to do!

## Grammar

Our language's grammar will need a few more elements --
most importantly, we will have to introduce the concept of 'statements' to it.
It will also need a new type of expressions,
as assignment is an expression in JavaScript.

Our ANTLR grammar looks as follows:

```shell-session
grammar EasyScript ;

@header{
package com.endoflineblog.truffle.part_05;
}

start : stmt+ EOF ;

stmt : ('var' | 'let' | 'const') binding (',' binding)* ';'?     #DeclStmt
     |                                            expr1 ';'?     #ExprStmt
     ;

binding : ID '=' expr1 ;

expr1 : binding                    #AssignmentExpr1
      | expr2                      #PrecedenceTwoExpr1
      ;
expr2 : left=expr2 '+' right=expr3 #AddExpr2
      | expr3                      #PrecedenceThreeExpr2
      ;
expr3 : literal                    #LiteralExpr3
      | ID                         #ReferenceExpr3
      | '(' expr1 ')'              #PrecedenceOneExpr3
      ;

literal : INT | DOUBLE ;

fragment DIGIT : [0-9] ;
INT : DIGIT+ ;
DOUBLE : DIGIT+ '.' DIGIT+ ;

fragment LETTER : [a-zA-Z$] ;
ID : (LETTER | '_') (LETTER | '_' | DIGIT)* ;

// skip all whitespace
WS : (' ' | '\r' | '\t' | '\n' | '\f')+ -> skip ;
```

A few notes about the grammar:

* The result of parsing will now be a list of statements.
  As you can see, lists are very easy to implement in ANTLR:
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
  However, to implement that, I would have to introduce `undefined`
  as a value, and I don't want to do that just yet --
  there's enough new stuff in this article already!
  For that reason, I've made the initializer required for all variable declarations.
* JavaScript hoists `var` definitions to the beginning of the block.
  For example, the following code:

    ```js
    var a = 1;
    console.log(a + b);
    var b = 2;
    ```

    Will actually be executed as:

    ```js
    var a, b;
    a = 1;
    console.log(a + b);
    b = 2;
    ```

    Implementing this would also require introducing `undefined`,
    so I've skipped this for now as well.

## Frames, descriptors, and slots

So, how do you implement variables in Truffle?
You obviously need to store their value somewhere,
update that value when an assignment happens,
and then retrieve it when an expression references a variable by name.

You store the values of the variables inside the `VirtualFrame`
instance that is passed to the `execute*()` methods.
The values are indexed by a class called `FrameSlot`,
whose instances are created by using another class, `FrameDescriptor`.

The frame descriptor can be seen as the "static" information about a frame.
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
using the static information in your program --
like for the `hypotenuse()` function above.

Once the `FrameSlot`s have been added to the `FrameDescriptor`,
it's passed to the `RootNode` class.
When the `CallTarget` that wraps the `RootNode` is invoked,
it will create a `VirtualFrame` instance with the appropriate number of slots
(and of the correct types, if we're implementing a statically-typed language),
using the information it got from the root node's `FrameDescriptor` instance.

Given all that, our EasyScript `TruffleLanguage` looks as follows:

```java
import com.oracle.truffle.api.CallTarget;
import com.oracle.truffle.api.Truffle;
import com.oracle.truffle.api.TruffleLanguage;
import com.oracle.truffle.api.frame.FrameDescriptor;
import java.util.List;

@TruffleLanguage.Registration(id = "ezs", name = "EasyScript")
public final class EasyScriptTruffleLanguage extends TruffleLanguage<Void> {
    @Override
    protected CallTarget parse(ParsingRequest request) throws Exception {
        var frameDescriptor = new FrameDescriptor();
        var easyScriptTruffleParser = new EasyScriptTruffleParser(frameDescriptor);
        List<EasyScriptStmtNode> stmts = easyScriptTruffleParser.parse(request.getSource().getReader());
        var rootNode = new EasyScriptRootNode(this, frameDescriptor, stmts);
        return Truffle.getRuntime().createCallTarget(rootNode);
    }

    @Override
    protected Void createContext(Env env) {
        return null;
    }
}
```

## Parsing

Our parser gets the `FrameDescriptor` passed to it,
and uses it to create the `FrameSlot`s
as needed when it encounters a variable declaration in the parse tree returned from ANLTR:

```java
    enum VariableMutability { MUTABLE, IMMUTABLE }

    private Stream<EasyScriptStmtNode> parseDeclStmt(EasyScriptParser.DeclStmtContext declStmt) {
        var variableMutability = declStmt.getText().startsWith("const")
                ? VariableMutability.IMMUTABLE
                : VariableMutability.MUTABLE;
        return declStmt.binding()
                .stream()
                .map(binding -> {
                    // create a new frame slot for this variable
                    String variableId = binding.ID().getText();
                    FrameSlot frameSlot;
                    try {
                        frameSlot = this.frameDescriptor.addFrameSlot(variableId, variableMutability, FrameSlotKind.Illegal);
                    } catch (IllegalArgumentException e) {
                        throw new EasyScriptException("Identifier '" + variableId + "' has already been declared");
                    }
                    return new DeclStmtNode(AssignmentExprNodeGen.create(
                            this.parseExpr1(binding.expr1()), frameSlot));
                });
    }
```

When we encounter a variable declaration statement,
we create a new `FrameSlot` for each binding present inside the statement.
We need to gracefully handle the case of encountering duplicate variable names
(like `let a = 1, a = 2;`).
Finally, we parse the initializer expression for the variable,
and create an instance of the Truffle AST by passing both the slot and the descriptor to the AST Node.

Note that, while we use the name of the variable as the name of the `FrameSlot`,
that is not a requirement -- those two things don't have to be the same.
Notice that we don't pass the name of the variable to the Truffle AST Node,
only the slot; which means the node itself does not know the name of the variable it represents,
only the slot it occupies in the frame.
That becomes important when you implement lexical scoping in your language,
in which variables in inner scopes can shadow variables with the same names from outer scopes.

We also introduce an enum that represents whether a given variable can be reassigned
(basically, whether it's `const`, or `let` / `var`).
Truffle allows storing arbitrary extra data in a slot using its `info` field,
which has type `Object`.

We use that extra info when we encounter an assignment expression:

```java
    private AssignmentExprNode parseAssignmentExpr(EasyScriptParser.AssignmentExpr1Context assignmentExpr) {
        EasyScriptParser.BindingContext binding = assignmentExpr.binding();
        String variableId = binding.ID().getText();
        // retrieve the frame slot for this variable
        FrameSlot frameSlot = this.frameDescriptor.findFrameSlot(variableId);
        if (frameSlot == null) {
            throw new EasyScriptException("'" + variableId + "' is not defined");
        }
        if (frameSlot.getInfo() == VariableMutability.IMMUTABLE) {
            throw new EasyScriptException("Assignment to constant variable '" + variableId + "'");
        }
        return AssignmentExprNodeGen.create(this.parseExpr1(binding.expr1()), frameSlot);
    }
```

If the assignment is to a `const` variable, we throw an exception.

Finally, we have to handle an expression referencing a variable:

```java
    private ReferenceExprNode parseReferenceExpr(EasyScriptParser.ReferenceExpr3Context refExpr) {
        String variableId = refExpr.ID().getText();
        // retrieve the frame slot for this variable
        FrameSlot frameSlot = this.frameDescriptor.findFrameSlot(variableId);
        if (frameSlot == null) {
            throw new EasyScriptException("'" + variableId + "' is not defined");
        }
        return ReferenceExprNodeGen.create(frameSlot);
    }
```

We error out if the expression references a variable that has not been previously defined.

As you can see, our parser now performs some semantic analysis in addition to parsing,
by checking our program for logical correctness,
not only whether it adheres to the language's grammar.
That's a pretty common thing to do in Truffle implementations for dynamic languages.
If your language is statically typed,
it's usually a good idea to extract the semantic analysis into its own separate compiler pass,
as semantic analysis of those kinds of languages is usually much more complicated
(mainly because of type checking).

## Truffle AST Nodes

Let's now see how do the Truffle AST Nodes look for these variable operations.

### Code organization

Before we show the code of the actual Nodes,
a quick note about organizing the code for the Nodes.

We will need to introduce a new kind of Nodes representing Statements,
and also a few new types of expression Nodes.
While up to this point, we simply kept the Nodes in the same Java package as the rest of the classes in the language implementation,
this would become very messy with all of these new Node classes.

I would like to show you a way of organizing your language implementation code into Java packages that makes it very easy to tell where everything is,
and which is quickly becoming a standard in the Truffle world:

```shell-session
basepackage
   |
   |--- TruffleLanguage class
   |--- parser class
   |--- TypeSystem class
   |--- ...
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
import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.nodes.Node;

public abstract class EasyScriptStmtNode extends Node {
    public abstract Object executeStatement(VirtualFrame frame);
}
```

It only has a single `execute*()` method,
unlike the expression Nodes.
To make sure we don't confuse it with the `execute*()` methods from the expression Nodes,
we call it `executeStatement()`,
but, of course, the name can be anything you want,
as long as it starts with the word "execute".

The simplest kind of statement is the expression statement:

```java
import com.endoflineblog.truffle.part_05.nodes.exprs.EasyScriptExprNode;
import com.oracle.truffle.api.frame.VirtualFrame;

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

The second kind of statement is the declaration statement:

```java
import com.endoflineblog.truffle.part_05.nodes.exprs.AssignmentExprNode;
import com.oracle.truffle.api.frame.VirtualFrame;

public final class DeclStmtNode extends EasyScriptStmtNode {
    @SuppressWarnings("FieldMayBeFinal")
    @Child
    private AssignmentExprNode assignmentExpression;

    public DeclStmtNode(AssignmentExprNode assignmentExpression) {
        this.assignmentExpression = assignmentExpression;
    }

    @Override
    public Object executeStatement(VirtualFrame frame) {
        return this.assignmentExpression.executeGeneric(frame);
    }
}
```

It wraps an assignment expression,
where the logic of storing the value of the variable lives.
It would probably make sense for the declaration statement to return `undefined`,
but since, like I wrote above,
we don't want to add that concept to the implementation just yet,
we'll simply make it return the value of variable
(so, evaluating `const a = 1 + 2;` would return `3`).

### Expression Nodes

We need to add two more classes of expression nodes to our language.
The first is the assignment expression:

```java
import com.oracle.truffle.api.dsl.NodeChild;
import com.oracle.truffle.api.dsl.NodeField;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.frame.FrameSlot;
import com.oracle.truffle.api.frame.FrameSlotKind;
import com.oracle.truffle.api.frame.VirtualFrame;

@NodeField(name = "frameSlot", type = FrameSlot.class)
@NodeChild(value = "initializerExpr")
public abstract class AssignmentExprNode extends EasyScriptExprNode {
    protected abstract FrameSlot getFrameSlot();

    @Specialization
    protected int intVariable(VirtualFrame frame, int value) {
        FrameSlot frameSlot = this.getFrameSlot();
        frame.getFrameDescriptor().setFrameSlotKind(frameSlot, FrameSlotKind.Int);
        frame.setInt(frameSlot, value);
        return value;
    }

    @Specialization(replaces = "intVariable")
    protected double doubleVariable(VirtualFrame frame, double value) {
        FrameSlot frameSlot = this.getFrameSlot();
        frame.getFrameDescriptor().setFrameSlotKind(frameSlot, FrameSlotKind.Double);
        frame.setDouble(frameSlot, value);
        return value;
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

To use the field in the abstract superclass of the generated class,
we can declare an abstract getter for it,
like we do here with `getFrameSlot()`.
The DSL will override those methods in the generated subclass.

The field will be populated by getting its value from the generated `create()`
static factory method.
The parameters for `@NodeField`s will be added to the `create()` method after all of the `@NodeChild` parameters --
so, in our case, `create()` will have the signature:

```java
public final class AssignmentExprNodeGen extends AssignmentExprNode {
    public static AssignmentExprNode create(
            EasyScriptExprNode initializerExpr,
            FrameSlot frameSlot) {
        // ...
```

The second new element is that the `@Specialization` methods take a `VirtualFrame` as their first argument.
This is allowed as a special case by the DSL.
After the optional `VirtualFrame`,
the number of arguments to the specialization methods must be equal to the number of `@NodeChild` annotations placed on the class.

In our case, we need the `VirtualFrame`,
because we have to store the result of executing the expression to the right of the `=` sign in the assignment expression inside the `VirtualFrame` under the `FrameSlot` we were created with.
Depending on the type of the result,
we set the type of the slot in the frame's `FrameDescriptor`.
Slots can have any of the Java primitive types, or `Object`
(although at this moment, we only use `int` and `double` in EasyScript).

The second new expression Node is a reference to variable.
It reads the value of the slot it's created with from the `VirtualFrame`
instance passed to its `execute*()` methods:

```java
import com.oracle.truffle.api.dsl.NodeField;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.frame.FrameSlot;
import com.oracle.truffle.api.frame.FrameUtil;
import com.oracle.truffle.api.frame.VirtualFrame;

@NodeField(name = "frameSlot", type = FrameSlot.class)
public abstract class ReferenceExprNode extends EasyScriptExprNode {
    protected abstract FrameSlot getFrameSlot();

    @Specialization(guards = "frame.isInt(getFrameSlot())")
    protected int readInt(VirtualFrame frame) {
        return FrameUtil.getIntSafe(frame, this.getFrameSlot());
    }

    @Specialization(guards = "frame.isDouble(getFrameSlot())", replaces = "readInt")
    protected double readDouble(VirtualFrame frame) {
        return FrameUtil.getDoubleSafe(frame, this.getFrameSlot());
    }
}
```

It again uses the `@NodeField` annotation and `VirtualFrame` in the `@Specialization` methods,
but it also introduces one new element of the Truffle DSL:
the `guards` expression.

When we read a variable, we have no way of knowing in advance what type will it have.
So, we take advantage of the fact that we save the type of the slot in the assignment expression Node,
and gate the specializations based on the type the slot has in the descriptor.

To communicate such a complicated condition to the Truffle DSL,
the `guards` attribute supports a string-based DSL that is pretty much a simplified subset of the Java language.
The expression is expected to return a boolean value indicating whether the specialization should be activated --
in our case, if `frame.isInt/isDouble(getFrameSlot())` returns `true`.


### `RootNode`

And finally, we have our `RootNode`.
It takes an instance of `TruffleLanguage`, `FrameDescriptor`,
and a list of statements.
It passes the `TruffleLanguage` and the `FrameDescriptor`
to its `RootNode` superclass with a `super()` call in its constructor.
In the `execute()` method,
it executes all of the statements,
and returns the value of the last one:

```java
import com.endoflineblog.truffle.part_05.EasyScriptTruffleLanguage;
import com.endoflineblog.truffle.part_05.nodes.stmts.EasyScriptStmtNode;
import com.oracle.truffle.api.frame.FrameDescriptor;
import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.nodes.RootNode;
import java.util.List;

public final class EasyScriptRootNode extends RootNode {
    @Children
    private final EasyScriptStmtNode[] stmtNodes;

    public EasyScriptRootNode(EasyScriptTruffleLanguage truffleLanguage,
            FrameDescriptor frameDescriptor, List<EasyScriptStmtNode> stmtNodes) {
        super(truffleLanguage, frameDescriptor);

        this.stmtNodes = stmtNodes.toArray(new EasyScriptStmtNode[]{});
    }

    @Override
    public Object execute(VirtualFrame frame) {
        Object ret = null;
        for (EasyScriptStmtNode stmtNode : this.stmtNodes) {
            ret = stmtNode.executeStatement(frame);
        }
        return ret;
    }
}
```

The one new thing about this class is the `@Children` annotation.
It's basically identical to `@Child`,
but used in case the Node has a variable amount of subnodes,
like in our case.

You might be surprised to see an array used for storing the children,
but it's actually a Truffle requirement!
Arrays are much easier to convert to native code than collections like `List`.
Because arrays are mutable in Java,
we can also mark the entire field as `final`
(which you can't do for `@Child` fields).

The way I've dealt with this in `EasyScriptRootNode` is a pretty common pattern in Truffle:
the class takes a collection in its constructor,
but converts it to an array internally.

## Summary

Bringing it all together,
we can write a unit test executing the program we set as our goal in the beginning of the article:

```java
    @Test
    public void evaluates_statements() {
        Context context = Context.create();
        Value result = context.eval("ezs",
                "var a = 0; " +
                "let b = 1; " +
                "const c = 2.0; " +
                "b + c"
        );

        assertEquals(3.0, result.asDouble(), 0.0);
    }
```

Something seemingly so simple as variables turned out to be pretty non-trivial,
but we managed to make it work!

As usual, the full working code from the article
[is available on GitHub](https://github.com/skinny85/graalvm-truffle-tutorial/tree/master/part-05).

In the next article of the series,
we will finally add that pesky `undefined` that we wanted to have in so many places here,
and we'll also make EasyScript a better citizen of the GraalVM polyglot ecosystem by making the variables available through bindings.
