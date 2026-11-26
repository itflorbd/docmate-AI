'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { AppShell } from '@/components/shared/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  FileSearch,
  FolderArchive,
  Download,
  Bookmark,
  ShieldCheck,
  Plus,
  Quote,
  Table,
  Search,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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

interface SearchResult {
  id: string;
  section: string;
  page: number;
  evidenceLevel: string;
  text: string;
  sourceId: string;
  sourceTitle: string;
  sourceType: string;
  sourceYear: number;
  sourceLicense: string;
}

interface ResearchCollection {
  id: string;
  title: string;
  description: string | null;
  items: Array<{ title: string; year: number; evidenceLevel: string; notes?: string }>;
  tags: string[];
  createdAt: string;
}

export default function ResearcherWorkspacePage() {
  const locale = useLocale();
  const isBn = locale === 'bn';

  const [activeTab, setActiveTab] = useState<'search' | 'collections' | 'export'>('search');

  // Faceted Search State
  const [query, setQuery] = useState('');
  const [evidenceLevel, setEvidenceLevel] = useState('all');
  const [sourceType, setSourceType] = useState('all');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedChunkIds, setSelectedChunkIds] = useState<string[]>([]);

  // Collections State
  const [collections, setCollections] = useState<ResearchCollection[]>([]);
  const [showAddCollectionModal, setShowAddCollectionModal] = useState(false);
  const [newColTitle, setNewColTitle] = useState('');
  const [newColDesc, setNewColDesc] = useState('');

  // Export State
  const [isExporting, setIsExporting] = useState(false);

  const handleSearch = useCallback(async () => {
    setIsSearching(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (evidenceLevel !== 'all') params.set('evidence_level', evidenceLevel);
      if (sourceType !== 'all') params.set('source_type', sourceType);
      if (yearFrom) params.set('year_from', yearFrom);
      if (yearTo) params.set('year_to', yearTo);

      const res = await fetch(`/api/research/search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch {
      toast.error(isBn ? 'সার্চ সম্পন্ন করা যায়নি' : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  }, [evidenceLevel, isBn, query, sourceType, yearFrom, yearTo]);

  const fetchCollections = useCallback(async () => {
    try {
      const res = await fetch('/api/research/collections');
      if (res.ok) {
        const data = await res.json();
        setCollections(data.collections || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch();
      fetchCollections();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchCollections, handleSearch]);

  const toggleSelectChunk = (id: string) => {
    setSelectedChunkIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColTitle) {
      toast.error(isBn ? 'সংকলনের শিরোনাম আবশ্যক' : 'Title is required');
      return;
    }

    try {
      const res = await fetch('/api/research/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newColTitle,
          description: newColDesc,
          items: [],
          tags: ['Research', 'Guidelines'],
        }),
      });

      if (res.ok) {
        toast.success(isBn ? 'সংকলন তৈরি হয়েছে' : 'Collection created');
        setShowAddCollectionModal(false);
        setNewColTitle('');
        setNewColDesc('');
        fetchCollections();
      }
    } catch {
      toast.error(isBn ? 'তৈরি করা যায়নি' : 'Failed to create collection');
    }
  };

  const handleTriggerExport = async (format: 'csv' | 'ris' | 'bibtex') => {
    const idsToExport = selectedChunkIds.length > 0 ? selectedChunkIds : searchResults.slice(0, 10).map((r) => r.id);

    if (idsToExport.length === 0) {
      toast.error(isBn ? 'এক্সপোর্ট করার জন্য অন্তত ১টি রেকর্ড নির্বাচন করুন' : 'Select at least 1 record to export');
      return;
    }

    setIsExporting(true);
    try {
      const res = await fetch('/api/research/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chunkIds: idsToExport,
          format,
        }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = format === 'ris' ? 'ris' : format === 'bibtex' ? 'bib' : 'csv';
        a.download = `docmate_citations_${Date.now()}.${ext}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success(isBn ? 'সাইটেশন ফাইল সফলভাবে ডাউনলোড হয়েছে' : 'Citations exported successfully');
      } else {
        toast.error(isBn ? 'এক্সপোর্ট ব্যর্থ হয়েছে' : 'Export failed');
      }
    } catch {
      toast.error(isBn ? 'ডাউনলোড সম্পন্ন করা যায়নি' : 'Download failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <PageHeader
          title={isBn ? 'গবেষণা' : 'Research'}
          subtitle={
            isBn
              ? 'গাইডলাইন খুঁজুন ও সাইটেশন (Citation) নিন'
              : 'Search guidelines and export citations'
          }
        />

      {/* Safety Notice: Strict Literature Mode (Zero Patient Data) */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 text-xs border border-border text-muted-foreground">
        <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div>
          <strong className="text-foreground block mb-0.5">
            {isBn ? 'রোগীর তথ্য নেই' : 'No patient data'}
          </strong>
          {isBn
            ? 'শুধু প্রকাশিত মেডিকেল উৎস খোঁজা যায়।'
            : 'You can search published medical sources only.'}
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'search' | 'collections' | 'export')} className="w-full">
        <TabsList className="grid grid-cols-3 w-full bg-muted/60 p-1 rounded-xl">
          <TabsTrigger value="search" data-tour="research-search" className="text-xs sm:text-sm py-2">
            <FileSearch className="w-4 h-4 mr-1.5" />
            {isBn ? 'উন্নত ফিল্টারড সার্চ' : 'Faceted Search'}
          </TabsTrigger>
          <TabsTrigger value="collections" data-tour="research-collections" className="text-xs sm:text-sm py-2">
            <FolderArchive className="w-4 h-4 mr-1.5" />
            {isBn ? 'গবেষণা সংকলন' : 'Collections'}
          </TabsTrigger>
          <TabsTrigger value="export" data-tour="research-export" className="text-xs sm:text-sm py-2">
            <Download className="w-4 h-4 mr-1.5" />
            {isBn ? 'সাইটেশন এক্সপোর্ট' : 'Citation Export'}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Faceted Literature Search */}
        <TabsContent value="search" className="space-y-6 mt-6">
          {/* Filter Bar */}
          <Card className="border border-border bg-card p-4 sm:p-5">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <Input
                    placeholder={isBn ? 'কীওয়ার্ড দিয়ে খুঁজুন (যেমন: Hypertension, Paracetamol, Tuberculosis)...' : 'Search keywords...'}
                    className="pl-9"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
                <Button onClick={handleSearch} disabled={isSearching} className="shrink-0">
                  {isSearching ? (isBn ? 'অনুসন্ধান হচ্ছে...' : 'Searching...') : (isBn ? 'অনুসন্ধান করুন' : 'Search')}
                </Button>
              </div>

              {/* Facets */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-border/60">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    {isBn ? 'প্রমাণের মাত্রা (Evidence Level)' : 'Evidence Level'}
                  </label>
                  <select aria-label={isBn ? 'প্রমাণের মাত্রা (Evidence Level)' : 'Evidence Level'}
                    className="w-full text-xs p-2 rounded-md border border-border bg-background text-foreground"
                    value={evidenceLevel}
                    onChange={(e) => setEvidenceLevel(e.target.value)}
                  >
                    <option value="all">{isBn ? 'সকল মাত্রা (All)' : 'All Levels'}</option>
                    <option value="Ia">Grade Ia (Meta-Analysis / RCT)</option>
                    <option value="Ib">Grade Ib (Single RCT)</option>
                    <option value="IIa">Grade IIa (Controlled Study)</option>
                    <option value="IIb">Grade IIb (Quasi-experimental)</option>
                    <option value="III">Grade III (Observational)</option>
                    <option value="IV">Grade IV (Expert Committee)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    {isBn ? 'উৎসের ধরন (Source Type)' : 'Source Type'}
                  </label>
                  <select aria-label={isBn ? 'উৎসের ধরন (Source Type)' : 'Source Type'}
                    className="w-full text-xs p-2 rounded-md border border-border bg-background text-foreground"
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value)}
                  >
                    <option value="all">{isBn ? 'সকল ধরন (All)' : 'All Types'}</option>
                    <option value="guideline">{isBn ? 'জাতীয়/আন্তর্জাতিক গাইডলাইন' : 'Guideline'}</option>
                    <option value="textbook">{isBn ? 'মেডিকেল টেক্সটবুক' : 'Textbook'}</option>
                    <option value="journal">{isBn ? 'জার্নাল আর্টিকেল' : 'Journal'}</option>
                    <option value="drug">{isBn ? 'ফার্মাকোলজি মনোগ্রাফ' : 'Drug Monograph'}</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    {isBn ? 'বছর (হতে)' : 'Year From'}
                  </label>
                  <Input
                    type="number"
                    placeholder="2020"
                    value={yearFrom}
                    onChange={(e) => setYearFrom(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    {isBn ? 'বছর (পর্যন্ত)' : 'Year To'}
                  </label>
                  <Input
                    type="number"
                    placeholder="2026"
                    value={yearTo}
                    onChange={(e) => setYearTo(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Results List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{isBn ? `মোট প্রাপ্ত ফলাফল: ${searchResults.length} টি` : `Found ${searchResults.length} excerpts`}</span>
              {selectedChunkIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    {selectedChunkIds.length} {isBn ? 'টি নির্বাচিত' : 'selected'}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7"
                    onClick={() => handleTriggerExport('csv')}
                  >
                    <Download className="w-3 h-3 mr-1" />
                    {isBn ? 'সিএসভি ডাউনলোড' : 'Export Selected'}
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {searchResults.map((res) => {
                const isSelected = selectedChunkIds.includes(res.id);
                return (
                  <Card
                    key={res.id}
                    className={`border transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card'
                    }`}
                  >
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectChunk(res.id)}
                            aria-label={isBn ? `বেছে নিন: ${res.sourceTitle}` : `Select: ${res.sourceTitle}`}
                            className="w-5 h-5 rounded accent-primary"
                          />
                          <Badge variant="outline" className="text-xs font-mono">
                            Grade {res.evidenceLevel}
                          </Badge>
                          <span className="font-semibold text-xs text-foreground">{res.sourceTitle}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {res.sourceType} • {res.sourceYear} • Page {res.page}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                        {res.text}
                      </p>

                      <div className="pl-6 pt-1 flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
                        <span>Chunk ID: {res.id.slice(0, 8)}...</span>
                        <span>•</span>
                        <span>Section: {res.section}</span>
                        <span>•</span>
                        <span>License: {res.sourceLicense}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Research Collections */}
        <TabsContent value="collections" className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {isBn ? 'আমার গবেষণা সংকলনসমূহ' : 'My Research Collections'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isBn ? 'নির্দিষ্ট থিম বা পেপারের জন্য প্রাসঙ্গিক গাইডলাইন ও সাইটেশন সংরক্ষণ করুন' : 'Grouped citation sets and meta-analysis folders'}
              </p>
            </div>

            <Button
              size="sm"
              className="text-xs flex items-center gap-1.5"
              onClick={() => setShowAddCollectionModal(true)}
            >
              <Plus className="w-4 h-4" />
              {isBn ? 'নতুন সংকলন' : 'New Collection'}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {collections.map((col) => (
              <Card key={col.id} className="border border-border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold text-sm text-foreground">{col.title}</h4>
                  <Badge variant="outline" className="text-[10px]">
                    {col.items.length} {isBn ? 'টি আইটেম' : 'items'}
                  </Badge>
                </div>

                {col.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{col.description}</p>
                )}

                {col.items.length > 0 && (
                  <div className="space-y-1.5 border-t border-border/60 pt-2">
                    {col.items.map((item, i) => (
                      <div key={i} className="text-xs p-2 rounded bg-muted/40 flex items-center justify-between">
                        <span className="font-medium text-foreground">{item.title}</span>
                        <span className="text-[10px] text-muted-foreground">Grade {item.evidenceLevel}</span>
                      </div>
                    ))}
                  </div>
                )}

                {col.tags && col.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {col.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[10px]">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab 4: Citation Export Suite */}
        <TabsContent value="export" className="space-y-4 mt-6">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {isBn ? 'সাইটেশন ও গ্রন্থপঞ্জি এক্সপোর্ট' : 'Citation & Bibliography Export'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isBn
                ? 'আন্তর্জাতিক রেফারেন্সিং স্ট্যান্ডার্ডে সাইটেশন ডাউনলোড করুন (EndNote, Zotero, LaTeX, Excel)'
                : 'Download structured citation metadata in standard bibliographic formats'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* CSV Card */}
            <Card className="border border-border bg-card p-5 text-center space-y-3">
              <Table className="w-10 h-10 text-muted-foreground mx-auto" />
              <div>
                <h4 className="font-bold text-sm text-foreground">CSV / Excel Format</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {isBn ? 'স্প্রেডশিট ও ডেটাসেট বিশ্লেষণের জন্য ফাইল' : 'Comma-separated values for tabular analysis'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                disabled={isExporting}
                onClick={() => handleTriggerExport('csv')}
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                {isBn ? 'CSV ডাউনলোড' : 'Export CSV'}
              </Button>
            </Card>

            {/* RIS Card */}
            <Card className="border border-border bg-card p-5 text-center space-y-3">
              <Bookmark className="w-10 h-10 text-muted-foreground mx-auto" />
              <div>
                <h4 className="font-bold text-sm text-foreground">RIS Format (Zotero / EndNote)</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {isBn ? 'রেফারেন্স ম্যানেজারে সরাসরি ইম্পোর্টযোগ্য' : 'Direct import for Zotero, EndNote, Mendeley'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                disabled={isExporting}
                onClick={() => handleTriggerExport('ris')}
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                {isBn ? 'RIS ডাউনলোড' : 'Export RIS'}
              </Button>
            </Card>

            {/* BibTeX Card */}
            <Card className="border border-border bg-card p-5 text-center space-y-3">
              <Quote className="w-10 h-10 text-muted-foreground mx-auto" />
              <div>
                <h4 className="font-bold text-sm text-foreground">BibTeX Format (LaTeX)</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {isBn ? 'LaTeX ও Overleaf পেপারের জন্য ফরম্যাট' : 'Formatted for LaTeX bibliographies'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                disabled={isExporting}
                onClick={() => handleTriggerExport('bibtex')}
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                {isBn ? 'BibTeX ডাউনলোড' : 'Export BibTeX'}
              </Button>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Collection Dialog */}
      <Dialog open={showAddCollectionModal} onOpenChange={setShowAddCollectionModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isBn ? 'নতুন গবেষণা সংকলন' : 'New Research Collection'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {isBn ? 'সংকলনের নাম ও সংক্ষিপ্ত বিবরণ দিন।' : 'Name and describe your collection.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCollection} className="space-y-3 pt-1">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                {isBn ? 'সংকলনের নাম *' : 'Collection Title *'}
              </label>
              <Input
                placeholder={isBn ? 'যেমন: অ্যান্টিমাইক্রোবিয়াল রেজিস্ট্যান্স (AMR)' : 'e.g. Antimicrobial Resistance Protocol'}
                value={newColTitle}
                onChange={(e) => setNewColTitle(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                {isBn ? 'বিবরণ ও উদ্দেশ্য' : 'Description'}
              </label>
              <textarea
                rows={3}
                className="w-full text-xs p-2.5 rounded-md border border-border bg-background text-foreground"
                placeholder={isBn ? 'এই সংকলনের উদ্দেশ্য...' : 'Collection focus...'}
                value={newColDesc}
                onChange={(e) => setNewColDesc(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAddCollectionModal(false)}>
                {isBn ? 'বাতিল' : 'Cancel'}
              </Button>
              <Button type="submit" size="sm">
                {isBn ? 'তৈরি করুন' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      </div>
    </AppShell>
  );
}
