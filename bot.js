require('dotenv').config();
const { Client, GatewayIntentBits, Events, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.once(Events.ClientReady, () => {
    console.log('Bot is online!');
});

// Ensure the subdirectory exists
const messagesDir = path.join(__dirname, 'channel_messages');
if (!fs.existsSync(messagesDir)) {
    fs.mkdirSync(messagesDir);
}

// Function to format a message for logging
const formatMessage = (msg) => {
    let formattedMessage = `${msg.createdAt.toISOString()} - ${msg.author.username}: ${msg.content}`;
    if (msg.attachments.size > 0) {
        msg.attachments.forEach(attachment => {
            formattedMessage += ` [Attachment: ${attachment.url}]`;
        });
    }
    return formattedMessage;
};

// Function to fetch messages from a specific channel and save them to a file
const fetchMessagesFromChannel = async (channel) => {
    const fileName = `${channel.name}.md`;
    const filePath = path.join(messagesDir, fileName);
    
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

    const content = messages.reverse().map(formatMessage).join('\n');
    fs.writeFileSync(filePath, content);
};

// Handle slash commands
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'help') {
        const helpMessage = 'Here are the available commands:\n';
        helpMessage += '`/help`: Displays this help message\n';
        helpMessage += '`/fetch`: Fetches all messages from the current channel and saves them to a file\n';
        helpMessage += '`/fetchall`: Fetches all messages from all channels and saves them to their respective files\n';
        await interaction.reply(helpMessage);
    } else if (commandName === 'fetch') {
        const channel = interaction.channel;
        await fetchMessagesFromChannel(channel);
        await interaction.reply(`Fetched and saved all messages from ${channel.name} to channel_messages/${channel.name}.md`);
    } else if (commandName === 'fetchall') {
        await interaction.deferReply(); // Acknowledge the interaction immediately

        const guild = interaction.guild;
        const channels = guild.channels.cache.filter(channel => channel.type === ChannelType.GuildText);

        for (const channel of channels.values()) {
            await fetchMessagesFromChannel(channel);
        }

        await interaction.followUp('Fetched and saved all messages from all channels.');
    }
});

// Automatically append new messages to the file
client.on(Events.MessageCreate, message => {
    if (!message.author.bot) { // Ignore messages from bots
        const channel = message.channel;
        const fileName = `${channel.name}.md`;
        const filePath = path.join(messagesDir, fileName);

        const logMessage = formatMessage(message) + '\n';
        fs.appendFileSync(filePath, logMessage);
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);
