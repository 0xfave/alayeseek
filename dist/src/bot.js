"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const grammy_1 = require("grammy");
const dotenv_1 = __importDefault(require("dotenv"));
const vybe_api_1 = __importDefault(require("../.api/apis/vybe-api"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Helper function to format currency with K, M, B suffixes
function formatCurrency(value) {
    if (value >= 1e9) {
        return `$${(value / 1e9).toFixed(2)}B`;
    }
    else if (value >= 1e6) {
        return `$${(value / 1e6).toFixed(2)}M`;
    }
    else if (value >= 1e3) {
        return `$${(value / 1e3).toFixed(2)}K`;
    }
    else {
        return `$${value.toFixed(2)}`;
    }
}
// Load environment variables
dotenv_1.default.config();
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
const bot = new grammy_1.Bot(TELEGRAM_TOKEN);
// Program command - get details about a Solana program by name or ID
bot.command("program", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    // Get the program name or ID from the message text
    const programQuery = (_c = (_b = (_a = ctx.message) === null || _a === void 0 ? void 0 : _a.text) === null || _b === void 0 ? void 0 : _b.split('/program ')[1]) === null || _c === void 0 ? void 0 : _c.trim();
    if (!ctx.message || !programQuery) {
        return ctx.reply('Please provide a program name or ID. Usage: /program <program_name_or_id>');
    }
    // Set the API key
    vybe_api_1.default.auth(VYBE_API_KEY);
    try {
        // Notify user that we're fetching data
        yield ctx.reply(`Searching for program: \`${programQuery}\`...`, { parse_mode: "Markdown" });
        // Load the known program IDs
        const knownProgramsPath = path.join(__dirname, 'knownprogramIds.json');
        if (!fs.existsSync(knownProgramsPath)) {
            return ctx.reply('Error: Known program IDs file not found');
        }
        const knownProgramsData = fs.readFileSync(knownProgramsPath, 'utf8');
        const knownPrograms = JSON.parse(knownProgramsData);
        if (!knownPrograms.data || !Array.isArray(knownPrograms.data)) {
            return ctx.reply('Error: Invalid format in known program IDs file');
        }
        // Find program ID by matching name or ID
        const programMatch = knownPrograms.data.find((p) => {
            return (p.programId.toLowerCase() === programQuery.toLowerCase() ||
                p.programName.toLowerCase().includes(programQuery.toLowerCase()));
        });
        if (!programMatch) {
            return ctx.reply(`No program found matching: ${programQuery}\n\nPlease try a different name or ID.`);
        }
        const programId = programMatch.programId;
        const programName = programMatch.programName;
        console.log(`Found program match: ${programName} (${programId})`);
        // Get program details - making sure to match the expected parameter names
        const programDetailsPromise = vybe_api_1.default.get_program({ programAddress: programId });
        const programTVLPromise = vybe_api_1.default.get_program_tvl({
            programAddress: programId,
            resolution: '1d' // Try 1d (one day) as the resolution value
        });
        // Wait for both API calls to complete
        const [programDetails, programTVL] = yield Promise.all([programDetailsPromise, programTVLPromise]);
        console.log('Program Details Response:', JSON.stringify(programDetails, null, 2));
        console.log('Program TVL Response:', JSON.stringify(programTVL, null, 2));
        // Check for errors in responses
        if (!programDetails || !programDetails.data) {
            return ctx.reply(`Error: Failed to fetch program details for ${programName} (${programId})`);
        }
        // Format program details
        const details = programDetails.data;
        // Format TVL data if available
        let tvlInfo = 'TVL data not available';
        let tvlHistoryInfo = '';
        if (programTVL && programTVL.data && programTVL.data.data && Array.isArray(programTVL.data.data)) {
            // Get the most recent TVL value (last item in the array)
            const tvlDataPoints = programTVL.data.data;
            if (tvlDataPoints.length > 0) {
                // Most recent TVL (today)
                const latestTvl = tvlDataPoints[tvlDataPoints.length - 1];
                const tvlValue = parseFloat(latestTvl.tvl);
                tvlInfo = formatCurrency(tvlValue);
                // Show TVL history (last 7 days)
                const lastWeekData = tvlDataPoints.slice(-7);
                tvlHistoryInfo = `\n\n📈 *TVL History (Last 7 Days):*\n`;
                lastWeekData.forEach(dataPoint => {
                    const date = new Date(dataPoint.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const value = parseFloat(dataPoint.tvl);
                    tvlHistoryInfo += `   • ${date}: ${formatCurrency(value)}\n`;
                });
            }
        }
        // Create message header with program info
        const headerMessage = `🧩 *${programName}*\n` +
            `Program ID: \`${programId}\`\n\n`;
        // Create message body with program details
        let detailsMessage = '';
        // Add TVL info
        detailsMessage += `💰 *Total Value Locked:* ${tvlInfo}\n`;
        // Add TVL history if available
        if (tvlHistoryInfo) {
            detailsMessage += tvlHistoryInfo + '\n';
        }
        else {
            detailsMessage += '\n';
        }
        // Add transaction counts if available
        if (details.txCount24h || details.txCount7d || details.txCount30d) {
            detailsMessage += `📊 *Transaction Counts:*\n`;
            if (details.txCount24h)
                detailsMessage += `   • 24h: ${Number(details.txCount24h).toLocaleString()}\n`;
            if (details.txCount7d)
                detailsMessage += `   • 7d: ${Number(details.txCount7d).toLocaleString()}\n`;
            if (details.txCount30d)
                detailsMessage += `   • 30d: ${Number(details.txCount30d).toLocaleString()}\n`;
            detailsMessage += '\n';
        }
        // Add fee information if available
        if (details.fee24h || details.fee7d || details.fee30d) {
            detailsMessage += `💵 *Fee Information:*\n`;
            if (details.fee24h)
                detailsMessage += `   • 24h: ${formatCurrency(Number(details.fee24h))}\n`;
            if (details.fee7d)
                detailsMessage += `   • 7d: ${formatCurrency(Number(details.fee7d))}\n`;
            if (details.fee30d)
                detailsMessage += `   • 30d: ${formatCurrency(Number(details.fee30d))}\n`;
            detailsMessage += '\n';
        }
        // Add volume information if available
        if (details.volume24h || details.volume7d || details.volume30d) {
            detailsMessage += `📈 *Volume Information:*\n`;
            if (details.volume24h)
                detailsMessage += `   • 24h: ${formatCurrency(Number(details.volume24h))}\n`;
            if (details.volume7d)
                detailsMessage += `   • 7d: ${formatCurrency(Number(details.volume7d))}\n`;
            if (details.volume30d)
                detailsMessage += `   • 30d: ${formatCurrency(Number(details.volume30d))}\n`;
        }
        // Send the combined message
        return ctx.reply(headerMessage + detailsMessage, { parse_mode: "Markdown" });
    }
    catch (error) {
        console.error('Error in program command:', error);
        return ctx.reply(`Error fetching program data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}));
// Start command handler
bot.command("start", (ctx) => {
    const welcomeMessage = `🚀 *Welcome to Alayeseke!* 🚀

📊 *Your personal Solana blockchain assistant*

Alayeseke helps you:

• Track wallet portfolios and PnL
• Monitor NFT collections
• View token data and top holders
• Analyze Solana programs and markets

To see all available commands, type */help*

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
• */token_balance* - View current token holdings

*Token Commands:*
• */top_holders* - View top holders of a token
• */price* - Check token price with OHLC data
• */transfers* - View recent token transfers
• */trades* - View recent token trades

*Program & Market Commands:*
• */program* - Get program details
• */market* - Check market OHLC data
• */pair* - Check trading pair data

*Other Commands:*
• */help* - Show this help message

Simply use any command with your wallet address to get started!

Powered by Vybe API 💎`;
    return ctx.reply(helpMessage, { parse_mode: "Markdown" });
});
// Market command - Get OHLCV data for a trading pair or market
bot.command("market", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    // Get the market query from the message text
    const marketQuery = (_c = (_b = (_a = ctx.message) === null || _a === void 0 ? void 0 : _a.text) === null || _b === void 0 ? void 0 : _b.split('/market ')[1]) === null || _c === void 0 ? void 0 : _c.trim();
    if (!ctx.message || !marketQuery) {
        return ctx.reply('Please provide a market symbol (e.g. SOL/USDC) or a Solana market ID. Usage: /market <market_symbol_or_id>');
    }
    // Set the API key
    vybe_api_1.default.auth(VYBE_API_KEY);
    try {
        // Notify user that we're fetching data
        yield ctx.reply(`Fetching market data for: \`${marketQuery}\`...`, { parse_mode: "Markdown" });
        // Determine if input is a market ID (address-like) or a symbol
        const isMarketId = marketQuery.length > 30 && !marketQuery.includes('/');
        const marketId = isMarketId ? marketQuery : marketQuery.toUpperCase(); // If it's a symbol, ensure uppercase
        console.log(`Processing ${isMarketId ? 'market ID' : 'market symbol'}: ${marketId}`);
        // Format the resolution and time range parameters
        const resolution = '1d'; // daily candles
        const toTimestamp = Math.floor(Date.now() / 1000); // current time in seconds
        const fromTimestamp = toTimestamp - (7 * 24 * 60 * 60); // 7 days ago
        // Make the API request
        const response = yield vybe_api_1.default.get_market_filtered_ohlcv({
            marketId: marketId, // Use the processed marketId variable
            resolution: resolution,
            timeStart: fromTimestamp,
            timeEnd: toTimestamp
        });
        console.log('Market OHLCV Response:', JSON.stringify(response, null, 2));
        // Check if response has data
        if (!response || !response.data || !Array.isArray(response.data)) {
            return ctx.reply(`No market data found for: ${marketQuery}. Please check the market symbol and try again.`);
        }
        const ohlcvData = response.data;
        if (ohlcvData.length === 0) {
            return ctx.reply(`No market data available for: ${marketQuery} in the last 7 days.`);
        }
        // Create the header message
        // Create the header message - if it's a market ID, don't try to uppercase it
        const headerMessage = `📊 *${isMarketId ? marketQuery : marketQuery.toUpperCase()} Market Data*\n\n`;
        // Format the OHLCV data
        let ohlcvMessage = '';
        // Get the latest candle for summary
        const latestCandle = ohlcvData[ohlcvData.length - 1];
        const currentPrice = parseFloat(latestCandle.close);
        // Calculate 24h change
        const prevDayCandle = ohlcvData.length > 1 ? ohlcvData[ohlcvData.length - 2] : null;
        let priceChange = 0;
        let priceChangePercent = 0;
        if (prevDayCandle) {
            const prevClose = parseFloat(prevDayCandle.close);
            priceChange = currentPrice - prevClose;
            priceChangePercent = (priceChange / prevClose) * 100;
        }
        // Format price with appropriate decimals based on its value
        const formatPrice = (price) => {
            if (price < 0.001)
                return price.toFixed(6);
            if (price < 0.01)
                return price.toFixed(5);
            if (price < 0.1)
                return price.toFixed(4);
            if (price < 1)
                return price.toFixed(3);
            if (price < 10)
                return price.toFixed(2);
            return price.toFixed(2);
        };
        // Create the summary section
        ohlcvMessage += `💰 *Current Price:* $${formatPrice(currentPrice)}\n`;
        ohlcvMessage += `${priceChangePercent >= 0 ? '📈' : '📉'} *24h Change:* ${priceChangePercent >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}% (${priceChange >= 0 ? '+' : ''}$${formatPrice(priceChange)})\n\n`;
        // Add daily OHLCV data
        ohlcvMessage += `📅 *Last 7 Days:*\n`;
        // Process each candle (in reverse order - newest first)
        ohlcvData.slice().reverse().forEach((candle) => {
            const date = new Date(candle.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const open = parseFloat(candle.open);
            const high = parseFloat(candle.high);
            const low = parseFloat(candle.low);
            const close = parseFloat(candle.close);
            const volume = parseFloat(candle.volume);
            // Format volume with K, M, B suffixes
            const formattedVolume = formatCurrency(volume).replace('$', '');
            // Add emoji based on candle direction (green/red)
            const candleEmoji = close >= open ? '🟢' : '🔴';
            ohlcvMessage += `${candleEmoji} *${date}*: O:$${formatPrice(open)} H:$${formatPrice(high)} L:$${formatPrice(low)} C:$${formatPrice(close)} Vol:${formattedVolume}\n`;
        });
        // Send the combined message
        return ctx.reply(headerMessage + ohlcvMessage, { parse_mode: "Markdown" });
    }
    catch (error) {
        console.error('Error in market command:', error);
        return ctx.reply(`Error fetching market data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}));
bot.command("pair", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    // Parse the command format: /pair TOKEN1/TOKEN2 [resolution]
    const queryText = ((_a = ctx.message) === null || _a === void 0 ? void 0 : _a.text.substring('/pair'.length).trim()) || '';
    if (!queryText) {
        return ctx.reply('Please provide a trading pair in the format TOKEN1/TOKEN2 or ADDRESS1/ADDRESS2. Examples:\n/pair SOL/USDC\n/pair SOL/USDC 1d\n/pair So11111111111111111111111111111111111111112/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    }
    // Set the API key
    vybe_api_1.default.auth(VYBE_API_KEY);
    try {
        // Parse the input to extract pair and resolution
        const parts = queryText ? queryText.split(' ') : [];
        const pairQuery = parts[0];
        const resolution = parts[1] || '1d'; // Default to 1d if not specified
        // Notify user that we're fetching data
        yield ctx.reply(`Fetching data for trading pair: \`${pairQuery}\` with ${resolution} resolution...`, { parse_mode: "Markdown" });
        // Validate resolution
        if (!['1d', '7d', '30d'].includes(resolution)) {
            return ctx.reply(`Invalid resolution: ${resolution}. Supported values are: 1d, 7d, 30d.`);
        }
        // Extract base and quote tokens
        let baseMint, quoteMint;
        if (pairQuery.includes('/')) {
            const [baseToken, quoteToken] = pairQuery.split('/');
            // First, determine if these are mint addresses or symbols
            // Solana addresses are 32-44 characters long
            const isSolanaAddress = (str) => {
                return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(str.trim());
            };
            // Map of common token symbols to their mint addresses
            const commonTokens = {
                'SOL': 'So11111111111111111111111111111111111111112',
                'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
                'BTC': '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E', // Solana wrapped BTC
                'ETH': '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', // Solana wrapped ETH
                'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
                'SAMO': '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
                'JTO': 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL'
            };
            // Determine the actual mint addresses to use
            if (isSolanaAddress(baseToken)) {
                baseMint = baseToken.trim();
            }
            else {
                const baseTokenUpper = baseToken.toUpperCase();
                if (Object.prototype.hasOwnProperty.call(commonTokens, baseTokenUpper)) {
                    baseMint = commonTokens[baseTokenUpper];
                }
                else {
                    return ctx.reply(`Unknown token symbol: ${baseToken}. Please use a well-known symbol or provide the full mint address.`);
                }
            }
            if (isSolanaAddress(quoteToken)) {
                quoteMint = quoteToken.trim();
            }
            else {
                const quoteTokenUpper = quoteToken.toUpperCase();
                if (Object.prototype.hasOwnProperty.call(commonTokens, quoteTokenUpper)) {
                    quoteMint = commonTokens[quoteTokenUpper];
                }
                else {
                    return ctx.reply(`Unknown token symbol: ${quoteToken}. Please use a well-known symbol or provide the full mint address.`);
                }
            }
        }
        else {
            return ctx.reply('Please use the format TOKEN1/TOKEN2 or ADDRESS1/ADDRESS2. For example: SOL/USDC or So11111111111111111111111111111111111111112/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
        }
        // Determine time range based on resolution
        const toTimestamp = Math.floor(Date.now() / 1000); // current time in seconds
        let fromTimestamp = toTimestamp - (7 * 24 * 60 * 60); // Default: 7 days
        if (resolution === '1d') {
            fromTimestamp = toTimestamp - (7 * 24 * 60 * 60); // 7 days for 1d resolution
        }
        else if (resolution === '7d') {
            fromTimestamp = toTimestamp - (30 * 24 * 60 * 60); // 30 days for 7d resolution
        }
        else if (resolution === '30d') {
            fromTimestamp = toTimestamp - (90 * 24 * 60 * 60); // 90 days for 30d resolution
        }
        try {
            // Log the mint addresses we're using
            console.log(`Using mint addresses: ${baseMint} / ${quoteMint}`);
            // Make the API request with the mint addresses
            const response = yield vybe_api_1.default.get_pair_trade_ohlcv_program({
                baseMintAddress: baseMint,
                quoteMintAddress: quoteMint,
                resolution: resolution,
                timeStart: fromTimestamp,
                timeEnd: toTimestamp
            });
            console.log('Pair OHLCV Response:', JSON.stringify(response, null, 2));
            // Check if response has data
            if (!response || !response.data || !Array.isArray(response.data)) {
                return ctx.reply(`No data found for trading pair: ${pairQuery}. Please check the token symbols and try again.`);
            }
            const pairData = response.data;
            if (pairData.length === 0) {
                return ctx.reply(`No trading data available for: ${pairQuery} in the last 7 days.`);
            }
            // Create the header message with resolution info
            // Show both symbols if we can identify them, otherwise show shortened addresses
            let displayPair = pairQuery.toUpperCase();
            // Create a reverse mapping to help display friendly token names
            const commonTokens = {
                'SOL': 'So11111111111111111111111111111111111111112',
                'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
                'BTC': '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E',
                'ETH': '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
                'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
                'SAMO': '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
                'JTO': 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL'
            };
            const mintToSymbol = Object.entries(commonTokens).reduce((acc, [symbol, address]) => {
                acc[address] = symbol;
                return acc;
            }, {});
            // Try to get friendly symbols for the mint addresses
            const baseSymbol = mintToSymbol[baseMint] || (baseMint.slice(0, 4) + '...' + baseMint.slice(-4));
            const quoteSymbol = mintToSymbol[quoteMint] || (quoteMint.slice(0, 4) + '...' + quoteMint.slice(-4));
            displayPair = `${baseSymbol}/${quoteSymbol}`;
            const headerMessage = `📊 *${displayPair} Trading Pair Data (${resolution} resolution)*\n\n`;
            // Format the pair data
            let pairMessage = '';
            // Get programs with data for this pair
            const programs = new Set(pairData.map(item => item.programId));
            const programNames = new Map();
            // Map program IDs to names where possible
            programs.forEach(programId => {
                // Try to get program name from knownprogramIds.json
                try {
                    const knownProgramsPath = path.join(__dirname, 'knownprogramIds.json');
                    if (fs.existsSync(knownProgramsPath)) {
                        const knownProgramsData = fs.readFileSync(knownProgramsPath, 'utf8');
                        const knownPrograms = JSON.parse(knownProgramsData);
                        if (knownPrograms.data && Array.isArray(knownPrograms.data)) {
                            const program = knownPrograms.data.find((p) => p.programId === programId);
                            if (program) {
                                programNames.set(programId, program.programName);
                            }
                        }
                    }
                }
                catch (error) {
                    console.error('Error reading program names:', error);
                }
                // If program name not found, use short ID
                if (!programNames.has(programId)) {
                    const shortId = programId.substring(0, 4) + '...' + programId.substring(programId.length - 4);
                    programNames.set(programId, shortId);
                }
            });
            // Add summary about available DEXs
            pairMessage += `🏪 *Available on ${programs.size} DEXs:* `;
            pairMessage += Array.from(programNames.values()).join(', ');
            pairMessage += '\n\n';
            // Group data by program
            const programData = new Map();
            pairData.forEach(item => {
                if (!programData.has(item.programId)) {
                    programData.set(item.programId, []);
                }
                programData.get(item.programId).push(item);
            });
            // Format price with appropriate decimals based on its value
            const formatPrice = (price) => {
                if (price < 0.001)
                    return price.toFixed(6);
                if (price < 0.01)
                    return price.toFixed(5);
                if (price < 0.1)
                    return price.toFixed(4);
                if (price < 1)
                    return price.toFixed(3);
                if (price < 10)
                    return price.toFixed(2);
                return price.toFixed(2);
            };
            // Get overall price range across all DEXs
            let minPrice = Number.MAX_VALUE;
            let maxPrice = 0;
            let latestPrice = 0;
            pairData.forEach(item => {
                var _a;
                const close = parseFloat(item.close);
                if (close > maxPrice)
                    maxPrice = close;
                if (close < minPrice)
                    minPrice = close;
                // Use the most recent close price
                const time = new Date(item.time).getTime();
                const latestTime = latestPrice ? new Date(((_a = pairData.find(i => parseFloat(i.close) === latestPrice)) === null || _a === void 0 ? void 0 : _a.time) || 0).getTime() : 0;
                if (time > latestTime) {
                    latestPrice = close;
                }
            });
            // Add price summary
            pairMessage += `💰 *Latest Price:* $${formatPrice(latestPrice)}\n`;
            pairMessage += `📉 *Price Range:* $${formatPrice(minPrice)} - $${formatPrice(maxPrice)}\n\n`;
            // Process each program
            for (const [programId, items] of programData.entries()) {
                // Sort items by time, newest first
                items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
                const programName = programNames.get(programId) || programId;
                // Add program header
                pairMessage += `🔗 *${programName}:*\n`;
                // Add the latest price for this program
                const latestItem = items[0];
                const close = parseFloat(latestItem.close);
                pairMessage += `   • Price: $${formatPrice(close)}\n`;
                // Add 24h volume if available
                if (latestItem.volume) {
                    const volume = parseFloat(latestItem.volume);
                    pairMessage += `   • Volume: ${formatCurrency(volume).replace('$', '')}\n`;
                }
                pairMessage += '\n';
            }
            // Send the combined message
            return ctx.reply(headerMessage + pairMessage, { parse_mode: "Markdown" });
        }
        catch (mintError) {
            console.error('Error resolving mint addresses:', mintError);
            return ctx.reply(`Error: Unable to resolve token mint addresses. Please try using actual mint addresses instead of symbols.`);
        }
    }
    catch (error) {
        console.error('Error in pair command:', error);
        return ctx.reply(`Error fetching trading pair data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}));
// PnL command handler
bot.command("pnl", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    // Get the wallet address from the message text
    const messageText = ((_b = (_a = ctx.message) === null || _a === void 0 ? void 0 : _a.text) === null || _b === void 0 ? void 0 : _b.trim()) || '';
    const args = messageText.split(' ').filter(Boolean).slice(1);
    const walletAddress = args[0];
    // Check if wallet address was provided
    if (!walletAddress) {
        return ctx.reply('Please provide a wallet address. Usage: /pnl <wallet_address> [resolution]');
    }
    // Get optional resolution (1d, 7d, 30d)
    const resolution = (args[1] && ['1d', '7d', '30d'].includes(args[1]) ? args[1] : '1d');
    // Set the API key
    vybe_api_1.default.auth(VYBE_API_KEY);
    try {
        // Notify user that we're fetching data
        yield ctx.reply(`Fetching PnL data for wallet: \`${walletAddress}\` with ${resolution} resolution...`, { parse_mode: "Markdown" });
        // Call the Vybe API to get wallet PnL data
        const response = yield vybe_api_1.default.get_wallet_pnl({
            ownerAddress: walletAddress,
            resolution: resolution
        });
        const pnlData = response.data;
        const summary = pnlData.summary;
        // Format the response
        const formattedResponse = `💰 *PnL Summary for ${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}*\n\n` +
            `📊 *Overall Performance*\n` +
            `🔹 Realized PnL: $${summary.realizedPnlUsd.toFixed(2)}\n` +
            `🔹 Unrealized PnL: $${summary.unrealizedPnlUsd.toFixed(2)}\n` +
            `🔹 Total PnL: $${(summary.realizedPnlUsd + summary.unrealizedPnlUsd).toFixed(2)}\n` +
            `🔹 Win Rate: ${summary.winRate.toFixed(2)}%\n\n` +
            `🧮 *Trading Activity*\n` +
            `🔹 Trades: ${summary.tradesCount} (${summary.winningTradesCount} W / ${summary.losingTradesCount} L)\n` +
            `🔹 Total Volume: $${summary.tradesVolumeUsd.toFixed(2)}\n` +
            `🔹 Unique Tokens: ${summary.uniqueTokensTraded}\n` +
            `🔹 Avg Trade Size: $${summary.averageTradeUsd.toFixed(2)}\n\n` +
            `🏆 *Best Performing Token*\n` +
            `🔹 ${((_c = summary.bestPerformingToken) === null || _c === void 0 ? void 0 : _c.tokenSymbol) || 'Unknown'}: $${((_e = (_d = summary.bestPerformingToken) === null || _d === void 0 ? void 0 : _d.pnlUsd) === null || _e === void 0 ? void 0 : _e.toFixed(2)) || '0.00'}\n\n` +
            `📉 *Worst Performing Token*\n` +
            `🔹 ${((_f = summary.worstPerformingToken) === null || _f === void 0 ? void 0 : _f.tokenSymbol) || 'Unknown'}: $${((_h = (_g = summary.worstPerformingToken) === null || _g === void 0 ? void 0 : _g.pnlUsd) === null || _h === void 0 ? void 0 : _h.toFixed(2)) || '0.00'}\n\n` +
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
                topTokensText += `${index + 1}. ${token.tokenSymbol || token.tokenAddress.substring(0, 6)}: $${totalPnl.toFixed(2)} ` +
                    `(Buy Vol: $${token.buys.volumeUsd.toFixed(2)}, Sell Vol: $${token.sells.volumeUsd.toFixed(2)})
`;
            });
            // Send the complete response
            return ctx.reply(formattedResponse + topTokensText, { parse_mode: "Markdown" });
        }
        else {
            return ctx.reply(formattedResponse + "No token metrics available.", { parse_mode: "Markdown" });
        }
    }
    catch (error) {
        console.error('Error fetching PnL data:', error);
        let errorMessage = 'Failed to fetch PnL data.';
        // Provide more specific error messages
        if (error.response) {
            if (error.response.status === 400) {
                errorMessage = 'Invalid wallet address. Please check and try again.';
            }
            else if (error.response.status === 403) {
                errorMessage = 'API access forbidden. Authentication may be required.';
            }
            else if (error.response.status === 500) {
                errorMessage = 'Server error occurred. Please try again later.';
            }
        }
        return ctx.reply(errorMessage);
    }
}));
// NFTs command handler
bot.command("nfts", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    // Get the wallet address from the message text
    const messageText = ((_b = (_a = ctx.message) === null || _a === void 0 ? void 0 : _a.text) === null || _b === void 0 ? void 0 : _b.trim()) || '';
    const args = messageText.split(' ').filter(Boolean).slice(1);
    const walletAddress = args[0];
    // Check if wallet address was provided
    if (!walletAddress) {
        return ctx.reply('Please provide a wallet address. Usage: /nfts <wallet_address>');
    }
    // Set the API key
    vybe_api_1.default.auth(VYBE_API_KEY);
    try {
        // Notify user that we're fetching data
        yield ctx.reply(`Fetching NFT portfolio for wallet: \`${walletAddress}\`...`, { parse_mode: "Markdown" });
        // Call the Vybe API to get wallet NFT data
        const response = yield vybe_api_1.default.get_wallet_nfts({
            ownerAddress: walletAddress
        });
        const nftData = response.data;
        // Get portfolio values ensuring they're numbers
        const totalValueUsd = typeof nftData.totalValueUsd === 'number' ? nftData.totalValueUsd : 0;
        const totalValueSol = typeof nftData.totalValueSol === 'number' ? nftData.totalValueSol : 0;
        // Get collections and NFTs as arrays
        const collections = Array.isArray(nftData.collections) ? nftData.collections : [];
        const nfts = Array.isArray(nftData.nfts) ? nftData.nfts : [];
        // Format the summary response
        const summaryResponse = `📦 *NFT Portfolio Summary for ${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}*\n\n` +
            `💰 *Portfolio Value*\n` +
            `🔹 Total Value (USD): $${totalValueUsd.toFixed(2)}\n` +
            `🔹 Total Value (SOL): ${totalValueSol.toFixed(4)} SOL\n\n` +
            `🧮 *Collection Stats*\n` +
            `🔹 Unique Collections: ${collections.length}\n` +
            `🔹 Total NFTs: ${nfts.length}\n\n` +
            `🎨 *Top Collections:*`;
        // Send the summary response
        yield ctx.reply(summaryResponse, { parse_mode: "Markdown" });
        // If there are collections, display top 5 collections by value
        if (collections.length > 0) {
            // Sort collections by value in USD
            const sortedCollections = [...collections]
                .sort((a, b) => (typeof b.valueUsd === 'number' ? b.valueUsd : 0) - (typeof a.valueUsd === 'number' ? a.valueUsd : 0))
                .slice(0, 5);
            // Process each collection
            for (const collection of sortedCollections) {
                const collectionValueUsd = typeof collection.valueUsd === 'number' ? collection.valueUsd : 0;
                const collectionValueSol = typeof collection.valueSol === 'number' ? collection.valueSol : 0;
                const floorPrice = typeof collection.floorPrice === 'number' ? collection.floorPrice : null;
                const nftCount = typeof collection.nftCount === 'number' ? collection.nftCount : 0;
                const collectionDetails = `*${collection.name || 'Unknown Collection'}*\n` +
                    `🔹 Value: $${collectionValueUsd.toFixed(2)} (${collectionValueSol.toFixed(4)} SOL)\n` +
                    `🔹 NFTs: ${nftCount}\n` +
                    `🔹 Floor Price: ${floorPrice !== null ? floorPrice.toFixed(4) : 'Unknown'} SOL`;
                yield ctx.reply(collectionDetails, { parse_mode: "Markdown" });
            }
            // If there are individual NFTs, let the user know they can see more
            if (nfts.length > 0) {
                yield ctx.reply(`*Note:* Your wallet contains ${nfts.length} individual NFTs. For a detailed view of each NFT, please use a Solana explorer.`, { parse_mode: "Markdown" });
            }
        }
        else {
            yield ctx.reply("No NFT collections found in this wallet.", { parse_mode: "Markdown" });
        }
    }
    catch (error) {
        console.error('Error fetching NFT data:', error);
        let errorMessage = 'Failed to fetch NFT data.';
        // Provide more specific error messages
        if (error.response) {
            if (error.response.status === 400) {
                errorMessage = 'Invalid wallet address. Please check and try again.';
            }
            else if (error.response.status === 500) {
                errorMessage = 'Server error occurred. Please try again later.';
            }
        }
        return ctx.reply(errorMessage);
    }
}));
// Token Balance command handler
bot.command("token_balance", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    // Get the wallet address from the message text
    const messageText = ((_b = (_a = ctx.message) === null || _a === void 0 ? void 0 : _a.text) === null || _b === void 0 ? void 0 : _b.trim()) || '';
    const args = messageText.split(' ').filter(Boolean).slice(1);
    const walletAddress = args[0];
    // Check if wallet address was provided
    if (!walletAddress) {
        return ctx.reply('Please provide a wallet address. Usage: /token_balance <wallet_address>');
    }
    // Set the API key
    vybe_api_1.default.auth(VYBE_API_KEY);
    try {
        // Notify user that we're fetching data
        yield ctx.reply(`Fetching current token balances for wallet: \`${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}\`...`, { parse_mode: "Markdown" });
        // Call the Vybe API to get wallet token balances
        // Using any type to handle complex parameter requirements
        const metadata = {
            ownerAddress: walletAddress,
            // Include default required parameters
            minAssetValue: '0',
            maxAssetValue: '9999999999'
        };
        const response = yield vybe_api_1.default.get_wallet_tokens(metadata);
        const tokenData = response.data;
        // Get the total portfolio value - field names match the actual API response
        const totalValueUsd = typeof tokenData.totalTokenValueUsd === 'number' ? tokenData.totalTokenValueUsd :
            typeof tokenData.totalTokenValueUsd === 'string' ? parseFloat(tokenData.totalTokenValueUsd) : 0;
        // Get native SOL value (we'll show this separately)
        const nativeSolBalance = typeof tokenData.stakedSolBalance === 'number' ? tokenData.stakedSolBalance :
            typeof tokenData.stakedSolBalance === 'string' ? parseFloat(tokenData.stakedSolBalance) : 0;
        // Get tokens array from the 'data' field in the response
        const tokens = Array.isArray(tokenData.data) ? tokenData.data : [];
        if (tokens.length === 0) {
            return ctx.reply("No token balances found for this wallet.", { parse_mode: "Markdown" });
        }
        // Format the summary
        const summaryResponse = `💰 *Token Balances for ${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}*\n\n` +
            `💸 *Portfolio Overview*\n` +
            `🔹 Total Value: $${totalValueUsd.toFixed(2)}\n` +
            `🔹 Staked SOL: ${nativeSolBalance.toFixed(4)} SOL\n` +
            `🔹 Unique Tokens: ${tokens.length}\n\n` +
            `📃 *Top Token Holdings:*`;
        yield ctx.reply(summaryResponse, { parse_mode: "Markdown" });
        // Sort tokens by USD value and show top 10
        const sortedTokens = [...tokens]
            .sort((a, b) => (typeof b.valueUsd === 'number' ? b.valueUsd : 0) - (typeof a.valueUsd === 'number' ? a.valueUsd : 0))
            .slice(0, 10);
        // Group tokens into batches of 5 for better readability
        const tokenBatches = [];
        for (let i = 0; i < sortedTokens.length; i += 5) {
            tokenBatches.push(sortedTokens.slice(i, i + 5));
        }
        // Process each batch
        for (let batchIndex = 0; batchIndex < tokenBatches.length; batchIndex++) {
            const batch = tokenBatches[batchIndex];
            let tokenDetailsMessage = ``;
            batch.forEach((token, index) => {
                var _a;
                const actualIndex = batchIndex * 5 + index + 1;
                const tokenValueUsd = typeof token.valueUsd === 'number' ? token.valueUsd :
                    typeof token.valueUsd === 'string' ? parseFloat(token.valueUsd) : 0;
                const tokenAmount = typeof token.amount === 'number' ? token.amount :
                    typeof token.amount === 'string' ? parseFloat(token.amount) : 0;
                // Format large numbers with commas and truncate very long decimal places
                const formattedAmount = tokenAmount > 1000000
                    ? `${(tokenAmount / 1000000).toFixed(2)}M`
                    : tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 4 });
                // Display token details
                tokenDetailsMessage += `*${actualIndex}. ${token.symbol || ((_a = token.mintAddress) === null || _a === void 0 ? void 0 : _a.substring(0, 6)) || 'Unknown'}*\n` +
                    `🔹 Value: $${tokenValueUsd.toFixed(2)}\n` +
                    `🔹 Amount: ${formattedAmount} tokens\n`;
                // Add price per token if available and not zero
                if (tokenAmount > 0 && token.priceUsd) {
                    const pricePerToken = typeof token.priceUsd === 'number' ? token.priceUsd :
                        typeof token.priceUsd === 'string' ? parseFloat(token.priceUsd) : tokenValueUsd / tokenAmount;
                    tokenDetailsMessage += `🔹 Price: $${pricePerToken.toFixed(6)} per token\n`;
                    // Add verified status and logo if available
                    if (token.verified === true) {
                        tokenDetailsMessage += `🔹 Verified: ✅\n`;
                    }
                    // Add token category if available
                    if (token.category) {
                        tokenDetailsMessage += `🔹 Category: ${token.category}\n`;
                    }
                }
                tokenDetailsMessage += `\n`;
            });
            yield ctx.reply(tokenDetailsMessage, { parse_mode: "Markdown" });
        }
        // Show note if there are more tokens
        if (tokens.length > 10) {
            yield ctx.reply(`*Note:* Showing top 10 tokens out of ${tokens.length} total tokens in this wallet.`, { parse_mode: "Markdown" });
        }
    }
    catch (error) {
        console.error('Error fetching token balance data:', error);
        let errorMessage = 'Failed to fetch token balances.';
        // Provide more specific error messages
        if (error.response) {
            if (error.response.status === 400) {
                errorMessage = 'Invalid wallet address. Please check and try again.';
            }
            else if (error.response.status === 500) {
                errorMessage = 'Server error occurred. Please try again later.';
            }
        }
        return ctx.reply(errorMessage);
    }
}));
// Report command handler - combines PnL, NFTs, and token balance data
bot.command("report", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    // Get the wallet address from the message text
    const messageText = ((_b = (_a = ctx.message) === null || _a === void 0 ? void 0 : _a.text) === null || _b === void 0 ? void 0 : _b.trim()) || '';
    const args = messageText.split(' ').filter(Boolean).slice(1);
    const walletAddress = args[0];
    // Check if wallet address was provided
    if (!walletAddress) {
        return ctx.reply('Please provide a wallet address. Usage: /report <wallet_address>');
    }
    // Set the API key
    vybe_api_1.default.auth(VYBE_API_KEY);
    try {
        // Notify user that we're fetching comprehensive data
        yield ctx.reply(`Generating wallet report for: \`${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}\`...`, { parse_mode: "Markdown" });
        // Start collecting data from all endpoints in parallel
        const [pnlResponse, nftResponse, tokenResponse] = yield Promise.allSettled([
            vybe_api_1.default.get_wallet_pnl({ ownerAddress: walletAddress, resolution: '1d' }).catch(() => null),
            vybe_api_1.default.get_wallet_nfts({ ownerAddress: walletAddress }).catch(() => null),
            vybe_api_1.default.get_wallet_tokens({
                ownerAddress: walletAddress,
                minAssetValue: '0',
                maxAssetValue: '9999999999'
            }).catch(() => null)
        ]);
        // Initialize report sections
        let pnlSection = "No PnL data available.";
        let nftSection = "No NFT data available.";
        let tokenSection = "No token data available.";
        // Process PnL data if available
        if (pnlResponse.status === 'fulfilled' && pnlResponse.value) {
            const pnlData = pnlResponse.value.data;
            const summary = pnlData.summary;
            // Format PnL section
            if (summary) {
                const totalPnl = (summary.realizedPnlUsd || 0) + (summary.unrealizedPnlUsd || 0);
                pnlSection = `💰 *Profit & Loss*\n` +
                    `🔹 Total PnL: $${totalPnl.toFixed(2)}\n` +
                    `🔹 Win Rate: ${((_c = summary.winRate) === null || _c === void 0 ? void 0 : _c.toFixed(2)) || 0}%\n` +
                    `🔹 Trades: ${summary.tradesCount || 0}\n` +
                    `🔹 Volume: $${(summary.tradesVolumeUsd || 0).toFixed(2)}`;
                // Add best and worst token if available
                if (summary.bestPerformingToken) {
                    pnlSection += `\n🏆 Best: ${summary.bestPerformingToken.tokenSymbol || 'Unknown'} ($${((_d = summary.bestPerformingToken.pnlUsd) === null || _d === void 0 ? void 0 : _d.toFixed(2)) || '0.00'})`;
                }
                if (summary.worstPerformingToken) {
                    pnlSection += `\n📉 Worst: ${summary.worstPerformingToken.tokenSymbol || 'Unknown'} ($${((_e = summary.worstPerformingToken.pnlUsd) === null || _e === void 0 ? void 0 : _e.toFixed(2)) || '0.00'})`;
                }
            }
        }
        // Process NFT data if available
        if (nftResponse.status === 'fulfilled' && nftResponse.value) {
            const nftData = nftResponse.value.data;
            // Get values, ensuring they're numbers
            const totalValueUsd = typeof nftData.totalValueUsd === 'number' ? nftData.totalValueUsd :
                typeof nftData.totalValueUsd === 'string' ? parseFloat(nftData.totalValueUsd) : 0;
            const totalValueSol = typeof nftData.totalValueSol === 'number' ? nftData.totalValueSol :
                typeof nftData.totalValueSol === 'string' ? parseFloat(nftData.totalValueSol) : 0;
            // Get collections and NFTs as arrays
            const collections = Array.isArray(nftData.collections) ? nftData.collections : [];
            const nfts = Array.isArray(nftData.nfts) ? nftData.nfts : [];
            // Format NFT section
            nftSection = `📦 *NFT Portfolio*\n` +
                `🔹 Value: $${totalValueUsd.toFixed(2)} (${totalValueSol.toFixed(4)} SOL)\n` +
                `🔹 Collections: ${collections.length}\n` +
                `🔹 Total NFTs: ${nfts.length}`;
            // Add top collection if available
            if (collections.length > 0) {
                // Sort by value
                const topCollection = [...collections]
                    .sort((a, b) => (typeof b.valueUsd === 'number' ? b.valueUsd : 0) - (typeof a.valueUsd === 'number' ? a.valueUsd : 0))[0];
                if (topCollection) {
                    const collectionValueUsd = typeof topCollection.valueUsd === 'number' ? topCollection.valueUsd : 0;
                    nftSection += `\n🎨 Top Collection: ${topCollection.name || 'Unknown'} ($${collectionValueUsd.toFixed(2)})`;
                }
            }
        }
        // Process token data if available
        if (tokenResponse.status === 'fulfilled' && tokenResponse.value) {
            const tokenData = tokenResponse.value.data;
            // Get the total portfolio value
            const totalValueUsd = typeof tokenData.totalTokenValueUsd === 'number' ? tokenData.totalTokenValueUsd :
                typeof tokenData.totalTokenValueUsd === 'string' ? parseFloat(tokenData.totalTokenValueUsd) : 0;
            // Get staked SOL value
            const nativeSolBalance = typeof tokenData.stakedSolBalance === 'number' ? tokenData.stakedSolBalance :
                typeof tokenData.stakedSolBalance === 'string' ? parseFloat(tokenData.stakedSolBalance) : 0;
            // Get tokens array
            const tokens = Array.isArray(tokenData.data) ? tokenData.data : [];
            // Format token section
            tokenSection = `💸 *Token Balances*\n` +
                `🔹 Total Value: $${totalValueUsd.toFixed(2)}\n` +
                `🔹 Staked SOL: ${nativeSolBalance.toFixed(4)} SOL\n` +
                `🔹 Unique Tokens: ${tokens.length}`;
            // Add top 3 tokens if available
            if (tokens.length > 0) {
                // Sort tokens by USD value and get top 3
                const topTokens = [...tokens]
                    .sort((a, b) => (typeof b.valueUsd === 'number' ? b.valueUsd :
                    typeof b.valueUsd === 'string' ? parseFloat(b.valueUsd) : 0) -
                    (typeof a.valueUsd === 'number' ? a.valueUsd :
                        typeof a.valueUsd === 'string' ? parseFloat(a.valueUsd) : 0))
                    .slice(0, 3);
                if (topTokens.length > 0) {
                    tokenSection += `\n\n*Top Tokens:*`;
                    topTokens.forEach((token, index) => {
                        var _a;
                        const tokenValueUsd = typeof token.valueUsd === 'number' ? token.valueUsd :
                            typeof token.valueUsd === 'string' ? parseFloat(token.valueUsd) : 0;
                        tokenSection += `\n${index + 1}. ${token.symbol || ((_a = token.mintAddress) === null || _a === void 0 ? void 0 : _a.substring(0, 6)) || 'Unknown'}: $${tokenValueUsd.toFixed(2)}`;
                    });
                }
            }
        }
        // Combine all sections into a comprehensive report
        const reportHeader = `📋 *WALLET REPORT*\n` +
            `👤 *${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}*\n` +
            `📅 *${new Date().toISOString().split('T')[0]}*\n\n`;
        // Send main report with sections
        yield ctx.reply(reportHeader + pnlSection, { parse_mode: "Markdown" });
        yield ctx.reply(nftSection, { parse_mode: "Markdown" });
        yield ctx.reply(tokenSection, { parse_mode: "Markdown" });
        // Add a footer with instructions on how to get more detailed information
        // Use plain text to avoid any Markdown parsing issues
        const reportFooter = "For more detailed information, try using these commands with your wallet address:\n" +
            "/pnl - Full profit & loss details\n" +
            "/nfts - Complete NFT portfolio\n" +
            "/token_balance - All token holdings";
        yield ctx.reply(reportFooter);
    }
    catch (error) {
        console.error('Error generating wallet report:', error);
        // More specific error message
        let errorMessage = 'Failed to generate wallet report. Please try again later.';
        // If it's a Telegram API error, provide better guidance
        if (error.description && error.description.includes("can't parse entities")) {
            errorMessage = 'Error formatting report. This is likely due to special characters in the data.';
        }
        return ctx.reply(errorMessage);
    }
}));
// Top Holders command - shows the top 10 holders of a given token
bot.command("top_holders", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    // Get the token address from the message text
    const messageText = ((_b = (_a = ctx.message) === null || _a === void 0 ? void 0 : _a.text) === null || _b === void 0 ? void 0 : _b.trim()) || '';
    const args = messageText.split(' ').filter(Boolean).slice(1);
    const tokenMintAddress = args[0];
    // Check if token mint address was provided
    if (!tokenMintAddress) {
        return ctx.reply('Please provide a token mint address. Usage: /top_holders <token_mint_address>');
    }
    // Set the API key
    vybe_api_1.default.auth(VYBE_API_KEY);
    try {
        // Notify user that we're fetching data
        yield ctx.reply(`Fetching top holders for token: \`${tokenMintAddress.substring(0, 6)}...${tokenMintAddress.substring(tokenMintAddress.length - 4)}\`...`, { parse_mode: "Markdown" });
        console.log(`Calling Vybe API to get top holders for: ${tokenMintAddress}`);
        // Fetch top holders data with a timeout promise
        const response = yield vybe_api_1.default.get_top_holders({
            mintAddress: tokenMintAddress,
            limit: 100 // Fetch 100 holders to have more to filter from
        });
        console.log('API Response:', JSON.stringify(response, null, 2));
        // Check if response has data
        if (!response) {
            return ctx.reply(`Error: No response received from API for token: ${tokenMintAddress}`);
        }
        if (!response.data) {
            return ctx.reply(`Error: Response missing data property for token: ${tokenMintAddress}`);
        }
        // Handle the nested data structure (response.data.data)
        if (!response.data.data) {
            return ctx.reply(`Error: Response missing nested data property for token: ${tokenMintAddress}`);
        }
        let holders = response.data.data;
        if (!Array.isArray(holders)) {
            return ctx.reply(`Error: Expected array but got ${typeof holders} for token: ${tokenMintAddress}`);
        }
        if (holders.length === 0) {
            return ctx.reply(`No holders found for token: ${tokenMintAddress}`);
        }
        // Load and parse the known accounts file
        try {
            const knownAccountsPath = path.join(__dirname, 'knownaccounts.json');
            console.log('Loading known accounts from:', knownAccountsPath);
            if (fs.existsSync(knownAccountsPath)) {
                const knownAccountsData = fs.readFileSync(knownAccountsPath, 'utf8');
                const knownAccounts = JSON.parse(knownAccountsData);
                // Extract the list of known account addresses
                const knownAddresses = knownAccounts.accounts.map((account) => account.ownerAddress);
                console.log(`Loaded ${knownAddresses.length} known accounts`);
                // Filter out the known addresses
                const originalLength = holders.length;
                holders = holders.filter((holder) => !knownAddresses.includes(holder.ownerAddress));
                console.log(`Filtered out ${originalLength - holders.length} known accounts`);
            }
            else {
                console.log('Known accounts file not found, proceeding with all holders');
            }
        }
        catch (error) {
            console.error('Error loading or parsing known accounts:', error);
            // Continue with the original holders list if there's an error
        }
        // Get the token symbol from the first holder's data
        const tokenSymbol = holders[0].tokenSymbol || "Unknown";
        // Create the header message
        const headerMessage = `🏆 *TOP ${Math.min(10, holders.length)} HOLDERS OF ${tokenSymbol}*\n` +
            `Token: \`${tokenMintAddress}\`\n\n`;
        // Create the holders list message
        let holdersMessage = '';
        // Take the top 10 from the filtered list
        // Sort by balance (descending) first to ensure we're showing the actual top holders
        holders.sort((a, b) => {
            const balanceA = typeof a.balance === 'number' ? a.balance : parseFloat(a.balance || '0');
            const balanceB = typeof b.balance === 'number' ? b.balance : parseFloat(b.balance || '0');
            return balanceB - balanceA;
        });
        const topHolders = holders.slice(0, 10);
        // Process each holder
        topHolders.forEach((holder, index) => {
            // Format owner address for display - show full address for copying
            const ownerDisplay = holder.ownerName ?
                `${holder.ownerName}\n\`${holder.ownerAddress}\`` :
                `\`${holder.ownerAddress}\``;
            // Format balance with commas and fixed decimal places
            const formattedBalance = Number(parseFloat(holder.balance)).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
            // Format value in USD
            const valueUsd = typeof holder.valueUsd === 'number' ? holder.valueUsd :
                typeof holder.valueUsd === 'string' ? parseFloat(holder.valueUsd) : 0;
            const formattedValueUsd = valueUsd.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
            // Format percentage with fixed decimal places
            const percentageOfSupply = typeof holder.percentageOfSupplyHeld === 'number' ? holder.percentageOfSupplyHeld :
                typeof holder.percentageOfSupplyHeld === 'string' ? parseFloat(holder.percentageOfSupplyHeld) : 0;
            const formattedPercentage = percentageOfSupply.toFixed(2);
            // Define number emojis for ranking
            const numberEmojis = [
                '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'
            ];
            // Create the line for this holder with emoji numbers and the wallet address on a separate line
            const holderLine = `${numberEmojis[index]} ${holder.ownerName || ''}\n` +
                `\`${holder.ownerAddress}\`\n` +
                `   • Balance: ${formattedBalance} ${tokenSymbol}\n` +
                `   • Value: $${formattedValueUsd}\n` +
                `   • % of Supply: ${formattedPercentage}%\n\n`;
            holdersMessage += holderLine;
        });
        // Send the combined message with header and holders list
        yield ctx.reply(headerMessage + holdersMessage, { parse_mode: "Markdown" });
    }
    catch (error) {
        console.error('Error fetching top holders:', error);
        const errorMessage = error.message || 'Unknown error';
        const errorResponse = error.response ? JSON.stringify(error.response.data || {}, null, 2) : 'No response data';
        console.error('API Error details:', errorMessage, errorResponse);
        // Check for timeout or connection errors
        if (errorMessage.includes('timeout') ||
            errorMessage.includes('ConnectTimeoutError') ||
            errorMessage.includes('fetch failed') ||
            (error.cause && error.cause.code === 'UND_ERR_CONNECT_TIMEOUT')) {
            return ctx.reply('⚠️ Unable to connect to the Vybe API server. The service might be temporarily unavailable. Please try again later.');
        }
        return ctx.reply(`Failed to fetch top holders: ${errorMessage}. Please try again later.`);
    }
}));
// Start the bot
bot.start();
console.log('Alayeseke bot is running!');
console.log('Bot is using Vybe API with authenticated key');
