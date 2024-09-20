import DiscordBot from "../src/bot";
import * as dotenv from "dotenv";

dotenv.config();
const guildId = process.argv[2]; // Get the Discord server ID from the command line arguments

if (!guildId) {
  console.error("Please provide a Discord server ID.");
  process.exit(1);
}

console.log(
  "Please wait while the discord bot gets installed on the discord server with id",
  guildId
);

const bot = new DiscordBot();

bot
  .start()
  .then(() => bot.installSlashCommand(guildId))
  .then(() => process.exit(0))
  .then(() =>
    console.log(
      "Installation successful you can now use the bot on your discord server."
    )
  )
  .catch((error) => {
    console.error("Error installing commands:", error);
    process.exit(1);
  });
