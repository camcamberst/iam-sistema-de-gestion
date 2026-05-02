'use client';
import React, { useState, useRef, useEffect } from 'react';

interface VoiceMessagePlayerProps {
  src: string;
  isOwnMessage?: boolean;
}

export default function VoiceMessagePlayer({ src, isOwnMessage = false }: VoiceMessagePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const onTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const onLoadedMetadata = () => {
    if (audioRef.current) {
      // Chrome sometimes gives Infinity or NaN for webm duration
      if (audioRef.current.duration === Infinity || isNaN(audioRef.current.duration)) {
        setDuration(0);
        // Fallback: force the browser to compute the duration
        audioRef.current.currentTime = 1e101; 
        audioRef.current.ontimeupdate = () => {
          if (audioRef.current) {
            audioRef.current.ontimeupdate = onTimeUpdate;
            audioRef.current.currentTime = 0;
            setDuration(audioRef.current.duration);
          }
        };
      } else {
        setDuration(audioRef.current.duration);
      }
    }
  };

  const onEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = value;
      setCurrentTime(value);
    }
  };

  return (
    <div 
      className={`flex items-center gap-3 w-full max-w-[260px] min-w-[200px]`}
      onClick={(e) => e.stopPropagation()}
    >
      <audio 
        ref={audioRef} 
        src={src} 
        onTimeUpdate={onTimeUpdate} 
        onLoadedMetadata={onLoadedMetadata} 
        onEnded={onEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="hidden" 
        preload="metadata"
      />
      
      {/* Play/Pause Button */}
      <button 
        onClick={togglePlay}
        className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full transition-all focus:outline-none ${
          isOwnMessage 
            ? 'bg-white/20 hover:bg-white/30 text-white shadow-sm active:scale-95' 
            : 'bg-blue-500/10 dark:bg-cyan-500/20 hover:bg-blue-500/20 text-blue-600 dark:text-cyan-400 active:scale-95'
        }`}
      >
        {isPlaying ? (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        ) : (
          <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        )}
      </button>

      {/* Progress & Time */}
      <div className="flex flex-col flex-grow relative ml-1 justify-center h-full">
        {/* Progress Bar Container */}
        <div className="relative w-full h-1.5 rounded-full bg-black/10 dark:bg-white/10 flex items-center group cursor-pointer">
          <input 
            type="range" 
            min="0" 
            max={duration || 100} 
            value={currentTime} 
            onChange={handleSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          {/* Progress fill */}
          <div 
            className={`absolute left-0 top-0 h-full rounded-full transition-all duration-75 animate-gradient-x ${
              isOwnMessage 
                ? 'shadow-[0_0_8px_rgba(255,255,255,0.8)]' 
                : 'shadow-[0_0_8px_rgba(34,211,238,0.8)]'
            }`}
            style={{ 
              width: `${progressPercentage}%`,
              backgroundImage: 'linear-gradient(90deg, #c026d3, #06b6d4, #10b981, #06b6d4, #c026d3)',
              backgroundSize: '200% 200%'
            }}
          />
          {/* Thumb */}
          <div 
            className={`absolute w-3 h-3 rounded-full z-0 transition-all duration-75 group-hover:scale-110 ${
              isOwnMessage 
                ? 'bg-white shadow-[0_0_10px_rgba(255,255,255,1)]' 
                : 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,1)]'
            }`}
            style={{ left: `calc(${progressPercentage}% - 6px)` }}
          />
        </div>

        {/* Time Counters */}
        <div className="absolute top-full mt-1 right-0">
          <span className={`text-[10px] tabular-nums font-medium tracking-wide ${
            isOwnMessage ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'
          }`}>
            {formatTime(currentTime)}
          </span>
        </div>
      </div>
    </div>
  );
}
