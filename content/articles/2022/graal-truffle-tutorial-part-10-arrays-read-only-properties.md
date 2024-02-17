---
id: 68
layout: truffle-tutorial.html
title: Graal Truffle tutorial part 10 – arrays, read-only properties
summary: |
   In the tenth part of the Truffle tutorial,
   we add support for arrays and read-only properties to EasyScript.
   To implement these features,
   we will need to use a few aspects of Truffle that we haven't encountered before:
   shapes, libraries, and both static and dynamic objects.
created_at: 2022-12-27
---

With the features we added to EasyScript in
[part 8](/graal-truffle-tutorial-part-8-conditionals-loops-control-flow),
users of our language can write programs that perform calculations on a set amount of numbers,
like [factorials](https://en.wikipedia.org/wiki/Factorial),
or the [Fibonacci sequence](https://en.wikipedia.org/wiki/Fibonacci_number)
that we used for the benchmark in
[part 9](/graal-truffle-tutorial-part-9-performance-benchmarking).
But, it's not possible to write a function that operates on a dynamic amount of numbers,
like [sorting](https://en.wikipedia.org/wiki/Sorting_algorithm) -
for that, we need to add arrays to the language, and with arrays,
the code will need to read their `length` property to know how many elements they contain,
which means we will have to add reading properties to EasyScript.

In order to implement these features,
we will need to dive into a few areas of Truffle that we before either just skimmed over,
or haven't seen at all:
shapes (static and dynamic), libraries, and objects
(like shapes, both in their static and dynamic variants).

## Array expressions in the grammar

As always, we start with the changes in the language's grammar.
We will need 3 new types of expressions:

1. Array literals, like `[1, 2, 3]`.
2. Reading an array index, like `arr[1]`.
3. Writing to an array index, like `arr[0] = 5`.

Here they are in the [ANTLR](https://www.antlr.org) grammar:

```shell-session
expr1 : arr=expr5 '[' index=expr1 ']' '=' rvalue=expr1 #ArrayIndexWriteExpr1
      ...
expr5 : '[' (expr1 (',' expr1)*)? ']'                  #ArrayLiteralExpr5
      | arr=expr5 '[' index=expr1 ']'                  #ArrayIndexReadExpr5
      ...
```

Let's go through their implementations in turn.

## Array literal expression

The literal expression for arrays is pretty similar to the call Node from
[part 6](/graal-truffle-tutorial-part-6-static-function-calls#call-expression-node):

```java
public final class ArrayLiteralExprNode extends EasyScriptExprNode {
    private final Shape arrayShape;
    @Children
    private final EasyScriptExprNode[] arrayElementExprs;

    public ArrayLiteralExprNode(Shape arrayShape, List<EasyScriptExprNode> arrayElementExprs) {
        this.arrayShape = arrayShape;
        this.arrayElementExprs = arrayElementExprs.toArray(new EasyScriptExprNode[]{});
    }

    @Override
    @ExplodeLoop
    public Object executeGeneric(VirtualFrame frame) {
        Object[] arrayElements = new Object[this.arrayElementExprs.length];
        for (var i = 0; i < this.arrayElementExprs.length; i++) {
            arrayElements[i] = this.arrayElementExprs[i].executeGeneric(frame);
        }
        return new ArrayObject(this.arrayShape, arrayElements);
    }
}
```

Since we know that `ArrayObject` will have a `length` property
(we implement it below),
we make it not only a `TruffleObject`,
but we use a dedicated class for that purpose from Truffle,
[`DynamicObject`, which implements `TruffleObject`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/object/DynamicObject.html):

```java
@ExportLibrary(InteropLibrary.class)
public final class ArrayObject extends DynamicObject {
    private Object[] arrayElements;

    public ArrayObject(Shape arrayShape, Object[] arrayElements) {
        super(arrayShape);
        this.arrayElements = arrayElements;
    }

    @ExportMessage
    boolean hasArrayElements() {
        return true;
    }

    @ExportMessage
    long getArraySize() {
        return this.arrayElements.length;
    }

    // ...
}
```

You might reasonably ask -- do we really need `DynamicObject` here,
given that we're only planning to add support for the `length`
property of arrays in this part of the series,
which doesn't sound too dynamic?
And while that is true,
we know that we'll need to allow writing arbitrary properties to arrays at some point,
in code like `arr.myProp = myValue;`,
as JavaScript allows that;
in addition, we're going to use the static equivalent of `DynamicObject`,
[Truffle's `StaticObject`](https://www.graalvm.org/latest/graalvm-as-a-platform/language-implementation-framework/StaticObjectModel),
for something different in this part of the series
(the `Math` object -- see below),
so `DynamicObject` for arrays makes sense.

The `Shape` class is another important Truffle concept.
It allows generating low-level code for dynamic objects that makes them as efficient as static objects,
provided the shape doesn't change after the machine code is generated
(which often turns out to be true in typical programs).
[This blog post](https://mrale.ph/blog/2015/01/11/whats-up-with-monomorphism.html)
by Vyacheslav Egorov from the Chrome V8 team
(which I already linked to in
[part 2](/graal-truffle-tutorial-part-2-introduction-to-specializations#specialization-states)
of the series)
does a great job explaining what shapes
(also sometimes called *hidden classes*) are,
and why they are so crucial in making dynamically-typed languages like JavaScript fast.

But where does the `Shape` instance come from?
According to the [Truffle docs on the subject](https://www.graalvm.org/latest/graalvm-as-a-platform/language-implementation-framework/DynamicObjectModel#getting-started),
an instance of `Shape` should be created by calling `build()`
on the builder returned by the static `newBuilder()` method,
and cached as a field in the instance of `TruffleLanguage`:

```java
@TruffleLanguage.Registration(id = "ezs", name = "EasyScript")
public final class EasyScriptTruffleLanguage extends
        TruffleLanguage<EasyScriptLanguageContext> {
    // ...

    private final Shape arrayShape = Shape.newBuilder().build();

    @Override
    protected CallTarget parse(ParsingRequest request) throws Exception {
        ParsingResult parsingResult = EasyScriptTruffleParser.parse(
                request.getSource().getReader(), this.arrayShape);
        var programRootNode = new StmtBlockRootNode(this, parsingResult.topLevelFrameDescriptor,
                parsingResult.programStmtBlock);
        return programRootNode.getCallTarget();
    }
}
```

We then pass that `Shape` for arrays into the parser:

```java
public final class EasyScriptTruffleParser {
    public static ParsingResult parse(Reader program, Shape arrayShape) throws IOException {
        var lexer = new EasyScriptLexer(CharStreams.fromReader(program));
        // remove the default console error listener
        lexer.removeErrorListeners();
        var parser = new EasyScriptParser(new CommonTokenStream(lexer));
        // remove the default console error listener
        parser.removeErrorListeners();
        // throw an exception when a parsing error is encountered
        parser.setErrorHandler(new BailErrorStrategy());
        var easyScriptTruffleParser = new EasyScriptTruffleParser(arrayShape);
        List<EasyScriptStmtNode> stmts = easyScriptTruffleParser.parseStmtsList(parser.start().stmt());
        return new ParsingResult(
                new BlockStmtNode(stmts),
                easyScriptTruffleParser.frameDescriptor.build());
    }

    private final Shape arrayShape;

    // ...

    private ArrayLiteralExprNode parseArrayExpr(EasyScriptParser.ArrayExpr5Context arrayExpr) {
        return new ArrayLiteralExprNode(this.arrayShape, arrayExpr.expr1().stream()
                .map(arrayElExpr -> this.parseExpr1(arrayElExpr))
                .collect(Collectors.toList()));
    }
}
```

Which saves it as a field,
and passes it down to `ArrayLiteralExprNode` when parsing an array literal expression.

## Array index read expression

Now, we want to implement reading a given array index.
The obvious way to implement it would be to write a specialization that expects the left side of the expression to evaluate to an `ArrayObject`,
and then call some method on it, like `readElement()`,
passing it the result of evaluating the index expression.
But there are a few issues with that approach.

First, that would tie the implementation of this node to a single array representation.
While we won't do that in this part of the series,
it makes sense from a performance perspective for our interpreter to have multiple different ways to represent arrays --
for example, an array of functions and an array of integers should have different runtime representations
(also, JavaScript has this weird thing called
[sparse arrays](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Indexed_collections#sparse_arrays),
and it's very likely their representation needs to be different than "normal" arrays).
And we don't want to write a separate specialization method for each of those representations,
because then adding a new representation would automatically mean having to add a new specialization,
which violates the [DRY principle](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself),
not to mention that there can be a _lot_ of representations --
for example, the JavaScript Truffle interpreter maintained by the Graal team
[has over 20 array representations](https://github.com/oracle/graaljs/tree/master/graal-js/src/com.oracle.truffle.js/src/com/oracle/truffle/js/runtime/array/dyn)!

And secondly, we know that the array index syntax in JavaScript can also be used to access properties of objects.
We won't support that in this part of the series,
as we're missing both objects and strings in EasyScript currently --
but we should make it easy to extend the current implementation with these capabilities when the time comes.

They way you would typically solve these problems in an object-oriented language is to introduce either an abstract class,
or an interface, called something like `Array`, with an abstract method,
similar to `public abstract Object readElement(Object)`,
and then have `ArrayObject`
(and any other array representations)
either extend `Array` if it's an abstract class,
or implement it if it's an interface,
and provide an implementation for `readElement()`.
This way, the details of handling reading array elements would be neatly encapsulated in each subclass or implementation of `Array`.

But there's a huge problem with this solution in Truffle --
it doesn't work with partial evaluation.
Any time the partial evaluator encounters an abstract class or an interface with multiple subclasses or implementations,
it basically gives up, and generates slow code,
with a full virtual call.
What is worse, this barrier usually prevents other optimizations from having a chance to be applied,
like inlining, constant folding, etc.,
so this one spot can have huge negative implications on the performance of the interpreted code.

The solution to this problem in Truffle are
[libraries](https://www.graalvm.org/latest/graalvm-as-a-platform/language-implementation-framework/TruffleLibraries).
This is a special kind of classes that extend the abstract `Library` class,
and is supported by the Truffle annotation processor
(the same one that supports the
[Truffle DSL](/graal-truffle-tutorial-part-3-specializations-with-truffle-dsl-typesystem)).
The generated code is carefully tailored to be amenable to partial evaluation by Graal,
and still allow for polymorphic methods, like with inheritance or interface.

You can create your own libraries,
but for reading array elements,
we'll use an existing library that we've seen already:
the [Interop library](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/interop/InteropLibrary.html),
which contains, among other things,
messages for dealing with array-like structures:

```java
@NodeChild("arrayExpr")
@NodeChild("indexExpr")
public abstract class ArrayIndexReadExprNode extends EasyScriptExprNode {
    @Specialization(guards = "arrayInteropLibrary.isArrayElementReadable(array, index)", limit = "2")
    protected Object readIntIndexOfArray(Object array, int index,
            @CachedLibrary("array") InteropLibrary arrayInteropLibrary) {
        try {
            return arrayInteropLibrary.readArrayElement(array, index);
        } catch (UnsupportedMessageException | InvalidArrayIndexException e) {
            throw new EasyScriptException(this, e.getMessage());
        }
    }

    @Specialization(guards = "interopLibrary.isNull(target)", limit = "2")
    protected Object indexUndefined(Object target, Object index,
            @CachedLibrary("target") InteropLibrary interopLibrary) {
        throw new EasyScriptException("Cannot read properties of undefined (reading '" + index + "')");
    }

    @Fallback
    protected Object readNonArrayOrNonIntIndex(Object array, Object index) {
        return Undefined.INSTANCE;
    }
}
```

We use the `readArrayElement()` message in the implementation,
and guard the specialization with the `isArrayElementReadable()` message from the library.

To get an instance of the library inside the specialization,
we use the `@CachedLibrary` annotation.
Using it requires us to place a limit on the number of times a specialization can be instantiated,
in order to not leak memory with too many cached objects
(libraries are relatively heavyweight objects).
It's a good practice to always set that limit to `2`,
as setting it to `1` sometimes has an adverse impact on performance,
for reasons that I don't fully understand
(hopefully, this serves as even more proof that you should always benchmark your interpreter's performance --
compilers are often black boxes, and it's hard to know why they behave the way they do,
and Graal is no different in that regard).

The `@Fallback` method is needed because, in JavaScript,
it's legal to take an index of any type,
and use any type, not only an integer,
for the index -- for example, the expression `1[true]`
is legal (if nonsensical) in JavaScript, and returns `undefined`.
The only exception to that rule is `undefined` itself
(and `null`, but we don't support that one in EasyScript yet),
which cannot be indexed (it's an error),
and that's why we have that second specialization.

To implement this correctly in `ArrayObject`,
we need to implement the appropriate messages in that class:

```java
@ExportLibrary(InteropLibrary.class)
public final class ArrayObject extends DynamicObject {
    private Object[] arrayElements;

    // ...

    @ExportMessage
    boolean isArrayElementReadable(long index) {
        return index >= 0 && index < this.arrayElements.length;
    }

    @ExportMessage
    Object readArrayElement(long index) {
        return this.isArrayElementReadable(index)
                ? this.arrayElements[(int) index]
                : Undefined.INSTANCE;
    }
}
```

Even though it's legal to read any index of an array
(if it's outside the `0` - `length - 1` range,
it just returns `undefined`),
we implement `isArrayElementReadable()` to be more strict,
because of its interactions with `isArrayElementModifiable()`
and `isArrayElementInsertable()`
(they can't all be true for the same index),
which we use below, for writing.

## Array index write expression

The write expression is very similar to the read expression,
but of course using different messages from the interop library:

```java
@NodeChild("arrayExpr")
@NodeChild("indexExpr")
@NodeChild("rvalueExpr")
public abstract class ArrayIndexWriteExprNode extends EasyScriptExprNode {
    @Specialization(guards = "arrayInteropLibrary.isArrayElementWritable(array, index)", limit = "2")
    protected Object writeIntIndex(Object array, int index, Object rvalue,
            @CachedLibrary("array") InteropLibrary arrayInteropLibrary) {
        try {
            arrayInteropLibrary.writeArrayElement(array, index, rvalue);
        } catch (UnsupportedMessageException | InvalidArrayIndexException | UnsupportedTypeException e) {
            throw new EasyScriptException(this, e.getMessage());
        }
        return rvalue;
    }

    @Specialization(guards = "interopLibrary.isNull(target)", limit = "2")
    protected Object indexUndefined(Object target, Object index, Object rvalue,
            @CachedLibrary("target") InteropLibrary interopLibrary) {
        throw new EasyScriptException("Cannot set properties of undefined (setting '" + index + "')");
    }

    @Fallback
    protected Object writeNonArrayOrNonIntIndex(Object array, Object index, Object rvalue) {
        return rvalue;
    }
}
```

The interesting part is the `ArrayObject` implementation,
because in JavaScript, unlike in virtually any other language,
it's possible to write beyond the current array's size --
the effect of that assignment is that all indexes between the old and new last index are filled with `undefined`:

```java
@ExportLibrary(InteropLibrary.class)
public final class ArrayObject extends DynamicObject {
    private Object[] arrayElements;

    // ...

    @ExportMessage
    boolean isArrayElementModifiable(long index) {
        return this.isArrayElementReadable(index);
    }

    @ExportMessage
    boolean isArrayElementInsertable(long index) {
        return index >= this.arrayElements.length;
    }

    @ExportMessage
    void writeArrayElement(long index, Object value) {
        if (this.isArrayElementModifiable(index)) {
            this.arrayElements[(int) index] = value;
        } else {
            Object[] newArrayElements = new Object[(int) index + 1];
            for (int i = 0; i < index; i++) {
                newArrayElements[i] = i < this.arrayElements.length
                        ? this.arrayElements[i]
                        : Undefined.INSTANCE;
            }
            newArrayElements[(int) index] = value;
            this.arrayElements = newArrayElements;
        }
    }
}
```

## Adding the `length` property

So, we now have array literals,
and reading and writing to array indexes.
But we're still missing accessing the `length` property.

To implement this, we need to change our language.
Up to this point, the only thing even slightly resembling "properties"
in EasyScript was something we called "complex references"
that were used to implement the built-in functions of the
`Math` object, like `Math.abs`.
It were basically just two identifiers,
separated by a dot.

But for arrays, that will clearly not be enough --
you can read the `length` property in more expressions than just variable references,
like with array literals (`[1, 2, 3].length`),
from results of function calls (`makeArray().length`), etc.

So, the corrected grammar for property read expressions is:

```shell-session
expr5 : expr5 '.' ID          #PropertyReadExpr5
      ...
```

Its implementation will again use the interop library:

```java
@NodeChild("targetExpr")
@NodeField(name = "propertyName", type = String.class)
public abstract class PropertyReadExprNode extends EasyScriptExprNode {
    protected abstract String getPropertyName();

    @Specialization(guards = "interopLibrary.hasMembers(target)", limit = "2")
    protected Object readProperty(Object target,
            @CachedLibrary("target") InteropLibrary interopLibrary) {
        try {
            return interopLibrary.readMember(target, this.getPropertyName());
        } catch (UnknownIdentifierException e) {
            return Undefined.INSTANCE;
        } catch (UnsupportedMessageException e) {
            throw new EasyScriptException(this, e.getMessage());
        }
    }

    @Specialization(guards = "interopLibrary.isNull(target)", limit = "2")
    protected Object readPropertyOfUndefined(Object target,
            @CachedLibrary("target") InteropLibrary interopLibrary) {
        throw new EasyScriptException("Cannot read properties of undefined (reading '" + this.getPropertyName() + "')");
    }

    @Fallback
    protected Object readPropertyOfNonUndefinedWithoutMembers(Object target) {
        return Undefined.INSTANCE;
    }
}
```

The way we implement reading and writing the `length` property in `ArrayObject` is
[with the `DynamicObjectLibrary`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/object/DynamicObjectLibrary.html)
that is designed, as its name suggests, to operate on `DynamicObject`s
(which `ArrayObject` is, since it's a subclass of `DynamicObject`).
We take advantage of the fact that the `@CachedLibrary`
annotation can be placed not only on `@Specialization` methods,
but also on `@ExportMessage` ones,
so that we can use `DynamicObjectLibrary` inside the implementation of the interop library messages
(we use the static `getUnchached()` method of `DynamicObjectLibrary`
in the constructor of `ArrayObject` to first initialize the `length` property to an initial value):

```java
@ExportLibrary(InteropLibrary.class)
public final class ArrayObject extends DynamicObject {
    @DynamicField
    private long length;

    private Object[] arrayElements;

    public ArrayObject(Shape arrayShape, Object[] arrayElements) {
        super(arrayShape);
        this.setArrayElements(arrayElements, DynamicObjectLibrary.getUncached());
    }

    // ...

    @ExportMessage
    boolean hasMembers() {
        return true;
    }

    @ExportMessage
    boolean isMemberReadable(String member) {
        return "length".equals(member);
    }

    @ExportMessage
    Object readMember(String member,
            @CachedLibrary("this") DynamicObjectLibrary objectLibrary) throws UnknownIdentifierException {
        switch (member) {
            case "length": return objectLibrary.getOrDefault(this, "length", 0);
            default: throw UnknownIdentifierException.create(member);
        }
    }

    @ExportMessage
    Object getMembers(boolean includeInternal) {
        return new MemberNamesObject(new String[]{"length"});
    }

    private void setArrayElements(Object[] arrayElements, DynamicObjectLibrary objectLibrary) {
        this.arrayElements = arrayElements;
        objectLibrary.putInt(this, "length", arrayElements.length);
    }
}
```

The `@DynamicField` annotation allows you to influence the Shape of a given dynamic object --
tell it that objects of this Shape always have a given property.
Even though `length` is an `int`,
Truffle only permits
[`long` and `Object`](https://www.graalvm.org/latest/graalvm-as-a-platform/language-implementation-framework/DynamicObjectModel#extended-object-layout)
for the type of the dynamic field.
In addition, the field should never be accessed directly by your code,
only through the `DynamicObjectLibrary`,
like we do above.

In order to construct a Shape with this field included,
we need to pass the class of the object to the `Shape` builder with the
`layout` method:

```java
@TruffleLanguage.Registration(id = "ezs", name = "EasyScript")
public final class EasyScriptTruffleLanguage extends
        TruffleLanguage<EasyScriptLanguageContext> {
    // ...

    private final Shape arrayShape = Shape.newBuilder()
        .layout(ArrayObject.class)
        .build();
}
```

`MemberNamesObject` is just a simple `TruffleObject`
that contains all names of the members of a given object.
We'll re-use it for a few different `TruffleObject`s later:

```java
@ExportLibrary(InteropLibrary.class)
final class MemberNamesObject implements TruffleObject {
    private final Object[] names;

    MemberNamesObject(Object[] names) {
        this.names = names;
    }

    @ExportMessage
    boolean hasArrayElements() {
        return true;
    }

    @ExportMessage
    long getArraySize() {
        return this.names.length;
    }

    @ExportMessage
    boolean isArrayElementReadable(long index) {
        return index >= 0 && index < this.names.length;
    }

    @ExportMessage
    Object readArrayElement(long index) throws InvalidArrayIndexException {
        if (!this.isArrayElementReadable(index)) {
            throw InvalidArrayIndexException.create(index);
        }
        return this.names[(int) index];
    }
}
```

## `Math` -- static objects

So, with the above changes,
we managed to support the `length` property of arrays.
However, in doing that, we broke the functionality of the `Math`
object that provides the built-in `abs` and `pow` functions.
In order to be able to read the properties of `Math`,
we need to turn it into an object.
However, since we don't support assignment to properties yet,
we can take advantage of the fact that we know the exact properties it contains,
and use Truffle's mirror of `DynamicObject`,
[the `StaticObject`](https://www.graalvm.org/latest/graalvm-as-a-platform/language-implementation-framework/StaticObjectModel).

Using static objects looks very different from dynamic objects.
You don't declare a class that extends a particular superclass;
instead, you first create a static shape builder,
passing it a reference to a `TruffleLanguage`.
You add static
(which in this context means "statically typed",
not "static" like in Java)
properties to that builder,
specifying their type
(it can be one of the primitive Java types, or `Object`),
and whether you want the property to be `final`, or mutable.
Finally, you create an instance of a static object using the crated shape.
The actual reading and writing of the properties is performed through those static properties,
passing them the created static object instance.

In `Math`, we encapsulate the details of all of this in a static factory method,
and then the implementations of the interop library messages use that object created from the shape,
and the static properties, saved as instance fields:

```java
@ExportLibrary(InteropLibrary.class)
public final class MathObject implements TruffleObject {
    public static MathObject create(EasyScriptTruffleLanguage language,
            FunctionObject absFunction, FunctionObject powFunction) {
        StaticShape.Builder shapeBuilder = StaticShape.newBuilder(language);
        StaticProperty absProp = new DefaultStaticProperty("abs");
        StaticProperty powProp = new DefaultStaticProperty("pow");
        Object staticObject = shapeBuilder
                .property(absProp, Object.class, true)
                .property(powProp, Object.class, true)
                .build()
                .getFactory().create();
        absProp.setObject(staticObject, absFunction);
        powProp.setObject(staticObject, powFunction);
        return new MathObject(staticObject, absProp, powProp);
    }

    private final Object targetObject;
    private final StaticProperty absProp;
    private final StaticProperty powProp;

    private MathObject(Object targetObject, StaticProperty absProp, StaticProperty powProp) {
        this.targetObject = targetObject;
        this.absProp = absProp;
        this.powProp = powProp;
    }

    @ExportMessage
    boolean hasMembers() {
        return true;
    }

    @ExportMessage
    boolean isMemberReadable(String member) {
        return "abs".equals(member) || "pow".equals(member);
    }

    @ExportMessage
    Object readMember(String member) throws UnknownIdentifierException {
        switch (member) {
            case "abs": return this.absProp.getObject(this.targetObject);
            case "pow": return this.powProp.getObject(this.targetObject);
            default: throw UnknownIdentifierException.create(member);
        }
    }

    @ExportMessage
    Object getMembers(boolean includeInternal) {
        return new MemberNamesObject(new String[]{"abs", "pow"});
    }
}
```

## Sorting

Finally, with all of that in place,
we can write a test using the simplest sorting algorithm,
[bubble sort](https://en.wikipedia.org/wiki/Bubble_sort):

```java
    @Test
    public void bubble_sort_changes_array_to_sorted() {
        Value result = this.context.eval("ezs", "" +
                "const array = [44, 33, 22, 11]; " +
                "function bubbleSort(array) { " +
                "    for (var i = 0; i < array.length - 1; i = i + 1) { " +
                "        for (var j = 0; j < array.length - 1 - i; j = j + 1) { " +
                "            if (array[j] > array[j + 1]) { " +
                "                var tmp = array[j]; " +
                "                array[j] = array[j + 1]; " +
                "                array[j + 1] = tmp; " +
                "            } " +
                "        } " +
                "    } " +
                "} " +
                "bubbleSort(array); " +
                "array"
        );

        assertEquals(11, result.getArrayElement(0).asInt());
        assertEquals(22, result.getArrayElement(1).asInt());
        assertEquals(33, result.getArrayElement(2).asInt());
        assertEquals(44, result.getArrayElement(3).asInt());
    }
```

## Refactoring the global object to be a `DynamicObject`

So, these are all the changes required to implement arrays and read-only properties.
However, I want to take advantage of the fact that we now have dynamic objects in our toolbelt to fix an issue with the interpreter as its currently written.

To store global variables, we use a `HashMap` inside the `GlobalScopeObject`.
Which means that every access to a global variable during the execution of EasyScript code,
whether a read or a write, needs to find the key equal to that variable name in the hash map.
Java collections are complex, and none of them more so than the map implementations.

This is problematic for JITting our interpreter,
because the complex logic inside `HashMap` was never written with partial evaluation in mind.
In consequence, Graal is unable to eliminate much of it,
and the machine code it emits will contain inside of it a full hash map implementation.
Worse still, stopping partial evaluation so early will prevent other optimizations from being able to be applied.
The end result will be an interpreter that is large and slow.

For this reason, it's a general rule in Truffle to avoid using Java collections at runtime
(it's fine to use them at parse time, as that is never partially evaluated),
and prefer using Java arrays instead,
as those are much easier for Graal to optimize.

But, there is a reason we are using a Java `Map` --
we want to represent the concept of global variables,
which in JavaScript are properties of the global object.
Up to this point, a standard Java `Map` was the only way we knew how to express the concept of binding variable names to their values --
but in this part of the series,
we learned of a Truffle-native way to represent that,
and that is with dynamic objects, members of that object, and libraries!
Unlike `HashMap`, `DynamicObjectLibrary`
(and the code automatically generated from classes that export it by the Truffle annotation processor)
_was_ carefully coded so that Graal partial evaluation works on it,
so it doesn't suffer from the same problems that `HashMap` does.

Here's how `GlobalScopeObject` modified to be a `DynamicObject` looks like.
We again take advantage of the fact that `@ExportMessage` methods
can use the `@CachedLibrary` annotation for its parameters:

```java
@ExportLibrary(InteropLibrary.class)
public final class GlobalScopeObject extends DynamicObject {
    public GlobalScopeObject(Shape shape) {
        super(shape);
    }

    @ExportMessage
    boolean isMemberReadable(String member,
            @CachedLibrary("this") DynamicObjectLibrary objectLibrary) {
        return objectLibrary.containsKey(this, member);
    }

    @ExportMessage
    Object getMembers(@SuppressWarnings("unused") boolean includeInternal,
            @CachedLibrary("this") DynamicObjectLibrary objectLibrary) {
        return new MemberNamesObject(objectLibrary.getKeyArray(this));
    }

    @ExportMessage
    Object readMember(String member,
            @CachedLibrary("this") DynamicObjectLibrary objectLibrary) throws UnknownIdentifierException {
        Object value = objectLibrary.getOrDefault(this, member, null);
        if (null == value) {
            throw UnknownIdentifierException.create(member);
        }
        return value;
    }

    @ExportMessage
    boolean isMemberModifiable(String member,
            @CachedLibrary("this") DynamicObjectLibrary objectLibrary) {
        return objectLibrary.containsKey(this, member);
    }

    @ExportMessage
    boolean isMemberInsertable(String member,
            @CachedLibrary("this") DynamicObjectLibrary objectLibrary) {
        return !objectLibrary.containsKey(this, member);
    }

    @ExportMessage
    void writeMember(String member, Object value,
            @CachedLibrary("this") DynamicObjectLibrary objectLibrary) {
        objectLibrary.put(this, member, value);
    }

    @ExportMessage
    boolean isScope() {
        return true;
    }

    @ExportMessage
    boolean hasMembers() {
        return true;
    }
}
```

We pass the correct shape to its constructor from our `TruffleLanguage` implementation,
similarly like we did for `ArrayObject`.

Of course, this change means we have to modify the Nodes that deal with the global scope --
currently, those would be the variable and function declaration statements,
as well as the reference and assignment expressions.

But if we tried to implement them,
we would quickly run into a problem.
We want to use the `@CachedLibrary` annotation in the `@Specialization`
methods of these Nodes,
but there's an issue: we don't have an instance of the global scope available in the parameters of that method,
because we need to call the `currentLanguageContext()` to get to it,
which is a method all EasyScript Nodes inherit from an abstract subclass they all extend.

So, we'll use a small trick.
We'll create a very simple expression Node that just returns the global scope object,
using the `currentLanguageContext()` method:

```java
public abstract class GlobalScopeObjectExprNode extends EasyScriptExprNode {
    @Specialization
    protected DynamicObject returnGlobalScopeObject() {
        return this.currentLanguageContext().globalScopeObject;
    }
}
```

And we'll add that Node as the first child to all of the four Nodes mentioned above that deal with the global scope.
This way, the `@Specialization` methods will receive it as its first argument,
and it can be used in the `@CachedLibrary` annotation for creating an instance of `DynamicObjectLibrary`.
For example, here's how that looks in the global variable declaration statement:

```java
@NodeChild(value = "globalScopeObjectExpr", type = GlobalScopeObjectExprNode.class)
@NodeChild(value = "initializerExpr", type = EasyScriptExprNode.class)
@NodeField(name = "name", type = String.class)
@NodeField(name = "declarationKind", type = DeclarationKind.class)
public abstract class GlobalVarDeclStmtNode extends EasyScriptStmtNode {
    protected abstract String getName();
    protected abstract DeclarationKind getDeclarationKind();

    @CompilationFinal
    private boolean checkVariableExists = true;

    @Specialization(limit = "2")
    protected Object createVariable(DynamicObject globalScopeObject, Object value,
            @CachedLibrary("globalScopeObject") DynamicObjectLibrary objectLibrary) {
        var variableId = this.getName();

        if (this.checkVariableExists) {
            CompilerDirectives.transferToInterpreterAndInvalidate();
            this.checkVariableExists = false;

            if (objectLibrary.containsKey(globalScopeObject, variableId)) {
                throw new EasyScriptException(this, "Identifier '" + variableId + "' has already been declared");
            }
        }

        int flags = this.getDeclarationKind() == DeclarationKind.CONST ? 1 : 0;
        objectLibrary.putWithFlags(globalScopeObject, variableId, value, flags);

        return Undefined.INSTANCE;
    }
}
```

We use the `flags` argument to `objectLibrary.putWithFlags()`
to save whether a given variable is a `const`
(and thus cannot be reassigned) -- `1` means it's a constant,
`0` means it's a `let` or `var`.

We check the value of that flag in the global variable assignment Node:

```java
@NodeChild(value = "globalScopeObjectExpr", type = GlobalScopeObjectExprNode.class)
@NodeChild(value = "assignmentExpr")
@NodeField(name = "name", type = String.class)
public abstract class GlobalVarAssignmentExprNode extends EasyScriptExprNode {
    protected abstract String getName();

    @Specialization(limit = "2")
    protected Object assignVariable(DynamicObject globalScopeObject, Object value,
            @CachedLibrary("globalScopeObject") DynamicObjectLibrary objectLibrary) {
        String variableId = this.getName();
        Property property = objectLibrary.getProperty(globalScopeObject, variableId);
        if (property == null) {
            throw new EasyScriptException(this, "'" + variableId + "' is not defined");
        }
        if (property.getFlags() == 1) {
            throw new EasyScriptException("Assignment to constant variable '" + variableId + "'");
        }
        objectLibrary.put(globalScopeObject, variableId, value);
        return value;
    }
}
```

An assignment to a constant is an error.

With global scope now being a dynamic object,
we can roll back the changes that we made in the
[previous part of the series](/graal-truffle-tutorial-part-9-performance-benchmarking)
to make `FunctionObject` mutable:

```java
@NodeChild(value = "globalScopeObjectExpr", type = GlobalScopeObjectExprNode.class)
@NodeField(name = "funcName", type = String.class)
@NodeField(name = "frameDescriptor", type = FrameDescriptor.class)
@NodeField(name = "funcBody", type = UserFuncBodyStmtNode.class)
@NodeField(name = "argumentCount", type = int.class)
public abstract class FuncDeclStmtNode extends EasyScriptStmtNode {
    protected abstract String getFuncName();
    protected abstract FrameDescriptor getFrameDescriptor();
    protected abstract UserFuncBodyStmtNode getFuncBody();
    protected abstract int getArgumentCount();

    @CompilationFinal
    private FunctionObject cachedFunction;

    @Specialization(limit = "2")
    protected Object declareFunction(DynamicObject globalScopeObject,
            @CachedLibrary("globalScopeObject") DynamicObjectLibrary objectLibrary) {
        if (this.cachedFunction == null) {
            CompilerDirectives.transferToInterpreterAndInvalidate();

            var truffleLanguage = this.currentTruffleLanguage();
            var funcRootNode = new StmtBlockRootNode(truffleLanguage, this.getFrameDescriptor(), this.getFuncBody());
            var callTarget = funcRootNode.getCallTarget();

            this.cachedFunction = new FunctionObject(callTarget, this.getArgumentCount());
        }

        objectLibrary.putConstant(globalScopeObject, this.getFuncName(),
            this.cachedFunction, 0);

        return Undefined.INSTANCE;
    }
}
```

And we can remove the caching of resolved functions when referencing a global variable:

```java
@NodeChild(value = "globalScopeObjectExpr", type = GlobalScopeObjectExprNode.class)
@NodeField(name = "name", type = String.class)
public abstract class GlobalVarReferenceExprNode extends EasyScriptExprNode {
    protected abstract String getName();

    @Specialization(limit = "2")
    protected Object readVariable(DynamicObject globalScopeObject,
            @CachedLibrary("globalScopeObject") DynamicObjectLibrary objectLibrary) {
        String variableId = this.getName();
        var value = objectLibrary.getOrDefault(globalScopeObject, variableId, null);
        if (value == null) {
            throw new EasyScriptException(this, "'" + variableId + "' is not defined");
        } else {
            return value;
        }
    }
}
```

Not only does this simplify the code of `FuncDeclStmtNode` and `GlobalVarReferenceExprNode`,
but it also allows us to handle a JavaScript edge case:
overriding a function variable with a non-function value
(in code like `function f() {}; f = 3;`),
which the previous code had to disallow
(in order to ensure the caching logic in `GlobalVarReferenceExprNode` was correct).

## Summary

If we re-run the Fibonacci benchmark from the
[previous article](/graal-truffle-tutorial-part-9-performance-benchmarking)
with the changes from this part,
these are the numbers I get on my laptop:

```shell-session
Benchmark                              Mode  Cnt   Score   Error  Units
FibonacciBenchmark.recursive_eval_ezs  avgt    5  49.806 ± 0.835  us/op
FibonacciBenchmark.recursive_eval_js   avgt    5  72.937 ± 2.110  us/op
FibonacciBenchmark.recursive_eval_sl   avgt    5  52.396 ± 0.964  us/op
FibonacciBenchmark.recursive_java      avgt    5  35.726 ± 0.497  us/op
```

Turns out that the simpler code is actually twice as fast as the previous,
complicated one that used a `HashMap`,
and our humble example interpreter is now faster than both the GraalVM JavaScript implementation,
and SimpleLanguage!

As usual, all of the code from the article is
[available on GitHub](https://github.com/skinny85/graalvm-truffle-tutorial/tree/master/part-10).

In the next
[part of the series](/graal-truffle-tutorial-part-11-strings-static-method-calls),
we will talk about adding support for strings to our language,
including calling methods on them.
