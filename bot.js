require('dotenv').config();
const { Client, GatewayIntentBits, Events, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { joinVoiceChannel, getVoiceConnection, VoiceReceiver, EndBehaviorType, VoiceConnectionStatus } = require('@discordjs/voice');
const prism = require('prism-media');
const ffmpeg = require('fluent-ffmpeg');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates] });

let currentConnection = null;
let currentReceiver = null;
let recordingStreams = {};

client.once(Events.ClientReady, () => {
    console.log('Bot is online!');
});

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
    const filePath = path.join(__dirname, 'channel_messages', fileName);

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

// Function to join a voice channel and start recording
const joinAndRecord = async (interaction) => {
    const channel = interaction.member.voice.channel;

    if (!channel) {
        return interaction.reply('You need to join a voice channel first!');
    }

    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: false,
    });

    currentConnection = connection;

    connection.on(VoiceConnectionStatus.Ready, () => {
        console.log('The bot has connected to the channel!');
        const receiver = connection.receiver;
        currentReceiver = receiver;

        const voiceChannelDir = path.join(__dirname, 'channel_messages', channel.name);
        if (!fs.existsSync(voiceChannelDir)) {
            fs.mkdirSync(voiceChannelDir, { recursive: true });
        }

        receiver.speaking.on('start', (userId) => {
            const user = client.users.cache.get(userId);
            console.log(`I'm listening to ${user.username}`);

            if (!recordingStreams[userId]) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const pcmPath = path.join(voiceChannelDir, `${user.username}-${timestamp}.pcm`);
                const out = fs.createWriteStream(pcmPath);

                const pcmStream = new prism.opus.Decoder({
                    frameSize: 960,
                    channels: 2,
                    rate: 48000,
                });

                recordingStreams[userId] = {
                    stream: pcmStream,
                    path: pcmPath,
                    out: out,
                    mp3Path: path.join(voiceChannelDir, `${user.username}-${timestamp}.mp3`)
                };

                const opusStream = receiver.subscribe(userId);
                opusStream.pipe(pcmStream).pipe(out);

                out.on('finish', () => {
                    console.log(`Finished recording ${user.username}`);

                    const { path: pcmPath, mp3Path } = recordingStreams[userId];
                    console.log(`Starting conversion for ${user.username}`);
                    ffmpeg(pcmPath)
                        .inputFormat('s16le')  // Set the input format
                        .audioChannels(2)      // Set the number of audio channels
                        .audioFrequency(48000) // Set the sample rate
                        .audioBitrate(128)
                        .save(mp3Path)
                        .on('start', (commandLine) => {
                            console.log(`Spawned ffmpeg with command: ${commandLine}`);
                        })
                        .on('progress', (progress) => {
                            console.log(`Processing: ${progress.percent}% done`);
                        })
                        .on('end', () => {
                            console.log(`Converted ${user.username}'s recording to MP3`);
                            fs.unlinkSync(pcmPath);
                            delete recordingStreams[userId];
                        })
                        .on('error', (err) => {
                            console.error(`Error converting ${user.username}'s recording: ${err.message}`);
                        });
                });

                out.on('error', (err) => {
                    console.error(`Error writing PCM file for ${user.username}: ${err.message}`);
                });

                pcmStream.on('error', (err) => {
                    console.error(`Error decoding OPUS stream for ${user.username}: ${err.message}`);
                });

                opusStream.on('error', (err) => {
                    console.error(`Error with OPUS stream for ${user.username}: ${err.message}`);
                });
            }
        });
    });

    await interaction.reply(`Started recording in the voice channel ${channel.name}!`);
};

// Function to stop recording and leave the voice channel
const stopRecording = async (interaction) => {
    const channel = interaction.member.voice.channel;

    if (!channel) {
        return interaction.reply('You need to join a voice channel first!');
    }

    const connection = getVoiceConnection(channel.guild.id);

    if (connection) {
        for (const userId in recordingStreams) {
            recordingStreams[userId].out.end();
        }
        connection.destroy();
        currentReceiver = null;
        recordingStreams = {};
        await interaction.reply(`Stopped recording and left the voice channel ${channel.name}.`);
    } else {
        await interaction.reply(`The bot is not in a voice channel.`);
    }
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
        helpMessage += '`/record`: Joins the voice channel and starts recording\n';
        helpMessage += '`/stoprecord`: Stops recording and leaves the voice channel\n';
        await interaction.reply(helpMessage);
    } else if (commandName === 'fetch') {
        const channel = interaction.channel;
        await fetchMessagesFromChannel(channel);
        await interaction.reply(`Fetched and saved all messages from ${channel.name} to channel_messages/${channel.name}.md`);
    } else if (commandName === 'fetchall') {
        await interaction.deferReply();

        const guild = interaction.guild;
        const channels = guild.channels.cache.filter(channel => channel.type === ChannelType.GuildText);

        for (const channel of channels.values()) {
            await fetchMessagesFromChannel(channel);
        }

        await interaction.followUp('Fetched and saved all messages from all channels.');
    } else if (commandName === 'record') {
        await joinAndRecord(interaction);
    } else if (commandName === 'stoprecord') {
        await stopRecording(interaction);
    }
});

client.on(Events.MessageCreate, message => {
    if (!message.author.bot) {
        const channel = message.channel;
        const fileName = `${channel.name}.md`;
        const filePath = path.join(__dirname, 'channel_messages', fileName);

        const logMessage = formatMessage(message) + '\n';
        fs.appendFileSync(filePath, logMessage);
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);
