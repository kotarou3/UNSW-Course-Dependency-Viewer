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

var isBrowser = typeof window === "object";

function parseLogicExpression(expression) {
    var tree = (isBrowser ? jsep : require("jsep"))(expression);

    var stack = [tree];
    while (stack.length > 0) {
        var node = stack.pop();

        if (node.type === "Literal") {
            node.type = "Identifier";
            node.name = node.raw;
        } else if (node.type === "LogicalExpression") {
            node.children = [node.left, node.right];
            delete node.left;
            delete node.right;

            // Flatten any chains (e.g., (A && B) && C -> A && B && C)
            for (var c = 0; c < node.children.length; ++c)
                if (node.operator === node.children[c].operator) {
                    node.children.splice(c, 1, node.children[c].left, node.children[c].right);
                    --c;
                }

            Array.prototype.push.apply(stack, node.children);
        } else if (node.type !== "Identifier")
            throw new Error("Unexpected " + node.type);
    }

    return tree;
}

function logicTreeToString(tree) {
    if (!tree)
        return "";
    if (tree.type === "Identifier")
        return tree.name;

    tree = JSON.parse(JSON.stringify(tree));
    var stack = [tree];
    while (stack.length > 0) {
        var node = stack[stack.length - 1];

        var areChildrenReady = true;
        for (var c = 0; c < node.children.length; ++c)
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
    var isFailed = false;
    var parts = (" " + list + " ")
        .replace(/\sand\/or\s/ig, " or ")
        .replace(/\s&\s/g, " and ")
        .replace(/\s+/g, " ")
        .replace(/[.,]+/g, " ")
        .replace(/[\[{]/g, "(")
        .replace(/[\]}]/g, ")")
        .replace(/([()])/g, " $1 ")
        .replace(/ ([^ ]+)\s*\/\s*([^ ]+)/g, " ( $1 or $2 ) ")
        .split(" ");
    var parsedParts = [];
    var lastConditional = defaultConditional;
    for (var p = parts.length - 1; p >= 0; --p) {
        var part = parts[p].trim();
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

    var parsedList = parsedParts.join("");
    var parsedList2;
    while (true) {
        parsedList2 = parsedList.replace(/\(\)/g, "").replace(/(^|\()([&|]{2})+/g, "$1").replace(/([&|]{2})+($|\))/g, "$2").replace(/([&|]{2})([&|]{2})+/g, "$1");
        if (parsedList2 === parsedList)
            break;

        isFailed = true;
        parsedList = parsedList2;
    }

    try {
        return {
            list: parsedList ? exports.parseLogicExpression(parsedList) : null,
            isFailed: isFailed
        };
    } catch (e) {
        return {list: null, isFailed: true};
    }
}

if (!isBrowser) {
    exports.parseLogicExpression = parseLogicExpression;
    exports.logicTreeToString = logicTreeToString;
    exports.parseHumanReadableList = parseHumanReadableList;
}
