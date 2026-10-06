'use client';

/**
 * Renderiza no <body>. Necessário para modal, gaveta e avisos: o layout do
 * módulo usa transform (a largura "estourada", igual ao ZD Auto Config), e um
 * ancestral com transform vira referência de `position: fixed` — sem portal,
 * o overlay ficaria preso dentro da área do módulo em vez de cobrir a tela.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Portal({ children }: { children: ReactNode }) {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  return montado ? createPortal(children, document.body) : null;
}
