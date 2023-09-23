---
id: 70
layout: truffle-tutorial.html
title: Graal Truffle tutorial part 11 – strings, static method calls
summary: |
   In the eleventh part of the Truffle tutorial,
   we add support for strings to our language,
   including calling methods on them.
created_at: 2023-03-31
---

In the [previous part](/graal-truffle-tutorial-part-10-arrays-read-only-properties)
of the series,
we added support for arrays to EasyScript,
our simplified JavaScript implementation.
In this article, we handle the second important category of built-in objects: strings.

Adding support for strings introduces many interesting challenges to our interpreter:

1. Strings change the meaning of `+` in JavaScript,
   as it can now represent not only number addition, but also string concatenation --
   including converting non-string values to strings.
2. Strings have [many methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String#instance_methods)
   that are needed to make them truly useful --
   however, our language doesn't support methods currently,
   only functions.
3. Strings allow accessing properties of JavaScript objects with the array index syntax,
   in code such as `Math['abs']`.
4. Strings make GraalVM interop more complex,
   as that typically involves being called with Java strings,
   while internally, your language might use a different representation for strings than Java does.
5. Strings make not only `+`, but also several other JavaScript operations more complex:
   they can be indexed like arrays,
   they can be compared with arithmetic operators such as `>` like numbers, etc.

In this article, we will tackle all these challenges,
and show how to overcome them with Truffle.
We will add string support to the language,
and we'll demonstrate static
(meaning, without [inheritance](https://en.wikipedia.org/wiki/Inheritance_(object-oriented_programming&#41;))
method calls on the example of the
[`charAt()` string method](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/charAt).

## Parsing

As always, we start with the changes to the language's grammar.

This time, they are fairly minimal;
we just have to add a new case to our `literal` non-terminal:

```shell-session
// ...

literal : INT | DOUBLE | 'undefined' | bool_literal | string_literal ;

string_literal: SINGLE_QUOTE_STRING | DOUBLE_QUOTE_STRING ;
SINGLE_QUOTE_STRING : '\'' (~[\\'\r\n] | '\\' ~[\r\n])* '\'' ;
DOUBLE_QUOTE_STRING : '"'  (~[\\"\r\n] | '\\' ~[\r\n])* '"' ;
```

In JavaScript, string literals can start with either `'` or `"`,
and they can contain any character inside them --
except the starting one, backslash, and a newline
(backslash is used for escaping characters, including the starting one).

**Note**: in JavaScript, you can also create strings with backticks (`` ` ``),
and use [string interpolation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#syntax)
inside them.
We will skip implementing this feature,
as `` `${a}` `` can be transformed to `'' + a + ''` at parse time,
so supporting string interpolation doesn't require any changes to the interpreter
(it's just syntax sugar for concatenation) --
however, it does make parsing significantly more complicated.

In our parser, we need to handle the escape sequences,
so that character pairs like `\'` get simplified to just `'`:

```java
// ...
import org.apache.commons.text.StringEscapeUtils;

public final class EasyScriptTruffleParser {
    // ...

    private EasyScriptExprNode parseLiteralExpr(EasyScriptParser.LiteralExpr5Context literalExpr) {
        // ...
        EasyScriptParser.String_literalContext stringTerminal = literalExpr.literal().string_literal();
        if (stringTerminal != null) {
            String stringLiteral = stringTerminal.getText();
            return new StringLiteralExprNode(StringEscapeUtils.unescapeJson(
                    stringLiteral.substring(1, stringLiteral.length() - 1)));
        }
        // ...
    }
}
```

We use the [`StringEscapeUtils.unescapeJson()` method](https://commons.apache.org/proper/commons-text/apidocs/org/apache/commons/text/StringEscapeUtils.html#unescapeJson-java.lang.String-)
from the [Apache Commons Text library](https://commons.apache.org/proper/commons-text),
which we add as a dependency:

```groovy
dependencies {
    // ...
    implementation "org.apache.commons:commons-text:1.10.0"
}
```

You might be worried that adding a dependency on a library not meant for partial evaluation might negatively impact performance,
but since we're using it only at parse time, not runtime,
that's not an issue.

## String runtime representation

To represent strings at runtime in our interpreter,
we will use the
[`TruffleString` class](https://www.graalvm.org/latest/graalvm-as-a-platform/language-implementation-framework/TruffleStrings).
This is a dedicated type from the Truffle library that has special support in Graal,
and makes sure strings, and operations on them, are as efficient as possible.

So, our string literal Node simply needs to create an instance of this class:

```java
public final class StringLiteralExprNode extends EasyScriptExprNode {
    private final TruffleString value;

    public StringLiteralExprNode(String value) {
        this.value = EasyScriptTruffleStrings.fromJavaString(value);
    }

    @Override
    public boolean executeBool(VirtualFrame frame) {
        return !this.value.isEmpty();
    }

    @Override
    public TruffleString executeGeneric(VirtualFrame frame) {
        return this.value;
    }
}
```

When dealing with `TruffleString`s, you need to provide an encoding to most operations,
and, since you don't want to repeat what encoding your language uses in multiple places in your interpreter,
it's common to introduce a helper class
(which we call `EasyScriptTruffleStrings` here)
that contains simple, one-line helper methods:

```java
public final class EasyScriptTruffleStrings {
    private static final TruffleString.Encoding JAVA_SCRIPT_STRING_ENCODING = TruffleString.Encoding.UTF_16;

    public static TruffleString fromJavaString(String value) {
        return TruffleString.fromJavaStringUncached(value, JAVA_SCRIPT_STRING_ENCODING);
    }

    // ...
}
```

JavaScript uses UTF-16 as its encoding,
so we save that as a private constant in `EasyScriptTruffleStrings`.
We will add more methods to this class as we progress with the implementation.

## Expressions

Now that we have strings in the language,
we need to account for their presence in a few expression types.

The first one is the `executeBool()` method in the top-level `EasyScriptExprNode`,
as empty strings are considered falsy in JavaScript:

```java
@TypeSystemReference(EasyScriptTypeSystem.class)
public abstract class EasyScriptExprNode extends EasyScriptNode {
    public boolean executeBool(VirtualFrame frame) {
        Object value = this.executeGeneric(frame);
        if (value instanceof TruffleString) {
            return !((TruffleString) value).isEmpty();
        }
        // other cases here...
    }
    
    // ...
}
```

The second are the equality and inequality Nodes:
we have to add new specializations to them,
as strings can be compared with `===` and `!==` in JavaScript:

```java
public abstract class EqualityExprNode extends BinaryOperationExprNode {
    // ...
   
    @Specialization
    protected boolean stringEquality(TruffleString leftValue, TruffleString rightValue,
            @Cached TruffleString.EqualNode equalNode) {
        return EasyScriptTruffleStrings.equals(leftValue, rightValue, equalNode);
    }
    
    // ...
}

public final class EasyScriptTruffleStrings {
    private static final TruffleString.Encoding JAVA_SCRIPT_STRING_ENCODING = TruffleString.Encoding.UTF_16;

    public static boolean equals(TruffleString s1, TruffleString s2,
            TruffleString.EqualNode equalNode) {
        return equalNode.execute(s1, s2, JAVA_SCRIPT_STRING_ENCODING);
    }

    // ...
}
```

This shows a common pattern with `TruffleString`s:
you often don't call methods on them directly,
but instead, you get an instance of a specific operation's Node class using the `@Cached`
annotation in your specialization,
and then invoke the `execute()` method on that Node to perform the actual operation.

Inequality is virtually identical, just with a `!`
in front of the call to `EasyScriptTruffleStrings.equals()`.

We also need to update the comparison operators,
as it's legal to compare strings with `>`, `<=`, etc. in JavaScript.
We only show the Node for greater (`>`) -- the others are very similar:

```java
public abstract class GreaterExprNode extends BinaryOperationExprNode {
    // ...

    @Specialization
    protected boolean stringGreater(TruffleString leftValue, TruffleString rightValue,
            @Cached TruffleString.CompareCharsUTF16Node compareNode) {
        return compareNode.execute(leftValue, rightValue) > 0;
    }
    
    // ...
}
```

`CompareCharsUTF16Node` has the notion of an encoding already built into it,
so we don't need a new `EasyScriptTruffleStrings` helper in this case.

Finally, there's addition, which is the most complex expression when it comes to string handling.
The reason for the complexity is that `+` can mean either numeric addition, or string concatenation.
The way the JavaScript runtime chooses between the two is by the arguments passed.
If at least one argument is a complex value
(meaning a function, array, string, or object --
basically everything except numbers, booleans, and `undefined`
(and `null`, but we don't support that one in EasyScript yet),
which are considered primitives),
then the operation will be concatenation,
converting both arguments to strings first if they are not strings already;
otherwise, meaning both arguments are primitives,
numeric addition will be performed instead
(if one of the primitive arguments is not a number, `NaN` will be returned).

For performance, we will introduce a separate, "fast" specialization
in case both arguments are `TruffleString`s,
similarly like we have a specialization for integer addition:

```java
public abstract class AdditionExprNode extends BinaryOperationExprNode {
    // ...

    @Specialization
    protected TruffleString concatenateTruffleStrings(TruffleString leftValue, TruffleString rightValue,
            @Cached TruffleString.ConcatNode concatNode) {
        return EasyScriptTruffleStrings.concat(leftValue, rightValue, concatNode);
    }

   // ...
}

public final class EasyScriptTruffleStrings {
    private static final TruffleString.Encoding JAVA_SCRIPT_STRING_ENCODING = TruffleString.Encoding.UTF_16;
   
    public static TruffleString concat(TruffleString s1, TruffleString s2, TruffleString.ConcatNode concatNode) {
        return concatNode.execute(s1, s2, JAVA_SCRIPT_STRING_ENCODING, true);
    }

    // ...
}
```

That last argument to `TruffleString.ConcatNode.execute()` is whether to make the result string lazy,
which means it won't be allocated unless used explicitly used in an operation like taking a substring.
Setting it is usually beneficial for performance.

Of course, you might want to introduce more "fast"
specializations like this if your language uses `+` for string concatenation;
for example, the Graal JavaScript implementation has a total of
[15 specializations for addition](https://github.com/oracle/graaljs/blob/86a8fc4767963fc4e8d30085865ac53460a20210/graal-js/src/com.oracle.truffle.js/src/com/oracle/truffle/js/nodes/binary/JSAddNode.java#L124-L242)!

And finally, we need to write a generic specialization that coerces its arguments to strings,
and then concatenates them:

```java
public abstract class AdditionExprNode extends BinaryOperationExprNode {
    // ...

    @Specialization(guards = "isComplex(leftValue) || isComplex(rightValue)")
    protected TruffleString concatenateComplexAsStrings(Object leftValue, Object rightValue,
            @Cached TruffleString.FromJavaStringNode fromJavaStringNode) {
        return EasyScriptTruffleStrings.fromJavaString(
                EasyScriptTruffleStrings.concatToStrings(leftValue, rightValue),
                fromJavaStringNode);
    }

    protected static boolean isComplex(Object value) {
        return !isPrimitive(value);
    }

    private static boolean isPrimitive(Object value) {
        return EasyScriptTypeSystemGen.isImplicitDouble(value) ||
                EasyScriptTypeSystemGen.isBoolean(value) ||
                value == Undefined.INSTANCE;
    }

    // ...
}

public final class EasyScriptTruffleStrings {
    private static final TruffleString.Encoding JAVA_SCRIPT_STRING_ENCODING = TruffleString.Encoding.UTF_16;

    public static TruffleString fromJavaString(String value, TruffleString.FromJavaStringNode fromJavaStringNode) {
        return fromJavaStringNode.execute(value, JAVA_SCRIPT_STRING_ENCODING);
    }

    @TruffleBoundary
    public static String concatToStrings(Object o1, Object o2) {
        return o1.toString() + o2.toString();
    }

    // ...
}
```

The new Truffle element here is the `@TruffleBoundary` annotation.
Like we explained in the [previous article](/graal-truffle-tutorial-part-10-arrays-read-only-properties#array-index-read-expression)
of the series,
virtual method calls, like the two `toString()` ones in the code above,
are problematic for Graal's partial evaluation.
The `@TruffleBoundary` annotation allows you to hint to Graal that it should stop partial evaluation at this method,
and instead rely only on regular Java optimizations to make it faster.

## Method calls

Now that we handle strings in expressions,
we want to add support for calling methods on them.

On a fundamental level, method calls are the same as function calls that we've been using since
[part 6](/graal-truffle-tutorial-part-6-static-function-calls).
The only difference between the two is that methods need an extra first argument,
which is the object (in our case, a string)
that the method is called on.

So, we need to make a small change to function calls,
so that, when encountering a method inovcation such as `s.m(a1, a2)`,
our interpreter knows to prepend `s` to the two method arguments, `a1` and `a2`,
and pass a total of three arguments to `m`.

We will store this method call target as a new field of the `FunctionObject` class.
It will be `null` for function calls,
but non-`null` for method calls:

```java
@ExportLibrary(InteropLibrary.class)
public final class FunctionObject implements TruffleObject {
    public final CallTarget callTarget;
    public final int argumentCount;
    public final Object methodTarget;
    private final FunctionDispatchNode functionDispatchNode;

    public FunctionObject(CallTarget callTarget, int argumentCount) {
        this(callTarget, argumentCount, null);
    }

    public FunctionObject(CallTarget callTarget, int argumentCount,
            Object methodTarget) {
        this.callTarget = callTarget;
        this.argumentCount = argumentCount;
        this.methodTarget = methodTarget;
        this.functionDispatchNode = FunctionDispatchNodeGen.create();
    }

    // ...
}
```

This means we need to modify the function dispatch code slightly.
Previously, we had to alter the provided arguments before performing the call only if the function was called with fewer arguments than it declared
(in which case, we extended the arguments  with `undefined`s until their number reached the amount of function arguments);
but now, we have to alter the arguments any time the `FunctionObject`
has a non-`null` method target
(in which case we insert it as the first argument,
and offset the original arguments by one to the right):

```java
public abstract class FunctionDispatchNode extends Node {
    // ...

    private static Object[] extendArguments(Object[] arguments, FunctionObject function) {
        if (arguments.length >= function.argumentCount && function.methodTarget == null) {
            return arguments;
        }
        Object[] ret = new Object[function.argumentCount];
        for (int i = 0; i < function.argumentCount; i++) {
            int j;
            if (function.methodTarget == null) {
                j = i;
            } else {
                if (i == 0) {
                    ret[0] = function.methodTarget;
                    continue;
                } else {
                    j = i - 1;
                }
            }
            ret[i] = j < arguments.length ? arguments[j] : Undefined.INSTANCE;
        }
        return ret;
    }
}
```

## Method implementation

The actual implementation of the `charAt` method is very similar to our built-in functions.
Its expression Node extends `BuiltInFunctionBodyExprNode`,
and uses specializations for performance.
The only difference is the extra first argument,
which represents the string that is the target of the method call,
which we name `self`:

```java
public abstract class CharAtMethodBodyExprNode extends BuiltInFunctionBodyExprNode {
    @Specialization
    protected TruffleString charAtInt(TruffleString self, int index,
            @Cached @Shared("lengthNode") TruffleString.CodePointLengthNode lengthNode,
            @Cached @Shared("substringNode") TruffleString.SubstringNode substringNode) {
        return index < 0 || index >= EasyScriptTruffleStrings.length(self, lengthNode)
            ? EasyScriptTruffleStrings.EMPTY
            : EasyScriptTruffleStrings.substring(self, index, 1, substringNode);
    }

    @Fallback
    protected TruffleString charAtNonInt(Object self,
            @SuppressWarnings("unused") Object nonIntIndex,
            @Cached @Shared("lengthNode") TruffleString.CodePointLengthNode lengthNode,
            @Cached @Shared("substringNode") TruffleString.SubstringNode substringNode) {
        // we know that 'self' is for sure a TruffleString
        // because of how we implement reading string properties below,
        // but we need to declare it as Object here because of @Fallback
        return this.charAtInt((TruffleString) self, 0, lengthNode, substringNode);
    }
}

public final class EasyScriptTruffleStrings {
    private static final TruffleString.Encoding JAVA_SCRIPT_STRING_ENCODING =
            TruffleString.Encoding.UTF_16;
    public static final TruffleString EMPTY = JAVA_SCRIPT_STRING_ENCODING.getEmpty();

    public static int length(TruffleString truffleString, TruffleString.CodePointLengthNode lengthNode) {
        return lengthNode.execute(truffleString, JAVA_SCRIPT_STRING_ENCODING);
    }

    public static TruffleString substring(TruffleString truffleString, int index, int length,
            TruffleString.SubstringNode substringNode) {
        return substringNode.execute(truffleString, index, length, JAVA_SCRIPT_STRING_ENCODING, true);
    }

    // ...
}
```

The second specialization is needed,
because if `charAt()` is called with its argument not provided,
or not a number, it should default the argument to `0`.

There's one new Truffle element in this implementation:
the `@Shared` annotation, which allows sharing the same objects between multiple specializations.
It's often used for `TruffleString` Nodes,
as they are stateless.

Similarly to built-in functions,
the `CallTarget`s for this built-in method is created in `TruffleLanguage`
when instantiating a new Context object:

```java
@TruffleLanguage.Registration(id = "ezs", name = "EasyScript")
public final class EasyScriptTruffleLanguage extends TruffleLanguage<EasyScriptLanguageContext> {
    // ...

    @Override
    protected EasyScriptLanguageContext createContext(Env env) {
        var context = new EasyScriptLanguageContext(this.globalScopeShape, this.createStringPrototype());
        var globalScopeObject = context.globalScopeObject;

        var objectLibrary = DynamicObjectLibrary.getUncached();
        objectLibrary.putConstant(globalScopeObject, "Math", MathObject.create(this,
            this.defineBuiltInFunction(AbsFunctionBodyExprNodeFactory.getInstance()),
            this.defineBuiltInFunction(PowFunctionBodyExprNodeFactory.getInstance())), 1);

        return context;
    }

    private StringPrototype createStringPrototype() {
        return new StringPrototype(
                this.createCallTarget(CharAtMethodBodyExprNodeFactory.getInstance()));
    }

    private FunctionObject defineBuiltInFunction(NodeFactory<? extends BuiltInFunctionBodyExprNode> nodeFactory) {
        return new FunctionObject(this.createCallTarget(nodeFactory),
                nodeFactory.getExecutionSignature().size());
    }

    private CallTarget createCallTarget(NodeFactory<? extends BuiltInFunctionBodyExprNode> nodeFactory) {
        int argumentCount = nodeFactory.getExecutionSignature().size();
        ReadFunctionArgExprNode[] functionArguments = IntStream.range(0, argumentCount)
                .mapToObj(i -> new ReadFunctionArgExprNode(i))
                .toArray(ReadFunctionArgExprNode[]::new);
        var rootNode = new BuiltInFuncRootNode(this,
                nodeFactory.createNode((Object) functionArguments));
        return rootNode.getCallTarget();
    }
}
```

`StringPrototype` is a very simple Java class that,
in our version, holds a single `CallTarget`
(of course, feel free to add more string methods to it in your own implementation):

```java
public final class StringPrototype {
    public final CallTarget charAtMethod;

    public StringPrototype(CallTarget charAtMethod) {
        this.charAtMethod = charAtMethod;
    }
}
```

It's stored as the second field of the EasyScript TruffleLanguage Context:

```java
public final class EasyScriptLanguageContext {
    // ...

    public final DynamicObject globalScopeObject;
    public final StringPrototype stringPrototype;

    public EasyScriptLanguageContext(Shape globalScopeShape, StringPrototype stringPrototype) {
        this.globalScopeObject = new GlobalScopeObject(globalScopeShape);
        this.stringPrototype = stringPrototype;
    }
}
```

We will use that field below to implement reading the `charAt` property of `TruffleString`.

## Reading properties of `TruffleString`

Now that we have the implementation of `charAt()`,
we need to wire it up so that the correct `FunctionObject`
is returned when accessing the `charAt`
property of EasyScript strings.

In the [previous article about arrays](/graal-truffle-tutorial-part-10-arrays-read-only-properties),
we introduced a dedicated dynamic object, the class `ArrayObject`,
that contained the logic of storing and retrieving array properties.
However, since we're using `TruffleString`s for representing strings, 
we don't want to wrap them in a separate dynamic object,
as that would negate the performance benefits of using `TruffleString`s.

Instead, we will create a dedicated Node class that contains the logic of reading properties of strings,
and which operates on `TruffleString`:

```java
public abstract class ReadTruffleStringPropertyNode extends EasyScriptNode {
    public abstract Object executeReadTruffleStringProperty(TruffleString truffleString, Object property);

    // ...
}
```

Similarly like `FunctionDispatchNode` from
[part 6](/graal-truffle-tutorial-part-6-static-function-calls#functiondispatchnode),
we make this Node separate from our expression Node hierarchy,
which allows us to define a dedicated `execute*()` method for it,
which takes a `TruffleString`, and then a property.

We have multiple specializations on that property argument.
The first one is for when it's an integer,
in which case we are indexing into the string,
in an expression like `"abc"[1]`,
which should return a one-element substring of the original string
(unless the index is out of range, in which case it should return `undefined`):

```java
public abstract class ReadTruffleStringPropertyNode extends EasyScriptNode {
    // ...
   
    @Specialization
    protected Object readStringIndex(
                TruffleString truffleString, int index,
                @Cached TruffleString.CodePointLengthNode lengthNode,
                @Cached TruffleString.SubstringNode substringNode) {
        return index < 0 || index >= EasyScriptTruffleStrings.length(truffleString, lengthNode)
                ? Undefined.INSTANCE
                : EasyScriptTruffleStrings.substring(truffleString, index, 1, substringNode);
    }
    
    // ...
}
```

The second specializations is for reading the `length` property of the string.
Since the Truffle DSL doesn't allow using string literals in `guards` expressions,
we have to introduce a constant for the name of the property,
and the constant needs to be `protected`,
as it will be read by the subclass generated by the Truffle DSL:

```java
public abstract class ReadTruffleStringPropertyNode extends EasyScriptNode {
    protected static final String LENGTH_PROP = "length";

    // ...

    @Specialization(guards = "LENGTH_PROP.equals(propertyName)")
    protected int readLengthProperty(
            TruffleString truffleString,
            @SuppressWarnings("unused") String propertyName,
            @Cached TruffleString.CodePointLengthNode lengthNode) {
        return EasyScriptTruffleStrings.length(truffleString, lengthNode);
    }

    // ...
}
```

Similarly, we introduce a specialization for reading the `charAt` property.
Here, we finally use the `StringPrototype` object that we added to the Context in `EasyScriptTruffleLanguage`,
and create a new `FunctionObject` with the string whose property is being read as the method target.

Creating a new `FunctionObject` each time the property is accessed would be slow,
so we cache it -- but, that means we have to make sure,
in the guard expression, that the target of the property read has not changed:

```java
@ImportStatic(EasyScriptTruffleStrings.class)
public abstract class ReadTruffleStringPropertyNode extends EasyScriptNode {
    protected static final String CHAR_AT_PROP = "charAt";

    // ...

    @Specialization(guards = {
            "CHAR_AT_PROP.equals(propertyName)",
            "same(charAtMethod.methodTarget, truffleString)"
    })
    protected FunctionObject readCharAtPropertyCached(
            @SuppressWarnings("unused") TruffleString truffleString,
            @SuppressWarnings("unused") String propertyName,
            @Cached("createCharAtMethodObject(truffleString)") FunctionObject charAtMethod) {
        return charAtMethod;
    }

    protected FunctionObject createCharAtMethodObject(TruffleString truffleString) {
        return new FunctionObject(currentLanguageContext().stringPrototype.charAtMethod, 2, truffleString);
    }

    // ..
}

public final class EasyScriptTruffleStrings {
    // ...

    public static boolean same(Object o1, Object o2) {
        return o1 == o2;
    }
}
```

We take advantage of the fact that you can provide multiple expressions to the `guards`
attribute of `@Specialization`,
and they will be combined with the "and" logical operator.

We need the `same()` helper in `EasyScriptTruffleStrings`,
as the Truffle DSL won't allow comparing two objects of different classes for identity otherwise.
We use the `@ImportStatic` annotation,
which we've already seen in
[previous parts](/graal-truffle-tutorial-part-7-function-definitions#parsing-a-block-of-statements)
of the series,
to get a reference to `same()` in the scope of the guard expressions.

Like we [mentioned in part 6](/graal-truffle-tutorial-part-6-static-function-calls#functiondispatchnode),
specializations have a default limit of 3 instantiations.
In our case, this means we can encounter at most 3 string instances for which we cache their `FunctionObject`.
If the given property access sees more than 3 string targets,
then we need to switch to a specialization that doesn't use caching:

```java
public abstract class ReadTruffleStringPropertyNode extends EasyScriptNode {
    // ...
    
    @Specialization(guards = "CHAR_AT_PROP.equals(propertyName)",
            replaces = "readCharAtPropertyCached")
    protected FunctionObject readCharAtPropertyUncached(
            TruffleString truffleString,
            @SuppressWarnings("unused") String propertyName) {
        return createCharAtMethodObject(truffleString);
    }

    protected FunctionObject createCharAtMethodObject(TruffleString truffleString) {
        return new FunctionObject(currentLanguageContext().stringPrototype.charAtMethod, 2, truffleString);
    }

    // ...
}
```

**Note**: JavaScript's method property access is incredibly complex --
for more details on exactly how complex,
see [this StackOverflow answer](https://stackoverflow.com/a/40354923/10787899).
This not only complicates the implementation,
but leads to non-intuitive behavior,
like `("a".charAt)(0)` returning `"a"`,
but `("a".charAt || true)(0)`,
which should be equivalent,
to fail with the message `String.prototype.charAt called on null or undefined`,
which is surprising.
Since I can't imagine anyone wanting to create a new language with this behavior,
we will simplify, and always return a `FunctonObject`
bound to a specific target for property access in EasyScript.

And finally, we need a catch-all specialization for all properties besides
`length` and `charAt` that we might be called with,
for which we should just return `undefined`:

```java
public abstract class ReadTruffleStringPropertyNode extends EasyScriptNode {
    // ...

    @Fallback
    protected Undefined readUnknownProperty(
            @SuppressWarnings("unused") TruffleString truffleString,
            @SuppressWarnings("unused") Object property) {
        return Undefined.INSTANCE;
    }
}
```

As usual, for a specialization that takes an `Object` as an argument,
but is still meant to activate other specializations in subsequent executions if needed,
we have to use the `@Fallback` annotation instead of `@Specialization`.

## Handling strings in property access

Now that we have the new Node for reading `TruffleString` properties,
we can use it in our existing Nodes that implement property access.

The first place is in the direct property access expression Node,
which handles code like `a.propName`:

```java
@NodeChild("target")
@NodeField(name = "propertyName", type = String.class)
public abstract class PropertyReadExprNode extends EasyScriptExprNode {
    protected abstract String getPropertyName();

    @Specialization
    protected Object readPropertyOfString(TruffleString target,
            @Cached ReadTruffleStringPropertyNode readStringPropertyNode) {
        return readStringPropertyNode.executeReadTruffleStringProperty(
                target, this.getPropertyName());
    }

    // ...
}
```

We add a specialization for when the target of the property read is a `TruffleString` --
we delegate to our newly created `ReadTruffleStringPropertyNode`,
whose instance we get through the `@Cached` annotation
(you might be curious why that works,
since we never defined a `create()`
static factory method in `ReadTruffleStringPropertyNode`,
which `@Cached` uses by default --
but, the Truffle DSL did, in the `ReadTruffleStringPropertyNodeGen` class it generated,
and `@Cached` is clever enough to find it).

The second place we need to change is the array index read expression,
used to implement code such as `a['propName']`,
since in JavaScript, that is equivalent to `a.propName`:

```java
@NodeChild("arrayExpr")
@NodeChild("indexExpr")
public abstract class ArrayIndexReadExprNode extends EasyScriptExprNode {
    @Specialization(limit = "1", guards = "indexInteropLibrary.isString(index)")
    protected Object readStringPropertyOfString(TruffleString target,
            Object index,
            @CachedLibrary("index") InteropLibrary indexInteropLibrary,
            @Cached ReadTruffleStringPropertyNode readStringPropertyNode) {
        try {
            return readStringPropertyNode.executeReadTruffleStringProperty(target,
                    indexInteropLibrary.asString(index));
        } catch (UnsupportedMessageException e) {
            throw new EasyScriptException(this, e.getMessage());
        }
    }

    @Specialization
    protected Object readPropertyOfString(TruffleString target, Object index,
            @Cached ReadTruffleStringPropertyNode readStringPropertyNode) {
        return readStringPropertyNode.executeReadTruffleStringProperty(target,
                index);
    }

    // ...
}
```

We add two specializations for the target of the index expression being a `TruffleString`.
The first one covers the situation when the index is a string itself;
we use the `InteropLibrary.isString()` message to check for that,
which allows us to support indexing not only with `TruffleString`s,
but also with Java strings being passed through GraalVM interop
(even though `TruffleString` is not a `TruffleObject`,
`InteropLibrary.isString()` returns `true` for it).
We convert the property into a Java string, which is what `ReadTruffleStringPropertyNode` expects.
The second specialization is for other, non-string indexes, like integers
(in code like `"abc"[2]`).
In that case, we just call `executeReadTruffleStringProperty()` directly --
we don't have to do any conversions.

And finally, we need to add one more specialization to `ArrayIndexReadExprNode`,
and that is for reading properties of non-`TruffleString` objects,
in code like `[1, 2, 3]['length']`:

```java
@NodeChild("arrayExpr")
@NodeChild("indexExpr")
public abstract class ArrayIndexReadExprNode extends EasyScriptExprNode {
    // ...

    @Specialization(guards = {
            "targetInteropLibrary.hasMembers(target)",
            "propertyNameInteropLibrary.isString(propertyName)"
    }, limit = "1")
    protected Object readProperty(Object target, Object propertyName,
            @CachedLibrary("target") InteropLibrary targetInteropLibrary,
            @CachedLibrary("propertyName") InteropLibrary propertyNameInteropLibrary) {
        try {
            return targetInteropLibrary.readMember(target,
                    propertyNameInteropLibrary.asString(propertyName));
        } catch (UnknownIdentifierException e) {
            return Undefined.INSTANCE;
        } catch (UnsupportedMessageException e) {
            throw new EasyScriptException(this, e.getMessage());
        }
    }

    // ...
}
```

Similarly to what we did in the specializations for `TruffleString`s,
we convert the property name into a Java string,
but then, instead  of delegating to the new `ReadTruffleStringPropertyNode`,
we use the `readMember()` message from the `InteropLibrary`,
like we did in the [previous part](/graal-truffle-tutorial-part-10-arrays-read-only-properties#adding-the-length-property)
of the series.

## Benchmark

With all of this in place,
we can write a simple synthetic benchmark that counts in a loop,
using string operations,
for a million iterations.
We'll run it for EasyScript,
and for the GraalVM JavaScript implementation:

```java
public class StringLengthBenchmark extends TruffleBenchmark {
    private static final int INPUT = 1_000_000;

    @Override
    public void setup() {
        super.setup();

        this.truffleContext.eval("ezs", COUNT_WHILE_CHAR_AT_DIRECT_PROP);
        this.truffleContext.eval("js", COUNT_WHILE_CHAR_AT_DIRECT_PROP);

        this.truffleContext.eval("ezs", COUNT_WHILE_CHAR_AT_INDEX_PROP);
        this.truffleContext.eval("js", COUNT_WHILE_CHAR_AT_INDEX_PROP);
    }

    private static final String COUNT_WHILE_CHAR_AT_DIRECT_PROP = "" +
            "function countWhileCharAtDirectProp(n) { " +
            "    var ret = 0; " +
            "    while (n > 0) { " +
            "        n = n - ('a'.charAt(0) + ''.charAt()).length; " +
            "        ret = ret + 1; " +
            "    } " +
            "    return ret; " +
            "}";

    @Benchmark
    public int count_while_char_at_direct_prop_ezs() {
        return this.truffleContext.eval("ezs", "countWhileCharAtDirectProp(" + INPUT + ");").asInt();
    }

    @Benchmark
    public int count_while_char_at_direct_prop_js() {
        return this.truffleContext.eval("js", "countWhileCharAtDirectProp(" + INPUT + ");").asInt();
    }

    private static final String COUNT_WHILE_CHAR_AT_INDEX_PROP = "" +
            "function countWhileCharAtIndexProp(n) { " +
            "    var ret = 0; " +
            "    while (n > 0) { " +
            "        n = n - ('a'['charAt'](0) + ''['charAt']())['length']; " +
            "        ret = ret + 1; " +
            "    } " +
            "    return ret; " +
            "}";

    @Benchmark
    public int count_while_char_at_index_prop_ezs() {
        return this.truffleContext.eval("ezs", "countWhileCharAtIndexProp(" + INPUT + ");").asInt();
    }

    @Benchmark
    public int count_while_char_at_index_prop_js() {
        return this.truffleContext.eval("js", "countWhileCharAtIndexProp(" + INPUT + ");").asInt();
    }
}
```

We have two variants of the benchmark --
one accessing string properties directly,
in expressions like `s.charAt`,
and the other with array indexing, like `s['charAt']`.

Let's see if there's a difference between the two:

```shell-session
Benchmark                                                  Mode  Cnt       Score      Error  Units
StringLengthBenchmark.count_while_char_at_direct_prop_ezs  avgt    5     561.843 ±   21.548  us/op
StringLengthBenchmark.count_while_char_at_direct_prop_js   avgt    5     562.462 ±   22.676  us/op
StringLengthBenchmark.count_while_char_at_index_prop_ezs   avgt    5   11768.628 ± 5860.201  us/op
StringLengthBenchmark.count_while_char_at_index_prop_js    avgt    5  112616.532 ± 3718.521  us/op
```

We can see that the results for the "direct property access" variant are pretty much identical between
EasyScript and the GraalVM JavaScript implementation, which is great news --
that means our implementation is very likely close to optimal.

The results for the "index property access" variant, however, are surprising.
Apparently, converting from `TruffleString`s to Java strings in `ArrayIndexReadExprNode`
is incurring a 20x performance degradation.
The situation is even worse with the GraalVM JavaScript implementation,
which is 200 times slower when accessing properties through indexes than directly.
I assume this is a bug in the implementation.

**Update**: I've [opened an issue](https://github.com/oracle/graaljs/issues/719)
to the Graal JS project, and I was right --
the bug has been fixed, and will be released in version `23.1.0`
of the GraalVM JavaScript implementation.

### Code variants

I've done a few experiments where I've changed the implementation of `ReadTruffleStringPropertyNode`
to directly handle property names as `TruffleString`s,
without having to convert them to Java strings first.
That increases the amount of code significantly,
as the specializations for each property name have to basically be written twice --
once expecting a Java string, and once a `TruffleString`.
However, that duplication offers a 10x speedup in the "index property access" variant of the benchmark,
making it only 2x slower than the "direct property access" variant.
If you can live with the duplication, that's one way to improve performance --
as often happens, making code faster also makes it uglier.

I've also tried switching completely to `TruffleString`s for property access,
instead of Java strings.
That gets rid of the duplication in the implementation,
and results in both variants reporting identical performance, which is good --
unfortunately, that performance is the same as the "index property access"
variant with the `TruffleString`s handling changes from above,
so 2x slower than the "direct property access" implementation shown here.

As often happens, different implementation decisions lead to different performance tradeoffs --
hopefully, this gives you enough information to make an informed decision when implementing your own language.

## Summary

So, that's how you implement strings and methods in Truffle languages.

As usual, all code from the article is
[available on GitHub](https://github.com/skinny85/graalvm-truffle-tutorial/tree/master/part-11).

In the [next part of the series](/graal-truffle-tutorial-part-12-classes-1-methods-new),
we will start adding support for classes to our language --
beginning with class declarations, methods, and the `new` operator.
