// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title MultiplayerGame
 * @dev Multiplayer game contract with betting and escrow functionality
 * Migrated from Aptos Move to Push Chain Solidity
 */
contract MultiplayerGame is Ownable, ReentrancyGuard {
    
    // Bet tiers in wei (example values, adjust as needed)
    // For Push Chain testnet, these are in $PC tokens
    uint256 public constant BET_TIER_1 = 0.1 ether;  // 0.1 PC
    uint256 public constant BET_TIER_2 = 0.5 ether;  // 0.5 PC
    uint256 public constant BET_TIER_3 = 1 ether;    // 1 PC
    uint256 public constant BET_TIER_4 = 5 ether;    // 5 PC
    
    // Game states
    enum GameState { Waiting, InProgress, Finished, Cancelled }
    
    // Game structure
    struct Game {
        uint256 gameId;
        uint256 betAmount;
        address player1;
        address player2;
        uint256 player1Score;
        uint256 player2Score;
        bool player1Finished;
        bool player2Finished;
        address winner;
        GameState state;
        uint256 createdAt;
        uint256 finishedAt;
    }
    
    // Player statistics
    struct PlayerStats {
        uint256 gamesPlayed;
        uint256 gamesWon;
        uint256 totalWagered;
        uint256 totalWinnings;
        uint256 currentGameId;
    }
    
    // State variables
    mapping(uint256 => Game) public games;
    mapping(address => PlayerStats) public playerStats;
    mapping(address => uint256[]) public playerGames;
    
    uint256 public nextGameId = 1;
    uint256 public totalGamesPlayed;
    uint256 public totalVolume;
    
    // Platform fee: 5% (500 basis points out of 10000)
    uint256 public constant PLATFORM_FEE_BPS = 500; // 5%
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public accumulatedFees;
    
    // Events
    event GameCreated(uint256 indexed gameId, address indexed creator, uint256 betAmount, uint256 timestamp);
    event GameJoined(uint256 indexed gameId, address indexed player, uint256 betAmount, uint256 timestamp);
    event ScoreSubmitted(uint256 indexed gameId, address indexed player, uint256 score, uint256 timestamp);
    event GameFinished(uint256 indexed gameId, address indexed winner, uint256 prize, uint256 timestamp);
    event GameCancelled(uint256 indexed gameId, address indexed creator, uint256 refund, uint256 timestamp);
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @dev Get bet amount for a tier
     */
    function getBetAmount(uint8 betTier) public pure returns (uint256) {
        if (betTier == 1) return BET_TIER_1;
        if (betTier == 2) return BET_TIER_2;
        if (betTier == 3) return BET_TIER_3;
        if (betTier == 4) return BET_TIER_4;
        revert("Invalid bet tier");
    }
    
    /**
     * @dev Create a new multiplayer game
     */
    function createGame(uint8 betTier) external payable nonReentrant {
        uint256 betAmount = getBetAmount(betTier);
        require(msg.value == betAmount, "Incorrect bet amount");
        
        uint256 gameId = nextGameId++;
        
        Game storage game = games[gameId];
        game.gameId = gameId;
        game.betAmount = betAmount;
        game.player1 = msg.sender;
        game.player2 = address(0);
        game.player1Score = 0;
        game.player2Score = 0;
        game.player1Finished = false;
        game.player2Finished = false;
        game.winner = address(0);
        game.state = GameState.Waiting;
        game.createdAt = block.timestamp;
        game.finishedAt = 0;
        
        // Update player stats
        playerStats[msg.sender].totalWagered += betAmount;
        playerStats[msg.sender].currentGameId = gameId;
        playerGames[msg.sender].push(gameId);
        
        emit GameCreated(gameId, msg.sender, betAmount, block.timestamp);
    }
    
    /**
     * @dev Join an existing game
     */
    function joinGame(uint256 gameId) external payable nonReentrant {
        Game storage game = games[gameId];
        
        require(game.gameId != 0, "Game does not exist");
        require(game.state == GameState.Waiting, "Game already started or finished");
        require(game.player2 == address(0), "Game is full");
        require(game.player1 != msg.sender, "Cannot join your own game");
        require(msg.value == game.betAmount, "Incorrect bet amount");
        
        game.player2 = msg.sender;
        game.state = GameState.InProgress;
        
        // Update player stats
        playerStats[msg.sender].totalWagered += game.betAmount;
        playerStats[msg.sender].currentGameId = gameId;
        playerGames[msg.sender].push(gameId);
        
        totalVolume += game.betAmount * 2;
        
        emit GameJoined(gameId, msg.sender, game.betAmount, block.timestamp);
    }
    
    /**
     * @dev Submit final score for a game
     */
    function submitScore(uint256 gameId, uint256 finalScore) external nonReentrant {
        Game storage game = games[gameId];
        
        require(game.gameId != 0, "Game does not exist");
        require(game.state == GameState.InProgress, "Game not in progress");
        require(msg.sender == game.player1 || msg.sender == game.player2, "Not your game");
        
        if (msg.sender == game.player1) {
            require(!game.player1Finished, "Already submitted");
            game.player1Score = finalScore;
            game.player1Finished = true;
        } else {
            require(!game.player2Finished, "Already submitted");
            game.player2Score = finalScore;
            game.player2Finished = true;
        }
        
        emit ScoreSubmitted(gameId, msg.sender, finalScore, block.timestamp);
        
        // If both players submitted, finish the game
        if (game.player1Finished && game.player2Finished) {
            _finishGame(gameId);
        }
    }
    
    /**
     * @dev Cancel a game if no one joined (player1 only)
     */
    function cancelGame(uint256 gameId) external nonReentrant {
        Game storage game = games[gameId];
        
        require(game.gameId != 0, "Game does not exist");
        require(game.state == GameState.Waiting, "Game already started or finished");
        require(msg.sender == game.player1, "Only creator can cancel");
        require(game.player2 == address(0), "Cannot cancel, player already joined");
        
        game.state = GameState.Cancelled;
        
        // Refund player1
        uint256 refund = game.betAmount;
        (bool success, ) = payable(game.player1).call{value: refund}("");
        require(success, "Refund failed");
        
        // Update stats
        playerStats[game.player1].currentGameId = 0;
        playerStats[game.player1].totalWagered -= refund;
        
        emit GameCancelled(gameId, game.player1, refund, block.timestamp);
    }
    
    /**
     * @dev Internal function to finish a game and distribute prizes
     */
    function _finishGame(uint256 gameId) internal {
        Game storage game = games[gameId];
        
        game.state = GameState.Finished;
        game.finishedAt = block.timestamp;
        
        address winner;
        address loser;
        
        // Total pot from both players
        uint256 totalPot = game.betAmount * 2;
        
        // Calculate platform fee (5%)
        uint256 platformFee = (totalPot * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        uint256 prize = totalPot - platformFee;
        
        // Determine winner
        if (game.player1Score > game.player2Score) {
            winner = game.player1;
            loser = game.player2;
        } else if (game.player2Score > game.player1Score) {
            winner = game.player2;
            loser = game.player1;
        } else {
            // Tie - refund both players (no fee on ties)
            game.winner = address(0);
            
            (bool success1, ) = payable(game.player1).call{value: game.betAmount}("");
            require(success1, "Refund to player1 failed");
            
            (bool success2, ) = payable(game.player2).call{value: game.betAmount}("");
            require(success2, "Refund to player2 failed");
            
            // Update stats
            playerStats[game.player1].gamesPlayed++;
            playerStats[game.player1].currentGameId = 0;
            
            playerStats[game.player2].gamesPlayed++;
            playerStats[game.player2].currentGameId = 0;
            
            totalGamesPlayed++;
            
            emit GameFinished(gameId, address(0), 0, block.timestamp);
            return;
        }
        
        game.winner = winner;
        
        // Accumulate platform fee
        accumulatedFees += platformFee;
        
        // Transfer prize to winner (95% of total pot)
        (bool success, ) = payable(winner).call{value: prize}("");
        require(success, "Prize transfer failed");
        
        // Update winner stats
        playerStats[winner].gamesPlayed++;
        playerStats[winner].gamesWon++;
        playerStats[winner].totalWinnings += prize;
        playerStats[winner].currentGameId = 0;
        
        // Update loser stats
        playerStats[loser].gamesPlayed++;
        playerStats[loser].currentGameId = 0;
        
        totalGamesPlayed++;
        
        emit GameFinished(gameId, winner, prize, block.timestamp);
    }
    
    /**
     * @dev Owner can withdraw accumulated platform fees
     */
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 amount = accumulatedFees;
        require(amount > 0, "No fees to withdraw");
        
        accumulatedFees = 0;
        
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Fee withdrawal failed");
    }
    
    /**
     * @dev Get available games (waiting for player2)
     */
    function getAvailableGames() external view returns (Game[] memory) {
        // Count available games
        uint256 count = 0;
        for (uint256 i = 1; i < nextGameId; i++) {
            if (games[i].state == GameState.Waiting) {
                count++;
            }
        }
        
        // Create array
        Game[] memory availableGames = new Game[](count);
        uint256 index = 0;
        
        for (uint256 i = 1; i < nextGameId; i++) {
            if (games[i].state == GameState.Waiting) {
                availableGames[index] = games[i];
                index++;
            }
        }
        
        return availableGames;
    }
    
    /**
     * @dev Get available games by bet tier
     */
    function getAvailableGamesByTier(uint8 betTier) external view returns (Game[] memory) {
        uint256 betAmount = getBetAmount(betTier);
        
        // Count available games for this tier
        uint256 count = 0;
        for (uint256 i = 1; i < nextGameId; i++) {
            if (games[i].state == GameState.Waiting && games[i].betAmount == betAmount) {
                count++;
            }
        }
        
        // Create array
        Game[] memory availableGames = new Game[](count);
        uint256 index = 0;
        
        for (uint256 i = 1; i < nextGameId; i++) {
            if (games[i].state == GameState.Waiting && games[i].betAmount == betAmount) {
                availableGames[index] = games[i];
                index++;
            }
        }
        
        return availableGames;
    }
    
    /**
     * @dev Get player's game history
     */
    function getPlayerGames(address player) external view returns (uint256[] memory) {
        return playerGames[player];
    }
    
    /**
     * @dev Get player statistics
     */
    function getPlayerStats(address player) external view returns (PlayerStats memory) {
        return playerStats[player];
    }
    
    /**
     * @dev Get game details
     */
    function getGame(uint256 gameId) external view returns (Game memory) {
        require(games[gameId].gameId != 0, "Game does not exist");
        return games[gameId];
    }
    
    /**
     * @dev Get contract balance (for debugging)
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @dev Manually finalize a game that's stuck (both players finished but game not finalized)
     * This can happen if the second player's submitScore transaction fails
     * Anyone can call this to help finalize stuck games
     */
    function finalizeGame(uint256 gameId) external nonReentrant {
        Game storage game = games[gameId];
        
        require(game.gameId != 0, "Game does not exist");
        require(game.state == GameState.InProgress, "Game not in progress");
        require(game.player1Finished && game.player2Finished, "Both players must finish first");
        
        // Call internal finish function
        _finishGame(gameId);
    }
}
