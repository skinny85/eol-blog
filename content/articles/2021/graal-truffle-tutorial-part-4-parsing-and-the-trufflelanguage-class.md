---
id: 56
layout: truffle-tutorial.html
title: Graal Truffle tutorial part 4 – parsing, and the TruffleLanguage class
summary: |
  In the fourth part of the Truffle tutorial,
  we talk about parsing,
  and introduce the GraalVM polyglot API with the TruffleLanguage class.
created_at: 2021-03-21
---

## Parsing

Up to this point,
when writing unit tests for our EasyScript implementation,
we created the AST Nodes explicitly, like this:

```java
EasyScriptNode exprNode = new AdditionNode(
    new IntLiteralNode(1),
    new DoubleLiteralNode(2.0));
```

But, of course, that's not the way you write programming language code.
Normally, a program is written as text in a file --
for example, the above expression would be written as simply `1 + 2.0`.
The process of transforming that text into an abstract syntax tree is called **parsing**.

You might be surprised to learn that Truffle does not ship out of the box with any tools to parse your language.
Since this is a task every language implementation will have to perform,
that might seem like a mistake.
However, when considering the problem a little deeper,
I think there are good reasons for making that choice.

There are many different parsing algorithms
([LL(n)](https://en.wikipedia.org/wiki/LL_parser),
[recursive descent](https://en.wikipedia.org/wiki/Recursive_descent_parser),
[LALR](https://en.wikipedia.org/wiki/LALR_parser), etc.),
each with different tradeoffs around
performance, memory usage, context-free grammar constraints, etc.
It makes sense for Truffle to not want to be overly prescriptive in the matter,
and give the language implementer complete freedom in choosing the right tool for their particular circumstances.

Another factor in making that decision is that Java has a wealth of libraries to choose from for the task of parsing.
[This blog article](https://tomassetti.me/parsing-in-java)
gives a nice overview.

For this article series, I'll be using [ANTLR](https://www.antlr.org).
It's one of the oldest and most battle-tested of all the libraries,
and I like that the result of executing it is the parse tree,
instead of forcing you to build the AST yourself by inserting code directly into the grammar file,
which I consider an anti-pattern.

I won't be focusing too much in these posts on the parsing aspect of implementing a new language,
nor on the details of using ANTLR,
as both of those are deep topics,
each worthy of its own article series.
Feel free to use my code as the jumping-off point when implementing your own language,
and consult the excellent
[ANTLR documentation](https://github.com/antlr/antlr4/blob/master/doc/index.md)
as needed.

Here's the ANTLR context-free grammar for our simple language from
[part 3](/graal-truffle-tutorial-part-3-specializations-with-truffle-dsl-typesystem)
that allows addition of integer and `double` literals:

```shell-session
grammar EasyScript ;

@header{
package com.endoflineblog.truffle.part_04;
}

start : expr EOF ;
expr : left=expr '+' right=expr #AddExpr
     | literal                  #LiteralExpr
     ;
literal : INT | DOUBLE ;

fragment DIGIT : [0-9] ;
INT : DIGIT+ ;
DOUBLE : DIGIT+ '.' DIGIT+ ;

// skip all whitespace
WS : (' ' | '\r' | '\t' | '\n' | '\f')+ -> skip ;
```

And here is the actual parser code.
It works by first invoking ANTLR to get the parse tree,
and then turns that parse tree into our Truffle AST:

```java
import org.antlr.v4.runtime.ANTLRInputStream;
import org.antlr.v4.runtime.BailErrorStrategy;
import org.antlr.v4.runtime.CharStream;
import org.antlr.v4.runtime.CommonTokenStream;
import org.antlr.v4.runtime.tree.TerminalNode;
import java.io.IOException;
import java.io.Reader;

public final class EasyScriptTruffleParser {
    public static EasyScriptNode parse(String program) {
        return parse(CharStreams.fromString(program));
    }

    public static EasyScriptNode parse(Reader program) throws IOException {
        return parse(CharStreams.fromReader(program));
    }

    private static EasyScriptNode parse(CharStream inputStream) {
        var lexer = new EasyScriptLexer(inputStream);
        // remove the default console error listener
        lexer.removeErrorListeners();
        var parser = new EasyScriptParser(new CommonTokenStream(lexer));
        // remove the default console error listener
        parser.removeErrorListeners();
        // throw an exception when a parsing error is encountered
        parser.setErrorHandler(new BailErrorStrategy());
        EasyScriptParser.ExprContext context = parser.start().expr();
        return expr2TruffleNode(context);
    }

    private static EasyScriptNode expr2TruffleNode(EasyScriptParser.ExprContext expr) {
        return expr instanceof EasyScriptParser.AddExprContext
                ? addExpr2AdditionNode((EasyScriptParser.AddExprContext) expr)
                : literalExpr2ExprNode((EasyScriptParser.LiteralExprContext) expr);
    }

    private static AdditionNode addExpr2AdditionNode(EasyScriptParser.AddExprContext addExpr) {
        return AdditionNodeGen.create(
                expr2TruffleNode(addExpr.left),
                expr2TruffleNode(addExpr.right));
    }

    private static EasyScriptNode literalExpr2ExprNode(EasyScriptParser.LiteralExprContext literalExpr) {
        TerminalNode intTerminal = literalExpr.literal().INT();
        return intTerminal != null
                ? parseIntLiteral(intTerminal.getText())
                : parseDoubleLiteral(literalExpr.getText());
    }

    private static EasyScriptNode parseIntLiteral(String text) {
        try {
            return new IntLiteralNode(Integer.parseInt(text));
        } catch (NumberFormatException e) {
            // it's possible that the integer literal is too big to fit in a 32-bit Java `int` -
            // in that case, fall back to a double literal
            return parseDoubleLiteral(text);
        }
    }

    private static DoubleLiteralNode parseDoubleLiteral(String text) {
        return new DoubleLiteralNode(Double.parseDouble(text));
    }
}
```

(`EasyScriptLexer` and `EasyScriptParser` are classes generated from the grammar by ANTLR,
in my case, at build time using the
[ANTLR Gradle plugin](https://docs.gradle.org/current/userguide/antlr_plugin.html))

With this in place,
we can write our first real EasyScript program! 

```java
public class ParsingTest {
    @Test
    public void parses_and_executes_EasyScript_code_correctly() {
        EasyScriptNode exprNode = EasyScriptTruffleParser.parse("1 + 2 + 3.0 + 4");
        var rootNode = new EasyScriptRootNode(exprNode);
        CallTarget callTarget = rootNode.getCallTarget();

        var result = callTarget.call();

        assertEquals(10.0, result);
    }
}
```

## GraalVM's polyglot API

One of the reasons that Truffle was created in the first place is to make GraalVM the best possible multi-language virtual machine environment.
The vision for GraalVM is to allow programmers to freely mix code between many languages in the same program,
taking the maxim of "use the best tool for the job" to the extreme.
The way all of these different languages can communicate with each other is GraalVM's polyglot API.

For example,
the Graal team maintains a
[JavaScript implementation](https://github.com/oracle/graaljs)
(it used to ship bundled with GraalVM,
but since version `22`, it's now a
[separate library](https://mvnrepository.com/artifact/org.graalvm.js/js)
that you have to depend on in your `build.gradle` or `pom.xml` file),
and we can write a simple unit test executing a JavaScript program straight from Java:

```java
import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.Value;
import org.junit.Test;
import static org.junit.Assert.assertEquals;

public class PolyglotTest {
    @Test
    public void runs_JavaScript_code_correctly() {
        Context context = Context.create();
        Value result = context.eval("js",
                "function sub13(x) { return x - 13; } sub13(25)");
        assertEquals(12, result.asInt());
    }
}
```

`Context` is the entrypoint to the polyglot API,
and we can use it to evaluate programs with different registered languages
(what GraalVM calls "guest languages").
`Value` is a general class that wraps the result of executing a language.
It can be as simple as a single integer,
or as complex as a function that you can invoke from Java,
or any other JVM-compatible language like
[Kotlin](https://kotlinlang.org),
[Scala](https://www.scala-lang.org)
or [Groovy](https://groovy-lang.org)
(what GraalVM often refers to as the "host language").

For more information,
check out the
[GraalVM polyglot documentation](https://www.graalvm.org/reference-manual/embed-languages).

### The `TruffleLanguage` class

We can register EasyScript as an implemented language,
similarly to the above JavaScript implementation,
by writing a class that extends the abstract `TruffleLanguage` class.
We need to override the `parse(ParsingRequest)`
method that contains the source code of the program we're called with,
and return from it the `CallTarget`
that represents the execution entrypoint of our language.

As a last step, we need to annotate our language class with the
`@TruffleLanguage. Registration` annotation,
providing it the unique identifier and the human-readable name of our language.
The identifier is what will be passed as the first argument to `Context.eval()`.

Here's how this class looks for EasyScript:

```java
import com.oracle.truffle.api.CallTarget;
import com.oracle.truffle.api.Truffle;
import com.oracle.truffle.api.TruffleLanguage;

@TruffleLanguage.Registration(id = "ezs", name = "EasyScript")
public final class EasyScriptTruffleLanguage extends TruffleLanguage<Void> {
    @Override
    protected CallTarget parse(ParsingRequest request) throws Exception {
        EasyScriptNode exprNode = EasyScriptTruffleParser.parse(request.getSource().getReader());
        var rootNode = new EasyScriptRootNode(exprNode);
        return rootNode.getCallTarget();
    }

    @Override
    protected Void createContext(Env env) {
        return null;
    }
}
```

(Don't worry about the `Void` usage here --
every `TruffleLanguage` is parametrized with a Context class,
but we don't need one yet,
so we're just using `Void` as a placeholder.
We'll write a custom class for the Context in later parts of the series.)

With this in place, we can evaluate EasyScript code the same way we did JavaScript earlier:

```java
import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.Value;
import org.junit.Test;
import static org.junit.Assert.assertEquals;

public class PolyglotTest {
    @Test
    public void runs_EasyScript_code() {
        Context context = Context.create();
        Value result = context.eval("ezs",
                "10 + 24 + 56.0");
        assertEquals(90.0, result.asDouble(), 0.0);
    }
}
```

### `TruffleLanguage` in `RootNode`

The `EasyScriptTruffleLanguage` class also solves a small mystery that you might have noticed in the previous parts of the series,
concerning our `RootNode` class.
As a reminder, it looks like this:

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
        return this.exprNode.executeGeneric(frame);
    }
}
```

That first argument in the `super()` call that we pass as `null` is of type `TruffleLanguage`,
which means we can modify `EasyScriptRootNode` to take an
`EasyScriptTruffleLanguage` in its constructor,
and pass that in the `super()` call.
Then, in the `parse(ParsingRequest)` method in the `EasyScriptTruffleLanguage`,
we can pass `this` to the `EasyScriptRootNode`
instance we use for the `CallTarget` we eventually return from that method.

## Summary

In this part of the series,
we've made EasyScript a fully-fledged language,
with a parser,
and a first-class citizen of the GraalVM polyglot ecosystem.

In the [next part of the series](/graal-truffle-tutorial-part-5-global-variables),
we will finally start making EasyScript look more like a real programming language --
we will add support for variables.

As always, all of the code in the article
[is available on GitHub](https://github.com/skinny85/graalvm-truffle-tutorial/tree/master/part-04).
