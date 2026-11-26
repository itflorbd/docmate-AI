'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError] Root layout error caught:', error);
  }, [error]);

  return (
    <html lang="bn">
      <head>
        <title>DocMate AI - Clinical System</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style dangerouslySetInnerHTML={{ __html: `
          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: #f8fafc;
            color: #0f172a;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
          }
          .card {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 32px;
            max-width: 440px;
            width: 90%;
            text-align: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          }
          .icon {
            width: 48px;
            height: 48px;
            margin: 0 auto 16px;
            border-radius: 50%;
            background: #fef3c7;
            color: #d97706;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: bold;
          }
          h1 {
            font-size: 18px;
            margin: 0 0 8px;
            color: #0f172a;
            font-weight: 600;
          }
          p {
            font-size: 13px;
            color: #64748b;
            margin: 0 0 24px;
            line-height: 1.5;
          }
          .btn-group {
            display: flex;
            gap: 12px;
            justify-content: center;
          }
          .btn-primary {
            background-color: #0d9488;
            color: #ffffff;
            border: none;
            padding: 8px 18px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
          }
          .btn-primary:hover {
            background-color: #0f766e;
          }
          .btn-secondary {
            background-color: #f1f5f9;
            color: #334155;
            border: 1px solid #cbd5e1;
            padding: 8px 18px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
          }
          .btn-secondary:hover {
            background-color: #e2e8f0;
          }
        ` }} />
      </head>
      <body>
        <div className="card">
          <div className="icon">!</div>
          <h1>পৃষ্ঠাটি লোড হতে সমস্যা হয়েছে / Unable to load page</h1>
          <p>
            একটি অপ্রত্যাশিত ত্রুটি ঘটেছে। দয়া করে পৃষ্ঠাটি পুনরায় লোড করুন অথবা ড্যাশবোর্ডে ফিরে যান।
            <br />
            An unexpected error occurred. Please reload the page or return to the dashboard.
          </p>
          <div className="btn-group">
            <button type="button" className="btn-primary" onClick={() => reset()}>
              পুনরায় চেষ্টা করুন (Reload)
            </button>
            <Link href="/bn/dashboard" className="btn-secondary">
              হোমে ফিরুন (Home)
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
