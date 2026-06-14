require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const token = process.env.TOKEN;
console.log('Token length:', token?.length);
console.log('Token starts with:', token?.substring(0, 20));

client.once('ready', () => {
  console.log('✅ Bot connected successfully!');
  process.exit(0);
});

client.on('error', (error) => {
  console.error('Error:', error.message);
  process.exit(1);
});

client.login(token);