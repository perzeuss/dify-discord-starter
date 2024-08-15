import { SlashCommandBuilder } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import {
  Client,
  CommandInteraction,
  GatewayIntentBits,
  Message,
} from 'discord.js';
import * as dotenv from 'dotenv';
import type { ChatMessageRequest } from './dify-client/api.types';
import DifyChatClient from './dify-client/dify-client';
import {
  DifyFile,
  type ThoughtItem,
  type VisionFile,
} from './dify-client/dify.types';

dotenv.config();
const conversationCache = new Map<string, string>();

class DiscordBot {
  private client: Client;
  private difyClient: DifyChatClient;
  private readonly TOKEN: string;
  private readonly HISTORY_MODE: string;
  private readonly MAX_MESSAGE_LENGTH: number;

  constructor() {
    this.TOKEN = process.env.DISCORD_BOT_TOKEN || '';
    this.HISTORY_MODE = process.env.HISTORY_MODE || '';
    this.MAX_MESSAGE_LENGTH = Number(process.env.MAX_MESSAGE_LENGTH) || 2000;
    if (!this.TOKEN) {
      throw new Error('DISCORD_BOT_TOKEN must be provided in the .env file');
    }

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
    this.difyClient = new DifyChatClient();

    this.client.once('ready', () => {
      console.log(
        'Discord bot is ready!',
        'Client ID:',
        this.client.user!.id,
        `\nInstall this bot to your server with this link: https://discord.com/api/oauth2/authorize?client_id=${this.client.user!.id}&permissions=0&scope=bot%20applications.commands `,
      );
    });

    this.client.on('guildCreate', async (guild) => {
      console.log(`Joined a new guild: ${guild.name} (ID: ${guild.id})`);

      // Install the slash command on guild join
      try {
        await this.installSlashCommand(guild.id);
        console.log(`Slash commands installed for guild: ${guild.id}`);
      } catch (error) {
        console.error(
          `Error installing slash commands for guild ${guild.id}:`,
          error,
        );
      }
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
      } else if (interaction.commandName === 'new-conversation') {
        const cacheId =
          this.HISTORY_MODE && this.HISTORY_MODE === 'user'
            ? interaction.user.id
            : interaction.channelId;
        conversationCache.delete(cacheId);
        await interaction.reply('New conversation started!');
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
        .setDescription(
          'Chat with the bot in private. No one but you will see this message or the bot response.',
        )
        .addStringOption((option) =>
          option
            .setName('message')
            .setDescription('Your message.')
            .setRequired(true),
        )
        .toJSON(),
      new SlashCommandBuilder()
        .setName('new-conversation')
        .setDescription(
          'Start a new conversation with the bot. This will clear the chat history.',
        )
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
    const cacheKey = this.getCacheKey(
      interaction.user.id,
      interaction.channel?.id,
    );

    try {
      const { messages, files } = await this.generateAnswer(
        {
          inputs: {
            username: interaction.user.globalName || interaction.user.username,
            now: new Date().toUTCString(),
          },
          query: message.value! as string,
          response_mode: 'streaming',
          conversation_id: (cacheKey && conversationCache.get(cacheKey)) || '',
          user: this.getUserId(interaction.user.id, interaction.guild?.id),
        },
        {
          cacheKey,
          handleChatflowAnswer: (chatflowMessages, files) => {
            if (chatflowMessages.length > 0) {
              this.sendInteractionAnswer(interaction, chatflowMessages, files);
            }
          },
        },
      );

      this.sendInteractionAnswer(interaction, messages, files);
    } catch (error) {
      console.error('Error sending message to Dify:', error);
      await interaction.editReply({
        content: 'Sorry, something went wrong while generating the answer.',
      });
    }
  }

  private sendInteractionAnswer(
    interaction: CommandInteraction,
    messages: string[],
    files?: DifyFile[],
  ) {
    for (const [index, message] of messages.entries()) {
      if (message.length === 0) continue;

      const additionalFields =
        index === 0
          ? {
              files: files?.map((f) => ({
                attachment: f.url,
                name: f.extension
                  ? `generated_${f.type}.${f.extension}`
                  : `generated_${f.type}`,
              })),
            }
          : {};

      try {
        if (!interaction.replied && index === 0) {
          interaction.editReply({
            content: message,
            ...additionalFields,
          });
        } else {
          interaction.followUp({
            content: message,
            ephemeral: true,
            ...additionalFields,
          });
        }
      } catch (error) {
        console.error('Error sending interaction answer:', error);
      }
    }
  }

  private async handleChatMessage(message: Message) {
    const cacheKey = this.getCacheKey(message.author.id, message.channelId);
    message.channel.sendTyping().catch(console.error);

    try {
      const { messages, files } = await this.generateAnswer(
        {
          inputs: {
            username: message.author.globalName || message.author.username,
            now: new Date().toUTCString(),
          },
          query: message.content
            .replace(`<@${this.client.user?.id}>`, '')
            .trim(),
          response_mode: 'streaming',
          conversation_id: (cacheKey && conversationCache.get(cacheKey)) || '',
          user: this.getUserId(message.author.id, message.guild?.id),
        },
        {
          cacheKey,
          onPing: async () => {
            await message.channel.sendTyping().catch(console.error);
          },
          handleChatflowAnswer: (chatflowMessages, files) => {
            if (chatflowMessages.length > 0) {
              this.sendChatAnswer(message, chatflowMessages, files);
            }
          },
        },
      );

      this.sendChatAnswer(message, messages, files);
    } catch (error) {
      console.error('Error sending message to Dify:', error);
      await message.reply(
        'Sorry, something went wrong while generating the answer.',
      );
    }
  }

  private sendChatAnswer(
    message: Message,
    messages: string[],
    files?: DifyFile[],
  ) {
    for (const [index, m] of messages.entries()) {
      if (m.length === 0) continue;

      const replyOptions = {
        content: m,
        files: files?.map((f) => ({
          attachment: f.url,
          name: f.extension
            ? `generated_${f.type}.${f.extension}`
            : `generated_${f.type}`,
        })),
      };

      try {
        if (index === 0) {
          message.reply(replyOptions);
        } else {
          message.reply(m);
        }
      } catch (error) {
        console.error('Error sending chat answer:', error);
      }
    }
  }

  private async generateAnswer(
    reqiest: ChatMessageRequest,
    {
      cacheKey,
      onPing,
      handleChatflowAnswer,
    }: {
      cacheKey: string;
      onPing?: () => void;
      handleChatflowAnswer?: (
        messages: string[],
        files?: Array<VisionFile & { thought?: ThoughtItem }>,
      ) => void;
    },
  ): Promise<{
    messages: string[];
    files: Array<VisionFile & { thought?: ThoughtItem }>;
  }> {
    if (reqiest.query.length === 0)
      return Promise.resolve({ messages: [], files: [] });
    return new Promise(async (resolve, reject) => {
      try {
        let buffer = { defaultAnswer: '', chatflowAnswer: '' };
        let files: VisionFile[] = [];
        let fileGenerationThought: ThoughtItem[] = [];
        let bufferType = 'defaultMessage';
        await this.difyClient.streamChatMessage(reqiest, {
          onMessage: async (answer, isFirstMessage, { conversationId }) => {
            switch (bufferType) {
              case 'defaultMessage':
                buffer.defaultAnswer += answer;
                break;
              case 'chatflowAnswer':
                buffer.chatflowAnswer += answer;
                break;
            }

            if (cacheKey) {
              conversationCache.set(cacheKey, conversationId);
            }
          },
          onFile: async (file: DifyFile) => {
            files.push(file);
          },
          onThought: async (thought) => {
            fileGenerationThought.push(thought);
          },
          onNodeStarted: async (nodeStarted) => {
            switch (nodeStarted.data.node_type) {
              case 'llm':
                bufferType = 'chatflowAnswer';
                onPing?.();
                break;
              case 'tool':
                onPing?.();
                break;
            }
          },
          onNodeFinished: async (nodeFinished) => {
            switch (nodeFinished.data.node_type) {
              case 'answer':
                bufferType = 'defaultMessage';
                handleChatflowAnswer?.(
                  this.splitMessage(buffer.chatflowAnswer, {
                    maxLength: this.MAX_MESSAGE_LENGTH,
                  }),
                  files,
                );
                files = [];
                buffer.chatflowAnswer = '';
                break;
              case 'tool':
                if (
                  nodeFinished.data.title.includes('DALL-E') &&
                  nodeFinished.data?.outputs?.files?.length > 0
                ) {
                  for (let file of nodeFinished.data.outputs.files!) {
                    files.push(file);
                  }
                }
                break;
            }
          },
          onCompleted: () => {
            resolve({
              messages: this.splitMessage(
                [buffer.chatflowAnswer, buffer.defaultAnswer]
                  .filter(Boolean)
                  .join('\n\n'),
                {
                  maxLength: this.MAX_MESSAGE_LENGTH,
                },
              ),
              files: files.map((file) => ({
                ...file,
                thought: fileGenerationThought.find(
                  (t) => file.id && t.message_files?.includes(file.id),
                ),
              })) as any,
            });
          },
          onPing,
        });
      } catch (error: any) {
        reject(error);
      }
    });
  }

  private getCacheKey(
    userId: string | undefined,
    channelId: string | undefined,
  ): string {
    switch (this.HISTORY_MODE) {
      case 'user':
        return userId || '';
      case 'channel':
        return channelId || '';
      default:
        return '';
    }
  }

  private getUserId(userId: string | undefined, serverId: string | undefined) {
    switch (this.HISTORY_MODE) {
      case 'user':
        return userId || '';
      case 'channel':
        return serverId || '';
      default:
        return '';
    }
  }

  splitMessage(
    message: string,
    options: {
      maxLength?: number;
      char?: string;
      prepend?: string;
      append?: string;
    } = {},
  ): string[] {
    const {
      maxLength = 2000,
      char = '\n',
      prepend = '',
      append = '',
    } = options;
    if (message.length <= maxLength) return [message];
    const splitText = message.split(char);
    if (splitText.some((part) => part.length > maxLength))
      throw new RangeError('SPLIT_MAX_LEN');
    const messages = [''];
    for (let part of splitText) {
      if (messages[messages.length - 1].length + part.length + 1 > maxLength) {
        messages[messages.length - 1] += append;
        messages.push(prepend);
      }
      messages[messages.length - 1] +=
        (messages[messages.length - 1].length > 0 &&
        messages[messages.length - 1] !== prepend
          ? char
          : '') + part;
    }
    return messages;
  }
}

export default DiscordBot;
