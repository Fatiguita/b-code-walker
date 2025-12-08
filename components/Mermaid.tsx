import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidProps {
  chart: string;
}

export const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');

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
        try {
          const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
          const { svg } = await mermaid.render(id, chart);
          setSvg(svg);
        } catch (error) {
          console.error('Mermaid render error:', error);
          setSvg('<div class="text-red-400 p-2 text-xs">Failed to render diagram</div>');
        }
      }
    };
    renderChart();
  }, [chart]);

  return (
    <div 
      ref={ref} 
      className="mermaid-container w-full flex justify-center p-4 bg-[var(--bg-primary)] rounded-lg overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }} 
    />
  );
};
