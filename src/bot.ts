import { Bot } from "grammy";
import * as dotenv from "dotenv";
import vybeApi, { GetWalletTokensResponse200 } from "@api/vybe-api";
import { GetWalletPnlResponse200 } from '@api/vybe-api';

// Define additional API response types
interface NFTData {
  name?: string;
  collectionName?: string;
  floorPriceUsd?: string;
}

interface NFTBalanceResponse {
  data: NFTData[];
}

interface TokenHistoryEntry {
  timestamp: number;
  totalValueUsd: string;
  tokens: {
    symbol: string;
    valueUsd: string;
  }[];
}

interface TokenHistoryResponse {
  data: TokenHistoryEntry[];
}

interface PriceDataEntry {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface PriceDataResponse {
  data: PriceDataEntry[];
}

interface TokenInfo {
  name: string;
  symbol: string;
}

interface TokenInfoResponse {
  data: TokenInfo;
}

interface ProgramStats {
  transactionCount?: number;
  instructionCount?: number;
  activeUsers?: number;
}

interface ProgramData {
  name?: string;
  description?: string;
  website?: string;
  stats?: ProgramStats;
}

interface ProgramResponse {
  data: ProgramData;
}

interface ActivityEntry {
  timestamp: number;
  activeUsers: number;
}

interface ActivityResponse {
  data: ActivityEntry[];
}

interface TransferData {
  tokenSymbol?: string;
  mintAddress: string;
  senderAddress: string;
  receiverAddress: string;
  amount?: string;
  usdAmount?: string;
  time?: number;
  signature: string;
}

interface TransfersResponse {
  data: TransferData[];
}

interface TradeData {
  baseSymbol?: string;
  quoteSymbol?: string;
  baseMintAddress: string;
  quoteMintAddress: string;
  side: string;
  baseAmount?: string;
  quoteAmount?: string;
  price?: string;
  time?: number;
  signature?: string;
}

interface TradesResponse {
  data: TradeData[];
}

// Suppress TypeScript errors for Vybe API methods by using any type
// This is a pragmatic approach when working with third-party libraries that don't have complete type definitions
const api = vybeApi as any;

dotenv.config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
if (!TELEGRAM_TOKEN) throw new Error("TELEGRAM_TOKEN is not defined");
const VYBE_API_KEY = process.env.VYBE_API_KEY;
if (!VYBE_API_KEY) throw new Error("VYBE_API_KEY is not defined");

console.log("Bot is starting...");

// Create an instance of the `Bot` class and pass your bot token to it.
const bot = new Bot(TELEGRAM_TOKEN); 

api.auth(VYBE_API_KEY);

interface TopHolder {
  rank: number;
  ownerAddress: string;
  ownerName?: string;
  ownerLogoUrl?: string;
  balance: string;
  valueUsd: string;
  percentageOfSupplyHeld: number;
  tokenSymbol?: string;
}

interface Token {
  symbol: string;
  value: number;
}

interface PortfolioSummary {
  solBalance: number;
  totalValueUsd: number;
  topTokens: Token[];
}

interface WalletToken {
  symbol: string;
  name: string;
  amount: string;
  valueUsd: string;
  priceUsd: string;
  logoUrl?: string;
}

interface WalletTokensResponse {
  data: WalletToken[];
  totalTokenValueUsd: string;
  totalTokenValueUsd1dChange: string;
  totalTokenCount: number;
  solBalance: string;
  solValueUsd: string;
}
// Handle the /start command.
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

// Handle the /pnl command
bot.command('pnl', async (ctx) => {
  if (!ctx.message) {
    return ctx.reply('Invalid message format');
  }
  const walletAddress = ctx.message.text.split(' ')[1];
  if (!walletAddress) {
    return ctx.reply('Please provide a Solana wallet address');
  }

  try {
    const report = await generateWalletReport(walletAddress);
    return ctx.reply(report);
  } catch (error) {
    console.error('Error generating PnL report:', error);
    return ctx.reply('Failed to generate PnL report. Please try again later.');
  }
});

bot.command('report', async (ctx) => {
  if (!ctx.message) {
    return ctx.reply('Invalid message format');
  }
  const walletAddress = ctx.message.text.split(' ')[1];
  if (!walletAddress) {
    return ctx.reply('Please provide a Solana wallet address');
  }

  try {
    const report = await generateTokenReport(walletAddress);
    return ctx.reply(report);
  } catch (error) {
    console.error('Error generating token report:', error);
    return ctx.reply('Failed to generate token report. Please try again later.');
  }
});

bot.command('top_holders', async (ctx) => {
  if (!ctx.message) {
    return ctx.reply('Invalid message format');
  }
  const mintAddress = ctx.message.text.split(' ')[1];
  if (!mintAddress) {
    return ctx.reply('Please provide a token mint address');
  }

  try {
    // Get top holders
    const response = await fetchWithRetry(() => 
      vybeApi.get_top_holders({
        limit: 10,
        sortByAsc: 'rank',
        mintAddress
      })
    );

    const holders = response.data.data as TopHolder[];
    if (!holders || holders.length === 0) {
      return ctx.reply('No holders found for this token.');
    }

    // Process holders
    const holdersWithPortfolios: (TopHolder & { portfolio?: PortfolioSummary })[] = [];
    
    for (const holder of holders) {
      try {
        // Get portfolio including SOL balance
        const portfolioResponse = await fetchWithRetry(() => 
          vybeApi.get_wallet_tokens({ 
            ownerAddress: holder.ownerAddress,
            minAssetValue: '0',
            maxAssetValue: '1000000',
            includeNoPriceBalance: true,
            sortByDesc: 'valueUsd'
          })
        );

        const portfolioData = portfolioResponse.data;
        const solBalance = parseFloat(portfolioData.solBalance as string);
        const solValue = parseFloat(portfolioData.solValueUsd as string);

        const portfolioSummary: PortfolioSummary = {
          solBalance,
          totalValueUsd: parseFloat(portfolioData.totalTokenValueUsd) + solValue,
          topTokens: portfolioData.data.slice(0, 3)
            .map(token => ({
              symbol: token.symbol || 'UNKNOWN',
              value: parseFloat(token.valueUsd)
            }))
        };

        holdersWithPortfolios.push({
          ...holder,
          portfolio: portfolioSummary
        });

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error fetching portfolio for ${holder.ownerAddress}:`, error);
        holdersWithPortfolios.push(holder);
      }
    }

    // Format the report (same as before)
    // ...
  } catch (error) {
    console.error('Error in top_holders command:', error);
    await ctx.reply('Failed to fetch top holders. Please try again later.');
  }
});


// Helper function to split long messages
function splitLongMessage(text: string, maxLength = 4096): string[] {
  const parts: string[] = [];
  let currentPart = '';
  
  const lines = text.split('\n');
  for (const line of lines) {
    if (currentPart.length + line.length + 1 > maxLength) {
      parts.push(currentPart);
      currentPart = line;
    } else {
      currentPart += '\n' + line;
    }
  }
  
  if (currentPart) {
    parts.push(currentPart);
  }
  
  return parts;
}

// Add a new command to get portfolio for a specific holder
bot.command('holder_portfolio', async (ctx) => {
  if (!ctx.message) {
    return ctx.reply('Invalid message format');
  }
  
  const [_, holderAddress] = ctx.message.text.split(' ');
  if (!holderAddress) {
    return ctx.reply('Please provide a holder wallet address');
  }

  try {
    const report = await generateHolderPortfolioReport(holderAddress);
    await ctx.reply(report, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error generating holder portfolio:', error);
    await ctx.reply('Failed to generate portfolio report. Please try again later.');
  }
});

async function generateHolderPortfolioReport(walletAddress: string): Promise<string> {
  try {
    // Get tokens including SOL balance
    const tokensResponse = await fetchWithRetry(() =>
      vybeApi.get_wallet_tokens({
        ownerAddress: walletAddress,
        minAssetValue: '0',
        maxAssetValue: '1000000',
        includeNoPriceBalance: true,
        sortByDesc: 'valueUsd'
      })
    );

    const tokensData = tokensResponse.data;
    const solBalance = parseFloat(tokensData.solBalance as string);
    const solValue = parseFloat(tokensData.solValueUsd as string);
    const totalValue = parseFloat(tokensData.totalTokenValueUsd as string) + solValue;

    // Get PnL if available
    let pnlInfo = '';
    try {
      const pnlResponse = await fetchWithRetry(() =>
        vybeApi.get_wallet_pnl({ ownerAddress: walletAddress })
      );
      const pnlData = pnlResponse.data.summary;
      pnlInfo = `
📊 PnL Summary:
  - Win Rate: ${(pnlData.winRate * 100).toFixed(2)}%
  - Realized PnL: $${pnlData.realizedPnlUsd.toFixed(2)}
  - Unrealized PnL: $${pnlData.unrealizedPnlUsd.toFixed(2)}
`;
    } catch (pnlError) {
      console.log('PnL data not available for this wallet');
    }

    // Format top tokens
    const topTokens = tokensData.data.slice(0, 5).map(token => {
      const tokenValue = parseFloat(token.valueUsd);
      return {
        symbol: token.symbol || 'UNKNOWN',
        value: tokenValue,
        percentage: (tokenValue / totalValue * 100)
      };
    });

    const topTokensFormatted = topTokens.map(token => `
  - ${token.symbol}
    Value: $${token.value.toFixed(2)} (${token.percentage.toFixed(1)}%)
`).join('');

    return `
💰 *Portfolio Report for ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}*

💎 Total Value: *$${totalValue.toFixed(2)}*
  - Token Value: $${parseFloat(tokensData.totalTokenValueUsd).toFixed(2)}
  - SOL Value: $${solValue.toFixed(2)} (${solBalance.toFixed(2)} SOL)

📈 24h Change: ${(parseFloat(tokensData.totalTokenValueUsd1dChange) * 100).toFixed(2)}%
🔢 Token Count: ${tokensData.totalTokenCount}

${pnlInfo}

🪙 *Top Tokens:*
${topTokensFormatted}

🔍 For full details, visit [Vybe Explorer](https://explorer.vybenetwork.com/address/${walletAddress})
`;
  } catch (error) {
    console.error('Error generating holder portfolio:', error);
    throw new Error('Failed to generate portfolio report');
  }
}

const MAX_RETRIES = 3;
const INITIAL_TIMEOUT = 1000; // 1 second

// Generic fetchWithRetry function with proper typing
async function fetchWithRetry<T>(
  callback: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> {
  try {
    return await callback();
  } catch (error) {
    if (retries > 0) {
      const timeout = INITIAL_TIMEOUT * (MAX_RETRIES - retries + 1);
      console.log(`Retrying in ${timeout}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, timeout));
      return fetchWithRetry(callback, retries - 1);
    }
    throw error;
  }
}

// Update generateWalletReport with correct typing
export async function generateWalletReport(walletAddress: string): Promise<string> {
  try {
    const response = await fetchWithRetry(() => 
      vybeApi.get_wallet_pnl({ ownerAddress: walletAddress })
    );
    
    // Destructure the data from the response
    const { summary, tokenMetrics } = response.data;
    
    const report = `
📊 Wallet Performance Report for ${walletAddress}

📈 Summary:
  - Win Rate: ${(summary.winRate * 100).toFixed(2)}%
  - Realized PnL: $${summary.realizedPnlUsd.toFixed(2)}
  - Unrealized PnL: $${summary.unrealizedPnlUsd.toFixed(2)}
  - Total Trades: ${summary.tradesCount}
  - Winning Trades: ${summary.winningTradesCount}
  - Losing Trades: ${summary.losingTradesCount}
  - Trade Volume: $${summary.tradesVolumeUsd.toFixed(2)}
  - Best Performing Token: ${summary.bestPerformingToken?.tokenSymbol || 'N/A'}
  - Worst Performing Token: ${summary.worstPerformingToken?.tokenSymbol || 'N/A'}
`;

    return report;
  } catch (error) {
    console.error('Error generating wallet report:', error);
    throw new Error('Failed to generate wallet report after multiple retries');
  }
}

async function generateTokenReport(walletAddress: string): Promise<string> {
  try {
    const { data } = await fetchWithRetry(() => 
      vybeApi.get_wallet_tokens({ 
        ownerAddress: walletAddress,
        minAssetValue: '0',
        maxAssetValue: '1000000', // Set a reasonable upper limit
        includeNoPriceBalance: true,
        sortByDesc: 'valueUsd'
      })
    );
    
    const report = `
📊 Token Report for ${walletAddress}

💰 Total Value: $${parseFloat(data.totalTokenValueUsd).toFixed(2)}
📈 24h Change: ${(parseFloat(data.totalTokenValueUsd1dChange) * 100).toFixed(2)}%
🔢 Token Count: ${data.totalTokenCount}

🪙 Tokens:
${data.data.map(token => `
  - ${token.symbol} (${token.name})
    Amount: ${parseFloat(token.amount).toFixed(4)}
    Value: $${parseFloat(token.valueUsd).toFixed(2)}
    Price: $${parseFloat(token.priceUsd).toFixed(2)}
    ${token.logoUrl ? `Logo: ${token.logoUrl}` : ''}
`).join('\n')}
`;

    return report;
  } catch (error) {
    console.error('Error generating token report:', error);
    throw new Error('Failed to generate token report');
  }
}

// NFT Portfolio Command
bot.command('nfts', async (ctx) => {
  if (!ctx.message) {
    return ctx.reply('Invalid message format');
  }

  const text = ctx.message.text.trim();
  const parts = text.split(' ');
  
  if (parts.length < 2) {
    return ctx.reply('Please provide a wallet address. Example: /nfts <wallet_address>');
  }

  const walletAddress = parts[1];
  await ctx.reply(`Fetching NFT portfolio for ${walletAddress}...`);

  try {
    const nftResponse = await fetchWithRetry<NFTBalanceResponse>(() => 
      api.accountNftBalanceOwnerAddressGet(walletAddress, {
        includeNoPriceBalance: true,
        limit: 10
      })
    );

    if (!nftResponse || !nftResponse.data) {
      return ctx.reply('No NFT data found for this wallet.');
    }

    const nftData = nftResponse.data;
    let nftReport = `🖼️ *NFT Portfolio for ${walletAddress}*\n\n`;
    
    if (nftData.length === 0) {
      nftReport += 'No NFTs found in this wallet.';
    } else {
      nftReport += `Found ${nftData.length} NFTs:\n\n`;
      
      nftData.forEach((nft: NFTData, index: number) => {
        nftReport += `${index + 1}. *${nft.name || 'Unnamed NFT'}*\n`;
        if (nft.collectionName) nftReport += `   Collection: ${nft.collectionName}\n`;
        if (nft.floorPriceUsd) nftReport += `   Floor Price: $${parseFloat(nft.floorPriceUsd).toFixed(2)}\n`;
        nftReport += '\n';
      });
    }

    const messages = splitLongMessage(nftReport);
    for (const message of messages) {
      await ctx.reply(message, { parse_mode: 'Markdown' });
    }
  } catch (error) {
    console.error('Error fetching NFT data:', error);
    ctx.reply('Error fetching NFT data. Please try again later.');
  }
});

// Token History Command
bot.command('token_history', async (ctx) => {
  if (!ctx.message) {
    return ctx.reply('Invalid message format');
  }

  const text = ctx.message.text.trim();
  const parts = text.split(' ');
  
  if (parts.length < 2) {
    return ctx.reply('Please provide a wallet address. Example: /token_history <wallet_address>');
  }

  const walletAddress = parts[1];
  const days = parts[2] ? parseInt(parts[2]) : 7; // Default to 7 days if not specified
  
  await ctx.reply(`Fetching token history for ${walletAddress} over the last ${days} days...`);

  try {
    const historyResponse = await fetchWithRetry<TokenHistoryResponse>(() => 
      api.accountTokenBalanceTsOwnerAddressGet(walletAddress, {
        days: days
      })
    );

    if (!historyResponse || !historyResponse.data) {
      return ctx.reply('No token history data found for this wallet.');
    }

    const historyData = historyResponse.data;
    let historyReport = `📈 *Token Balance History for ${walletAddress}*\n\n`;
    
    if (historyData.length === 0) {
      historyReport += 'No token history found for this wallet.';
    } else {
      historyReport += `Showing data for the last ${days} days:\n\n`;
      
      historyData.forEach((entry: TokenHistoryEntry) => {
        const date = new Date(entry.timestamp).toLocaleDateString();
        historyReport += `*${date}*\n`;
        historyReport += `Total Value: $${parseFloat(entry.totalValueUsd).toFixed(2)}\n`;
        
        if (entry.tokens && entry.tokens.length > 0) {
          historyReport += 'Top tokens:\n';
          entry.tokens.slice(0, 3).forEach((token: {symbol: string, valueUsd: string}) => {
            historyReport += `- ${token.symbol}: $${parseFloat(token.valueUsd).toFixed(2)}\n`;
          });
        }
        historyReport += '\n';
      });
    }

    const messages = splitLongMessage(historyReport);
    for (const message of messages) {
      await ctx.reply(message, { parse_mode: 'Markdown' });
    }
  } catch (error) {
    console.error('Error fetching token history:', error);
    ctx.reply('Error fetching token history. Please try again later.');
  }
});

// Token Price Command
bot.command('price', async (ctx) => {
  if (!ctx.message) {
    return ctx.reply('Invalid message format');
  }

  const text = ctx.message.text.trim();
  const parts = text.split(' ');
  
  if (parts.length < 2) {
    return ctx.reply('Please provide a token mint address. Example: /price <mint_address>');
  }

  const mintAddress = parts[1];
  await ctx.reply(`Fetching price data for token ${mintAddress}...`);

  try {
    const priceResponse = await fetchWithRetry<PriceDataResponse>(() => 
      api.priceTokenOhlcvMintAddressGet(mintAddress, {
        resolution: '1d',
        limit: 7
      })
    );

    if (!priceResponse || !priceResponse.data) {
      return ctx.reply('No price data found for this token.');
    }

    const priceData = priceResponse.data;
    let priceReport = `💰 *Price Data for Token ${mintAddress}*\n\n`;
    
    if (priceData.length === 0) {
      priceReport += 'No price data found for this token.';
    } else {
      // Get token info
      const tokenResponse = await fetchWithRetry<TokenInfoResponse>(() => 
        api.tokenMintAddressGet(mintAddress)
      );
      
      if (tokenResponse && tokenResponse.data) {
        const tokenInfo = tokenResponse.data;
        priceReport += `*${tokenInfo.name} (${tokenInfo.symbol})*\n\n`;
      }
      
      priceReport += `Showing last ${priceData.length} days of price data:\n\n`;
      
      priceData.forEach((entry: PriceDataEntry) => {
        const date = new Date(entry.time).toLocaleDateString();
        priceReport += `*${date}*\n`;
        priceReport += `Open: $${entry.open.toFixed(4)}\n`;
        priceReport += `High: $${entry.high.toFixed(4)}\n`;
        priceReport += `Low: $${entry.low.toFixed(4)}\n`;
        priceReport += `Close: $${entry.close.toFixed(4)}\n`;
        priceReport += `Volume: $${entry.volume.toFixed(2)}\n\n`;
      });
      
      // Add price change calculation
      if (priceData.length >= 2) {
        const oldestPrice = priceData[priceData.length - 1].close;
        const newestPrice = priceData[0].close;
        const priceChange = ((newestPrice - oldestPrice) / oldestPrice) * 100;
        
        priceReport += `Price change over period: ${priceChange.toFixed(2)}%\n`;
      }
    }

    const messages = splitLongMessage(priceReport);
    for (const message of messages) {
      await ctx.reply(message, { parse_mode: 'Markdown' });
    }
  } catch (error) {
    console.error('Error fetching price data:', error);
    ctx.reply('Error fetching price data. Please try again later.');
  }
});

// Program Info Command
bot.command('program', async (ctx) => {
  if (!ctx.message) {
    return ctx.reply('Invalid message format');
  }

  const text = ctx.message.text.trim();
  const parts = text.split(' ');
  
  if (parts.length < 2) {
    return ctx.reply('Please provide a program ID. Example: /program <program_id>');
  }

  const programId = parts[1];
  await ctx.reply(`Fetching program details for ${programId}...`);

  try {
    const programResponse = await fetchWithRetry<ProgramResponse>(() => 
      api.programProgramIDGet(programId)
    );

    if (!programResponse || !programResponse.data) {
      return ctx.reply('No program data found for this ID.');
    }

    const programData = programResponse.data;
    let programReport = `🧩 *Program Details for ${programId}*\n\n`;
    
    programReport += `Name: ${programData.name || 'Unknown'}\n`;
    if (programData.description) programReport += `Description: ${programData.description}\n`;
    if (programData.website) programReport += `Website: ${programData.website}\n`;
    
    programReport += `\n*Statistics:*\n`;
    if (programData.stats) {
      if (programData.stats.transactionCount) programReport += `Transactions: ${programData.stats.transactionCount.toLocaleString()}\n`;
      if (programData.stats.instructionCount) programReport += `Instructions: ${programData.stats.instructionCount.toLocaleString()}\n`;
      if (programData.stats.activeUsers) programReport += `Active Users: ${programData.stats.activeUsers.toLocaleString()}\n`;
    }

    const messages = splitLongMessage(programReport);
    for (const message of messages) {
      await ctx.reply(message, { parse_mode: 'Markdown' });
    }
  } catch (error) {
    console.error('Error fetching program data:', error);
    ctx.reply('Error fetching program data. Please try again later.');
  }
});

// Program Activity Command
bot.command('program_activity', async (ctx) => {
  if (!ctx.message) {
    return ctx.reply('Invalid message format');
  }

  const text = ctx.message.text.trim();
  const parts = text.split(' ');
  
  if (parts.length < 2) {
    return ctx.reply('Please provide a program ID. Example: /program_activity <program_id>');
  }

  const programId = parts[1];
  await ctx.reply(`Fetching activity data for program ${programId}...`);

  try {
    const activityResponse = await fetchWithRetry<ActivityResponse>(() => 
      api.programProgramIdActiveUsersTsGet(programId, {
        range: '7d'
      })
    );

    if (!activityResponse || !activityResponse.data) {
      return ctx.reply('No activity data found for this program.');
    }

    const activityData = activityResponse.data;
    let activityReport = `📊 *Program Activity for ${programId}*\n\n`;
    
    if (activityData.length === 0) {
      activityReport += 'No activity data found for this program.';
    } else {
      activityReport += `Showing activity over the last 7 days:\n\n`;
      
      activityData.forEach((entry: ActivityEntry) => {
        const date = new Date(entry.timestamp).toLocaleDateString();
        activityReport += `*${date}*\n`;
        activityReport += `Active Users: ${entry.activeUsers.toLocaleString()}\n\n`;
      });
      
      // Calculate activity trend
      if (activityData.length >= 2) {
        const oldestActivity = activityData[activityData.length - 1].activeUsers;
        const newestActivity = activityData[0].activeUsers;
        const activityChange = ((newestActivity - oldestActivity) / oldestActivity) * 100;
        
        activityReport += `Activity change over period: ${activityChange.toFixed(2)}%\n`;
      }
    }

    const messages = splitLongMessage(activityReport);
    for (const message of messages) {
      await ctx.reply(message, { parse_mode: 'Markdown' });
    }
  } catch (error) {
    console.error('Error fetching program activity:', error);
    ctx.reply('Error fetching program activity. Please try again later.');
  }
});

// Market OHLC Command
bot.command('market', async (ctx) => {
  if (!ctx.message) {
    return ctx.reply('Invalid message format');
  }

  const text = ctx.message.text.trim();
  const parts = text.split(' ');
  
  if (parts.length < 2) {
    return ctx.reply('Please provide a market ID. Example: /market <market_id>');
  }

  const marketId = parts[1];
  await ctx.reply(`Fetching market data for ${marketId}...`);

  try {
    const marketResponse = await fetchWithRetry<PriceDataResponse>(() => 
      api.priceMarketOhlcvMarketIdGet(marketId, {
        resolution: '1d',
        limit: 7
      })
    );

    if (!marketResponse || !marketResponse.data) {
      return ctx.reply('No market data found for this ID.');
    }

    const marketData = marketResponse.data;
    let marketReport = `📉 *Market Data for ${marketId}*\n\n`;
    
    if (marketData.length === 0) {
      marketReport += 'No market data found for this ID.';
    } else {
      marketReport += `Showing last ${marketData.length} days of market data:\n\n`;
      
      marketData.forEach((entry: PriceDataEntry) => {
        const date = new Date(entry.time).toLocaleDateString();
        marketReport += `*${date}*\n`;
        marketReport += `Open: $${entry.open.toFixed(4)}\n`;
        marketReport += `High: $${entry.high.toFixed(4)}\n`;
        marketReport += `Low: $${entry.low.toFixed(4)}\n`;
        marketReport += `Close: $${entry.close.toFixed(4)}\n`;
        marketReport += `Volume: $${entry.volume.toFixed(2)}\n\n`;
      });
      
      // Add price change calculation
      if (marketData.length >= 2) {
        const oldestPrice = marketData[marketData.length - 1].close;
        const newestPrice = marketData[0].close;
        const priceChange = ((newestPrice - oldestPrice) / oldestPrice) * 100;
        
        marketReport += `Price change over period: ${priceChange.toFixed(2)}%\n`;
      }
    }

    const messages = splitLongMessage(marketReport);
    for (const message of messages) {
      await ctx.reply(message, { parse_mode: 'Markdown' });
    }
  } catch (error) {
    console.error('Error fetching market data:', error);
    ctx.reply('Error fetching market data. Please try again later.');
  }
});

// Trading Pair Command
bot.command('pair', async (ctx) => {
  if (!ctx.message) {
    return ctx.reply('Invalid message format');
  }

  const text = ctx.message.text.trim();
  const parts = text.split(' ');
  
  if (parts.length < 3) {
    return ctx.reply('Please provide base and quote mint addresses. Example: /pair <base_mint_address> <quote_mint_address>');
  }

  const baseMintAddress = parts[1];
  const quoteMintAddress = parts[2];
  
  await ctx.reply(`Fetching pair data for ${baseMintAddress}/${quoteMintAddress}...`);

  try {
    const pairResponse = await fetchWithRetry<PriceDataResponse>(() => 
      api.pricePairOhlcvBaseMintAddressQuoteMintAddressGet(baseMintAddress, quoteMintAddress, {
        resolution: '1d',
        limit: 7
      })
    );

    if (!pairResponse || !pairResponse.data) {
      return ctx.reply('No pair data found for these addresses.');
    }

    const pairData = pairResponse.data;
    let pairReport = `⚖️ *Trading Pair Data for ${baseMintAddress}/${quoteMintAddress}*\n\n`;
    
    if (pairData.length === 0) {
      pairReport += 'No pair data found for these addresses.';
    } else {
      // Try to get token symbols
      let baseSymbol = baseMintAddress.substring(0, 4) + '...';
      let quoteSymbol = quoteMintAddress.substring(0, 4) + '...';
      
      try {
        const baseTokenResponse = await fetchWithRetry<TokenInfoResponse>(() => 
          api.tokenMintAddressGet(baseMintAddress)
        );
        if (baseTokenResponse && baseTokenResponse.data) {
          baseSymbol = baseTokenResponse.data.symbol;
        }
      } catch (e) {}
      
      try {
        const quoteTokenResponse = await fetchWithRetry<TokenInfoResponse>(() => 
          api.tokenMintAddressGet(quoteMintAddress)
        );
        if (quoteTokenResponse && quoteTokenResponse.data) {
          quoteSymbol = quoteTokenResponse.data.symbol;
        }
      } catch (e) {}
      
      pairReport += `*${baseSymbol}/${quoteSymbol} Pair*\n\n`;
      pairReport += `Showing last ${pairData.length} days of pair data:\n\n`;
      
      pairData.forEach((entry: PriceDataEntry) => {
        const date = new Date(entry.time).toLocaleDateString();
        pairReport += `*${date}*\n`;
        pairReport += `Open: ${entry.open.toFixed(6)}\n`;
        pairReport += `High: ${entry.high.toFixed(6)}\n`;
        pairReport += `Low: ${entry.low.toFixed(6)}\n`;
        pairReport += `Close: ${entry.close.toFixed(6)}\n`;
        pairReport += `Volume: ${entry.volume.toFixed(2)}\n\n`;
      });
      
      // Add price change calculation
      if (pairData.length >= 2) {
        const oldestPrice = pairData[pairData.length - 1].close;
        const newestPrice = pairData[0].close;
        const priceChange = ((newestPrice - oldestPrice) / oldestPrice) * 100;
        
        pairReport += `Price change over period: ${priceChange.toFixed(2)}%\n`;
      }
    }

    const messages = splitLongMessage(pairReport);
    for (const message of messages) {
      await ctx.reply(message, { parse_mode: 'Markdown' });
    }
  } catch (error) {
    console.error('Error fetching pair data:', error);
    ctx.reply('Error fetching pair data. Please try again later.');
  }
});

// Token Transfers Command
bot.command('transfers', async (ctx) => {
  if (!ctx.message) {
    return ctx.reply('Invalid message format');
  }

  const text = ctx.message.text.trim();
  const parts = text.split(' ');
  
  if (parts.length < 2) {
    return ctx.reply('Please provide a wallet address or token mint. Example: /transfers <address>');
  }

  const address = parts[1];
  await ctx.reply(`Fetching transfer data for ${address}...`);

  try {
    // Determine if address is a wallet or token mint
    const params: any = {
      limit: 10,
      sortByDesc: 'time'
    };
    
    // Check if it's a wallet address
    if (address.length === 44) { // Typical Solana address length
      params.walletAddress = address;
    } else {
      params.mintAddress = address;
    }
    
    const transfersResponse = await fetchWithRetry<TransfersResponse>(() => 
      api.tokenTransfersGet(params)
    );

    if (!transfersResponse || !transfersResponse.data) {
      return ctx.reply('No transfer data found for this address.');
    }

    const transfersData = transfersResponse.data;
    let transfersReport = `🔄 *Token Transfers for ${address}*\n\n`;
    
    if (transfersData.length === 0) {
      transfersReport += 'No transfers found for this address.';
    } else {
      transfersReport += `Showing last ${transfersData.length} transfers:\n\n`;
      
      transfersData.forEach((transfer: TransferData, index: number) => {
        transfersReport += `*Transfer ${index + 1}*\n`;
        transfersReport += `Token: ${transfer.tokenSymbol || transfer.mintAddress.substring(0, 8) + '...'}\n`;
        transfersReport += `From: ${transfer.senderAddress.substring(0, 8)}...\n`;
        transfersReport += `To: ${transfer.receiverAddress.substring(0, 8)}...\n`;
        
        if (transfer.amount) {
          const amount = parseFloat(transfer.amount);
          transfersReport += `Amount: ${amount.toLocaleString()}\n`;
        }
        
        if (transfer.usdAmount) {
          transfersReport += `Value: $${parseFloat(transfer.usdAmount).toFixed(2)}\n`;
        }
        
        if (transfer.time) {
          const date = new Date(transfer.time).toLocaleString();
          transfersReport += `Time: ${date}\n`;
        }
        
        transfersReport += `Signature: ${transfer.signature.substring(0, 8)}...\n\n`;
      });
    }

    const messages = splitLongMessage(transfersReport);
    for (const message of messages) {
      await ctx.reply(message, { parse_mode: 'Markdown' });
    }
  } catch (error) {
    console.error('Error fetching transfer data:', error);
    ctx.reply('Error fetching transfer data. Please try again later.');
  }
});

// Token Trades Command
bot.command('trades', async (ctx) => {
  if (!ctx.message) {
    return ctx.reply('Invalid message format');
  }

  const text = ctx.message.text.trim();
  const parts = text.split(' ');
  
  if (parts.length < 2) {
    return ctx.reply('Please provide a token mint address or wallet. Example: /trades <address>');
  }

  const address = parts[1];
  await ctx.reply(`Fetching trade data for ${address}...`);

  try {
    // Determine if address is a wallet or token mint
    const params: any = {
      limit: 10,
      sortByDesc: 'time'
    };
    
    // Check if it's a wallet address
    if (address.length === 44) { // Typical Solana address length
      params.authorityAddress = address;
    } else {
      params.mintAddress = address;
    }
    
    const tradesResponse = await fetchWithRetry<TradesResponse>(() => 
      api.tokenTradesGet(params)
    );

    if (!tradesResponse || !tradesResponse.data) {
      return ctx.reply('No trade data found for this address.');
    }

    const tradesData = tradesResponse.data;
    let tradesReport = `🔄 *Token Trades for ${address}*\n\n`;
    
    if (tradesData.length === 0) {
      tradesReport += 'No trades found for this address.';
    } else {
      tradesReport += `Showing last ${tradesData.length} trades:\n\n`;
      
      tradesData.forEach((trade: TradeData, index: number) => {
        tradesReport += `*Trade ${index + 1}*\n`;
        
        if (trade.baseSymbol && trade.quoteSymbol) {
          tradesReport += `Pair: ${trade.baseSymbol}/${trade.quoteSymbol}\n`;
        } else {
          tradesReport += `Base: ${trade.baseMintAddress.substring(0, 8)}...\n`;
          tradesReport += `Quote: ${trade.quoteMintAddress.substring(0, 8)}...\n`;
        }
        
        tradesReport += `Type: ${trade.side === 'buy' ? 'Buy 🟢' : 'Sell 🔴'}\n`;
        
        if (trade.baseAmount) {
          const amount = parseFloat(trade.baseAmount);
          tradesReport += `Amount: ${amount.toLocaleString()} ${trade.baseSymbol || ''}\n`;
        }
        
        if (trade.price) {
          tradesReport += `Price: ${parseFloat(trade.price).toFixed(6)} ${trade.quoteSymbol || ''}\n`;
        }
        
        if (trade.quoteAmount) {
          const value = parseFloat(trade.quoteAmount);
          tradesReport += `Value: ${value.toLocaleString()} ${trade.quoteSymbol || ''}\n`;
        }
        
        if (trade.time) {
          const date = new Date(trade.time).toLocaleString();
          tradesReport += `Time: ${date}\n`;
        }
        
        if (trade.signature) {
          tradesReport += `Signature: ${trade.signature.substring(0, 8)}...\n`;
        }
        
        tradesReport += '\n';
      });
    }

    const messages = splitLongMessage(tradesReport);
    for (const message of messages) {
      await ctx.reply(message, { parse_mode: 'Markdown' });
    }
  } catch (error) {
    console.error('Error fetching trade data:', error);
    ctx.reply('Error fetching trade data. Please try again later.');
  }
});

// Help Command
bot.command('help', async (ctx) => {
  const helpMessage = `🔍 *Alayeseke Bot Commands*\n\n*Portfolio Commands:*\n• */pnl* - Check wallet profit and loss\n• */report* - Get detailed wallet report\n• */nfts* - View NFT portfolio\n• */token_history* - View token balance history\n\n*Token Commands:*\n• */top_holders* - View top holders of a token\n• */price* - Check token price with OHLC data\n• */transfers* - View recent token transfers\n• */trades* - View recent token trades\n\n*Program & Market Commands:*\n• */program* - Get program details\n• */program_activity* - Check program activity\n• */market* - Check market OHLC data\n• */pair* - Check trading pair data\n\n*Other Commands:*\n• */holder_portfolio* - Examine a specific holder's portfolio\n• */help* - Show this help message`;
  
  return ctx.reply(helpMessage, { parse_mode: "Markdown" });
});

// Now that you specified how to handle messages, you can start your bot.
// This will connect to the Telegram servers and wait for messages.

// Start the bot.
bot.start();
