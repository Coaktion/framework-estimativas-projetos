'use client';

import { forwardRef } from 'react';
import { cellText, formatNumber, grandTotalText, type ExportDocument } from '@/lib/project-export';

/**
 * Prévia fora da tela, fotografada pela exportação em PNG. Montada só durante
 * a exportação, com estilos inline para sair igual em qualquer tema.
 */
const ExportPreview = forwardRef<HTMLDivElement, { doc: ExportDocument }>(function ExportPreview({ doc }, ref) {
  return (
    <div aria-hidden style={{ position: 'fixed', left: -10000, top: 0, pointerEvents: 'none' }}>
      <div
        ref={ref}
        style={{ width: 1100, padding: 32, background: '#ffffff', color: '#0b1f0a', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 12 }}
      >
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>{doc.title}</div>
        {doc.meta.map((m) => (
          <div key={m.label} style={{ color: '#475569', marginBottom: 2 }}>{m.label}: {m.value}</div>
        ))}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
          <thead>
            <tr style={{ background: '#2f7a2a', color: '#ffffff' }}>
              {doc.columns.map((c) => (
                <th key={c.key} style={{ padding: '6px 8px', textAlign: c.numeric ? 'right' : 'left', fontWeight: 700 }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {doc.rows.map((row, i) => (
              <tr key={i} style={{ background: i % 2 ? '#f8fafc' : '#ffffff' }}>
                {doc.columns.map((c) => (
                  <td key={c.key} style={{ padding: '4px 8px', textAlign: c.numeric ? 'right' : 'left' }}>{cellText(doc, c, row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {doc.details && doc.details.items.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 20 }}>
            <thead>
              <tr style={{ background: '#2f7a2a', color: '#ffffff' }}>
                <th colSpan={2} style={{ padding: '6px 8px', textAlign: 'left' }}>{doc.details.title}</th>
              </tr>
            </thead>
            <tbody>
              {doc.details.items.map((d, i) => (
                <tr key={i} style={{ background: i % 2 ? '#f8fafc' : '#ffffff', verticalAlign: 'top' }}>
                  <td style={{ padding: '4px 8px', fontWeight: 700, width: 260 }}>{d.label}</td>
                  <td style={{ padding: '4px 8px', whiteSpace: 'pre-wrap' }}>{d.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <table style={{ borderCollapse: 'collapse', marginTop: 20, minWidth: 420 }}>
          <thead>
            <tr style={{ background: '#2f7a2a', color: '#ffffff' }}>
              <th style={{ padding: '6px 8px', textAlign: 'left' }}>{doc.summaryTitle}</th>
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>{doc.hoursUnit}</th>
            </tr>
          </thead>
          <tbody>
            {doc.summary.map((s, i) => (
              <tr key={i}>
                <td style={{ padding: '3px 8px', paddingLeft: s.level ? 24 : 8, fontWeight: s.level ? 400 : 700 }}>{s.label}</td>
                <td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: s.level ? 400 : 700 }}>
                  {s.hours === null ? s.note : formatNumber(s.hours, doc.locale, 1)}
                </td>
              </tr>
            ))}
            <tr style={{ borderTop: '2px solid #2f7a2a' }}>
              <td style={{ padding: '6px 8px', fontWeight: 700 }}>{doc.grandTotalLabel}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{grandTotalText(doc)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default ExportPreview;
