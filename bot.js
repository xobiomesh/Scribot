require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const fs = require('fs');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.once(Events.ClientReady, () => {
    console.log('Bot is online!');
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'help') {
        const helpMessage = 'Here are the available commands:\n';
        helpMessage += '`/help`: Displays this help message\n';
        helpMessage += '`/fetch`: Fetches all messages from the channel and saves them to a file\n';
        await interaction.reply(helpMessage);
    } else if (commandName === 'fetch') {
        const channel = interaction.channel;
        let messages = [];
        let lastMessageId;

        while (true) {
            const fetchedMessages = await channel.messages.fetch({ limit: 100, before: lastMessageId });
            messages = messages.concat(Array.from(fetchedMessages.values()));
            lastMessageId = fetchedMessages.last()?.id;

            if (fetchedMessages.size < 100) {
                break;
            }
        }

        const content = messages.reverse().map(msg => `${msg.createdAt.toISOString()} - ${msg.author.username}: ${msg.content}`).join('\n');
        fs.writeFileSync('channel_messages.txt', content);
        await interaction.reply('Fetched and saved all messages to channel_messages.txt');
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);
