import { useState, useCallback, useRef } from 'react';

export const useBladeTrail = () => {
  const [bladeTrail, setBladeTrail] = useState([]);
  const [isSlashing, setIsSlashing] = useState(false);
  const trailRef = useRef([]);

  const addTrailPoint = useCallback((x, y, timestamp = Date.now()) => {
    const point = { x, y, timestamp, alpha: 1.0 };
    
    trailRef.current.push(point);
    
    // Keep only the last 30 points for smooth trail
    if (trailRef.current.length > 30) {
      trailRef.current.shift();
    }
    
    setBladeTrail([...trailRef.current]);
  }, []);

  const updateTrail = useCallback(() => {
    const now = Date.now();
    const maxAge = 300; // Trail fades over 300ms (increased for better visibility)
    
    trailRef.current = trailRef.current
      .map(point => ({
        ...point,
        alpha: Math.max(0, 1 - (now - point.timestamp) / maxAge)
      }))
      .filter(point => point.alpha > 0);
    
    setBladeTrail([...trailRef.current]);
  }, []);

  const clearTrail = useCallback(() => {
    trailRef.current = [];
    setBladeTrail([]);
  }, []);

  const startSlashing = useCallback(() => {
    setIsSlashing(true);
    clearTrail();
  }, [clearTrail]);

  const stopSlashing = useCallback(() => {
    setIsSlashing(false);
    // Don't clear trail immediately, let it fade out
  }, []);

  const renderBladeTrail = useCallback((ctx) => {
    if (bladeTrail.length < 2) return;

    ctx.save();
    
    // Draw outer glow first (bottom layer)
    for (let i = 1; i < bladeTrail.length; i++) {
      const currentPoint = bladeTrail[i];
      const prevPoint = bladeTrail[i - 1];
      
      if (currentPoint.alpha <= 0) continue;
      
      const progress = i / bladeTrail.length;
      const baseWidth = 8;
      const width = baseWidth * (1 - progress * 0.3) * currentPoint.alpha;
      
      ctx.beginPath();
      ctx.moveTo(prevPoint.x, prevPoint.y);
      ctx.lineTo(currentPoint.x, currentPoint.y);
      
      // Outer glow
      ctx.shadowColor = '#DD44B9';
      ctx.shadowBlur = 20 * currentPoint.alpha;
      ctx.strokeStyle = `rgba(221, 68, 185, ${currentPoint.alpha * 0.6})`;
      ctx.lineWidth = width * 1.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    
    // Draw main blade (middle layer)
    ctx.shadowBlur = 0;
    for (let i = 1; i < bladeTrail.length; i++) {
      const currentPoint = bladeTrail[i];
      const prevPoint = bladeTrail[i - 1];
      
      if (currentPoint.alpha <= 0) continue;
      
      const progress = i / bladeTrail.length;
      const baseWidth = 6;
      const width = baseWidth * (1 - progress * 0.3) * currentPoint.alpha;
      
      ctx.beginPath();
      ctx.moveTo(prevPoint.x, prevPoint.y);
      ctx.lineTo(currentPoint.x, currentPoint.y);
      
      // Main blade color
      ctx.strokeStyle = `rgba(247, 95, 227, ${currentPoint.alpha * 0.9})`;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    
    // Draw bright center line (top layer)
    for (let i = 1; i < bladeTrail.length; i++) {
      const currentPoint = bladeTrail[i];
      const prevPoint = bladeTrail[i - 1];
      
      if (currentPoint.alpha <= 0) continue;
      
      const progress = i / bladeTrail.length;
      const baseWidth = 2.5;
      const width = baseWidth * (1 - progress * 0.3) * currentPoint.alpha;
      
      ctx.beginPath();
      ctx.moveTo(prevPoint.x, prevPoint.y);
      ctx.lineTo(currentPoint.x, currentPoint.y);
      
      // Bright white center
      ctx.strokeStyle = `rgba(255, 255, 255, ${currentPoint.alpha})`;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    
    ctx.restore();
  }, [bladeTrail]);

  return {
    bladeTrail,
    isSlashing,
    addTrailPoint,
    updateTrail,
    clearTrail,
    startSlashing,
    stopSlashing,
    renderBladeTrail
  };
};