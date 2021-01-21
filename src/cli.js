"use strict";

var path = require("path");
var fs = require("fs");
var os = require("os");

var dotenv = require("dotenv");
var minimist = require("minimist");
var mkdirp = require("mkdirp");
var recursiveReadDir = require("recursive-readdir-sync");

var remap = require("./index.js");

var programVersion;
var HOMEPATH = os.homedir();

var params = minimist(process.argv.slice(2),{
	boolean: [ "help","version","recursive", ],
	string: [ "from","to","map", ],
	alias: {
		"recursive": "r",
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
			let code = fs.readFileSync(path.join(basePath,relativePath),"utf-8");
			let res = remap(relativePath,code,config.map);

			let outputPath = path.join(config.to,relativePath);
			let outputDir = path.dirname(outputPath);
			if (mkdir(outputDir) !== true) {
				throw new Error(`Output directory (${ outputDir }) could not be created.`);
			}
			try {
				fs.writeFileSync(outputPath,res,"utf-8");
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
				})
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
	console.log("--to={PATH}                target directory for output file(s)");
	console.log(`                           [${ config.to }]`);
	console.log("--map={PATH}               path to import-map JSON file");
	console.log(`                           [${ config.mapPath }]`);
	console.log("--recursive, -r            scan recursively for input files");
	console.log(`                           [${ config.recursive }]`);
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
	map,
	recursive,
} = {}) {
	// params override configs
	from = resolvePath(params.from || from || "./");
	to = resolvePath(params.to || to || "./.remapped");
	mapPath = resolvePath(params.map || mapPath || "./import-map.json");
	recursive = Boolean(params.recursive || recursive);

	return {
		from, to, mapPath, map, recursive,
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
