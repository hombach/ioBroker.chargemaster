"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isObject = isObject;
exports.isArray = isArray;
exports.translateText = translateText;
const axios_1 = __importDefault(require("axios"));
function isObject(it) {
    return Object.prototype.toString.call(it) === "[object Object]";
}
function isArray(it) {
    if (Array.isArray != null) {
        return Array.isArray(it);
    }
    return Object.prototype.toString.call(it) === "[object Array]";
}
async function translateText(text, targetLang, yandexApiKey) {
    if (targetLang === "en") {
        return text;
    }
    else if (!text) {
        return "";
    }
    if (yandexApiKey) {
        return translateYandex(text, targetLang, yandexApiKey);
    }
    return "DISABLED";
}
async function translateYandex(text, targetLang, apiKey) {
    if (targetLang === "zh-cn") {
        targetLang = "zh";
    }
    try {
        const url = `https://translate.yandex.net/api/v1.5/tr.json/translate?key=${apiKey}&text=${encodeURIComponent(text)}&lang=en-${targetLang}`;
        const response = await axios_1.default.request({ url, timeout: 15000 });
        if (isArray(response.data?.text)) {
            return response.data.text[0];
        }
        throw new Error(`Invalid response for translate request`);
    }
    catch (e) {
        throw new Error(`Could not translate to "${targetLang}": ${e}`);
    }
}
//# sourceMappingURL=tools.js.map