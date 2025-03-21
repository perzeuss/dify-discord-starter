import { WebhookServer } from './webhook-server';
import DiscordBot from "./bot";

const bot = new DiscordBot();
bot.start().then(() => {
  const WEBHOOK_API_KEY = process.env.WEBHOOK_API_KEY || "";
  if (WEBHOOK_API_KEY) {
    const webhookServer = new WebhookServer(bot);
    webhookServer.start();
  } else {
    console.log("WEBHOOK_API_KEY is not set. Webhook server will not start.");
  }
}).catch(console.error);