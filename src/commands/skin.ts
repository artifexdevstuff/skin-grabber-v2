import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType 
} from 'discord.js';
import axios from 'axios';
import { getProviderStatus } from '../services/providerHealth.js';

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
            // 1. Health Check
            const status = await getProviderStatus();
            if (!status.crafatar && !status.minotar) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('Service Unavailable')
                    .setColor(0xFF0000)
                    .setDescription('All skin render providers (Crafatar & Minotar) are currently offline. Please try again later.')
                    .setTimestamp();
                return interaction.editReply({ embeds: [errorEmbed] });
            }

            // 2. Fetch UUID from Mojang
            const mojangResponse = await axios.get(`https://api.mojang.com/users/profiles/minecraft/${username}`);
            
            if (mojangResponse.status === 204 || !mojangResponse.data) {
                return interaction.editReply(`Could not find a Minecraft player named **${username}**.`);
            }

            const { id: uuid, name: officialName } = mojangResponse.data;

            // 3. Define Renders
            // Crafatar is used only for 3D renders (Body/Bust)
            // Minotar is used for the Cube head and Skin file
            const renderUrls = {
                'body': { url: `https://crafatar.com/renders/body/${uuid}?overlay`, provider: 'crafatar' },
                'bust': { url: `https://crafatar.com/renders/head/${uuid}?overlay`, provider: 'crafatar' },
                'head': { url: `https://minotar.net/cube/${uuid}/100.png`, provider: 'minotar' },
                'skin': { url: `https://minotar.net/skin/${uuid}`, provider: 'minotar' }
            };

            const getProviderIndicator = () => {
                return [
                    `${status.crafatar ? '🟢' : '🔴'} Crafatar ${status.crafatar ? 'Online' : 'Offline'}`,
                    `${status.minotar ? '🟢' : '🔴'} Minotar ${status.minotar ? 'Online' : 'Offline'}`
                ].join('\n');
            };

            const createEmbed = (type: keyof typeof renderUrls) => {
                return new EmbedBuilder()
                    .setTitle(`${officialName}'s Minecraft Skin`)
                    .setColor(0x00AE86)
                    .setImage(renderUrls[type].url)
                    .setThumbnail(`https://crafatar.com/avatars/${uuid}?overlay`)
                    .addFields(
                        { name: 'UUID', value: `\`${uuid}\``, inline: true },
                        { name: 'Download', value: `[Click here to download](${renderUrls['skin'].url})`, inline: true },
                        { name: 'Render Provider Status', value: getProviderIndicator(), inline: false }
                    )
                    .setFooter({ text: `Viewing: ${type.charAt(0).toUpperCase() + type.slice(1)}` })
                    .setTimestamp();
            };

            const createButtons = (currentType: string) => {
                const row = new ActionRowBuilder<ButtonBuilder>();
                
                const buttons = [
                    { id: 'body', label: 'Full Body', provider: 'crafatar' },
                    { id: 'bust', label: 'Bust', provider: 'crafatar' },
                    { id: 'head', label: 'Head', provider: 'minotar' },
                    { id: 'skin', label: 'Skin', provider: 'minotar' }
                ];

                buttons.forEach(btn => {
                    const isProviderOnline = btn.provider === 'crafatar' ? status.crafatar : status.minotar;
                    const button = new ButtonBuilder()
                        .setCustomId(btn.id)
                        .setLabel(btn.label)
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(!isProviderOnline || btn.id === currentType);
                    row.addComponents(button);
                });

                return row;
            };

            // 4. Send Initial Message
            const initialType: keyof typeof renderUrls = status.crafatar ? 'body' : 'head';
            const message = await interaction.editReply({
                embeds: [createEmbed(initialType)],
                components: [createButtons(initialType)]
            });

            // 5. Interaction Collector
            const collector = message.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 300000 // 5 minutes
            });

            collector.on('collect', async (i) => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: 'You cannot control another user\'s render session.', ephemeral: true });
                }

                const selectedType = i.customId as keyof typeof renderUrls;
                
                try {
                    await i.update({
                        embeds: [createEmbed(selectedType)],
                        components: [createButtons(selectedType)]
                    });
                } catch (err) {
                    console.error('Update failure:', err);
                }
            });

            collector.on('end', () => {
                interaction.editReply({ components: [] }).catch(() => {});
            });

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
