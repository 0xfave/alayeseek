import { Bot } from 'grammy';
import dotenv from 'dotenv';
import vybeAPI from '@api/vybe-api';

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

// PnL command handler
bot.command("pnl", async (ctx) => {
  // Get the wallet address from the message text
  const messageText = ctx.message?.text?.trim() || '';
  const args = messageText.split(' ').filter(Boolean).slice(1);
  const walletAddress = args[0];

  // Check if wallet address was provided
  if (!walletAddress) {
    return ctx.reply('Please provide a wallet address. Usage: /pnl <wallet_address> [resolution]');
  }

  // Get optional resolution (1d, 7d, 30d)
  const resolution = (args[1] && ['1d', '7d', '30d'].includes(args[1]) ? args[1] : '1d') as '1d' | '7d' | '30d';
  
  // Set the API key
  vybeAPI.auth(VYBE_API_KEY);
  
  try {
    // Notify user that we're fetching data
    await ctx.reply(`Fetching PnL data for wallet: \`${walletAddress}\` with ${resolution} resolution...`, { parse_mode: "Markdown" });
    
    // Call the Vybe API to get wallet PnL data
    const response = await vybeAPI.get_wallet_pnl({
      ownerAddress: walletAddress,
      resolution: resolution
    });
    
    const pnlData = response.data;
    const summary = pnlData.summary;
    
    // Format the response
    const formattedResponse = `💰 *PnL Summary for ${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}*\n\n`+
      `📊 *Overall Performance*\n`+
      `🔹 Realized PnL: $${summary.realizedPnlUsd.toFixed(2)}\n`+
      `🔹 Unrealized PnL: $${summary.unrealizedPnlUsd.toFixed(2)}\n`+
      `🔹 Total PnL: $${(summary.realizedPnlUsd + summary.unrealizedPnlUsd).toFixed(2)}\n`+
      `🔹 Win Rate: ${summary.winRate.toFixed(2)}%\n\n`+
      
      `🧮 *Trading Activity*\n`+
      `🔹 Trades: ${summary.tradesCount} (${summary.winningTradesCount} W / ${summary.losingTradesCount} L)\n`+
      `🔹 Total Volume: $${summary.tradesVolumeUsd.toFixed(2)}\n`+
      `🔹 Unique Tokens: ${summary.uniqueTokensTraded}\n`+
      `🔹 Avg Trade Size: $${summary.averageTradeUsd.toFixed(2)}\n\n`+
      
      `🏆 *Best Performing Token*\n`+
      `🔹 ${summary.bestPerformingToken?.tokenSymbol || 'Unknown'}: $${summary.bestPerformingToken?.pnlUsd?.toFixed(2) || '0.00'}\n\n`+
      
      `📉 *Worst Performing Token*\n`+
      `🔹 ${summary.worstPerformingToken?.tokenSymbol || 'Unknown'}: $${summary.worstPerformingToken?.pnlUsd?.toFixed(2) || '0.00'}\n\n`+
      
      `⚡ Top 3 Token Metrics:\n`;
      
    // Add top 3 token metrics if available
    if (pnlData.tokenMetrics && pnlData.tokenMetrics.length > 0) {
      // Sort by total PnL (realized + unrealized)
      const sortedTokens = [...pnlData.tokenMetrics]
        .sort((a, b) => (b.realizedPnlUsd + b.unrealizedPnlUsd) - (a.realizedPnlUsd + a.unrealizedPnlUsd))
        .slice(0, 3);
        
      // Build the top tokens section
      let topTokensText = '';
      sortedTokens.forEach((token, index) => {
        const totalPnl = token.realizedPnlUsd + token.unrealizedPnlUsd;
        topTokensText += `${index + 1}. ${token.tokenSymbol || token.tokenAddress.substring(0, 6)}: $${totalPnl.toFixed(2)} `+
                        `(Buy Vol: $${token.buys.volumeUsd.toFixed(2)}, Sell Vol: $${token.sells.volumeUsd.toFixed(2)})
`;
      });
      
      // Send the complete response
      return ctx.reply(formattedResponse + topTokensText, { parse_mode: "Markdown" });
    } else {
      return ctx.reply(formattedResponse + "No token metrics available.", { parse_mode: "Markdown" });
    }
    
  } catch (error: any) {
    console.error('Error fetching PnL data:', error);
    let errorMessage = 'Failed to fetch PnL data.';
    
    // Provide more specific error messages
    if (error.response) {
      if (error.response.status === 400) {
        errorMessage = 'Invalid wallet address. Please check and try again.';
      } else if (error.response.status === 403) {
        errorMessage = 'API access forbidden. Authentication may be required.';
      } else if (error.response.status === 500) {
        errorMessage = 'Server error occurred. Please try again later.';
      }
    }
    
    return ctx.reply(errorMessage);
  }
});

// Start the bot
bot.start();

console.log('Alayeseke bot is running!');
console.log('Bot is using Vybe API with authenticated key');
