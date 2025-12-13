import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidProps {
  chart: string;
}

// Robust parser to handle nested brackets/parens/braces in Mermaid labels
// e.g. Node[Array[String]] -> Node["Array[String]"]
const sanitizeMermaid = (code: string) => {
  if (!code) return '';
  
  // 1. Initial cleanup: Remove markdown wrappers
  let cleaned = code
    .replace(/```mermaid/gi, '')
    .replace(/```/g, '')
    .trim();

  // 1.5. Fix unquoted edge labels containing parentheses (Common AI artifact)
  // e.g. A -- Failure ("Error") --> B
  // This confuses the parser if not quoted.
  // Regex matches: (start_arrow) (content) (end_arrow)
  cleaned = cleaned.replace(
    /(\s-{2}|-{2}\.|={2})\s+([^\n]+?)\s+(-{2}>|-{2}-|\.-{2}>|={2}>)/g,
    (match, prefix, label, suffix) => {
       const trimmed = label.trim();
       // If already quoted, ignore
       if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || 
           (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
           return match;
       }
       // Only quote if problematic chars exist
       if (!/[()\[\]{}"']/.test(trimmed)) {
           return match;
       }
       
       // Quote it and escape inner quotes
       const safeLabel = trimmed.replace(/"/g, "'");
       return `${prefix} "${safeLabel}" ${suffix}`;
    }
  );

  // 2. State Machine Parser
  // We reconstruct the string to enforce quoting on node labels
  let result = '';
  let i = 0;

  while (i < cleaned.length) {
    const char = cleaned[i];

    // --- NEW: Handle Strings (Edge labels, quoted node content, titles) ---
    // If we encounter a quote, we must consume the entire string immediately 
    // to prevent the node parser from detecting brackets/parens inside it.
    if (char === '"' || char === "'") {
       const quoteChar = char;
       result += char;
       i++;
       
       while (i < cleaned.length) {
         const c = cleaned[i];
         result += c;
         
         if (c === '\\') {
             // Handle escape sequences (e.g. \", \\) by consuming the next char
             i++;
             if (i < cleaned.length) {
                 result += cleaned[i];
             }
         } else if (c === quoteChar) {
             // End of quote found
             i++;
             break;
         }
         i++;
       }
       continue;
    }
    
    // --- Existing Node Parsing Logic ---
    // Detect start of a node label block
    // Order matters: check multi-char tokens first
    let openToken = '';
    let closeToken = '';

    if (cleaned.startsWith('((', i)) { openToken = '(('; closeToken = '))'; }
    else if (cleaned.startsWith('[(', i)) { openToken = '[('; closeToken = ')]'; }
    else if (cleaned.startsWith('[[', i)) { openToken = '[['; closeToken = ']]'; }
    else if (cleaned.startsWith('{{', i)) { openToken = '{{'; closeToken = '}}'; }
    else if (char === '[') { openToken = '['; closeToken = ']'; }
    else if (char === '(') { openToken = '('; closeToken = ')'; }
    else if (char === '{') { openToken = '{'; closeToken = '}'; }

    if (openToken) {
      const startContentIdx = i + openToken.length;
      let depth = 1;
      let j = startContentIdx;
      let insideQuote = false;
      let quoteChar = '';

      // Scan forward to find matching closeToken
      while (j < cleaned.length) {
        const c = cleaned[j];
        
        // Toggle quote state
        if (c === '"' || c === "'") {
          if (!insideQuote) {
            insideQuote = true;
            quoteChar = c;
          } else if (c === quoteChar && cleaned[j - 1] !== '\\') {
            insideQuote = false;
          }
        }

        if (!insideQuote) {
          if (cleaned.startsWith(closeToken, j)) {
            depth--;
            if (depth === 0) break; // Found the matching close
            j += closeToken.length - 1;
          } else if (cleaned.startsWith(openToken, j)) {
             // Only increment depth if it's the SAME token type
             // e.g. A[ B[C] ] -> depth logic applies
             // e.g. A[ B(C) ] -> inside [], ( ) are just text. 
             depth++;
             j += openToken.length - 1;
          }
        }
        j++;
      }

      if (depth === 0) {
        // We found the end of the block
        const rawContent = cleaned.substring(startContentIdx, j);
        const trimmed = rawContent.trim();
        
        // Check if already quoted (and stripped of potential surrounding whitespace)
        const isQuoted = (trimmed.startsWith('"') && trimmed.endsWith('"')) || 
                         (trimmed.startsWith("'") && trimmed.endsWith("'"));

        let finalContent = rawContent;
        
        if (isQuoted) {
          // It's quoted, but we must ensure inner quotes are escaped/single
          // Strip outer quotes
          let inner = trimmed.substring(1, trimmed.length - 1);
          // Convert internal double quotes to single
          inner = inner.replace(/"/g, "'");
          finalContent = `"${inner}"`;
        } else {
          // Not quoted. Quote it and escape inner double quotes.
          finalContent = `"${rawContent.replace(/"/g, "'")}"`;
        }
        
        result += openToken + finalContent + closeToken;
        i = j + closeToken.length;
        continue;
      } 
    }

    // If no token matched or block wasn't closed properly, just copy char
    result += char;
    i++;
  }

  // 3. Final cleanup: Remove line-ending semicolons which can break rendering
  return result.replace(/;(\s*$|\n)/gm, '\n');
};

export const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'dark',
      securityLevel: 'loose',
      fontFamily: 'Fira Code',
    });
  }, []);

  useEffect(() => {
    const renderChart = async () => {
      if (ref.current && chart) {
        setRenderError(null);
        try {
          const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
          
          // Pre-process chart to fix common syntax issues
          const cleanChart = sanitizeMermaid(chart);

          // Attempt to parse first to catch errors early
          await mermaid.parse(cleanChart);
          const { svg } = await mermaid.render(id, cleanChart);
          setSvg(svg);
        } catch (error: any) {
          console.error('Mermaid render error:', error);
          setRenderError(error.message || "Syntax Error");
        }
      }
    };
    renderChart();
  }, [chart]);

  if (renderError) {
      return (
          <div className="w-full p-4 bg-red-950/30 border border-red-900/50 rounded-lg text-left">
              <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-400 text-xs font-bold">Diagram Error</span>
              </div>
              <p className="text-red-300/60 text-[10px] font-mono mb-3 line-clamp-2">{renderError.split('\n')[0]}</p>
              <details className="group">
                  <summary className="text-[10px] text-gray-500 cursor-pointer hover:text-gray-300 transition-colors list-none flex items-center gap-1">
                      <span className="group-open:rotate-90 transition-transform">▶</span>
                      View Raw Mermaid Source
                  </summary>
                  <pre className="mt-2 text-[10px] font-mono text-gray-400 bg-black/40 p-3 rounded border border-white/5 whitespace-pre-wrap break-all select-all">
                      {chart}
                  </pre>
              </details>
          </div>
      );
  }

  return (
    <div 
      ref={ref} 
      className="mermaid-container w-full flex justify-center p-4 bg-[var(--bg-primary)] rounded-lg overflow-x-auto min-h-[100px]"
      dangerouslySetInnerHTML={{ __html: svg }} 
    />
  );
};