---
id: 11
layout: article.html
title: Bash initialization files
summary: "Which files does Bash read when starting up the shell session
	was always black magic to me. I recently had to diagnose
	a problem with my shell setup, and I decided to figure it out once and for all.
	In this article I want to share my findings (and at the same time create a
	reference for when I forget it again)."
created_at: 2015-10-13
---

If you're anything like me, the way Bash (and other shells, for that matter) read it's initialization files was always complicated and confusing. What's the difference between `.bash_profile` and `.profile`? What's the deal with having both `.bash_profile` and `.bashrc`? The shell is a big part of the day-to-day life of a developer (especially one working at Amazon), and so it seems this is a pretty big hole in my programming knowledge. This article's purpose is to clear up all the confusion and provide a simple, quick reference.

## Tango and Bash

The first thing to realize when discussing this topic is that the files used during initialization are based on two characteristics of the shell:

* a shell can be either a **login** shell or a **non-login** shell
* a shell can be either **interactive** or **non-interactive**

These terms apply equally to Bash and to other shells. Let's discuss what precisely do they mean.

### To login or not to login, that is the question

A **login shell** is meant to be the first process launched with your user ID after you start a new interactive session in a traditional Unix environment. Some examples of starting a login shell:

* logging in to the console in a Unix without a GUI
* connecting through SSH to a server
* running `su -`

Interestingly, when you start a new terminal session in a GUI environment (Gnome, Unity, OSX etc.), that shell should _not_ be a login shell - as it does not satisfy the condition mentioned above. Having said that, most of those terminal programs actually violate the Unix principles somewhat and allow you to specify an option to have that shell be a login shell (note that the option is usually off by default, so if you want that behavior you might need to search through the settings).

The same is true for starting a new shell from an existing shell session (for example, issuing the command `bash` in Bash) - that new shell will be a **non-login** shell.

It's fairly easy to find out if you're working in a login shell, as the program names of login shells (usually) have the '-' character prepended to it. So, if you issue the command `echo $0` and get a response like `-bash`, that means you're in a login shell. If you see `bash` instead, that most probably means you're in a non-login shell ("most probably", as that method is not 100% bulletproof - issue `shopt login_shell` to be sure, but note that it's a Bash built-in, so won't work for other shells).

### (I Can't Get No) Interaction

Interactivity of the shell is a fairly simple concept - it's whether this shell is meant to get input from the user, or is it meant to run in batch mode. Any sort of shell that you type commands in is obviously an interactive shell. Non-interactive shells are started by other programs. Common examples are things like `cron`, and the shell itself invoking scripts (you know, the ones starting with a shebang, like `#!/bin/bash`).

Non-interactive shells have much simpler initialization rules, as they can be ran in virtually any context, and thus there isn't much you can depend on to be present without risking breakage. You obviously also can't perform any operation that might require any input from the user (`sudo`, for example).

## Stop with the stupid puns already, and give me the rules!

Fine. Although I really liked the 'Tango and Bash' one.

The rules are as follows:

*   When Bash is started as an **interactive**, **login** shell, it:
    *   executes the script at `/etc/profile`, **if** that file exists
    *   then, it looks for:
        
        1. `~/.bash_profile`
        2. `~/.bash_login`
        3. `~/.profile`
        
        **in that order**, and executes the **first** one that exists
*   When Bash is started as an **interactive**, **non-login** shell, it executes the script at `~/.bashrc`, **if** that file exists
*   When Bash is started as an **non-interactive** shell (login or non-login), it executes the script pointed to by the `BASH_ENV` environment variable, **if** that variable is set (to a non-empty value)

So, given those rules, the best way to customize your shell (change the prompt, set up aliases etc.) is to do it in `.bashrc`, and add the following snippet:

```
if [ -f ~/.bashrc ]; then
	. ~/.bashrc
fi
```

to your `~/.bash_profile` (if it's not there already, as a lot of distributions add it by default).

## Rationale

When you think about it, having different files be responsible for the initialization of login and non-login shells makes sense, as originally the login shell was meant to be ran only _once_ - so it's initialization was supposed to do all of those things that you wanted to have in the system during your session, but which didn't have to be repeated for each shell instance (things like starting other programs or setting system-wide options come to mind). It's only modern, GUI environments which made the whole situation messier by allowing each new shell to be a login shell (which also kind of makes sense, as without that option you couldn't have a login shell in that environment at all).

The division between `.profile` and `.bash_profile` stems from the fact that the original Bourne shell (`sh`) uses `.profile`, and Bash wanted to be a drop-in replacement for it, but still allow users to use Bash-specific syntax and constructs in the startup scripts. This way, you can simply source `.profile` from inside `.bash_profile` (as `sh` should be a strict subset of Bash) to avoid duplication, or don't use `.bash_profile` at all and have them both be initialized the same way.

## Other shells

Other shells have a similar philosophy, but do things in their own, special way. For example, both csh and zsh have their equivalents of `~/.bashrc` (`~/.cshrc` and `~/.zshrc`, respectively); csh adds `~/.login` while zsh adds `~/.zshenv`, `~/.zlogin` and `~/.zprofile`. Consult your shell's documentation to find out exactly which files and in which order are executed for each variant of the shell.

## Further reading resources

Here are some good resources if you want to deepen your knowledge of the subject even more:

* [Bash Reference Manual: Bash Startup Files](http://www.gnu.org/software/bash/manual/html_node/Bash-Startup-Files.html)
* [Difference between Login Shell and Non-Login Shell? (Stack Exchange)](http://unix.stackexchange.com/questions/38175/difference-between-login-shell-and-non-login-shell)
* [How to check if a shell is login/interactive/batch (Stack Exchange)](http://unix.stackexchange.com/questions/26676/how-to-check-if-a-shell-is-login-interactive-batch)
