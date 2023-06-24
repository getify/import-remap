"use strict";

var path = require("path");
var fs = require("fs");
var os = require("os");

var dotenv = require("dotenv");
var micromatch = require("micromatch");
var minimist = require("minimist");
var mkdirp = require("mkdirp");
var recursiveReadDir = require("recursive-readdir-sync");
var terser = require("terser");

var remap = require("./index.js");

var programVersion;
var HOMEPATH = os.homedir();

var params = minimist(process.argv.slice(2),{
	boolean: [ "help","version","recursive","minify", ],
	string: [ "from","to","map","keep","skip","ignore", ],
	alias: {
		"recursive": "r",
		"minify": "n",
		"keep": "k",
		"skip": "s",

		// deprecated
		"ignore": "i",
	},
	default: {
		help: false,
		version: false,
		recursive: false,
	},
});

dotenv.config();
var config = defaultCLIConfig();


module.exports = CLI;
module.exports.CLI = CLI;


// ******************************

async function CLI(version = "0.0.0?") {
	programVersion = version;

	if (!loadConfig()) {
		return;
	}

	var inputFiles = getInputFiles();

	try {
		// remap each file
		for (let [ basePath, relativePath, ] of inputFiles) {
			let readPath = path.join(basePath,relativePath);
			let output;

			// file DOES NOT match a skip pattern?
			if (!matchesSkip(readPath)) {
				// file DOES NOT match a keep (aka ignored) pattern?
				if (!matchesKeepIgnore(readPath)) {
					let text = fs.readFileSync(readPath,"utf-8");
					output = remap(relativePath,text,config.map);
					output = await processContents(output);
				}
				// otherwise, simply copy this file without remapping
				else {
					output = fs.readFileSync(readPath);
				}
			}
			// otherwise, completely skip this file
			else {
				continue;
			}

			let outputPath = path.join(config.to,relativePath);
			let outputDir = path.dirname(outputPath);
			if (mkdir(outputDir) !== true) {
				throw new Error(`Output directory (${ outputDir }) could not be created.`);
			}
			try {
				if (typeof output == "string") {
					fs.writeFileSync(outputPath,output,"utf-8");
				}
				else {
					fs.writeFileSync(outputPath,output);
				}
			}
			catch (err) {
				throw new Error(`Output file (${ outputPath }) could not be created.`);
			}
		}
	}
	catch (err) {
		return showError(err);
	}
}

async function processContents(contents) {
	if (params.minify) {
		let result = await terser.minify(contents,{
			mangle: {
				keep_fnames: true,
			},
			compress: {
				keep_fnames: true,
			},
			output: {
				comments: "all",
			},
		});
		if (!(result && result.code)) {
			if (result.error) throw result.error;
			else throw result;
		}
		contents = result.code;
	}
	return contents;
}

function loadConfig() {
	// user asking for help output?
	if (params.help) {
		printHelp();
		return;
	}

	if (params.version) {
		printVersion();
		return;
	}

	// warn using deprecated '--ignore' / '-i' option?
	if (params.ignore) {
		console.warn("******************");
		console.warn("Option '--ignore' / '-i' is deprecated; use '--keep' / '-k' instead.");
		console.warn("******************");
	}

	// from path invalid?
	if (!checkPath(config.from)) {
		return showError(`Input directory (${ config.from }) is missing or inaccessible.`);
	}
	// to path invalid?
	if (!checkPath(config.to)) {
		// should we create the default output target directory?
		if (/\.remapped$/.test(config.to)) {
			// double-check the path was created?
			if (!mkdir(config.to)) {
				return showError(`Default output directory (${ config.to }) could not be created.`);
			}
		}
		else {
			return showError(`Output directory (${ config.to }) is missing or inaccessible.`);
		}
	}

	if (!config.map) {
		// import-map path is invalid?
		if (!checkPath(config.mapPath)) {
			return showError(`Import-map (${ config.mapPath }) is missing or inaccessible.`);
		}
		// otherwise, load import-map from path
		else {
			let json;
			try {
				json = JSON.parse(fs.readFileSync(config.mapPath,"utf-8"));
			}
			catch (err) {
				return showError(`Invalid/missing import-map (${ config.mapPath }).`);
			}
			config.map = json;
		}
	}

	return true;
}

function getInputFiles() {
	var files;

	// scan the directory for input files?
	if (isDirectory(config.from)) {
		if (config.recursive) {
			try {
				files = recursiveReadDir(config.from);
			}
			catch (err) {
				return showError(`Failed scanning for input files (${ config.from })`);
				return;
			}
		}
		else {
			files =
				fs.readdirSync(config.from)
				.filter(function skipDirs(pathStr){
					return !isDirectory(pathStr);
				});
		}
	}
	// otherwise, assume only a single input file
	else {
		files = [ config.from, ];
	}

	// split all paths into base and relative
	files = files.map(function fixPaths(pathStr){
		var [ basePath, relativePath, ] = splitPath(config.from,pathStr);
		return [ basePath, addRelativeCurrentDir(relativePath), ];
	});

	return files;
}

function printHelp() {
	console.log("Import-Remap usage:");
	console.log("  import-remap {OPTIONS}");
	console.log("");
	console.log("--help                     print this help");
	console.log("--version                  print version info");
	console.log("--from={PATH}              scan directory for input file(s)");
	console.log(`                           [${ config.from }]`);
	console.log("--keep={PATTERN}, -k       keep (copy-only) glob pattern matching input(s)");
	console.log(`                           [${ config.keep }]`);
	console.log("--ignore={PATTERN}, -i     deprecated; use --keep / -k instead");
	console.log("--skip={PATTERN}, -s       skip glob pattern matching input(s) entirely");
	console.log(`                           [${ config.skip }]`);
	console.log("--to={PATH}                target directory for output file(s)");
	console.log(`                           [${ config.to }]`);
	console.log("--map={PATH}               path to import-map JSON file");
	console.log(`                           [${ config.mapPath }]`);
	console.log("--recursive, -r            scan recursively for input files");
	console.log(`                           [${ config.recursive }]`);
	console.log("--minify, -n               minify output files");
	console.log(`                           [${ config.minify }]`);
	console.log("");
}

function printVersion() {
	console.log(`v${ programVersion }`);
}

function showError(err,includeHelp = false) {
	console.error(err.toString());
	if (includeHelp) {
		console.log("");
		printHelp();
	}
	process.exit(1);
}

function defaultCLIConfig({
	from = process.env.FROMPATH,
	to = process.env.TOPATH,
	mapPath = process.env.MAPPATH,
	skip = params.skip,
	keep = params.keep,
	ignore = params.ignore,
	map,
	recursive,
	minify,
} = {}) {
	// params override configs
	from = resolvePath(params.from || from || "./");
	to = resolvePath(params.to || to || "./.remapped");
	mapPath = resolvePath(params.map || mapPath || "./import-map.json");
	recursive = Boolean(params.recursive || recursive);
	minify = Boolean(params.minify || minify);
	if (skip) {
		if (!Array.isArray(skip)) {
			skip = [ skip, ];
		}
	}
	else {
		skip = [];
	}
	if (keep) {
		if (!Array.isArray(keep)) {
			keep = [ keep, ];
		}
	}
	else {
		keep = [];
	}
	if (ignore) {
		keep = [ ...keep, ...(Array.isArray(ignore) ? ignore : [ ignore, ]), ];
	}

	return {
		from, to, mapPath, skip, keep, map, recursive, minify
	};
}

function resolvePath(pathStr,basePath = process.cwd()) {
	pathStr = expandHomeDir(pathStr);
	return path.resolve(basePath,pathStr);
}

function mkdir(pathStr) {
	try {
		mkdirp.sync(pathStr);
		return true;
	}
	catch (err) {
		return err;
	}
}

function expandHomeDir(pathStr) {
	if (pathStr[0] == "~" && (pathStr.length == 1 || pathStr[1] == "/")) {
		pathStr = pathStr.replace(/^~/,HOMEPATH);
	}
	return pathStr;
}

function addRelativeCurrentDir(pathStr) {
	return (
		(
			!path.isAbsolute(pathStr) &&
			!/^(?:(?:\.+[/\\]+)|(?:~(?:[/\\].*)$))/.test(pathStr)
		) ?
			`./${ pathStr }` :
			pathStr
	);
}

function splitPath(fromPathStr,pathStr) {
	var fromDir = path.resolve(fromPathStr);
	if (!isDirectory(fromDir)) {
		fromDir = path.dirname(fromDir);
	}
	var fullPathStr = path.resolve(fromDir,pathStr);
	var basePath = fullPathStr.substr(0,fromDir.length);
	var relativePath = fullPathStr.substr(fromDir.length + 1);
	return [ basePath, relativePath, ];
}

function isDirectory(pathStr) {
	return checkPath(pathStr) && fs.lstatSync(pathStr).isDirectory();
}

function checkPath(pathStr) {
	return fs.existsSync(pathStr);
}

function matchesSkip(pathStr) {
	if (config.skip && config.skip.length > 0) {
		return (micromatch(pathStr,config.skip).length > 0);
	}
}

function matchesKeepIgnore(pathStr) {
	if (config.keep && config.keep.length > 0) {
		return (micromatch(pathStr,config.keep).length > 0);
	}
}
