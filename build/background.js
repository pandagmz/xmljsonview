(function () {
    'use strict';

    /**
     * The JSONFormatter helper module. This contains two major functions, jsonToHTML and errorPage,
     * each of which returns an HTML document.
     */
    /** Convert a whole JSON value / JSONP response into a formatted HTML document */
    function jsonToHTML(json, uri) {
        return toHTML(jsonToHTMLBody(json), uri);
    }
    /** Convert a whole JSON value / JSONP response into an HTML body, without title and scripts */
    function jsonToHTMLBody(json) {
        return `<div id="json">${valueToHTML(json, '<root>')}</div>`;
    }
    /** Produce an error document for when parsing fails. */
    function errorPage(error, data, uri) {
        return toHTML(errorPageBody(error, data), uri + ' - Error');
    }
    /** Produce an error content for when parsing fails. */
    function errorPageBody(error, data) {
        // Escape unicode nulls
        data = data.replace("\u0000", "\uFFFD");
        const errorInfo = massageError(error);
        let output = `<div id="error">${chrome.i18n.getMessage('errorParsing')}`;
        if (errorInfo.message) {
            output += `<div class="errormessage">${errorInfo.message}</div>`;
        }
        output += `</div><div id="json">${highlightError(data, errorInfo.line, errorInfo.column)}</div>`;
        return output;
    }
    /**
     * Encode a string to be used in HTML
     */
    function htmlEncode(t) {
        return (typeof t !== "undefined" && t !== null) ? t.toString()
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            : '';
    }
    /**
     * Completely escape a json string
     */
    function jsString(s) {
        // Slice off the surrounding quotes
        s = JSON.stringify(s).slice(1, -1);
        return htmlEncode(s);
    }
    /**
     * Is this a valid "bare" property name?
     */
    function isBareProp(prop) {
        return /^[A-Za-z_$][A-Za-z0-9_\-$]*$/.test(prop);
    }
    /**
     * Surround value with a span, including the given className
     */
    function decorateWithSpan(value, className) {
        return `<span class="${className}">${htmlEncode(value)}</span>`;
    }
    // Convert a basic JSON datatype (number, string, boolean, null, object, array) into an HTML fragment.
    function valueToHTML(value, path) {
        const valueType = typeof value;
        if (value === null) {
            return decorateWithSpan('null', 'null');
        }
        else if (Array.isArray(value)) {
            return arrayToHTML(value, path);
        }
        else if (valueType === 'object') {
            return objectToHTML(value, path);
        }
        else if (valueType === 'number') {
            return decorateWithSpan(value, 'num');
        }
        else if (valueType === 'string' &&
            value.charCodeAt(0) === 8203 &&
            !isNaN(value.slice(1))) {
            return decorateWithSpan(value.slice(1), 'num');
        }
        else if (valueType === 'string') {
            if (/^(http|https|file):\/\/[^\s]+$/i.test(value)) {
                return `<a href="${htmlEncode(value)}"><span class="q">&quot;</span>${jsString(value)}<span class="q">&quot;</span></a>`;
            }
            else {
                return `<span class="string">&quot;${jsString(value)}&quot;</span>`;
            }
        }
        else if (valueType === 'boolean') {
            return decorateWithSpan(value, 'bool');
        }
        return '';
    }
    // Convert an array into an HTML fragment
    function arrayToHTML(json, path) {
        if (json.length === 0) {
            return '[ ]';
        }
        let output = '';
        for (let i = 0; i < json.length; i++) {
            const subPath = `${path}[${i}]`;
            output += '<li>' + valueToHTML(json[i], subPath);
            if (i < json.length - 1) {
                output += ',';
            }
            output += '</li>';
        }
        return (json.length === 0 ? '' : '<span class="collapser"></span>') +
            `[<ul class="array collapsible">${output}</ul>]`;
    }
    // Convert a JSON object to an HTML fragment
    function objectToHTML(json, path) {
        let numProps = Object.keys(json).length;
        if (numProps === 0) {
            return '{ }';
        }
        let output = '';
        for (const prop in json) {
            let subPath = '';
            let escapedProp = JSON.stringify(prop).slice(1, -1);
            const bare = isBareProp(prop);
            if (bare) {
                subPath = `${path}.${escapedProp}`;
            }
            else {
                escapedProp = `"${escapedProp}"`;
            }
            output += `<li><span class="prop${(bare ? '' : ' quoted')}" title="${htmlEncode(subPath)}"><span class="q">&quot;</span>${jsString(prop)}<span class="q">&quot;</span></span>: ${valueToHTML(json[prop], subPath)}`;
            if (numProps > 1) {
                output += ',';
            }
            output += '</li>';
            numProps--;
        }
        return `<span class="collapser"></span>{<ul class="obj collapsible">${output}</ul>}`;
    }
    // Clean up a JSON parsing error message
    function massageError(error) {
        if (!error.message) {
            return error;
        }
        const message = error.message.replace(/^JSON.parse: /, '').replace(/of the JSON data/, '');
        const parts = /line (\d+) column (\d+)/.exec(message);
        if (!parts || parts.length !== 3) {
            return error;
        }
        return {
            message: htmlEncode(message),
            line: Number(parts[1]),
            column: Number(parts[2])
        };
    }
    function highlightError(data, lineNum, columnNum) {
        if (!lineNum || !columnNum) {
            return htmlEncode(data);
        }
        const lines = data.match(/^.*((\r\n|\n|\r)|$)/gm);
        let output = '';
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (i === lineNum - 1) {
                output += '<span class="errorline">';
                output += `${htmlEncode(line.substring(0, columnNum - 1))}<span class="errorcolumn">${htmlEncode(line[columnNum - 1])}</span>${htmlEncode(line.substring(columnNum))}`;
                output += '</span>';
            }
            else {
                output += htmlEncode(line);
            }
        }
        return output;
    }
    // Wrap the HTML fragment in a full document. Used by jsonToHTML and errorPage.
    function toHTML(content, title) {
        return `<!DOCTYPE html>
<html><head><title>${htmlEncode(title)}</title>
<meta charset="utf-8">
<link rel="stylesheet" type="text/css" href="${chrome.runtime.getURL("viewer.css")}">
<script type="text/javascript" src="${chrome.runtime.getURL("viewer.js")}"></script>
</head><body>
${content}
</body></html>`;
    }

    /*
      *  Takes a JSON string and replaces number values with strings with a leading \u200B.
      *  Prior to this, it doubles any pre-existing \u200B characters. This Unicode value is
      *  a zero-width space, so doubling it won't affect the HTML view.
      *
      *  This addresses JSONView issue 21 (https://github.com/bhollis/jsonview/issues/21),
      *  where numbers larger than Number.MAX_SAFE_INTEGER get rounded to the nearest value
      *  that can fit in the mantissa. Instead we will string encode those numbers, and rely
      *  on JSONFormatter to detect the leading zero-width space, check the remainder of the
      *  string with !isNaN() for number-ness, and render it with number styling, sans-quotes.
      */
    function safeStringEncodeNums(jsonString) {
        const viewString = jsonString.replace(/\u200B/g, "\u200B\u200B");
        // This has some memory of what its last state was
        let wasInQuotes = false;
        function isInsideQuotes(str) {
            let inQuotes = false;
            for (let i = 0; i < str.length; i++) {
                if (str[i] === '"') {
                    let escaped = false;
                    for (let lookback = i - 1; lookback >= 0; lookback--) {
                        if (str[lookback] === '\\') {
                            escaped = !escaped;
                        }
                        else {
                            break;
                        }
                    }
                    if (!escaped) {
                        inQuotes = !inQuotes;
                    }
                }
            }
            if (wasInQuotes) {
                inQuotes = !inQuotes;
            }
            wasInQuotes = inQuotes;
            return inQuotes;
        }
        let startIndex = 0;
        function replaceNumbers(match, index) {
            // Substring should be copy-on-write, and thus cheap
            const lookback = viewString.substring(startIndex, index);
            const insideQuotes = isInsideQuotes(lookback);
            startIndex = index + match.length;
            return insideQuotes ? match : `"\u200B${match}"`;
        }
        // JSON legal number matcher, Andrew Cheong, http://stackoverflow.com/questions/13340717
        const numberFinder = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
        return viewString.replace(numberFinder, replaceNumbers);
    }

    /**
     * This is the background script that runs independent of any document. It listens to main frame requests
     * and kicks in if the headers indicate JSON. If we have the filterResponseData API available, we will use
     * that to directly change the content of the response to HTML. Otherwise we interface with a content script
     * to reformat the page.
     */
    // Look for JSON if the content type is "application/json",
    // or "application/whatever+json" or "application/json; charset=utf-8"
    const jsonContentType = /^text\/([a-z]+\+)?xml($|;)/;
    // Keep track globally of URLs that contain JSON content.
    const jsonUrls = new Set();
    /** Use the filterResponseData API to transform a JSON document to HTML. */
    function transformResponseToJSON(details) {
        const filter = browser.webRequest.filterResponseData(details.requestId);
        const dec = new TextDecoder("utf-8");
        const enc = new TextEncoder();
        let content = "";
        filter.ondata = (event) => {
            content = content + dec.decode(event.data);
        };
        filter.onstop = (_event) => {
            let outputDoc = '';
            try {
                const jsonObj = JSON.parse(safeStringEncodeNums(content));
                outputDoc = jsonToHTML(jsonObj, details.url);
            }
            catch (e) {
                outputDoc = errorPage(e, content, details.url);
            }
            filter.write(enc.encode(outputDoc));
            filter.disconnect();
        };
    }
    function detectJSON(event) {
        if (!event.responseHeaders) {
            return;
        }
        for (const header of event.responseHeaders) {
            if (header.name.toLowerCase() === "content-type" && header.value && jsonContentType.test(header.value)) {
                if (typeof browser !== 'undefined' && 'filterResponseData' in browser.webRequest) {
                    header.value = "text/html";
                    transformResponseToJSON(event);
                }
                else {
                    jsonUrls.add(event.url);
                }
            }
        }
        return { responseHeaders: event.responseHeaders };
    }
    // Listen for onHeaderReceived for the target page.
    // Set "blocking" and "responseHeaders".
    chrome.webRequest.onHeadersReceived.addListener(detectJSON, { urls: ["<all_urls>"], types: ["main_frame"] }, ["blocking", "responseHeaders"]);
    chrome.runtime.onMessage.addListener((_message, sender, sendResponse) => {
        if (sender.url.startsWith("file://") && sender.url.endsWith(".json")) {
            sendResponse(true);
            return;
        }
        // If we support this API, we don't need to invoke the content script.
        if ('filterResponseData' in chrome.webRequest) {
            sendResponse(false);
            return;
        }
        sendResponse(jsonUrls.has(sender.url));
        jsonUrls.delete(sender.url);
    });

}());
