'use client';

import { Suspense } from 'react';
import ChatWorkbook from '../components/ChatWorkbook';

export default function WorkbookPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">Loading...</div>
      </div>
    }>
      <ChatWorkbook />
    </Suspense>
  );
}

