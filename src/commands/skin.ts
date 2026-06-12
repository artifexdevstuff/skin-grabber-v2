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
            // Minotar for 2D, Crafatar for 3D
            const renderUrls = {
                'body': { url: `https://minotar.net/body/${uuid}/100.png`, provider: 'minotar' },
                'bust': { url: `https://minotar.net/bust/${uuid}/100.png`, provider: 'minotar' },
                'head': { url: `https://minotar.net/cube/${uuid}/100.png`, provider: 'minotar' },
                'skin': { url: `https://minotar.net/skin/${uuid}`, provider: 'minotar' },
                'body_3d': { url: `https://crafatar.com/renders/body/${uuid}?overlay`, provider: 'crafatar' },
                'bust_3d': { url: `https://crafatar.com/renders/head/${uuid}?overlay`, provider: 'crafatar' }
            };

            const getProviderIndicator = () => {
                return [
                    `${status.crafatar ? '🟢' : '🔴'} Crafatar ${status.crafatar ? 'Online' : 'Offline'}`,
                    `${status.minotar ? '🟢' : '🔴'} Minotar ${status.minotar ? 'Online' : 'Offline'}`
                ].join('\n');
            };

            const createEmbed = (type: keyof typeof renderUrls) => {
                const labels: Record<string, string> = {
                    body: 'Full Body (2D)',
                    bust: 'Bust (2D)',
                    head: 'Head (Cube)',
                    skin: 'Raw Skin',
                    body_3d: 'Full Body (3D)',
                    bust_3d: 'Bust (3D)'
                };

                return new EmbedBuilder()
                    .setTitle(`${officialName}'s Minecraft Skin`)
                    .setColor(0x00AE86)
                    .setImage(renderUrls[type].url)
                    .addFields(
                        { name: 'UUID', value: `\`${uuid}\``, inline: true },
                        { name: 'Download', value: `[Click here to download](${renderUrls['skin'].url})`, inline: false },
                        { name: 'API Status', value: getProviderIndicator(), inline: false }
                    )
                    .setFooter({ text: `Viewing: ${labels[type]}` })
                    .setTimestamp();
            };

            const createComponents = (currentType: string) => {
                const row1 = new ActionRowBuilder<ButtonBuilder>();
                const row2 = new ActionRowBuilder<ButtonBuilder>();
                
                const buttonsRow1 = [
                    { id: 'body', label: 'Full Body', provider: 'minotar' },
                    { id: 'bust', label: 'Bust', provider: 'minotar' },
                    { id: 'head', label: 'Head', provider: 'minotar' },
                    { id: 'skin', label: 'Skin', provider: 'minotar' }
                ];

                const buttonsRow2 = [
                    { id: 'body_3d', label: '3D Body', provider: 'crafatar' },
                    { id: 'bust_3d', label: '3D Bust', provider: 'crafatar' }
                ];

                buttonsRow1.forEach(btn => {
                    const isProviderOnline = status.minotar; // Simplified since all are minotar
                    const button = new ButtonBuilder()
                        .setCustomId(btn.id)
                        .setLabel(btn.label)
                        .setStyle(!isProviderOnline ? ButtonStyle.Danger : ButtonStyle.Primary)
                        .setDisabled(!isProviderOnline || btn.id === currentType);
                    row1.addComponents(button);
                });

                buttonsRow2.forEach(btn => {
                    const isProviderOnline = status.crafatar;
                    const button = new ButtonBuilder()
                        .setCustomId(btn.id)
                        .setLabel(btn.label)
                        .setStyle(!isProviderOnline ? ButtonStyle.Danger : ButtonStyle.Primary)
                        .setDisabled(!isProviderOnline || btn.id === currentType);
                    row2.addComponents(button);
                });

                return [row1, row2];
            };

            // 4. Send Initial Message
            const initialType: keyof typeof renderUrls = status.crafatar ? 'body_3d' : 'body';
            const message = await interaction.editReply({
                embeds: [createEmbed(initialType)],
                components: createComponents(initialType)
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
                        components: createComponents(selectedType)
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
