import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

async function test() {
  const key1 = process.env.GEMINI_API_KEY;
  const key2 = "AIzaSyA5bbbq8f_wCQK1F7EHlvRhFjVAKchXxSc";
  
  for (const [name, key] of [["ENV", key1], ["PROVIDED", key2]]) {
    console.log(`Testing key: ${name}`);
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Hello",
      });
      console.log(`Success with ${name}: ${res.text}`);
    } catch (err: any) {
      console.error(`Error with ${name}:`, err.message);
    }
  }
}

test();
