# Alayeseke Bot

A powerful Telegram bot that provides Solana blockchain data analysis through the Vybe API.

## Features

Alayeseke Bot offers a comprehensive set of commands to analyze Solana blockchain data:

### Portfolio Commands
- `/pnl` - Check wallet profit and loss
- `/report` - Get detailed wallet report
- `/nfts` - View NFT portfolio
- `/token_history` - View token balance history

### Token Commands
- `/top_holders` - View top holders of a token
- `/price` - Check token price with OHLC data
- `/transfers` - View recent token transfers
- `/trades` - View recent token trades

### Program & Market Commands
- `/program` - Get program details
- `/program_activity` - Check program activity
- `/market` - Check market OHLC data
- `/pair` - Check trading pair data

### Other Commands
- `/holder_portfolio` - Examine a specific holder's portfolio
- `/help` - Show this help message

## Architecture

The bot is built using TypeScript and leverages the Vybe API to fetch Solana blockchain data. It uses the GrammY framework for Telegram bot functionality.

```mermaid
sequenceDiagram
    participant User as Telegram User
    participant Bot as Alayeseke Bot
    participant VybeAPI as Vybe API
    participant Solana as Solana Blockchain

    User->>Bot: Send command (e.g., /pnl address)
    Bot->>Bot: Parse command & parameters
    Bot->>User: Acknowledge request
    
    alt Portfolio Commands
        Bot->>VybeAPI: Request wallet data
        VybeAPI->>Solana: Query blockchain data
        Solana->>VybeAPI: Return blockchain data
        VybeAPI->>Bot: Return formatted data
        Bot->>Bot: Process and format response
    else Token Commands
        Bot->>VybeAPI: Request token data
        VybeAPI->>Solana: Query token data
        Solana->>VybeAPI: Return token data
        VybeAPI->>Bot: Return formatted data
        Bot->>Bot: Process and format response
    else Program Commands
        Bot->>VybeAPI: Request program data
        VybeAPI->>Solana: Query program data
        Solana->>VybeAPI: Return program data
        VybeAPI->>Bot: Return formatted data
        Bot->>Bot: Process and format response
    else Market Commands
        Bot->>VybeAPI: Request market data
        VybeAPI->>Solana: Query market data
        Solana->>VybeAPI: Return market data
        VybeAPI->>Bot: Return formatted data
        Bot->>Bot: Process and format response
    end
    
    Bot->>User: Send formatted response
```

## Technical Implementation

The bot is implemented with the following components:

1. **Command Handlers**: Each command has a dedicated handler function that processes user input and calls the appropriate API methods.

2. **API Integration**: The bot uses a typed wrapper around the Vybe API to handle API requests with proper error handling and retries.

3. **Response Formatting**: Responses are formatted in Markdown for better readability with emojis and structured data.

4. **Error Handling**: Comprehensive error handling ensures the bot remains responsive even when API calls fail.

5. **Retry Mechanism**: A retry mechanism is implemented to handle temporary API failures.

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file with the following variables:
   ```
   TELEGRAM_TOKEN=your_telegram_token
   VYBE_API_KEY=your_vybe_api_key
   ```
4. Start the bot:
   ```
   npm start
   ```

## Development

The project is written in TypeScript and uses the following technologies:

- [GrammY](https://grammy.dev/) - Telegram Bot Framework
- [Vybe API](https://docs.vybe.xyz/) - Solana Data API
- [TypeScript](https://www.typescriptlang.org/) - Programming Language
- [dotenv](https://www.npmjs.com/package/dotenv) - Environment Variable Management

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
