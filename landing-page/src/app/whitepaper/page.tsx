import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default async function WhitepaperPage() {
  const tokenomicsPath = path.join(process.cwd(), '../DOCS/TOKENOMICS-PUBLIC.md');
  const businessPlanPath = path.join(process.cwd(), '../DOCS/WHITEPAPER-PUBLIC.md');
  
  let tokenomicsContent = '';
  let businessPlanContent = '';

  try {
    tokenomicsContent = fs.readFileSync(tokenomicsPath, 'utf8');
    businessPlanContent = fs.readFileSync(businessPlanPath, 'utf8');
  } catch (err) {
    console.error('Error reading markdown files:', err);
    tokenomicsContent = '# Error loading content';
  }

  return (
    <div className="min-h-screen bg-[#05050A] text-white">
      {/* Header */}
      <header className="sticky top-0 w-full z-50 bg-[#05050A]/80 backdrop-blur-xl border-b border-white/10 py-4 px-6 md:px-12 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/" className="hover:text-primary transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <div className="flex items-center gap-3">
            <img src="/icon_ra.png" alt="Rabbitty" className="w-8 h-8 object-contain drop-shadow-[0_0_15px_rgba(233,30,99,0.5)]" />
            <span className="font-black text-lg tracking-tight hidden sm:block">RABBITTY<span className="text-gradient">.me</span> Docs</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <article className="prose prose-invert prose-pink max-w-none prose-headings:font-black prose-h1:text-4xl prose-h1:text-white prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {businessPlanContent}
          </ReactMarkdown>
          
          <hr className="my-16 border-white/10" />
          
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {tokenomicsContent}
          </ReactMarkdown>
        </article>
      </main>

      <footer className="border-t border-white/10 py-12 px-6 mt-12 text-center">
        <span className="font-bold text-white/50">© 2026 Rabbitty Corp.</span>
      </footer>
    </div>
  );
}
