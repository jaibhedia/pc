import React from 'react';
import { 
  PushUniversalAccountButton, 
  usePushWalletContext 
} from '@pushchain/ui-kit';
import { GiGamepad, GiTrophyCup, GiTargetArrows } from 'react-icons/gi';
import { FaExternalLinkAlt } from 'react-icons/fa';
import './PushChainWallet.css';

/**
 * PushChainWallet Component
 * Replaces AptosWallet with Push Chain Universal Wallet
 * Uses Push Chain UI Kit for wallet connection across all chains
 */
const PushChainWallet = () => {
  const { isConnected, account, pushChainClient } = usePushWalletContext();

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // Mock NFT data for display (will be integrated with GameNFT contract)
  const mockNFTs = [];

  return (
    <div className="starknet-wallet">
      {!isConnected ? (
        <PushUniversalAccountButton />
      ) : (
        <>
          <div className="wallet-info">
            <div className="address-display">
              <span className="address-text">
                {account?.address && formatAddress(account.address)}
              </span>
              <a
                href={`https://donut.push.network/address/${account?.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="explorer-link"
                title="View on Push Explorer"
              >
                <FaExternalLinkAlt />
              </a>
            </div>
            <PushUniversalAccountButton />
          </div>

          {/* Player Stats Section */}
          <div className="player-stats-section">
            <div className="stats-header">
              <GiGamepad className="stats-icon" />
              <h3>Your Stats</h3>
            </div>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Games Played</span>
                <span className="stat-value">0</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Highest Score</span>
                <span className="stat-value">0</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Total Slashes</span>
                <span className="stat-value">0</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">NFTs Minted</span>
                <span className="stat-value">{mockNFTs.length}</span>
              </div>
            </div>
          </div>

          {/* NFT Collection Section */}
          {mockNFTs.length > 0 && (
            <div className="nft-collection-section">
              <div className="nft-header">
                <GiTrophyCup className="nft-icon" />
                <h3>Your Game NFTs</h3>
              </div>
              <div className="nft-grid">
                {mockNFTs.map((nft) => (
                  <div key={nft.tokenId} className="nft-card">
                    <div className="nft-score">
                      <GiTargetArrows />
                      <span>{nft.score}</span>
                    </div>
                    <div className="nft-stats">
                      <div className="nft-stat">
                        <span>Combo</span>
                        <span>{nft.maxCombo}x</span>
                      </div>
                      <div className="nft-stat">
                        <span>Sliced</span>
                        <span>{nft.tokensSliced}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PushChainWallet;
