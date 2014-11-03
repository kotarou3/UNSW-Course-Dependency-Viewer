#!/usr/bin/nodejs --harmony
/*
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

"use strict";

require("prfun");

let fs = require("fs");
let logicExpressionParser = require("./logic-expression-parser.js");

if (process.argv.length < 4) {
    console.warn("Usage: " + require("path").basename(process.argv[1]) + " <input file> <output file> [<existing corrections file>]");
    console.warn("The input file can either be a JSON file containing the `requirementsCorrections` data from the browser's `localStorage`, or a file with `/data/?<correction>` on each line, extracted from server logs for example.");
    process.exit(1);
}

if (fs.existsSync(process.argv[3])) {
    console.warn("Not overwriting", process.argv[3]);
    process.exit(1);
}

let corrections = {};
if (process.argv[4]) {
    try {
        corrections = JSON.parse(fs.readFileSync(process.argv[4]));
    } catch (e) {
        console.warn("Could not open or parse", process.argv[4]);
        console.warn(e.message);
        process.exit(1);
    }
}

let input = fs.readFileSync(process.argv[2]).toString();
try {
    let json = JSON.parse(input);
    input = [];
    for (let requirements in json)
        input.push({
            requirements: requirements,
            prerequisiteCourses: logicExpressionParser.logicTreeToString(json[requirements].prerequisiteCourses),
            corequisiteCourses: logicExpressionParser.logicTreeToString(json[requirements].corequisiteCourses)
        });
} catch (e) {
    input = input.split("\n").map(function (line) {
        let data = line.match(/\/data\/\?(.*?)( |$)/);
        if (!data)
            return;

        return JSON.parse(decodeURIComponent(data[1]));
    }).filter(function (data) {
        return data;
    });
}

function showNextEntry() {
    let entry = input[0];
    if (!entry)
        return false;

    let existingCorrection = corrections[entry.requirements];
    let existingPrerequisiteCourses = existingCorrection && logicExpressionParser.logicTreeToString(existingCorrection.prerequisiteCourses);
    let existingCorequisiteCourses = existingCorrection && logicExpressionParser.logicTreeToString(existingCorrection.corequisiteCourses);
    if (entry.prerequisiteCourses === existingPrerequisiteCourses && entry.corequisiteCourses === existingCorequisiteCourses) {
        input.shift();
        return showNextEntry();
    }

    console.log("Requirements:", entry.requirements);
    console.log("Prerequisite Courses:", entry.prerequisiteCourses);
    console.log("Corequisite Courses:", entry.corequisiteCourses);
    if (existingCorrection) {
        console.log("Existing Prerequisite Courses:", existingPrerequisiteCourses);
        console.log("Existing Corequisite Courses:", existingCorequisiteCourses);
    }

    process.stdout.write("Accept? [Y/n] ");

    return true;
}

if (!showNextEntry()) {
    console.warn("Input empty or completely matches existing corrections. Nothing to do.");
    process.exit(0);
}

process.stdin.on("data", function (buffer) {
    buffer = buffer.toString().toLowerCase().trim();
    if (buffer === "y" || !buffer) {
        let entry = input[0];

        corrections[entry.requirements] = {
            prerequisiteCourses: entry.prerequisiteCourses ? logicExpressionParser.parseLogicExpression(entry.prerequisiteCourses) : "",
            corequisiteCourses: entry.corequisiteCourses ? logicExpressionParser.parseLogicExpression(entry.corequisiteCourses) : ""
        };

        input.shift();
    } else if (buffer === "n") {
        input.shift();
    }

    console.log();
    if (!showNextEntry()) {
        fs.writeFileSync(process.argv[3], JSON.stringify(corrections, null, 4));
        console.log("Saved to", process.argv[3]);
        process.exit(0);
    }
});
process.stdin.resume();
