import * as supabaseService from './supabaseService';

// Use environment variable or fallback to localhost
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

class MultiplayerGameService {
  constructor() {
    // Push Chain integration via UI Kit
    // All blockchain interactions use Push Chain wallet
    
    this.CONTRACT_ADDRESS = process.env.REACT_APP_MULTIPLAYER_GAME_CONTRACT;
    
    this.BET_TIERS = [
      { 
        id: 1, 
        amount: 0.1, 
        label: "Casual", 
        wei: "100000000000000000", // 0.1 PC in wei
        description: "Perfect for beginners",
        token: "PC",
        tokenName: "Push Chain",
        color: "#2ED8A7",
        borderColor: "#2ED8A7",
        glowColor: "rgba(46, 216, 167, 0.3)"
      },
      { 
        id: 2, 
        amount: 0.5, 
        label: "Standard", 
        wei: "500000000000000000", // 0.5 PC in wei
        description: "Most popular choice",
        token: "PC",
        tokenName: "Push Chain",
        color: "#2ED8A7",
        borderColor: "#FFD700",
        glowColor: "rgba(255, 215, 0, 0.3)"
      },
      { 
        id: 3, 
        amount: 1, 
        label: "Competitive", 
        wei: "1000000000000000000", // 1 PC in wei
        description: "For serious players",
        token: "PC",
        tokenName: "Push Chain",
        color: "#2ED8A7",
        borderColor: "#FF6B6B",
        glowColor: "rgba(255, 107, 107, 0.3)"
      },
      { 
        id: 4, 
        amount: 5, 
        label: "High Stakes", 
        wei: "5000000000000000000", // 5 PC in wei
        description: "Big risk, big reward",
        token: "PC",
        tokenName: "Push Chain",
        color: "#2ED8A7",
        borderColor: "#9D4EDD",
        glowColor: "rgba(157, 78, 221, 0.3)"
      },
    ];
  }

  async createGame(betTier, pushChainService, walletAddress) {
    try {
      // Validate inputs
      if (!pushChainService || !pushChainService.isInitialized) {
        throw new Error('Push Chain service not initialized. Please connect your wallet.');
      }

      if (!walletAddress) {
        throw new Error('Wallet address is required to create a game');
      }

      // Get tier info
      const tierInfo = this.BET_TIERS.find(t => t.id === betTier);
      if (!tierInfo) throw new Error('Invalid bet tier');

      console.log('🎮 Creating game on blockchain...', { betTier: tierInfo.id, amount: tierInfo.wei });

      // Create game on blockchain
      const result = await pushChainService.createMultiplayerGame(tierInfo.id, walletAddress);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create game on blockchain');
      }
      
      const { transactionHash, gameId } = result;
      console.log('✅ Blockchain transaction successful:', { gameId, txHash: transactionHash });
      
      // Save to Supabase immediately (don't wait for indexer)
      console.log('💾 Saving game to Supabase...');
      const saveResult = await supabaseService.createGame({
        game_id: gameId,
        bet_amount: tierInfo.wei,
        bet_tier: tierInfo.id,
        player1_address: walletAddress,
        creation_tx_hash: transactionHash
      });
      
      if (saveResult.success) {
        console.log('✅ Game saved to Supabase:', saveResult.data);
      } else {
        console.warn('⚠️ Failed to save to Supabase (indexer will handle):', saveResult.error);
      }
      
      return { 
        success: true, 
        transactionHash, 
        gameId,
        tier: tierInfo 
      };
    } catch (error) {
      console.error('❌ Failed to create game:', error);
      return { success: false, error: error.message };
    }
  }

  async joinGame(gameId, pushChainService, walletAddress) {
    try {
      // Validate inputs
      if (!pushChainService || !pushChainService.isInitialized) {
        throw new Error('Push Chain service not initialized. Please connect your wallet.');
      }

      if (!walletAddress) {
        throw new Error('Wallet address is required to join a game');
      }

      console.log('🎮 Joining game on blockchain...', { gameId, player: walletAddress });

      // Join game on blockchain
      const result = await pushChainService.joinMultiplayerGame(gameId);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to join game on blockchain');
      }
      
      const { transactionHash } = result;
      console.log('✅ Blockchain transaction successful:', { gameId, txHash: transactionHash });
      
      // Update Supabase immediately
      console.log('💾 Updating game in Supabase...');
      const updateResult = await supabaseService.updateGameJoin(
        gameId, 
        walletAddress, 
        transactionHash
      );
      
      if (updateResult.success) {
        console.log('✅ Game updated in Supabase:', updateResult.data);
      } else {
        console.warn('⚠️ Failed to update Supabase (indexer will handle):', updateResult.error);
      }
      
      return { success: true, transactionHash, gameId };
    } catch (error) {
      console.error('❌ Failed to join game:', error);
      return { success: false, error: error.message };
    }
  }

  async submitScore(gameId, finalScore, pushChainService, walletAddress) {
    try {
      // Use Push Chain service which handles wallet via UI Kit
      if (!pushChainService || !pushChainService.isInitialized) {
        throw new Error('Push Chain service not initialized. Please connect your wallet.');
      }

      // Validate wallet address
      if (!walletAddress) {
        throw new Error('Wallet address is required to submit score');
      }

      // Submit score via Push Chain contract, passing wallet address explicitly
      const result = await pushChainService.submitMultiplayerScore(gameId, finalScore, walletAddress);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to submit score');
      }
      
      const { transactionHash } = result;
      
      // Report game completion to backend (so it gets removed from cache)
      try {
        await fetch(`${API_BASE_URL}/api/games/${gameId}/finish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionHash: transactionHash
          })
        });
      } catch (backendError) {
        console.warn('Backend unavailable for game finish notification');
      }
      
      return { success: true, transactionHash };
    } catch (error) {
      // Check if error is expected (game already ended, already submitted)
      const isExpectedError = error.message && (
        error.message.includes('already submitted') ||
        error.message.includes('already ended') ||
        error.message.includes('Transaction failed')
      );
      
      if (!isExpectedError) {
        console.error('Failed to submit score:', error);
      }
      
      return { success: false, error: error.message };
    }
  }

  async getAvailableGames() {
    try {
      // Use Supabase for global multiplayer
      const games = await supabaseService.getAvailableGames();
      
      return games.map(g => ({
        game_id: g.game_id,
        bet_amount: g.bet_amount,
        bet_tier: g.bet_tier,
        player1: g.player1_address,
        player2: g.player2_address || '0x0',
        state: g.state || 0,
        created_at: g.created_at
      }));
    } catch (error) {
      console.error('Failed to fetch games from Supabase:', error);
      return [];
    }
  }

  // localStorage methods removed - now using Supabase for global multiplayer

  async getGameCreatedEvents() {
    try {
      const response = await this.aptos.getAccountTransactions({
        accountAddress: this.MODULE_ADDRESS,
      });
      
      const createdGames = [];
      response.forEach(tx => {
        if (tx.events) {
          tx.events.forEach(event => {
            if (event.type && event.type.includes('GameCreatedEvent')) {
              createdGames.push({
                data: {
                  game_id: event.data.game_id,
                  creator: event.data.creator,
                  bet_amount: event.data.bet_amount,
                  timestamp: event.data.timestamp || Date.now()
                }
              });
            }
          });
        }
      });
      
      return createdGames;
    } catch (error) {
      console.error('Failed to fetch GameCreated events:', error);
      return [];
    }
  }

  async getGameJoinedEvents() {
    try {
      const response = await this.aptos.getAccountTransactions({
        accountAddress: this.MODULE_ADDRESS,
      });
      
      const joinedGames = [];
      response.forEach(tx => {
        if (tx.events) {
          tx.events.forEach(event => {
            if (event.type && event.type.includes('GameJoinedEvent')) {
              joinedGames.push({
                data: {
                  game_id: event.data.game_id,
                  player: event.data.player,
                  bet_amount: event.data.bet_amount,
                  timestamp: event.data.timestamp || Date.now()
                }
              });
            }
          });
        }
      });
      
      return joinedGames;
    } catch (error) {
      console.error('Failed to fetch GameJoined events:', error);
      return [];
    }
  }

  async getPlayerStats(address) {
    try {
      // Return default stats - view function has issues
      return {
        games_played: 0,
        games_won: 0,
        total_wagered: 0,
        total_winnings: 0
      };
    } catch (error) {
      return {
        games_played: 0,
        games_won: 0,
        total_wagered: 0,
        total_winnings: 0
      };
    }
  }

  async getGame(gameId) {
    try {
      const result = await this.aptos.view({
        function: `${this.MODULE_ADDRESS}::${this.MODULE_NAME}::get_game`,
        type_arguments: [],
        arguments: [this.MODULE_ADDRESS, gameId.toString()]
      });

      if (!result || result.length === 0) return null;

      return {
        game_id: gameId,
        player1: result[0],
        player2: result[1],
        bet_amount: result[2],
        state: parseInt(result[3]),
        player1_score: parseInt(result[4]),
        player2_score: parseInt(result[5]),
        winner: result[6]
      };
    } catch (error) {
      console.error('Failed to fetch game:', error);
      return null;
    }
  }

  getBetTiers() {
    return this.BET_TIERS;
  }

  formatAddress(address) {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  normalizeAddress(address) {
    if (!address) return '';
    return address.toLowerCase().startsWith('0x') ? address.toLowerCase() : `0x${address.toLowerCase()}`;
  }

  compareAddresses(addr1, addr2) {
    return this.normalizeAddress(addr1) === this.normalizeAddress(addr2);
  }
}

export default new MultiplayerGameService();
