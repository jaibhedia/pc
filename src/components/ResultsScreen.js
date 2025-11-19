import React, { useState, useEffect } from 'react';
import multiplayerService from '../services/multiplayerService';
import TierDisplay from './TierDisplay';
import { canMintNFTAtTier, getTierByScore, TIERS } from '../utils/tierSystem';
import { track } from '@vercel/analytics';
import '../styles/unified-design.css';
import './ResultsScreen.css';
import { GiTrophyCup, GiCrossedSwords } from 'react-icons/gi';

const ResultsScreen = ({ 
  gameState, 
  onStartGame, 
  onShowStartScreen, 
  isConnected, 
  walletAddress, 
  gameService, 
  multiplayerGameId, 
  onBackToMultiplayer 
}) => {
  const isNewBest = gameState.score > gameState.bestScore;
  const [mintingStatus, setMintingStatus] = useState(null); // null, 'minting', 'success', 'error'
  const [transactionHash, setTransactionHash] = useState(null);
  const [multiplayerSubmitted, setMultiplayerSubmitted] = useState(false);
  const [multiplayerResult, setMultiplayerResult] = useState(null); // { isWinner, myScore, opponentScore, prize }
  
  // Check tier and NFT eligibility
  const nftEligibility = canMintNFTAtTier(gameState.totalScore, gameState.gamesPlayed);
  const currentTier = getTierByScore(gameState.totalScore);
  const canMintNFT = nftEligibility.canMint && isConnected && walletAddress;

  // Track game end in analytics
  useEffect(() => {
    const duration = gameState.gameEndTime && gameState.gameStartTime ? 
      gameState.gameEndTime - gameState.gameStartTime : 0;
    
    track('game_end', {
      mode: multiplayerGameId ? 'multiplayer' : (gameState.gameMode || 'classic'),
      score: gameState.score,
      duration_seconds: Math.floor(duration / 1000),
      is_new_best: isNewBest,
      tier: currentTier.name
    });
    
    if (isNewBest) {
      track('high_score', {
        mode: multiplayerGameId ? 'multiplayer' : (gameState.gameMode || 'classic'),
        score: gameState.score
      });
    }
  }, []); // Only run once on mount

  // Submit multiplayer score and fetch result when game ends
  useEffect(() => {
    const submitMultiplayerScore = async () => {
      if (multiplayerGameId && isConnected && walletAddress && !multiplayerSubmitted) {
        setMultiplayerSubmitted(true);
        console.log('🎮 Submitting multiplayer score:', gameState.score);
        
        const result = await multiplayerService.submitScore(multiplayerGameId, gameState.score, gameService, walletAddress);
        
        // Helper function to fetch result with retry logic
        const fetchResultWithRetry = async (attempt = 1, maxAttempts = 10) => {
          const delay = attempt === 1 ? 4000 : 2000; // 4s first, then 2s intervals
          
          setTimeout(async () => {
            try {
              const gameResult = await gameService.getMultiplayerGameResult(multiplayerGameId, walletAddress);
              
              // Check if we got valid scores (both players should have finished)
              if (gameResult && gameResult.bothPlayersFinished && gameResult.hasWinner) {
                setMultiplayerResult(gameResult);
                console.log('🏆 Multiplayer result:', gameResult);
              } else if (gameResult && gameResult.bothPlayersFinished && !gameResult.hasWinner) {
                // STUCK GAME: Both players finished but no winner set
                // This means _finishGame() was never called (second player's tx failed)
                console.log('🔧 Game stuck! Both players finished but not finalized. Calling finalizeGame()...');
                try {
                  await gameService.finalizeStuckGame(multiplayerGameId);
                  console.log('✅ Game finalized! Retrying to fetch result...');
                  // Retry immediately after finalizing
                  fetchResultWithRetry(1, 5);
                } catch (finalizeError) {
                  console.error('Failed to finalize game:', finalizeError);
                  if (attempt < maxAttempts) {
                    fetchResultWithRetry(attempt + 1, maxAttempts);
                  }
                }
              } else if (attempt < maxAttempts) {
                // Game not fully settled yet, retry
                console.log(`⏳ Waiting for game to finalize... (attempt ${attempt}/${maxAttempts})`);
                fetchResultWithRetry(attempt + 1, maxAttempts);
              } else {
                // Max attempts reached, show what we have anyway
                if (gameResult) {
                  setMultiplayerResult(gameResult);
                  console.log('🏆 Multiplayer result (after retries):', gameResult);
                }
              }
            } catch (error) {
              console.error('Failed to fetch game result:', error);
              if (attempt < maxAttempts) {
                fetchResultWithRetry(attempt + 1, maxAttempts);
              }
            }
          }, delay);
        };
        
        if (result.success) {
          if (result.alreadySubmitted) {
            console.log('ℹ️ Score was already submitted');
          } else if (result.alreadyFinished) {
            console.log('ℹ️ Game already finished');
          } else {
            console.log('✅ Multiplayer score submitted successfully');
          }
          
          // Fetch result with retry logic
          fetchResultWithRetry();
        } else {
          // Only log non-expected errors
          const isExpectedError = result.error && (
            result.error.includes('already submitted') ||
            result.error.includes('already ended') ||
            result.error.includes('Transaction failed')
          );
          
          if (!isExpectedError) {
            console.error('❌ Failed to submit multiplayer score:', result.error);
          }
          
          // Still try to fetch game result even if submission failed
          // (other player may have submitted successfully)
          // Use the same retry logic as successful submission
          fetchResultWithRetry();
        }
      }
    };

    submitMultiplayerScore();
  }, [multiplayerGameId, gameState.score, isConnected, walletAddress, multiplayerSubmitted, gameService]);

  return (
    <div className="unified-screen results-screen">
      <div className="unified-container results-container">
        {/* Simple Game Over Title */}
        <div className="game-over-title">
          <h1 className="unified-title">
            {isNewBest && <><GiTrophyCup /> </>}Game Over{isNewBest && <> <GiTrophyCup /></>}
          </h1>
          {isNewBest && <div className="unified-badge gold new-best-badge">New Best!</div>}
        </div>
        
        {/* Multiplayer Result Display */}
        {multiplayerGameId && multiplayerResult && (
          <div className={`multiplayer-result-banner ${multiplayerResult.isWinner ? 'winner' : 'loser'}`}>
            <div className="result-header">
              <div className="result-icon">{multiplayerResult.isWinner ? '🏆' : '💔'}</div>
              <h2 className="result-title">
                {multiplayerResult.isWinner ? 'Victory!' : 'Defeat'}
              </h2>
            </div>
            <div className="result-scores">
              <div className="player-score yours">
                <span className="label">Your Score</span>
                <span className="value">{multiplayerResult.myScore}</span>
              </div>
              <div className="vs-divider">VS</div>
              <div className="player-score opponent">
                <span className="label">Opponent</span>
                <span className="value">{multiplayerResult.opponentScore}</span>
              </div>
            </div>
            <div className="result-prize">
              {multiplayerResult.isWinner ? (
                <span className="prize-text">🎉 You won {multiplayerResult.prize} PC!</span>
              ) : (
                <span className="prize-text">💪 Better luck next time!</span>
              )}
            </div>
          </div>
        )}
        
        {/* Loading multiplayer result */}
        {multiplayerGameId && !multiplayerResult && multiplayerSubmitted && (
          <div className="multiplayer-result-banner loading">
            <div className="unified-spinner"></div>
            <span>Waiting for opponent...</span>
          </div>
        )}
        
        {/* Score Section */}
        <div className="score-section">
          <div className="final-score">
            <span className="score-label">Score</span>
            <span className="score-value">{gameState.score}</span>
          </div>
        </div>
        
        {/* Stats Row */}
        <div className="unified-grid stats-row">
          <div className="unified-card stat">
            <span className="stat-value">{gameState.citreaSlashed || 0}</span>
            <span className="stat-label">Tokens Slashed</span>
          </div>
          <div className="unified-card stat">
            <span className="stat-value">{gameState.maxCombo || 0}</span>
            <span className="stat-label">Max Combo</span>
          </div>
          <div className="unified-card stat">
            <span className="stat-value">{gameState.bestScore || 0}</span>
            <span className="stat-label">Best Score</span>
          </div>
        </div>
        
        {/* Tier Progress Display */}
        <div className="tier-section">
          <TierDisplay 
            totalScore={gameState.totalScore}
            gamesPlayed={gameState.gamesPlayed}
            bestScore={gameState.bestScore}
          />
        </div>
        
        {/* NFT Minting Section - Only shown if eligible at current tier */}
        {canMintNFT && (
          <div className="nft-minting-section">
            {mintingStatus === 'success' ? (
              <div className="unified-card mint-success">
                <div className="success-header">
                  <div className="success-icon">🎉</div>
                  <h3 className="success-title">NFT Minted Successfully!</h3>
                  <p className="success-subtitle">Your achievement is now on Push Chain blockchain</p>
                </div>
                
                <div className="nft-links">
                  {transactionHash && (
                    <a 
                      href={`https://explorer.push.org/tx/${transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="unified-button unified-button-secondary nft-link"
                    >
                      <span className="link-text">View Transaction</span>
                      <span className="link-arrow">→</span>
                    </a>
                  )}
                  
                  <a 
                    href={`https://explorer.push.org/address/${walletAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="unified-button unified-button-secondary nft-link"
                  >
                    <span className="link-text">View Your Account</span>
                    <span className="link-arrow">→</span>
                  </a>
                </div>

                <div className="nft-details">
                  <div className="nft-detail-row">
                    <span className="detail-label">Your Wallet:</span>
                    <code className="detail-value">{walletAddress}</code>
                  </div>
                  
                  {transactionHash && (
                    <div className="nft-detail-row">
                      <span className="detail-label">Transaction:</span>
                      <code className="detail-value">{transactionHash}</code>
                    </div>
                  )}
                </div>

                <div className="nft-note">
                  <span className="note-icon">ℹ️</span>
                  <span className="note-text">
                    Your {nftEligibility.nftReward} is confirmed on-chain. View it in your Push Chain wallet!
                  </span>
                </div>
              </div>
            ) : (
              <>
                <div className="nft-reward-info">
                  <h4 style={{ color: currentTier.color }}>
                    {currentTier.icon} {nftEligibility.nftReward}
                  </h4>
                  <p>Unlock this exclusive NFT from {currentTier.name} tier!</p>
                </div>
                <button
                  className="unified-button mint-nft"
                  style={{ background: currentTier.gradient }}
                  onClick={async () => {
                    setMintingStatus('minting');
                    try {
                      const duration = gameState.gameEndTime ? 
                        Math.floor((gameState.gameEndTime - gameState.gameStartTime) / 1000) : 0;
                      
                      const result = await gameService.mintGameNFT({
                        score: gameState.score,
                        maxCombo: gameState.maxCombo || 0,
                        tokensSliced: gameState.citreaSlashed || 0,
                        bombsHit: gameState.bombsHit || 0,
                        duration: duration,
                        tierName: currentTier.name,
                        tierIcon: currentTier.icon,
                        totalScore: gameState.totalScore
                      });
                      
                      if (result.success && result.transactionHash) {
                        setTransactionHash(result.transactionHash);
                        
                        // Track successful NFT mint
                        track('nft_mint', {
                          tier: currentTier.name,
                          score: gameState.score,
                          total_score: gameState.totalScore,
                          games_played: gameState.gamesPlayed
                        });
                      }
                      
                      setMintingStatus('success');
                    } catch (error) {
                      console.error('Failed to mint NFT:', error);
                      setMintingStatus('error');
                      setTimeout(() => setMintingStatus(null), 3000);
                    }
                  }}
                  disabled={mintingStatus === 'minting'}
                >
                  {mintingStatus === 'minting' ? (
                    <>
                      <span className="unified-spinner"></span>
                      Minting NFT...
                    </>
                  ) : mintingStatus === 'error' ? (
                    '❌ Mint Failed - Try Again'
                  ) : (
                    `🎨 Mint ${currentTier.name} NFT`
                  )}
                </button>
              </>
            )}
          </div>
        )}
        
        {/* Show NFT unlock progress when not yet eligible */}
        {!canMintNFT && isConnected && walletAddress && (
          <div className="unified-card nft-locked-section">
            <div className="nft-locked-header">
              <div className="lock-icon">🔒</div>
              <h4 style={{ color: currentTier.color }}>
                {currentTier.icon} NFT Minting Locked
              </h4>
            </div>
            
            <div className="lock-reason">
              <p>{nftEligibility.reason}</p>
            </div>
            
            {/* Show progress for current tier requirements */}
            {currentTier.canMintNFT && nftEligibility.gamesNeeded && (
              <div className="unlock-progress">
                <div className="progress-header">
                  <span>Games Progress</span>
                  <span className="progress-count">
                    {gameState.gamesPlayed} / {currentTier.requiredGames}
                  </span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ 
                      width: `${(gameState.gamesPlayed / currentTier.requiredGames) * 100}%`,
                      background: currentTier.gradient
                    }}
                  />
                </div>
                <p className="progress-message">
                  🎮 Play <strong>{nftEligibility.gamesNeeded} more game{nftEligibility.gamesNeeded !== 1 ? 's' : ''}</strong> to unlock {currentTier.name} NFT!
                </p>
              </div>
            )}
            
            {/* Show next NFT milestone if current tier doesn't have NFT */}
            {!currentTier.canMintNFT && (
              <div className="next-nft-milestone">
                <p className="milestone-hint">
                  💎 Next NFT unlocks at <strong>{TIERS.find(t => t.canMintNFT && t.minScore > currentTier.minScore)?.name || 'higher tier'}</strong>
                </p>
                <p className="keep-playing">Keep playing to reach the next NFT milestone!</p>
              </div>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="button-row">
          {multiplayerGameId ? (
            <>
              <button 
                className="unified-button unified-button-secondary back-multiplayer" 
                onClick={onBackToMultiplayer}
              >
                <GiCrossedSwords /> Back to Arena
              </button>
              <button 
                className="unified-button back-home" 
                onClick={onShowStartScreen}
              >
                🏠 Home
              </button>
            </>
          ) : (
            <>
              <button 
                className="unified-button play-again" 
                onClick={onStartGame}
              >
                🔄 Replay
              </button>
              <button 
                className="unified-button unified-button-secondary back-home" 
                onClick={onShowStartScreen}
              >
                Home
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultsScreen;