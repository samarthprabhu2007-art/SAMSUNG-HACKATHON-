import { gateway } from "../core/Gateway.js";
import type { ProtocolAdapter } from "./ProtocolAdapter.js";

export class TelegramAdapter implements ProtocolAdapter {
  public channelId = "telegram";
  private token: string = "";
  private isPolling = false;
  private offset = 0;

  constructor() {}

  public async start(): Promise<void> {
    this.token = process.env.TELEGRAM_BOT_TOKEN || "";
    if (!this.token) {
      console.warn("[TelegramAdapter] Missing TELEGRAM_BOT_TOKEN. Skipping Telegram start.");
      return;
    }

    console.log("[TelegramAdapter] Starting polling...");
    this.isPolling = true;
    this.poll();

    // Listen for outgoing messages from the Gateway intended for Telegram
    gateway.on(`send:${this.channelId}`, async (data: { userId: string; content: string }) => {
      await this.sendMessage(data.userId, data.content);
    });
  }

  public async stop(): Promise<void> {
    this.isPolling = false;
    gateway.removeAllListeners(`send:${this.channelId}`);
  }

  private async poll() {
    if (!this.isPolling) return;

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.token}/getUpdates?offset=${this.offset}&timeout=30`
      );
      
      if (!response.ok) {
        throw new Error(`Telegram polling failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.ok && data.result.length > 0) {
        for (const update of data.result) {
          this.offset = update.update_id + 1;
          
          if (update.message && update.message.text) {
            const chatId = update.message.chat.id.toString();
            const text = update.message.text;

            // Send message to the Gateway
            gateway.receiveMessage({
              channelId: this.channelId,
              userId: chatId,
              content: text,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    } catch (error) {
      console.error("[TelegramAdapter] Polling error:", error);
    } finally {
      // Continue polling after a short delay to avoid spamming on error
      setTimeout(() => this.poll(), 1000);
    }
  }

  public async sendMessage(chatId: string, message: string) {
    if (!this.token || !chatId) return;

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
          }),
        }
      );

      if (!response.ok) {
        console.error("[TelegramAdapter] Failed to send message:", await response.text());
      }
    } catch (error) {
      console.error("[TelegramAdapter] Error sending message:", error);
    }
  }
}

export const telegramAdapter = new TelegramAdapter();
