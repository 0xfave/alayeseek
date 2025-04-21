import { Bot } from 'grammy';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required environment variables
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const VYBE_API_KEY = process.env.VYBE_API_KEY;

if (!TELEGRAM_TOKEN) {
  console.error('Error: TELEGRAM_TOKEN is not set in the environment variables');
  process.exit(1);
}

if (!VYBE_API_KEY) {
  console.error('Error: VYBE_API_KEY is not set in the environment variables');
  process.exit(1);
}

// Initialize the bot with the token from environment variables
const bot = new Bot(TELEGRAM_TOKEN);

// Start command handler
bot.command("start", (ctx) => {
  const welcomeMessage = `🚀 *Welcome to Alayeseke!* 🚀

📊 Your personal Solana portfolio assistant that helps you track:

*Portfolio Commands:*
• */pnl* - Check wallet profit and loss
• */report* - Get detailed wallet report
• */nfts* - View NFT portfolio
• */token_history* - View token balance history

*Token Commands:*
• */top_holders* - View top holders of a token
• */price* - Check token price with OHLC data
• */transfers* - View recent token transfers
• */trades* - View recent token trades

*Program & Market Commands:*
• */program* - Get program details
• */program_activity* - Check program activity
• */market* - Check market OHLC data
• */pair* - Check trading pair data

*Other Commands:*
• */holder_portfolio* - Examine a specific holder's portfolio
• */help* - Show this help message

Simply use any command with your wallet address to get started!

Powered by Vybe API 💎`;
  
  return ctx.reply(welcomeMessage, { parse_mode: "Markdown" });
});

// Help command handler - displays the same message as start
bot.command("help", (ctx) => {
  const helpMessage = `🚀 *Welcome to Alayeseke!* 🚀

📊 Your personal Solana portfolio assistant that helps you track:

*Portfolio Commands:*
• */pnl* - Check wallet profit and loss
• */report* - Get detailed wallet report
• */nfts* - View NFT portfolio
• */token_history* - View token balance history

*Token Commands:*
• */top_holders* - View top holders of a token
• */price* - Check token price with OHLC data
• */transfers* - View recent token transfers
• */trades* - View recent token trades

*Program & Market Commands:*
• */program* - Get program details
• */program_activity* - Check program activity
• */market* - Check market OHLC data
• */pair* - Check trading pair data

*Other Commands:*
• */holder_portfolio* - Examine a specific holder's portfolio
• */help* - Show this help message

Simply use any command with your wallet address to get started!

Powered by Vybe API 💎`;
  
  return ctx.reply(helpMessage, { parse_mode: "Markdown" });
});

// Start the bot
bot.start();

console.log('Alayeseke bot is running!');
console.log('Bot is using Vybe API with authenticated key');
