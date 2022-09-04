---
id: 38
layout: article.html
title: Emoji – how do they work?
summary: "
  What exactly are emoji? Are they just small, silly images?
  If that's true, then why does pretty much every device,
  from an iPhone to an Android tablet,
  contain roughly the same set of them?
  Everything will be explained in the article –
  but before we can understand emoji,
  we have to start with the basics of text encodings in computers."
created_at: 2019-04-13
---

I use emoji pretty much every day, as I'm sure a lot of you do.
However, I've never completely understood what they actually are, and how do they work.
Every definition I've seen didn't really speak to me,
perhaps because those things are usually quite hazy on the details.

After doing some research, it turns out the topic is really not that complicated.
We just need to understand a little bit about how text is stored in computers first.

## Character encodings

Obviously, computers can only store numbers, not text directly.
Which means that in order to store any text,
we need to define a mapping between characters and the numbers they are represented with.
We call that mapping a **character encoding**.

For example, I can say that in my mapping,
the letter `A` maps to the number `1`, `B`: to `2`, etc., up to `Z`, which is `26`.
Then `a` would be `27`, `b`: `28`, etc., up to `z`: `52`.

The large problem here is that any mapping we come up with is pretty arbitrary.
For example, you might say that my mapping is stupid, because it starts with uppercase letters.
You would rather reverse that, and start with lowercase ones;
so, `a` should be `1`, `b`: `2`, ..., `z`: `26`, `A`: `27`, ..., `Z`: `52`.
And it's really difficult to objectively say which of the two is better!

And in the early days of computing, that's exactly what happened.
Every computer manufacturer came up with their own encoding,
incompatible with the others,
and text interchange between computers was a complete mess.
To improve the situation, a committee was formed,
and in 1963, it released the [ASCII](https://en.wikipedia.org/wiki/ASCII) standard.

## American Standard Code for Information Interchange

ASCII defines the encoding for 128 characters,
using numbers 0 through 127.
Here's a table showing all of them,
sorted in increasing order by the number assigned to each character
(the numbers are given in standard decimal,
as well as in [hexadecimal](https://en.wikipedia.org/wiki/Hexadecimal)
notation in parentheses;
the hexadecimal values will prove useful later in the article):

<style type="text/css">
  table {
    text-align: center;
    background-color: #f8f9fa;
    border: 1px solid #a2a9b1;
    border-collapse: collapse;
    color: #222; 
    margin: 0.5em 0;
    font-size: smaller;
  }
  td {
    width: 100px;
  }
  td + td {
    border-left: 1px solid #a2a9b1;
  }
  tr.value-row td {
    border-bottom: 1px solid #a2a9b1;
    padding-bottom: 0.25em;
  }
</style>
<table>
    <tr>
        <td><strong>NUL</strong></td>
        <td><strong>SOH</strong></td>
        <td><strong>STX</strong></td>
        <td><strong>ETX </strong></td>
        <td><strong>EOT</strong></td>
        <td><strong>ENQ</strong></td>
        <td><strong>ACK</strong></td>
        <td><strong>BEL</strong></td>
    </tr>
    <tr class="value-row">
        <td>0 (0x0)</td>
        <td>1 (0x1)</td>
        <td>2 (0x2)</td>
        <td>3 (0x3)</td>
        <td>4 (0x4)</td>
        <td>5 (0x5)</td>
        <td>6 (0x6)</td>
        <td>7 (0x7)</td>
    </tr>
    <tr>
        <td><strong>BS</strong></td>
        <td><strong>HT</strong></td>
        <td><strong>LF</strong></td>
        <td><strong>VT </strong></td>
        <td><strong>FF</strong></td>
        <td><strong>CR</strong></td>
        <td><strong>SO</strong></td>
        <td><strong>SI</strong></td>
    </tr>
    <tr class="value-row">
        <td>8 (0x8)</td>
        <td>9 (0x9)</td>
        <td>10 (0xA)</td>
        <td>11 (0xB)</td>
        <td>12 (0xC)</td>
        <td>13 (0xD)</td>
        <td>14 (0xE)</td>
        <td>15 (0xF)</td>
    </tr>
    <tr>
        <td><strong>DLE</strong></td>
        <td><strong>DC1</strong></td>
        <td><strong>DC2</strong></td>
        <td><strong>DC3 </strong></td>
        <td><strong>DC4</strong></td>
        <td><strong>NAK</strong></td>
        <td><strong>SYN</strong></td>
        <td><strong>ETB</strong></td>
    </tr>
    <tr class="value-row">
        <td>16 (0x10)</td>
        <td>17 (0x11)</td>
        <td>18 (0x12)</td>
        <td>19 (0x13)</td>
        <td>20 (0x14)</td>
        <td>21 (0x15)</td>
        <td>22 (0x16)</td>
        <td>23 (0x17)</td>
    </tr>
    <tr>
        <td><strong>CAN</strong></td>
        <td><strong>EM</strong></td>
        <td><strong>SUB</strong></td>
        <td><strong>ESC </strong></td>
        <td><strong>FS</strong></td>
        <td><strong>GS</strong></td>
        <td><strong>RS</strong></td>
        <td><strong>US</strong></td>
    </tr>
    <tr class="value-row">
        <td>24 (0x18)</td>
        <td>25 (0x19)</td>
        <td>26 (0x1A)</td>
        <td>27 (0x1B)</td>
        <td>28 (0x1C)</td>
        <td>29 (0x1D)</td>
        <td>30 (0x1E)</td>
        <td>31 (0x1F)</td>
    </tr>
    <tr>
        <td><strong>space</strong></td>
        <td><strong>!</strong></td>
        <td><strong>"</strong></td>
        <td><strong># </strong></td>
        <td><strong>$</strong></td>
        <td><strong>%</strong></td>
        <td><strong>&</strong></td>
        <td><strong>'</strong></td>
    </tr>
    <tr class="value-row">
        <td>32 (0x20)</td>
        <td>33 (0x21)</td>
        <td>34 (0x22)</td>
        <td>35 (0x23)</td>
        <td>36 (0x24)</td>
        <td>37 (0x25)</td>
        <td>38 (0x26)</td>
        <td>39 (0x27)</td>
    </tr>
    <tr>
        <td><strong>(</strong></td>
        <td><strong>)</strong></td>
        <td><strong>*</strong></td>
        <td><strong>+ </strong></td>
        <td><strong>,</strong></td>
        <td><strong>-</strong></td>
        <td><strong>.</strong></td>
        <td><strong>/</strong></td>
    </tr>
    <tr class="value-row">
        <td>40 (0x28)</td>
        <td>41 (0x29)</td>
        <td>42 (0x2A)</td>
        <td>43 (0x2B)</td>
        <td>44 (0x2C)</td>
        <td>45 (0x2D)</td>
        <td>46 (0x2E)</td>
        <td>47 (0x2F)</td>
    </tr>
    <tr>
        <td><strong>0</strong></td>
        <td><strong>1</strong></td>
        <td><strong>2</strong></td>
        <td><strong>3 </strong></td>
        <td><strong>4</strong></td>
        <td><strong>5</strong></td>
        <td><strong>6</strong></td>
        <td><strong>7</strong></td>
    </tr>
    <tr class="value-row">
        <td>48 (0x30)</td>
        <td>49 (0x31)</td>
        <td>50 (0x32)</td>
        <td>51 (0x33)</td>
        <td>52 (0x34)</td>
        <td>53 (0x35)</td>
        <td>54 (0x36)</td>
        <td>55 (0x37)</td>
    </tr>
    <tr>
        <td><strong>8</strong></td>
        <td><strong>9</strong></td>
        <td><strong>:</strong></td>
        <td><strong>; </strong></td>
        <td><strong><</strong></td>
        <td><strong>=</strong></td>
        <td><strong>></strong></td>
        <td><strong>?</strong></td>
    </tr>
    <tr class="value-row">
        <td>56 (0x38)</td>
        <td>57 (0x39)</td>
        <td>58 (0x3A)</td>
        <td>59 (0x3B)</td>
        <td>60 (0x3C)</td>
        <td>61 (0x3D)</td>
        <td>62 (0x3E)</td>
        <td>63 (0x3F)</td>
    </tr>
    <tr>
        <td><strong>@</strong></td>
        <td><strong>A</strong></td>
        <td><strong>B</strong></td>
        <td><strong>C </strong></td>
        <td><strong>D</strong></td>
        <td><strong>E</strong></td>
        <td><strong>F</strong></td>
        <td><strong>G</strong></td>
    </tr>
    <tr class="value-row">
        <td>64 (0x40)</td>
        <td>65 (0x41)</td>
        <td>66 (0x42)</td>
        <td>67 (0x43)</td>
        <td>68 (0x44)</td>
        <td>69 (0x45)</td>
        <td>70 (0x46)</td>
        <td>71 (0x47)</td>
    </tr>
    <tr>
        <td><strong>H</strong></td>
        <td><strong>I</strong></td>
        <td><strong>J</strong></td>
        <td><strong>K </strong></td>
        <td><strong>L</strong></td>
        <td><strong>M</strong></td>
        <td><strong>N</strong></td>
        <td><strong>O</strong></td>
    </tr>
    <tr class="value-row">
        <td>72 (0x48)</td>
        <td>73 (0x49)</td>
        <td>74 (0x4A)</td>
        <td>75 (0x4B)</td>
        <td>76 (0x4C)</td>
        <td>77 (0x4D)</td>
        <td>78 (0x4E)</td>
        <td>79 (0x4F)</td>
    </tr>
    <tr>
        <td><strong>P</strong></td>
        <td><strong>Q</strong></td>
        <td><strong>R</strong></td>
        <td><strong>S </strong></td>
        <td><strong>T</strong></td>
        <td><strong>U</strong></td>
        <td><strong>V</strong></td>
        <td><strong>W</strong></td>
    </tr>
    <tr class="value-row">
        <td>80 (0x50)</td>
        <td>81 (0x51)</td>
        <td>82 (0x52)</td>
        <td>83 (0x53)</td>
        <td>84 (0x54)</td>
        <td>85 (0x55)</td>
        <td>86 (0x56)</td>
        <td>87 (0x57)</td>
    </tr>
    <tr>
        <td><strong>X</strong></td>
        <td><strong>Y</strong></td>
        <td><strong>Z</strong></td>
        <td><strong>[ </strong></td>
        <td><strong>\</strong></td>
        <td><strong>]</strong></td>
        <td><strong>^</strong></td>
        <td><strong>_</strong></td>
    </tr>
    <tr class="value-row">
        <td>88 (0x58)</td>
        <td>89 (0x59)</td>
        <td>90 (0x5A)</td>
        <td>91 (0x5B)</td>
        <td>92 (0x5C)</td>
        <td>93 (0x5D)</td>
        <td>94 (0x5E)</td>
        <td>95 (0x5F)</td>
    </tr>
    <tr>
        <td><strong>`</strong></td>
        <td><strong>a</strong></td>
        <td><strong>b</strong></td>
        <td><strong>c </strong></td>
        <td><strong>d</strong></td>
        <td><strong>e</strong></td>
        <td><strong>f</strong></td>
        <td><strong>g</strong></td>
    </tr>
    <tr class="value-row">
        <td>96 (0x60)</td>
        <td>97 (0x61)</td>
        <td>98 (0x62)</td>
        <td>99 (0x63)</td>
        <td>100 (0x64)</td>
        <td>101 (0x65)</td>
        <td>102 (0x66)</td>
        <td>103 (0x67)</td>
    </tr>
    <tr>
        <td><strong>h</strong></td>
        <td><strong>i</strong></td>
        <td><strong>j</strong></td>
        <td><strong>k </strong></td>
        <td><strong>l</strong></td>
        <td><strong>m</strong></td>
        <td><strong>n</strong></td>
        <td><strong>o</strong></td>
    </tr>
    <tr class="value-row">
        <td>104 (0x68)</td>
        <td>105 (0x69)</td>
        <td>106 (0x6A)</td>
        <td>107 (0x6B)</td>
        <td>108 (0x6C)</td>
        <td>109 (0x6D)</td>
        <td>110 (0x6E)</td>
        <td>111 (0x6F)</td>
    </tr>
    <tr>
        <td><strong>p</strong></td>
        <td><strong>q</strong></td>
        <td><strong>r</strong></td>
        <td><strong>s </strong></td>
        <td><strong>t</strong></td>
        <td><strong>u</strong></td>
        <td><strong>v</strong></td>
        <td><strong>w</strong></td>
    </tr>
    <tr class="value-row">
        <td>112 (0x70)</td>
        <td>113 (0x71)</td>
        <td>114 (0x72)</td>
        <td>115 (0x73)</td>
        <td>116 (0x74)</td>
        <td>117 (0x75)</td>
        <td>118 (0x76)</td>
        <td>119 (0x77)</td>
    </tr>
    <tr>
        <td><strong>x</strong></td>
        <td><strong>y</strong></td>
        <td><strong>z</strong></td>
        <td><strong>{ </strong></td>
        <td><strong>|</strong></td>
        <td><strong>}</strong></td>
        <td><strong>~</strong></td>
        <td><strong>DEL</strong></td>
    </tr>
    <tr class="value-row">
        <td>120 (0x78)</td>
        <td>121 (0x79)</td>
        <td>122 (0x7A)</td>
        <td>123 (0x7B)</td>
        <td>124 (0x7C)</td>
        <td>125 (0x7D)</td>
        <td>126 (0x7E)</td>
        <td>127 (0x7F)</td>
    </tr>
</table>

So, reading from the table, we can see that `A` is encoded in ASCII as `65`,
`B`: `66`, up to `Z`: `90`.
The uppercase letters are before the lowercase ones --
`a` is `97`, `b`: `98`, up to `z`: `122`.

You might be scratching your head at the first 32 characters
(numbers `0` up to `31`) and the last one (number `127`).
These are so called **control characters**,
not meant to be displayed directly (neither on paper, nor on screens).
You see, in the 60s, when ASCII was devised,
the main way to see the output from computers were printers.
And so, the committee reserved 33 characters as ways to control the printer's behavior when processing a given block of text.
For example, number `7`, called Bell,
was meant to make the printer emit a noise
(like ringing an actual bell)
that would attract the attention of its operator.

Most of them are obsolete today,
however a few remain quite important:

* Number `9` is the well-known Tab character (a source of [much controversy](https://www.youtube.com/watch?v=SsoOG6ZeyUI) in the programming community).
* Number `10`, Line Feed, is used to indicate the end of the current line of text in a file.
  UNIX-like operating systems, such as Linux and MacOS, need just that one character,
  while on Windows, Line Feed needs to be preceded by a Carriage Return
  (number `13`) to properly render the file with multiple lines,
  causing no end of grief when transferring text files between the operating systems.
* Number `0` is called the **null character**, and is used to mark the end of a string in C and C++ programming languages.

ASCII has been a great success,
and proved instrumental when computers went from large,
expensive mainframes in the 60s to the personal computer revolution of the 80s and beyond.
It's so influential, in fact,
that there's a very good chance you're reading this article on a computer that can easily write every single symbol in that table
(feel free to try!).

It's also the basis of all encodings we use up to this day.
For example, if you execute the following Java code:

```java
public class Main {
    public static void main(String[] args) {
        char[] chars = { 65, 100, 97, 109 };
        System.out.println(new String(chars));
    }
}
```

It will print out my name, `Adam`.
You could write a similar program in probably every modern programming language.

## Problems with ASCII

While ASCII is great, it isn't perfect by any means.
It has a few issues, and all of them share the same root cause:
as its name suggests, the standard is very American English-centric.

It only defined letters of the Latin alphabet,
which are the ones English uses.
But many languages require more letters than the base 26,
even if they have Latin origins --
for example, both Spanish and French also require accented letters like `é`.
And this doesn't even mention all of the world languages that use an alphabet other than Latin,
like Cyrillic, Greek, Arabic, Hebrew, Chinese, etc.

Even the symbols included in the standard were a little controversial.
For example, it included the Dollar sign: `$`, but not the Pound sign: `£`.

Given that, you might be surprised that ASCII was adopted at all,
given how ill-suited it seems for use outside the US.
But the reason it was adopted was actually an extremely fortunate coincidence.

You see, the committee only needed 128 characters to express all of the American English requirements.
128 characters need 7 bits (as 2 to the power of 7 = 128) to be stored unambiguously.
However, even during the 60s, when ASCII was created,
almost all computers used 8 bits as the smallest unit of storage.
That meant there were an additional 128 characters that could be stored with that one extra bit,
while still being compliant with ASCII!

And that's exactly what happened.
A slew of encodings emerged,
each compliant with ASCII for values from 0 up to 127,
and using the values 128 to 255 for their own purposes.
Of course, 256 available slots is not enough to cover all characters for all human languages at the same time;
so, each encoding handled at most a few languages that used similar letters --
and in some cases, just  a single one.

The most famous of these, and the ones that caused the most headache,
are the Windows-125x line of encodings.
Each of them was used by the early Windows version in the appropriate locale --
for example, if you bought a Greek version of Windows,
it would use the [Windows-1253](https://en.wikipedia.org/wiki/Windows-1253) encoding.
This would be problematic, because if a file saved with a Greek version of Windows was sent to somebody in Turkey,
they would open it in their default encoding,
[Windows-1254](https://en.wikipedia.org/wiki/Windows-1254),
and all of the non-ASCII characters would be rendered differently
(and most likely look like complete gibberish --
even if the recipient in Turkey could read Greek).

It became obvious that a wider,
more internationally-minded standard than ASCII was needed to get us out of this mess.
And so, in 1988, [Unicode](https://en.wikipedia.org/wiki/Unicode) was born.

## Unicode

Version `1.0` of the Unicode standard was published in 1991.
Unicode is not a static standard --
in fact, it regularly publishes new versions.
Of course, subsequent versions only add characters to the standard,
never change the assignments of existing ones.
As of writing this article, the latest version is `12.0`,
released in May of 2019.

Unicode expands on the central good idea of ASCII,
and the source of problems with the ASCII-extending encodings.
That idea is: each character in the world should unambiguously map to a numeric value.
In Unicode, those numbers are called **code points**.
To preserve backwards compatibility, the first 128 code points are the same as the ASCII ones we saw above.

Code points are usually written as `U+`, and then the hexadecimal numeric value of the code point,
with leading zeros to pad the length to be at least 4 --
for example, the letter `A` would be written as `U+0041`.

Java allows you to use the same notation inside character literals;
so, the example code above could have been written as:

```java
public class Main {
    public static void main(String[] args) {
        char[] chars = { '\u0041', 100, 97, 109 };
        System.out.println(new String(chars));
    }
}
```

Another thing that was obvious when Unicode was forming was that a byte,
with its only 256 possible values,
will not be able to support all characters for all human languages in existence.
So, from the very beginning, Unicode separated the notion of code points from the way they should be represented,
and specifies a few encoding schemes in the standard.

The simplest one is UTF-32, which stores every character in 4 bytes
(hence the name, as 4 bytes = 32 bits).
As the Unicode standard reserved space for a maximum of 1,114,112 potential characters,
and 2 to the power of 32 is 4,294,967,296,
UTF-32 is easily able store every possible Unicode character,
including future ones.
The problem is that it's quite wasteful:
for example, an ASCII text file converted to UTF-32 would immediately quadruple in size.

To combat that flaw, we have the UCS-2 encoding. It's very similar to UTF-32,
but uses 2 bytes instead of 4.
That means it can represent only up to 65,536 characters.
The latest version of the Unicode standard as of writing this already contains 137,993 characters,
and that number will surely increase in the future.
So UCS-2 can only represent a limited subset of all of the characters.

Because of that, a variant of UCS-2, called UTF-16, was created.
It uses a trick built into Unicode to get around the 65,536 limitation.
You see, the standard reserves 2 ranges of code points:
from `U+D800` to `U+DBFF`, and from `U+DC00` to `U+DFFF`.
None of those code points have, or will ever have in the future, any characters assigned to them.
When a UTF-16 encoded file contains 2 bytes from that first range
(called a **high-surrogate pair**) followed by 2 bytes from that second range
(called a **low-surrogate pair**),
it means that those 4 bytes should be treated together as a code point larger that `U+FFFF` (= 65,535).
You can read the exact calculation done to get the code point value in the
[Wikipedia article on UTF-16](https://en.wikipedia.org/wiki/UTF-16#U+010000_to_U+10FFFF).
UTF-16 is what we call a **variable-length encoding**,
as the number of bytes needed to encode a character depends on the character being encoded --
it could be 2, or 4.

The final encoding in the Unicode standard is called UTF-8.
It again leverages the fact that the ASCII codes only take up 7 bits.
So, any code point from the ASCII range (so, up to 127, or `U+007F`)
is represented simply as a single byte value equal to that code point.
However, all code points larger than that are encoded using multiple bytes --
depending on the magnitude of the code point, using 2, 3 or 4 bytes.
So, UTF-8 is also a variable-length encoding.

Its main strength, and the reason it's the most popular encoding in the world today,
is its built-in backwards compatibility with ASCII.
Not only is there no size penalty when converting an ASCII file to UTF-8,
unlike with the above encodings --
no conversion is actually required,
as any ASCII file is also a valid UTF-8 file!
This greatly simplifies interoperability with the huge corpus of existing files encoded with ASCII.

## Emoticons

So, we have text encodings.
Great -- how is that related to emojis?
For that, let's go back in time again.

In the 80s and 90s, the Internet was becoming mainstream,
and a lot of people were using it to communicate with each other.
As the Internet speeds were pretty bad in those early days,
communication was happening pretty much exclusively using text.

What people quickly discovered was that communication only through the written word is quite different than talking.
You see, a huge part of information exchanged when talking with another person is through non-verbal means --
things like tone of voice, body language, facial expressions, etc.
If I call you a "sonaofabitch" while laughing,
and giving you a pat on the back because you just told me you got a promotion,
it's completely different than me calling you a "sonaofabitch" in a low, threating hush --
even though I've used the same exact word in both cases.
As text is missing all those subtleties,
it was causing many problems when trying to convey jokes, irony, etc.

They way people got around the problem was inserting character sequences that signified emotions into their writing.
As the early Internet was limited to pretty much the ASCII character set,
they had to get really creative in using the available characters to accomplish that goal.
Those things became known as **emoticons**
(short for "emotion icons"), or, even shorter, **emotes**.
The most famous examples are ones that resembled a face,
provided you looked at it while tilting your head to one side, usually left.
The most common one was the smile, `:-)` --
often written without the dash representing the nose, `:)`.
It was so common, in fact, that many people called all emoticons *smileys*,
even though not all of them represented happiness --
like the famous frowny face, `:-(`.

Emotes were created for the Internet,
but they really exploded in popularity with the advent of cell phones,
as now people very often communicated through text messages.
While younger readers might think of cell phones as things like the iPhone,
it's important to remember that the first widely successful cell phones looked like this:

<img src="/assets/early-cell-phone.jpg" style="width: 33%">

With such a primitive display, emoticons were the only sensible way to embed something resembling an image into a text message.

## Emojis

So, we finally get to the topic of emojis.

Cell phones became a gigantic business,
and the technology behind them improved rapidly.
The displays started having a sensible resolution,
and quickly became able to render color.
With those improvements, it was finally possible to have actual image files displayed on your cell phone.

The device makers and network operators were of course very aware of how popular emoticons have become.
They decided to leverage the newly improved phone displays to make the experience of using them nicer than having to futz around with a bunch of punctuation symbols.
This trend was especially popular in Japan,
and that's where the name 'emoji' name comes from -- it means 'pictograph' in Japanese.

Phone providers started allowing people to choose from a set of pre-defined, small images that were a graphical representation of the various emotes --
like a cartoon smiling face instead of the characters `:-)`.
That quickly expanded to images of things that were never expressed as emotes,
like animals, objects and persons (like soldiers, firemen, etc.).
Of course, every provider implemented these in a proprietary format,
incompatible with every other provider.
The need for standardization became obvious pretty quickly.
And then somebody realized that there already was a standard aiming to support all characters used by mankind -- Unicode!

Emoji first became part of Unicode with the release of version `6.0` of the standard in 2010.
That version included 722 of them; the newest one at the time of writing this article, `12.0`,
increases that number to 1,273.
It's a safe bet that in the future, more emoji will be added to the standard.

An interesting consequence of the above is that keeping your system up to date becomes even more important --
if an emoji has been added to the standard in a recent version,
your system might not know how to display it!

For example, the computer I'm typing this article on is a pretty old virtual machine,
and it doesn't have an image for `U+1F6D2`, "Shopping trolley": 🛒.
Can your computer display it?
If not, there's a chance you see a box
(possibly with the code point value), or a question mark,
to the right of the colon just after "Shopping trolley" in the previous sentence.

Additionally, the Unicode standard defines a few more complicated constructs than just a simple code point to letter mapping,
and those constructs allow for some very interesting capabilities when used with emoji.
For example, you've probably had the experience of being able to select a skin tone from one of five options (six when you count the default, "unrealistic", one)
when using an emoji that displays human body parts.
You might suspect that each of the variants is a separate Unicode code point --
but that is not the case!
Instead, the variants are achieved by following the base emoji character with a special modifier,
from the range `U+1F3FB` up to `U+1F3FF`,
representing values on the [Fitzpatrick scale](https://en.wikipedia.org/wiki/Fitzpatrick_scale)
for classifying human skin tones
(that scale has 6 values, numbers one and two are combined in the Unicode usage).

Another interesting capability is joining.
Implementations can use `U+200D`, a "Zero Width Joiner",
to indicate a given emoji sequence should be rendered as one image if possible.
For example, a sequence of "Man", "Woman" and "Girl" emoji separated with "Zero Width Joiners" should be rendered as one image of a family with 3 members.
If the target platform does not support an image like that,
it should render the 3 emoji in sequence, ignoring the joiners.

While those capabilities are certainly powerful,
they have some interesting consequences.
For example, the notion of the length of a string of text becomes very removed from its presentation.
With joining, for instance, a single image,
that looks like any other emoji, might be in reality backed by several separate code points in the textual representation!

## Summary

So, this is everything I know about emoji.
If there's a common pattern shared by all of the various stories above,
I believe it's this: **standardization is key**.
In all cases, an initial idea brings technology forward;
but only after all of the providers agree on a common way to implement and exchange it,
is when the idea can really take off, and not cause problems for the end consumers.
