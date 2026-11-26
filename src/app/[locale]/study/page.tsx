'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { AppShell } from '@/components/shared/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Stethoscope,
  HelpCircle,
  BookOpen,
  CheckCircle2,
  XCircle,
  Search,
  Plus,
  Shield,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface StudentCase {
  id: string;
  title: string;
  specialty: string;
  difficulty: string;
  vignette: string;
  vitals: Record<string, string>;
  options: string[];
}

interface CaseEvaluation {
  isCorrect: boolean;
  selectedOption: string;
  correctOption: string;
  clinicalExplanation: string;
  citations: Array<{ source: string; chunk_id: string; quote: string }>;
}

interface StudentQuiz {
  id: string;
  title: string;
  topic: string;
  question: string;
  options: Array<{ key: string; text: string }>;
}

interface QuizEvaluation {
  isCorrect: boolean;
  selectedAnswer: string;
  correctAnswer: string;
  explanation: string;
}

interface StudentNote {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  chunkText?: string;
  chunkSection?: string;
  sourceTitle?: string;
}

export default function StudentWorkspacePage() {
  const router = useRouter();
  const locale = useLocale();
  const isBn = locale === 'bn';

  const [activeTab, setActiveTab] = useState<'cases' | 'quizzes' | 'notes' | 'library_qa'>('cases');
  const [cases, setCases] = useState<StudentCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [caseEvaluation, setCaseEvaluation] = useState<CaseEvaluation | null>(null);
  const [isEvaluatingCase, setIsEvaluatingCase] = useState(false);

  // Quizzes state
  const [quizzes, setQuizzes] = useState<StudentQuiz[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizResults, setQuizResults] = useState<Record<string, QuizEvaluation>>({});

  // Notes state
  const [notes, setNotes] = useState<StudentNote[]>([]);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteTags, setNewNoteTags] = useState('');

  const fetchCases = useCallback(async () => {
    try {
      const res = await fetch('/api/study/cases');
      if (res.ok) {
        const data = await res.json();
        setCases(data.cases || []);
        if (data.cases && data.cases.length > 0) {
          setSelectedCaseId((prev) => prev || data.cases[0].id);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchQuizzes = useCallback(async () => {
    try {
      const res = await fetch('/api/study/quizzes');
      if (res.ok) {
        const data = await res.json();
        setQuizzes(data.quizzes || []);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch('/api/study/notes');
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCases();
      fetchQuizzes();
      fetchNotes();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchCases, fetchQuizzes, fetchNotes]);

  const activeCase = cases.find((c) => c.id === selectedCaseId) || cases[0];

  const handleCaseSelect = (caseId: string) => {
    setSelectedCaseId(caseId);
    setSelectedOption('');
    setCaseEvaluation(null);
  };

  const handleEvaluateCase = async () => {
    if (!activeCase || !selectedOption) {
      toast.error(isBn ? 'একটি রোগ নির্ণয় নির্বাচন করুন' : 'Please select a diagnosis option');
      return;
    }

    setIsEvaluatingCase(true);
    try {
      const res = await fetch('/api/study/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: activeCase.id,
          selectedOption,
        }),
      });

      if (res.ok) {
        const evalData = await res.json();
        setCaseEvaluation(evalData);
        if (evalData.isCorrect) {
          toast.success(isBn ? 'অভিনন্দন! সঠিক রোগ নির্ণয়' : 'Correct Diagnosis!');
        } else {
          toast.error(isBn ? 'ভুল উত্তর। ব্যাখ্যাটি মনোযোগ দিয়ে পড়ুন' : 'Incorrect. Check the explanation below.');
        }
      }
    } catch {
      toast.error(isBn ? 'মূল্যায়ন সম্পন্ন করা যায়নি' : 'Evaluation failed');
    } finally {
      setIsEvaluatingCase(false);
    }
  };

  const handleAnswerQuiz = async (quizId: string, answerKey: string) => {
    try {
      setQuizAnswers((prev) => ({ ...prev, [quizId]: answerKey }));
      const res = await fetch('/api/study/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId, selectedAnswer: answerKey }),
      });

      if (res.ok) {
        const result = await res.json();
        setQuizResults((prev) => ({ ...prev, [quizId]: result }));
      }
    } catch {
      // ignore
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle || !newNoteContent) {
      toast.error(isBn ? 'শিরোনাম ও বিষয়বস্তু আবশ্যক' : 'Title and content are required');
      return;
    }

    try {
      const tags = newNoteTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch('/api/study/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newNoteTitle,
          content: newNoteContent,
          tags,
        }),
      });

      if (res.ok) {
        toast.success(isBn ? 'নোট সংরক্ষিত হয়েছে' : 'Study note saved');
        setShowAddNoteModal(false);
        setNewNoteTitle('');
        setNewNoteContent('');
        setNewNoteTags('');
        fetchNotes();
      }
    } catch {
      toast.error(isBn ? 'নোট সংরক্ষণ করা যায়নি' : 'Failed to save note');
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <PageHeader
          title={isBn ? 'পড়াশোনা' : 'Study'}
          subtitle={
            isBn
              ? 'অনুশীলনের কেস, কুইজ ও নোট'
              : 'Practice cases, quizzes and notes'
          }
        />

      {/* Safety Notice: Zero Real Patient PHI Access */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 text-xs border border-border text-muted-foreground">
        <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div>
          <strong className="text-foreground block mb-0.5">
            {isBn ? 'শুধু অনুশীলনের জন্য' : 'For practice only'}
          </strong>
          {isBn
            ? 'সব কেস বানানো। কোনো আসল রোগীর তথ্য নেই।'
            : 'All cases are made up. No real patient data.'}
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'cases' | 'quizzes' | 'notes' | 'library_qa')} className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full bg-muted/60 p-1 rounded-xl">
          <TabsTrigger value="cases" data-tour="study-cases" className="text-xs sm:text-sm py-2">
            <Stethoscope className="w-4 h-4 mr-1.5" />
            {isBn ? 'কেস প্র্যাকটিস' : 'Clinical Cases'}
          </TabsTrigger>
          <TabsTrigger value="quizzes" data-tour="study-quizzes" className="text-xs sm:text-sm py-2">
            <HelpCircle className="w-4 h-4 mr-1.5" />
            {isBn ? 'মেডিকেল কুইজ' : 'Medical Quizzes'}
          </TabsTrigger>
          <TabsTrigger value="notes" data-tour="study-notes" className="text-xs sm:text-sm py-2">
            <BookOpen className="w-4 h-4 mr-1.5" />
            {isBn ? 'আমার স্টাডি নোট' : 'Study Notes'}
          </TabsTrigger>
          <TabsTrigger value="library_qa" data-tour="study-library-qa" className="text-xs sm:text-sm py-2">
            <Search className="w-4 h-4 mr-1.5" />
            {isBn ? 'গাইডলাইন সার্চ' : 'Guideline Search'}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Clinical Case Practice Simulator */}
        <TabsContent value="cases" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Case List Sidebar */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-foreground">
                {isBn ? 'অনুশীলনের কেস' : 'Practice cases'}
              </h3>
              <div className="space-y-2">
                {cases.length === 0 && (
                  <Card className="border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    {isBn ? 'এখনও কোনো অনুশীলনের কেস নেই। অ্যাডমিন কেস যোগ করলে এখানে দেখাবে।' : 'No practice cases yet. They appear here when an admin adds them.'}
                  </Card>
                )}
                {cases.map((c) => (
                  <Card
                    key={c.id}
                    className={`border transition-all cursor-pointer ${
                      selectedCaseId === c.id
                        ? 'border-primary bg-primary/5 shadow-xs'
                        : 'border-border bg-card hover:border-foreground/30'
                    }`}
                    onClick={() => handleCaseSelect(c.id)}
                  >
                    <CardContent className="p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                          {c.specialty}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground uppercase">{c.difficulty}</span>
                      </div>
                      <h4 className="font-semibold text-xs sm:text-sm text-foreground line-clamp-2">
                        {c.title}
                      </h4>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Case Details & Interactive Diagnosis Panel */}
            {activeCase && (
              <div className="lg:col-span-2 space-y-4">
                <Card className="border border-border bg-card shadow-xs">
                  <CardHeader className="p-4 sm:p-5 border-b border-border/60">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="outline" className="text-xs font-mono">{activeCase.specialty}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {isBn ? 'কঠিন্যের মাত্রা:' : 'Difficulty:'} <strong className="text-foreground capitalize">{activeCase.difficulty}</strong>
                      </span>
                    </div>
                    <CardTitle className="text-base sm:text-lg text-foreground mt-2">
                      {activeCase.title}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="p-4 sm:p-5 space-y-5">
                    {/* Vignette */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                        {isBn ? 'রোগীর ক্লিনিকাল ইতিহাস ও উপস্থাপনা:' : 'Clinical Vignette:'}
                      </h4>
                      <p className="text-sm text-foreground leading-relaxed bg-muted/30 p-3.5 rounded-xl border border-border/60">
                        {activeCase.vignette}
                      </p>
                    </div>

                    {/* Vitals Grid */}
                    {activeCase.vitals && Object.keys(activeCase.vitals).length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                          {isBn ? 'শারীরিক পরীক্ষা ও ভাইটাল সাইন:' : 'Physical Exam & Vital Signs:'}
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {Object.entries(activeCase.vitals).map(([key, val]) => (
                            <div key={key} className="p-2.5 rounded-lg bg-card border border-border text-xs">
                              <span className="text-muted-foreground uppercase block text-[10px]">{key}</span>
                              <span className="font-semibold text-foreground">{val}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Diagnosis Selector */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                        {isBn ? 'সম্ভাব্য ডিফারেনশিয়াল রোগ নির্ণয় নির্বাচন করুন:' : 'Select the Most Likely Diagnosis:'}
                      </h4>
                      <div className="space-y-2">
                        {activeCase.options.map((opt) => {
                          const isSelected = selectedOption === opt;
                          return (
                            <label
                              key={opt}
                              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors text-xs sm:text-sm ${
                                isSelected
                                  ? 'border-primary bg-primary/5 text-foreground font-semibold'
                                  : 'border-border bg-card text-muted-foreground hover:bg-muted/40'
                              }`}
                            >
                              <input
                                type="radio"
                                name="case_diagnosis"
                                checked={isSelected}
                                onChange={() => setSelectedOption(opt)}
                                className="accent-primary"
                              />
                              <span>{opt}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <Button
                      onClick={handleEvaluateCase}
                      disabled={isEvaluatingCase || !selectedOption}
                      className="w-full font-semibold py-2.5"
                    >
                      {isEvaluatingCase
                        ? isBn ? 'মূল্যায়ন হচ্ছে...' : 'Evaluating...'
                        : isBn ? 'রোগ নির্ণয় যাচাই করুন' : 'Submit Clinical Diagnosis'}
                    </Button>

                    {/* Evaluation Outcome Box */}
                    {caseEvaluation && (
                      <div
                        className={`p-4 rounded-xl border space-y-3 ${
                          caseEvaluation.isCorrect
                            ? 'bg-muted/40 border-border'
                            : 'bg-destructive/10 border-destructive/30'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {caseEvaluation.isCorrect ? (
                            <CheckCircle2 className="w-5 h-5 text-primary" />
                          ) : (
                            <XCircle className="w-5 h-5 text-destructive" />
                          )}
                          <span className="font-bold text-sm text-foreground">
                            {caseEvaluation.isCorrect
                              ? isBn ? 'সঠিক রোগ নির্ণয়!' : 'Correct Diagnosis!'
                              : isBn ? 'উত্তর সঠিক নয়।' : 'Incorrect Diagnosis.'}
                          </span>
                        </div>

                        {!caseEvaluation.isCorrect && (
                          <p className="text-xs text-foreground">
                            <strong>{isBn ? 'সঠিক উত্তর:' : 'Correct Answer:'}</strong> {caseEvaluation.correctOption}
                          </p>
                        )}

                        <div className="text-xs text-foreground space-y-1">
                          <strong>{isBn ? 'ক্লিনিকাল যুক্তি ও ব্যাখ্যা:' : 'Clinical Rationale:'}</strong>
                          <p className="leading-relaxed text-muted-foreground">{caseEvaluation.clinicalExplanation}</p>
                        </div>

                        {caseEvaluation.citations && caseEvaluation.citations.length > 0 && (
                          <div className="pt-2 border-t border-border/60 space-y-1.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                              {isBn ? 'অনুমোদিত রেফারেন্স সাইটেশন:' : 'Approved Guideline Citations:'}
                            </span>
                            {caseEvaluation.citations.map((cite, i) => (
                              <div key={i} className="text-xs bg-background/60 p-2.5 rounded-lg border border-border">
                                <span className="font-semibold text-foreground block">{cite.source}</span>
                                <p className="italic text-muted-foreground mt-0.5">&ldquo;{cite.quote}&rdquo;</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 2: Medical Quizzes */}
        <TabsContent value="quizzes" className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {isBn ? 'অধ্যায়ভিত্তিক মেডিকেল কুইজ' : 'Guideline-Based Medical Quizzes'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isBn ? 'বাংলাদেশ ও আন্তর্জাতিক ক্লিনিকাল গাইডলাইনের গুরুত্বপূর্ণ প্রশ্নসমূহ' : 'Key pharmacological and clinical practice questions'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {quizzes.length === 0 && (
              <Card className="border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {isBn ? 'এখনও কোনো কুইজ নেই।' : 'No quizzes yet.'}
              </Card>
            )}
            {quizzes.map((quiz) => {
              const result = quizResults[quiz.id];
              const selectedKey = quizAnswers[quiz.id];

              return (
                <Card key={quiz.id} className="border border-border bg-card p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-xs">
                      {quiz.topic}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{quiz.title}</span>
                  </div>

                  <h3 className="font-semibold text-sm sm:text-base text-foreground leading-snug">
                    {quiz.question}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {quiz.options.map((opt) => {
                      const isChosen = selectedKey === opt.key;
                      let btnStyle = 'border-border bg-background text-foreground hover:border-foreground/30';

                      if (result) {
                        if (opt.key === result.correctAnswer) {
                          btnStyle = 'border-primary bg-primary/10 text-foreground font-bold';
                        } else if (isChosen && !result.isCorrect) {
                          btnStyle = 'border-destructive bg-destructive/10 text-destructive font-bold';
                        }
                      } else if (isChosen) {
                        btnStyle = 'border-primary bg-primary/5 text-foreground';
                      }

                      return (
                        <button
                          key={opt.key}
                          type="button"
                          disabled={Boolean(result)}
                          onClick={() => handleAnswerQuiz(quiz.id, opt.key)}
                          className={`p-3 rounded-xl border text-left text-xs sm:text-sm flex items-start gap-2.5 transition-colors ${btnStyle}`}
                        >
                          <span className="font-bold text-muted-foreground">{opt.key}.</span>
                          <span>{opt.text}</span>
                        </button>
                      );
                    })}
                  </div>

                  {result && (
                    <div
                      className={`p-3 rounded-lg text-xs space-y-1 ${
                        result.isCorrect
                          ? 'bg-muted/40 text-foreground border border-border'
                          : 'bg-muted/40 text-foreground border border-border'
                      }`}
                    >
                      <span className="font-bold block">
                        {result.isCorrect
                          ? isBn ? 'সঠিক উত্তর! ✓' : 'Correct Answer! ✓'
                          : isBn ? `সঠিক উত্তর: ${result.correctAnswer}` : `Correct answer: ${result.correctAnswer}`}
                      </span>
                      <p>{result.explanation}</p>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Tab 3: Study Notes */}
        <TabsContent value="notes" className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {isBn ? 'ব্যক্তিগত স্টাডি নোট ও বুকমার্ক' : 'Personal Study Notes & Bookmarks'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isBn ? 'গাইডলাইনের গুরুত্বপূর্ণ পয়েন্ট ও পরীক্ষার প্রয়োজনীয় নোট সংরক্ষণ করুন' : 'Saved clinical pearls and textbook highlights'}
              </p>
            </div>

            <Button
              size="sm"
              className="text-xs flex items-center gap-1.5"
              onClick={() => setShowAddNoteModal(true)}
            >
              <Plus className="w-4 h-4" />
              {isBn ? 'নতুন নোট' : 'Add Note'}
            </Button>
          </div>

          {notes.length === 0 ? (
            <Card className="border border-dashed border-border p-8 text-center">
              <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {isBn ? 'এখনও কোনো স্টাডি নোট নেই। নতুন নোট তৈরি করুন।' : 'No study notes yet.'}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {notes.map((note) => (
                <Card key={note.id} className="border border-border bg-card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-sm text-foreground">{note.title}</h4>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(note.createdAt).toLocaleDateString(isBn ? 'bn-BD' : 'en-US')}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {note.content}
                  </p>

                  {note.sourceTitle && (
                    <div className="text-[11px] text-muted-foreground font-mono bg-muted/40 p-2 rounded border border-border">
                      {isBn ? 'উৎস:' : 'Source:'} {note.sourceTitle} {note.chunkSection && `• ${note.chunkSection}`}
                    </div>
                  )}

                  {note.tags && note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {note.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px]">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab 4: Guideline Search & Internal Closed Library */}
        <TabsContent value="library_qa" className="space-y-4 mt-6">
          <Card className="border border-border bg-card p-6 text-center space-y-3">
            <BookOpen className="w-10 h-10 text-muted-foreground mx-auto" />
            <h3 className="text-base font-bold text-foreground">
              {isBn ? 'মেডিকেল লাইব্রেরিতে অনুসন্ধান' : 'Search Medical Guidelines'}
            </h3>
            <p className="text-xs text-muted-foreground max-w-lg mx-auto">
              {isBn
                ? 'অনুমোদিত টেক্সটবুক ও গাইডলাইন থেকে সরাসরি রেফারেন্স খুঁজুন।'
                : 'Search verified textbooks and guidelines with verbatim citations.'}
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <Button
                className="text-xs"
                onClick={() => router.push('/library')}
              >
                {isBn ? 'লাইব্রেরি ব্রাউজ করুন' : 'Browse Library'}
              </Button>
              <Button
                variant="outline"
                className="text-xs"
                onClick={() => router.push('/ask')}
              >
                {isBn ? 'প্রশ্ন জিজ্ঞাসা করুন' : 'Ask Question'}
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Note Dialog */}
      <Dialog open={showAddNoteModal} onOpenChange={setShowAddNoteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isBn ? 'নতুন স্টাডি নোট' : 'New Study Note'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {isBn ? 'সহজে মনে রাখার জন্য সংক্ষিপ্ত নোট লিখুন।' : 'Save key clinical points for quick review.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateNote} className="space-y-3 pt-1">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                {isBn ? 'নোটের শিরোনাম *' : 'Title *'}
              </label>
              <Input
                placeholder={isBn ? 'যেমন: অ্যাজমা বনাম সিওপিডি পার্থক্য' : 'e.g. Asthma vs COPD distinction'}
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                {isBn ? 'বিষয়বস্তু *' : 'Notes *'}
              </label>
              <textarea
                rows={4}
                className="w-full text-xs p-2.5 rounded-md border border-border bg-background text-foreground"
                placeholder={isBn ? 'মূল লক্ষণ, ওষুধ বা নোট লিখুন...' : 'Write key clinical points...'}
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                {isBn ? 'ট্যাগ (কমা দিয়ে)' : 'Tags (comma separated)'}
              </label>
              <Input
                placeholder={isBn ? 'পালমোনোলজি, ড্রাগ, গাইডলাইন' : 'pulmonology, drugs, exam'}
                value={newNoteTags}
                onChange={(e) => setNewNoteTags(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAddNoteModal(false)}>
                {isBn ? 'বাতিল' : 'Cancel'}
              </Button>
              <Button type="submit" size="sm">
                {isBn ? 'সংরক্ষণ করুন' : 'Save Note'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      </div>
    </AppShell>
  );
}
