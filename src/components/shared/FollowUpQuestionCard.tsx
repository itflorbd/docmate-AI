'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MissingInformation } from '@/types';
import { HelpCircle, Stethoscope, TestTube2, Send, Check, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVoice } from '@/context/VoiceContext';

interface FollowUpQuestionCardProps {
  item: MissingInformation;
  onAnswerSubmit: (questionId: string, answer: string) => void;
  disabled?: boolean;
  className?: string;
}

export function FollowUpQuestionCard({
  item,
  onAnswerSubmit,
  disabled,
  className,
}: FollowUpQuestionCardProps) {
  const { openVoicePanel, speakText } = useVoice();
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const getTypeIcon = () => {
    switch (item.type) {
      case 'exam':
        return <Stethoscope className="w-4 h-4 text-primary" />;
      case 'test':
        return <TestTube2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case 'question':
      default:
        return <HelpCircle className="w-4 h-4 text-teal-600 dark:text-teal-400" />;
    }
  };

  const getTypeLabel = () => {
    switch (item.type) {
      case 'exam':
        return 'Physical Examination';
      case 'test':
        return 'Laboratory / Diagnostic Test';
      case 'question':
      default:
        return 'Clinical Clarification';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim() || disabled) return;
    onAnswerSubmit(item.id, answer.trim());
    setSubmitted(true);
  };

  return (
    <Card className={cn('border-border/80 shadow-xs hover:border-primary/40 transition-colors', className)}>
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-muted">{getTypeIcon()}</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {getTypeLabel()}
            </span>
          </div>
          {item.which_diagnoses_it_separates?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.which_diagnoses_it_separates.map((dx) => (
                <Badge key={dx} variant="secondary" className="text-[10px] px-1.5 py-0">
                  vs {dx}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <CardTitle className="text-sm font-semibold text-foreground pt-1 leading-snug">
          {item.text}
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4 pt-1 space-y-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground/80 font-medium">Why it helps: </strong>
          {item.why_it_helps}
        </p>

        {submitted ? (
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 bg-emerald-500/10 p-2.5 rounded-md border border-emerald-500/20">
            <Check className="w-4 h-4 shrink-0" />
            <span>Answer recorded: &ldquo;{answer}&rdquo;</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={answer}
              aria-label={item.text}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Enter clinical finding, test result, or note..."
              className="text-xs h-9 bg-background"
              disabled={disabled}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                openVoicePanel();
                speakText(item.text);
              }}
              aria-label="বলে উত্তর দিন (Answer by Voice)"
              title="বলে উত্তর দিন (Answer by Voice)"
              className="h-9 px-2.5 gap-1 shrink-0 text-primary border-primary/30 hover:bg-primary/10"
            >
              <Mic className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs font-medium">বলে উত্তর দিন</span>
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!answer.trim() || disabled}
              className="h-9 px-3 gap-1 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs">Save Answer</span>
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
