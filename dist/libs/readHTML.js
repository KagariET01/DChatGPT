var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { JSDOM } from "jsdom";
export const readHTML = (URL) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`Reading HTML from URL: ${URL}`);
    let regex_url = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
    if (!regex_url.test(URL)) {
        throw new Error("Invalid URL format.");
    }
    let original_content = yield fetch(URL).then(res => res.text());
    console.log(original_content);
    const { window } = new JSDOM(original_content);
    const DOMParser = window.DOMParser;
    let parsed_content = new DOMParser().parseFromString(original_content, "text/html");
    let Recursively_getText = (node) => {
        console.log(node.textContent);
        let res = [];
        let nwtext = "";
        for (let child of Array.from(node.childNodes)) {
            // console.log({
            // 	nodeType:child.nodeType,
            // 	tagName:(child.nodeType===1)?(child as HTMLElement).tagName:"N/A",
            // 	textContent:child.textContent
            // });
            // console.log("====================");
            // 檢查元素是否可見
            if (child.nodeType === 1) {
                let elem = child;
                let style = window.getComputedStyle(elem);
                if (style.display === "none" || style.visibility === "hidden") {
                    continue; // 跳過不可見元素
                }
            }
            // text
            if (child.nodeType === 3) {
                if (child.textContent.trim() === "")
                    continue;
                let nwtxt = (new String(child.textContent)).trim();
                nwtext += nwtxt;
            }
            else if (child.nodeType === 1 && child.tagName === "BR") {
                if (nwtext.length > 0)
                    nwtext += "\r\n";
            }
            else {
                // push current text
                if (nwtext) {
                    res.push([0, nwtext]);
                    nwtext = "";
                }
                // element
                let child_res = Recursively_getText(child);
                for (let i of child_res) {
                    i[0] = i[0] + 1;
                    res.push(i);
                }
            }
        }
        if (nwtext) {
            res.push([0, nwtext]);
            nwtext = "";
        }
        let max_indent = Number.MAX_SAFE_INTEGER;
        for (let i of res) {
            max_indent = Math.min(max_indent, i[0]);
        }
        for (let i of res) {
            i[0] -= max_indent;
        }
        return res;
    };
    let text_content_arr = Recursively_getText(parsed_content.documentElement);
    // console.log(text_content_arr);
    let final_text = "";
    for (let [indent, text] of text_content_arr) {
        final_text += (" ".repeat(indent * 2) + text + "\n");
    }
    return final_text;
});
//# sourceMappingURL=readHTML.js.map