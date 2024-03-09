# Dify-Discord-Starter 🤖✨

Welcome to the **Dify-Discord-Starter** project! This is a modern and easy-to-use starter template for creating a Discord bot that integrates with the Dify app. Use this template to build your own bot and enable interactive chatting capabilities within your Discord community.

## Features 🚀

- **Slash Command Support**: Users can interact with your bot using the `/chat` command directly in Discord.
- **Integration with Dify**: Seamlessly send and receive messages through the Dify app.
- **Ephemeral Responses**: Keep conversations private by sending ephemeral messages that only the command user can see.
- **Simplified Bot Installation**: Easily add your bot to any Discord server with a single command.

## Prerequisites 📋

Before you begin, ensure you have the following installed:
- Node.js (v14 or higher)
- npm (comes with Node.js)

## Setup 🛠️

1. **Clone the Repository**
    ```sh
    git clone https://github.com/your-username/dify-discord-starter.git
    cd dify-discord-starter
    ```

2. **Environment Variables**
    - Rename `.env-example` to `.env`.
    - Fill in the environment variables with your own values.
    ```plaintext
    DIFY_API_KEY="app..." # Your Dify API secret key
    DIFY_API_BASE_URL="https://api.dify.ai/v1" # Your Dify instance base URL
    DISCORD_BOT_TOKEN="" # Your Discord bot token from Discord Developer Portal
    ```

3. **Install Dependencies**
    ```sh
    npm install
    ```

4. **Build the Project**
    ```sh
    npm run build
    ```

5. **Start the Bot**
    ```sh
    npm start
    ```
    Upon startup, the bot will log a message in the console with a link to add the bot to your Discord server.

6. **Add Your Bot to a Discord Server**
    Use the provided link in the console to add your bot to a Discord server.

7. **Install Slash Commands**
    ```sh
    npx ts-node scripts/install.ts <server-id>
    ```
    Replace `<server-id>` with the ID of the server where you want to install the command.

## Usage 📖

Once the bot is added to your server and the slash command is installed, you can interact with it using the `/chat` command. Simply type `/chat` followed by your message, and the bot will respond with an ephemeral reply from the Dify app.

## Scripts 📜

- `npm run build`: Compiles the TypeScript code to JavaScript, preparing it for execution.
- `npm start`: Starts the bot using the compiled JavaScript code.
- `npm run dev`: Runs the bot in development mode with hot reloading, ideal for development purposes.
- `npm run install-cmd`: A shortcut script to run the install command script.

## Dify variables
By default the discord bot will pass the name of the user to the bot, within the dify variable `username`.

## Conversation History
You can set the environment variable `HISTORY_MODE` to enable chat history. Currently the history is stored in memory, if you restart the bot, it will forget the history.
Be aware that currently, there is no mechanic to clear or summarize the history. This means, that if users send too many messages, you might reach the token limit of the assistant.

If you do not set this variable, the bot will not remember messages - the bot will even forget the last message the bot has sent to the channel.

### History per user
Set it to `user` if you want the bot to enable an own chat history for every user. The assistant will remember every message of the user accross channels and servers.

### History per channel
Set it to `channel` if you want the bot to enable a history for channels. The assistant will remember every message in the channe regardless from which user it came. You should use the dify variable "username" to allow the bot recognize the author of messages, otherwise the assistant will think all messages come from the same user.

Hint: If you use this, the userId of messages will no longer be the user but the server id, since dify does store conversations per user - if you share conversations accross users, you cannot pass the userid since dify would still create a unique conversation per user.


## Contributing 🤝

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License 📝

Distributed under the MIT License. See `LICENSE` for more information.

## Acknowledgements 🙏

- [Discord.js](https://discord.js.org/#/)
- [Dify.ai](https://dify.ai/)
- [Node.js](https://nodejs.org/)

---

Happy Coding! 🎉👩‍💻👨‍💻

*Note: This is a starter project and is not affiliated with the official Dify platform or Discord.*