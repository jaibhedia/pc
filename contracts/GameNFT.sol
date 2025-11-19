// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title GameNFT
 * @dev NFT contract for minting game session achievements
 * Built for Push Chain - Native Solidity implementation
 */
contract GameNFT is ERC721, ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    
    Counters.Counter private _tokenIdCounter;
    
    // Struct to store game session data
    struct GameSession {
        uint256 tokenId;
        address player;
        uint256 score;
        uint256 maxCombo;
        uint256 tokensSliced;
        uint256 totalSlashes;
        uint256 bombsHit;
        uint256 tokensMissed;
        uint256 startTime;
        uint256 endTime;
        bool minted;
    }
    
    // Struct for slash records
    struct SlashRecord {
        uint8 tokenType; // 0: Token, 1: Bomb
        uint256 points;
        uint256 timestamp;
        uint256 velocityX;
        uint256 velocityY;
    }
    
    // Struct for player statistics
    struct PlayerStats {
        uint256 totalGames;
        uint256 totalScore;
        uint256 totalSlashes;
        uint256 highestScore;
        uint256 nftsMinted;
        uint256[] sessionTokenIds;
    }
    
    // Struct for leaderboard entry
    struct LeaderboardEntry {
        address player;
        uint256 score;
        uint256 tokenId;
        uint256 timestamp;
    }
    
    // Mappings
    mapping(uint256 => GameSession) public gameSessions;
    mapping(uint256 => SlashRecord[]) public sessionSlashes;
    mapping(address => PlayerStats) public playerStats;
    mapping(address => uint256[]) public playerSessions;
    
    // Leaderboard
    LeaderboardEntry[] public leaderboard;
    uint256 public constant MAX_LEADERBOARD_ENTRIES = 100;
    
    // Global stats
    uint256 public totalGames;
    uint256 public totalSlashes;
    
    // Events
    event GameCreated(uint256 indexed tokenId, address indexed player, uint256 timestamp);
    event SlashRecorded(uint256 indexed tokenId, address indexed player, uint8 tokenType, uint256 points, uint256 timestamp);
    event NFTMinted(uint256 indexed tokenId, address indexed player, uint256 score, uint256 timestamp);
    event LeaderboardUpdated(address indexed player, uint256 score, uint256 tokenId);
    
    constructor() ERC721("Push Ninja Game Collection", "NINJA") Ownable(msg.sender) {
        // Token counter starts at 1
        _tokenIdCounter.increment();
    }
    
    /**
     * @dev Start a new game session
     */
    function startGame() external returns (uint256) {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        
        GameSession memory session = GameSession({
            tokenId: tokenId,
            player: msg.sender,
            score: 0,
            maxCombo: 0,
            tokensSliced: 0,
            totalSlashes: 0,
            bombsHit: 0,
            tokensMissed: 0,
            startTime: block.timestamp,
            endTime: 0,
            minted: false
        });
        
        gameSessions[tokenId] = session;
        playerSessions[msg.sender].push(tokenId);
        
        // Initialize player stats if first game
        if (playerStats[msg.sender].totalGames == 0) {
            playerStats[msg.sender] = PlayerStats({
                totalGames: 0,
                totalScore: 0,
                totalSlashes: 0,
                highestScore: 0,
                nftsMinted: 0,
                sessionTokenIds: new uint256[](0)
            });
        }
        
        playerStats[msg.sender].totalGames++;
        playerStats[msg.sender].sessionTokenIds.push(tokenId);
        totalGames++;
        
        emit GameCreated(tokenId, msg.sender, block.timestamp);
        
        return tokenId;
    }
    
    /**
     * @dev Record a slash during gameplay
     */
    function recordSlash(
        uint256 tokenId,
        uint8 tokenType,
        uint256 points,
        uint256 velocityX,
        uint256 velocityY
    ) external {
        require(gameSessions[tokenId].player == msg.sender, "Not your game session");
        require(!gameSessions[tokenId].minted, "Game already finished");
        
        SlashRecord memory slash = SlashRecord({
            tokenType: tokenType,
            points: points,
            timestamp: block.timestamp,
            velocityX: velocityX,
            velocityY: velocityY
        });
        
        sessionSlashes[tokenId].push(slash);
        totalSlashes++;
        
        emit SlashRecorded(tokenId, msg.sender, tokenType, points, block.timestamp);
    }
    
    /**
     * @dev Mint NFT with game results
     */
    function mintGameNFT(
        uint256 tokenId,
        uint256 finalScore,
        uint256 maxCombo,
        uint256 tokensSliced,
        uint256 totalSlashesCount,
        uint256 bombsHit,
        uint256 tokensMissed,
        string memory _tokenURI
    ) external {
        GameSession storage session = gameSessions[tokenId];
        require(session.player == msg.sender, "Not your game session");
        require(!session.minted, "NFT already minted");
        require(finalScore > 0, "Invalid score");
        
        // Update game session
        session.score = finalScore;
        session.maxCombo = maxCombo;
        session.tokensSliced = tokensSliced;
        session.totalSlashes = totalSlashesCount;
        session.bombsHit = bombsHit;
        session.tokensMissed = tokensMissed;
        session.endTime = block.timestamp;
        session.minted = true;
        
        // Update player stats
        PlayerStats storage stats = playerStats[msg.sender];
        stats.totalScore += finalScore;
        stats.totalSlashes += totalSlashesCount;
        stats.nftsMinted++;
        
        if (finalScore > stats.highestScore) {
            stats.highestScore = finalScore;
        }
        
        // Mint NFT
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, _tokenURI);
        
        // Update leaderboard
        _updateLeaderboard(msg.sender, finalScore, tokenId);
        
        emit NFTMinted(tokenId, msg.sender, finalScore, block.timestamp);
    }
    
    /**
     * @dev Update leaderboard with new score
     */
    function _updateLeaderboard(address player, uint256 score, uint256 tokenId) internal {
        LeaderboardEntry memory newEntry = LeaderboardEntry({
            player: player,
            score: score,
            tokenId: tokenId,
            timestamp: block.timestamp
        });
        
        // If leaderboard is not full, just add
        if (leaderboard.length < MAX_LEADERBOARD_ENTRIES) {
            leaderboard.push(newEntry);
            _sortLeaderboard();
            emit LeaderboardUpdated(player, score, tokenId);
            return;
        }
        
        // Check if score qualifies for leaderboard
        if (score > leaderboard[leaderboard.length - 1].score) {
            leaderboard[leaderboard.length - 1] = newEntry;
            _sortLeaderboard();
            emit LeaderboardUpdated(player, score, tokenId);
        }
    }
    
    /**
     * @dev Sort leaderboard in descending order (simple bubble sort for small arrays)
     */
    function _sortLeaderboard() internal {
        uint256 length = leaderboard.length;
        for (uint256 i = 0; i < length; i++) {
            for (uint256 j = i + 1; j < length; j++) {
                if (leaderboard[i].score < leaderboard[j].score) {
                    LeaderboardEntry memory temp = leaderboard[i];
                    leaderboard[i] = leaderboard[j];
                    leaderboard[j] = temp;
                }
            }
        }
    }
    
    /**
     * @dev Get leaderboard entries
     */
    function getLeaderboard(uint256 limit) external view returns (LeaderboardEntry[] memory) {
        uint256 length = leaderboard.length;
        if (limit < length) {
            length = limit;
        }
        
        LeaderboardEntry[] memory result = new LeaderboardEntry[](length);
        for (uint256 i = 0; i < length; i++) {
            result[i] = leaderboard[i];
        }
        
        return result;
    }
    
    /**
     * @dev Get player's game sessions
     */
    function getPlayerSessions(address player) external view returns (uint256[] memory) {
        return playerSessions[player];
    }
    
    /**
     * @dev Get session slashes
     */
    function getSessionSlashes(uint256 tokenId) external view returns (SlashRecord[] memory) {
        return sessionSlashes[tokenId];
    }
    
    /**
     * @dev Get player statistics
     */
    function getPlayerStats(address player) external view returns (PlayerStats memory) {
        return playerStats[player];
    }
    
    // The following functions are overrides required by Solidity.
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
