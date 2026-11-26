// Writes clearly labelled SYNTHETIC guideline PDFs for the guideline-conflict
// browser test. They are invented for testing and are not clinical guidance.
// usage: node e2e/fixtures/make-guideline-pdfs.mjs [outDir]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const out = process.argv[2] ?? path.join('output', 'pdf');
fs.mkdirSync(out, { recursive: true });

const docs = [
  {
    file: 'Synthetic_Guideline_A_Diabetes_2025.pdf',
    title: 'SYNTHETIC TEST Guideline A - Type 2 Diabetes Initial Therapy (2025)',
    body: [
      'SYNTHETIC TEST DOCUMENT. Invented for DocMate software testing. Not clinical guidance.',
      'Publisher: DocMate Test Fixtures. Publication year 2025. Version 1.',
      'Section 2: Initial drug therapy',
      'For adult outpatients with type 2 diabetes mellitus, Metformin is the recommended first-line therapy at diagnosis.',
      'Review glycaemic control after three months of therapy.',
    ],
  },
  {
    file: 'Synthetic_Guideline_B_Diabetes_2026.pdf',
    title: 'SYNTHETIC TEST Guideline B - Type 2 Diabetes Lifestyle First (2026)',
    body: [
      'SYNTHETIC TEST DOCUMENT. Invented for DocMate software testing. Not clinical guidance.',
      'Publisher: DocMate Test Fixtures (second panel). Publication year 2026. Version 2.',
      'Part 4: Starting treatment',
      'For adult outpatients with type 2 diabetes mellitus, Metformin should not be started at diagnosis; begin with a three-month structured lifestyle programme.',
      'Record weight and waist circumference at every visit.',
    ],
  },
  {
    file: 'Synthetic_Guideline_C_Paediatric_Diabetes_2026.pdf',
    title: 'SYNTHETIC TEST Guideline C - Paediatric Type 2 Diabetes (2026)',
    body: [
      'SYNTHETIC TEST DOCUMENT. Invented for DocMate software testing. Not clinical guidance.',
      'Publisher: DocMate Test Fixtures (paediatric panel). Publication year 2026. Version 1.',
      'Chapter 3: Children and adolescents',
      'In children with type 2 diabetes mellitus, Metformin should not be used without specialist paediatric review.',
      'Growth and pubertal stage are recorded at each review.',
    ],
  },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const doc of docs) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${doc.title}</title>
  <style>body{font-family:Helvetica,Arial,sans-serif;margin:48px;font-size:13px;line-height:1.5}h1{font-size:18px}.banner{border:2px solid #b45309;padding:8px;margin-bottom:16px;font-weight:bold}</style></head>
  <body><div class="banner">SYNTHETIC TEST DOCUMENT - NOT CLINICAL GUIDANCE</div><h1>${doc.title}</h1>${doc.body.map((line) => `<p>${line}</p>`).join('')}</body></html>`;
  await page.setContent(html);
  await page.pdf({ path: path.join(out, doc.file), format: 'A4' });
  console.log('wrote', path.join(out, doc.file));
}
await browser.close();
