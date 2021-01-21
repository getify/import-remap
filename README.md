# Import-Remap

Rewrite ES module import specifiers using an import-map.

## Overview

ES modules with bare import specifiers (like `import foo from "foo"`) work fine in Node, but don't work in the browser; the browser expects URLs (like `"/path/to/foo.js"`).

Import-maps are a solution to that problem, because they allow you to map a bare import specifier like `"foo"` to a URL like `"/path/to/foo.js"`. However, import-maps are not yet an available and reliable cross-environment feature.

This tool "solves" this problem by applying your import-map to your ES module file(s), remapping any matching bare import specifiers to their corresponding URLs. These remapped files are suitable for use in browsers regardless of the support for import-maps.

## CLI

To use the CLI:

```cmd
import-remap --from="./src" --to="./src.remapped" --map="./path/to/import-map.json" [--recursive]
```

See `import-remap --help` for a list of available parameter flags.

### CLI Flags

* `--from=PATH`: specifies the path to a directory (or a single file) containing the files to duplicate (and remap, if applicable) into the `--to`-sepcified target location; defaults to `./` in the current working directory

* `--to=PATH`: specifies the path to a directory to write the remapped ES module file(s); defaults to a directory called `./.remapped` in the same location as the `--from`-specified path

* `--map=PATH`: specifies the path to the JSON import-map file to use for remapping; defaults to "./import-map.json"

* `--recursive` (alias `-r`): traverse the `--from`-specified path recursively

The CLI tool will also read the following settings from the current process environment (or source them from a .env file in the current working directory):

* `FROMPATH`: corresponds to the `--from` parameter (see above)
* `TOPATH`: corresponds to the `--to` parameter (see above)
* `MAPPATH`: corresponds to the `--map` parameter (see above)

## Library

TODO

## License

All code and documentation are (c) 2021 Kyle Simpson and released under the [MIT License](http://getify.mit-license.org/). A copy of the MIT License [is also included](LICENSE.txt).
