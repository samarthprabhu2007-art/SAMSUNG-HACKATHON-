import { gateway, type AgentMessage } from "./Gateway.js";
import { getLLMProvider } from "../services/llmProvider.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SOUL_PATH = path.resolve(__dirname, "../../../openclaw/SOUL.md");

export class PiEngine {
  private llm: ReturnType<typeof getLLMProvider> | null = null;

  constructor() {
    gateway.on("message", async (msg: AgentMessage) => {
      await this.handleIncomingMessage(msg);
    });
  }

  private async getSoul(): Promise<string> {
    try {
      return await readFile(SOUL_PATH, "utf8");
    } catch {
      return "You are a helpful assistant.";
    }
  }

  private async handleIncomingMessage(msg: AgentMessage) {
    try {
      if (!this.llm) {
        this.llm = getLLMProvider();
      }
      const soul = await this.getSoul();
      
      const systemPrompt = `
You are the reasoning engine for an OpenClaw agent.
Read the following SOUL.md configuration to understand your personality and rules:
${soul}

You have received a message from a user.
You can respond directly. Keep responses concise and strictly follow the tone defined in SOUL.md.
`;

      const responseText = await this.llm.generateContent({
        prompt: `User says: ${msg.content}`,
        systemPrompt: systemPrompt
      });

      // Send the response back through the gateway to the specific channel
      gateway.sendMessage(msg.channelId, msg.userId, responseText);
    } catch (error) {
      console.error("[PiEngine] Error processing message:", error);
      gateway.sendMessage(msg.channelId, msg.userId, "Error: Cognitive systems offline.");
    }
  }
}

export const piEngine = new PiEngine();
