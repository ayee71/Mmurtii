import React from 'react';

interface HighlightTextProps {
  text: string;
  query: string;
  className?: string;
  enabled?: boolean;
}

export const HighlightText: React.FC<HighlightTextProps> = ({ text, query, className, enabled = true }) => {
  if (!text) return null;
  if (!enabled || !query || !query.trim()) {
    return <span className={className}>{text}</span>;
  }

  // Extract search tokens (split by whitespace, remove surrounding punctuation, min length 2 or digits)
  const tokens = query
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/^[^\w\u1200-\u137F]+|[^\w\u1200-\u137F]+$/g, ''))
    .filter((t) => t.length >= 2 || /^\d+$/.test(t));

  if (tokens.length === 0) {
    return <span className={className}>{text}</span>;
  }

  // Sort tokens by descending length to match longer phrases first
  const sortedTokens = [...new Set(tokens)].sort((a, b) => b.length - a.length);
  const pattern = sortedTokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(${pattern})`, 'gi');
  const parts = text.split(regex);

  const tokenSet = new Set(tokens.map((t) => t.toLowerCase()));

  return (
    <span className={className}>
      {parts.map((part, i) =>
        tokenSet.has(part.toLowerCase()) ? (
          <mark
            key={i}
            className="bg-amber-400 text-slate-950 font-black px-1 py-0.5 rounded shadow-xs mx-0.5 inline-block"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
};

export default HighlightText;
