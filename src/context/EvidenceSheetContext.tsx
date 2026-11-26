'use client';

import React, { createContext, useContext, useState } from 'react';

export interface EvidenceItem {
  chunk_id: string;
  quote?: string;
  text?: string;
  source_title?: string;
  source_year?: number;
  page?: number;
  section?: string;
  evidence_level?: string;
}

interface EvidenceSheetContextType {
  isOpen: boolean;
  activeEvidence: EvidenceItem | null;
  openEvidence: (item: EvidenceItem) => void;
  closeEvidence: () => void;
}

const EvidenceSheetContext = createContext<EvidenceSheetContextType | undefined>(undefined);

export function EvidenceSheetProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeEvidence, setActiveEvidence] = useState<EvidenceItem | null>(null);

  const openEvidence = (item: EvidenceItem) => {
    setActiveEvidence(item);
    setIsOpen(true);
  };

  const closeEvidence = () => {
    setIsOpen(false);
    setActiveEvidence(null);
  };

  return (
    <EvidenceSheetContext.Provider value={{ isOpen, activeEvidence, openEvidence, closeEvidence }}>
      {children}
    </EvidenceSheetContext.Provider>
  );
}

export function useEvidenceSheet() {
  const context = useContext(EvidenceSheetContext);
  if (!context) {
    throw new Error('useEvidenceSheet must be used within an EvidenceSheetProvider');
  }
  return context;
}
