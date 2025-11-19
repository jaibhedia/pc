import { ethers } from 'ethers';
import { provider, GAME_NFT_CONTRACT, MULTIPLAYER_GAME_CONTRACT } from '../config/pushchain.js';
import { supabaseAdmin } from '../config/supabase.js';
import cron from 'node-cron';

// Import contract ABIs (you'll need to add these after compiling contracts)
const GameNFTABI = [
  "event GameCreated(uint256 indexed tokenId, address indexed player, uint256 timestamp)",
  "event NFTMinted(uint256 indexed tokenId, address indexed player, uint256 score, uint256 timestamp)",
  "event LeaderboardUpdated(address indexed player, uint256 score, uint256 tokenId)"
];

const MultiplayerGameABI = [
  "event GameCreated(uint256 indexed gameId, address indexed creator, uint256 betAmount, uint256 timestamp)",
  "event GameJoined(uint256 indexed gameId, address indexed player, uint256 betAmount, uint256 timestamp)",
  "event GameFinished(uint256 indexed gameId, address indexed winner, uint256 prize, uint256 timestamp)",
  "event ScoreSubmitted(uint256 indexed gameId, address indexed player, uint256 score, uint256 timestamp)"
];

class BlockchainIndexer {
  constructor() {
    this.isRunning = false;
    this.lastProcessedBlock = 0;
    this.gameNFTContract = null;
    this.multiplayerGameContract = null;
  }

  async initialize() {
    console.log('🚀 Initializing Push Chain blockchain indexer...');
    
    // Initialize contract interfaces
    if (GAME_NFT_CONTRACT) {
      this.gameNFTContract = new ethers.Contract(
        GAME_NFT_CONTRACT,
        GameNFTABI,
        provider
      );
      console.log('✅ GameNFT contract initialized:', GAME_NFT_CONTRACT);
    }
    
    if (MULTIPLAYER_GAME_CONTRACT) {
      this.multiplayerGameContract = new ethers.Contract(
        MULTIPLAYER_GAME_CONTRACT,
        MultiplayerGameABI,
        provider
      );
      console.log('✅ MultiplayerGame contract initialized:', MULTIPLAYER_GAME_CONTRACT);
    }
    
    // Get last processed block from database
    const { data, error } = await supabaseAdmin
      .from('indexer_state')
      .select('*')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching indexer state:', error);
      // Get current block number
      this.lastProcessedBlock = await provider.getBlockNumber();
    } else {
      this.lastProcessedBlock = data?.last_processed_block || await provider.getBlockNumber();
    }

    console.log(`📊 Starting from block: ${this.lastProcessedBlock}`);
  }

  async indexTransactions() {
    if (this.isRunning) {
      console.log('⏭️  Indexer already running, skipping...');
      return;
    }

    this.isRunning = true;

    try {
      const currentBlock = await provider.getBlockNumber();
      
      if (currentBlock <= this.lastProcessedBlock) {
        console.log('📊 No new blocks to process');
        this.isRunning = false;
        return;
      }

      console.log(`📊 Processing blocks ${this.lastProcessedBlock + 1} to ${currentBlock}`);

      let processedCount = 0;

      // Process GameNFT events
      if (this.gameNFTContract) {
        // GameCreated events
        const gameCreatedFilter = this.gameNFTContract.filters.GameCreated();
        const gameCreatedEvents = await this.gameNFTContract.queryFilter(
          gameCreatedFilter,
          this.lastProcessedBlock + 1,
          currentBlock
        );

        for (const event of gameCreatedEvents) {
          await this.handleGameNFTCreated(event);
          processedCount++;
        }

        // NFTMinted events
        const nftMintedFilter = this.gameNFTContract.filters.NFTMinted();
        const nftMintedEvents = await this.gameNFTContract.queryFilter(
          nftMintedFilter,
          this.lastProcessedBlock + 1,
          currentBlock
        );

        for (const event of nftMintedEvents) {
          await this.handleNFTMinted(event);
          processedCount++;
        }
      }

      // Process MultiplayerGame events
      if (this.multiplayerGameContract) {
        // GameCreated events
        const mpGameCreatedFilter = this.multiplayerGameContract.filters.GameCreated();
        const mpGameCreatedEvents = await this.multiplayerGameContract.queryFilter(
          mpGameCreatedFilter,
          this.lastProcessedBlock + 1,
          currentBlock
        );

        for (const event of mpGameCreatedEvents) {
          await this.handleMultiplayerGameCreated(event);
          processedCount++;
        }

        // GameJoined events
        const gameJoinedFilter = this.multiplayerGameContract.filters.GameJoined();
        const gameJoinedEvents = await this.multiplayerGameContract.queryFilter(
          gameJoinedFilter,
          this.lastProcessedBlock + 1,
          currentBlock
        );

        for (const event of gameJoinedEvents) {
          await this.handleMultiplayerGameJoined(event);
          processedCount++;
        }

        // GameFinished events
        const gameFinishedFilter = this.multiplayerGameContract.filters.GameFinished();
        const gameFinishedEvents = await this.multiplayerGameContract.queryFilter(
          gameFinishedFilter,
          this.lastProcessedBlock + 1,
          currentBlock
        );

        for (const event of gameFinishedEvents) {
          await this.handleMultiplayerGameFinished(event);
          processedCount++;
        }
      }

      // Update last processed block
      if (currentBlock > this.lastProcessedBlock) {
        const { data: stateData } = await supabaseAdmin
          .from('indexer_state')
          .select('id')
          .limit(1)
          .single();

        if (stateData) {
          await supabaseAdmin
            .from('indexer_state')
            .update({
              last_processed_block: currentBlock,
              last_sync_at: new Date().toISOString()
            })
            .eq('id', stateData.id);
        } else {
          await supabaseAdmin
            .from('indexer_state')
            .insert({
              last_processed_block: currentBlock,
              last_sync_at: new Date().toISOString()
            });
        }

        this.lastProcessedBlock = currentBlock;
      }

      if (processedCount > 0) {
        console.log(`✅ Indexed ${processedCount} events, block: ${currentBlock}`);
      }

    } catch (error) {
      console.error('❌ Indexer error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  // GameNFT event handlers
  async handleGameNFTCreated(event) {
    const { tokenId, player, timestamp } = event.args;
    const txHash = event.transactionHash;

    console.log(`🎮 Game NFT session created: ${tokenId} by ${player}`);

    // Log event to database
    await supabaseAdmin
      .from('event_log')
      .insert({
        event_type: 'GameCreated',
        game_id: null,
        player_address: player,
        data: { tokenId: tokenId.toString(), player, timestamp: timestamp.toString() },
        transaction_hash: txHash,
        block_number: event.blockNumber
      });
  }

  async handleNFTMinted(event) {
    const { tokenId, player, score, timestamp } = event.args;
    const txHash = event.transactionHash;

    console.log(`🎨 NFT minted: ${tokenId} by ${player}, score: ${score}`);

    // Log event to database
    await supabaseAdmin
      .from('event_log')
      .insert({
        event_type: 'NFTMinted',
        game_id: null,
        player_address: player,
        data: { tokenId: tokenId.toString(), player, score: score.toString(), timestamp: timestamp.toString() },
        transaction_hash: txHash,
        block_number: event.blockNumber
      });
  }

  // Multiplayer game event handlers
  async handleMultiplayerGameCreated(event) {
    const { gameId, creator, betAmount, timestamp } = event.args;
    const txHash = event.transactionHash;
    const betTier = this.getBetTierFromAmount(betAmount);
    const gameIdInt = parseInt(gameId.toString());

    console.log(`🎮 Multiplayer game created: ${gameIdInt} by ${creator}`);

    // Check if game already exists (frontend might have created it)
    const { data: existingGame } = await supabaseAdmin
      .from('games')
      .select('*')
      .eq('game_id', gameIdInt)
      .single();

    if (existingGame) {
      console.log(`ℹ️  Game ${gameIdInt} already exists in DB (created by frontend), skipping insert`);
    } else {
      // Insert game
      const { error } = await supabaseAdmin
        .from('games')
        .insert({
          game_id: gameIdInt,
          bet_amount: betAmount.toString(),
          bet_tier: betTier,
          player1_address: creator,
          state: 0,
          creation_tx_hash: txHash
        });

      if (error) {
        console.error(`❌ Error inserting game ${gameIdInt}:`, error.message);
      } else {
        console.log(`✅ Game ${gameIdInt} inserted into DB`);
      }
    }

    // Update or create player
    await this.upsertPlayer(creator, betAmount, 'wagered');

    // Log event (with ON CONFLICT DO NOTHING to avoid duplicates)
    await supabaseAdmin
      .from('event_log')
      .insert({
        event_type: 'GameCreated',
        game_id: gameIdInt,
        player_address: creator,
        data: { gameId: gameId.toString(), creator, betAmount: betAmount.toString(), timestamp: timestamp.toString() },
        transaction_hash: txHash,
        block_number: event.blockNumber
      });
  }

  async handleMultiplayerGameJoined(event) {
    const { gameId, player, betAmount, timestamp } = event.args;
    const txHash = event.transactionHash;
    const gameIdInt = parseInt(gameId.toString());

    console.log(`👥 Game joined: ${gameIdInt} by ${player}`);

    // Update game (frontend might have already done this, but ensure it's updated)
    const { error, data } = await supabaseAdmin
      .from('games')
      .update({
        player2_address: player,
        state: 1,
        joined_at: new Date().toISOString(),
        join_tx_hash: txHash
      })
      .eq('game_id', gameIdInt)
      .select();

    if (error) {
      console.error(`❌ Error updating game ${gameIdInt}:`, error.message);
    } else if (data && data.length > 0) {
      console.log(`✅ Game ${gameIdInt} updated (player2 joined)`);
    } else {
      console.warn(`⚠️  Game ${gameIdInt} not found for update`);
    }

    // Update player stats
    await this.upsertPlayer(player, betAmount, 'wagered');

    // Increment games played for player 1
    const { data: game } = await supabaseAdmin
      .from('games')
      .select('player1_address')
      .eq('game_id', parseInt(gameId.toString()))
      .single();

    if (game) {
      await this.incrementGamesPlayed(game.player1_address);
    }

    // Log event
    await supabaseAdmin
      .from('event_log')
      .insert({
        event_type: 'GameJoined',
        game_id: parseInt(gameId.toString()),
        player_address: player,
        data: { gameId: gameId.toString(), player, betAmount: betAmount.toString(), timestamp: timestamp.toString() },
        transaction_hash: txHash,
        block_number: event.blockNumber
      });
  }

  async handleMultiplayerGameFinished(event) {
    const { gameId, winner, prize, timestamp } = event.args;
    const txHash = event.transactionHash;

    console.log(`🏆 Game finished: ${gameId}, winner: ${winner || 'TIE'}`);

    // Update game
    await supabaseAdmin
      .from('games')
      .update({
        winner_address: winner !== ethers.ZeroAddress ? winner : null,
        state: 2,
        finished_at: new Date().toISOString(),
        finish_tx_hash: txHash,
        player1_finished: true,
        player2_finished: true
      })
      .eq('game_id', parseInt(gameId.toString()));

    // Update winner stats
    if (winner && winner !== ethers.ZeroAddress) {
      await this.upsertPlayer(winner, prize, 'won');
    }

    // Log event
    await supabaseAdmin
      .from('event_log')
      .insert({
        event_type: 'GameFinished',
        game_id: parseInt(gameId.toString()),
        player_address: winner,
        data: { gameId: gameId.toString(), winner, prize: prize.toString(), timestamp: timestamp.toString() },
        transaction_hash: txHash,
        block_number: event.blockNumber
      });
  }

  async upsertPlayer(address, amount, type) {
    const { data: player } = await supabaseAdmin
      .from('players')
      .select('*')
      .eq('address', address)
      .single();

    if (player) {
      const updates = { last_active: new Date().toISOString() };

      if (type === 'wagered') {
        updates.total_wagered = (BigInt(player.total_wagered) + BigInt(amount.toString())).toString();
      } else if (type === 'won') {
        updates.games_won = player.games_won + 1;
        updates.total_winnings = (BigInt(player.total_winnings) + BigInt(amount.toString())).toString();
      }

      await supabaseAdmin
        .from('players')
        .update(updates)
        .eq('address', address);
    } else {
      await supabaseAdmin
        .from('players')
        .insert({
          address,
          games_played: type === 'wagered' ? 1 : 0,
          games_won: type === 'won' ? 1 : 0,
          total_wagered: type === 'wagered' ? amount.toString() : '0',
          total_winnings: type === 'won' ? amount.toString() : '0'
        });
    }
  }

  async incrementGamesPlayed(address) {
    const { data: player } = await supabaseAdmin
      .from('players')
      .select('games_played')
      .eq('address', address)
      .single();

    if (player) {
      await supabaseAdmin
        .from('players')
        .update({
          games_played: player.games_played + 1,
          last_active: new Date().toISOString()
        })
        .eq('address', address);
    }
  }

  getBetTierFromAmount(betAmount) {
    const amountWei = betAmount.toString();
    const BET_TIER_1 = ethers.parseEther('0.1').toString();
    const BET_TIER_2 = ethers.parseEther('0.5').toString();
    const BET_TIER_3 = ethers.parseEther('1').toString();
    const BET_TIER_4 = ethers.parseEther('5').toString();

    if (amountWei === BET_TIER_1) return 1;
    if (amountWei === BET_TIER_2) return 2;
    if (amountWei === BET_TIER_3) return 3;
    if (amountWei === BET_TIER_4) return 4;
    return 1; // default
  }

  startCron() {
    console.log('⏰ Starting indexer cron job (every 10 seconds)...');
    
    // Run every 10 seconds
    cron.schedule('*/10 * * * * *', async () => {
      await this.indexTransactions();
    });
  }

  async runOnce() {
    await this.initialize();
    await this.indexTransactions();
  }

  async start() {
    await this.initialize();
    await this.indexTransactions(); // Run once immediately
    this.startCron(); // Then run every 10 seconds
  }
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const indexer = new BlockchainIndexer();
  indexer.start();
}

export default BlockchainIndexer;
