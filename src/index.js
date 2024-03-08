"use strict";

var { default: traverse, } = require("@babel/traverse");
var T = require("@babel/types");
var { default: generate, } = require("@babel/generator");
var { parse, } = require("@babel/parser");
var { parse: parseImportMap, resolve } = require('@import-maps/resolve');


module.exports = remap;


// ******************************

function remap(codePath,contents,importMap,base) {
	var moduleSpecifiers = new Set();

	// Backwards compatibility: If the map has no "imports" key, then use the
	// passed object the value of the "imports" property of a compliant map
	importMap = parseImportMap(importMap.imports ? importMap : { imports: importMap, }, base);

	var visitors = {
		CallExpression: {
			exit(path) {
				// import(..) call?
				if (
					(
						// recognized as dedicated `import` AST node?
						T.isImport(path.node.callee) ||
						// recognized as a normal function call of name `import(..)`
						T.isIdentifier(path.node.callee,{ name: "import", })
					) &&
					(
						// non-empty string literal as first argument?
						(
							T.isStringLiteral(path.node.arguments[0]) &&
							path.node.arguments[0].value != ""
						) ||
						// non-empty string-only template literal as first argument?
						(
							T.isTemplateLiteral(path.node.arguments[0]) &&
							path.node.arguments[0].expressions.length == 0 &&
							path.node.arguments[0].quasis[0].value.cooked != ""
						)
					)
				) {
					moduleSpecifiers.add({
						path,
						specifier: path.node.arguments[0],
					});
				}
			},
		},
		ImportDeclaration: {
			exit(path) {
				// has source (module specifier)?
				if (path.node.source) {
					moduleSpecifiers.add({
						path,
						specifier: path.node.source,
					});
				}
			},
		},
		ExportAllDeclaration: {
			exit(path) {
				// has source (module specifier)?
				if (path.node.source) {
					moduleSpecifiers.add({
						path,
						specifier: path.node.source,
					});
				}
			},
		},
		ExportNamedDeclaration: {
			exit(path) {
				// has source (module specifier)?
				if (path.node.source) {
					moduleSpecifiers.add({
						path,
						specifier: path.node.source,
					});
				}
			},
		},
	};

	try {
		let programAST = parse(contents,{
			sourceType: "module",
			plugins: [
				"exportDefaultFrom",
			],
			sourceFilename: codePath,
		});
		traverse(programAST,visitors);
		let anyRemapped = false;

		for (let entry of moduleSpecifiers) {
			let specifierText = (
				T.isStringLiteral(entry.specifier) ?
					entry.specifier.value :
					entry.specifier.quasis[0].value.cooked
			);

			// specifier found in import-map?
			const { resolvedImport, matched } = resolve(specifierText, importMap, codePath)
			if (matched) {
				anyRemapped = true;
				let replacement = T.StringLiteral(resolvedImport.toString());

				// replace call-expression's first argument?
				if (T.isCallExpression(entry.path.node)) {
					entry.path.node.arguments[0] = replacement;
				}
				// otherwise, replace import/export specifier "source"
				else {
					entry.path.node.source = replacement;
				}
			}
		}

		// need to regenerate the remapped code?
		if (anyRemapped) {
			return generate(programAST).code;
		}
	}
	catch (err) {}

	// if we get here, remapping either failed or had
	// no replacements to make for this file, so just
	// silently return whatever was passed in
	return contents;
}
