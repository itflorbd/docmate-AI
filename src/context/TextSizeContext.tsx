'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type TextScale = '100' | '115' | '130';

interface TextSizeContextType {
  textScale: TextScale;
  setTextScale: (scale: TextScale) => void;
  increaseTextSize: () => void;
  decreaseTextSize: () => void;
}

const TextSizeContext = createContext<TextSizeContextType | undefined>(undefined);

const STORAGE_KEY = 'docmate_text_size';

export function TextSizeProvider({ children }: { children: React.ReactNode }) {
  const [textScale, setTextScaleState] = useState<TextScale>('100');

  const applyScaleClass = (scale: TextScale) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.remove('text-scale-100', 'text-scale-115', 'text-scale-130');
    root.classList.add(`text-scale-${scale}`);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY) as TextScale | null;
        if (saved && (saved === '100' || saved === '115' || saved === '130')) {
          setTextScaleState(saved);
          applyScaleClass(saved);
        } else {
          applyScaleClass('100');
        }
      } catch {
        applyScaleClass('100');
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const setTextScale = (scale: TextScale) => {
    setTextScaleState(scale);
    applyScaleClass(scale);
    try {
      localStorage.setItem(STORAGE_KEY, scale);
    } catch {
      // ignore
    }
  };

  const increaseTextSize = () => {
    if (textScale === '100') setTextScale('115');
    else if (textScale === '115') setTextScale('130');
  };

  const decreaseTextSize = () => {
    if (textScale === '130') setTextScale('115');
    else if (textScale === '115') setTextScale('100');
  };

  return (
    <TextSizeContext.Provider
      value={{
        textScale,
        setTextScale,
        increaseTextSize,
        decreaseTextSize,
      }}
    >
      {children}
    </TextSizeContext.Provider>
  );
}

export function useTextSize(): TextSizeContextType {
  const context = useContext(TextSizeContext);
  if (!context) {
    throw new Error('useTextSize must be used within a TextSizeProvider');
  }
  return context;
}
