'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DifferentialDiagnosis } from '@/types';
import { CheckCircle2, Stethoscope } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ConfirmDiagnosisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  differentials: DifferentialDiagnosis[];
  initialCondition?: string;
  onConfirm: (condition: string) => void;
}

export function ConfirmDiagnosisDialog({
  open,
  onOpenChange,
  differentials,
  initialCondition,
  onConfirm,
}: ConfirmDiagnosisDialogProps) {
  const t = useTranslations('workspace');
  const [selectedCondition, setSelectedCondition] = useState<string>(
    initialCondition || differentials[0]?.condition || ''
  );
  const [customCondition, setCustomCondition] = useState<string>('');
  const [useCustom, setUseCustom] = useState<boolean>(false);

  const handleConfirm = () => {
    const finalDiagnosis = useCustom ? customCondition.trim() : selectedCondition;
    if (!finalDiagnosis) return;
    onConfirm(finalDiagnosis);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md space-y-4">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-bold">
            <Stethoscope className="w-5 h-5" />
            <DialogTitle className="text-base font-bold">
              {t('confirmDiagnosisTitle')}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            {t('confirmDiagnosisDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Label className="text-xs font-semibold text-foreground">
            Ranked Candidate Diagnoses:
          </Label>

          <RadioGroup
            value={useCustom ? 'custom' : selectedCondition}
            onValueChange={(val) => {
              if (val === 'custom') {
                setUseCustom(true);
              } else {
                setUseCustom(false);
                setSelectedCondition(val);
              }
            }}
            className="space-y-2"
          >
            {differentials.map((diff) => (
              <div
                key={diff.condition}
                className="flex items-center space-x-2.5 p-2.5 rounded-md border border-border/70 hover:bg-muted/40 cursor-pointer"
              >
                <RadioGroupItem value={diff.condition} id={`diag-${diff.condition}`} />
                <Label
                  htmlFor={`diag-${diff.condition}`}
                  className="flex-1 text-xs font-semibold cursor-pointer text-foreground flex items-center justify-between"
                >
                  <span>
                    {diff.condition_bn || diff.condition}
                    {diff.condition_bn && (
                      <span className="text-muted-foreground font-normal ml-1">
                        ({diff.condition})
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">
                    {diff.likelihood_label}
                  </span>
                </Label>
              </div>
            ))}

            <div className="flex items-center space-x-2.5 p-2.5 rounded-md border border-border/70 hover:bg-muted/40">
              <RadioGroupItem value="custom" id="diag-custom" />
              <Label htmlFor="diag-custom" className="text-xs font-medium cursor-pointer text-muted-foreground">
                {t('otherDiagnosis')}
              </Label>
            </div>
          </RadioGroup>

          {useCustom && (
            <div className="pt-2">
              <Input
                placeholder={t('diagnosisPlaceholder')}
                value={customCondition}
                onChange={(e) => setCustomCondition(e.target.value)}
                className="text-xs"
                autoFocus
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={useCustom ? !customCondition.trim() : !selectedCondition}
            className="gap-1.5 text-xs font-semibold"
          >
            <CheckCircle2 className="w-4 h-4" />
            {t('proceedToTreatment')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
