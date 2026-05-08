import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyDDtX3jAGW6iT9vo56KACW_WZRylxZ3vwY";
const genAI = new GoogleGenerativeAI(API_KEY);

const models = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-preview-04-17",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

for (const m of models) {
  try {
    const model = genAI.getGenerativeModel({ model: m });
    const result = await model.generateContent("say hi in one word");
    console.log(`WORKS: ${m} → ${result.response.text().trim().slice(0, 30)}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message.split("\n")[0] : String(e);
    console.log(`FAIL:  ${m} → ${msg}`);
  }
}
