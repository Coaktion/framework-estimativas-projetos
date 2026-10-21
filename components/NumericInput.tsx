'use client';

import { forwardRef, useEffect, useState } from 'react';

/**
 * Campo numérico com regras de digitação.
 *
 *  - `integer`: só inteiros positivos (quantidades). Não aceita 0 nem decimais.
 *  - `decimal`: até 2 casas decimais, nunca negativo. Com `allowZero`, aceita 0
 *    (percentuais); sem ele, só valores maiores que zero (horas manuais).
 *
 * É um `type="text"` de propósito: o `type="number"` do navegador devolve ""
 * enquanto se digita "1," ou "1.", e o valor parcial se perdia ("1.5" virava 5).
 * Aceita vírgula ou ponto como separador decimal.
 *
 * `onValueChange` recebe o número já validado em texto canônico ("1.25"), ou ""
 * quando o campo está vazio ou o valor não é permitido (ex.: 0 sem `allowZero`).
 */
export interface NumericInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: string | number | null | undefined;
  onValueChange: (value: string) => void;
  mode: 'integer' | 'decimal';
  allowZero?: boolean;
}

const INTEGER_PATTERN = /^\d*$/;
const DECIMAL_PATTERN = /^\d*([.,]\d{0,2})?$/;

function canonical(text: string, mode: 'integer' | 'decimal', allowZero: boolean): string {
  const normalized = text.replace(',', '.');
  if (!normalized || normalized === '.') return '';
  const n = mode === 'integer' ? parseInt(normalized, 10) : parseFloat(normalized);
  if (!Number.isFinite(n) || n < 0) return '';
  if (n === 0 && !allowZero) return '';
  return mode === 'integer' ? String(n) : String(Math.round(n * 100) / 100);
}

function display(value: NumericInputProps['value']): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return text === 'NaN' ? '' : text;
}

const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(function NumericInput(
  { value, onValueChange, mode, allowZero = false, onBlur, onFocus, ...rest },
  ref,
) {
  const [draft, setDraft] = useState<string>(() => display(value));
  const [focused, setFocused] = useState(false);

  // Fora de foco, o campo acompanha o valor externo (ex.: atalhos que
  // preenchem quantidades, ou o "zerar" ao ocultar um item).
  useEffect(() => {
    if (!focused) setDraft(display(value));
  }, [value, focused]);

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode={mode === 'integer' ? 'numeric' : 'decimal'}
      autoComplete="off"
      value={draft}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onChange={(e) => {
        const next = e.target.value.trim();
        const pattern = mode === 'integer' ? INTEGER_PATTERN : DECIMAL_PATTERN;
        // Rejeita a tecla (mantém o texto anterior) quando sai do formato:
        // sinal de menos, letras, terceira casa decimal, decimal em quantidade.
        if (!pattern.test(next)) return;
        // Quantidade não começa com zero ("0", "05"): zero não é quantidade.
        if (mode === 'integer' && /^0/.test(next)) return;
        setDraft(next);
        onValueChange(canonical(next, mode, allowZero));
      }}
      onBlur={(e) => {
        // Ao sair, o efeito acima volta a mostrar o valor que realmente valeu
        // (ex.: "0" sem permissão some, "1," vira "1").
        setFocused(false);
        onBlur?.(e);
      }}
    />
  );
});

export default NumericInput;
