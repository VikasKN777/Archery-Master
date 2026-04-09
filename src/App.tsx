/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Target as TargetIcon, 
  Wind, 
  RotateCcw, 
  Trophy, 
  ArrowRight,
  Info,
  Play
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { GameState, Arrow, Target, Vector2D } from './types';

const GRAVITY = 0.15;
const WIND_RESISTANCE = 0.01;
const MAX_POWER = 25;
const INITIAL_ARROWS = 10;

export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    highScore: parseInt(localStorage.getItem('archeryHighScore') || '0'),
    arrowsRemaining: INITIAL_ARROWS,
    wind: { x: (Math.random() - 0.5) * 0.2, y: 0 },
    isDrawing: false,
    drawPower: 0,
    currentArrow: null,
    target: {
      position: { x: 800, y: 400 },
      radius: 60,
      distance: 100
    },
    gameOver: false,
  });

  const [gameStarted, setGameStarted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);
  const mousePos = useRef<Vector2D>({ x: 0, y: 0 });

  const resetGame = () => {
    setGameState(prev => ({
      ...prev,
      score: 0,
      arrowsRemaining: INITIAL_ARROWS,
      wind: { x: (Math.random() - 0.5) * 0.2, y: 0 },
      currentArrow: null,
      gameOver: false,
      drawPower: 0,
      isDrawing: false
    }));
  };

  const [hitText, setHitText] = useState<{ text: string, x: number, y: number } | null>(null);
  const [shake, setShake] = useState(0);

  const spawnNewTarget = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Target moves between 600 and canvas width - 100
    const x = 600 + Math.random() * (canvas.width - 700);
    // Target moves between 200 and canvas height - 200
    const y = 200 + Math.random() * (canvas.height - 400);
    
    setGameState(prev => ({
      ...prev,
      target: {
        ...prev.target,
        position: { x, y }
      },
      wind: { x: (Math.random() - 0.5) * 0.3, y: (Math.random() - 0.5) * 0.05 }
    }));
  }, []);

  const handleMouseDown = () => {
    if (gameState.gameOver || !gameStarted || gameState.currentArrow?.isActive) return;
    setGameState(prev => ({ ...prev, isDrawing: true, drawPower: 0 }));
  };

  const handleMouseUp = () => {
    if (!gameState.isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const archerPos = { x: 100, y: canvas.height / 2 };
    const angle = Math.atan2(mousePos.current.y - archerPos.y, mousePos.current.x - archerPos.x);
    
    const power = Math.min(gameState.drawPower, MAX_POWER);
    
    const newArrow: Arrow = {
      position: { ...archerPos },
      velocity: {
        x: Math.cos(angle) * power,
        y: Math.sin(angle) * power
      },
      angle,
      isActive: true,
      isStuck: false,
      trail: []
    };

    setGameState(prev => ({
      ...prev,
      isDrawing: false,
      currentArrow: newArrow,
      arrowsRemaining: prev.arrowsRemaining - 1
    }));
  };

  const update = useCallback(() => {
    setGameState(prev => {
      if (!prev.currentArrow || !prev.currentArrow.isActive) {
        if (prev.isDrawing) {
          return { ...prev, drawPower: Math.min(prev.drawPower + 0.3, MAX_POWER) };
        }
        return prev;
      }

      const arrow = { ...prev.currentArrow };
      
      // Physics
      arrow.velocity.y += GRAVITY;
      arrow.velocity.x += prev.wind.x;
      arrow.velocity.y += prev.wind.y;
      
      // Air resistance (simple)
      arrow.velocity.x *= (1 - WIND_RESISTANCE);
      arrow.velocity.y *= (1 - WIND_RESISTANCE);

      arrow.position.x += arrow.velocity.x;
      arrow.position.y += arrow.velocity.y;
      
      // Update angle based on velocity
      arrow.angle = Math.atan2(arrow.velocity.y, arrow.velocity.x);
      
      // Trail
      arrow.trail.push({ ...arrow.position });
      if (arrow.trail.length > 20) arrow.trail.shift();

      // Collision with target
      const dx = arrow.position.x - prev.target.position.x;
      const dy = arrow.position.y - prev.target.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < prev.target.radius) {
        // Hit!
        const points = Math.max(0, Math.round(10 - (distance / prev.target.radius) * 10)) * 10;
        const newScore = prev.score + points;
        
        setShake(10);
        setHitText({ 
          text: points >= 90 ? 'BULLSEYE!' : points >= 50 ? 'GREAT!' : 'HIT!', 
          x: arrow.position.x, 
          y: arrow.position.y - 40 
        });
        setTimeout(() => setHitText(null), 1000);

        if (points >= 90) {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { 
              x: arrow.position.x / (canvasRef.current?.width || 1), 
              y: arrow.position.y / (canvasRef.current?.height || 1) 
            }
          });
        }

        setTimeout(spawnNewTarget, 1000);

        return {
          ...prev,
          score: newScore,
          highScore: Math.max(newScore, prev.highScore),
          currentArrow: { ...arrow, isActive: false, isStuck: true }
        };
      }

      // Out of bounds
      const canvas = canvasRef.current;
      if (canvas && (
        arrow.position.x > canvas.width || 
        arrow.position.y > canvas.height || 
        arrow.position.x < 0
      )) {
        if (prev.arrowsRemaining === 0) {
          return { ...prev, currentArrow: null, gameOver: true };
        }
        return { ...prev, currentArrow: null };
      }

      return { ...prev, currentArrow: arrow };
    });

    setShake(s => Math.max(0, s * 0.9));
    requestRef.current = requestAnimationFrame(update);
  }, [spawnNewTarget]);

  useEffect(() => {
    if (gameStarted && !gameState.gameOver) {
      requestRef.current = requestAnimationFrame(update);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameStarted, gameState.gameOver, update]);

  useEffect(() => {
    localStorage.setItem('archeryHighScore', gameState.highScore.toString());
  }, [gameState.highScore]);

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Drawing logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const draw = () => {
      const state = gameStateRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      ctx.save();
      if (shake > 0.1) {
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      }

      // Draw Background (Simple sky and grass)
      const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      skyGradient.addColorStop(0, '#87CEEB');
      skyGradient.addColorStop(1, '#E0F6FF');
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grass
      ctx.fillStyle = '#4CAF50';
      ctx.fillRect(0, canvas.height - 100, canvas.width, 100);

      // Draw Target
      const { position, radius } = state.target;
      const colors = ['#FFFFFF', '#FFFFFF', '#FF0000', '#FF0000', '#0000FF', '#0000FF', '#FFFF00', '#FFFF00', '#000000'];
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(position.x, position.y, radius - (i * radius / 5), 0, Math.PI * 2);
        ctx.fillStyle = colors[i * 2];
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      // Bullseye
      ctx.beginPath();
      ctx.arc(position.x, position.y, radius / 10, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFF00';
      ctx.fill();
      ctx.stroke();

      // Draw Archer / Bow
      const archerX = 100;
      const archerY = canvas.height / 2;
      const angle = Math.atan2(mousePos.current.y - archerY, mousePos.current.x - archerX);

      ctx.save();
      ctx.translate(archerX, archerY);
      ctx.rotate(angle);

      // Bow
      ctx.beginPath();
      ctx.arc(0, 0, 60, -Math.PI / 2, Math.PI / 2);
      ctx.strokeStyle = '#5D4037';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Bowstring
      const stringPull = state.isDrawing ? (state.drawPower / MAX_POWER) * 40 : 0;
      ctx.beginPath();
      ctx.moveTo(0, -60);
      ctx.quadraticCurveTo(-stringPull, 0, 0, 60);
      ctx.strokeStyle = '#E0E0E0';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Arrow in bow
      if (state.isDrawing || (!state.currentArrow?.isActive && state.arrowsRemaining > 0)) {
        ctx.beginPath();
        ctx.moveTo(-stringPull, 0);
        ctx.lineTo(60 - stringPull, 0);
        ctx.strokeStyle = '#212121';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Fletching
        ctx.beginPath();
        ctx.moveTo(-stringPull, 0);
        ctx.lineTo(-stringPull - 10, -5);
        ctx.lineTo(-stringPull - 10, 5);
        ctx.closePath();
        ctx.fillStyle = '#FF5252';
        ctx.fill();
      }

      ctx.restore();

      // Draw Active Arrow
      if (state.currentArrow) {
        const arrow = state.currentArrow;
        
        // Trail
        if (arrow.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(arrow.trail[0].x, arrow.trail[0].y);
          for (let i = 1; i < arrow.trail.length; i++) {
            ctx.lineTo(arrow.trail[i].x, arrow.trail[i].y);
          }
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        ctx.save();
        ctx.translate(arrow.position.x, arrow.position.y);
        ctx.rotate(arrow.angle);
        
        ctx.beginPath();
        ctx.moveTo(-30, 0);
        ctx.lineTo(30, 0);
        ctx.strokeStyle = '#212121';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Arrow head
        ctx.beginPath();
        ctx.moveTo(30, 0);
        ctx.lineTo(20, -5);
        ctx.lineTo(20, 5);
        ctx.closePath();
        ctx.fillStyle = '#757575';
        ctx.fill();

        // Fletching
        ctx.beginPath();
        ctx.moveTo(-30, 0);
        ctx.lineTo(-40, -5);
        ctx.lineTo(-40, 5);
        ctx.closePath();
        ctx.fillStyle = '#FF5252';
        ctx.fill();

        ctx.restore();
      }

      // Hit Text
      if (hitText) {
        ctx.font = 'bold 32px sans-serif';
        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.fillText(hitText.text, hitText.x, hitText.y);
      }

      ctx.restore();
      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [shake, hitText]);


  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    mousePos.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  return (
    <div className="relative w-full h-screen bg-slate-900 flex items-center justify-center overflow-hidden font-sans">
      <canvas
        ref={canvasRef}
        width={1200}
        height={800}
        className="max-w-full max-h-full bg-white shadow-2xl cursor-crosshair rounded-lg"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      />

      {/* HUD */}
      <div className="absolute top-8 left-8 flex flex-col gap-4 pointer-events-none">
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-slate-200 min-w-[180px]"
        >
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <Trophy size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Score</span>
          </div>
          <div className="text-3xl font-black text-slate-900">{gameState.score}</div>
          <div className="text-xs text-slate-400 mt-1">Best: {gameState.highScore}</div>
        </motion.div>

        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-slate-200"
        >
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <TargetIcon size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Arrows</span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: INITIAL_ARROWS }).map((_, i) => (
              <div 
                key={i} 
                className={`h-6 w-1.5 rounded-full transition-colors ${
                  i < gameState.arrowsRemaining ? 'bg-orange-500' : 'bg-slate-200'
                }`} 
              />
            ))}
          </div>
        </motion.div>
      </div>

      <div className="absolute top-8 right-8 flex flex-col items-end gap-4 pointer-events-none">
        <motion.div 
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-slate-200 flex flex-col items-end"
        >
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Wind size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Wind</span>
          </div>
          <div className="flex items-center gap-3">
            <div 
              className="w-8 h-8 rounded-full border-2 border-slate-200 flex items-center justify-center transition-transform duration-500"
              style={{ transform: `rotate(${Math.atan2(gameState.wind.y, gameState.wind.x)}rad)` }}
            >
              <ArrowRight size={16} className="text-orange-500" />
            </div>
            <div className="text-xl font-bold text-slate-900">
              {(Math.sqrt(gameState.wind.x**2 + gameState.wind.y**2) * 100).toFixed(1)} <span className="text-xs text-slate-400">m/s</span>
            </div>
          </div>
        </motion.div>

        {gameState.isDrawing && (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-slate-200 w-48"
          >
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Power</div>
            <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <motion.div 
                className="h-full bg-gradient-to-r from-orange-400 to-orange-600"
                style={{ width: `${(gameState.drawPower / MAX_POWER) * 100}%` }}
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {!gameStarted && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <motion.div 
              initial={{ y: 20, scale: 0.9 }}
              animate={{ y: 0, scale: 1 }}
              className="bg-white p-12 rounded-[40px] shadow-2xl max-w-md text-center border border-slate-100"
            >
              <div className="w-24 h-24 bg-orange-100 rounded-3xl flex items-center justify-center mx-auto mb-8 text-orange-600">
                <TargetIcon size={48} strokeWidth={2.5} />
              </div>
              <h1 className="text-5xl font-black text-slate-900 mb-4 tracking-tight">Archery Master</h1>
              <p className="text-slate-500 mb-10 leading-relaxed">
                Master the art of the bow. Aim carefully, account for wind, and hit the bullseye to become a legend.
              </p>
              <button 
                onClick={() => setGameStarted(true)}
                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold text-xl hover:bg-slate-800 transition-all shadow-xl hover:shadow-2xl active:scale-95 flex items-center justify-center gap-3"
              >
                <Play size={24} fill="currentColor" />
                Start Game
              </button>
              <div className="mt-8 flex items-center justify-center gap-6 text-slate-400">
                <div className="flex items-center gap-2">
                  <Info size={16} />
                  <span className="text-sm font-medium">Drag to Aim & Power</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {gameState.gameOver && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-50"
          >
            <motion.div 
              initial={{ y: 20, scale: 0.9 }}
              animate={{ y: 0, scale: 1 }}
              className="bg-white p-12 rounded-[40px] shadow-2xl max-w-md text-center border border-slate-100"
            >
              <div className="text-6xl mb-6">🏹</div>
              <h2 className="text-4xl font-black text-slate-900 mb-2">Game Over</h2>
              <p className="text-slate-500 mb-8">You've run out of arrows!</p>
              
              <div className="grid grid-cols-2 gap-4 mb-10">
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Score</div>
                  <div className="text-3xl font-black text-slate-900">{gameState.score}</div>
                </div>
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Best</div>
                  <div className="text-3xl font-black text-slate-900">{gameState.highScore}</div>
                </div>
              </div>

              <button 
                onClick={resetGame}
                className="w-full py-5 bg-orange-500 text-white rounded-2xl font-bold text-xl hover:bg-orange-600 transition-all shadow-xl hover:shadow-2xl active:scale-95 flex items-center justify-center gap-3"
              >
                <RotateCcw size={24} />
                Try Again
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructions Hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30 text-sm font-medium tracking-widest uppercase pointer-events-none">
        Hold Mouse to Draw • Release to Fire
      </div>
    </div>
  );
}
