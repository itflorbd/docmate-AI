import { safeFetchUrl } from '../ssrf-guard';
import { HtmlExtractor } from '../extractors/html-extractor';
import { PdfExtractor } from '../extractors/pdf-extractor';
import { ExtractedDocument } from '../extractors';

export interface ResolvedLinkResult {
  title: string;
  authors: string[];
  year: number;
  journal?: string;
  doi?: string;
  pmid?: string;
  canonicalUrl: string;
  abstract?: string;
  fullText: string;
  isAbstractOnly: boolean;
  document: ExtractedDocument;
}

export class LinkAndDoiConnector {
  private htmlExtractor = new HtmlExtractor();
  private pdfExtractor = new PdfExtractor();

  // Resolve Crossref DOI metadata
  async resolveDoi(doi: string): Promise<Partial<ResolvedLinkResult>> {
    const cleanDoi = doi.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
    const crossrefUrl = `https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`;

    try {
      const { buffer } = await safeFetchUrl(crossrefUrl);
      const json = JSON.parse(buffer.toString('utf-8'));
      const item = json.message || {};

      const title = Array.isArray(item.title) ? item.title[0] : item.title || cleanDoi;
      const authors = Array.isArray(item.author)
        ? item.author.map((a: { given?: string; family?: string }) => [a.given, a.family].filter(Boolean).join(' ')).filter(Boolean)
        : [];
      const published = item.published || item['published-print'] || item['published-online'];
      const year = published?.['date-parts']?.[0]?.[0] || new Date().getFullYear();
      const journal = Array.isArray(item['container-title']) ? item['container-title'][0] : item['container-title'];

      return {
        title,
        authors,
        year,
        journal,
        doi: cleanDoi,
        canonicalUrl: item.resource?.primary?.URL || `https://doi.org/${cleanDoi}`,
        abstract: item.abstract ? item.abstract.replace(/<[^>]+>/g, '').trim() : undefined,
      };
    } catch {
      return {
        title: `DOI: ${cleanDoi}`,
        doi: cleanDoi,
        canonicalUrl: `https://doi.org/${cleanDoi}`,
        year: new Date().getFullYear(),
      };
    }
  }

  // Resolve PubMed PMID
  async resolvePmid(pmid: string): Promise<Partial<ResolvedLinkResult>> {
    const cleanPmid = pmid.trim().replace(/^pmid:?/i, '');
    const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${encodeURIComponent(cleanPmid)}&retmode=json`;

    try {
      const { buffer } = await safeFetchUrl(url);
      const json = JSON.parse(buffer.toString('utf-8'));
      const doc = json.result?.[cleanPmid] || {};

      const title = doc.title ? doc.title.replace(/\.$/, '') : `PMID ${cleanPmid}`;
      const authors = Array.isArray(doc.authors) ? doc.authors.map((a: { name?: string }) => a.name).filter(Boolean) : [];
      const pubdate = doc.pubdate || '';
      const match = pubdate.match(/\b(19\d\d|20\d\d)\b/);
      const year = match ? parseInt(match[1], 10) : new Date().getFullYear();
      const journal = doc.source || doc.fulljournalname;

      let doi = '';
      if (Array.isArray(doc.articleids)) {
        const dObj = doc.articleids.find((id: { idtype?: string; value?: string }) => id.idtype === 'doi');
        if (dObj) doi = dObj.value || '';
      }

      return {
        title,
        authors,
        year,
        journal,
        doi: doi || undefined,
        pmid: cleanPmid,
        canonicalUrl: `https://pubmed.ncbi.nlm.nih.gov/${cleanPmid}/`,
      };
    } catch {
      return {
        title: `PMID: ${cleanPmid}`,
        pmid: cleanPmid,
        canonicalUrl: `https://pubmed.ncbi.nlm.nih.gov/${cleanPmid}/`,
        year: new Date().getFullYear(),
      };
    }
  }

  // Resolve open access full text or web article URL
  async fetchAndExtractUrl(urlString: string): Promise<ResolvedLinkResult> {
    const { buffer, contentType, finalUrl } = await safeFetchUrl(urlString);

    if (contentType.toLowerCase().includes('application/pdf') || finalUrl.toLowerCase().endsWith('.pdf')) {
      const doc = await this.pdfExtractor.extract(buffer, 'downloaded.pdf');
      return {
        title: doc.title,
        authors: doc.authors,
        year: doc.year,
        canonicalUrl: finalUrl,
        fullText: doc.fullText,
        isAbstractOnly: false,
        document: doc,
      };
    }

    const doc = await this.htmlExtractor.extract(buffer, 'article.html');
    return {
      title: doc.title,
      authors: doc.authors,
      year: doc.year,
      canonicalUrl: finalUrl,
      fullText: doc.fullText,
      isAbstractOnly: false,
      document: doc,
    };
  }
}

export const linkAndDoiConnector = new LinkAndDoiConnector();
