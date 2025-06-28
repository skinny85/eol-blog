---
id: 82
layout: article.html
title: How I use Slack effectively at work
summary: |
   Slack (or one of its clones) has become an indispensable tool at many companies.
   In this article, I outline a few tips that help me make the most out of it,
   while avoiding its many pitfalls.
created_at: 2025-04-26
---

[Slack](https://slack.com)
has become a de-facto standard for team communication in many enterprises
(unless you're at a company that uses Windows for everything,
in which case you're probably on
[Microsoft Teams](https://www.microsoft.com/en-us/microsoft-teams/group-chat-software)
instead -- even if that's the case, the tips in this article should still apply).

Slack is getting a bit of a bad rap lately --
people complaining that it has become enterprise bloatware,
and saying the constant interruptions it facilitates are killing productivity.
The acquisition by Salesforce did not help this reputation either.

However, I personally think Slack is an excellent product.
For years, dozens of companies tried to create a better email --
I actually think Slack finally managed to accomplish that goal.
In addition to email, I think it also functions as a better internal knowledge base,
replacing tools like [MediaWiki](https://www.mediawiki.org/wiki/MediaWiki)
or [Confluence](https://www.atlassian.com/software/confluence).

However, like any tool, you have to know it well to use it effectively.
If your Slack is as busy as in this screenshot:

![Slack screenshot with a lot of notifications](/img/slack/slack-mess.jpeg)

I understand why you might think it's a productivity killer.

This my view, for comparison:

<img src="/img/slack/slack-sections.png" style="width: 50%;">

Here are my personal tips for using Slack effectively at work.

### Tip #1: turn off notifications

The first one is the simplest:
turn off all notifications from Slack.
Getting interrupted, and switching context,
is the #1 problem you should be avoiding.

Instead, check Slack only periodically --
when you first start work,
and then every few hours or so.

In fact, I would recommend turning off _all_ notifications from your apps --
most importantly, your email client --
and checking them periodically as well.
The only exception is your calendar app,
since a meeting by definition _needs_ to interrupt you
(however, make sure to decline any meetings that you feel like you don't need to attend).

Don't worry about missing messages --
the Slack icon in either the application taskbar,
if you're using the standalone app,
or the browser tab if you're using the web version,
will show you a red dot if you have an unread message.

If I'm doing a block of deep work,
I actually exit the Slack app completely,
so that nothing distracts me during those crucial focused hours.
I'll turn the app back on after I'm done with the task,
or if I'm deliberately taking a break from it.

### Tip #2: place all channels in (customized) sections

After notifications, this is the second most important technique to getting the most out of Slack.
If you only get one thing out of this article, make sure it's this one.

If you're like most Slack users, you're a member of dozens, if not hundreds, of different channels.
If you're not careful, you will be spending hours catching up and reading hundreds of messages in all of these channels,
99% of which are not relevant to you.

So, what you want to do instead is to
[create sections](https://slack.com/help/articles/360043207674-Organize-your-sidebar-with-custom-sections) for channels,
and assign each channel you're a member of to one of those sections.
Note that this option was initially only available through the desktop app,
but is now available in the web version as well.
However, this feature is only available in workspaces that are on the paid plan.

For reference, here are the sections that I personally use:

1. **Important**: these are channels that are essential to my work.
   I always read them fully.
   This includes things like my immediate team channels,
   the channels my product's customers reach out for support in,
   and any ad-hoc channels that were created for the purposes of collaborating on the projects I'm currently working on.
2. **Interesting**. These are channels that I still want to read in full,
   but I know are not urgent. These are channels like announcements for my immediate org,
   general programming-related channels like `#java` or `#python`,
   and channels for my immediate dependencies.
   I typically read them during my periodic Slack checkup (see above), but if I'm very busy,
   I know I can safely skip them for now, and come back to them when I have a little more time.
3. **Off-topic**: this is everything that's interesting,
   but not directly related to my work.
   Things like buying and selling used items,
   local city topics, financial and investing advice, etc.
   I still like to read these, and they are definitely interesting,
   but I can safely put them off until I have some time,
   and I know I won't miss anything crucial related to my immediate job responsibilities.
4. **Spam**: for any channel that I'm not interested in the contents of,
   but that I sometimes still need to post in --
   for example, to ask another team for help --
   I put it in this "spam" section.
   Note: if you're not interested in the contents of the channel,
   and you don't ever need to post in it,
   I would recommend just leaving it,
   instead of putting it in the Spam section.

To make the sections stand out at a glance,
I recommend setting an emoji for each of them
(Slack allows you to do that, you don't need to add emojis to their names):

<img src="/img/slack/slack-emoji.png" style="width: 50%;">

Now here comes to crucial piece.
For each section, you can customize the notification settings,
and how the section will be displayed.

You do that by clicking on the down arrow next to section,
and choosing `Show and sort`.
This controls which channels, and in what order,
will be shown in the section.

Personally, I set `Show in this section` to `Mentions only` for **Spam**,
to `Unreads only` for **Off-topic** and **Interesting** ,
and `All` for **Important**.
This makes each section show only the channels I care about,
even if expanded.

For the order of the channels in the section,
**Important** has it set to `By most recent`,
while the remaining ones
(**Interesting**, **Off-topic** and **Spam**)
have it as `Alphabetically`.

<img src="/img/slack/slack-section-display.png" style="width: 50%;">

These different settings in the different sections are crucial for making sure you only have the most important information shown to you,
and that you can quickly find what you're looking for, without too much browsing.

### 3. Close all direct messages immediately

One mistake I see people make is to leave their direct messages still showing,
in the separate `Direct messages` section.
This is a mistake, because it will clutter your sidebar,
and there's no reason to keep them there:
you can always retrieve them by either going to the `DMs`
tab in the main panel, or by either right-clicking on the `Direct messages` section header,
or left-clicking on the down arrow at the end of it,
then going to `Manage`, and finally `Recent direct messages`,
so, you have access to your direct message history at any time --
no need to keep them open, and clutter your UI.

<img src="/img/slack/slack-direct-messages.png" style="width: 50%;">

### 4. Always reply in threads (except for DMs)

One of the best features of Slack is the ability to reply in threads.
This reduces the amount of notifications people get when being part of a channel,
and also adds the conversation to the `Threads`
main menu entry, where you can quickly see any threads that received new replies.
If you want to subscribe to a thread that you haven't posted in yourself,
you can do that by clicking the "three dots" menu on any message in the thread,
and selecting `Get notifications of new replies`.

_However_, the one exception to this rule is direct messages.
With those, I would recommend never replying in a separate thread,
since that makes it harder to follow,
and makes it appear in two places
(the `Threads` entry, and the `DMs` entry).
Instead, if you want to reply to a previous message,
use the quote character (`>`, which is the same as in [Markdown](https://www.markdownguide.org)),
and include the text of the previous message in your reply,
to make it clear you're responding to an older message,
and not the last one.

And one final tip regarding replies -- if someone asks you a question,
make sure to reply to them explicitly (with a message),
and not just with an emoji reaction like "Yes" or "No".
The reason is that reactions don't trigger the same notifications as a message,
and so the person who asked the question might miss your reply.

### 5. Use reminders (but judiciously)

Another great feature of Slack is the ability to get reminded about a message at a later time.
This is useful when you read a message, especially when you read it on your phone,
but you don't have time to handle it at that moment --
this way, you can set a reminder to make sure you don't forget to attend to it later.

However, I would recommend using this feature judiciously.
I see some people with 10 or more active reminders at a time,
snoozing it every time one of them goes off --
I don't think that's a good way to use this feature,
as it becomes another to-do list you have to manage, like your email.
In particular, I don't recommend creating reminders for messages that don't require your response,
like something you just want to read later.
Only use reminders if you have to take some action on the message.

## Summary

Those are my tips for using Slack effectively.
Despite its bad reputation,
it can be a very productive tool
(with the right set of techniques),
and seems to be getting more and more popular,
especially with the "Big Tech" companies.
