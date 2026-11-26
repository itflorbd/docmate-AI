import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineFormat(s: string): string {
  // Extract inline code spans first so bold/italic/links don't touch inside them
  const codeSpans: string[] = [];
  let text = s.replace(/`([^`]+)`/g, (_, code) => {
    const idx = codeSpans.length;
    codeSpans.push(`<code>${escapeHtml(code)}</code>`);
    return `\u0000CODE${idx}\u0000`;
  });

  text = escapeHtml(text)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2">$2</a>');

  return text.replace(/\u0000CODE(\d+)\u0000/g, (_, idx) => codeSpans[Number(idx)] || '');
}

function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  let html = '';
  let inCode = false;
  let codeBuf: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let inList = false;
  let inQuote = false;

  const flushTable = () => {
    if (!inTable || tableRows.length === 0) return;
    const header = tableRows[0];
    const body = tableRows.slice(2);
    html += '<table><thead><tr>' + header.map((c) => `<th>${inlineFormat(c)}</th>`).join('') + '</tr></thead><tbody>';
    for (const r of body) {
      html += '<tr>' + r.map((c) => `<td>${inlineFormat(c)}</td>`).join('') + '</tr>';
    }
    html += '</tbody></table>';
    inTable = false;
    tableRows = [];
  };

  const closeList = () => {
    if (inList) {
      html += '</ul>';
      inList = false;
    }
  };

  const closeQuote = () => {
    if (inQuote) {
      html += '</blockquote>';
      inQuote = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.startsWith('```')) {
      flushTable();
      closeList();
      closeQuote();
      if (inCode) {
        html += `<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`;
        codeBuf = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }

    if (line.startsWith('|')) {
      closeList();
      closeQuote();
      inTable = true;
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      tableRows.push(cells);
      continue;
    } else {
      flushTable();
    }

    if (line.startsWith('> ')) {
      closeList();
      if (!inQuote) {
        html += '<blockquote>';
        inQuote = true;
      }
      html += `<p>${inlineFormat(line.slice(2))}</p>`;
      continue;
    } else {
      closeQuote();
    }

    if (line === '---') {
      closeList();
      html += '<hr />';
    } else if (line.startsWith('# ')) {
      closeList();
      html += `<h1>${inlineFormat(line.slice(2))}</h1>`;
    } else if (line.startsWith('## ')) {
      closeList();
      html += `<h2>${inlineFormat(line.slice(3))}</h2>`;
    } else if (line.startsWith('### ')) {
      closeList();
      html += `<h3>${inlineFormat(line.slice(4))}</h3>`;
    } else if (/^\s*[-*] /.test(line) || /^\s*\d+\. /.test(line)) {
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      const isNested = /^\s{2,}/.test(line);
      const content = line.replace(/^\s*([-*]|\d+\.) /, '');
      html += `<li${isNested ? ' class="nested"' : ''}>${inlineFormat(content)}</li>`;
    } else if (line.trim() === '') {
      closeList();
    } else {
      closeList();
      html += `<p>${inlineFormat(line.replace(/  $/, ''))}</p>`;
    }
  }

  flushTable();
  closeList();
  closeQuote();
  return html;
}

async function main() {
  const inputPath = path.resolve(process.cwd(), 'docs/PROJECT_DOCUMENTATION.md');
  const outputPath = path.resolve(process.cwd(), 'docs/DocMate_AI_Project_Documentation.pdf');
  const md = fs.readFileSync(inputPath, 'utf8');
  const bodyHtml = markdownToHtml(md);

  const fullHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 18mm 15mm; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, 'Noto Sans Bengali', Roboto, sans-serif;
    color: #0f172a;
    font-size: 10pt;
    line-height: 1.55;
  }
  h1 {
    font-size: 19pt;
    color: #0f4c5c;
    border-bottom: 2px solid #0e7490;
    padding-bottom: 8px;
    margin: 0 0 12px 0;
  }
  h2 {
    font-size: 13pt;
    color: #0e7490;
    margin: 18px 0 8px 0;
    padding-bottom: 4px;
    border-bottom: 1px solid #e2e8f0;
    page-break-after: avoid;
  }
  h3 {
    font-size: 10.8pt;
    color: #1e293b;
    margin: 12px 0 5px 0;
    page-break-after: avoid;
  }
  p { margin: 5px 0; }
  ul { margin: 5px 0 9px 0; padding-left: 18px; }
  li { margin: 3px 0; }
  li.nested { margin-left: 14px; list-style-type: circle; }
  blockquote {
    background: #fffbeb;
    border-left: 4px solid #d97706;
    padding: 9px 13px;
    margin: 10px 0;
    border-radius: 4px;
    font-size: 9.5pt;
  }
  blockquote p { margin: 2px 0; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0 14px 0;
    font-size: 9pt;
    page-break-inside: avoid;
  }
  th {
    background: #f1f5f9;
    color: #0f172a;
    text-align: left;
    padding: 6px 8px;
    border: 1px solid #cbd5e1;
    font-weight: 600;
  }
  td {
    padding: 6px 8px;
    border: 1px solid #e2e8f0;
    vertical-align: top;
  }
  code {
    background: #f1f5f9;
    padding: 1px 4px;
    border-radius: 3px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 8.5pt;
    color: #0f4c5c;
  }
  pre {
    background: #0f172a;
    color: #e2e8f0;
    padding: 10px 12px;
    border-radius: 6px;
    font-size: 8.2pt;
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;
    page-break-inside: avoid;
  }
  pre code { background: transparent; color: inherit; padding: 0; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 12px 0; }
  a { color: #0284c7; text-decoration: none; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(fullHtml, { waitUntil: 'load' });
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate:
      '<div style="font-size:8px;color:#64748b;width:100%;text-align:right;padding-right:15mm;">DocMate AI — Hack the Vibe 2026 Project Documentation</div>',
    footerTemplate:
      '<div style="font-size:8px;color:#64748b;width:100%;text-align:center;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
    margin: { top: '20mm', bottom: '18mm', left: '15mm', right: '15mm' },
  });
  await browser.close();
  console.log('Regenerated PDF:', outputPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
