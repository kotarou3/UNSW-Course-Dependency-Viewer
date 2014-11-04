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

    let coursesUrl = "http://www.handbook.unsw.edu.au/vbook" + year + "/brCoursesByAtoZ.jsp?StudyLevel=Undergraduate&descr=All";
    return request(coursesUrl).spread(function (response, body) {
        return libxml.parseHtmlString(body).find("//table[@class = 'tabluatedInfo']//a/@href").map(function (courseLink) {
            return url.resolve(coursesUrl, courseLink.value());
        });
    }).reduce(function (pages, courseLink) {
        console.warn("Downloading", courseLink);
        return request(courseLink).spread(function (response, body) {
            pages[courseLink] = body;
            return pages;
        });
    }, {});
}

function parseHandbook(pages) {
    let path = require("path");
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
    function toKey(a) {
        return a.toLowerCase().replace(/[^a-z]+/g, "");
    }

    const dataParsers = {
        requirements: function (data, requirements) {
            let logicExpressionParser = require("./logic-expression-parser.js");

            if (!requirements.match(/[A-Z]{4}[0-9]{4}/i))
                return requirements;

            let parts = requirements.split(":").map(function (part) { return part.trim(); });
            if (parts.length < 2) {
                data.isParsingRequirementsFailed = true;
                return requirements;
            }

            let isParsingFailed = false;
            let sections = [{key: "", value: parts.shift().trim()}];
            while (parts.length) {
                let lastSection = sections[sections.length - 1];

                let key = "";
                let newLastSectionValue = lastSection.value;
                let semicolonIndex = lastSection.value.lastIndexOf(";");
                let spaceIndex = lastSection.value.lastIndexOf(" ");
                if (semicolonIndex >= 0) {
                    key = lastSection.value.slice(semicolonIndex + 1);
                    newLastSectionValue = lastSection.value.slice(0, semicolonIndex);
                } else if (!lastSection.key) {
                    key = lastSection.value;
                    newLastSectionValue = "";
                }
                if (spaceIndex >= 0) {
                    let possibleKey = lastSection.value.slice(spaceIndex + 1);
                    if (requirementsKeyMap[toKey(possibleKey)] && (key ? !requirementsKeyMap[toKey(key)] : true)) {
                        if (key)
                            console.warn("Replacing \"" + key + "\" with \"" + possibleKey + "\"");
                        key = possibleKey;
                        newLastSectionValue = lastSection.value.slice(0, spaceIndex);
                    }
                }

                if (newLastSectionValue)
                    lastSection.value = newLastSectionValue;
                else if (!lastSection.key)
                    sections.shift();

                if (!key) {
                    if (!lastSection.key) {
                        key = lastSection.value;
                        sections.shift();
                    } else {
                        isParsingFailed = true;
                        break;
                    }
                } else if (!lastSection.key) {
                    lastSection.key = lastSection.value;
                    lastSection.value = "";
                }

                sections.push({
                    key: key,
                    value: parts.shift().trim()
                });
            }
            for (let s = 0; s < sections.length; ++s) {
                let key = requirementsKeyMap[toKey(sections[s].key)];
                let value = sections[s].value;
                if (!key) {
                    console.warn("Unknown data \"" + sections[s].key + "\" while parsing requirements:", requirements);
                    isParsingFailed = true;
                    continue;
                }

                value = value.toUpperCase().replace(/\b([A-Z]{4})\s+([0-9]{4})\b/g, "$1$2");
                if (!value.match(/[A-Z]{4}[0-9]{4}/))
                    continue;

                let result = logicExpressionParser.parseHumanReadableList(value, "&&", /^[A-Z]{4}[0-9]{4}$/);
                if (result.isFailed)
                    isParsingFailed = true;

                value = result.list;
                if (data[key] && !dataMergers[key]) {
                    console.warn("Data \"" + key + "\" already exists as \"" + logicExpressionParser.logicTreeToString(data[key]) + "\" when \"" + logicExpressionParser.logicTreeToString(value) + "\" was parsed from requirements:", requirements);
                    isParsingFailed = true;
                } else {
                    value = dataParsers[key] ? dataParsers[key](data, value) : value;
                    data[key] = data[key] ? dataMergers[key](data, data[key], value) : value;
                }
            }

            if (isParsingFailed)
                data.isParsingRequirementsFailed = true;
            return requirements;
        },
        equivalentCourses: function (data, value) {
            return value.split(",").map(function (part) { return part.trim(); });
        },
        excludedCourses: function (data, value) {
            if (!value)
                return [];
            else if (value.operator)
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
    for (let uri in pages) {
        let code = path.basename(uri, ".html");
        let document = libxml.parseHtmlString(pages[uri]);
        courses[code] = {};

        let name = document.get("//title").text().split("-");
        if (name[0].trim() === "UNSW Handbook Course")
            name.shift();
        courses[code].uri = uri;
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
            let mappedKey = dataKeyMap[toKey(key)]
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
