# Import-Remap

Rewrite ES module import specifiers using an import-map.

## Overview

ES modules with bare import specifiers (like `import foo from "foo"`) work fine in Node, but don't work in the browser; the browser expects URLs (like `"/path/to/foo.js"`).

[Import-maps](https://github.com/WICG/import-maps) are an ideal solution to that problem, because they instruct the engine/browser to map a bare import specifier like `"foo"` to a URL like `"/path/to/foo.js"`. However, import-maps are [not yet an available and reliable cross-environment feature](https://caniuse.com/import-maps).

**Import-remap** "solves" this problem by applying your import-map mappings to your ES module file(s), typically as part of a build process. This replaces any matching bare import specifier strings (in `import`, dynamic `import(..)`, and `export .. from ".."` statements) with their corresponding URLs from the import-map. These remapped files are suitable for use in browsers regardless of the support for import-maps.

**Note:** While this tool can remap dynamic `import(..)` calls, it will only do so if there if the first argument is a static string literal (ie, `"in-double-quotes"` or `'in-single-quotes'`) or a simple (non-tagged) template literal with no expressions (ie, `` `in-back-ticks` ``). Any other expression as an argument to dynamic `import(..)` will be ignored.

Any processed file(s) that aren't recognized/parsed as ES modules will simply be copied as-is without being touched.

### Example

Consider this ES module:

```js
// import statement/call forms
import { addFriend } from "friends";
import render from "friends/render";
import("friends/list").then(function(list){
    // ..
});

// supported export statement forms
export * from "friends/events";
export { subscribe } from "friends/subscriptions";
// also supports proposed export-default form
// (currently stage-1!)
export messenger from "friends/messenger";

// NOTE: this specifier isn't listed in the
// import-map, so it won't be remapped and will
// likely still not work in the browser
import manager from "friends/manager";
```

And consider an import-map (JSON) is provided as such:

```js
{
    "friends": "./packages/friends.mjs",
    "friends/render": "./packages/friends/render.mjs",
    "friends/list": "./packages/contrib/friends-list.mjs",
    "friends/events": "https://some-cdn/friends-events/index.mjs",
    "friends/subscriptions": "./packages/subscriptions/index.mjs",
    "friends/messenger": "./messenger.mjs"
}
```

The remapped output file will look like this:

```js
// import statement/call forms
import { addFriend } from "./packages/friends.mjs";
import render from "./packages/friends/render.mjs";
import("./packages/contrib/friends-list.mjs").then(function(list){
    // ..
});

// supported export statement forms
export * from "https://some-cdn/friends-events/index.mjs";
export { subscribe } from "./packages/subscriptions/index.mjs";
// also supports proposed export-default form
// (currently stage-1!)
export messenger from "./messenger.mjs";

// NOTE: this specifier isn't listed in the
// import-map, so it won't be remapped and will
// likely still not work in the browser
import manager from "friends/manager";
```

As you can see, there's no fancy matching logic in the string values. Only exact matches (case-sensitive!) are replaced.

**Note:** This strict matching doesn't *exactly* follow the current proposed (and fluctuating) import-map behaviors; behavior adherence is expected in the future when the specification for import-map is finalized.

## CLI

To use the CLI:

```cmd
import-remap --from="./src" --to="./src.remapped"
--map="./path/to/import-map.json" [--ignore={GLOB-PATTERN}] [--recursive] [--minify]
```

See `import-remap --help` for a list of available parameter flags.

### CLI Flags

* `--from=PATH`: specifies the path to a directory (or a single file) containing the files to duplicate (and remap, if applicable) into the `--to`-sepcified target location; defaults to `./` in the current working directory

* `--to=PATH`: specifies the path to a directory to write the remapped ES module file(s); defaults to a directory called `./.remapped` in the same location as the `--from`-specified path

* `--map=PATH`: specifies the path to the JSON import-map file to use for remapping; defaults to "./import-map.json"

* `--ignore` (alias `-i`): specify a [glob pattern](https://github.com/micromatch/micromatch#matching-features) for ignoring remap processing on an input file path -- copies the file from the input path untouched if matched; multiple ignore-patterns can be specified by using `--ignore` / `-i` multiple times in the command

* `--recursive` (alias `-r`): traverse the `--from`-specified path recursively

* `--minify` (alias `-n`): minify the output (using terser), while preserving any code comments; otherwise, the output is the default serialization from the babel parser/generator

The CLI tool will also read the following settings from the current process environment (or source them from a .env file in the current working directory):

* `FROMPATH`: corresponds to the `--from` parameter (see above)
* `TOPATH`: corresponds to the `--to` parameter (see above)
* `MAPPATH`: corresponds to the `--map` parameter (see above)

## Library

The typical use of **Import-remap** is through the CLI, but it can also be used in your application code. The package provides a single function called `remap(..)`, which expects the following arguments:

* `codePath`: a string representing the current path of the file; not currently used, but reserved for potential future use

* `contents`: a string holding the code from the file to be remapped

* `importMap`: an object holding the contents of the JSON import-map

The return value from `remap(..)` is a string with the remapped code. If the contents weren't parsed properly as an ES module, or if no matching specifiers were found to replace, this return value will identical to the passed in `contents` argument.

## npm Package

To install this package from `npm`:

```
npm install import-remap
```

And to require it in a node script:

```js
var remap = require("import-remap");
```

Or in an ES module (in Node):

```js
import remap from "import-remap";
```

**Note:** As of v0.3.0, the previously required ESM import specifier segment `/esm` in **Import-Remap** `import` paths has been deprecated (and will eventually be removed), in favor of unified import specifier paths via [Node Conditional Exports](https://nodejs.org/api/packages.html#packages_conditional_exports). For ESM `import` statements, always use the specifier style `"import-remap"`, instead of `"import-remap/esm"`.

Running this tool in a non-Node environment is not supported.

## License

All code and documentation are (c) 2021 Kyle Simpson and released under the [MIT License](http://getify.mit-license.org/). A copy of the MIT License [is also included](LICENSE.txt).
