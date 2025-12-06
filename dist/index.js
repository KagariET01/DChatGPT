var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
import OpenAI from "openai";
import * as DC from "discord.js";
import fs from "fs";
import { readHTML } from "./libs/readHTML.js";
const SECRET = JSON.parse(fs.readFileSync("../secret.json", "utf-8").toString());
const CONFIG = JSON.parse(fs.readFileSync("../config.json", "utf-8").toString());
const DB = JSON.parse(fs.readFileSync("../db.json", "utf-8").toString());
const DCbot = new DC.Client({
    intents: [
        DC.GatewayIntentBits.Guilds,
        DC.GatewayIntentBits.GuildMessages,
        DC.GatewayIntentBits.MessageContent,
        DC.GatewayIntentBits.GuildMembers,
        DC.GatewayIntentBits.GuildMessageReactions
    ]
});
DCbot.commands = [];
const replyer = (interaction, options, other_options) => __awaiter(void 0, void 0, void 0, function* () {
    if (!(interaction.replied || interaction.deferred)) {
        yield interaction.deferReply();
    }
    if (options instanceof DC.MessagePayload) {
        interaction.editReply(options);
        return;
    }
    let content = options || options.content || "";
    let content_list = [];
    while (content.length > 0) {
        content_list.push(content.slice(0, (CONFIG.max_len || 1500)));
        content = content.slice((CONFIG.max_len || 1500));
    }
    for (let i = 0; i < content_list.length; i++) {
        if (i === 0) {
            if (typeof (options) === "object") {
                let nwoptions = Object.assign({}, options);
                nwoptions.content = content_list[i];
                yield interaction.editReply(nwoptions);
            }
            else {
                yield interaction.editReply({ content: content_list[i] });
            }
        }
        else {
            if (!other_options)
                other_options = {};
            if (!other_options.followup_list) {
                other_options.followup_list = [];
            }
            let nwoptions = {};
            if (typeof (options) === "object") {
                for (let j in options) {
                    if (j === "content")
                        nwoptions.content = content_list[i];
                    else if (j === "embeds" || (j === "components") || (j === "files")) {
                        nwoptions[j] = [];
                    }
                    else {
                        nwoptions[j] = Object.assign({}, options[j]);
                    }
                }
            }
            else {
                nwoptions.content = content_list[i];
            }
            if (other_options.followup_list.length < i) {
                other_options.followup_list.push(yield interaction.followUp(nwoptions));
            }
            else {
                yield other_options.followup_list[i - 1].edit(nwoptions);
            }
        }
    }
    return other_options;
});
const callAI = (userID, question, replyfunction, editfunction, errorfunction) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, e_1, _b, _c;
    var _d;
    let user_token = (_d = DB[userID]) === null || _d === void 0 ? void 0 : _d.openai_token;
    // console.debug({
    // 	user_token:DB[userID]?.openai_token,
    // 	secret_token:SECRET?.llm_apikey
    // });
    if (!user_token)
        user_token = SECRET === null || SECRET === void 0 ? void 0 : SECRET.llm_apikey;
    if (!user_token) {
        replyfunction("[AI didn't respond]");
        errorfunction === null || errorfunction === void 0 ? void 0 : errorfunction("You have not set your OpenAI token yet. Please set it first.");
    }
    else {
        let openai = new OpenAI({
            apiKey: user_token
        });
        let chatgpt = yield openai.responses.create({
            model: CONFIG.model || "gpt-5-nano",
            input: question,
            stream: true
        });
        console.log({ chatgpt });
        let nwstr = "";
        replyfunction("Question received. Communicating with AI...");
        console.log("User question:", question);
        let stop_edit_reply = () => { };
        (() => __awaiter(void 0, void 0, void 0, function* () {
            let flag = true;
            stop_edit_reply = () => { flag = false; };
            while (flag) {
                yield new Promise(r => setTimeout(r, CONFIG.update_timewait || 2500));
                if (nwstr)
                    editfunction(nwstr + "[AI is thinking]");
                else
                    editfunction("[AI is thinking]");
            }
        }))();
        try {
            try {
                for (var _e = true, chatgpt_1 = __asyncValues(chatgpt), chatgpt_1_1; chatgpt_1_1 = yield chatgpt_1.next(), _a = chatgpt_1_1.done, !_a; _e = true) {
                    _c = chatgpt_1_1.value;
                    _e = false;
                    const chunk = _c;
                    console.log({ nwstr, chunk });
                    if ("delta" in chunk && typeof (chunk.delta) === "string") {
                        nwstr += chunk.delta;
                        console.log({
                            receive_chunk: chunk.delta,
                            current_response: nwstr
                        });
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_e && !_a && (_b = chatgpt_1.return)) yield _b.call(chatgpt_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            stop_edit_reply();
            yield new Promise(r => setTimeout(r, CONFIG.update_timewait || 2500));
            if (!nwstr)
                nwstr = "[AI didn't respond]";
            editfunction(nwstr);
        }
        catch (e) {
            errorfunction === null || errorfunction === void 0 ? void 0 : errorfunction("An error occurred while communicating with AI.");
        }
    }
});
DCbot.commands.push((() => {
    const command = new DC.SlashCommandBuilder();
    command.setName("testlongreply");
    command.setDescription("Test long reply");
    command.setDescriptionLocalizations({
        "zh-TW": "測試長回覆"
    });
    const func = (interaction) => __awaiter(void 0, void 0, void 0, function* () {
        if (!interaction.isChatInputCommand())
            return;
        let str = "";
        for (let i = 0; i < 400; i += 5) {
            if (i % 100 === 0) {
                str += `==[${("0000" + i.toString()).slice(-4)}]==----------==========----------==========\n`;
            }
            str += `-# [${("0000" + i.toString()).slice(-4)}]----------==========----------==========\n`;
        }
        let opt = yield replyer(interaction, str);
        yield replyer(interaction, str, opt);
    });
    return { command, func };
})());
DCbot.commands.push((() => {
    const command = new DC.SlashCommandBuilder();
    command.setName("askai");
    command.setDescription("Ask AI a question");
    command.addStringOption((builder) => {
        builder.setName("question");
        builder.setDescription("The question you want to ask AI");
        builder.setRequired(true);
        builder.setDescriptionLocalizations({
            "zh-TW": "你想問AI的問題"
        });
        return builder;
    });
    command.setDescriptionLocalizations({
        "zh-TW": "向AI提問"
    });
    const func = (interaction) => __awaiter(void 0, void 0, void 0, function* () {
        if (!interaction.isChatInputCommand())
            return;
        let opt = undefined;
        callAI(interaction.user.id, interaction.options.getString("question", true), (response) => __awaiter(void 0, void 0, void 0, function* () {
            opt = yield replyer(interaction, response, opt);
        }), (response) => __awaiter(void 0, void 0, void 0, function* () {
            opt = yield replyer(interaction, response, opt);
        }), (error) => __awaiter(void 0, void 0, void 0, function* () {
            const error_embed = new DC.EmbedBuilder();
            error_embed.setTitle("Error");
            error_embed.setDescription(error);
            error_embed.setColor(0xff0000);
            yield interaction.editReply({ embeds: [error_embed] });
        }));
    });
    return { command, func };
})());
DCbot.commands.push((() => {
    const command = new DC.SlashCommandBuilder();
    command.setName("readhtml");
    command.setDescription("Read and decode HTML content from a URL");
    command.setDescriptionLocalizations({
        "zh-TW": "從URL讀取並解碼HTML內容"
    });
    command.addStringOption((builder) => {
        builder.setName("url");
        builder.setDescription("The URL of the HTML page to read");
        builder.setRequired(true);
        builder.setDescriptionLocalizations({
            "zh-TW": "要讀取的HTML頁面URL"
        });
        return builder;
    });
    const func = (interaction) => __awaiter(void 0, void 0, void 0, function* () {
        if (!interaction.isChatInputCommand())
            return;
        yield interaction.deferReply();
        let URL = interaction.options.getString("url", true);
        let html_content = "testest";
        try {
            html_content = yield readHTML(URL);
            if (!html_content)
                html_content = "[No content extracted from the HTML page.]";
        }
        catch (e) {
            html_content = "[Failed to read or decode HTML content.]";
        }
        html_content = html_content.slice(0, CONFIG.max_len || 1500);
        yield interaction.editReply(html_content);
    });
    return { command, func };
})());
DCbot.commands.push((() => {
    const command = new DC.SlashCommandBuilder();
    command.setName("webconculusion");
    command.setDescription("make a conculusion of the web page from a URL");
    command.setDescriptionLocalizations({
        "zh-TW": "從URL的網頁內容做總結"
    });
    command.addStringOption((builder) => {
        builder.setName("url");
        builder.setDescription("The URL of the web page to summarize");
        builder.setRequired(true);
        builder.setDescriptionLocalizations({
            "zh-TW": "要讀取的網頁URL"
        });
        return builder;
    });
    const func = (interaction) => __awaiter(void 0, void 0, void 0, function* () {
        if (!interaction.isChatInputCommand())
            return;
        yield interaction.deferReply();
        let URL = interaction.options.getString("url", true);
        try {
            yield callAI(interaction.user.id, "make conculusion:\n" + (yield readHTML(URL)), (response) => __awaiter(void 0, void 0, void 0, function* () {
                response = response.slice(0, CONFIG.max_len || 1500);
                yield interaction.editReply(response);
            }), (response) => __awaiter(void 0, void 0, void 0, function* () {
                response = response.slice(0, CONFIG.max_len || 1500);
                yield interaction.editReply({ content: response });
            }), (error) => __awaiter(void 0, void 0, void 0, function* () {
                const original_reply = (yield interaction.fetchReply()).content;
                const error_embed = new DC.EmbedBuilder();
                error_embed.setTitle("Error");
                error_embed.setDescription(error);
                error_embed.setColor(0xff0000);
                yield interaction.editReply({ content: original_reply, embeds: [error_embed] });
            }));
        }
        catch (e) {
            yield interaction.editReply("[Failed to read or decode HTML content.]");
        }
    });
    return { command, func };
})());
DCbot.commands.push((() => {
    const command = new DC.SlashCommandBuilder();
    command.setName("set_token");
    command.setDescription("Set your OpenAI API token");
    command.setDescriptionLocalizations({
        "zh-TW": "設定你的OpenAI API金鑰"
    });
    const func = (interaction) => __awaiter(void 0, void 0, void 0, function* () {
        if (!interaction.isChatInputCommand())
            return;
        const form = new DC.ModalBuilder()
            .setTitle("Set your OpenAI API token")
            .setCustomId("set_openai_token_modal");
        form.addLabelComponents(new DC.LabelBuilder()
            .setLabel("OpenAI API token (leave blank to remove):")
            .setDescription("You can get your token from https://platform.openai.com/account/api-keys")
            .setTextInputComponent(new DC.TextInputBuilder()
            .setCustomId("openai_token_input")
            .setStyle(DC.TextInputStyle.Short)
            .setPlaceholder("sk-XXXXX...")
            .setRequired(false)));
        // await interaction.reply({content:"Please fill in the modal to set your OpenAI API token.",ephemeral:true});
        yield interaction.showModal(form);
        DCbot.once(DC.Events.InteractionCreate, (modal_interaction) => __awaiter(void 0, void 0, void 0, function* () {
            if (!modal_interaction.isModalSubmit())
                return;
            if (modal_interaction.customId === "set_openai_token_modal") {
                let openai_token = modal_interaction.fields.getTextInputValue("openai_token_input").trim();
                if (!DB[modal_interaction.user.id]) {
                    DB[modal_interaction.user.id] = {};
                }
                if (openai_token === "") {
                    delete DB[modal_interaction.user.id].openai_token;
                    fs.writeFileSync("../db.json", JSON.stringify(DB));
                    yield modal_interaction.reply({
                        content: "Your OpenAI API token has been removed.",
                        ephemeral: true
                    });
                    return;
                }
                DB[modal_interaction.user.id].openai_token = openai_token;
                fs.writeFileSync("../db.json", JSON.stringify(DB));
                yield modal_interaction.reply({
                    content: "Your OpenAI API token has been set successfully.",
                    ephemeral: true
                });
            }
        }));
    });
    return { command, func };
})());
DCbot.on("clientReady", () => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    console.log(`Logged in as ${(_a = DCbot.user) === null || _a === void 0 ? void 0 : _a.tag}!`);
    if (CONFIG.log_channel_id) {
        // let logchannel=DCbot.channels.cache.get(CONFIG.log_channel_id);
        let logchannel = yield DCbot.channels.fetch(CONFIG.log_channel_id).catch(() => null);
        if (logchannel && logchannel.isTextBased()) {
            logchannel = logchannel;
            DCbot.logchannel = logchannel;
            let send_log = (color, ...data) => __awaiter(void 0, void 0, void 0, function* () {
                var _a, _b, _c;
                try {
                    let content = "";
                    for (let i of data) {
                        content += typeof (i) === "string" ? i : JSON.stringify(i, null, 2);
                        content += " ";
                    }
                    if (content.length > (CONFIG.max_len || 1500)) {
                        let file = new DC.AttachmentBuilder(Buffer.from(content));
                        file.name = `log_${Date.now()}.txt`;
                        yield ((_a = DCbot.logchannel) === null || _a === void 0 ? void 0 : _a.send({ content: `Data length: ${content.length}/${CONFIG.max_len || 1500}`, files: [file] }));
                    }
                    else {
                        yield ((_b = DCbot.logchannel) === null || _b === void 0 ? void 0 : _b.send({ embeds: [
                                {
                                    // title:"Log Message",
                                    description: `\`\`\`\n${content}\n\`\`\``,
                                    color: color,
                                    footer: {
                                        text: "DChatGPT ੭ ˙ᗜ˙ )੭ 🥑",
                                        icon_url: "https://gravatar.com/avatar/24c497d6a7c9d41e4963a20fe1aa9bc205824d816b1382be070afe2e57e723f6.jpg?s=1080"
                                    },
                                    timestamp: new Date().toISOString()
                                }
                            ] }));
                    }
                }
                catch (e) {
                    yield ((_c = DCbot.logchannel) === null || _c === void 0 ? void 0 : _c.send({ embeds: [
                            {
                                // title:"Log Message",
                                description: `\`\`\`\nError when sending log message\n\`\`\``,
                                color: color,
                                footer: {
                                    text: "DChatGPT ੭ ˙ᗜ˙ )੭ 🥑",
                                    icon_url: "https://gravatar.com/avatar/24c497d6a7c9d41e4963a20fe1aa9bc205824d816b1382be070afe2e57e723f6.jpg?s=1080"
                                },
                                timestamp: new Date().toISOString()
                            }
                        ] }));
                }
            });
            DCbot.console = {
                debug: (...data) => __awaiter(void 0, void 0, void 0, function* () {
                    console.debug(...data);
                    return yield send_log(0x808080, ...data);
                }),
                log: (...data) => __awaiter(void 0, void 0, void 0, function* () {
                    console.log(...data);
                    return yield send_log(0x00ff00, ...data);
                }),
                warn: (...data) => __awaiter(void 0, void 0, void 0, function* () {
                    console.warn(...data);
                    return yield send_log(0xffff00, ...data);
                }),
                error: (...data) => __awaiter(void 0, void 0, void 0, function* () {
                    console.error(...data);
                    return yield send_log(0xff0000, ...data);
                })
            };
        }
    }
    yield ((_b = DCbot.console) === null || _b === void 0 ? void 0 : _b.debug("Bot is now online.\np.s. you may need to refresh your Discord client to see slash commands."));
    let str = "";
    for (let i = 0; i < 400; i += 5) {
        if (i % 100 === 0) {
            str += `==[${("0000" + i.toString()).slice(-4)}]==----------==========----------==========\n`;
        }
        str += `-# [${("0000" + i.toString()).slice(-4)}]----------==========----------==========\n`;
    }
    yield ((_c = DCbot.console) === null || _c === void 0 ? void 0 : _c.debug("Test long reply content:\n" + str));
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
    DCbot.commands_ID = {};
    if (DCbot.application) {
        if (DCbot.commands) {
            for (let { command, func } of DCbot.commands) {
                // console.log({command,func});
                let server_cmd_data = yield DCbot.application.commands.create(command);
                DCbot.commands_ID[server_cmd_data.id] = func;
            }
        }
    }
}));
DCbot.on(DC.Events.InteractionCreate, (interaction) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        if (interaction.isCommand()) {
            if ((_a = DCbot === null || DCbot === void 0 ? void 0 : DCbot.commands_ID) === null || _a === void 0 ? void 0 : _a[interaction.commandId]) {
                yield DCbot.commands_ID[interaction.commandId](interaction);
            }
        }
    }
    catch (e) {
        console.error("Error handling interaction:", e);
        (_b = DCbot.console) === null || _b === void 0 ? void 0 : _b.error("Error handling interaction:", e);
    }
}));
DCbot.login(SECRET.dc_apikey);
//# sourceMappingURL=index.js.map