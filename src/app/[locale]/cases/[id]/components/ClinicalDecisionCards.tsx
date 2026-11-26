'use client';

import React from 'react';
import {
  LabInterpretationResult,
  ClinicalScoreResult,
  ConsensusSummary,
  DecisionChip,
} from '@/types';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Activity,
  CheckCircle2,
  FileText,
  Layers,
  Scale,
  Zap,
} from 'lucide-react';

interface ClinicalDecisionCardsProps {
  labInterpretation?: LabInterpretationResult;
  clinicalScores?: ClinicalScoreResult[];
  consensusSummary?: ConsensusSummary;
  decisionChips?: DecisionChip[];
  locale: string;
  onChipClick?: (chip: DecisionChip) => void;
}

export function ClinicalDecisionCards({
  labInterpretation,
  clinicalScores,
  consensusSummary,
  decisionChips,
  locale,
  onChipClick,
}: ClinicalDecisionCardsProps) {
  const isBn = locale === 'bn';

  return (
    <div className="w-full max-w-[92%] sm:max-w-[85%] space-y-3 mt-1.5 animate-fadeIn">
      {/* 1. Lab and Diagnostic Report Breakdown Card */}
      {labInterpretation && labInterpretation.hasLabData && (
        <Card className="p-3.5 sm:p-4 rounded-xl border border-border bg-card/90 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <div className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-md flex items-center justify-center ${
                  labInterpretation.overallAcuity === 'critical'
                    ? 'bg-destructive/10 text-destructive'
                    : labInterpretation.overallAcuity === 'abnormal'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'bg-emerald-500/10 text-emerald-600'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
              </div>
              <span className="font-semibold text-xs sm:text-sm text-foreground">
                {isBn ? 'ডায়াগনস্টিক রিপোর্ট মূল্যায়ন' : 'Diagnostic Report Interpretation'}
              </span>
            </div>
            <Badge
              variant="outline"
              className={`text-[10px] uppercase font-bold py-0.5 px-2 ${
                labInterpretation.overallAcuity === 'critical'
                  ? 'bg-destructive/15 text-destructive border-destructive/40'
                  : labInterpretation.overallAcuity === 'abnormal'
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40'
                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
              }`}
            >
              {labInterpretation.overallAcuity === 'critical'
                ? isBn ? 'জরুরি (Critical)' : 'Critical'
                : labInterpretation.overallAcuity === 'abnormal'
                ? isBn ? 'অস্বাভাবিক (Abnormal)' : 'Abnormal'
                : isBn ? 'স্বাভাবিক (Normal)' : 'Normal'}
            </Badge>
          </div>

          {/* Clinical Significance Summary */}
          <p className="text-xs text-foreground/90 leading-relaxed font-medium">
            {isBn ? labInterpretation.clinicalSummaryBn : labInterpretation.clinicalSummaryEn}
          </p>

          {/* Detailed Lab Item Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {labInterpretation.items.map((item) => (
              <div
                key={item.key}
                className={`p-2.5 rounded-lg border text-[11px] leading-snug space-y-1 ${
                  item.acuity === 'critical'
                    ? 'bg-destructive/5 border-destructive/30'
                    : item.acuity === 'abnormal'
                    ? 'bg-amber-500/5 border-amber-500/30'
                    : 'bg-muted/30 border-border/60'
                }`}
              >
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-foreground">{isBn ? item.nameBn : item.nameEn}</span>
                  <span
                    className={`font-mono font-bold ${
                      item.acuity === 'critical'
                        ? 'text-destructive'
                        : item.acuity === 'abnormal'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {item.value} {item.unit !== 'Imaging' ? item.unit : ''}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {isBn ? 'রেফারেন্স রেঞ্জ' : 'Ref Range'}: {item.referenceRange}
                </div>
                <div className="text-[11px] text-foreground/80 font-medium pt-0.5">
                  👉 {isBn ? item.clinicalMeaningBn : item.clinicalMeaningEn}
                </div>
              </div>
            ))}
          </div>

          {/* Differential Impact & Actionable Steps */}
          {(labInterpretation.differentialImpactBn.length > 0 ||
            labInterpretation.actionableNextStepsBn.length > 0) && (
            <div className="pt-2 border-t border-border/50 text-[11px] space-y-1.5">
              {labInterpretation.differentialImpactBn.length > 0 && (
                <div className="text-foreground/90">
                  <span className="font-bold text-primary mr-1">
                    {isBn ? 'রোগ নির্ণয়ে তাৎপর্য:' : 'Differential Impact:'}
                  </span>
                  {isBn
                    ? labInterpretation.differentialImpactBn.join(' ')
                    : labInterpretation.differentialImpactEn.join(' ')}
                </div>
              )}
              {labInterpretation.actionableNextStepsBn.length > 0 && (
                <div className="text-foreground/90">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 mr-1">
                    {isBn ? 'করণীয় পদক্ষেপ:' : 'Actionable Next Steps:'}
                  </span>
                  {isBn
                    ? labInterpretation.actionableNextStepsBn.join(' ')
                    : labInterpretation.actionableNextStepsEn.join(' ')}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* 2. Automated Clinical Severity & Risk Scoring Card */}
      {clinicalScores && clinicalScores.length > 0 && (
        <div className="space-y-2">
          {clinicalScores.map((scoreResult) => (
            <Card
              key={scoreResult.calculatorId}
              className="p-3.5 sm:p-4 rounded-xl border border-primary/20 bg-primary/5 shadow-xs space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-primary/15 text-primary flex items-center justify-center">
                    <Scale className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-foreground">
                      {isBn ? scoreResult.nameBn : scoreResult.nameEn}
                    </h4>
                    {scoreResult.sourceGuideline && (
                      <span className="text-[10px] text-muted-foreground block">
                        {scoreResult.sourceGuideline}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-base font-extrabold text-foreground">
                    {scoreResult.score}/{scoreResult.maxScore}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-bold py-0.5 px-2 ${
                      scoreResult.riskTier === 'critical' || scoreResult.riskTier === 'high'
                        ? 'bg-destructive/15 text-destructive border-destructive/40'
                        : scoreResult.riskTier === 'moderate'
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40'
                        : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                    }`}
                  >
                    {isBn ? scoreResult.riskDescriptionBn : scoreResult.riskDescriptionEn}
                  </Badge>
                </div>
              </div>

              {/* Clinical Recommendation */}
              <div className="p-2.5 rounded-lg bg-card/80 border border-border/60 text-xs text-foreground leading-relaxed">
                <span className="font-bold text-primary mr-1">
                  {isBn ? 'সুপারিশকৃত ব্যবস্থাপনা:' : 'Recommendation:'}
                </span>
                {isBn ? scoreResult.recommendationBn : scoreResult.recommendationEn}
              </div>

              {/* Variable Checklist */}
              {scoreResult.variables.length > 0 && (
                <div className="flex items-center flex-wrap gap-1.5 pt-1 text-[10px]">
                  {scoreResult.variables.map((v, vIdx) => (
                    <Badge
                      key={vIdx}
                      variant="outline"
                      className={`py-0 px-2 font-medium ${
                        v.points > 0
                          ? 'bg-destructive/10 text-destructive border-destructive/30'
                          : 'bg-muted/40 text-muted-foreground border-border/50'
                      }`}
                    >
                      {v.name}: {String(v.value)}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* 3. Cross-Library Consensus Synthesis Card */}
      {consensusSummary && consensusSummary.consensusStatus === 'strong_consensus' && (
        <Card className="p-3.5 sm:p-4 rounded-xl border border-border bg-card/80 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-xs sm:text-sm text-foreground">
                {isBn ? 'মাল্টি-গাইডলাইন ঐক্যমত্য (Cross-Library Consensus)' : 'Cross-Library Consensus'}
              </span>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] font-semibold bg-primary/10 text-primary border-primary/30"
            >
              {isBn ? 'একাধিক গাইডলাইন সমর্থিত' : 'Multi-Source Supported'}
            </Badge>
          </div>

          <div className="space-y-1.5 text-xs text-foreground/90 leading-relaxed">
            {(isBn ? consensusSummary.agreementsBn : consensusSummary.agreementsEn).map(
              (agreement, aIdx) => (
                <div key={aIdx} className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{agreement}</span>
                </div>
              )
            )}
          </div>

          {/* Sources breakdown */}
          <div className="pt-2 border-t border-border/40 space-y-1.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              {isBn ? 'সংশ্লিষ্ট গাইডলাইনসমূহ:' : 'Referenced Guidelines:'}
            </span>
            <div className="space-y-1">
              {consensusSummary.sourceItems.map((item, sIdx) => (
                <div
                  key={sIdx}
                  className="flex items-center justify-between text-[11px] p-1.5 rounded-md bg-muted/30 border border-border/50"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="font-medium text-foreground truncate">
                      {item.sourceTitle} {item.sourceYear ? `(${item.sourceYear})` : ''}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[9px] py-0 shrink-0">
                    {isBn ? item.recommendationBn : item.recommendationEn}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* 4. One-Tap Clinical Decision Chips Bar */}
      {decisionChips && decisionChips.length > 0 && (
        <div className="flex items-center flex-wrap gap-1.5 pt-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-1 flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-500" />
            {isBn ? 'কুইক অ্যাকশন:' : 'Quick Actions:'}
          </span>
          {decisionChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => onChipClick?.(chip)}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-background hover:bg-primary/10 text-foreground hover:text-primary border border-border/80 hover:border-primary/40 shadow-2xs transition-all active:scale-95 flex items-center gap-1.5"
            >
              <span>{isBn ? chip.labelBn : chip.labelEn}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
