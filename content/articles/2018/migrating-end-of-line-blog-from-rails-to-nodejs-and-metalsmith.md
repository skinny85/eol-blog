---
id: 35
layout: article.html
title: "Migrating 'End of Line' blog from Rails to NodeJS and Metalsmith"
summary: "
	I've recently changed the tech stack powering this blog,
	abandoning Ruby on Rails in favor of NodeJS and the Metalsmith library.
	In this article, I talk about the details of the migration –
	the justification behind it, why did I choose that stack that I did,
	and how did the migration itself go."
created_at: 2018-09-16
---

As I've [mentioned](/a-blog-article-on-blogging) [before](/end-of-line-blog-2016-year-in-review),
since its inception in 2014,
'End of Line' has been powered by [Ruby on Rails](https://rubyonrails.org/).
I chose that stack mainly because it was a learning opportunity for me --
while I heard a lot about the framework over the years,
by that point I have never written a line of Ruby in my life.
Rails was very "in" at that time,
and I was curious whether reality lived up to the hype.

As the years went by, however, I've grown more and more dissatisfied and disillusioned with both the Ruby language, and its ecosystem.
I don't want to get into exactly why right now --
perhaps I'll write a separate article one day going over my experience
(for a general idea of what that article would look like,
check out [this famous 'Sick of Ruby'](https://blog.abevoelker.com/sick-of-ruby-dynamic-typing-side-effects-object-oriented-programming/) blog post by Abe Voelker).
Another factor was that I [switched teams at work](/life-update-job-and-location-change-2nd-edition)
to one that had a product written completely in Ruby,
and I have a rule to try and avoid using the same technologies for side projects that I employ at my day job.

All of this meant I was shopping around for a different stack to move the blog to.
I had a few requirements:

1. I wanted to write the articles in [Markdown](https://daringfireball.net/projects/markdown/syntax).
  While there are other text formats that make sense for a blog
  (like [reStructuredText](http://docutils.sourceforge.net/rst.html),
  or [AsciiDoc](http://asciidoc.org/)),
  the tie-breaker for me was Markdown's ability to embed inline HTML.
  That meant I was certain I wouldn't be limited with representing any non-standard constructs that I had in my articles,
  or would want to have in the future
  (like the lightbox in the [Docker primer](/my-primer-on-Docker),
  or the block of links at the beginning and end of each article in the ['Test types' series](/unit-acceptance-or-functional-demystifying-the-test-types-part1)),
  without needing to resort to things like custom reStructuredText directives.
2. I wanted the migration to be completely transparent --
  nobody other than me should know that the implementation of the site changed.
  That meant that things like the styles, URLs (including for things like images),
  the home page, the 'Archive' page, etc. --
  all had to remain exactly the same.
3. I wanted the site to be statically generated. My Rails app was dynamic --
  even though I never actually stored the articles in a database!
  Instead, each post was a separate Rails partial, kept in version control.
  That setup is obviously quite wasteful --
  you're dynamically generating the HTML for each request,
  even though it will be exactly the same each time.

As I didn't want to use Ruby for the new site,
that immediately eliminated a few popular options like [Jekyll](https://jekyllrb.com/) and [Octopress](http://octopress.org/).
[Hugo](https://gohugo.io/) seemed interesting, but I've actually used it at work already,
so it would violate my above self-imposed rule.
I've spent some time trying out various frameworks from the [StaticGen site](https://www.staticgen.com/),
but most of them were far too opinionated to accommodate requirement #2.

I was growing desperate, and even considered writing my own generator from scratch
(I learned that doing that is a [lot more common](https://roadtolarissa.com/literate-blogging/) than you probably think).
But then, I found [Metalsmith](http://www.metalsmith.io/).

Metalsmith is a small NodeJS static generator library that has a very simple,
clearly defined structure -- it takes files from disk,
and turns them into JavaScript objects that you manipulate.
The configuration is completely expressed in a few lines of JavaScript,
and thus can be easily changed --
the library doesn't make any assumptions about how your source files,
or your resulting website, should be laid out
(which is not the case for many static site generators).

It has a rich ecosystem of existing plugins,
which makes many common tasks necessary to build a website extremely easy.
I use the following plugins when generating this blog:

* [markdown](https://www.npmjs.com/package/metalsmith-markdown)
* [layouts](https://www.npmjs.com/package/metalsmith-layouts)
* [nested](https://www.npmjs.com/package/metalsmith-nested)
* [paths](https://www.npmjs.com/package/metalsmith-paths)
* [elevate](https://www.npmjs.com/package/metalsmith-elevate)
* [assets](https://www.npmjs.com/package/metalsmith-assets)
* [express](https://www.npmjs.com/package/metalsmith-express)
* [watch](https://www.npmjs.com/package/metalsmith-watch)

Additionally, because Metalsmith plugins are extremely simple --
they're just JavaScript functions --
it's very easy to write one-off plugins specific to your site.
For example, I have separate plugins that make sure my 'Archive' and home pages look exactly the same as the ones written in Rails.

This setup gives you a tremendous amount of flexibility.
Using it, I was able to pretty easily re-create the blog's original look,
including things like syntax highlighting, and the RSS feed.

After that, the only thing left was to convert all of the previously written blog articles from their existing HTML form as Rails partials to Markdown.
I initially thought it would be super simple,
but I seriously underestimated how much work it takes,
especially for things like inline code blocks.
Fortunately, I found the great [Turndown](https://github.com/domchristie/turndown)
project, which can automatically convert HTML to Markdown.
Also, my laziness saved me here,
as I only had thirty-something articles to convert
(even with Turndown, each article still required a small amount of manual intervention).

Finally, there was the matter of deploying the new site.
The Rails version of the blog was running on [Heroku](https://www.heroku.com/).
And while Heroku has a way of [deploying static sites](https://devcenter.heroku.com/articles/static-sites-ruby),
I wanted to try a new service I've been hearing a lot of good things about lately:
[Netlify](https://www.netlify.com/).
It specializes in running static sites,
and has a reputation of being extremely easy to set up.
And my experience confirms that --
all you need to do is select your GitHub repository from a list after you've logged in with your GitHub credentials,
provide a build command (`npm run build` in my case),
the output directory (`build/` for me, which conveniently is also the default),
and... that's it! After a few seconds, your site will be up and running.
And it gets even better -- when you setup a custom domain with Netlify,
you automatically get a free certificate from [Let's Encrypt](https://letsencrypt.org/),
and have your blog available through HTTPS,
without _any_ configuration
(seriously -- it's not even 1-click, it's 0-clicks!).
You can't have HTTPS support using Heroku's free tier,
so this is pretty cool.

Another nice thing I was able to set up in the NodeJS version was hot reloading of the site when doing local development --
now, when writing an article, I never have to refresh the browser anymore,
simply saving the file will automatically show me the changes.
It was especially useful when converting the existing articles,
as I was able to quickly iterate on each Markdown version to make sure it looked exactly like its HTML counterpart.

All in all, I'm extremely satisfied with Metalsmith.
You have to write a little bit of code to get off the ground,
but it's a relatively small amount,
and the flexibility you get in return is invaluable.
You're not fighting against the documented and undocumented assumptions of the generator tool you're using --
instead, you have absolute control over every detail of how you want your site to look,
and the way the source code should be laid out.

Let me give you a specific example of the power this flexibility affords you.
I like to make links that point to external sites in my articles open in a new window/tab.
However, you can't actually express that in pure Markdown.
With many generator tools, I would have no choice but to resort to using inline HTML each time I had an external link in a post.
But with Metalsmith, because you have full control over the output,
you can actually customize the render function that
[marked](https://marked.js.org/#/USING_PRO.md#renderer) uses,
and add the `target="_blank"` attribute to the `a` element if its URL points outside endoflineblog.com.
This way, I can use Markdown's standard `[]()` link syntax in my articles for both internal and external URLs,
and the output HTML will be rendered exactly like I want it.
And all it takes to make that happen is around 10 lines of JavaScript.

The source for the blog is available on GitHub
(I was too embarrassed to ever make my crappy Rails app public):

<p style="text-align: center;">
[github.com/skinny85/eol-blog](https://github.com/skinny85/eol-blog)
</p>

Feel free to use it as a starting point if you want to play with Metalsmith yourself.
