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

function downloadHandbook(year) {
    let request = Promise.guard(3, Promise.promisify(require("request"), true));
    let libxml = require("libxmljs");
    let url = require("url");
    let path = require("path");

    let coursesUrl = "http://www.handbook.unsw.edu.au/vbook" + year + "/brCoursesByAtoZ.jsp?StudyLevel=Undergraduate&descr=All";
    return request(coursesUrl).spread(function (response, body) {
        return libxml.parseHtmlString(body).find("//table[@class = 'tabluatedInfo']//a/@href").map(function (courseLink) {
            return url.resolve(coursesUrl, courseLink.value());
        });
    }).reduce(function (pages, courseLink) {
        console.warn("Downloading", courseLink);
        return request(courseLink).spread(function (response, body) {
            pages[path.basename(courseLink, ".html")] = body;
            return pages;
        });
    }, {});
}

function parseLogicExpression(expression) {
    let tree = require("jsep")(expression);

    let stack = [tree];
    while (stack.length > 0) {
        let node = stack.pop();

        if (node.type === "Literal") {
            node.type = "Identifier";
            node.name = node.raw;
        } else if (node.left && node.right) {
            node.children = [node.left, node.right];
            delete node.left;
            delete node.right;

            // Flatten any chains (e.g., (A && B) && C -> A && B && C)
            for (let c = 0; c < node.children.length; ++c)
                if (node.operator === node.children[c].operator) {
                    node.children.splice(c, 1, node.children[c].left, node.children[c].right);
                    --c;
                }

            Array.prototype.push.apply(stack, node.children);
        }
    }

    return tree;
}
function logicTreeToString(tree) {
    if (!tree)
        return "";
    if (tree.type === "Identifier")
        return tree.name;

    tree = JSON.parse(JSON.stringify(tree));
    let stack = [tree];
    while (stack.length > 0) {
        let node = stack[stack.length - 1];

        let areChildrenReady = true;
        for (let c = 0; c < node.children.length; ++c)
            if (node.children[c].type !== "Identifier") {
                areChildrenReady = false;
                stack.push(node.children[c]);
            }
        if (!areChildrenReady)
            continue;

        node.type = "Identifier";
        node.name = node.children.map(function (child) { return child.name; }).join(" " + node.operator + " ");
        if (node !== tree)
            node.name = "(" + node.name + ")";

        stack.pop();
    }

    return tree.name;
}
function parseHumanReadableList(list, defaultConditional, elementRegex) {
    let isFailed = false;
    let parts = (" " + list + " ")
        .replace(/\s+/g, " ")
        .replace(/[.,]+/g, " ")
        .replace(/[\[{]/g, "(")
        .replace(/[\]}]/g, ")")
        .replace(/([()])/g, " $1 ")
        .replace(/ ([^ ]+)\/([^ ]+)/g, " ( $1 or $2 ) ")
        .split(" ");
    let parsedParts = [];
    let lastConditional = defaultConditional;
    for (let p = parts.length - 1; p >= 0; --p) {
        let part = parts[p].trim();
        if (!part)
            continue;

        if (part.toLowerCase() === "and") {
            lastConditional = "&&";
            parsedParts.unshift("&&");
            continue;
        }
        if (part.toLowerCase() === "or") {
            lastConditional = "||";
            parsedParts.unshift("||");
            continue;
        }

        if (part === ")") {
            if (parsedParts.length > 0 && (parsedParts[0].match(elementRegex) || parsedParts[0] === "("))
                parsedParts.unshift(lastConditional);
            parsedParts.unshift(")");
            continue;
        }
        if (part === "(") {
            parsedParts.unshift("(");
            continue;
        }

        if (!part.match(elementRegex)) {
            isFailed = true;
        } else {
            if (parsedParts.length > 0 && (parsedParts[0].match(elementRegex) || parsedParts[0] === "("))
                parsedParts.unshift(lastConditional);
            parsedParts.unshift(part);
        }
    }

    let parsedList = parsedParts.join("");
    let parsedList2;
    while (true) {
        parsedList2 = parsedList.replace(/\(\)/g, "").replace(/(^|\()([&|]{2})+/g, "$1").replace(/([&|]{2})+($|\))/g, "$2").replace(/([&|]{2})([&|]{2})+/g, "$1");
        if (parsedList2 === parsedList)
            break;

        isFailed = true;
        parsedList = parsedList2;
    }

    try {
        return {
            list: parsedList ? parseLogicExpression(parsedList) : null,
            isFailed: isFailed
        };
    } catch (e) {
        return {list: null, isFailed: true};
    }
}
function parseHandbook(pages) {
    let libxml = require("libxmljs");

    const dataKeyMap = {
        faculty: "faculty",
        school: "school",
        courseoutline: "courseOutline",
        campus: "campus",
        career: "career",
        unitsofcredit: "unitsOfCredit",
        eftsl: "eftsl",
        contacthoursperweek: "hoursPerWeek",
        indicativecontacthoursperweek: "hoursPerWeek",
        enrolmentrequirements: "requirements",
        equivalent: "equivalentCourses",
        excluded: "excludedCourses",
        csscontributioncharge: "feeBand",
        feeband: "feeBand",
        hecsband: "feeBand",
        tuitionfee: "fee",
        furtherinformation: "furtherInformation",
        availableforgeneraleducation: "isGeneralEducation",
        contact: "contact",
        offered: "sessions",
        sessionoffered: "sessions"
    };
    const requirementsKeyMap = {
        prerequisite: "prerequisiteCourses",
        prerequisites: "prerequisiteCourses",
        prerequisiite: "prerequisiteCourses",
        prerequsite: "prerequisiteCourses",
        prerequiste: "prerequisiteCourses",
        prerequistes: "prerequisiteCourses",
        prerequiistes: "prerequisiteCourses",
        parerequisite: "prerequisiteCourses",
        prerquisite: "prerequisiteCourses",
        prererquisite: "prerequisiteCourses",
        prequisite: "prerequisiteCourses",
        prereq: "prerequisiteCourses",
        pre: "prerequisiteCourses",
        required: "prerequisiteCourses",

        corequisite: "corequisiteCourses",
        corequisites: "corequisiteCourses",
        corequistes: "corequisiteCourses",
        corequiste: "corequisiteCourses",
        co: "corequisiteCourses",
        andcorequisite: "corequisiteCourses",
        prerequisitecorequisite: "corequisiteCourses",
        prerequisiteorcorequisite: "corequisiteCourses",
        precorequisite: "corequisiteCourses",

        excluded: "excludedCourses",
        excludued: "excludedCourses",
        exclusion: "excludedCourses",
        exclusions: "excludedCourses",
        excl: "excludedCourses"
    };
    const dataParsers = {
        requirements: function (data, requirements) {
            if (requirements.toLowerCase().trim() === "none")
                return;

            data.isParsingRequirementsFailed = true;
            if (!requirements.match(/\b[A-Z]{4}[0-9]{4},?\b/))
                return requirements;

            let parts = requirements.split(":").map(function (part) { return part.trim(); });
            if (parts.length < 2)
                return requirements;

            let isParsingFailed = false;
            let sections = [{key: parts.shift(), value: parts.shift()}];
            while (parts.length) {
                let lastSection = sections[sections.length - 1];

                let semicolonIndex = lastSection.value.lastIndexOf(";");
                if (semicolonIndex < 0) {
                    isParsingFailed = true;
                    break;
                }
                let key = lastSection.value.slice(semicolonIndex + 1);
                lastSection.value = lastSection.value.slice(0, semicolonIndex);

                sections.push({
                    key: key,
                    value: parts.shift()
                });
            }
            for (let s = 0; s < sections.length; ++s) {
                let key = requirementsKeyMap[sections[s].key.toLowerCase().replace(/[^a-z]+/g, "")];
                let value = sections[s].value;
                if (!key) {
                    console.warn("Unknown data \"" + sections[s].key + "\" while parsing requirements:", requirements);
                    isParsingFailed = true;
                    continue;
                }

                let result = parseHumanReadableList(value, "&&", /^([A-Z]{4})?[0-9]{4}$/);
                if (result.isFailed || logicTreeToString(result.list).match(/[\b(][0-9]{4}[\b)]/))
                    isParsingFailed = true;

                value = result.list;
                if (data[key] && !dataMergers[key]) {
                    console.warn("Data \"" + key + "\" already exists as \"" + logicTreeToString(data[key]) + "\" when \"" + logicTreeToString(value) + "\" was parsed from requirements:", requirements);
                    isParsingFailed = true;
                } else {
                    value = dataParsers[key] ? dataParsers[key](data, value) : value;
                    data[key] = data[key] ? dataMergers[key](data, data[key], value) : value;
                }
            }

            if (!isParsingFailed)
                delete data.isParsingRequirementsFailed;
            return requirements;
        },
        equivalentCourses: function (data, value) {
            return value.split(",").map(function (part) { return part.trim(); });
        },
        excludedCourses: function (data, value) {
            if (!value)
                return [];
            else if (value.operator === "&&")
                value = value.children.map(function (child) { return child.name; }).filter(function (child) { return child; });
            else if (value.type === "Identifier")
                value = [value.name];
            else if (typeof value === "string")
                value = value.split(",");
            else
                return [];
            return value.map(function (part) { return part.trim(); });
        }
    };
    const dataMergers = {
        excludedCourses: function (data, a, b) {
            let courses = {};
            for (let e = 0; e < a.length; ++e)
                courses[a[e]] = 1;
            for (let e = 0; e < b.length; ++e)
                courses[b[e]] = 1;
            return Object.keys(courses);
        }
    };

    let courses = {};
    for (let code in pages) {
        let document = libxml.parseHtmlString(pages[code]);
        courses[code] = {};

        let name = document.get("//title").text().split("-");
        if (name[0].trim() === "UNSW Handbook Course")
            name.shift();
        courses[code].code = name.length > 0 && name[name.length - 1].trim().match(/^[A-Z]{4}[0-9]{4}$/) ? name.pop().trim() : code;
        courses[code].name = name.join("-").trim();

        if (!courses[courses[code].code]) // For pages that aren't named the course they're describing
            courses[courses[code].code] = courses[code];

        let lines = document.find("//*[text() = 'Faculty:']/ancestor::*[count(. | //*[text() = 'School:']/ancestor::*) = count(//*[text() = 'School:']/ancestor::*)][1]/*").map(function (elem) { return elem.text().trim(); });
        let rawData = {};
        let data = {};
        let isRequirements = false;
        for (let l = 0; l < lines.length; ++l) {
            if (isRequirements) {
                rawData["Enrolment Requirements"] = lines[l];
                data.requirements = dataParsers.requirements(data, lines[l]);
                isRequirements = false;
                continue;
            }

            let parts = lines[l].split(":");
            let key = parts[0].trim();
            let mappedKey = dataKeyMap[key.toLowerCase().replace(/[^a-z]+/g, "")]
            let value = parts.slice(1).join(":").replace("(more info)", "").trim();

            if (key === "View course information for previous years.") {
                continue;
            } else if (mappedKey === "requirements") {
                isRequirements = true;
                continue;
            }

            if (!key || !value) {
                if (mappedKey !== "courseOutline" && mappedKey !== "feeBand") {
                    if (key || value)
                        console.warn(code, "is missing key or value:", key, value);
                    continue;
                }
            }

            rawData[key] = value;
            if (!mappedKey) {
                console.warn(code, "has unknown data: ", key);
            } else if (data[mappedKey] && !dataMergers[mappedKey]) {
                console.warn(code, "already has \"" + mappedKey + "\" as \"" + data[mappedKey] + "\" when \"" + value + "\" was read");
            } else {
                value = dataParsers[mappedKey] ? dataParsers[mappedKey](data, value) : value;
                data[mappedKey] = data[mappedKey] ? dataMergers[mappedKey](data, data[mappedKey], value) : value;
            }
        }
        courses[code].rawData = rawData;
        courses[code].data = data;

        let description = document.find("((//*[text() = 'Description']/ancestor-or-self::*/following-sibling::*[text()])[1]/preceding-sibling::*)[last()]/following-sibling::*[text()]");
        description = description.filter(function (part) {
            return part.text().trim();
        }).map(function (part) {
            return part.toString();
        }).join("");
        courses[code].description = description;
    }

    return courses;
}

if (process.argv.length === 3) {
    process.argv.push(process.argv[2] + "-raw.json");
    process.argv.push(process.argv[2] + ".json");
}
if (process.argv.length < 5) {
    console.warn("Usage: " + require("path").basename(process.argv[1]) + " <year> [<raw output file> <parsed output file>]");
    console.warn("If output files are omitted, they default to <year>-raw.json and <year>.json, respectively.");
    process.exit(1);
}

let fs = require("fs");
(new Promise(function (resolve, reject) {
    if (fs.existsSync(process.argv[3])) {
        try {
            resolve(JSON.parse(fs.readFileSync(process.argv[3])));
        } catch (e) {
            console.warn("Could not open as JSON:", process.argv[3]);
            console.warn("Not overwriting.");
            reject(e);
        }
        return;
    }

    resolve(downloadHandbook(process.argv[2]).tap(function (pages) {
        fs.writeFile(process.argv[3], JSON.stringify(pages));
    }))
})).then(function (pages) {
    fs.writeFile(process.argv[4], JSON.stringify(parseHandbook(pages)));
}).done();
