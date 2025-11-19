import { track } from '@vercel/analytics';

/**
 * Custom hook for analytics tracking
 * Provides helper functions to track game events
 */
export const useAnalytics = () => {
  
  const trackGameStart = (mode) => {
    track('game_start', { mode });
  };

  const trackGameEnd = (mode, score, duration) => {
    track('game_end', { 
      mode, 
      score,
      duration_seconds: Math.floor(duration / 1000)
    });
  };

  const trackHighScore = (mode, score) => {
    track('high_score', { 
      mode, 
      score 
    });
  };

  const trackNFTMint = (tierName, score) => {
    track('nft_mint', { 
      tier: tierName,
      score
    });
  };

  const trackWalletConnect = (address) => {
    track('wallet_connect', { 
      wallet_address: address.substring(0, 8) // Only track first 8 chars for privacy
    });
  };

  const trackMultiplayerGameCreate = (betTier) => {
    track('multiplayer_create', { 
      bet_tier: betTier 
    });
  };

  const trackMultiplayerGameJoin = (betTier) => {
    track('multiplayer_join', { 
      bet_tier: betTier 
    });
  };

  const trackMultiplayerGameComplete = (won, score) => {
    track('multiplayer_complete', { 
      won,
      score
    });
  };

  const trackModeSelection = (mode) => {
    track('mode_select', { 
      mode 
    });
  };

  return {
    trackGameStart,
    trackGameEnd,
    trackHighScore,
    trackNFTMint,
    trackWalletConnect,
    trackMultiplayerGameCreate,
    trackMultiplayerGameJoin,
    trackMultiplayerGameComplete,
    trackModeSelection
  };
};
