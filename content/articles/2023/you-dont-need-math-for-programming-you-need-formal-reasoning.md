---
id: 69
layout: article.html
title: You don't need math for programming, you need formal reasoning
summary: |
   In this short article, I attempt to dispel a common myth:
   that you need to be good at math in order to become a programmer.
created_at: 2023-01-31
---

There is a widely-held belief that says you need to be good at math to be able to program computers.
Interestingly, that opinion is most commonly found among people who are not software developers themselves.
When I was younger, whenever I mentioned to anyone that I wanted to study computer science in college,
I would invariably get the same answer:
"Oh, you better be good at math then!".
Back then, I didn't know anyone who actually studied computer science,
so I just took that opinion as gospel.

And indeed, computer science curriculums typically place a strong emphasis on math.
For example, my degree at the [University of Warsaw](https://en.uw.edu.pl)
required passing 9 different math classes,
including for some pretty abstract branches of the science,
like calculus and set theory.

But a curious thing happens when you actually start working as a software developer:
you pretty quickly realize you basically use never use _any_ math in your day-to-day work,
much less calculus or set theory!

How can we explain this discrepancy between the expectations and the reality of software engineering?

My theory is that it's not actually math that you need for programming,
but instead _formal reasoning_.
Math, of course, is probably the most famous example of formal reasoning that humankind has ever created,
and I think that's why people assume you need it for coding --
they see formal reasoning and math as being the same thing.

## Disclaimer

Now, before you send me an angry message saying that you're a programmer,
and you *do* use math in your day-to-day job,
I want to clarify that I realize there are several areas of software engineering where math absolutely is used all the time:

- machine learning (and AI in general)
- computer graphics
- geolocation software
- I'm sure many others that I haven't thought of

The point of the article is not claiming that you don't need math in these roles;
rather, that them requiring math is more of an exception than the rule,
and the vast majority of software development has no such requirement,
which is the opposite of the public perception on this topic.

## The heart of software -- managing complexity

So, why do I claim you need formal reasoning for programming?
At the center of my argument sits the assertion that software is incredibly complex.

When you think about the basic units of a computer on a fundamental level,
(the processor, memory, input devices like keyboards and mice, output devices like monitors, etc.),
they are a bunch of electrical circuits that can store and transmit 0s and 1s.
It's staggering how much has to correctly happen for you to be able to read this article on your screen!

Still not convinced?
Let's go through a few concrete examples of complexity in software.

### Resetting a password

Let's consider the functionality of resetting a password.
I'm sure you're familiar with the basic flow:
if you don't remember your password for a given website,
but you need to log into it,
you press the "Forgot password?" button on the log in page,
input the email associated with your account,
and you should receive a message containing a link to the website.
Clicking that link takes you to a form where you can set a new password for your account,
without having to provide the old one.

On the surface, this functionality seems quite simple.
But if we dig into the details, there are many interesting edge cases here that need to be carefully considered:

1. We have to make sure the link we generate is unique for each account, obviously;
   but at the same time, we can't simply make this link be based solely on the email,
   because that risks hackers reverse engineering the calculation performed to generate the link,
   and thus being able to take over user accounts just by knowing their email!
2. Should this link be valid forever, or should it expire after some amount of time?
   Making it expire after a few days seems safer,
   but that's additional logic that has to be included when implementing this functionality.
3. What if I click the "Forgot password?" button twice in a row,
   without re-setting my password -- should I get two emails,
   or should the system be clever, and ignore the second one?
  - If I do get two emails,
    should the link in the second message be the same as the one from the first email, or different?
    - If they are different, does that mean that first link needs to be invalidated?
    - If they are the same, does that mean the expiration date of that link has been extended
      (for instance, maybe I pressed the "Forgot password?"
      button a second time a full day after doing it for the first time)?

We can go on and on, but I hope I managed to make my point:
even something as simple on the surface as resetting your password hides a lot of complexity when considered deeply.

### Slack notifications

As another example, let's take the decision of showing notifications in
[Slack](https://slack.com),
a popular chat application.
You might be surprised -- "what's complicated in that?".
But take a look at the visual depiction of the algorithm responsible for making this decision:

![Slack notification decision graph](/img/slack-notifications.png)

_Source_: [ByteByteGo newsletter, episode 3](https://blog.bytebytego.com/p/flowchart-of-how-slack-decides-to-923)

The main reason why this functionality has so much complexity is that users can turn off
("mute") notifications on multiple levels:
for individual channels, separately on each of their devices, and also globally.
In addition, muting is not a simple on and off switch,
but gives you more fine-grained control:
you can mute everything, or allow notifications for mentions, and/or for direct messages.

So, while each part of the notifications feature is pretty easy to understand separately,
their combination, and the interplay of them,
results in a very complicated system.
This is sometimes called _emergent complexity_:
when a combination of small and simple rules creates something very complex as a result
(the process of evolution is another good example of emergent complexity).

## Summary

Hopefully, I managed to at least somewhat convey how much complexity hides in the software we use every day.
Computers are incredibly fast, but, on some level, also incredibly dumb, machines.
They execute exactly what you tell them to do,
billions of times each second.
So, if you tell them to do something nonsensical,
like execute the same set of instructions in an endless loop,
or divide a number by zero,
they will happily do that,
and in the process get stuck or crash, respectively.

You might say that we would never instruct the computer to do something stupid like that,
but the problem is, because of the huge complexity that we encounter when programming,
we might make mistakes, and do these things accidentally.
These mistakes manifest as bugs,
and they range from annoying but relatively harmless,
like some button not working when pressed on a web page,
to potentially catastrophic,
like the security issue with the reset password flow we described above.

So, to make sure we correctly guide this powerful but dumb machine,
we have to first tame the beast of complexity.
Our human brains are undoubtedly a marvel of evolution,
but are not capable of quickly computing something as complex as the Slack notification graph from above.
Formal reasoning is the best tool humankind has devised to tackle these problems.
In fact, I would say that the above Slack notification graph is a great example of applying formal reasoning to a complex issue!

So, while I don't think it's particularly controversial to say that you don't need calculus or set theory to create a web application,
the skill of formal reasoning is absolutely essential for taming the complexity of that project,
and avoiding introducing bugs.
Even the programming languages that we use when coding are small formal reasoning systems themselves,
so you can't really use them effectively without mastering that skill.

So, instead of saying "You need math for programming",
maybe we should start saying "Study math to learn formal reasoning, which you need for programming"?
