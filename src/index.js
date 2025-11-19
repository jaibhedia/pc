import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Suppress known harmless console warnings in ALL environments (development + production)
const originalError = console.error;
const originalWarn = console.warn;
const originalLog = console.log;
  
  console.error = (...args) => {
    // Check both string messages and Error objects
    const message = typeof args[0] === 'string' ? args[0] : args[0]?.message || '';
    const stringified = JSON.stringify(args);
    
    if (
      message.includes('attribute width: Expected length') ||
      message.includes('attribute height: Expected length') ||
      message.includes('Unknown message type') ||
      message.includes('Unrecognized feature') ||
      message.includes('transaction execution reverted') || // Expected when game already ended
      message.includes('already submitted') ||
      message.includes('already ended') ||
      message.includes('Failed to submit score') || // Expected on second player submission
      message.includes('Failed to submit multiplayer score') || // Expected on second player
      message.includes('Transaction failed. The game may have already ended') ||
      stringified.includes('CALL_EXCEPTION') || // Transaction revert errors
      (args[0] instanceof Error && args[0].code === 'CALL_EXCEPTION')
    ) {
      return;
    }
    originalError.apply(console, args);
  };
  
  console.warn = (...args) => {
    const message = typeof args[0] === 'string' ? args[0] : args[0]?.message || '';
    
    if (
      message.includes('Unrecognized feature') ||
      message.includes('Unknown message type') ||
      message.includes('GoTrueClient instances detected')
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };
  
  console.log = (...args) => {
    const message = typeof args[0] === 'string' ? args[0] : '';
    const isObject = typeof args[0] === 'object' && args[0] !== null;
    
    // Suppress known verbose/harmless logs
    if (
      // Push Chain UI Kit and MetaMask messages
      message.includes('Unknown message type') ||
      (isObject && (
        (args[0].type && typeof args[0].type === 'string' && args[0].type.includes('message')) ||
        (args[0].target === 'metamask-inpage') ||
        (args[0].data && typeof args[0].data === 'object')
      )) ||
      // Duplicate game logs (already logged once)
      message.includes('FRUIT MISSED! ID:') ||
      message.includes('marked for penalty') ||
      message.includes('Cleaned up penalized fruit') ||
      message.includes('BOMB MISSED!') ||
      message.includes('loseLiveFromMissedToken() CALLED') || // Debug trace
      message.includes('Current lives before loss') ||
      message.includes('New lives after loss') ||
      // Token loading (too verbose)
      message.includes('Loading Starknet token image') ||
      message.includes('Loaded Yellow Ring') ||
      message.includes('Loaded Red Ring') ||
      message.includes('Loaded Green Ring') ||
      message.includes('Loaded Blue Ring') ||
      message.includes('token image loaded successfully') ||
      message.includes('Cleaning up token image loaders') ||
      // Repeated wallet/connection logs
      message.includes('App - Wallet State:') ||
      message.includes('Video can play') ||
      message.includes('Video loaded successfully') ||
      // Multiplayer polling (too frequent)
      message.includes('Game details:') ||
      message.includes('Available games:') ||
      // Result fetching retries (less verbose)
      message.includes('Waiting for game to finalize') ||
      message.includes('Waiting for final scores') ||
      message.includes('Raw game state:')
    ) {
      return;
    }
    originalLog.apply(console, args);
  };

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);