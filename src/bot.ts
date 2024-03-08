import { Client, IntentsBitField, CommandInteraction, type Message } from 'discord.js';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { SlashCommandBuilder } from '@discordjs/builders';
import DifyChatClient from './dify-client';
import * as dotenv from 'dotenv';

dotenv.config();
const conversationCache = new Map<string, string>()

class DiscordBot {
    private client: Client;
    private difyClient: DifyChatClient;
    private readonly TOKEN: string;
    private readonly CACHE_MODE: string;
    constructor() {
        this.TOKEN = process.env.DISCORD_BOT_TOKEN || '';
        this.CACHE_MODE = process.env.CACHE_MODE || '';
        if (!this.TOKEN) {
            throw new Error('DISCORD_BOT_TOKEN must be provided in the .env file');
        }

        this.client = new Client({
            intents: [
                IntentsBitField.Flags.Guilds,
                IntentsBitField.Flags.GuildMessages,
                IntentsBitField.Flags.DirectMessages
            ]
        });
        this.difyClient = new DifyChatClient();

        this.client.once('ready', () => {
            console.log('Discord bot is ready!', 'Client ID:', this.client.user!.id, `\nInstall this bot to your server with this link: https://discord.com/api/oauth2/authorize?client_id=${this.client.user!.id}&permissions=0&scope=bot%20applications.commands `);
        });

        this.client.on('messageCreate', async (message) => {
            if (message.author.bot) return;

            if (message.mentions.has(this.client.user!.id)) {
                await this.handleChatMessage(message);
            }
        });
        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isCommand()) return;

            if (interaction.commandName === 'chat') {
                await this.handleChatCommand(interaction);
            }
        });
    }

    public start() {
        return this.client.login(this.TOKEN);
    }

    public async installSlashCommand(guildId: string) {
        const commands = [
            new SlashCommandBuilder()
                .setName('chat')
                .setDescription('Chat with the bot')
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('Your message')
                        .setRequired(true))
                .toJSON(),
        ];

        const rest = new REST({ version: '9' }).setToken(this.TOKEN);

        try {
            console.log('Started refreshing application (/) commands.');

            await rest.put(
                Routes.applicationGuildCommands(this.client.user!.id, guildId),
                { body: commands },
            );

            console.log('Successfully reloaded application (/) commands.');
        } catch (error) {
            console.error(error);
        }
    }

    private async handleChatCommand(interaction: CommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        const message = interaction.options.get('message', true);
        const cacheId = this.CACHE_MODE && this.CACHE_MODE === 'user' ? interaction.user.id : interaction.channelId;

        try {
            const difyResponse = await this.difyClient.createChatMessage({ inputs: { username: interaction.user.globalName || interaction.user.username }, query: message.value! as string, response_mode: 'blocking', conversation_id: cacheId && conversationCache.get(cacheId) || '', user: interaction.user.id });

            if (cacheId) {
                conversationCache.set(cacheId, difyResponse.conversation_id);
            }

            await interaction.editReply({ content: difyResponse.answer });
        } catch (error) {
            console.error('Error sending message to Dify:', error);
            await interaction.editReply({ content: 'Sorry, something went wrong while generating the answer.' });
        }
    }

    private async handleChatMessage(message: Message) {
        const cacheId = this.CACHE_MODE && this.CACHE_MODE === 'user' ? message.author.id : message.channelId;

        try {
            message.channel.sendTyping().catch(console.error);
            const difyResponse = await this.difyClient.createChatMessage({ inputs: { username: message.author.globalName || message.author.username }, query: message.content.replace(`<@${this.client.user?.id}>`, ''), response_mode: 'blocking', conversation_id: cacheId && conversationCache.get(cacheId) || '', user: message.author.id });

            if (cacheId) {
                conversationCache.set(cacheId, difyResponse.conversation_id);
            }

            await message.reply(difyResponse.answer);
        } catch (error) {
            console.error('Error sending message to Dify:', error);
            await message.reply('Sorry, something went wrong while generating the answer.');
        }
    }
}

export default DiscordBot;
