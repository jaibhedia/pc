import { PushChain } from '@pushchain/core';
import { ethers } from 'ethers';

// Import contract ABIs (you'll need to generate these after compiling contracts)
import GameNFTABI from '../contract_abis/GameNFT.json';
import MultiplayerGameABI from '../contract_abis/MultiplayerGame.json';

class PushChainGameService {
  constructor() {
    this.isInitialized = false;
    this.pushChainClient = null;
    this.provider = null;
    this.signer = null;
    this.gameNFTContract = null;
    this.multiplayerGameContract = null;
    
    // Contract addresses (update after deployment)
    this.GAME_NFT_ADDRESS = process.env.REACT_APP_GAME_NFT_CONTRACT;
    this.MULTIPLAYER_GAME_ADDRESS = process.env.REACT_APP_MULTIPLAYER_GAME_CONTRACT;
    
    // Push Chain RPC URL
    this.PUSH_RPC_URL = process.env.REACT_APP_PUSH_RPC_URL || 'https://evm.donut.rpc.push.org/';
    this.PUSH_NETWORK = process.env.REACT_APP_PUSH_NETWORK === 'mainnet' 
      ? PushChain.CONSTANTS.PUSH_NETWORK.MAINNET 
      : PushChain.CONSTANTS.PUSH_NETWORK.TESTNET;
  }

  /**
   * Initialize Push Chain client with wallet context
   * This should be called from the component using usePushChainClient hook
   */
  async initialize(pushChainClient) {
    try {
      if (!pushChainClient) {
        console.warn('⚠️ Push Chain client not provided, skipping initialization');
        return;
      }

      this.pushChainClient = pushChainClient;
      
      // Create ethers provider from Push Chain RPC
      this.provider = new ethers.JsonRpcProvider(this.PUSH_RPC_URL);
      
      // For now, use browser provider for signing (MetaMask, etc)
      if (window.ethereum) {
        const browserProvider = new ethers.BrowserProvider(window.ethereum);
        this.signer = await browserProvider.getSigner();
      } else {
        console.warn('⚠️ No Ethereum provider found, contract interactions will be read-only');
        this.signer = null;
      }
      
      // Initialize contract instances
      if (this.GAME_NFT_ADDRESS) {
        this.gameNFTContract = new ethers.Contract(
          this.GAME_NFT_ADDRESS,
          GameNFTABI,
          this.signer || this.provider
        );
      }
      
      if (this.MULTIPLAYER_GAME_ADDRESS) {
        this.multiplayerGameContract = new ethers.Contract(
          this.MULTIPLAYER_GAME_ADDRESS,
          MultiplayerGameABI,
          this.signer || this.provider
        );
      }
      
      this.isInitialized = true;
      // Only log once on initialization, not on every call
      if (!this._hasLoggedInit) {
        console.log('✅ Push Chain Game Service initialized');
        this._hasLoggedInit = true;
      }
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Push Chain service:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Get wallet address
   */
  getWalletAddress() {
    return this.pushChainClient?.universal?.account?.address || null;
  }

  /**
   * Check if wallet is connected
   */
  isWalletConnected() {
    return this.isInitialized && this.pushChainClient !== null;
  }

  // ==================== Game NFT Functions ====================

  /**
   * Start a new game session
   */
  async startGameSession() {
    if (!this.isInitialized || !this.gameNFTContract) {
      throw new Error('Service not initialized or contract not found');
    }

    try {
      console.log('🎮 Starting game session...');
      
      const tx = await this.gameNFTContract.startGame();
      const receipt = await tx.wait();
      
      // Extract tokenId from GameCreated event
      const event = receipt.logs.find(log => {
        try {
          const parsed = this.gameNFTContract.interface.parseLog(log);
          return parsed.name === 'GameCreated';
        } catch {
          return false;
        }
      });
      
      const parsedEvent = this.gameNFTContract.interface.parseLog(event);
      const tokenId = parsedEvent.args.tokenId;
      
      console.log('✅ Game session started! Token ID:', tokenId.toString());
      
      return {
        success: true,
        tokenId: tokenId.toString(),
        transactionHash: receipt.hash,
        message: 'Game started! Play and mint your NFT when done.'
      };
    } catch (error) {
      console.error('❌ Failed to start game session:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to start game' 
      };
    }
  }

  /**
   * Record a slash (on-chain)
   */
  async recordSlash(tokenId, slashData) {
    if (!this.isInitialized || !this.gameNFTContract) {
      throw new Error('Service not initialized');
    }

    try {
      const tx = await this.gameNFTContract.recordSlash(
        tokenId,
        slashData.tokenType || 0,
        slashData.points || 0,
        Math.floor(slashData.velocityX || 0),
        Math.floor(slashData.velocityY || 0)
      );
      
      await tx.wait();
      console.log('📝 Slash recorded on-chain');
      
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to record slash:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mint NFT with game results
   */
  async mintGameNFT(gameStats) {
    if (!this.isInitialized || !this.gameNFTContract) {
      throw new Error('Service not initialized');
    }

    try {
      console.log('🎨 Minting game NFT...');
      
      // Validate gameStats
      if (!gameStats || typeof gameStats !== 'object') {
        throw new Error('Invalid game stats provided');
      }
      
      // Generate unique token ID based on timestamp and wallet
      const tokenId = Date.now();
      
      // Generate token URI (you can customize this or use IPFS)
      const tokenURI = `data:application/json;base64,${btoa(JSON.stringify({
        name: `Push Ninja Game #${tokenId}`,
        description: `Score: ${gameStats.score} | Combo: ${gameStats.maxCombo}x`,
        image: 'https://push-ninja.game/nft-image.png',
        attributes: [
          { trait_type: 'Score', value: gameStats.score },
          { trait_type: 'Max Combo', value: gameStats.maxCombo },
          { trait_type: 'Tokens Sliced', value: gameStats.tokensSliced },
          { trait_type: 'Total Slashes', value: gameStats.totalSlashes },
        ]
      }))}`;
      
      const tx = await this.gameNFTContract.mintGameNFT(
        tokenId,
        gameStats.score,
        gameStats.maxCombo,
        gameStats.tokensSliced,
        gameStats.totalSlashes,
        gameStats.bombsHit || 0,
        gameStats.tokensMissed || 0,
        tokenURI
      );
      
      const receipt = await tx.wait();
      
      console.log('✅ NFT minted successfully!');
      
      return {
        success: true,
        tokenId: tokenId,
        transactionHash: receipt.hash,
        message: 'NFT minted successfully!'
      };
    } catch (error) {
      console.error('❌ Failed to mint NFT:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to mint NFT' 
      };
    }
  }

  /**
   * Get player statistics
   */
  async getPlayerStats(address) {
    if (!this.gameNFTContract) {
      throw new Error('Contract not initialized');
    }

    try {
      const stats = await this.gameNFTContract.getPlayerStats(
        address || this.getWalletAddress()
      );
      
      return {
        totalGames: stats.totalGames.toString(),
        totalScore: stats.totalScore.toString(),
        totalSlashes: stats.totalSlashes.toString(),
        highestScore: stats.highestScore.toString(),
        nftsMinted: stats.nftsMinted.toString(),
      };
    } catch (error) {
      console.error('❌ Failed to get player stats:', error);
      return null;
    }
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(limit = 10) {
    if (!this.gameNFTContract) {
      throw new Error('Contract not initialized');
    }

    try {
      const leaderboard = await this.gameNFTContract.getLeaderboard(limit);
      return leaderboard.map(entry => ({
        player: entry.player,
        score: entry.score.toString(),
        tokenId: entry.tokenId.toString(),
        timestamp: entry.timestamp.toString(),
      }));
    } catch (error) {
      console.error('❌ Failed to get leaderboard:', error);
      return [];
    }
  }

  // ==================== Multiplayer Game Functions ====================

  /**
   * Create a new multiplayer game
   */
  async createMultiplayerGame(betTier, walletAddressOverride = null) {
    if (!this.isInitialized || !this.multiplayerGameContract) {
      throw new Error('Service not initialized');
    }

    try {
      const betAmount = await this.multiplayerGameContract.getBetAmount(betTier);
      
      const tx = await this.multiplayerGameContract.createGame(betTier, {
        value: betAmount
      });
      
      const receipt = await tx.wait();
      
      // Extract gameId from GameCreated event
      const event = receipt.logs.find(log => {
        try {
          const parsed = this.multiplayerGameContract.interface.parseLog(log);
          return parsed.name === 'GameCreated';
        } catch {
          return false;
        }
      });
      
      const parsedEvent = this.multiplayerGameContract.interface.parseLog(event);
      const gameId = parsedEvent.args.gameId;
      
      // Use provided wallet address or try to get from signer
      let walletAddress = walletAddressOverride;
      if (!walletAddress && this.signer) {
        walletAddress = await this.signer.getAddress();
      }
      if (!walletAddress) {
        walletAddress = this.getWalletAddress();
      }
      
      console.log('✅ Multiplayer game created! Game ID:', gameId.toString());
      
      return {
        success: true,
        gameId: gameId.toString(),
        transactionHash: receipt.hash,
        walletAddress: walletAddress
      };
    } catch (error) {
      console.error('❌ Failed to create game:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Join an existing multiplayer game
   */
  async joinMultiplayerGame(gameId) {
    if (!this.isInitialized || !this.multiplayerGameContract) {
      throw new Error('Service not initialized');
    }

    try {
      const game = await this.multiplayerGameContract.getGame(gameId);
      
      const tx = await this.multiplayerGameContract.joinGame(gameId, {
        value: game.betAmount
      });
      
      const receipt = await tx.wait();
      
      // Get wallet address
      const walletAddress = await this.getWalletAddress();
      
      console.log('✅ Joined multiplayer game!');
      
      return {
        success: true,
        gameId: gameId,
        transactionHash: receipt.hash,
        walletAddress: walletAddress
      };
    } catch (error) {
      console.error('❌ Failed to join game:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Submit score for multiplayer game
   */
  async submitMultiplayerScore(gameId, score, walletAddressOverride = null) {
    if (!this.isInitialized || !this.multiplayerGameContract) {
      throw new Error('Service not initialized');
    }

    try {
      console.log(`📊 Submitting score: Game ID ${gameId}, Score ${score}`);
      
      // Get wallet address - try multiple sources
      let walletAddress = walletAddressOverride;
      if (!walletAddress && this.signer) {
        walletAddress = await this.signer.getAddress();
      }
      if (!walletAddress) {
        walletAddress = this.getWalletAddress();
      }
      
      if (!walletAddress) {
        throw new Error('Could not determine wallet address. Please ensure your wallet is connected.');
      }
      
      // Check if the game exists and get its state
      let game;
      try {
        // Validate wallet address before fetching game state
        if (!walletAddress) {
          console.warn('⚠️ No wallet address provided for game state check');
          // Skip pre-flight checks and proceed with transaction
          throw new Error('Skip pre-flight - no wallet address');
        }
        
        game = await this.multiplayerGameContract.getGame(gameId);
        console.log('🎮 Current game state:', {
          gameId,
          player1: game.player1,
          player2: game.player2,
          betAmount: game.betAmount.toString(),
          state: game.state.toString(),
          player1Score: game.player1Score.toString(),
          player2Score: game.player2Score.toString(),
          player1Finished: game.player1Finished,
          player2Finished: game.player2Finished,
          winner: game.winner
        });

        // Check if this player has already submitted their score
        const isPlayer1 = game.player1.toLowerCase() === walletAddress.toLowerCase();
        const isPlayer2 = game.player2.toLowerCase() === walletAddress.toLowerCase();
        
        if (!isPlayer1 && !isPlayer2) {
          throw new Error('You are not a player in this game');
        }
        
        if (isPlayer1 && game.player1Finished) {
          console.log('⚠️ Player 1 has already submitted their score');
          return {
            success: true,
            alreadySubmitted: true,
            message: 'Score already submitted'
          };
        }
        
        if (isPlayer2 && game.player2Finished) {
          console.log('⚠️ Player 2 has already submitted their score');
          return {
            success: true,
            alreadySubmitted: true,
            message: 'Score already submitted'
          };
        }

        // Check game state (should be IN_PROGRESS = 1)
        if (game.state.toString() === '0') {
          throw new Error('Game has not started yet (waiting for player 2)');
        }
        
        if (game.state.toString() === '2') {
          console.log('⚠️ Game already finished');
          return {
            success: true,
            alreadyFinished: true,
            message: 'Game already finished'
          };
        }

      } catch (stateError) {
        console.warn('⚠️ Could not fetch game state:', stateError.message);
        // Continue anyway - let the contract handle validation
      }
      
      console.log('📤 Sending submitScore transaction...');
      const tx = await this.multiplayerGameContract.submitScore(gameId, score, {
        gasLimit: 500000 // Explicit gas limit to avoid estimation issues
      });
      console.log('📤 Transaction sent:', tx.hash);
      
      const receipt = await tx.wait();
      console.log('✅ Transaction confirmed! Receipt:', {
        status: receipt.status,
        gasUsed: receipt.gasUsed.toString(),
        hash: receipt.hash
      });
      
      if (receipt.status === 0) {
        throw new Error('Transaction reverted on-chain');
      }
      
      return {
        success: true,
        transactionHash: receipt.hash,
      };
    } catch (error) {
      // Check if this is an expected error (game already ended, second player submitting after first)
      const isExpectedError = error.message && (
        error.message.includes('execution reverted') ||
        error.message.includes('already submitted') ||
        error.message.includes('already ended') ||
        error.message.includes('Skip pre-flight') ||
        error.code === 'CALL_EXCEPTION'
      );
      
      // Only log unexpected errors
      if (!isExpectedError) {
        console.error('❌ Failed to submit score:', error);
        console.error('Error details:', {
          message: error.message,
          code: error.code,
          data: error.data,
          reason: error.reason
        });
      }
      
      // Return more user-friendly error messages
      let errorMessage = error.message;
      if (error.message.includes('execution reverted') || error.code === 'CALL_EXCEPTION') {
        errorMessage = 'Transaction failed. The game may have already ended or you may have already submitted your score.';
      }
      
      return { 
        success: false, 
        error: errorMessage,
        details: error.reason || error.message
      };
    }
  }

  /**
   * Get available games by bet tier
   */
  async getAvailableGames(betTier = null) {
    if (!this.multiplayerGameContract) {
      throw new Error('Contract not initialized');
    }

    try {
      const games = betTier 
        ? await this.multiplayerGameContract.getAvailableGamesByTier(betTier)
        : await this.multiplayerGameContract.getAvailableGames();
      
      return games.map(game => ({
        gameId: game.gameId.toString(),
        betAmount: ethers.formatEther(game.betAmount),
        player1: game.player1,
        createdAt: game.createdAt.toString(),
      }));
    } catch (error) {
      console.error('❌ Failed to get available games:', error);
      return [];
    }
  }

  /**
   * Get game details
   */
  async getGame(gameId) {
    if (!this.multiplayerGameContract) {
      throw new Error('Contract not initialized');
    }

    try {
      const game = await this.multiplayerGameContract.getGame(gameId);
      
      return {
        gameId: game.gameId.toString(),
        betAmount: ethers.formatEther(game.betAmount),
        player1: game.player1,
        player2: game.player2,
        player1Score: game.player1Score.toString(),
        player2Score: game.player2Score.toString(),
        player1Finished: game.player1Finished,
        player2Finished: game.player2Finished,
        winner: game.winner,
        state: game.state,
        createdAt: game.createdAt.toString(),
        finishedAt: game.finishedAt.toString(),
      };
    } catch (error) {
      console.error('❌ Failed to get game:', error);
      return null;
    }
  }

  /**
   * Get multiplayer game result for the results screen
   */
  async getMultiplayerGameResult(gameId, playerAddress) {
    if (!this.multiplayerGameContract) {
      throw new Error('Contract not initialized');
    }

    try {
      const game = await this.multiplayerGameContract.getGame(gameId);
      
      // Determine if this player is player1 or player2
      const isPlayer1 = game.player1.toLowerCase() === playerAddress.toLowerCase();
      const myScore = parseInt(isPlayer1 ? game.player1Score : game.player2Score);
      const opponentScore = parseInt(isPlayer1 ? game.player2Score : game.player1Score);
      
      // Log raw game state for debugging (only if scores seem wrong)
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 Raw game state:', {
          player1Score: game.player1Score.toString(),
          player2Score: game.player2Score.toString(),
          player1Finished: game.player1Finished,
          player2Finished: game.player2Finished,
          winner: game.winner,
          state: game.state.toString()
        });
      }
      
      // Determine winner (0x0 address means no winner yet)
      const hasWinner = game.winner !== '0x0000000000000000000000000000000000000000';
      const isWinner = hasWinner && game.winner.toLowerCase() === playerAddress.toLowerCase();
      
      // Calculate prize (winner gets 2x bet, minus contract fee)
      const betAmount = parseFloat(ethers.formatEther(game.betAmount));
      const prize = hasWinner ? (isWinner ? betAmount * 1.9 : 0) : 0; // 5% fee
      
      return {
        isWinner,
        myScore,
        opponentScore,
        prize: prize.toFixed(4),
        hasWinner,
        gameState: game.state,
        bothPlayersFinished: game.player1Finished && game.player2Finished
      };
    } catch (error) {
      console.error('❌ Failed to get game result:', error);
      return null;
    }
  }

  /**
   * Manually finalize a stuck game where both players finished but game wasn't finalized
   * This can happen if the second player's submitScore transaction failed
   */
  async finalizeStuckGame(gameId) {
    if (!this.multiplayerGameContract) {
      throw new Error('Contract not initialized');
    }

    try {
      console.log('🔧 Calling finalizeGame for game ID:', gameId);
      
      const tx = await this.multiplayerGameContract.finalizeGame(gameId, {
        gasLimit: 500000
      });
      
      console.log('📤 Finalize transaction sent:', tx.hash);
      
      const receipt = await tx.wait();
      console.log('✅ Game finalized! Receipt:', {
        status: receipt.status,
        gasUsed: receipt.gasUsed.toString(),
        hash: receipt.hash
      });
      
      if (receipt.status === 0) {
        throw new Error('Finalize transaction reverted');
      }
      
      return {
        success: true,
        transactionHash: receipt.hash
      };
    } catch (error) {
      console.error('❌ Failed to finalize game:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
const pushChainGameService = new PushChainGameService();
export default pushChainGameService;
