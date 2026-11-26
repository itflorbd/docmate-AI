'use client';

import type { CaseTurn, PatientCase } from '@/types';
import { CaseChat } from '@/components/case-chat/case-chat';
import type { ChatTurn } from '@/components/case-chat/use-case-chat';

interface CaseConversationTabProps {
  caseId: string;
  caseData: PatientCase;
  turns: CaseTurn[];
  onTurnsUpdate: (turns: CaseTurn[]) => void;
  onCaseUpdate: (updatedCase: PatientCase) => void;
}

/** Case workspace conversation tab. The chat itself lives in components/case-chat. */
export function CaseConversationTab({ caseId, caseData, turns, onTurnsUpdate, onCaseUpdate }: CaseConversationTabProps) {
  return (
    <CaseChat
      caseId={caseId}
      caseData={caseData}
      turns={turns as unknown as ChatTurn[]}
      onTurnsUpdate={(next) => onTurnsUpdate(next as unknown as CaseTurn[])}
      onCaseUpdate={onCaseUpdate}
    />
  );
}
