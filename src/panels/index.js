const { CHANNELS } = require('../config/constants');
const EmbedService = require('../utils/embeds');

async function initializePanels(client) {
  const panels = [
    {
      channelId: CHANNELS.UCP_PANEL,
      create: async (channel) => {
        const embed = EmbedService.create({
          title: 'User Control Panel',
          description: 'Manage your account settings and preferences from this central hub.\n\n' +
                     '**Available Actions:**\n' +
                     '• **Register** - Create a new account\n' +
                     '• **My Account** - View profile information\n' +
                     '• **Reset Password** - Request password reset\n' +
                     '• **Resend Code** - Request verification code\n\n' +
                     'Need assistance? Contact our support team.',
          color: '#0099FF'
        });
        
        const row1 = {
          type: 1,
          components: [
            { type: 2, customId: 'ucp_register', label: 'Register', style: 3, emoji: { name: '📝' } },
            { type: 2, customId: 'ucp_myaccount', label: 'My Account', style: 1, emoji: { name: '👤' } },
            { type: 2, customId: 'ucp_resetpass', label: 'Reset Password', style: 2, emoji: { name: '🔑' } }
          ]
        };
        
        const row2 = {
          type: 1,
          components: [
            { type: 2, customId: 'ucp_resendcode', label: 'Resend Code', style: 2, emoji: { name: '🔄' } }
          ]
        };
        
        await channel.send({ embeds: [embed], components: [row1, row2] });
      }
    },
    {
      channelId: CHANNELS.CHARACTER_PANEL,
      create: async (channel) => {
        const embed = EmbedService.create({
          title: 'Character Management',
          description: 'Manage your game characters efficiently.\n\n' +
                     '**Available Actions:**\n' +
                     '• **View Characters** - Browse all your characters\n' +
                     '• **Statistics** - Review character stats\n' +
                     '• **Delete Character** - Remove a character (cooldown applies)\n\n' +
                     'Changes are automatically saved to your profile.',
          color: '#FFA500'
        });
        
        const row = {
          type: 1,
          components: [
            { type: 2, customId: 'char_list', label: 'View Characters', style: 1, emoji: { name: '📋' } },
            { type: 2, customId: 'char_stats', label: 'Statistics', style: 1, emoji: { name: '📊' } },
            { type: 2, customId: 'char_delete', label: 'Delete Character', style: 4, emoji: { name: '🗑️' } }
          ]
        };
        
        await channel.send({ embeds: [embed], components: [row] });
      }
    }
  ];
  
  for (const panel of panels) {
    const channel = client.channels.cache.get(panel.channelId);
    if (channel && channel.isTextBased()) {
      const messages = await channel.messages.fetch({ limit: 5 }).catch(() => null);
      const hasBotMessage = messages?.some(msg => msg.author.id === client.user.id);
      
      if (!hasBotMessage) {
        await panel.create(channel);
      }
    }
  }
}

module.exports = { initializePanels };