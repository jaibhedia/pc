import React, { useState, useCallback, useEffect } from 'react';
import { PushUniversalWalletProvider, PushUI, usePushWalletContext } from '@pushchain/ui-kit';
import StartScreen from './components/StartScreen';
import GameScreen from './components/GameScreen';
import ResultsScreen from './components/ResultsScreen';
import ParticleContainer from './components/ParticleContainer';
import LandingPage from './components/LandingPage';
import ModeSelection from './components/ModeSelection';
import { useGameState } from './hooks/useGameState';
import { useTaskbarControls } from './hooks/useTaskbarControls';
import { usePushChain } from './hooks/usePushChain';
import './App.css';
import { SpeedInsights } from "@vercel/speed-insights/react"
import { Analytics } from "@vercel/analytics/react"
import MultiplayerLobby from './components/MultiplayerLobby';

// Push Chain wallet configuration
const walletConfig = {
  network: process.env.REACT_APP_PUSH_NETWORK === 'mainnet' 
    ? PushUI.CONSTANTS.PUSH_NETWORK.MAINNET 
    : PushUI.CONSTANTS.PUSH_NETWORK.TESTNET,
  app: {
    title: 'Push Ninja',
    description: 'The ultimate blockchain ninja game on Push Chain',
    logoUrl: '/logo192.png',
    url: process.env.REACT_APP_URL || window.location.origin,
  },
  login: {
    email: true,
    google: true,
    wallet: true,
  },
  // Suppress wallet auth warnings in development
  debug: process.env.NODE_ENV === 'development',
};

function AppContent() {
  const {
    gameState,
    startGame,
    endGame,
    showStartScreen,
    updateScore,
    loseLife,
    loseLiveFromMissedToken,
    togglePause,
    createScreenFlash,
    decrementTimer
  } = useGameState();

  // Push Chain wallet and blockchain integration
  const { isConnected, account, gameService } = usePushChain();
  
  // Also get wallet context directly to check connection
  const walletContext = usePushWalletContext();
  
  // Extract wallet address from either account or walletContext
  const walletAddress = account?.address || walletContext?.universalAccount?.address || null;
  
  // Debug wallet connection state
  useEffect(() => {
    console.log('App - Wallet State:', { 
      isConnected, 
      account,
      walletAddress,
      hasUniversalAccount: !!walletContext?.universalAccount?.address 
    });
  }, [isConnected, account, walletAddress]);
  
  const [particles, setParticles] = useState([]);
  const [showLanding, setShowLanding] = useState(true);
  const [showMultiplayer, setShowMultiplayer] = useState(false);
  const [showModeSelection, setShowModeSelection] = useState(false);
  const [multiplayerGameId, setMultiplayerGameId] = useState(null);

  // Add taskbar controls
  useTaskbarControls(gameState, togglePause);

  const handleCreateParticles = useCallback((x, y, color, count) => {
    const newParticles = [];
    // Create fewer, token-based particles
    const tokenEmojis =  ['⭐', '✨', '💰'];
    const tokenCount = Math.min(count, 8); // Limit to 8 tokens max
    
    for (let i = 0; i < tokenCount; i++) {
      const angle = (Math.PI * 2 * i) / tokenCount;
      const velocity = 2 + Math.random() * 3;
      const particle = {
        id: Math.random(),
        x: x,
        y: y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 1, // Slight upward bias
        color: color,
        life: 1.0,
        decay: 0.02 + Math.random() * 0.01,
        size: 16 + Math.random() * 8, // Bigger size for emojis
        emoji: tokenEmojis[Math.floor(Math.random() * tokenEmojis.length)],
        isToken: true // Flag to render as emoji
      };
      newParticles.push(particle);
    }
    setParticles(prev => [...prev, ...newParticles]);
  }, []);

  const updateParticles = useCallback(() => {
    setParticles(prev => prev
      .map(particle => ({
        ...particle,
        x: particle.x + particle.vx,
        y: particle.y + particle.vy,
        life: particle.life - particle.decay,
        vy: particle.vy + 0.15,
        vx: particle.vx * 0.98
      }))
      .filter(particle => particle.life > 0)
    );
  }, []);

  const renderScreen = () => {
    switch (gameState.screen) {
      case 'start':
        return (
          <StartScreen
            bestScore={gameState.bestScore}
            onStartGame={startGame}
          />
        );
      case 'game':
        return (
          <GameScreen
            gameState={gameState}
            onEndGame={endGame}
            onUpdateScore={updateScore}
            onLoseLife={loseLife}
            onLoseLiveFromMissedToken={loseLiveFromMissedToken}
            onTogglePause={togglePause}
            onCreateParticles={handleCreateParticles}
            onCreateScreenFlash={createScreenFlash}
            onDecrementTimer={decrementTimer}
            updateParticles={updateParticles}
            onBackToHome={handleBackToLanding}
            isConnected={isConnected}
            walletAddress={account?.address}
            gameService={gameService}
            multiplayerGameId={multiplayerGameId}
          />
        );
      case 'results':
        return (
          <ResultsScreen
            gameState={gameState}
            onStartGame={startGame}
            onShowStartScreen={handleBackToLanding}
            isConnected={isConnected}
            walletAddress={account?.address}
            gameService={gameService}
            multiplayerGameId={multiplayerGameId}
            onBackToMultiplayer={handleBackToMultiplayerLobby}
          />
        );
      default:
        return null;
    }
  };

  const handleStartFromLanding = useCallback(() => {
    setShowLanding(false);
    setShowModeSelection(true);
  }, []);

  const handleModeSelect = (mode) => {
    setShowModeSelection(false);
    startGame(mode);
    // Start blockchain game session if wallet is connected
    if (isConnected) {
      gameService.startGameSession();
    }
  };

  const handleBackToLanding = () => {
    showStartScreen(); // Reset game state to start screen
    setShowLanding(true);
    setShowMultiplayer(false);
    setShowModeSelection(false);
    setMultiplayerGameId(null);
  };

  const handleShowMultiplayer = () => {
    // Check multiple sources for wallet connection
    const walletConnected = isConnected || 
                           !!account?.address || 
                           !!walletContext?.universalAccount?.address ||
                           walletContext?.connectionStatus === 'connected';
    
    console.log('Multiplayer clicked - DETAILED:', { 
      isConnected: isConnected, 
      'typeof isConnected': typeof isConnected,
      account: account, 
      'account?.address': account?.address,
      'universalAccount': walletContext?.universalAccount,
      'universalAccount.address': walletContext?.universalAccount?.address,
      'connectionStatus': walletContext?.connectionStatus,
      walletConnected: walletConnected
    });
    
    if (!walletConnected) {
      alert('Please connect your wallet to play multiplayer games!');
      return;
    }
    setShowLanding(false);
    setShowMultiplayer(true);
  };

  const handleStartMultiplayerGame = (gameId) => {
    setMultiplayerGameId(gameId);
    setShowMultiplayer(false);
    startGame();
  };

  const handleBackToMultiplayerLobby = () => {
    showStartScreen();
    setShowMultiplayer(true);
  };

  if (showMultiplayer) {
    return (
      <div className="App">
        <div className="beta-tag">
          <span className="beta-text">BETA v0.1</span>
        </div>
        
        <MultiplayerLobby 
          walletAddress={walletAddress}
          onStartGame={handleStartMultiplayerGame}
          onBack={handleBackToLanding}
        />
      </div>
    );
  }

  if (showModeSelection) {
    return (
      <div className="App">
        <div className="beta-tag">
          <span className="beta-text">BETA v0.1</span>
        </div>
        
        <ModeSelection
          onSelectMode={handleModeSelect}
          onBack={handleBackToLanding}
          bestScores={{
            classic: gameState.bestScoreClassic,
            arcade: gameState.bestScoreArcade,
            zen: gameState.bestScoreZen
          }}
        />
      </div>
    );
  }

  if (showLanding) {
    return (
      <div className="App">
        {/* Beta Version Tag */}
        <div className="beta-tag">
          <span className="beta-text">BETA v0.1</span>
        </div>
        
        <LandingPage 
          onStartGame={handleStartFromLanding}
          onMultiplayer={handleShowMultiplayer}
        />
      </div>
    );
  }

  return (
    <div className="App">
      
      {renderScreen()}
      <ParticleContainer particles={particles} />
    </div>
  );
}

// Main App component wrapped with Push Chain Wallet Provider
function App() {
  return (
    <PushUniversalWalletProvider config={walletConfig}>
      <AppContent />
      {/* Vercel Analytics - tracks pageviews and custom events */}
      <Analytics />
      {/* Vercel Speed Insights - tracks Core Web Vitals */}
      <SpeedInsights />
    </PushUniversalWalletProvider>
  );
}

export default App;