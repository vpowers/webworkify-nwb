var __webpack_require__ = arguments[2];
var sources = __webpack_require__.m;
var ENTRY_MODULE = __webpack_require__.s || "0";
// In webpack 2 the moduleId property is called `i` instead of `id`.
var webworkifyWebpackModuleId = arguments[0].id || arguments[0].i;

var webpackBootstrapFunc = function(modules) {
    var installedModules = {};
    var moduleSources = [];
    function __webpack_require__(moduleId) {

        if(installedModules[moduleId])
            return installedModules[moduleId].exports;
        var module = installedModules[moduleId] = {
            exports: {},
            id: moduleId,
            loaded: false
        };

        var moduleCaller = modules.find(function(module){
            return module.moduleId == moduleId;
        });

        for (var key in modules) {
            moduleSources.push(modules[key].module);
        }

        moduleCaller.module.call(module.exports, module, module.exports, __webpack_require__);
        module.loaded = true;
        return module.exports;
    }

    __webpack_require__.m = moduleSources;
    __webpack_require__.c = installedModules;
    __webpack_require__.oe = function(err) { throw err; };
    __webpack_require__.p = "";
    var f = __webpack_require__(__webpack_require__.s = entryModule);
    //debugger;
    return f.default || f; // try to call default if defined to also support babel esmodule exports
}

// http://stackoverflow.com/a/2593661/130442
function quoteRegExp(str) {
    return (str+'').replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&");
}

module.exports = function (fn, options) {
    var moduleWrapperStrings = {};
    var potentialFnModuleIds = [ENTRY_MODULE];

    var sourcesKeys = Object.keys(sources); // when using the CommonChunks plugin, webpacl sometimes storing sources in object instead of array


    // first, find the modules that required webworkify-webpack, and note their requires so that we can limit the number of potential duplicate matches
    // while we're at it, save the string version for use later
    var key;
    for (var i = 0, l = sourcesKeys.length; i < l; i++) {
        var k = sourcesKeys[i];
        if (!sources[k]) {
            continue;
        }
        var wrapperFuncString = sources[k].toString();
        moduleWrapperStrings[k] = wrapperFuncString;

        // __webpack_require__ is the third argument passed to the wrapper function, but it may have been renamed by minification
        var wrapperSignature = wrapperFuncString.match(/^function\s?\(\w+,\s*\w+,\s*(\w+)\)/);
        if (!wrapperSignature) {
            // no matches means the module doesn't use __webpack_require__, and we can skip it entirely
            continue;
        }

        var webpackRequireName = wrapperSignature[1];
        if ((wrapperFuncString.indexOf(webpackRequireName + '(' + webworkifyWebpackModuleId + ')') > -1) || wrapperFuncString.indexOf(webpackRequireName + '("' + webworkifyWebpackModuleId + '")') > -1) {
            // find all calls that look like __webpack_require__(\d+), and aren't webworkify-webpack
            var re = new RegExp(quoteRegExp(webpackRequireName) + '\\(\\"\(\\S*)\\"\\)', 'g');

            var match;
            while (match = re.exec(wrapperFuncString)) {
                if (match[1] != ('' + webworkifyWebpackModuleId)) {
                    potentialFnModuleIds.push(match[1]);
                }
            }
        }
    }

    var fnString = fn.toString()
    // FF adds a "use strict"; to the function body
        .replace(/"use strict";\n\n/, '');

    var fnStringNoSpace = fnString
        .replace(/^function\s?\((.*)\)(\s?)\{(\n"use strict";\n)?/, 'function($1)$2{');
    var fnStringWithSpace = fnString
        .replace(/^function\s?\((.*)\)(\s?)\{(\n"use strict";\n)?/, 'function ($1)$2{');

    // find the first moduleId from the above list that contains fnString
    var key = potentialFnModuleIds.find(function (moduleId) {
        var wrapperFuncString = sources[moduleId].toString();
        if (wrapperFuncString.indexOf(fnStringNoSpace) > -1 || wrapperFuncString.indexOf(fnStringWithSpace) > -1) {
            var exp = __webpack_require__(moduleId);

            // Using babel as a transpiler to use esmodule, the export will always
            // be an object with the default export as a property of it. To ensure
            // the existing api and babel esmodule exports are both supported we
            // check for both
            if (!(exp && (exp === fn || exp.default === fn))) {
                moduleWrapperStrings[moduleId] = wrapperFuncString.substring(0, wrapperFuncString.length - 1) + '\n' + fnString.match(/function\s?(.+?)\s?\(.*/)[1] + '();\n}';
            }

            return true;
        }

        return false;
    });

    if (typeof key === 'undefined') {
        throw new Error('webworkify-webpack: Could not locate module containing worker function! Make sure you aren\'t using eval sourcemaps and that you pass named functions to webworkify-webpack!');
    }

    var commaSeparatedModuleStrings = "";
    for (var val in moduleWrapperStrings) {
        commaSeparatedModuleStrings += '{moduleId: "' + val + '", module: ' + moduleWrapperStrings[val] + '}' + ",";
    }
    //console.log(commaSeparatedModuleStrings);
    var src = 'var fn = (' + webpackBootstrapFunc.toString().replace('entryModule', '"' + key + '"') + ')(['
        + commaSeparatedModuleStrings
        + ']);\n'
        + '(typeof fn === "function") && fn(self);'; // not a function when calling a function from the current scope

    var blob = new Blob([src], { type: 'text/javascript' })
    if (options && options.bare) { return blob; }
    var URL = window.URL || window.webkitURL || window.mozURL || window.msURL;
    var workerUrl = URL.createObjectURL(blob);
    var worker = new Worker(workerUrl);
    worker.objectURL = workerUrl;
    return worker;
};
