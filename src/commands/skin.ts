import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import axios from 'axios';

export const skinCommand = {
    data: new SlashCommandBuilder()
        .setName('skin')
        .setDescription('Fetches the skin of a Minecraft player')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('The Minecraft username to fetch')
                .setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
        const username = interaction.options.getString('username', true);
        await interaction.deferReply();

        try {
            // Fetch UUID from Mojang
            const mojangResponse = await axios.get(`https://api.mojang.com/users/profiles/minecraft/${username}`);
            
            if (mojangResponse.status === 204 || !mojangResponse.data) {
                return interaction.editReply(`Could not find a Minecraft player named **${username}**.`);
            }

            const { id: uuid, name: officialName } = mojangResponse.data;

            // Construction of URLs
            const crafatarBody = `https://crafatar.com/renders/body/${uuid}?overlay`;
            const crafatarAvatar = `https://crafatar.com/avatars/${uuid}?overlay`;
            const skinDownload = `https://crafatar.com/skins/${uuid}`;
            const minotarBody = `https://minotar.net/armor/body/${uuid}/100.png`;

            const embed = new EmbedBuilder()
                .setTitle(`${officialName}'s Minecraft Skin`)
                .setColor(0x00AE86)
                .setImage(crafatarBody)
                .setThumbnail(crafatarAvatar)
                .addFields(
                    { name: 'Download', value: `[Click here to download](${skinDownload})`, inline: true },
                    { name: 'UUID', value: `\`${uuid}\``, inline: true }
                )
                .setFooter({ text: 'Powered by Crafatar & Minotar' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error: any) {
            console.error('Error fetching skin:', error.message);
            if (error.response && error.response.status === 404) {
                 await interaction.editReply(`Player **${username}** not found.`);
            } else {
                 await interaction.editReply('An error occurred while fetching the skin. Please try again later.');
            }
        }
    },
};
