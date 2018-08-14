Metalsmith
==========

[Metalsmith](http://www.metalsmith.io/) looks really great -
flexible, and very general.

Plugins
-------

There is a _shitton_ of plugins.
So much, I need to divide them into categories.

#### Moving the articles up

* [flatten](https://github.com/chadly/metalsmith-flatten) looks good,
  except it adds the directory path to the files!
  I don't want that, and it seems like you can't turn it off.
* [elevate](https://github.com/tylersticka/metalsmith-elevate) corrects that flaw!
  The only problem: seems very immature, and not developed.
* [move-up](https://github.com/mcdonnelldean/metalsmith-move-up) looks good,
  _but_ you have to specify the number to move by explicitly (instead of it flattening automatically).
  Actually, turns out elevate has the same problem! So this is actually the best option.
* [move-remove](https://github.com/carlnordenfelt/metalsmith-move-remove)
  doesn't support patterns in the file(s) argument(s).
* [copy](https://github.com/mattwidmann/metalsmith-copy) could be used for that
  (seems quite generic).
* ... as well as [renamer](https://github.com/alex-ketch/metalsmith-renamer) -
  it could be hard to write that logic,
  _but_ [paths](https://github.com/ahmadnassri/metalsmith-paths) can help with that.
