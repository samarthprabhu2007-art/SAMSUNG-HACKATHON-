import { EventEmitter } from "node:events";

export interface AgentMessage {
  channelId: string;
  userId: string;
  content: string;
  timestamp: string;
}

export class Gateway extends EventEmitter {
  constructor() {
    super();
  }

  // Receive a message from any channel
  public receiveMessage(message: AgentMessage) {
    console.log(`[Gateway] Received message from ${message.channelId} (User: ${message.userId}): ${message.content}`);
    
    // In Phase 4, we will pass this message to the Pi Engine.
    // For now, we emit it so channels can test echo functionality.
    this.emit("message", message);
  }

  // Send a message to a specific channel
  public sendMessage(channelId: string, userId: string, content: string) {
    console.log(`[Gateway] Routing message to ${channelId} (User: ${userId}): ${content}`);
    this.emit(`send:${channelId}`, { userId, content });
  }
}

// Singleton instance
export const gateway = new Gateway();
