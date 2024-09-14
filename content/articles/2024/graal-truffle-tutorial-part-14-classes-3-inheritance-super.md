---
id: 76
layout: truffle-tutorial.html
title: "Graal Truffle tutorial part 14 – classes 3: inheritance, super"
summary: |
   In the fourteenth part of the Truffle tutorial,
   we conclude the miniseries on implementing classes by adding support for inheritance,
   and the "super" keyword.
created_at: 2024-05-26
---

## Introduction

In the [previous chapter](/graal-truffle-tutorial-part-13-classes-2-fields-this-constructors)
of the tutorial on GraalVM Truffle,
we added the capability to store state inside class instances to EasyScript,
our example programming language that is a simplified subset of JavaScript.

In this part, we conclude the miniseries on classes by implementing
[inheritance](https://en.wikipedia.org/wiki/Inheritance_(object-oriented_programming%29),
meaning the capability of a class to extend another class.
In addition, we'll also add support for the `super` keyword,
which allows referencing properties of the parent of the current class.

## Inheritance

Inheritance is the ability of a class to extend another class,
and in this way include (or "inherit", hence the name)
the functionality of the parent class in the child class.
After that including, the child class can then modify any behavior it inherited from the superclass,
which is commonly referred to as "overriding".

While this may sound complicated to implement at first,
it's actually just a small additional step compared to the functionality we have in EasyScript today.

For example, let's say we have a class `C`,
and an instance of it, `obj`,
and we invoke a method called `m` on `obj`:

```javascript
class C {
    // ...
}

let obj = new C();
// ...

obj.m();
```

When searching for `m` in `obj`,
the algorithm implemented in the
[previous part](/graal-truffle-tutorial-part-13-classes-2-fields-this-constructors)
is as follows:

1. Do the properties of `obj` itself contain `m`? If they do, return its value.
2. If they don't, search for `m` in the properties of the prototype of the class of `obj`, `C`.
   If it contains a property called `m`, return its value.
3. If `m` was not found inside the prototype of `C`, return `undefined`.

![simple inheritance](/img/truffle/part-14/inheritance-single.png)

Inheritance is very similar, it just expands the last part of the above algorithm slightly.

So, if we now want to allow `C` to extend another class `B`,
which extends a different class `A`:

```javascript
class A {
    // ...
}

class B extends A {
    // ...
}

class C extends B {
    // ...
}

let obj = new C();
// ...

obj.m();
```

The algorithm of searching for `m` in `obj` is very similar:

1. Do the properties of `obj` itself contain `m`? If they do, return its value.
2. If they don’t, search for `m` in the properties of the prototype of the class of `obj`, `C`.
   If it contains a property called `m`, return its value.
3. If `m` was not found inside the prototype of `C`, does `C` have a parent class?
   If it does, search for `m` inside the prototype of the parent class of `C`
   (which is `B` in our example).
4. Continue the above process until either finding the property,
   or reaching a class that doesn't have a parent class,
   at which point the result is `undefined`.

In most object-oriented languages, including JavaScript
(C++ is a notable exception),
there is a special, built-in class that is the root of the class hierarchy.
It's typically called `Object`,
and is the only class that doesn't have a superclass
(if a class declaration omits the `extends` keyword,
that means it implicitly extends `Object`).

![multi inheritance](/img/truffle/part-14/inheritance-multi.png)

We'll add `Object` to EasyScript alongside support for inheritance.

### Parsing

To implement the capability of allowing classes to have a parent class,
as usual, we start with the language's
[ANTLR](https://www.antlr.org)
grammar changes.

We need to expand the class declaration statement to allow the optional `extends` clause:

```shell-session
stmt : 'class' classs=ID ('extends' super_class=ID)? '{' class_member* '}' ';'? #ClassDeclStmt
       ...
```

In order to correctly set up the inheritance chain,
we need to access the prototype of a given class when it's referenced in the `extends` clause.
We already have a `Stack` of `Map`s that stores local variables and function arguments.
We add a new, third, type of value stored in that `Map`
that represents a class prototype.
We initialize it with `"Object"` as the only prototype we know of to start,
an instance of which we get in the constructor of the parser class
(which will be called by the `TruffleLanguage` implementation for this part):

```java
import com.oracle.truffle.api.object.Shape;

public final class EasyScriptTruffleParser {
    // ...

    private static abstract class FrameMember {}
    // ...
    private static final class ClassPrototypeMember extends FrameMember {
        public final ClassPrototypeObject classPrototypeObject;

        ClassPrototypeMember(ClassPrototypeObject classPrototypeObject) {
            this.classPrototypeObject = classPrototypeObject;
        }
    }

    private final Shape objectShape;
    private Stack<Map<String, FrameMember>> localScopes;
    private ClassPrototypeObject currentClassPrototype;

    private EasyScriptTruffleParser(Shape objectShape, ObjectPrototype objectPrototype) {
        // ...
        this.objectShape = objectShape;
        this.localScopes = new Stack<>();
        Map<String, FrameMember> classPrototypes = new HashMap<>();
        classPrototypes.put("Object", new ClassPrototypeMember(objectPrototype));
        this.localScopes.push(classPrototypes);
        this.currentClassPrototype = null;
    }

    // ...
}
```

Then, during the parsing of the class declaration statement,
we find the class prototype of the parent class
(`"Object"` if the `extends` clause was omitted),
and then add the prototype of the current class to that `Map`:

```java
public final class EasyScriptTruffleParser {
    // ...

    private EasyScriptStmtNode parseClassDeclStmt(EasyScriptParser.ClassDeclStmtContext classDeclStmt) {
        if (this.state == ParserState.FUNC_DEF) {
            throw new EasyScriptException("classes nested in functions are not supported in EasyScript");
        }

        String className = classDeclStmt.classs.getText();
        String superClass = classDeclStmt.super_class == null
                ? "Object"
                : classDeclStmt.super_class.getText();
        ClassPrototypeObject classPrototype;
        FrameMember frameMember = this.localScopes.get(0).get(superClass);
        if (frameMember instanceof ClassPrototypeMember) {
            ClassPrototypeObject superClassPrototype = ((ClassPrototypeMember) frameMember).classPrototypeObject;
            classPrototype = new ClassPrototypeObject(this.objectShape, className, superClassPrototype);
        } else {
            throw new EasyScriptException("class '" + className + "' extends unknown class '" + superClass + "'");
        }
        this.localScopes.get(0).put(className, new ClassPrototypeMember(classPrototype));
        this.currentClassPrototype = classPrototype;

        List<FuncDeclStmtNode> classMethods = new ArrayList<>();
        for (var classMember : classDeclStmt.class_member()) {
            classMethods.add(this.parseSubroutineDecl(classMember.subroutine_decl(),
                    new DynamicObjectReferenceExprNode(classPrototype)));
        }

        this.currentClassPrototype = null;
        return GlobalVarDeclStmtNodeGen.create(
                GlobalScopeObjectExprNodeGen.create(),
                new ClassDeclExprNode(classMethods, classPrototype),
                className, DeclarationKind.LET);
    }
}
```

### Objects and prototypes

In order to correctly implement the inheritance chain in class prototypes,
we need to add a field to the `ClassPrototypeObject`
class that points to the parent class's prototype (if it has one).
However, we have a `DynamicObject` in our implementation that does that already -- `JavaScriptObject`!
So, in this part, we unify the two classes by making `ClassPrototypeObject` inherit from `JavaScriptObject`.

However, the `Object` prototype is special, as it's the root of the hierarchy,
and thus is the only prototype which itself doesn't have a parent prototype.
The natural solution would be to pass `null` to `JavaScriptObject` as the prototype in that case,
but we can't do that, because we use the `@CachedLibrary` annotation in `JavaScriptObject`
with the prototype field, and you can't use `@CachedLibrary` with `null` values.

In order to solve that problem, we change the prototype field in `JavaScriptObject`
to be of type `DynamicObject` instead of `ClassPrototypeObject`,
as  keeping it a `ClassPrototypeObject`, which now extends `JavaScriptObject`,
would require us to pass a prototype of type `ClassPrototypeObject`
to create an instance of `ClassPrototypeObject`, which is an infinite recursion --
so, we break that dependency by using `DynamicObject`:

```java
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.library.ExportMessage;
import com.oracle.truffle.api.object.DynamicObject;
import com.oracle.truffle.api.object.Shape;

@ExportLibrary(InteropLibrary.class)
public class JavaScriptObject extends DynamicObject {
    public final DynamicObject prototype;

    public JavaScriptObject(Shape shape, DynamicObject prototype) {
        super(shape);

        this.prototype = prototype;
    }

    @Override
    public String toString() {
        return "[object Object]";
    }

    @ExportMessage
    Object toDisplayString(@SuppressWarnings("unused") boolean allowSideEffects) {
        return this.toString();
    }

    @ExportMessage
    boolean hasMembers() {
        return true;
    }

    // ...
}
```

```java
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.library.ExportMessage;
import com.oracle.truffle.api.object.DynamicObject;
import com.oracle.truffle.api.object.Shape;

@ExportLibrary(InteropLibrary.class)
public class ClassPrototypeObject extends JavaScriptObject {
    private final String className;

    public ClassPrototypeObject(Shape shape, String className, DynamicObject prototype) {
        super(shape, prototype);

        this.className = className;
    }

    @Override
    public String toString() {
        return "[class " + this.className + "]";
    }

    @ExportMessage
    Object toDisplayString(@SuppressWarnings("unused") boolean allowSideEffects) {
        return this.toString();
    }
}
```

We create a separate subclass of `ClassPrototypeObject` that represents the `Object` prototype.
It passes an empty, anonymous subclass of `DynamicObject`
(which is abstract, so cannot be instantiated directly)
to the constructor of `ClassPrototypeObject`,
and overrides the interop message implementations to not use the prototype field at all
(as that empty anonymous subclass of `DynamicObject` obviously doesn't implement any interop messages itself,
so we don't want the interop message implementations from `JavaScriptObject` to delegate to it):

```java
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.UnknownIdentifierException;
import com.oracle.truffle.api.library.CachedLibrary;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.library.ExportMessage;
import com.oracle.truffle.api.object.DynamicObject;
import com.oracle.truffle.api.object.DynamicObjectLibrary;
import com.oracle.truffle.api.object.Shape;

@ExportLibrary(InteropLibrary.class)
public final class ObjectPrototype extends ClassPrototypeObject {
    public ObjectPrototype(Shape shape) {
        super(shape, "Object", new DynamicObject(shape) {});
    }

    @ExportMessage
    boolean isMemberReadable(String member,
            @CachedLibrary("this") DynamicObjectLibrary thisObjectLibrary) {
        return thisObjectLibrary.containsKey(this, member);
    }

    @ExportMessage
    Object readMember(String member,
            @CachedLibrary("this") DynamicObjectLibrary thisObjectLibrary)
            throws UnknownIdentifierException {
        Object value = thisObjectLibrary.getOrDefault(this, member, null);
        if (value == null) {
            throw UnknownIdentifierException.create(member);
        }
        return value;
    }

    @ExportMessage
    boolean isMemberModifiable(String member,
            @CachedLibrary("this") DynamicObjectLibrary thisObjectLibrary) {
        return this.isMemberReadable(member, thisObjectLibrary);
    }

    @ExportMessage
    boolean isMemberInsertable(String member,
            @CachedLibrary("this") DynamicObjectLibrary thisObjectLibrary) {
        return !this.isMemberModifiable(member, thisObjectLibrary);
    }
}
```

We implement the inheritance chain for property reads in the
[`readMember()` message from `InteropLibrary`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/interop/InteropLibrary.html#readMember(java.lang.Object,java.lang.String%29)
by calling the `readMember()`
message on the prototype if the given property was not found on the object itself:

```java
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.UnknownIdentifierException;
import com.oracle.truffle.api.interop.UnsupportedMessageException;
import com.oracle.truffle.api.library.CachedLibrary;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.library.ExportMessage;
import com.oracle.truffle.api.object.DynamicObject;
import com.oracle.truffle.api.object.DynamicObjectLibrary;

@ExportLibrary(InteropLibrary.class)
public class JavaScriptObject extends DynamicObject {
    public final DynamicObject prototype;

    // ...

    @ExportMessage
    boolean isMemberReadable(String member,
            @CachedLibrary("this") DynamicObjectLibrary thisObjectLibrary,
            @CachedLibrary("this.prototype") InteropLibrary prototypeInteropLibrary) {
        return thisObjectLibrary.containsKey(this, member) ||
                prototypeInteropLibrary.isMemberReadable(this.prototype, member);
    }

    @ExportMessage
    Object readMember(String member,
            @CachedLibrary("this") DynamicObjectLibrary thisObjectLibrary,
            @CachedLibrary("this.prototype") InteropLibrary prototypeInteropLibrary)
            throws UnknownIdentifierException, UnsupportedMessageException {
        Object value = thisObjectLibrary.getOrDefault(this, member, null);
        if (value == null) {
            return prototypeInteropLibrary.readMember(this.prototype, member);
        }
        return value;
    }

    @ExportMessage
    Object getMembers(@SuppressWarnings("unused") boolean includeInternal,
            @CachedLibrary("this") DynamicObjectLibrary thisObjectLibrary) {
        return new MemberNamesObject(thisObjectLibrary.getKeyArray(this));
    }

    @ExportMessage
    boolean isMemberModifiable(String member,
            @CachedLibrary("this") DynamicObjectLibrary thisObjectLibrary,
            @CachedLibrary("this.prototype") InteropLibrary prototypeInteropLibrary) {
        return this.isMemberReadable(member, thisObjectLibrary, prototypeInteropLibrary);
    }

    @ExportMessage
    boolean isMemberInsertable(String member,
            @CachedLibrary("this") DynamicObjectLibrary thisObjectLibrary,
            @CachedLibrary("this.prototype") InteropLibrary prototypeInteropLibrary) {
        return !this.isMemberModifiable(member, thisObjectLibrary, prototypeInteropLibrary);
    }

    @ExportMessage
    void writeMember(String member, Object value,
            @CachedLibrary("this") DynamicObjectLibrary thisObjectLibrary) {
        thisObjectLibrary.put(this, member, value);
    }
}
```

This code covers both the case when `JavaScriptObject`
represents a class instance, or when it represents a class prototype
(except the `Object` prototype, of course, which we saw above in the `ObjectPrototype` class).

With this code in place, we don't even have to change the logic of reading properties in `CommonReadPropertyNode`;
since that Node already uses the `InteropLibrary.readMember()` message,
using it will correctly implement the inheritance property search algorithm we showed above.

Note that in JavaScript, it's also possible to change the prototype of an object
with the [`Object.setPrototype()` static method](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/setPrototypeOf),
but I've never seen a good justification for doing that in real-world code --
so, I'm not including an implementation of that method in EasyScript,
and I'm making the `prototype` field in `JavaScriptObject` `final`.

### Constructor inheritance

In JavaScript, since constructors are just regular properties like any other,
they are also inherited automatically,
which is different from languages like Java.

Because of that, we need to change the logic of finding the constructor in `NewExprNode`
to use the `InteropLibrary` instead of `DynamicObjectLibrary` to find the constructor,
in case it's defined in an ancestor of the given class:

```java
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.UnknownIdentifierException;
import com.oracle.truffle.api.interop.UnsupportedMessageException;
import com.oracle.truffle.api.library.CachedLibrary;

public abstract class NewExprNode extends EasyScriptExprNode {
    // ...

    @Specialization(limit = "2")
    protected Object instantiateObject(VirtualFrame frame, ClassPrototypeObject classPrototypeObject,
            @CachedLibrary("classPrototypeObject") InteropLibrary interopPrototypeLibrary) {
        var object = new JavaScriptObject(this.currentLanguageContext().shapesAndPrototypes.rootShape, classPrototypeObject);
        Object constructor = null;
        try {
            constructor = interopPrototypeLibrary.readMember(classPrototypeObject, "constructor");
        } catch (UnknownIdentifierException e) {
            // fall through to below
        } catch (UnsupportedMessageException e) {
            throw new EasyScriptException(this, e.getMessage());
        }
        if (constructor instanceof FunctionObject) {
            // instanceof always returns 'false' for 'null'
            Object[] args = this.executeArguments(frame);
            var boundConstructor = (FunctionObject) constructor;
            this.constructorDispatchNode.executeDispatch(boundConstructor, args, object);
        } else {
            this.consumeArguments(frame);
        }
        return object;
    }

    // ...
}
```

### Inherited methods from `Object`

Whenever you have a common root of the class hierarchy,
it typically has some shared methods that can be used by all objects.
The JavaScript `Object` has
[several instance methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object#instance_methods);
we will implement [`hasOwnProperty()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwnProperty)
as an illustrative example.

Its implementation will be similar to the `charAt()` method of `String` from
[part 11](/graal-truffle-tutorial-part-11-strings-static-method-calls#method-implementation) --
a single expression Node that extends `BuiltInFunctionBodyExprNode`.

We will need the following specializations:

1. For objects, we just use the `DynamicObjectLibrary` to check whether it contains the given key.
2. For strings, they only have the `length` property, so just compare the property to the string `"length"`.
3. For primitives like numbers and booleans, always return `false`.

The complication is that we have to convert any property name passed as an argument to `hasOwnProperty()`
to a Java `String`, same as we did with property accesses in the
[previous part](/graal-truffle-tutorial-part-13-classes-2-fields-this-constructors#field-writes).
We could define additional specializations that handle `TruffleString` specially,
and cache the Java `String`s resulting from converting `TruffleString`s,
like we do in `ArrayIndexReadNode` and `ArrayIndexWriteNode`.
We won't do that here, as it would make the code much more verbose,
and we'll just use `EasyScriptTruffleStrings.toString()` instead,
since `hasOwnProperty()` is unlikely to be used in performance-critical code --
however, feel free to change that in your own implementation:

```java
import com.oracle.truffle.api.dsl.Fallback;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.library.CachedLibrary;
import com.oracle.truffle.api.object.DynamicObject;
import com.oracle.truffle.api.object.DynamicObjectLibrary;
import com.oracle.truffle.api.strings.TruffleString;

public abstract class HasOwnPropertyMethodBodyExprNode extends BuiltInFunctionBodyExprNode {
    @Specialization(limit = "2")
    protected boolean hasOwnPropertyDynamicObject(
            DynamicObject self, Object property,
            @CachedLibrary("self") DynamicObjectLibrary dynamicObjectLibrary) {
        return dynamicObjectLibrary.containsKey(self, EasyScriptTruffleStrings.toString(property));
    }

    @Specialization
    protected boolean hasOwnPropertyTruffleString(
            TruffleString self, Object property) {
        // strings only have the 'length' property
        return ReadTruffleStringPropertyNode.LENGTH_PROP.equals(EasyScriptTruffleStrings.toString(property));
    }

    @Fallback
    protected boolean hasOwnPropertyPrimitive(
            Object self, Object property) {
        // primitives don't own any properties
        return false;
    }
}
```

To support the last two specializations,
we need to change the logic of accessing properties from strings and primitives,
so that they read from the `Object` prototype,
which we add to the `ShapesAndPrototypes` class from the
[previous part](/graal-truffle-tutorial-part-13-classes-2-fields-this-constructors#handling-built-in-objects-and-functions),
and which is available through the Truffle language context:

```java
import com.oracle.truffle.api.dsl.Cached;
import com.oracle.truffle.api.dsl.Fallback;
import com.oracle.truffle.api.library.CachedLibrary;
import com.oracle.truffle.api.object.DynamicObjectLibrary;

public abstract class CommonReadPropertyNode extends EasyScriptNode {
    // ...

    @Fallback
    protected Object readPropertyOfNonUndefinedWithoutMembers(
            Object target, Object property,
            @Cached("currentLanguageContext().shapesAndPrototypes.objectPrototype") ObjectPrototype objectPrototype,
            @CachedLibrary(limit = "2") DynamicObjectLibrary dynamicObjectLibrary) {
        return dynamicObjectLibrary.getOrDefault(objectPrototype,
                EasyScriptTruffleStrings.toString(property), Undefined.INSTANCE);
    }
}
```

For strings, the change needs to happen in the last specialization of `ReadTruffleStringPropertyNode`,
which now needs to use the `InteropLibrary.readMember()` instead of `DynamicObjectLibrary`
to read from the string prototype.
However, there's an interesting performance consideration here.

`InteropLibrary.readMember()` requires a Java `String`,
while it's possible this specialization gets called with a non-`String` value
(we can't just convert all non-`String` property names to `String`s in `ArrayIndexReadExprNode`
before delegating to `ReadTruffleStringPropertyNode`,
because of string indexing in JavaScript, in code like `"a"[0]` --
we discussed this in detail in the
[last part](/graal-truffle-tutorial-part-13-classes-2-fields-this-constructors#reading-properties)).

We could just use the `EasyScriptTruffleStrings.toString()`
method, like we did in `HasOwnPropertyMethodBodyExprNode`,
but since that method is annotated with `@TruffleBoundary`, which stops partial evaluation,
it would negatively impact performance for many common scenarios where this specialization is called with a Java `String`
(in code like `"a".charAt`).

We could definitely write a separate specialization that handles Java `String`s specially,
but that would be a lot of additional code.
Instead, we can add a new method to `EasyScriptTruffleStrings`
that isn't annotated with `@TruffleBoundary`,
and which checks whether the argument it received is already a Java `String`:

```java
import com.oracle.truffle.api.CompilerDirectives.TruffleBoundary;

public final class EasyScriptTruffleStrings {
    // ...

    // new method
    public static String toStringOfMaybeString(Object object) {
        return object instanceof String
                ? (String) object
                : EasyScriptTruffleStrings.toString(object);
    }

    // same method as in part 13
    @TruffleBoundary
    public static String toString(Object object) {
        return object.toString();
    }
}
```

This allows Graal to hoist the `String`
type assertion present in `toStringOfMaybeString()` to the specialization that uses it:

```java
import com.oracle.truffle.api.dsl.Cached;
import com.oracle.truffle.api.dsl.Fallback;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.UnknownIdentifierException;
import com.oracle.truffle.api.interop.UnsupportedMessageException;
import com.oracle.truffle.api.library.CachedLibrary;
import com.oracle.truffle.api.strings.TruffleString;

public abstract class ReadTruffleStringPropertyNode extends EasyScriptNode {
    public static final String LENGTH_PROP = "length";

    // ...

    @Fallback
    protected Object readNonLengthProperty(
            TruffleString truffleString, Object property,
            @Cached("currentLanguageContext().shapesAndPrototypes.stringPrototype") ClassPrototypeObject stringPrototype,
            @CachedLibrary(limit = "2") InteropLibrary interopLibrary) {
        try {
            return interopLibrary.readMember(stringPrototype,
                    EasyScriptTruffleStrings.toStringOfMaybeString(property));
        } catch (UnknownIdentifierException e) {
            return Undefined.INSTANCE;
        } catch (UnsupportedMessageException e) {
            throw new EasyScriptException(this, e.getMessage());
        }
    }
}
```

This maintains the same performance on the `StringLengthBenchmark` benchmark as we had in
[part 11](/graal-truffle-tutorial-part-11-strings-static-method-calls#benchmark),
without the need to write a separate specialization for Java `String`s.

In order for the above property read logic to be able to find the new method,
we add the `hasOwnProperty` method to the `Object` prototype in `EasyScriptTruffleLanguage`:

```java
import com.oracle.truffle.api.TruffleLanguage;
import com.oracle.truffle.api.object.DynamicObject;
import com.oracle.truffle.api.object.DynamicObjectLibrary;
import com.oracle.truffle.api.object.Shape;

@TruffleLanguage.Registration(id = "ezs", name = "EasyScript")
public final class EasyScriptTruffleLanguage extends
        TruffleLanguage<EasyScriptLanguageContext> {
    private final Shape rootShape = Shape.newBuilder().build();
    private final ObjectPrototype objectPrototype = new ObjectPrototype(this.rootShape);

    // ...

    private DynamicObject createGlobalScopeObject(DynamicObjectLibrary objectLibrary) {
        var globalScopeObject = new GlobalScopeObject(this.rootShape);
        // the 0 flag indicates that these are variables, and can be reassigned
        objectLibrary.putConstant(globalScopeObject, "Math",
                this.createMathObject(objectLibrary), 0);

        // initialize the Object prototype
        objectLibrary.putConstant(this.objectPrototype, "hasOwnProperty",
                this.defineBuiltInMethod(HasOwnPropertyMethodBodyExprNodeFactory.getInstance()),
                0);
        objectLibrary.putConstant(globalScopeObject, "Object",
                this.objectPrototype, 0);

        return globalScopeObject;
    }
}
```

## `super` expressions

In addition to inheriting properties from parent classes,
many object-oriented languages, including JavaScript,
also have the capability to directly reference members of their parent class with `super` expressions.

The `super` keyword can be used in two ways:

1. Inside a constructor, a `super()` call invokes the parent class's constructor.
   You can pass arguments to it, just like when creating an instance of the parent class.
2. When used as the target of a property read, in code like `super.x`,
   it changes the property lookup algorithm to start the search at the class object of the parent of the current class,
   instead of the current object.

Let's add it to EasyScript.

### Grammar

First, we need to add the `super` keyword expression to the language's grammar:

```shell-session
expr6 : 'super' #SuperExpr6
        ...
```

**Note**: in JavaScript, `super` is actually not an expression,
but each form of `super` (`super()`, `super.prop`, `super['prop'] = value`, etc.)
is a different kind of statement. This means just using `super` by itself is not allowed
(it's a syntax error). However, that's purely a parsing issue,
and so we'll simplify for EasyScript by making it an expression.

The implementation of `SuperExprNode` will be quite complex.
Let's start with the first feature of calling the parent constructor,
as that's a little simpler.

### Calling parent constructors

Since we introduced the `evaluateAsReceiver()` and `evaluateAsFunction()` methods in the
[previous part](/graal-truffle-tutorial-part-13-classes-2-fields-this-constructors#this-in-function-calls),
they will be called when `super` is used as a function call,
in code like `super(a, b);`.

When `super` is used as a function call,
`evauluateAsReceiver()` must evaluate to the same value as `this`.
So, we can delegate to the `ThisExprNode` from the
[previous part](/graal-truffle-tutorial-part-13-classes-2-fields-this-constructors#this),
which we add as a `@Child` Node:

```java
import com.oracle.truffle.api.frame.VirtualFrame;

public final class SuperExprNode extends EasyScriptExprNode {
    @SuppressWarnings("FieldMayBeFinal")
    @Child
    private ThisExprNode thisExprNode = new ThisExprNode();

    @Override
    public Object evaluateAsReceiver(VirtualFrame frame) {
        return this.thisExprNode.executeGeneric(frame);
    }

    // ...
}
```

`evaluateAsFunction()` is interesting.
Here, we want to invoke the constructor,
but not of this class, but of its parent class.

Note that `super` is static,
unlike `this`, which is dynamic.
To illustrate the difference, if you have code like:

```javascript
class A { }
class B extends A {
    constructor() {
        super();
    }

    returnThis() {
        return this;
    }
}
class C extends B { }

let c = new C();
```

While `this` in `c.returnThis()` refers to `c`,
since `this` is dynamic, `super()` in the constructor of `B`,
which `C` inherits,
always refers to the constructor of `A`.

In order to make `super` static,
we need to pass the prototype of the class currently being parsed into the `SuperExprNode`.
That's why, during [parsing inheritance above](#parsing),
we started tracking the prototype of the class we are currently parsing in the `currentClassPrototype` field;
then, when parsing `super`, we pass it to `SuperExprNode`:

```java
public final class EasyScriptTruffleParser {
    // ...

    private EasyScriptExprNode parseSuperExpr() {
        if (this.currentClassPrototype == null) {
            throw new EasyScriptException("'super' is only available in class declarations");
        }
        return new SuperExprNode(this.currentClassPrototype);
    }

    // ...
}
```

And then we use that prototype to return the parent prototype when `super()` is invoked.
The interesting piece of this is that we need to use an instance of `InteropLibrary`
to find the constructor in the parent prototype,
since it might be inherited from an ancestor of the parent class,
but `evaluateAsFunction()` isn't a `@Specialization` method,
so we can't use `@CachedLibrary` in it.
Instead, we need to essentially re-implement what `@CachedLibrary` does:
we create the library with its static factory method,
and then use the
[`insert()` method of `Node`](https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/nodes/Node.html#insert(com.oracle.truffle.api.nodes.Node%29)
to save it inside a field annotated with `@Child`
(library instances are also Nodes).
Of course, since `@Child` implies the field is compilation final,
we need to invalidate the current code if we've already been JIT-compiled before saving that field for the first time:

```java
import com.oracle.truffle.api.CompilerDirectives;
import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.UnknownIdentifierException;
import com.oracle.truffle.api.interop.UnsupportedMessageException;

public final class SuperExprNode extends EasyScriptExprNode {
    private final ClassPrototypeObject classPrototype;

    @SuppressWarnings("FieldMayBeFinal")
    @Child
    private ThisExprNode thisExprNode;

    @Child
    private InteropLibrary interopLibrary;

    public SuperExprNode(ClassPrototypeObject classPrototype) {
        this.classPrototype = classPrototype;
        this.thisExprNode = new ThisExprNode();
    }

    // ...

    @Override
    public Object evaluateAsFunction(VirtualFrame frame, Object receiver) {
        if (this.interopLibrary == null) {
            CompilerDirectives.transferToInterpreterAndInvalidate();
            this.interopLibrary = this.insert(
                    InteropLibrary.getFactory().createDispatched(1));
        }
        try {
            return this.interopLibrary.readMember(
                    this.classPrototype.prototype, "constructor");
        } catch (UnknownIdentifierException e) {
            return this.currentLanguageContext().emptyFunction;
        } catch (UnsupportedMessageException e) {
            throw new EasyScriptException(this, e.getMessage());
        }
    }
}
```

The default value for the constructor,
if a given parent class didn't define or inherit one,
is the empty function
(we could have also just added an empty constructor to the `Object`
prototype, but since `UnknownIdentifierException` is a checked exception,
we have to handle it anyway, so we might as well do it here),
which we create in the `EasyScriptTruffleLanguage` class,
and surface as another field of the Truffle language context:

```java
import com.oracle.truffle.api.TruffleLanguage;
import com.oracle.truffle.api.object.DynamicObjectLibrary;
import com.oracle.truffle.api.object.Shape;

@TruffleLanguage.Registration(id = "ezs", name = "EasyScript")
public final class EasyScriptTruffleLanguage extends
        TruffleLanguage<EasyScriptLanguageContext> {
    private final Shape rootShape = Shape.newBuilder().build();
    private final ObjectPrototype objectPrototype = new ObjectPrototype(this.rootShape);
    private final ClassPrototypeObject functionPrototype = new ClassPrototypeObject(this.rootShape,
            "Function", this.objectPrototype);

    @Override
    protected EasyScriptLanguageContext createContext(Env env) {
        var objectLibrary = DynamicObjectLibrary.getUncached();
        return new EasyScriptLanguageContext(
                this.createGlobalScopeObject(objectLibrary),
                this.createShapesAndPrototypes(objectLibrary),
                // empty function, used for default constructors
                new FunctionObject(
                        this.rootShape,
                        this.functionPrototype,
                        new StmtBlockRootNode(
                                this,
                                FrameDescriptor.newBuilder().build(),
                                new BlockStmtNode(Collections.emptyList())).getCallTarget(),
                        0));
    }

    // ...
}
```

### Reading `super` properties

Finally, we tackle reading properties of `super`,
in code like `super.x`.
This is an interesting case,
because it breaks an assumption that has held up to this point in the series.

In the [previous part](/graal-truffle-tutorial-part-13-classes-2-fields-this-constructors),
the target of the property read, and the receiver (passed as `this`)
of the method, were always the same.
However, `super` breaks that assumption;
in code like `super.m()`,
the receiver is still `this`,
but the target of the property `m` read is the prototype of the parent class, not `this`.

We could solve this issue by introducing a third method to `EasyScriptExprNode`,
something like `evaluateAsTarget()`,
and then use it, alongside the existing `evaluateAsReceiver()`
and `evaluateAsFunction()`, in a modified `FunctionCallExprNode`.

However, since we've already used that technique,
we can do something different in this case.
We know that the receiver of the method,
and the target of the property search,
are almost always the same -- the only exception is the `super` expression.
So, instead of making the solution generic, like a new `evaluateAsTarget()` method,
we can instead special-case the handling of `SuperExprNode`
inside the two expression Nodes responsible for reading properties,
`PropertyReadExprNode` and `ArrayIndexReadExprNode`.

**Note**: we don't have to do the same with the expression Nodes for writing properties,
`PropertyWriteExprNode` and `ArrayIndexWriteExprNode`,
since [writing to `super` writes to `this` in JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/super#setting_super.prop_sets_the_property_on_this_instead).

First, since both `PropertyReadExprNode` and `ArrayIndexReadExprNode`
call `executeGeneric()` on its target expression in their `evaluateAsReceiver()` implementations,
we have to make sure to delegate to `ThisEpxrNode` in `SuperExprNode`:

```java
import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.interop.InteropLibrary;

public final class SuperExprNode extends EasyScriptExprNode {
    private final ClassPrototypeObject classPrototype;

    @SuppressWarnings("FieldMayBeFinal")
    @Child
    private ThisExprNode thisExprNode;

    @Child
    private InteropLibrary interopLibrary;

    public SuperExprNode(ClassPrototypeObject classPrototype) {
        this.classPrototype = classPrototype;
        this.thisExprNode = new ThisExprNode();
    }

    @Override
    public Object executeGeneric(VirtualFrame frame) {
        return this.thisExprNode.executeGeneric(frame);
    }

    // ...
}
```

Then, we check for the presence of `SuperExprNode` in `PropertyReadExprNode`:

```java
import com.oracle.truffle.api.dsl.NodeChild;
import com.oracle.truffle.api.dsl.NodeField;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.frame.VirtualFrame;

@NodeChild("targetExpr")
@NodeField(name = "propertyName", type = String.class)
public abstract class PropertyReadExprNode extends EasyScriptExprNode {
    protected abstract EasyScriptExprNode getTargetExpr();
    protected abstract String getPropertyName();

    @SuppressWarnings("FieldMayBeFinal")
    @Child
    private CommonReadPropertyNode commonReadPropertyNode = CommonReadPropertyNodeGen.create();

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
        EasyScriptExprNode targetExpr = this.getTargetExpr();
        Object propertyTarget = targetExpr instanceof SuperExprNode
                ? ((SuperExprNode) targetExpr).readParentPrototype()
                : receiver;
        return this.readProperty(propertyTarget);
    }
}
```

`readParentPrototype()` is a method we add to `SuperExprNode`:

```java
public final class SuperExprNode extends EasyScriptExprNode {
    private final ClassPrototypeObject classPrototype;

    // ...

    public Object readParentPrototype() {
        return this.classPrototype.prototype;
    }
}
```

And we also use it in `ArrayIndexReadExprNode`:

```java
import com.oracle.truffle.api.dsl.ImportStatic;
import com.oracle.truffle.api.dsl.NodeChild;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.nodes.Node;

@NodeChild("arrayExpr")
@NodeChild("indexExpr")
public abstract class ArrayIndexReadExprNode extends EasyScriptExprNode {
    @ImportStatic(EasyScriptTruffleStrings.class)
    static abstract class InnerNode extends Node {
        abstract Object executeIndexRead(Object array, Object index);

        // ...
    }

    protected abstract EasyScriptExprNode getArrayExpr();
    protected abstract EasyScriptExprNode getIndexExpr();

    @SuppressWarnings("FieldMayBeFinal")
    @Child
    private InnerNode innerNode = ArrayIndexReadExprNodeGen.InnerNodeGen.create();

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
        EasyScriptExprNode arrayExpr = this.getArrayExpr();
        Object propertyTarget = arrayExpr instanceof SuperExprNode
                ? ((SuperExprNode) arrayExpr).readParentPrototype()
                : receiver;
        return this.readIndexOrProperty(propertyTarget, property);
    }
}
```

## Benchmark

With these changes,
we can slightly modify the benchmark from the
[last part](/graal-truffle-tutorial-part-13-classes-2-fields-this-constructors#benchmark)
to use inheritance and `super` with a several class deep hierarchy:

```java
public class CounterThisBenchmark extends TruffleBenchmark {
    private static final String COUNTER_CLASS = "" +
            "class Base extends Object { " +
            "    constructor() { " +
            "        super(); " +
            "        this.count = 0; " +
            "    } " +
            "    increment() { " +
            "        this.count = this.count + 1; " +
            "    } " +
            "    getCount() { " +
            "        return this.count; " +
            "    } " +
            "} " +
            "class LowerMiddle extends Base { " +
            "} " +
            "class UpperMiddle extends LowerMiddle { " +
            "    constructor() { " +
            "        super(); " +
            "    } " +
            "    increment() { " +
            "        return super.increment(); " +
            "    } " +
            "    getCount() { " +
            "        return super.getCount(); " +
            "    } " +
            "} " +
            "class Counter extends UpperMiddle { " +
            "} ";

    // ...
}
```

These are the results I get when running on my laptop:

```shell-session
Benchmark                                                Mode  Cnt    Score    Error  Units
CounterThisBenchmark.count_with_this_in_for_direct_ezs   avgt    5  582.213 ± 19.996  us/op
CounterThisBenchmark.count_with_this_in_for_direct_js    avgt    5  705.399 ± 16.581  us/op
CounterThisBenchmark.count_with_this_in_for_indexed_ezs  avgt    5  575.528 ± 14.741  us/op
CounterThisBenchmark.count_with_this_in_for_indexed_js   avgt    5  707.888 ± 18.730  us/op
```

As we can see, the EasyScripts results are pretty much identical to the ones from the
[previous part](/graal-truffle-tutorial-part-13-classes-2-fields-this-constructors#benchmark),
while the GraalVM JavaScript performance is a tiny bit worse --
my guess would be the prototype of an object being potentially mutable prevents Graal from applying some optimizations in JavaScript that are still possible in EasyScript,
where we made an object's prototype impossible to change after it has been instantiated.

## Summary

So, this is how class inheritance can be implemented in Truffle.

As usual, all the code from the article is
[available on GitHub](https://github.com/skinny85/graalvm-truffle-tutorial/tree/master/part-14).

In the [next part](/graal-truffle-tutorial-part-15-exceptions)
of the tutorial, we will talk about implementing exception handling.
