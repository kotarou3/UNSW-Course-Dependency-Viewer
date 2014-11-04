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

function downloadFile(uri, progressCallback) {
    return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();

        xhr.open("GET", uri, true);
        xhr.onprogress = function (e) {
            if (progressCallback)
                progressCallback(e.loaded, e.total);
        };
        xhr.onload = function () {
            resolve(this.responseText);
        };
        xhr.send();

        if (progressCallback)
            progressCallback(0, 0);
    });
}

var requirementsCorrectionsCache;
var handbookCache = {};
function getHandbook(year, progressCallback) {
    var requirementsCorrections;
    if (requirementsCorrectionsCache)
        requirementsCorrections = Promise.resolve(requirementsCorrectionsCache)
    else
        requirementsCorrections = downloadFile("data/requirements-corrections.json", progressCallback).tap(function (requirementsCorrections) {
            requirementsCorrectionsCache = requirementsCorrections;
        });

    return requirementsCorrections.then(function () {
        var handbook;
        if (handbookCache[year])
            handbook = Promise.resolve(handbookCache[year]);
        else
            handbook = downloadFile("data/" + year + ".json", progressCallback).tap(function (courses) {
                handbookCache[year] = courses;
            });

        return handbook;
    }).then(function (courses) {
        courses = JSON.parse(courses);
        var requirementsCorrections = JSON.parse(requirementsCorrectionsCache);
        var localRequirementsCorrections = JSON.parse(localStorage.getItem("requirementsCorrections")) || {};

        for (var c in courses) {
            courses[c].id = c;
            courses[c].type = "course";

            var corrections = courses[c].data ? localRequirementsCorrections[courses[c].data.requirements] || requirementsCorrections[courses[c].data.requirements] : null;
            if (corrections) {
                for (var key in corrections)
                    courses[c].data[key] = corrections[key];
                delete courses[c].data.isParsingRequirementsFailed;
            }
        }
        return courses;
    });
}
function addRequirementsCorrection(requirements, prerequisiteCourses, corequisiteCourses) {
    var requirementsCorrections = JSON.parse(localStorage.getItem("requirementsCorrections")) || {};
    requirementsCorrections[requirements] = {
        prerequisiteCourses: prerequisiteCourses,
        corequisiteCourses: corequisiteCourses
    };
    localStorage.setItem("requirementsCorrections", JSON.stringify(requirementsCorrections));

    // Notify server
    var data = {
        requirements: requirements,
        prerequisiteCourses: logicTreeToString(prerequisiteCourses),
        corequisiteCourses: logicTreeToString(corequisiteCourses)
    };
    var xhr = new XMLHttpRequest();
    xhr.open("HEAD", "data/?" + encodeURIComponent(JSON.stringify(data)), true);
    xhr.send();
}

function findNodesAndEdges(handbook, courses, options) {
    var rootCourses = (courses.root || []).reduce(function (rootCourses, code) {
        rootCourses[code] = 1;
        return rootCourses;
    }, {});
    var chosenCourses = (courses.chosen || []).reduce(function (chosenCourses, code) {
        chosenCourses[code] = 1;
        return chosenCourses;
    }, {});
    var completedCourses = (courses.completed || []).reduce(function (completedCourses, code) {
        completedCourses[code] = 1;
        return completedCourses;
    }, {});

    options = options || {};

    var addedCourses = {};
    var fakeCourses = {};
    var nodes = [];
    var edges = [];

    function addEdge(source, target, type) {
        var course = handbook[target] || fakeCourses[target];
        if (!course) {
            if (options.hideUnknownCourses)
                return;

            course = {id: target, type: "course", code: target};
            fakeCourses[target] = course;
            nodes.push(course);
        }

        if (handbook[target])
            coursesToAdd.push(target);

        edges.push({id: type + "-" + source.id + "-" + course.id, source: source, target: course, type: type});
    }
    function simplifyOperatorChildren(children, operator, type, cache) {
        if (!cache)
            cache = {};

        var id = "(" + type + "-" + children.join(operator) + ")";
        if (fakeCourses[id])
            return [id];
        if (cache[id])
            return cache[id];

        if (children.length > 20)
            // No more than 2^20 iterations
            return children;

        var results = [children];
        for (var c = 0; c < children.length; ++c) {
            var newChildren = children.slice(0);
            newChildren.splice(c, 1);
            results.push(simplifyOperatorChildren(newChildren, operator, type, cache).concat([children[c]]));
        }

        return cache[id] = results.sort(function (a, b) { return a.length - b.length; })[0];
    }

    var coursesToAdd = Object.keys(rootCourses);
    for (var a = 0; a < coursesToAdd.length; ++a) {
        var code = coursesToAdd[a];

        if (addedCourses[code])
            continue;
        addedCourses[code] = 1;

        var course = handbook[code];
        if (!course) {
            course = {id: code, type: "course", code: code};
            fakeCourses[code] = course;
        }

        nodes.push(course);

        if (!course.data || completedCourses[code])
            continue;

        if (course.data.equivalentCourses && !options.hideEquivalentCourses)
            course.data.equivalentCourses.forEach(function (codeB) { addEdge(course, codeB, "equivalent"); });
        if (course.data.excludedCourses && !options.hideExcludedCourses)
            course.data.excludedCourses.forEach(function (codeB) { addEdge(course, codeB, "excluded"); });

        if (!course.data.isParsingRequirementsFailed) {
            var stack = [];

            var prerequisiteCourses = options.hidePrerequisiteCourses ? null : course.data.prerequisiteCourses;
            var corequisiteCourses = options.hideCorequisiteCourses ? null : course.data.corequisiteCourses;
            if (prerequisiteCourses && prerequisiteCourses.type !== "Identifier") {
                prerequisiteCourses = JSON.parse(JSON.stringify(prerequisiteCourses));
                stack.push({node: prerequisiteCourses, type: "prerequisite"});
            }
            if (corequisiteCourses && corequisiteCourses.type !== "Identifier") {
                corequisiteCourses = JSON.parse(JSON.stringify(corequisiteCourses));
                stack.push({node: corequisiteCourses, type: "corequisite"});
            }

            while (stack.length > 0) {
                var frame = stack[stack.length - 1];
                var node = frame.node;
                var type = frame.type;

                var areChildrenReady = true;
                for (var c = 0; c < node.children.length; ++c)
                    if (node.children[c].type !== "Identifier") {
                        areChildrenReady = false;
                        stack.push({node: node.children[c], type: type});
                    }
                if (!areChildrenReady)
                    continue;
                stack.pop();

                var trueChildren = [];
                for (var c = 0; c < node.children.length; ++c)
                    if (node.children[c].isTrue || chosenCourses[node.children[c].name] || completedCourses[node.children[c].name])
                        trueChildren.push(node.children[c]);
                if (node.operator === "||" && trueChildren.length > 0) {
                    node.isTrue = true;
                    node.children = [trueChildren[0]];
                } else if (node.operator === "&&" && trueChildren.length === node.children.length) {
                    node.isTrue = true;
                }

                var children = node.children.map(function (child) { return child.name; }).sort();
                if (options.hideUnknownCourses)
                    children = children.filter(function (child) { return handbook[child] || fakeCourses[child]; });

                var simplifiedChildren = simplifyOperatorChildren(children, node.operator, type);

                var operatorNodeId = "(" + type + "-" + children.join(node.operator) + ")";
                if (simplifiedChildren.length !== 1) {
                    var operatorNode = {id: operatorNodeId, type: node.operator, edgeType: type};
                    fakeCourses[operatorNodeId] = operatorNode;
                    nodes.push(operatorNode);

                    for (var c = 0; c < simplifiedChildren.length; ++c)
                        addEdge(operatorNode, simplifiedChildren[c], type);
                }

                node.type = "Identifier";
                node.name = children.length === 1 ? children[0] : operatorNodeId;
            }
            if (prerequisiteCourses)
                addEdge(course, prerequisiteCourses.name, "prerequisite");
            if (corequisiteCourses)
                addEdge(course, corequisiteCourses.name, "corequisite");
        }
    }

    // Prune orphaned nodes
    var edgesBySource = {};
    var parentCount = {};
    for (var e = 0; e < edges.length; ++e) {
        var source = edges[e].source.id;
        var target = edges[e].target.id;

        if (!edgesBySource[source])
            edgesBySource[source] = [];
        edgesBySource[source].push(edges[e]);

        if (!parentCount[target])
            parentCount[target] = 0;
        ++parentCount[target];
    }

    var nodesToCheck = nodes.slice(0);
    var nodesToRemove = {};
    var edgesToRemove = {};
    while (nodesToCheck.length > 0) {
        var node = nodesToCheck.pop();
        if (rootCourses[node.code] || parentCount[node.id])
            continue;

        nodesToRemove[node.id] = 1;
        var edgesFromNode = edgesBySource[node.id] || [];
        for (var e = 0; e < edgesFromNode.length; ++e) {
            edgesToRemove[edgesFromNode[e].id] = 1;
            if (!--parentCount[edgesFromNode[e].target.id])
                nodesToCheck.push(edgesFromNode[e].target);
        }
    }

    var oldNodes = nodes;
    var oldEdges = edges;
    nodes = [];
    edges = [];
    for (var n = 0; n < oldNodes.length; ++n)
        if (!nodesToRemove[oldNodes[n].id])
            nodes.push(oldNodes[n]);
    for (var e = 0; e < oldEdges.length; ++e)
        if (!edgesToRemove[oldEdges[e].id])
            edges.push(oldEdges[e]);

    return {nodes: nodes, edges: edges, addedCourses: Object.keys(addedCourses)};
}

function operatorToText(operator) {
    return {"&&": "and", "||": "or"}[operator] || operator;
}

function convertToDot(nodes, edges) {
    // graphviz doesn't support modifying the class of the outputted SVG elements so IDs are
    // used to pass that information instead which can be parsed after generating the SVG

    function createAttributesString(attributes) {
        var result = [];
        for (var a in attributes)
            result.push(a + "=" + JSON.stringify(attributes[a]));
        return "[" + result.join(" ") + "]";
    }

    var lines = [];
    lines.push("digraph {");
    lines.push("bgcolor=\"transparent\"");

    for (var n = 0; n < nodes.length; ++n) {
        var node = nodes[n];

        var attributes = {};
        attributes.id = JSON.stringify({id: node.id, type: node.type, edgeType: node.edgeType});

        if (node.type === "course") {
            attributes.label = node.code + "\n" + (node.name || "???");
            attributes.shape = "rect";
        } else {
            attributes.label = operatorToText(node.type);
            attributes.shape = "circle";
            attributes.width = 0.5;
            attributes.fixedsize = true;
        }

        lines.push(JSON.stringify(node.id) + " " + createAttributesString(attributes));
    }

    for (var e = 0; e < edges.length; ++e) {
        var edge = edges[e];

        var attributes = {id: JSON.stringify({type: edge.type, source: edge.source.id, target: edge.target.id})};
        lines.push(JSON.stringify(edge.source.id) + " -> " + JSON.stringify(edge.target.id) + " " + createAttributesString(attributes));
    }

    lines.push("}");
    return lines.join("\n");
}

function generateGraph(handbook, courses, options) {
    var graphData = findNodesAndEdges(handbook, courses, options);
    var graph = Viz(convertToDot(graphData.nodes, graphData.edges), "svg", "dot");

    var $svg = $(new DOMParser().parseFromString(graph, "image/svg+xml").children[0]);

    // Set dimensions to parent element
    $svg.attr("width", "100%");
    $svg.attr("height", "100%");

    // Delete node and edge attributes so a stylesheet can be used
    $svg.find("polygon, ellipse, path").attr({stroke: null, fill: null});
    $svg.find("text").attr({"font-family": null, "font-size": null});

    // Remove tooltips
    $svg.find("title").remove();

    // Parse IDs to proper IDs and classes, and assign data
    var nodes = {};
    for (var n = 0; n < graphData.nodes.length; ++n)
        nodes[graphData.nodes[n].id] = graphData.nodes[n];
    $svg.find("g.node").each(function () {
        var data = JSON.parse(this.id);

        this.id = JSON.stringify(data.id);
        if (data.type === "course")
            this.classList.add("course");
        else
            this.classList.add("operator", "operator-" + operatorToText(data.type));

        if (data.edgeType)
            this.classList.add(data.edgeType);
        else if (nodes[data.id].data && nodes[data.id].data.isParsingRequirementsFailed)
            this.classList.add("incomplete");

        d3.select(this).datum(nodes[data.id]);
    });
    $svg.find("g.edge").each(function () {
        var data = JSON.parse(this.id);

        this.id = JSON.stringify(data.source) + ":" + JSON.stringify(data.target);
        this.classList.add(data.type);

        d3.select(this).datum(data);
    });

    return {$svg: $svg, addedCourses: graphData.addedCourses};
}

function centreAt(x, y) {};
function setupZooming($viewport) {
    var $svg = $viewport.children();
    var $group = $(document.createElementNS("http://www.w3.org/2000/svg", "g"));
    $group.append($svg.children());
    $svg.append($group);

    var currentTranslate = {x: 0, y: 0};
    var currentScale = 1;
    var zoom = d3.behavior.zoom().on("zoom", function () {
        currentTranslate.x = d3.event.translate[0];
        currentTranslate.y = d3.event.translate[1];
        currentScale = d3.event.scale;
        $group.attr("transform", "translate(" + d3.event.translate + ") scale(" + d3.event.scale + ")");
    });
    d3.select($svg[0]).call(zoom);

    centreAt = function(x, y) {
        var scale = Math.min($svg.width() / $svg[0].viewBox.baseVal.width, $svg.height() / $svg[0].viewBox.baseVal.height);
        x = currentTranslate.x - (x - $svg.width() / 2) / scale;
        y = currentTranslate.y - (y - $svg.height() / 2) / scale;
        zoom.translate([x, y]);
        d3.select($group[0]).transition().duration(1000).attr("transform", "translate(" + x + ", " + y + ") scale(" + currentScale + ")").each("end", function () {
            zoom.event(d3.select($svg[0]));
        });
    }
}

function setupSelecting($svg, callback) {
    var svg = d3.select($svg[0]);
    var nodes = svg.selectAll(".node");
    var edges = svg.selectAll(".edge");

    var edgesBySource = {};
    edges.each(function (edge) {
        if (!edgesBySource[edge.source])
            edgesBySource[edge.source] = [];
        edgesBySource[edge.source].push(this);
    });
    for (var source in edgesBySource)
        edgesBySource[source] = d3.selectAll(edgesBySource[source]);

    function highlightChain(nodeElem, node, className, isOn) {
        nodeElem.classList[isOn ? "add" : "remove"](className);
        if (node && edgesBySource[node.id]) {
            edgesBySource[node.id].classed(className, isOn);
            edgesBySource[node.id].each(function (edge) {
                var targetElem = $svg[0].getElementById(JSON.stringify(edge.target));
                var target = d3.select(targetElem).datum();
                if (target && target.type !== "course")
                    highlightChain(targetElem, target, className, isOn);
                else
                    targetElem.classList[isOn ? "add" : "remove"](className);
            });
        }
    }

    var currentSelection = {};
    function selectNode(nodeElem, node) {
        if (currentSelection.node)
            highlightChain(currentSelection.elem, currentSelection.node, "selected", false);

        if (node === currentSelection.node) {
            currentSelection.node = null;
            callback();
            return;
        }

        highlightChain(nodeElem, node, "selected", true);

        currentSelection.elem = nodeElem;
        currentSelection.node = node;
        callback.call(nodeElem, node);
    }

    nodes.on("mouseover", function (node) {
        highlightChain(this, node, "highlighted", true);
    });
    nodes.on("mouseout", function (node) {
        highlightChain(this, node, "highlighted", false);
    });
    nodes.on("click", function (node) {
        selectNode(this, node);
    });
    edges.on("mouseover", function (edge) {
        this.classList.add("highlighted");
        $svg[0].getElementById(JSON.stringify(edge.source)).classList.add("highlighted");

        var targetElem = $svg[0].getElementById(JSON.stringify(edge.target))
        var target = d3.select(targetElem).datum();
        if (target && target.type !== "course")
            highlightChain(targetElem, target, "highlighted", true);
    });
    edges.on("mouseout", function (edge) {
        this.classList.remove("highlighted");
        $svg[0].getElementById(JSON.stringify(edge.source)).classList.remove("highlighted");

        var targetElem = $svg[0].getElementById(JSON.stringify(edge.target))
        var target = d3.select(targetElem).datum();
        if (target && target.type !== "course")
            highlightChain(targetElem, target, "highlighted", false);
    });
    edges.on("click", function (edge) {
        var sourceElem = $svg[0].getElementById(JSON.stringify(edge.source));
        selectNode(sourceElem, d3.select(sourceElem).datum());
    });

    svg.on("click", function () {
        if (d3.event.eventPhase === Event.AT_TARGET)
            // Cancel selection
            selectNode(currentSelection.elem, currentSelection.node);
    });
}

function setupSearching(courses) {
    setupSearching.courses = courses.reduce(function (courses, course) {
        if (course)
            courses[course.code] = course;
        return courses;
    }, {});

    if (setupSearching.searchFunction) {
        setupSearching.searchFunction();
        return;
    }

    var $searchBox = $("#search-query input");
    setupSearching.searchFunction = function () {
        var courses = setupSearching.courses;
        var query = $searchBox.val().toUpperCase();
        if (courses[query]) {
            var result = courses[query];

            var e = document.createEvent("UIEvents");
            e.initUIEvent("click", true, true, window, 1);
            document.getElementById(JSON.stringify(result.id)).dispatchEvent(e);
        }
    };

    $("#search-query input").on("input", setupSearching.searchFunction);
    setupSearching.searchFunction();
}

function setupSettings() {
    $("#settings").on("click", function () {
        var settings = JSON.parse(localStorage.getItem("settings")) || {};

        $("#settings-root-courses").val((settings.rootCourses || []).join(" "));
        $("#settings-chosen-courses").val((settings.chosenCourses || []).join(" "));
        $("#settings-completed-courses").val((settings.completedCourses || []).join(" "));
        if (settings.handbookYear)
            $("#settings-handbook-year").val(settings.handbookYear);

        var options = settings.options;
        if (options) {
            $("#settings-hide-unknown-courses").prop("checked", !!options.hideUnknownCourses);
            $("#settings-hide-prerequisite-courses").prop("checked", !!options.hidePrerequisiteCourses);
            $("#settings-hide-corequisite-courses").prop("checked", !!options.hideCorequisiteCourses);
            $("#settings-hide-equivalent-courses").prop("checked", !!options.hideEquivalentCourses);
            $("#settings-hide-excluded-courses").prop("checked", !!options.hideExcludedCourses);
        }
    });

    function saveSettings() {
        var settings = {};

        settings.rootCourses = $("#settings-root-courses").val().toUpperCase().split(/[ ,]+/);
        settings.chosenCourses = $("#settings-chosen-courses").val().toUpperCase().split(/[ ,]+/);
        settings.completedCourses = $("#settings-completed-courses").val().toUpperCase().split(/[ ,]+/);
        settings.handbookYear = $("#settings-handbook-year").val();

        settings.options = {
            hideUnknownCourses: !!$("#settings-hide-unknown-courses").prop("checked"),
            hidePrerequisiteCourses: !!$("#settings-hide-prerequisite-courses").prop("checked"),
            hideCorequisiteCourses: !!$("#settings-hide-corequisite-courses").prop("checked"),
            hideEquivalentCourses: !!$("#settings-hide-equivalent-courses").prop("checked"),
            hideExcludedCourses: !!$("#settings-hide-excluded-courses").prop("checked")
        };

        localStorage.setItem("settings", JSON.stringify(settings));
        redrawGraph().then(function () {
            $("#settings-modal").modal("hide");
            $("#save-settings").one("click", saveSettings);
        }).done();
    }

    $("#save-settings").one("click", saveSettings);
}

function showCourseToolbox(course) {
    var dataKeyMap = { // const
        code: "Code",
        name: "Name",
        description: "Description",
        faculty: "Faculty",
        school: "School",
        courseOutline: "Course Outline",
        campus: "Campus",
        career: "Career",
        unitsOfCredit: "Units of Credit",
        eftsl: "EFTSL",
        hoursPerWeek: "Hours per Week",
        requirements: "Requirements",
        isParsingRequirementsFailed: "(Auto-Parsing Failed)",
        prerequisiteCourses: "Prerequisite Courses",
        corequisiteCourses: "Corequisite Courses",
        excludedCourses: "Excluded Courses",
        equivalentCourses: "Equivalent Courses",
        feeBand: "Fee Band",
        fee: "Tuition Fee",
        furtherInformation: "Further Information",
        contact: "Contact",
        sessions: "Sessions Offered",
        isGeneralEducation: "General Education"
    };
    var displayOrder = [ // const
        "code", "name",
        "faculty", "school", "campus", "career", "courseOutline",
        "unitsOfCredit", "eftsl", "hoursPerWeek",
        "requirements", "isParsingRequirementsFailed", "prerequisiteCourses", "corequisiteCourses", "excludedCourses", "equivalentCourses",
        "feeBand", "fee",
        "furtherInformation", "contact", "sessions",
        "isGeneralEducation"
    ];

    if (!course || !course.data) {
        $("#search-query input").val("");
        $("#search-result").slideUp(function () {
            $("#search").removeClass("active");
        });
        return;
    }

    var $data = $("#data");
    $data.empty();

    for (var d = 0; d < displayOrder.length; ++d) {
        var key = displayOrder[d];
        var data = course.data[key] || course[key];
        if (!data && key !== "name")
            continue;

        if (Array.isArray(data))
            data = data.join(", ");
        else if (typeof data === "object")
            data = logicTreeToString(data);
        else if (!data)
            data = "???";

        var $row = $("<tr>");
        var $heading = $("<th>");
        var $contents = $("<td>");

        $heading.text(dataKeyMap[key]);
        $contents.text(data);

        $row.append($heading).append($contents);
        $data.append($row);
    }

    $("#edit-requirements").off("click").on("click", function () {
        var data = course.data || {};
        $("#requirements").text(data.requirements);
        $("#prerequisite-courses").val(logicTreeToString(data.prerequisiteCourses));
        $("#corequisite-courses").val(logicTreeToString(data.corequisiteCourses));

        $("#requirements-error").text("").hide().removeClass("in");
        function saveRequirements() {
            var prerequisiteCourses = $("#prerequisite-courses").val().toUpperCase();
            var corequisiteCourses = $("#corequisite-courses").val().toUpperCase();
            try {
                if (prerequisiteCourses)
                    prerequisiteCourses = parseLogicExpression(prerequisiteCourses);
                if (corequisiteCourses)
                    corequisiteCourses = parseLogicExpression(corequisiteCourses);
            } catch (e) {
                $("#requirements-error").text(e.message).show().addClass("in");
                $("#save-requirements").one("click", saveRequirements);
                return;
            }

            addRequirementsCorrection(data.requirements, prerequisiteCourses, corequisiteCourses);
            redrawGraph().then(function () {
                $("#centre-on-graph").click();
                $("#edit-requirements-modal").modal("hide");
            }).done();
        }

        $("#save-requirements").off("click").one("click", saveRequirements);
    });

    $("#toggle-choice").off("click").on("click", function () {
        var settings = JSON.parse(localStorage.getItem("settings")) || {};
        var chosenCourses = settings.chosenCourses;
        if (!chosenCourses)
            chosenCourses = settings.chosenCourses = [];

        var codeIndex = chosenCourses.indexOf(course.code);
        if (codeIndex >= 0)
            chosenCourses.splice(codeIndex, 1);
        else
            chosenCourses.push(course.code);

        localStorage.setItem("settings", JSON.stringify(settings));
        redrawGraph().then(function () {
            $("#centre-on-graph").click();
        }).done();
    });

    $("#toggle-completion").off("click").on("click", function () {
        var settings = JSON.parse(localStorage.getItem("settings")) || {};
        var completedCourses = settings.completedCourses;
        if (!completedCourses)
            completedCourses = settings.completedCourses = [];

        var codeIndex = completedCourses.indexOf(course.code);
        if (codeIndex >= 0)
            completedCourses.splice(codeIndex, 1);
        else
            completedCourses.push(course.code);

        localStorage.setItem("settings", JSON.stringify(settings));
        redrawGraph().then(function () {
            $("#centre-on-graph").click();
        }).done();
    });

    $("#centre-on-graph").off("click").on("click", function () {
        var boundingBox = document.getElementById(JSON.stringify(course.id)).getBoundingClientRect();
        var x = (boundingBox.left + boundingBox.right) / 2;
        var y = (boundingBox.top + boundingBox.bottom) / 2;
        centreAt(x, y);
    });

    $("#search-query input").val(course.code);
    $("#search").addClass("active");
    $("#search-result").slideDown();
}

function redrawGraph(handbookYear, courses, options) {
    if (arguments.length === 0) {
        var settings = JSON.parse(localStorage.getItem("settings"));
        if (!settings)
            return Promise.reject("Nothing to draw.");

        handbookYear = settings.handbookYear;
        courses = {
            root: settings.rootCourses || [],
            chosen: settings.chosenCourses || [],
            completed: settings.completedCourses || []
        };
        options = settings.options || {};
    }

    var $progressTitle = $("#progress-modal .modal-title");
    var $progressBar = $("#progress-modal .progress-bar");

    return Promise.all([
        getHandbook(handbookYear, function (loaded, total) {
            loaded /= 1000;
            total /= 1000;

            if (!loaded && !total)
                $progressTitle.text("Downloading Handbook");
            else
                $progressTitle.text("Downloading Handbook (" + Math.round(loaded) + " KB " + (total ? "of " + Math.round(total) + " KB" : "received") + ")");

            if (total) {
                $progressBar.removeClass("progress-bar-striped active");
                $progressBar.css("width", (loaded / total * 100) + "%");
            } else {
                $progressBar.addClass("progress-bar-striped active");
                $progressBar.css("width", "100%");
            }
        }),
        new Promise(function (resolve, reject) {
            $("#progress-modal").modal("show").on("shown.bs.modal", resolve);
        })
    ]).tap(function () {
        $progressTitle.text("Building Graph");
        $progressBar.addClass("progress-bar-striped active");
        $progressBar.css("width", "100%");
    }).delay(200).spread(function (handbook) {
        var graph = generateGraph(handbook, courses, options);
        var $svg = graph.$svg;
        var addedCourses = graph.addedCourses.map(function (code) { return handbook[code]; });

        for (var type in courses) {
            for (var c = 0; c < courses[type].length; ++c) {
                var code = courses[type][c];
                var node = $svg[0].getElementById(JSON.stringify((handbook[code] || {id: code}).id));
                if (node)
                    node.classList.add(type);
            }
        }

        var $viewport = $("#output");
        $viewport.empty().append($svg);

        setupZooming($viewport);
        setupSelecting($svg, showCourseToolbox);
        setupSearching(addedCourses);

        $("#progress-modal").modal("hide");

        return $svg;
    });
}

$(document).ready(function () {
    setupSettings();

    if (!localStorage.getItem("settings"))
        $("#settings-modal").modal("show");
    else
        redrawGraph().done();
});
