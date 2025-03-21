import express, { Request, Response, NextFunction } from "express";
import bodyParser from "body-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import DiscordBot from "./bot";

export class WebhookServer {
  private app = express();
  private port = process.env.WEBHOOK_PORT || 3000;
  private API_KEY = process.env.WEBHOOK_API_KEY || "";
  private bot: DiscordBot;

  constructor(bot: DiscordBot) {
    this.bot = bot;

    // Use security middlewares
    this.app.use(helmet());
    const rateLimitWindow = process.env.WEBHOOK_RATE_LIMIT_WINDOW ? parseInt(process.env.WEBHOOK_RATE_LIMIT_WINDOW) : 15 * 60 * 1000;
    const rateLimitMax = process.env.WEBHOOK_RATE_LIMIT_MAX ? parseInt(process.env.WEBHOOK_RATE_LIMIT_MAX) : 100;
    const apiLimiter = rateLimit({
      windowMs: rateLimitWindow, // window in milliseconds
      max: rateLimitMax, // limit each IP to max requests per windowMs
      message: "Too many requests, please try again later."
    });
    // Apply rate limiter to webhook endpoints only
    this.app.use("/webhook", apiLimiter);

    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: true }));

    this.app.post("/webhook/:channelId", this.handleWebhook.bind(this));
  }

  private async handleWebhook(req: Request, res: Response, _next: NextFunction) {
    const apiKey = req.headers["x-api-key"];
    if (apiKey !== this.API_KEY) {
      res.status(403).send("Forbidden");
      return;
    }

    const { channelId } = req.params;
    const { content } = req.body;

    if (!content || content.length > 4000) {
      console.error("Invalid content:", content);
      res.status(400).send("Invalid content");
      return;
    }

    try {
      await this.bot.handleWebhookChatMessage(channelId, content);
      res.status(200).send("Message sent");
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).send("Internal Server Error");
    }
  }

  public start() {
    this.app.listen(this.port, () => {
      console.log(`Webhook server is running on port ${this.port}`);
    });
  }
}