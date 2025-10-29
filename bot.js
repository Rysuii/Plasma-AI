const { Client, GatewayIntentBits } = require('discord.js');
const Anthropic = require('@anthropic-ai/sdk');

// Initialize Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// Store conversation history per channel
const conversationHistory = new Map();

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
    // Ignore messages from bots
    if (message.author.bot) return;

    // Only respond when mentioned or in DMs
    if (!message.mentions.has(client.user) && message.channel.type !== 1) return;

    // Remove bot mention from message
    const userMessage = message.content.replace(/<@!?\d+>/g, '').trim();
    
    if (!userMessage) return;

    try {
        // Show typing indicator
        await message.channel.sendTyping();

        // Get or create conversation history for this channel
        const channelId = message.channel.id;
        if (!conversationHistory.has(channelId)) {
            conversationHistory.set(channelId, []);
        }
        const history = conversationHistory.get(channelId);

        // Add user message to history
        history.push({
            role: 'user',
            content: userMessage
        });

        // Keep only last 10 messages to avoid token limits
        if (history.length > 10) {
            history.splice(0, history.length - 10);
        }

        // Call Claude API
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 1024,
            messages: history
        });

        const assistantMessage = response.content[0].text;

        // Add assistant response to history
        history.push({
            role: 'assistant',
            content: assistantMessage
        });

        // Split long messages (Discord has 2000 char limit)
        if (assistantMessage.length > 2000) {
            const chunks = assistantMessage.match(/[\s\S]{1,2000}/g);
            for (const chunk of chunks) {
                await message.reply(chunk);
            }
        } else {
            await message.reply(assistantMessage);
        }

    } catch (error) {
        console.error('Error:', error);
        await message.reply('Sorry, I encountered an error processing your request.');
    }
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);
