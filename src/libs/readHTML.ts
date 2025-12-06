


import { TextChannel } from "discord.js";
import { JSDOM } from "jsdom";

export const readHTML=async(URL:string):Promise<string> =>{
	console.log(`Reading HTML from URL: ${URL}`);
	let regex_url=/^https?:\/\/[^\s/$.?#].[^\s]*$/i;
	if(!regex_url.test(URL)){
		throw new Error("Invalid URL format.");
	}
	let original_content=await fetch(URL).then(res=>res.text());
	console.log(original_content);
	const {window}=new JSDOM(original_content);
	const DOMParser=window.DOMParser;
	let parsed_content=new DOMParser().parseFromString(original_content,"text/html");
	let Recursively_getText=(node:ChildNode):(number|string)[][]=>{
		console.log(node.textContent);
		let res:(number|string)[][]=[];
		let nwtext="";
		
		for(let child of Array.from(node.childNodes)){
			// console.log({
			// 	nodeType:child.nodeType,
			// 	tagName:(child.nodeType===1)?(child as HTMLElement).tagName:"N/A",
			// 	textContent:child.textContent
			// });
			// console.log("====================");

			// 檢查元素是否可見
			if(child.nodeType===1){
				let elem=child as HTMLElement;
				let style=window.getComputedStyle(elem);
				if(style.display==="none" || style.visibility==="hidden"){
					continue; // 跳過不可見元素
				}
			}

			// text
			if(child.nodeType===3){
				if((child.textContent as string).trim()==="")continue;
				let nwtxt=(new String(child.textContent)).trim();
				nwtext+=nwtxt;
			}else if(child.nodeType===1 && (child as HTMLElement).tagName==="BR"){
				if(nwtext.length>0)
					nwtext+="\r\n";
			}else{
				// push current text
				if(nwtext){
					res.push([0,nwtext]);
					nwtext="";
				}
				// element
				let child_res=Recursively_getText(child);
				for(let i of child_res){
					i[0]=(i[0] as number)+1;
					res.push(i);
				}
			}
		}
		if(nwtext){
			res.push([0,nwtext]);
			nwtext="";
		}
		let max_indent=Number.MAX_SAFE_INTEGER;
		for(let i of res){
			max_indent=Math.min(max_indent,i[0] as number);
		}
		for(let i of res){(i[0] as number)-=max_indent;}
		return res;
	};
	
	let text_content_arr:(number|string)[][]=Recursively_getText(parsed_content.documentElement);
	// console.log(text_content_arr);
	let final_text="";
	for(let [indent,text] of text_content_arr){
		final_text+=(" ".repeat((indent as number)*2)+text+"\n");
	}

	return final_text;
}
