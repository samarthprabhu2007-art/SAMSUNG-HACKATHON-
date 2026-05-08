import { gateway, type AgentMessage } from "../core/Gateway.js";

export interface ProtocolAdapter {
  channelId: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}
