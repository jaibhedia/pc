import { useEffect, useRef } from 'react';
import { usePushChainClient, usePushWalletContext } from '@pushchain/ui-kit';
import pushChainGameService from '../services/pushChainService';
import { track } from '@vercel/analytics';

/**
 * Custom hook to initialize and manage Push Chain client
 * Push Chain wallet and blockchain interaction hook
 */
export function usePushChain() {
  const walletContext = usePushWalletContext();
  const pushChainClient = usePushChainClient();
  const hasLoggedConnection = useRef(false);

  // Extract connection state from wallet context
  // Push Chain UI Kit uses 'universalAccount' and 'connectionStatus'
  const universalAccount = walletContext?.universalAccount;
  const connectionStatus = walletContext?.connectionStatus;
  
  const isConnected = connectionStatus === 'connected' || 
                      !!universalAccount?.address ||
                      false;
  
  const account = universalAccount || null;

  useEffect(() => {
    // Only log once when wallet first connects
    if (isConnected && universalAccount?.address && !hasLoggedConnection.current) {
      console.log('🔗 Push Chain Wallet Connected:', universalAccount.address);
      hasLoggedConnection.current = true;
      
      // Track wallet connection in analytics
      track('wallet_connect', { 
        wallet_type: 'push_chain',
        address_prefix: universalAccount.address.substring(0, 8)
      });
    } else if (!isConnected && hasLoggedConnection.current) {
      hasLoggedConnection.current = false;
    }
    
    // Detailed logging available when needed (commented out for production)
    // console.log('Push Chain Wallet Context - DETAILED:', {
    //   'walletContext keys': walletContext ? Object.keys(walletContext) : 'null',
    //   'universalAccount': universalAccount,
    //   'universalAccount.address': universalAccount?.address,
    //   'connectionStatus': connectionStatus,
    //   'computed isConnected': isConnected,
    //   'computed account': account,
    //   pushChainClient: pushChainClient ? 'exists' : 'null'
    // });
    
    if (isConnected && pushChainClient) {
      // Initialize the game service with the Push Chain client
      pushChainGameService.initialize(pushChainClient);
    }
  }, [isConnected, pushChainClient, account, walletContext, universalAccount, connectionStatus]);

  return {
    isConnected,
    account,
    pushChainClient,
    gameService: pushChainGameService,
    
    // Convenience methods
    isWalletConnected: () => isConnected,
    getWalletAddress: () => account?.address || account || null,
  };
}
