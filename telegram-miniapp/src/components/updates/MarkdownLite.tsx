'use client';

import type { ReactNode } from 'react';
import { PlatformBridge } from '@/lib/platform';

/**
 * Render de markdown mínimo y seguro (sin HTML crudo).
 * Soporta: títulos, listas, citas, separadores, negritas, código y enlaces.
 * Es lo que usa el Update Log para mostrar el contenido inyectado desde local.
 */

function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${i++}`;

    if (token.startsWith('**')) {
      nodes.push(
        <strong key={key} style={{ fontWeight: 900 }}>
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith('`')) {
      nodes.push(
        <code
          key={key}
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: '0.88em',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 6,
            padding: '1px 5px',
          }}
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        const [, label, href] = link;
        nodes.push(
          <a
            key={key}
            href={href}
            onClick={(e) => {
              e.preventDefault();
              void PlatformBridge.openExternalUrl(href);
            }}
            style={{ color: '#FF8FB8', fontWeight: 800, textDecoration: 'underline' }}
          >
            {label}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    }
    last = match.index + token.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function MarkdownLite({ markdown }: { markdown: string }) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(' ');
    blocks.push(
      <p
        key={`p-${blocks.length}`}
        style={{ margin: '0 0 14px', fontSize: 15, lineHeight: 1.65, color: 'rgba(255,255,255,0.78)' }}
      >
        {inline(text, `p-${blocks.length}`)}
      </p>,
    );
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? 'ol' : 'ul';
    blocks.push(
      <Tag
        key={`l-${blocks.length}`}
        style={{
          margin: '0 0 14px',
          paddingLeft: 22,
          fontSize: 15,
          lineHeight: 1.7,
          color: 'rgba(255,255,255,0.78)',
        }}
      >
        {list.items.map((item, idx) => (
          <li key={idx} style={{ marginBottom: 6 }}>
            {inline(item, `l-${blocks.length}-${idx}`)}
          </li>
        ))}
      </Tag>,
    );
    list = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      const text = heading[2];
      const size = level === 1 ? 22 : level === 2 ? 18 : 16;
      blocks.push(
        <p
          key={`h-${blocks.length}`}
          style={{
            margin: blocks.length === 0 ? '0 0 12px' : '22px 0 10px',
            fontSize: size,
            fontWeight: 900,
            letterSpacing: '-0.2px',
            color: '#fff',
          }}
        >
          {inline(text, `h-${blocks.length}`)}
        </p>,
      );
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      flushParagraph();
      flushList();
      blocks.push(
        <hr
          key={`hr-${blocks.length}`}
          style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.10)', margin: '20px 0' }}
        />,
      );
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(bullet[1]);
      continue;
    }

    const ordered = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ordered) {
      flushParagraph();
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(ordered[1]);
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      flushList();
      blocks.push(
        <blockquote
          key={`q-${blocks.length}`}
          style={{
            margin: '0 0 14px',
            padding: '10px 14px',
            borderLeft: '3px solid rgba(233,30,99,0.6)',
            background: 'rgba(233,30,99,0.08)',
            borderRadius: 10,
            fontSize: 14.5,
            lineHeight: 1.6,
            color: 'rgba(255,255,255,0.8)',
          }}
        >
          {inline(quote[1], `q-${blocks.length}`)}
        </blockquote>,
      );
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();

  return <div>{blocks}</div>;
}
