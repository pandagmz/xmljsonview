import { errorPageBody, jsonToHTMLBody } from './jsonformatter';
import { safeStringEncodeNums } from './safe-encode-numbers';
import { installCollapseEventListeners } from './collapse';

/**
 * This script runs on every page. It communicates with the background script
 * to help decide whether to treat the contents of the page as JSON.
 */
chrome.runtime.sendMessage({}, (response: boolean) => {
  if (!response) {
    return;
  }

  var head: HTMLElement = document.getElementsByTagName("head")[0];
  var script = document.createElement("script");
  script.setAttribute("src", chrome.runtime.getURL("viewer.js"));
  head.appendChild(script);
  head.insertAdjacentHTML(
    "beforeend",
    `<link rel=\"stylesheet\" href="${chrome.runtime.getURL("viewer.css")}" />`);

  var content =  document.getElementsByClassName("collapsible-content");
  for (let i = 0; i < content.length; i++)
  {
    let currentContent = content[i] as HTMLElement;
    if (currentContent && currentContent.innerText.startsWith("<![CDATA[") && currentContent.innerText.endsWith("]]>"))
    {
      let outputDoc = '';
      try {
        var text = currentContent.innerText.replace(/\n*<!\[CDATA\[\n*/g, "").replace(/\n*]]>\n*/g, "");
        const jsonObj = JSON.parse(safeStringEncodeNums(text));
        outputDoc = jsonToHTMLBody(jsonObj);
      } catch (e) {
        outputDoc = errorPageBody(e, currentContent.innerText);
      }
    
      currentContent.innerHTML = outputDoc;
    } 
  }
  installCollapseEventListeners();
});
