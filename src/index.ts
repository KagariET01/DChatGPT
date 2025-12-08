
import OpenAI from "openai";
import * as DC from "discord.js"
import fs from "fs";
import Stream from "stream";
import {AsyncResource} from "async_hooks";
import {randomInt} from "crypto";
import {readHTML} from "./libs/readHTML.js";



const SECRET:any=JSON.parse(fs.readFileSync("../secret.json","utf-8").toString());
const CONFIG:any=JSON.parse(fs.readFileSync("../config.json","utf-8").toString());
const DB:any=JSON.parse(fs.readFileSync("../db.json","utf-8").toString());

const DCbot:DC.Client&{
	logchannel?:DC.TextChannel,
	commands?:{command:DC.SlashCommandBuilder,func:(interaction:DC.Interaction)=>void}[],
	commands_ID?:{[key:string]:(interaction:DC.Interaction)=>void},
	console?:{
		debug:(...data:any)=>Promise<void>|void,
		log:(...data:any)=>Promise<void>|void,
		warn:(...data:any)=>Promise<void>|void,
		error:(...data:any)=>Promise<void>|void
	}
}&{[key:string]:any}=new DC.Client({
	intents:[
		DC.GatewayIntentBits.Guilds,
		DC.GatewayIntentBits.GuildMessages,
		DC.GatewayIntentBits.MessageContent,
		DC.GatewayIntentBits.GuildMembers,
		DC.GatewayIntentBits.GuildMessageReactions
	]
});

DCbot.commands=[];

const replyer=async(
	interaction:DC.ChatInputCommandInteraction,
	options:
		string|
		DC.MessagePayload|
		DC.InteractionEditReplyOptions,
	other_options?:{[key:string]:any}
)=>{
	DCbot.console?.debug("replyer called with options:",options);
	if(!(interaction.replied||interaction.deferred)){
		await interaction.deferReply();
	}
	if(options instanceof DC.MessagePayload){
		interaction.editReply(options);
		return;
	}
	let content:string=(options as string) || (options as DC.InteractionEditReplyOptions).content || "";
	let content_list:string[]=[];
	while(content.length>0){
		content_list.push(content.slice(0,(CONFIG.max_len||1500)));
		content=content.slice((CONFIG.max_len||1500));
	}
	for(let i=0;i<content_list.length;i++){
		if(i===0){
			if(typeof(options)==="object"){
				let nwoptions:DC.InteractionEditReplyOptions
					=Object.assign({},options);
				nwoptions.content=content_list[i];
				await interaction.editReply(nwoptions);
			}else{
				await interaction.editReply({content:content_list[i]});
			}
		}else{
			if(!other_options)other_options={};
			if(!other_options.followup_list){
				other_options.followup_list=[];
			}
			let nwoptions:DC.InteractionReplyOptions={};
			if(typeof(options)==="object"){
				for(let j in options){
					if(j==="content")nwoptions.content=content_list[i];
					else if(j==="embeds"||(j==="components")||(j==="files")){
						(nwoptions as any)[j]=[];
					}else{
						(nwoptions as any)[j]=Object.assign({},(options as any)[j]);
					}
				}
			}else{
				nwoptions.content=content_list[i];
			}
			if(other_options.followup_list.length<i){
				other_options.followup_list.push(await interaction.followUp(nwoptions));
			}else{
				await other_options.followup_list[i-1].edit(nwoptions);
			}
		}
	}
	return other_options;
}

const callAI=async(
	userID:string,
	question:string,
	replyfunction:(response:string)=>void,
	editfunction:(response:string)=>void,
	errorfunction?:(error:string)=>void
)=>{
	let user_token:string|undefined=DB[userID]?.openai_token;
	// console.debug({
	// 	user_token:DB[userID]?.openai_token,
	// 	secret_token:SECRET?.llm_apikey
	// });
	if(!user_token)user_token=SECRET?.llm_apikey;
	if(!user_token){
		errorfunction?.("You have not set your OpenAI token yet. Please set it first.");
	}else{
		let openai=new OpenAI({
			apiKey:user_token
		});
		let chatgpt=await openai.responses.create({
			model:CONFIG.model||"gpt-5-nano",
			input:question,
			stream:true
		});
		console.log({chatgpt});
		let nwstr="";
		replyfunction("Question received. Communicating with AI...");
		console.log("User question:",question);
		let stop_edit_reply:Function=()=>{};
		(async()=>{
			let flag=true;
			stop_edit_reply=()=>{flag=false;}
			while(flag){
				await new Promise(r=>setTimeout(r,CONFIG.update_timewait||2500));
				if(nwstr)
					editfunction(nwstr+"[AI is thinking]");
				else
					editfunction("[AI is thinking]");
			}
		})()
		try{
			for await(const chunk of chatgpt){
				console.log({nwstr,chunk});
				if("delta" in chunk && typeof(chunk.delta)==="string"){
					nwstr+=chunk.delta;
					console.log({
						receive_chunk:chunk.delta,
						current_response:nwstr
					});
				}
			}
			stop_edit_reply();
			await new Promise(r=>setTimeout(r,CONFIG.update_timewait||2500));
			if(!nwstr)nwstr="[AI didn't respond]";
			editfunction(nwstr);
		}catch(e){
			errorfunction?.("An error occurred while communicating with AI.");
		}
	}
};

DCbot.commands.push((()=>{ // Test long reply command
	const command=new DC.SlashCommandBuilder();
	command.setName("testlongreply");
	command.setDescription("Test long reply");
	command.setDescriptionLocalizations({
		"zh-TW":"測試長回覆"
	});
	const func:(interaction:DC.Interaction)=>void
		=async(interaction)=>{
			if(!interaction.isChatInputCommand()) return;
			let str="";
			for(let i=0;i<400;i+=5){
				if(i%100===0){
					str+=`==[${("0000"+i.toString()).slice(-4)}]==----------==========----------==========\n`;
				}
				str+=`-# [${("0000"+i.toString()).slice(-4)}]----------==========----------==========\n`;
			}
			let opt=await replyer(interaction,str);
			await replyer(interaction,str,opt);
		};
	return {command,func};
})());

DCbot.commands.push((()=>{ // Ask AI command
	const command=new DC.SlashCommandBuilder()
	command.setName("askai");
	command.setDescription("Ask AI a question");
	command.addStringOption(
		(builder)=>{
			builder.setName("question");
			builder.setDescription("The question you want to ask AI");
			builder.setRequired(true);
			builder.setDescriptionLocalizations({
				"zh-TW":"你想問AI的問題"
			});
			return builder;
		}
	);
	command.setDescriptionLocalizations({
		"zh-TW":"向AI提問"
	});
	const func:(interaction:DC.Interaction)=>void
		=async(interaction)=>{
			if(!interaction.isChatInputCommand()) return;
			let opt:{[key:string]:any}|undefined=undefined;
			callAI(
				interaction.user.id,
				interaction.options.getString("question",true),
				async(response)=>{
					opt=await replyer(interaction,response,opt);
				},
				async(response)=>{
					opt=await replyer(interaction,response,opt);
				},
				async(error)=>{
					DCbot.console?.error("Error in askai command:",error);
					const error_embed=new DC.EmbedBuilder()
					error_embed.setTitle("Error");
					error_embed.setDescription(error);
					error_embed.setColor(0xff0000);
					if(!interaction.replied&&!interaction.deferred){
						await interaction.deferReply();
					}
					await interaction.editReply({embeds:[error_embed]});
				}
			);
		};
	return {command,func};
})());

DCbot.commands.push((()=>{ // decode HTML from URL
	const command=new DC.SlashCommandBuilder()
	command.setName("readhtml");
	command.setDescription("Read and decode HTML content from a URL");
	command.setDescriptionLocalizations({
		"zh-TW":"從URL讀取並解碼HTML內容"
	});
	command.addStringOption(
		(builder)=>{
			builder.setName("url");
			builder.setDescription("The URL of the HTML page to read");
			builder.setRequired(true);
			builder.setDescriptionLocalizations({
				"zh-TW":"要讀取的HTML頁面URL"
			});
			return builder;
		}
	);
	const func:(interaction:DC.Interaction)=>void
		=async(interaction)=>{
			if(!interaction.isChatInputCommand()) return;
			await interaction.deferReply();
			let URL=interaction.options.getString("url",true);
			let html_content="testest";
			try{
				html_content=await readHTML(URL);
				if(!html_content)html_content="[No content extracted from the HTML page.]";
			}catch(e){
				html_content="[Failed to read or decode HTML content.]";
			}
			html_content=html_content.slice(0,CONFIG.max_len||1500);
			await interaction.editReply(html_content);
		};
	return {command,func};
})());

DCbot.commands.push((()=>{ // web conculusion from URL
	const command=new DC.SlashCommandBuilder()
	command.setName("webconculusion");
	command.setDescription("make a conculusion of the web page from a URL");
	command.setDescriptionLocalizations({
		"zh-TW":"從URL的網頁內容做總結"
	});
	command.addStringOption(
		(builder)=>{
			builder.setName("url");
			builder.setDescription("The URL of the web page to summarize");
			builder.setRequired(true);
			builder.setDescriptionLocalizations({
				"zh-TW":"要讀取的網頁URL"
			});
			return builder;
		}
	);
	const func:(interaction:DC.Interaction)=>void
		=async(interaction)=>{
			if(!interaction.isChatInputCommand()) return;
			await interaction.deferReply();
			let URL=interaction.options.getString("url",true);
			try{
				await callAI(
					interaction.user.id,
					"make conculusion:\n"+await readHTML(URL),
					async(response)=>{
						response=response.slice(0,CONFIG.max_len||1500);
						if(!interaction.replied&&!interaction.deferred){
							await interaction.deferReply();
						}
						await interaction.editReply(response);
					},
					async(response)=>{
						response=response.slice(0,CONFIG.max_len||1500);
						if(!interaction.replied&&!interaction.deferred){
							await interaction.deferReply();
						}
						await interaction.editReply({content:response});
					},
					async(error)=>{
						const original_reply=(await interaction.fetchReply()).content;
						const error_embed=new DC.EmbedBuilder()
						error_embed.setTitle("Error");
						error_embed.setDescription(error);
						error_embed.setColor(0xff0000);
						if(!interaction.replied&&!interaction.deferred){
							await interaction.deferReply();
						}
						await interaction.editReply({content:original_reply,embeds:[error_embed]});
					}
				);
			}catch(e){
				await interaction.editReply("[Failed to read or decode HTML content.]");
			}
		};
	return {command,func};
})());

DCbot.commands.push((()=>{ // summit OpenAI token
	const command=new DC.SlashCommandBuilder();
	command.setName("set_token")
	command.setDescription("Set your OpenAI API token")
	command.setDescriptionLocalizations({
		"zh-TW":"設定你的OpenAI API金鑰"
	});
	const func:(interaction:DC.Interaction)=>void
		=async(interaction)=>{
			if(!interaction.isChatInputCommand()) return;
			const form=new DC.ModalBuilder()
				.setTitle("Set your OpenAI API token")
				.setCustomId("set_openai_token_modal");
			form.addLabelComponents(new DC.LabelBuilder()
				.setLabel("OpenAI API token (leave blank to remove):")
				.setDescription("You can get your token from https://platform.openai.com/account/api-keys")
				.setTextInputComponent(new DC.TextInputBuilder()
					.setCustomId("openai_token_input")
					.setStyle(DC.TextInputStyle.Short)
					.setPlaceholder("sk-XXXXX...")
					.setRequired(false)
				)
			);
			// await interaction.reply({content:"Please fill in the modal to set your OpenAI API token.",ephemeral:true});
			await interaction.showModal(form);
			DCbot.once(DC.Events.InteractionCreate,async(modal_interaction)=>{
				if(!modal_interaction.isModalSubmit()) return;
				if(modal_interaction.customId==="set_openai_token_modal"){
					let openai_token=modal_interaction.fields.getTextInputValue("openai_token_input").trim();
					if(!DB[modal_interaction.user.id]){
						DB[modal_interaction.user.id]={};
					}
					if(openai_token===""){
						delete DB[modal_interaction.user.id].openai_token;
						fs.writeFileSync("../db.json",JSON.stringify(DB));
						await modal_interaction.reply({
							content:"Your OpenAI API token has been removed.",
							ephemeral:true
						});
						return;
					}
					DB[modal_interaction.user.id].openai_token=openai_token;
					fs.writeFileSync("../db.json",JSON.stringify(DB));
					await modal_interaction.reply({
						content:"Your OpenAI API token has been set successfully.",
						ephemeral:true
					});
				}
			});
		};
	return {command,func};
})());

DCbot.on("clientReady",async()=>{
	console.log(`Logged in as ${DCbot.user?.tag}!`);
	if(CONFIG.log_channel_id){
		// let logchannel=DCbot.channels.cache.get(CONFIG.log_channel_id);
		let logchannel=await DCbot.channels.fetch(CONFIG.log_channel_id).catch(()=>null);
		if(logchannel && logchannel.isTextBased()){
			logchannel=logchannel as DC.TextChannel;
			DCbot.logchannel=logchannel as DC.TextChannel;
			let send_log=async(color:number,...data:any)=>{
				try{
					let content:string="";
					for(let i of data){
						content+=typeof(i)==="string"?i:JSON.stringify(i,null,2);
						content+=" ";
					}
					if(content.length>(CONFIG.max_len||1500)){
						let file=new DC.AttachmentBuilder(Buffer.from(content));
						file.name=`log_${Date.now()}.txt`;
						await DCbot.logchannel?.send({content:`Data length: ${content.length}/${CONFIG.max_len||1500}`,files:[file]});
					}else{
						await DCbot.logchannel?.send({embeds:[
							{
								// title:"Log Message",
								description:`\`\`\`\n${content}\n\`\`\``,
								color:color,
								footer:{
									text:"DChatGPT ੭ ˙ᗜ˙ )੭ 🥑",
									icon_url:"https://gravatar.com/avatar/24c497d6a7c9d41e4963a20fe1aa9bc205824d816b1382be070afe2e57e723f6.jpg?s=1080"
								},
								timestamp:new Date().toISOString()
							}
						]});
					}
				}catch(e){
					await DCbot.logchannel?.send({embeds:[
						{
							// title:"Log Message",
							description:`\`\`\`\nError when sending log message\n\`\`\``,
							color:color,
							footer:{
								text:"DChatGPT ੭ ˙ᗜ˙ )੭ 🥑",
								icon_url:"https://gravatar.com/avatar/24c497d6a7c9d41e4963a20fe1aa9bc205824d816b1382be070afe2e57e723f6.jpg?s=1080"
							},
							timestamp:new Date().toISOString()
						}
					]});
				}
			}
			DCbot.console={
				debug:async(...data:any)=>{
					console.debug(...data);
					return await send_log(0x808080,...data);
				},
				log:async(...data:any)=>{
					console.log(...data);
					return await send_log(0x00ff00,...data);
				},
				warn:async(...data:any)=>{
					console.warn(...data);
					return await send_log(0xffff00,...data);
				},
				error:async(...data:any)=>{
					console.error(...data);
					return await send_log(0xff0000,...data);
				}
			};
		}
	}

	await DCbot.console?.debug("Bot is now online.\np.s. you may need to refresh your Discord client to see slash commands.");

	// let str="";
	// for(let i=0;i<400;i+=5){
	// 	if(i%100===0){
	// 		str+=`==[${("0000"+i.toString()).slice(-4)}]==----------==========----------==========\n`;
	// 	}
	// 	str+=`-# [${("0000"+i.toString()).slice(-4)}]----------==========----------==========\n`;
	// }
	// await DCbot.console?.debug("Test long reply content:\n"+str);

	// if(CONFIG.admin_id){
	// 	for(let i of CONFIG.admin_id){
	// 		try{
	// 			new Promise(async(res)=>{
	// 				let nwuser=await DCbot.users.fetch(i);
	// 				await nwuser.send("Bot is now online.");
	// 				res(0);
	// 			});
	// 		}catch(e){}
	// 	}
	// }
	DCbot.commands_ID={};
	if(DCbot.application){
		if(DCbot.commands){
			for(let {command,func} of DCbot.commands){
				// console.log({command,func});
				let server_cmd_data=await DCbot.application.commands.create(command);
				DCbot.commands_ID[server_cmd_data.id]=func;
			}
		}
	}
});

DCbot.on(DC.Events.InteractionCreate,async(interaction)=>{
	try{
		if(interaction.isCommand()){
			if(DCbot?.commands_ID?.[interaction.commandId]){
				await DCbot.commands_ID[interaction.commandId](interaction);
			}
		}
	}catch(e){
		console.error("Error handling interaction:",e);
		DCbot.console?.error("Error handling interaction:",e);
	}
});

DCbot.login(SECRET.dc_apikey);

