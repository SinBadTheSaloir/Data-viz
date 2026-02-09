import { useRef, useCallback } from 'react';

/**
 * ChartWrapper — wraps a chart section and provides PNG export.
 *
 * Props:
 *   - title: chart title (used as filename)
 *   - children: chart content
 */
export default function ChartWrapper({ title, children }) {
  const ref = useRef(null);

  const exportPNG = useCallback(async () => {
    if (!ref.current) return;
    try {
      const { default: html2canvas } = await import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm');
      const canvas = await html2canvas(ref.current, {
        backgroundColor: '#0f0f13',
        scale: 2,
      });
      const link = document.createElement('a');
      const safeName = (title || 'chart').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.download = `${safeName}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      // Fallback: use SVG serialization for Recharts
      const svgEl = ref.current.querySelector('svg');
      if (!svgEl) {
        console.error('No SVG found for export');
        return;
      }
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        canvas.width = img.width * 2;
        canvas.height = img.height * 2;
        ctx.fillStyle = '#0f0f13';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        const link = document.createElement('a');
        const safeName = (title || 'chart').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        link.download = `${safeName}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      };
      img.src = url;
    }
  }, [title]);

  return (
    <div className="relative group">
      <div ref={ref}>
        {children}
      </div>
      <button
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity
                   text-xs text-text-muted hover:text-text-primary bg-bg-card border border-border
                   rounded px-2 py-1 cursor-pointer"
        onClick={exportPNG}
        title="Export as PNG"
      >
        PNG
      </button>
    </div>
  );
}

/**
 * Export data as a CSV file download.
 */
export function exportCSV(data, filename = 'export.csv') {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((h) => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') return JSON.stringify(val);
      const str = String(val);
      // Escape quotes and wrap in quotes if needed
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  );

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
