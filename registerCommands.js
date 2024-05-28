require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const { SlashCommandBuilder } = require('@discordjs/builders');

const commands = [
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Displays this help message'),
    new SlashCommandBuilder()
        .setName('fetch')
        .setDescription('Fetches all messages from the channel and saves them to a file'),
    new SlashCommandBuilder()
        .setName('fetchall')
        .setDescription('Fetches all messages from all channels and saves them to their respective files'),
    new SlashCommandBuilder()
        .setName('record')
        .setDescription('Joins the voice channel and starts recording'),
    new SlashCommandBuilder()
        .setName('stoprecord')
        .setDescription('Stops recording and leaves the voice channel')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();
