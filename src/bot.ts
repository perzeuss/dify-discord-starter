import { Client, IntentsBitField, CommandInteraction } from 'discord.js';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { SlashCommandBuilder } from '@discordjs/builders';
import DifyChatClient from './dify-client';
import * as dotenv from 'dotenv';

dotenv.config();

class DiscordBot {
    private client: Client;
    private difyClient: DifyChatClient;
    private readonly TOKEN: string;

    constructor() {
        this.TOKEN = process.env.DISCORD_BOT_TOKEN || '';
        if (!this.TOKEN) {
            throw new Error('DISCORD_BOT_TOKEN must be provided in the .env file');
        }

        this.client = new Client({ intents: [IntentsBitField.Flags.Guilds] });
        this.difyClient = new DifyChatClient();

        this.client.once('ready', () => {
            console.log('Discord bot is ready!', 'Client ID:', this.client.user!.id, `\nInstall this bot to your server with this link: https://discord.com/api/oauth2/authorize?client_id=${this.client.user!.id}&permissions=0&scope=bot%20applications.commands `);
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

        try {
            const difyResponse = await this.difyClient.createChatMessage({ inputs: {}, query: message.value! as string, response_mode: 'blocking', conversation_id: '', user: interaction.user.id });
            await interaction.editReply({ content: difyResponse.answer });
        } catch (error) {
            console.error('Error sending message to Dify:', error);
            await interaction.editReply({ content: 'Sorry, something went wrong while processing your request.' });
        }
    }
}

export default DiscordBot;
