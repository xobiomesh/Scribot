require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const token = process.env.DISCORD_BOT_TOKEN;

client.once('ready', () => {
    console.log('Bot is online!');
});

client.on('messageCreate', async message => {
    if (message.content === '!fetch') {
        const channel = message.channel;
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
        message.channel.send('Fetched and saved all messages to channel_messages.txt');
    }
});

client.login(token);
