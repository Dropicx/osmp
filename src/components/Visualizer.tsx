import { useRef, useEffect, useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useIsPlaying } from '../store/selectors';
import { useStore } from '../store/useStore';

interface VisualizerProps {
  onClick: () => void;
}

const BAR_COUNT = 10;
const BAR_GAP = 3;
const POLL_INTERVAL = 100; // ms between data polls (10fps, smooth for bar visualization)

export default function Visualizer({ onClick }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const barsRef = useRef<number[]>(new Array(BAR_COUNT).fill(0));
  const targetBarsRef = useRef<number[]>(new Array(BAR_COUNT).fill(0));
  const [hovered, setHovered] = useState(false);
  const isPlaying = useIsPlaying();
  const visualizerOpacity = useStore((s) => s.visualizerOpacity);

  // Poll backend for real frequency data
  useEffect(() => {
    if (isPlaying) {
      pollRef.current = setInterval(async () => {
        try {
          const levels = await invoke<number[]>('get_visualizer_data');
          if (levels && levels.length === BAR_COUNT) {
            for (let i = 0; i < BAR_COUNT; i++) {
              targetBarsRef.current[i] = levels[i];
            }
          }
        } catch {
          // Silently ignore poll errors
        }
      }, POLL_INTERVAL);
    } else {
      // When paused, target all bars to zero
      for (let i = 0; i < BAR_COUNT; i++) {
        targetBarsRef.current[i] = 0;
      }
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isPlaying]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const padding = 12;
    const drawWidth = width - padding * 2;
    const barWidth = (drawWidth - (BAR_COUNT - 1) * BAR_GAP) / BAR_COUNT;
    const maxBarHeight = height * 0.75;

    for (let i = 0; i < BAR_COUNT; i++) {
      // Smooth interpolation toward target
      const speed = targetBarsRef.current[i] > barsRef.current[i] ? 0.3 : 0.12;
      barsRef.current[i] += (targetBarsRef.current[i] - barsRef.current[i]) * speed;

      // Minimum bar height when playing for visual feedback
      const minHeight = isPlaying ? 0.02 : 0;
      const barLevel = Math.max(minHeight, barsRef.current[i]);
      const barHeight = barLevel * maxBarHeight;

      if (barHeight < 1) continue;

      const x = padding + i * (barWidth + BAR_GAP);
      const y = height - barHeight - padding;

      // Gradient fill - intensity varies with level
      const gradient = ctx.createLinearGradient(x, y, x, height - padding);
      const alpha = 0.7 + barLevel * 0.3;
      gradient.addColorStop(0, `rgba(139, 92, 246, ${alpha})`); // primary-500
      gradient.addColorStop(1, `rgba(236, 72, 153, ${alpha * 0.8})`); // accent-500
      ctx.fillStyle = gradient;

      // Draw rounded bar
      const radius = Math.min(barWidth / 2, 4);
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + barWidth - radius, y);
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
      ctx.lineTo(x + barWidth, height - padding);
      ctx.lineTo(x, height - padding);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.fill();
    }

    animationRef.current = requestAnimationFrame(animate);
  }, [isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas resolution to match display size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate]);

  return (
    <canvas
      ref={canvasRef}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="absolute inset-0 w-full h-full cursor-pointer z-10 transition-opacity rounded-lg"
      style={{ opacity: hovered ? 1 : visualizerOpacity / 100 }}
      title="Open Equalizer"
    />
  );
}
