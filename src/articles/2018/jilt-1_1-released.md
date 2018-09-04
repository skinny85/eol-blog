---
id: 33
layout: article.html
title: Jilt 1.1 released
summary: "Specnaz is not the only open-source project
	that I've been working on recently - I also published
	version 1.1 of Jilt, the Java annotation processor library
	for auto-generating Builder (including Type-Safe Builder)
	clases."
created_at: 2018-05-06
---

My last three articles on the blog were about new releases of [Specnaz](https://github.com/skinny85/specnaz), my open-source Java/Kotlin testing library. In the [last post](/specnaz-1_3-released), I promised the next one will be about something else. That's why today, I'll be talking about a new release of [Jilt](https://github.com/skinny85/jilt), which is... also an open-source Java library that I've created. This one, however, is an annotation processor for automatically generating classes that implement the [Builder design pattern](https://en.wikipedia.org/wiki/Builder_pattern#Java), including its Type-Safe variant (I've written about the Type-Safe Builder pattern variant, and Jilt, previously on this blog [here](/type-safe-builder-pattern-in-java-and-the-jilt-library)).

Version 1.1 brings with it only one feature - the `@BuilderInterfaces` annotation. This annotation can be used alongside the existing `@Builder` annotation. It allows customizing the interfaces that will be generated for each property of the target class to ensure the type-safety of the resulting Builder. Because of that, it has any effect only when generating a Type-Safe Builder (so, when the `style` attribute of the `@Builder` annotation is either `BuilderStyle.TYPE_SAFE` or `BuilderStyle.TYPE_SAFE_UNGROUPED_OPTIONALS`).

`@BuilderInterfaces` has 4 attributes. All of them are Strings, and all of them are optional. They are:

*   `outerName`, which allows you to control the name of the outer interface that the per-property interfaces will be generated inside of.
    
    Since using Type-Safe Builders requires generating a large number of interfaces (usually one per each property of the built class), Jilt always generates them as nested interfaces, to not pollute the global namespace (and to reduce the chance of accidental conflicts, when 2 classes that we are generating Builders for are in the same Java package, and have a property with the same name).
    
    The `outerName` attribute of the `@BuilderInterfaces` annotation allows you to customize the name of that outer interface. By default, it's equal to `<BuiltClass>Builders` (so, if we're generating Builders for a class named `Person`, it will be `PersonBuilders`).
    
*   `packageName`, which allows changing the Java package that the outer interface mentioned above (and, by extension, all of its inner interfaces) reside in.
    
    By default, the outer interface resides in the same package as the generated Builder (so, the same package as the <code>@Builder.packageName</code> attribute points to - if it's empty, that will be the same package the built class is in).
    
*   `innerNames`, which allows you to customize the names of the per-property interfaces by providing a pattern for naming them. In the pattern, the character `*` will be substituted with the (capitalized) name of the property the given interface corresponds to.
    
    So, if the built class has a property called `name`, and you set the `innerNames` attribute to `"Jilt_*"`, the generated interface for the `name` property will be called `Jilt_Name`.
    
    By default, the interface names will simply be the capitalized name of their corresponding properties - so, the same as the pattern `"*"`.
    
*   `lastInnerName`, which is used to change the name of the final interface - the one that contains the `build` method (it can also be called something other than `build`, by setting the <code>@Builder.buildMethod</code> attribute).
    
    By default, that interface is called `Optionals` for Builders with the `BuilderStyle.TYPE_SAFE` style, and `Build` for `BuilderStyle.TYPE_SAFE_UNGROUPED_OPTIONALS` ones.
    
    There is an interesting subtlety with how this attribute interacts with `innerNames` described above. The name of the last interface is affected by setting the `innerNames` attribute. So, continuing the example from above, if `innerNames` is `"Jilt_*"`, then the last interface will be called either `Jilt_Optionals` or `Jilt_Build`, depending on the chosen style. This is usually what you want - if you're setting `innerNames`, that most likely means you want all of the interfaces to share a common prefix and/or suffix.
    
    However, setting `lastInnerName` ignores the pattern from `innerNames` - so, if `lastInnerName` is `"Last"`, and `innerNames` is still `"Jilt_*"`, the last interface will NOT be called `Jilt_Last` - it will be just `Last`. If you want it to be called `Jilt_Last`, you need to explicitly set `lastInnerName` to `"Jilt_Last"`. This way, you have complete control over all of the names of interfaces, at the (small, I think) cost of needing to repeat the pattern if setting both `innerNames` and `lastInnerName` at the same time.

### Summary

That's [Jilt](https://github.com/skinny85/jilt) 1.1 in a nutshell. Let me know what you think of the library in the comments!
