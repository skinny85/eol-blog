---
id: 3
layout: article.html
title: Lessons from leading a conference workshop – Warsjawa 2014
summary: "A look back at the experience I've gained while doing my first appearance
	at a conference as a speaker – leading a workshop titled 'Automated browser-based
	web application testing using the Geb library'."
created_at: 2014-11-07
---

![Warsjawa logo](/assets/warsjawa-logo.png)

At the end of September, a very cool event took place in Warsaw.
It was an annual free software development conference,
with a focus on (but not limited to) the Java ecosystem.
It is called [Warsjawa](https://web.archive.org/web/20141016215507/http://www.warsjawa.pl),
and what is so special about it is that it consists entirely of workshops --
there are no lectures in it whatsoever.
I had the pleasure of leading one of them,
'Automated browser-based web application testing using the Geb library'.
As is pretty obvious from the title,
its goal was to demonstrate writing end-to-end tests that utilize a real browser with the help of the Groovy library
[Geb](http://www.gebish.org/).
I was quite nervous beforehand,
as it was my first time in the role of a speaker and not just an attendant at a conference.
Fortunately, everything went fairly well.
Below are some thoughts on the experience.
The code for the workshop, along with the slides,
is available on [GitHub](https://github.com/Pragmatists/geb-workshop/).

## Preparation

* Preparing a conference appearance from nothing takes a lot of time. Like, a LOT.
  I originally planned to write an entire example application from scratch that I would later demonstrate how to test.
  After starting work on the workshop, however,
  and seeing just how much time it takes,
  I soon realized that would be bonkers.
  So, I stole the Gradle version of the
  [Spring PetClinic](https://github.com/spring-projects/spring-petclinic) sample app.
  Even with that time-saving solution, it took me a lot of effort --
  I would estimate about four entire work-days.
  I had no idea it would be that long!
  I guess if I were to lead a similar workshop again,
  it would be much quicker, but still --
  it's something to keep in mind when making a commitment like that.
* It's a good idea to "test-run" the presentation before you give it. As in, go through the entire thing, preferably with a friend or a family member playing the part of your audience. It will give you confidence, allow you to remember what you wanted to talk about at each slide (notes are also good for that -- see below) and a ballpark of the timeframe that it should take.
* Even though it was a code-based workshop, I still wanted to prepare some slides for a smattering of theory to mix things up a little bit. I've always loathed presentation-creating software like PowerPoint or LibreOffice Impress, and I won't ever use LaTex again unless somebody holds a gun to my head. Fortunately, a great developer at my company suggested [reveal.js](http://lab.hakim.se/reveal-js) -- a nice tool that lets you very easily create good looking presentations in HTML (you can export them to PDF or other formats later). I absolutely loved it, and had no trouble incorporating some custom imagery into the slides (our company signature "pipes" -- you can see them, for example, on our [blog](http://pragmatists.pl/blog)). It's also very easy to add notes visible only to the presenter, and the notes view is really cool -- it even shows you the next slide, so you always know precisely where you are in your talk. I urge you to try it the next time you have to prepare a presentation. Thanks Michał!

## The actual workshop

* Make people run your Maven/Gradle/Ivy build script before the workshop! Conferences have notorious troubles with Internet connectivity, and some builds (mine included) require a lot of downloaded libraries from Maven Central. I completely disregarded that fact, cause, you know -- the builds were quick on my machine. But you may suddenly spend 5 minutes or more waiting for people to download Groovy 2.3.6 or something, when they could have done it before on a fast connection at home.
* This a personal flaw: I like to walk around a lot when I'm speaking, and apparently I sometimes talk while moving away with my back to the audience. Definitely have to work on that!
* Be aware of the time. At the start, I set my alarm to the half-way point, when I planned to do a break, and I would check it regularly whenever there was any downtime. This way, you won't be caught be surprise, and will know in what places to speed things up or slow down. For instance, because we had to wait for people to download all the dependencies, I had to skip discussing one chapter (running on Chrome) in order to get to other, more essential, things. But since I tracked the time, I knew in advance this was needed, and could plan accordingly.
* My biggest fear was that the examples I prepared would not work. End-to-end tests are notoriously fragile and depend very heavily on the environment in which they are run. You probably heard about the "Curse of the live demo" -- the very common scenario when a speaker at a talk wants to demonstrate how something he previously showed only on slides looks like when actually ran, and the program fails on his machine. Well, multiply that by your dependencies versions and Java version, and all of your browsers installations, and your display settings, and then multiply that again by the number of people attending, and you might get a sense of how difficult doing a workshop on end-to-end tests can be. To my delight, however, everything proceeded very smoothly. There were only two instances in which we ran into serious trouble:
  * One person was using a virtual machine with a pretty low resolution. Well, it turns out our company blog, which was being used in the first examples, has a responsive design, and hides the button used in the example to go to the main company website when the viewport is small enough. Obviously, the example didn't work for him.
  * Another person was using a Mac, and the embedded Tomcat server did not want to start. It was surprising, as I used the standard Gradle plugin for that task, and the port on her machine was not occupied. Unfortunate, but at least she could use the other examples.

  Other than those two hiccups, things proceeded without incident.

## The aftermath

In the end, I was really happy with how the workshop turned out. Out of the 16 people that attended, only 4 filled out the post-conference survey, and their average score rated the workshop a 3.75 out of 5, which I think is quite alright (by the way, if by chance anyone who attended the workshop reads this article -- please, leave a comment describing how you liked it!). I got to talk about everything that I planned to, and the examples worked fine out of the box for the vast majority of participants. Even though it took a lot of time to prepare, I really enjoyed being a speaker, and I hope I'll have more opportunities to be one again in the future. If you're thinking of trying it youself, I encourage you to do so -- it's a lot of fun, and also very rewarding.
