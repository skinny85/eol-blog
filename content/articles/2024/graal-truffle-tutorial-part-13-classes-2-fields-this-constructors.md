---
id: 74
layout: truffle-tutorial.html
title: "Graal Truffle tutorial part 13 – classes 2: fields, this, constructors"
summary: |
   In the thirteenth part of the Truffle tutorial,
   we continue with the implementation of classes.
   In this article, we add support for the "this" keyword,
   as well as instance fields and constructors.
created_at: 2024-02-29
---

## Introduction

In the [previous article](/graal-truffle-tutorial-part-12-classes-1-methods-new)
of the series, we started with the implementation of classes in EasyScript,
our simplified subset of JavaScript.
However, while we allowed defining methods and creating instances of classes,
we didn't support the basic building block of object-oriented programming:
storing state inside instances of classes.
The methods of these classes could only refer to their arguments,
and other global values, similarly to how global functions work.

In this part of the series, we remove that limitation,
and allow class instances to store state within them using fields.
In order to allow access to those fields,
we also add support for referencing the current object with the `this` keyword.
Finally, we begin recognizing constructors,
which are special methods that automatically execute whenever an object of a given class is instantiated.

## Field writes

In order to support saving data to fields,
we need to add property write expressions to the grammar:

```shell-session
expr1 : ID '=' expr1                                   #AssignmentExpr1
      | object=expr5 '.' ID '=' rvalue=expr1           #PropertyWriteExpr1   // new
      | arr=expr5 '[' index=expr1 ']' '=' rvalue=expr1 #ArrayIndexWriteExpr1
      | expr2                                          #PrecedenceTwoExpr1
      ;
```

Similarly like for property reads,
we introduce a new Node class, `CommonWritePropertyNode`,
that will contain the shared logic of writing properties to objects,
since in JavaScript, that operation can be expressed as either
`obj.prop = value`, or `obj['prop'] = value`.

The new Node class for representing that first variant,
which we often call "direct access" in this series,
simply delegates to `CommonWritePropertyNode`:

```java
@NodeChild("targetExpr")
@NodeField(name = "propertyName", type = String.class)
@NodeChild("rvalueExpr")
public abstract class PropertyWriteExprNode extends EasyScriptExprNode {
    protected abstract String getPropertyName();

    @Specialization
    protected Object writeProperty(
            Object target, Object rvalue,
            @Cached CommonWritePropertyNode commonWritePropertyNode) {
        return commonWritePropertyNode.executeWriteProperty(target, this.getPropertyName(), rvalue);
    }
}
```

For handling the second variant,
we use the existing `ArrayIndexWriteExprNode`,
but with added specializations for handling the case when the index expression evaluates to a `TruffleString`.
We use a similar trick that we employed in
[`ArrayIndexReadExprNode` in part 11](/graal-truffle-tutorial-part-11-strings-static-method-calls#caching-in-arrayindexreadexprnode),
where we cache the Java strings converted from `TruffleString`s for the first two property names we encounter:

```java
@NodeChild("arrayExpr")
@NodeChild("indexExpr")
@NodeChild("rvalueExpr")
@ImportStatic(EasyScriptTruffleStrings.class)
public abstract class ArrayIndexWriteExprNode extends EasyScriptExprNode {
    @Specialization(guards = "arrayInteropLibrary.isArrayElementWritable(array, index)", limit = "2")
    protected Object writeIntIndexOfArray(
            Object array, int index, Object rvalue,
            @CachedLibrary("array") InteropLibrary arrayInteropLibrary) {
        try {
            arrayInteropLibrary.writeArrayElement(array, index, rvalue);
        } catch (UnsupportedMessageException | InvalidArrayIndexException | UnsupportedTypeException e) {
            throw new EasyScriptException(this, e.getMessage());
        }
        return rvalue;
    }

    @Specialization(guards = "equals(propertyName, cachedPropertyName, equalNode)", limit = "2")
    protected Object writeTruffleStringPropertyCached(
            Object target, TruffleString propertyName, Object rvalue,
            @Cached("propertyName") TruffleString cachedPropertyName,
            @Cached TruffleString.EqualNode equalNode,
            @Cached TruffleString.ToJavaStringNode toJavaStringNode,
            @Cached("toJavaStringNode.execute(propertyName)") String javaStringPropertyName,
            @Cached CommonWritePropertyNode commonWritePropertyNode) {
        return commonWritePropertyNode.executeWriteProperty(target,
                javaStringPropertyName, rvalue);
    }

    @Specialization(replaces = "writeTruffleStringPropertyCached", limit = "2")
    protected Object writeTruffleStringPropertyUncached(
            Object target, TruffleString propertyName, Object rvalue,
            @Cached TruffleString.ToJavaStringNode toJavaStringNode,
            @Cached CommonWritePropertyNode commonWritePropertyNode) {
        return commonWritePropertyNode.executeWriteProperty(target,
                toJavaStringNode.execute(propertyName), rvalue);
    }

    @Fallback
    protected Object writeNonStringProperty(
            Object target, Object property, Object rvalue,
            @Cached CommonWritePropertyNode commonWritePropertyNode) {
        return commonWritePropertyNode.executeWriteProperty(target,
                EasyScriptTruffleStrings.toString(property), rvalue);
    }
}
```

That last specialization covers the case when the evaluation of the index expression results in a type other than string.
When that happens, JavaScript rules say the value needs to be converted to a string --
so, `obj[true] = value` is equivalent to `obj['true'] = value`
(the same conversion rules also apply to property reads).

`EasyScriptTruffleStrings.toString()` is an extremely simple method,
we just have to make sure to annotate it with `@TruffleBoundary`
(which we first saw in [part 11](/graal-truffle-tutorial-part-11-strings-static-method-calls))
so that it doesn't get partially evaluated:

```java
public final class EasyScriptTruffleStrings {
    // ...

    @TruffleBoundary
    public static String toString(Object object) {
        return object.toString();
    }
}
```

The actual logic of writing a field in `CommonWritePropertyNode`
is really simple -- we just use the
[`writeMember` message from the `InteropLibrary`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/interop/InteropLibrary.html#writeMember-java.lang.Object-java.lang.String-java.lang.Object-):

```java
public abstract class CommonWritePropertyNode extends Node {
    public abstract Object executeWriteProperty(Object target, Object property, Object rvalue);

    @Specialization(guards = "interopLibrary.isMemberWritable(target, propertyName)", limit = "2")
    protected Object writeProperty(
            Object target, String propertyName, Object rvalue,
            @CachedLibrary("target") InteropLibrary interopLibrary) {
        try {
            interopLibrary.writeMember(target, propertyName, rvalue);
        } catch (UnsupportedMessageException | UnsupportedTypeException | UnknownIdentifierException e) {
            throw new EasyScriptException(this, e.getMessage());
        }
        return rvalue;
    }

    @Specialization(guards = "interopLibrary.isNull(target)", limit = "2")
    protected Object writePropertyOfUndefined(
            Object target, Object property, Object rvalue,
            @CachedLibrary("target") InteropLibrary interopLibrary) {
        throw new EasyScriptException("Cannot set properties of undefined (setting '" + property + "')");
    }

    @Fallback
    protected Object writePropertyOfNonUndefinedWithoutMembers(
            Object target, Object property, Object rvalue) {
        return rvalue;
    }
}
```

Attempting to write a property to `undefined` is an error,
same as trying to read a property of it,
but a write to any other value that doesn't have members,
like a boolean or a number, is simply ignored in JavaScript
(so, `true.x = 5` simply returns `5`, but has no other observable effect).

### Writing the `length` property of arrays

There is an important edge case to writing properties in JavaScript --
for arrays, the `length` property is treated specially.
You can only write non-negative integers to it --
any attempt to write a non-integer, or a negative integer,
as the value of `length` results in an error.
Writing this property also resizes the underlying array,
shrinking or expanding it as needed if the provided length is different from the current array's length.

How do we handle that edge case in EasyScript?
The resizing of the array clearly needs to be handled in `ArrayObject`,
our class that represents arrays at runtime.
But how do we make sure the value passed as the `length`
property is a non-negative integer?
We can definitely check the type of the value using something like the `instanceof` operator,
and then compare it to `0` after we've made sure it's an integer, but that seems a little bit ugly.

The typical solution to this problem in Truffle are specializations,
which enable formulating very concise type assertions
(which would allow us to ensure the value of `length` is an integer),
and also any additional runtime constraints with the `guards` attribute of the `@Specialization` annotation
(which would allow us to ensure the value of `length` is non-negative).
And as it turns out, you can use specializations not only in Nodes,
but also when exporting library messages!

The way to do that is by creating a static nested class inside your library-exporting class,
and annotating it with `@ExportMessage`.
Similarly like with methods, either the name of the class must be equal to the (capitalized)
name of the message from the library, or you can use the `name` attribute of `@ExportMessage`,
and then the class can have any name.

Inside the static nested class,
you can write methods annotated with `@Specialization`
that implement the different cases you want to handle.
Note that these specializations methods must be static,
and thus must take the object that the message is being sent to as their first argument,
which is different from exporting a message with an instance method.

In the specialization methods themselves,
you can use the same capabilities as in the Node classes,
such as `@CachedLibrary`, `@Fallback`, etc.:

```java
@ExportLibrary(InteropLibrary.class)
public final class ArrayObject extends JavaScriptObject {
    // must be package-private, since it's used in specialization guard expressions
    static final String LENGTH_PROP = "length";

    private Object[] arrayElements;

    public ArrayObject(Shape arrayShape, ClassPrototypeObject arrayPrototype,
            Object[] arrayElements) {
        super(arrayShape, arrayPrototype);
        this.setArrayElements(arrayElements, DynamicObjectLibrary.getUncached());
    }

    // ...

    @ExportMessage
    static class WriteMember {
        @Specialization(guards = {"LENGTH_PROP.equals(member)", "length >= 0"})
        static void writeNonNegativeIntLength(
                ArrayObject arrayObject, String member, int length,
                @CachedLibrary("arrayObject") DynamicObjectLibrary dynamicObjectLibrary) {
            arrayObject.resetArray(length, dynamicObjectLibrary);
        }

        @Specialization(guards = "LENGTH_PROP.equals(member)")
        static void writeNegativeOrNonIntLength(
                ArrayObject arrayObject, String member, Object length) {
            throw new EasyScriptException("Invalid array length: " + length);
        }

        @Fallback
        static void writeNonLength(
                ArrayObject arrayObject, String member, Object value,
                @CachedLibrary(limit = "2") DynamicObjectLibrary dynamicObjectLibrary) {
            arrayObject.writeMember(member, value, dynamicObjectLibrary);
        }
    }

    @ExportMessage
    void writeArrayElement(
            long index, Object value,
            @CachedLibrary("this") DynamicObjectLibrary objectLibrary) {
        if (!this.isArrayElementModifiable(index)) {
            // in JavaScript, it's legal to write past the array size
            this.resetArray(index + 1, objectLibrary);
        }
        this.arrayElements[(int) index] = value;
    }

    private void resetArray(long length, DynamicObjectLibrary objectLibrary) {
        Object[] newArrayElements = new Object[(int) length];
        for (int i = 0; i < length; i++) {
            newArrayElements[i] = i < this.arrayElements.length
                    ? this.arrayElements[i]
                    : Undefined.INSTANCE;
        }
        this.setArrayElements(newArrayElements, objectLibrary);
    }

    private void setArrayElements(Object[] arrayElements,
            DynamicObjectLibrary objectLibrary) {
        this.arrayElements = arrayElements;
        this.writeMember(LENGTH_PROP, arrayElements.length, objectLibrary);
    }

    // annotation needed here, because the name of the method is the same as the name of the message
    @ExportMessage.Ignore
    private void writeMember(
            String member, Object value,
            @CachedLibrary("this") DynamicObjectLibrary dynamicObjectLibrary) {
        dynamicObjectLibrary.put(this, member, value);
    }
}
```

Since the exported message is defined as a nested class,
it has access to all members of the outer class,
including private ones.
This is often very useful, like we see in this example,
where we can call the private `resetArray()`
method of `ArrayObject` from inside the specialization method.

## `this`

With property writes implemented,
we are halfway to allowing storing data in fields of class instances.
The other piece of the puzzle is allowing code inside the class to refer to the current instance,
and that's accomplished with the `this` keyword expression:

```shell-session
...
expr6 : literal                                           #LiteralExpr6
      | 'this'                                            #ThisExpr6         // new
      | ID                                                #ReferenceExpr6
      | '[' (expr1 (',' expr1)*)? ']'                     #ArrayLiteralExpr6
      | 'new' constr=expr6 ('('(expr1 (',' expr1)*)?')')? #NewExpr6
      | '(' expr1 ')'                                     #PrecedenceOneExpr6
      ;
...
```

So, how do we pass the object that corresponds to `this` into methods that read it?
We'll use a very simple schema, where we pass the current object as the first argument of any method:

```java
public final class ThisExprNode extends EasyScriptExprNode {
    @Override
    public Object executeGeneric(VirtualFrame frame) {
        return frame.getArguments()[0];
    }
}
```

Because of that implementation of `this`,
we need to offset all function and method arguments by one.
So, for example, if we have `function f(a, b)`,
`a` must now refer to argument with index `1`,
and `b` with index `2`, leaving index `0` reserved for `this`.

We can add that offsetting directly in the parsing logic:

```java
public final class EasyScriptTruffleParser {
    // ...

    private FuncDeclStmtNode parseSubroutineDecl(EasyScriptParser.Subroutine_declContext subroutineDecl,
            EasyScriptExprNode containerObjectExpr) {
        // ...

        for (int i = 0; i < argumentCount; i++) {
            // offset the arguments by one,
            // because the first argument is always `this`
            localVariables.put(funcArgs.get(i).getText(), new FunctionArgument(i + 1));
        }
        // ...
    }

    // ...
}
```

## Handling built-in objects and functions

The property writes we are adding to the language in this part will apply not only to class instances,
but to all objects, including built-in ones like arrays and functions
(not strings though, which are immutable in JavaScript).

Because of that, we will put all the common logic of writing (and reading)
properties inside `ClassInstanceObject` from the
[last part](/graal-truffle-tutorial-part-12-classes-1-methods-new#class-instances),
and make all object classes like `ArrayObject`, `FunctionObject`, etc. extend it.
Because of this, we'll rename the class `JavaScriptObject`,
to better reflect its more general nature.

Changing the class hierarchy in this way means we will need to supply not ony a Shape,
but also a `ClassPrototypeObject` instance when creating any built-in object.
We previously stored the String prototype directly in the Context class,
but since we now need so many different prototypes,
we'll introduce a class grouping them.
We will also store the two Shapes we need in this class,
the root Shape and the array Shape,
which will spare us from having to pass them explicitly to every Node that needs them,
like the array literal Node:

```java
public final class ShapesAndPrototypes {
    public final Shape rootShape;
    public final Shape arrayShape;
    public final ClassPrototypeObject functionPrototype;
    public final ClassPrototypeObject arrayPrototype;
    public final ClassPrototypeObject stringPrototype;

    public ShapesAndPrototypes(Shape rootShape, Shape arrayShape, ClassPrototypeObject functionPrototype,
            ClassPrototypeObject arrayPrototype, ClassPrototypeObject stringPrototype) {
        this.rootShape = rootShape;
        this.arrayShape = arrayShape;
        this.functionPrototype = functionPrototype;
        this.arrayPrototype = arrayPrototype;
        this.stringPrototype = stringPrototype;
    }
}
```

And then we surface this new object in our Truffle language context:

```java
public final class EasyScriptLanguageContext {
    // ...

    public final DynamicObject globalScopeObject;
    public final ShapesAndPrototypes shapesAndPrototypes;

    public EasyScriptLanguageContext(DynamicObject globalScopeObject,
            ShapesAndPrototypes shapesAndPrototypes) {
        this.globalScopeObject = globalScopeObject;
        this.shapesAndPrototypes = shapesAndPrototypes;
    }
}
```

Of course, creating all of these prototypes is the responsibility of the main `TruffleLanguage` class:

```java
@TruffleLanguage.Registration(id = "ezs", name = "EasyScript")
public final class EasyScriptTruffleLanguage extends TruffleLanguage<EasyScriptLanguageContext> {
    // ...

    private final Shape rootShape = Shape.newBuilder().build();

    private final ClassPrototypeObject functionPrototype =
            new ClassPrototypeObject(this.rootShape, "Function");

    @Override
    protected EasyScriptLanguageContext createContext(Env env) {
        var objectLibrary = DynamicObjectLibrary.getUncached();
        return new EasyScriptLanguageContext(
                this.createGlobalScopeObject(objectLibrary),
                this.createShapesAndPrototypes(objectLibrary));
    }

    private DynamicObject createGlobalScopeObject(DynamicObjectLibrary objectLibrary) {
        var globalScopeObject = new GlobalScopeObject(this.rootShape);
        // the 0 flag indicates Math is a variable, and can be reassigned
        objectLibrary.putConstant(globalScopeObject, "Math",
                this.createMathObject(objectLibrary), 0);
        return globalScopeObject;
    }

    private Object createMathObject(DynamicObjectLibrary objectLibrary) {
        var mathPrototype = new ClassPrototypeObject(this.rootShape, "Math");
        var mathObject = new JavaScriptObject(this.rootShape, mathPrototype);
        objectLibrary.putConstant(mathObject, "abs",
                this.defineBuiltInFunction(AbsFunctionBodyExprNodeFactory.getInstance()),
                0);
        objectLibrary.putConstant(mathObject, "pow",
                this.defineBuiltInFunction(PowFunctionBodyExprNodeFactory.getInstance()),
                0);
        return mathObject;
    }

    private ShapesAndPrototypes createShapesAndPrototypes(DynamicObjectLibrary objectLibrary) {
        var arrayPrototype = new ClassPrototypeObject(this.rootShape, "Array");
        return new ShapesAndPrototypes(this.rootShape, this.arrayShape,
                this.functionPrototype, arrayPrototype,
                this.createStringPrototype(objectLibrary));
    }

    private ClassPrototypeObject createStringPrototype(DynamicObjectLibrary objectLibrary) {
        var stringPrototype = new ClassPrototypeObject(this.rootShape, "String");
        objectLibrary.putConstant(stringPrototype, "charAt",
                this.defineBuiltInMethod(CharAtMethodBodyExprNodeFactory.getInstance()),
                0);
        return stringPrototype;
    }

    // ...
}
```

We change `MathObject` to be a regular JavaScript object,
as with property writes it can now be mutated,
like any other object.

We also make the `String` prototype a regular `ClassPrototypeObject`,
instead of having a separate class with a field for each method, like `charAt`,
as we will change the way we resolve methods for all objects, including strings,
which will make the `ReadTruffleStringPropertyNode` much simpler.

Finally, we need to offset the arguments for built-in functions to account for `this` --
not for built-in methods, like `charAt` of Strings, though,
since those already have an explicit argument in their specializations that represents `this`:

```java
@TruffleLanguage.Registration(id = "ezs", name = "EasyScript")
public final class EasyScriptTruffleLanguage extends TruffleLanguage<EasyScriptLanguageContext> {
    // ...

    private FunctionObject defineBuiltInFunction(NodeFactory<? extends BuiltInFunctionBodyExprNode> nodeFactory) {
        return new FunctionObject(this.rootShape, this.functionPrototype,
                this.createCallTarget(nodeFactory, /* offsetArguments */ true),
                nodeFactory.getExecutionSignature().size());
    }

    private FunctionObject defineBuiltInMethod(NodeFactory<? extends BuiltInFunctionBodyExprNode> nodeFactory) {
        return new FunctionObject(this.rootShape, this.functionPrototype,
                // built-in method implementation Nodes already have an argument for `this`,
                // so there's no need to offset the method arguments
                this.createCallTarget(nodeFactory, /* offsetArguments */ false),
                // we always add an extra argument for 'this' inside FunctionDispatchNode,
                // but built-in methods already have 'this' in their specializations -
                // for that reason, we make the FunctionObject have one argument less than the specializations take
                nodeFactory.getExecutionSignature().size() - 1);
    }

    private CallTarget createCallTarget(NodeFactory<? extends BuiltInFunctionBodyExprNode> nodeFactory,
            boolean offsetArguments) {
        int argumentCount = nodeFactory.getExecutionSignature().size();
        ReadFunctionArgExprNode[] functionArguments = IntStream.range(0, argumentCount)
                .mapToObj(i -> new ReadFunctionArgExprNode(offsetArguments ? i + 1 : i))
                .toArray(ReadFunctionArgExprNode[]::new);
        var rootNode = new BuiltInFuncRootNode(this,
                nodeFactory.createNode((Object) functionArguments));
        return rootNode.getCallTarget();
    }
}
```

## Objects

The `JavaScriptObject` class contains the common logic of writing properties,
using the [dynamic object library](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/object/DynamicObjectLibrary.html):

```java
@ExportLibrary(InteropLibrary.class)
public class JavaScriptObject extends DynamicObject {
    // ...

    @ExportMessage
    boolean isMemberModifiable(String member,
            @CachedLibrary("this") DynamicObjectLibrary instanceObjectLibrary,
            @CachedLibrary("this.classPrototypeObject") DynamicObjectLibrary prototypeObjectLibrary) {
        return this.isMemberReadable(member, instanceObjectLibrary, prototypeObjectLibrary);
    }

    @ExportMessage
    boolean isMemberInsertable(String member,
            @CachedLibrary("this") DynamicObjectLibrary instanceObjectLibrary,
            @CachedLibrary("this.classPrototypeObject") DynamicObjectLibrary dynamicObjectLibrary) {
        return !this.isMemberModifiable(member, instanceObjectLibrary, dynamicObjectLibrary);
    }

    @ExportMessage
    void writeMember(String member, Object value,
            @CachedLibrary("this") DynamicObjectLibrary dynamicObjectLibrary) {
        dynamicObjectLibrary.put(this, member, value);
    }
}
```

The capability to perform writes means we need to change the logic of reads.
Instead of always delegating to the prototype, like we did in the
[previous part](/graal-truffle-tutorial-part-12-classes-1-methods-new#class-instances),
we now need to first check if the given property is available on the object itself --
if it is, it shadows the one from the prototype:

```java
@ExportLibrary(InteropLibrary.class)
public class JavaScriptObject extends DynamicObject {
    // this can't be private, because it's used in specialization guard expressions
    final ClassPrototypeObject classPrototypeObject;

    public JavaScriptObject(Shape shape, ClassPrototypeObject classPrototypeObject) {
        super(shape);

        this.classPrototypeObject = classPrototypeObject;
    }

    @ExportMessage
    Object readMember(String member,
            @CachedLibrary("this") DynamicObjectLibrary thisObjectLibrary,
            @CachedLibrary("this.classPrototypeObject") DynamicObjectLibrary prototypeObjectLibrary)
            throws UnknownIdentifierException {
        Object value = thisObjectLibrary.getOrDefault(this, member, null);
        if (value == null) {
            value = prototypeObjectLibrary.getOrDefault(this.classPrototypeObject, member, null);
        }
        if (value == null) {
            throw UnknownIdentifierException.create(member);
        }
        return value;
    }

    @ExportMessage
    boolean isMemberReadable(String member,
            @CachedLibrary("this") DynamicObjectLibrary instanceObjectLibrary,
            @CachedLibrary("this.classPrototypeObject") DynamicObjectLibrary prototypeObjectLibrary) {
        return instanceObjectLibrary.containsKey(this, member) ||
                prototypeObjectLibrary.containsKey(this.classPrototypeObject, member);
    }

    @ExportMessage
    Object getMembers(@SuppressWarnings("unused") boolean includeInternal,
            @CachedLibrary("this") DynamicObjectLibrary dynamicObjectLibrary) {
        return new MemberNamesObject(dynamicObjectLibrary.getKeyArray(this));
    }

    // ...
}
```

Notice that we use two separate instances of `DynamicObjectLibrary`
to read from the two different objects -- this is the
[recommended way](https://www.graalvm.org/latest/graalvm-as-a-platform/language-implementation-framework/DynamicObjectModel/#caching-considerations)
of using dynamic libraries in Truffle.

Since we changed the built-in object classes, like functions and arrays,
to also extend the `JavaScriptObject` class,
we need to provide a Shape and a prototype when creating any instance of them.
This is where the `ShapesAndPrototypes` class we've seen earlier comes in handy,
since we can access it, through the Truffle language context,
in all Nodes that create these objects,
like the array literal expression Node:

```java
public final class ArrayLiteralExprNode extends EasyScriptExprNode {
    @Children
    private final EasyScriptExprNode[] arrayElementExprs;

    public ArrayLiteralExprNode(List<EasyScriptExprNode> arrayElementExprs) {
        this.arrayElementExprs = arrayElementExprs.toArray(new EasyScriptExprNode[]{});
    }

    @Override
    @ExplodeLoop
    public Object executeGeneric(VirtualFrame frame) {
        Object[] arrayElements = new Object[this.arrayElementExprs.length];
        for (var i = 0; i < this.arrayElementExprs.length; i++) {
            arrayElements[i] = this.arrayElementExprs[i].executeGeneric(frame);
        }
        ShapesAndPrototypes shapesAndPrototypes = this.currentLanguageContext().shapesAndPrototypes;
        return new ArrayObject(shapesAndPrototypes.arrayShape,
                shapesAndPrototypes.arrayPrototype, arrayElements);
    }
}
```

And `FuncDeclStmtNode`:

```java
@NodeChild(value = "containerObjectExpr", type = EasyScriptExprNode.class)
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

    @Specialization(limit = "1")
    protected Object declareFunction(DynamicObject containerObject,
            @CachedLibrary("containerObject") DynamicObjectLibrary objectLibrary) {
        if (this.cachedFunction == null) {
            CompilerDirectives.transferToInterpreterAndInvalidate();

            var truffleLanguage = this.currentTruffleLanguage();
            var funcRootNode = new StmtBlockRootNode(truffleLanguage, this.getFrameDescriptor(), this.getFuncBody());
            var callTarget = funcRootNode.getCallTarget();

            ShapesAndPrototypes shapesAndPrototypes = this.currentLanguageContext().shapesAndPrototypes;
            this.cachedFunction = new FunctionObject(shapesAndPrototypes.rootShape,
                    shapesAndPrototypes.functionPrototype, callTarget, this.getArgumentCount());
        }

        // we allow functions to be redefined, to comply with JavaScript semantics
        objectLibrary.putConstant(containerObject, this.getFuncName(), this.cachedFunction, 0);

        // we return 'undefined' for statements that declare functions
        return Undefined.INSTANCE;
    }
}
```

## `this` in function calls

We need to change how we perform function calls to provide the `this`
object as the first argument.

First, we add a new parameter to the `executeDispatch()`
method of `FunctionDispatchNode`,
and make sure that new argument is added to the beginning of the array that is passed to the `CallTarget`
representing a given function or method:

```java
public abstract class FunctionDispatchNode extends Node {
    // receiver is the new parameter here
    public abstract Object executeDispatch(Object function, Object[] arguments, Object receiver);

    @Specialization(guards = "function.callTarget == directCallNode.getCallTarget()", limit = "2")
    protected static Object dispatchDirectly(
            FunctionObject function, Object[] arguments, Object receiver,
            @Cached("create(function.callTarget)") DirectCallNode directCallNode) {
        return directCallNode.call(extendArguments(arguments, receiver, function));
    }

    @Specialization(replaces = "dispatchDirectly")
    protected static Object dispatchIndirectly(
            FunctionObject function, Object[] arguments, Object receiver,
            @Cached IndirectCallNode indirectCallNode) {
        return indirectCallNode.call(function.callTarget, extendArguments(arguments, receiver, function));
    }

    @Fallback
    protected static Object targetIsNotAFunction(
            Object nonFunction, Object[] arguments, Object receiver) {
        throw new EasyScriptException("'" + nonFunction + "' is not a function");
    }

    private static Object[] extendArguments(Object[] arguments, Object receiver, FunctionObject function) {
        int extendedArgumentsLength = function.argumentCount + 1;
        Object[] ret = new Object[extendedArgumentsLength];
        ret[0] = receiver;
        for (int i = 1; i < extendedArgumentsLength; i++) {
            int j = i - 1;
            // if a function was called with fewer arguments than it declares,
            // we fill them with `undefined`
            ret[i] = j < arguments.length ? arguments[j] : Undefined.INSTANCE;
        }
        return ret;
    }
}
```

Of course, this change in `executeDispatch()`
means we need to provide this new argument in the code that calls it,
in `FunctionCallExprNode`. But where does this new argument come from?

Currently, we don't differentiate between the receiver of a method call,
and the actual method itself, in our interpreter.
For example, in code like `myObj.myFunc(3)`,
we resolve `myObj.myFunc`, and then invoke the resulting `FunctionObject`.
But that means we need to create a new `FunctionObject` instance every time we resolve
`myObj.myFunc`, so that the invoking code can read its `methodTarget` field,
and pass it to `FunctionDispatchNode.executeDispatch()` as the first argument.
But, creating a new `FunctionObject` instance every time we perform a property read is not great for performance --
that's why we introduced caching of them in `ReadTruffleStringPropertyNode` in
[part 11](/graal-truffle-tutorial-part-11-strings-static-method-calls#reading-properties-of-trufflestring).

So, if we don't want to store the method target inside `FunctionObject`, what alternative do we have?

We can make a change to the way we evaluate expression Nodes,
so that it's possible to split execution into the target of a property access,
and the actual resolved value of that property for that target.
This way, in the above example with `myObj.myFunc(3)`,
we'll resolve `myObj` and `myFunc` separately,
and thus we'll be able to pass `myObj` into `FunctionDispatchNode.executeDispatch()`.

What does that look like in practice?
We introduce two new methods to the root of our expression Node hierarchy, `EasyScriptExprNode`:

```java
@TypeSystemReference(EasyScriptTypeSystem.class)
public abstract class EasyScriptExprNode extends EasyScriptNode {
    // ...

    public Object evaluateAsReceiver(VirtualFrame frame) {
        return Undefined.INSTANCE;
    }

    public Object evaluateAsFunction(VirtualFrame frame, Object receiver) {
        return this.executeGeneric(frame);
    }
}
```

We need to make sure we don't name these new methods with the "execute" prefix,
as that would make them part of the Truffle DSL,
which we don't want
(since `evaluateAsFunction()` has a different signature than `executeGeneric()`,
they would conflict otherwise).

The first method, `evaluateAsReceiver()`, is supposed to return the target of a property access.
The second method, `evaluateAsFunction()`,
takes the receiver of the property access produced by `evaluateAsReceiver()` as an argument,
and returns the actual value of the entire expression, which most likely results in a `FunctionObject`,
hence its name.
So, for the above example of `myObj.myFunc(3)`,
`evaluateAsReceiver()` returns `myObj`, and `evaluateAsFunction()`
returns the result of looking up `myFunc` in `myObj`.

Almost all expression Nodes will use the provided default implementations of
`evaluateAsReceiver()` and `evaluateAsFunction()`
(which are simply to return `undefined`, and delegate to `executeGeneric()`, respectively).
The only exceptions are our two property access expression Nodes.

In `FunctionCallExprNode`,
we can now use these new methods instead of `executeGeneric()`
to get the new argument we need to call `FunctionDispatchNode.executeDispatch()`:

```java
public final class FunctionCallExprNode extends EasyScriptExprNode {
    @SuppressWarnings("FieldMayBeFinal")
    @Child
    private EasyScriptExprNode targetFunction;

    @Children
    private final EasyScriptExprNode[] callArguments;

    @SuppressWarnings("FieldMayBeFinal")
    @Child
    private FunctionDispatchNode dispatchNode;

    public FunctionCallExprNode(EasyScriptExprNode targetFunction, List<EasyScriptExprNode> callArguments) {
        this.targetFunction = targetFunction;
        this.callArguments = callArguments.toArray(new EasyScriptExprNode[]{});
        this.dispatchNode = FunctionDispatchNodeGen.create();
    }

    @Override
    @ExplodeLoop
    public Object executeGeneric(VirtualFrame frame) {
        Object receiver = this.targetFunction.evaluateAsReceiver(frame);
        Object function = this.targetFunction.evaluateAsFunction(frame, receiver);

        Object[] argumentValues = new Object[this.callArguments.length];
        for (int i = 0; i < this.callArguments.length; i++) {
            argumentValues[i] = this.callArguments[i].executeGeneric(frame);
        }

        return this.dispatchNode.executeDispatch(function, argumentValues, receiver);
    }
}
```

This means that for a global function (as opposed to method) call,
the `this` argument will be passed as `undefined` in EasyScript.
That's different from JavaScript, where `this` in those situations is the global object,
but I think this behavior is a sensible compromise for this edge case,
as most languages don't have this "global object" concept at all.

## Reading properties

So, how do our property read expression Nodes implement these new methods?
They return the object part of the property access expression in `evaluateAsReceiver()`,
and the result of looking up the property in that object in `evaluateAsFunction()`.

In order to not have any duplication between the execution in `executeGeneric()`
and `evaluateAsFunction()`, we would like to call the one specialization in `PropertyReadExprNode`
from `evaluateAsFunction()`. However, that specialization uses the `@Cached` annotation
to get an instance of `CommonReadPropertyNode`, which it delegates to,
and we don't have a simple way to get an instance of `CommonReadPropertyNode`
in `evaluateAsFunction()`, as that is not a specialization method,
so it can't use the `@Cached` annotation.

We can sidestep this issue by creating an instance of `CommonReadPropertyNode`,
and saving it in an instance field of `PropertyReadExprNode` annotated with `@Child`,
instead of using `@Cached` in the specialization:

```java
@NodeChild("targetExpr")
@NodeField(name = "propertyName", type = String.class)
public abstract class PropertyReadExprNode extends EasyScriptExprNode {
    protected abstract EasyScriptExprNode getTargetExpr();
    protected abstract String getPropertyName();

    @SuppressWarnings("FieldMayBeFinal")
    @Child
    private CommonReadPropertyNode commonReadPropertyNode =
            CommonReadPropertyNodeGen.create();

    @Specialization
    protected Object readProperty(Object target) {
        return this.commonReadPropertyNode.executeReadProperty(
                target, this.getPropertyName());
    }

    @Override
    public Object evaluateAsReceiver(VirtualFrame frame) {
        return this.getTargetExpr().executeGeneric(frame);
    }

    @Override
    public Object evaluateAsFunction(VirtualFrame frame, Object receiver) {
        return this.readProperty(receiver);
    }
}
```

For `ArrayIndexReadExprNode`, however, things are a little bit more tricky,
because this class has not just one, but four specializations since
[part 11](/graal-truffle-tutorial-part-11-strings-static-method-calls#caching-in-arrayindexreadexprnode).
So, we can't simply delegate to the one specialization from `evaluateAsFunction()`,
like we did in `PropertyReadExprNode`.

To solve this issue, we can use a simple trick: introduce another layer of indirection.
We can move all existing specializations of `ArrayIndexReadExprNode` into a new static Node class nested inside it:

```java
@NodeChild("arrayExpr")
@NodeChild("indexExpr")
public abstract class ArrayIndexReadExprNode extends EasyScriptExprNode {
    @ImportStatic(EasyScriptTruffleStrings.class)
    static abstract class InnerNode extends Node {
        abstract Object executeIndexRead(Object array, Object index);

        @Specialization(guards = "arrayInteropLibrary.isArrayElementReadable(array, index)", limit = "2")
        protected Object readIntIndexOfArray(
                Object array, int index,
                @CachedLibrary("array") InteropLibrary arrayInteropLibrary) {
            try {
                return arrayInteropLibrary.readArrayElement(array, index);
            } catch (UnsupportedMessageException | InvalidArrayIndexException e) {
                throw new EasyScriptException(this, e.getMessage());
            }
        }

        @Specialization(guards = "equals(propertyName, cachedPropertyName, equalNode)", limit = "2")
        protected Object readTruffleStringPropertyOfObjectCached(
                Object target, TruffleString propertyName,
                @Cached TruffleString.EqualNode equalNode,
                @Cached("propertyName") TruffleString cachedPropertyName,
                @Cached TruffleString.ToJavaStringNode toJavaStringNode,
                @Cached("toJavaStringNode.execute(cachedPropertyName)") String javaStringPropertyName,
                @Cached CommonReadPropertyNode commonReadPropertyNode) {
            return commonReadPropertyNode.executeReadProperty(target, javaStringPropertyName);
        }

        @Specialization(replaces = "readTruffleStringPropertyOfObjectCached")
        protected Object readTruffleStringPropertyOfObjectUncached(
                Object target, TruffleString propertyName,
                @Cached TruffleString.ToJavaStringNode toJavaStringNode,
                @Cached CommonReadPropertyNode commonReadPropertyNode) {
            return commonReadPropertyNode.executeReadProperty(target,
                    toJavaStringNode.execute(propertyName));
        }

        @Specialization(guards = "interopLibrary.hasMembers(target)", limit = "2")
        protected Object readNonTruffleStringPropertyOfObject(
                Object target, Object property,
                @CachedLibrary("target") InteropLibrary interopLibrary,
                @Cached CommonReadPropertyNode commonReadPropertyNode) {
            return commonReadPropertyNode.executeReadProperty(
                    target, EasyScriptTruffleStrings.toString(property));
        }

        @Fallback
        protected Object readNonTruffleStringPropertyOfNonObject(
                Object target, Object index,
                @Cached CommonReadPropertyNode commonReadPropertyNode) {
            return commonReadPropertyNode.executeReadProperty(target, index);
        }
    }

    // ...
}
```

Note that we had to add a new specialization when the index didn't evaluate to a string,
in which case we convert it to one before delegating to `CommonReadPropertyNode`,
similarly like we did in `ArrayIndexWriteExprNode`.
But here, we also need the fallback specialization, in case the expression is indexing a string, in code such as `myStr[0]`
(this was not a concern in `ArrayIndexWriteExprNode`, since strings are immutable in JavaScript,
which means both expressions like `myStr[undefined] = value`, as well as `myStr[0] = value`,
have no effect, so we could handle both with one specialization).

Then, we can simply create an instance of this inner class,
save it as a `@Child` field of `ArrayIndexReadExprNode`,
and we now can have a single specialization in the outer class that just delegates to that inner Node.
This way, that same one specialization can be called from
`evaluateAsFunction()`:

```java
@NodeChild("arrayExpr")
@NodeChild("indexExpr")
public abstract class ArrayIndexReadExprNode extends EasyScriptExprNode {
    // ...

    protected abstract EasyScriptExprNode getArrayExpr();
    protected abstract EasyScriptExprNode getIndexExpr();

    @SuppressWarnings("FieldMayBeFinal")
    @Child
    private InnerNode innerNode =
            ArrayIndexReadExprNodeGen.InnerNodeGen.create();

    @Specialization
    protected Object readIndexOrProperty(Object target, Object indexOrProperty) {
        return this.innerNode.executeIndexRead(target, indexOrProperty);
    }

    @Override
    public Object evaluateAsReceiver(VirtualFrame frame) {
        return this.getArrayExpr().executeGeneric(frame);
    }

    @Override
    public Object evaluateAsFunction(VirtualFrame frame, Object receiver) {
        Object property = this.getIndexExpr().executeGeneric(frame);
        return this.readIndexOrProperty(receiver, property);
    }
}
```

## Strings

With all of this in place, we can simplify the `TruffleString` property resolution.
In [part 11](/graal-truffle-tutorial-part-11-strings-static-method-calls#reading-properties-of-trufflestring),
we had two specializations for each built-in method of strings we wanted to support,
which meant adding a new built-in string method required writing two new specializations each time.
But now that we changed how method calls resolve their target,
we don't need to do any of that complicated target caching anymore,
and we can just read the method to call directly from the String prototype:

```java
public abstract class ReadTruffleStringPropertyNode extends EasyScriptNode {
    protected static final String LENGTH_PROP = "length";

    public abstract Object executeReadTruffleStringProperty(TruffleString truffleString, Object property);

    @Specialization
    protected Object readStringIndex(
            TruffleString truffleString, int index,
            @Cached TruffleString.CodePointLengthNode lengthNode,
            @Cached TruffleString.SubstringNode substringNode) {
        return index < 0 || index >= EasyScriptTruffleStrings.length(truffleString, lengthNode)
                ? Undefined.INSTANCE
                : EasyScriptTruffleStrings.substring(truffleString, index, 1, substringNode);
    }

    @Specialization(guards = "LENGTH_PROP.equals(propertyName)")
    protected int readLengthProperty(
            TruffleString truffleString, String propertyName,
            @Cached TruffleString.CodePointLengthNode lengthNode) {
        return EasyScriptTruffleStrings.length(truffleString, lengthNode);
    }

    @Fallback
    protected Object readNonLengthProperty(
            TruffleString truffleString, Object property,
            @Cached("currentLanguageContext().shapesAndPrototypes.stringPrototype") ClassPrototypeObject stringPrototype,
            @CachedLibrary(limit = "2") DynamicObjectLibrary stringPrototypeObjectLibrary) {
        return stringPrototypeObjectLibrary.getOrDefault(stringPrototype, property,
                Undefined.INSTANCE);
    }
}
```

Since strings are immutable, we can just read the value directly from the prototype,
without worrying the instance will have a shadowing property
(unlike with mutable objects).

Note that we still need the first two specializations,
as they handle indexing into a string with integers,
and reading the `length` property, which is special.

With this in place, if we wanted to support more built-in methods of strings than just `charAt`,
we would only need to implement the logic for it inside a new Node class that extends `BuiltInFunctionBodyExprNode`,
and then add it to the string prototype that we create in `EasyScriptTruffleLanguage` --
no changes would be needed in `ReadTruffleStringPropertyNode` when adding a new built-in string method!

## Constructors

And finally, there's one last important aspect of storing state in classes -- constructors.
These are special methods that get automatically invoked when an instance of a given class is created.
It allows ensuring that the instance is properly initialized,
and all of its fields are correctly set up, before it's used.

In many object-oriented languages, constructors have their own syntax.
However, in JavaScript, they are a method like any other,
just with the special name "constructor".

To support them, we have to make a small change to `NewExprNode`.
We add a child `FunctionDispatchNode` that we save as a field of the Node.
When we instantiate the new instance,
we check whether its class's prototype has a property named "constructor",
and if it does, we call it with the provided arguments,
making sure to pass the newly created instance as the receiver:

```java
public abstract class NewExprNode extends EasyScriptExprNode {
    @Child
    @Executed
    protected EasyScriptExprNode constructorExpr;

    @Children
    private final EasyScriptExprNode[] args;

    @SuppressWarnings("FieldMayBeFinal")
    @Child
    private FunctionDispatchNode constructorDispatchNode;

    protected NewExprNode(EasyScriptExprNode constructorExpr, List<EasyScriptExprNode> args) {
        this.constructorExpr = constructorExpr;
        this.args = args.toArray(EasyScriptExprNode[]::new);
        this.constructorDispatchNode = FunctionDispatchNodeGen.create();
    }

    @Specialization(limit = "2")
    protected Object instantiateObject(
            VirtualFrame frame, ClassPrototypeObject classPrototypeObject,
            @CachedLibrary("classPrototypeObject") DynamicObjectLibrary dynamicObjectLibrary) {
        var object = new JavaScriptObject(this.currentLanguageContext().shapesAndPrototypes.rootShape, classPrototypeObject);
        var constructor = dynamicObjectLibrary.getOrDefault(classPrototypeObject, "constructor", null);
        if (constructor instanceof FunctionObject) {
            Object[] args = this.executeArguments(frame);
            var boundConstructor = (FunctionObject) constructor;
            this.constructorDispatchNode.executeDispatch(boundConstructor, args, object);
        } else {
            this.consumeArguments(frame);
        }
        return object;
    }

    @Fallback
    protected Object instantiateNonConstructor(VirtualFrame frame, Object object) {
        this.consumeArguments(frame);
        throw new EasyScriptException("'" + object + "' is not a constructor");
    }

    @ExplodeLoop
    private void consumeArguments(VirtualFrame frame) {
        for (int i = 0; i < this.args.length; i++) {
            this.args[i].executeGeneric(frame);
        }
    }

    @ExplodeLoop
    private Object[] executeArguments(VirtualFrame frame) {
        var args = new Object[this.args.length];
        for (int i = 0; i < this.args.length; i++) {
            args[i] = this.args[i].executeGeneric(frame);
        }
        return args;
    }
}
```

We use Java's `instanceof` operator for checking whether a given class has a constructor defined --
since `instanceof` always returns `false` for `null`,
that saves us from having to check for `null` explicitly.

## Benchmark

With all the functionality now in place,
we can write a benchmark that counts in a loop,
and stores the current count inside a class instance:

```java
public class CounterThisBenchmark extends TruffleBenchmark {
    private static final int INPUT = 1_000_000;

    private static final String COUNTER_CLASS = "" +
            "class Counter { " +
            "    constructor() { " +
            "        this.count = 0; " +
            "    } " +
            "    increment() { " +
            "        this.count = this.count + 1; " +
            "    } " +
            "    getCount() { " +
            "        return this.count; " +
            "    } " +
            "} ";

    private static final String COUNT_WITH_THIS_IN_FOR = "" +
            "function countWithThisInForDirect(n) { " +
            "    const counter = new Counter(); " +
            "    for (let i = 0; i < n; i = i + 1) { " +
            "        counter.increment(); " +
            "    } " +
            "    return counter.getCount(); " +
            "} ";

    @Override
    public void setup() {
        super.setup();

        this.truffleContext.eval("ezs", COUNTER_CLASS);
        this.truffleContext.eval("ezs", COUNT_WITH_THIS_IN_FOR);

        this.truffleContext.eval("js", COUNTER_CLASS);
        this.truffleContext.eval("js", COUNT_WITH_THIS_IN_FOR);
    }

    @Benchmark
    public int count_with_this_in_for_direct_ezs() {
        return this.truffleContext.eval("ezs", "countWithThisInForDirect(" + INPUT + ");").asInt();
    }

    @Benchmark
    public int count_with_this_in_for_direct_js() {
        return this.truffleContext.eval("js", "countWithThisInForDirect(" + INPUT + ");").asInt();
    }
    
    // ...
}
```

We call the `increment()` method on the `Counter` class in a loop,
and then get the final value of the count from the instance with the `getCount()` method.
We initialize the count to be `0` in the constructor of the class.

As usual, we have two variants of the benchmark:
one with direct property access, shown above,
and then a second one with indexed property access:

```java
public class CounterThisBenchmark extends TruffleBenchmark {
    // ...

    private static final String COUNTER_CLASS_INDEXED = "" +
            "class CounterIndexed { " +
            "    constructor() { " +
            "        this['count'] = 0; " +
            "    } " +
            "    increment() { " +
            "        this['count'] = this['count'] + 1; " +
            "    } " +
            "    getCount() { " +
            "        return this['count']; " +
            "    } " +
            "}";

    private static final String COUNT_WITH_THIS_IN_FOR_INDEXED = "" +
            "function countWithThisInForIndexed(n) { " +
            "    const counter = new CounterIndexed(); " +
            "    for (let i = 0; i < n; i = i + 1) { " +
            "        counter['increment'](); " +
            "    } " +
            "    return counter['getCount'](); " +
            "}";

    @Override
    public void setup() {
        // ...

        this.truffleContext.eval("ezs", COUNTER_CLASS_INDEXED);
        this.truffleContext.eval("ezs", COUNT_WITH_THIS_IN_FOR_INDEXED);

        this.truffleContext.eval("js", COUNTER_CLASS_INDEXED);
        this.truffleContext.eval("js", COUNT_WITH_THIS_IN_FOR_INDEXED);
    }
    
    // ...

    @Benchmark
    public int count_with_this_in_for_indexed_ezs() {
        return this.truffleContext.eval("ezs", "countWithThisInForIndexed(" + INPUT + ");").asInt();
    }

    @Benchmark
    public int count_with_this_in_for_indexed_js() {
        return this.truffleContext.eval("js", "countWithThisInForIndexed(" + INPUT + ");").asInt();
    }
}
```

Let's check what is the performance difference between them:

```shell-session
Benchmark                                                Mode  Cnt    Score    Error  Units
CounterThisBenchmark.count_with_this_in_for_direct_ezs   avgt    5  577.478 ± 36.396  us/op
CounterThisBenchmark.count_with_this_in_for_direct_js    avgt    5  571.999 ± 21.203  us/op
CounterThisBenchmark.count_with_this_in_for_indexed_ezs  avgt    5  579.777 ± 31.468  us/op
CounterThisBenchmark.count_with_this_in_for_indexed_js   avgt    5  576.204 ± 25.755  us/op
```

As we can see, the two variants have pretty much identical performance,
both in the GraalVM JavaScript implementation, and in EasyScript.

## Summary

So, this is how fields and constructors can be implemented in Truffle.

As usual, all the code from the article
[is available on GitHub](https://github.com/skinny85/graalvm-truffle-tutorial/tree/master/part-13).

In the next part of the tutorial,
we will conclude our miniseries about classes by discussing inheritance.
