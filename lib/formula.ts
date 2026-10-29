/**
 * Linguagem de fórmulas da Calculadora AE (editável no painel Admin).
 *
 * Interpretador próprio, sem `eval` e sem dependência externa: a fórmula vira
 * uma árvore e é avaliada só com as operações abaixo, então não há como uma
 * fórmula gravada no banco executar código.
 *
 * SINTAXE (convenção do Excel em pt-BR)
 *   números      10   0,5   0.5        (vírgula ou ponto como decimal)
 *   operadores   +  -  *  /  ^         (também ×, ÷ e um "x" isolado)
 *   comparações  >  <  >=  <=  ==  !=  (resultado 1 = verdadeiro, 0 = falso)
 *   parênteses   ( )
 *   funções      min(a; b; ...)  max(a; b; ...)  se(condição; se_verdadeiro; se_falso)
 *                arred(x; casas)  teto(x)  piso(x)  abs(x)
 *                (aliases em inglês: if, round, ceil, floor)
 *   argumentos separados por ";"
 *   variáveis    nomes como agentes, marcas, campos_ticket (ver ae-config.ts)
 */

export type FormulaNode =
  | { type: 'num'; value: number }
  | { type: 'var'; name: string }
  | { type: 'unary'; op: '-' | '+'; arg: FormulaNode }
  | { type: 'binary'; op: string; left: FormulaNode; right: FormulaNode }
  | { type: 'call'; name: string; args: FormulaNode[] };

export class FormulaError extends Error {
  position: number;
  constructor(message: string, position: number) {
    super(message);
    this.name = 'FormulaError';
    this.position = position;
  }
}

type Token =
  | { kind: 'num'; value: number; pos: number }
  | { kind: 'id'; value: string; pos: number }
  | { kind: 'op'; value: string; pos: number }
  | { kind: 'end'; pos: number };

const FUNCTIONS: Record<string, { min: number; max: number }> = {
  min: { min: 1, max: Infinity },
  max: { min: 1, max: Infinity },
  se: { min: 3, max: 3 },
  if: { min: 3, max: 3 },
  arred: { min: 1, max: 2 },
  round: { min: 1, max: 2 },
  teto: { min: 1, max: 1 },
  ceil: { min: 1, max: 1 },
  piso: { min: 1, max: 1 },
  floor: { min: 1, max: 1 },
  abs: { min: 1, max: 1 },
};

export const FORMULA_FUNCTION_NAMES = Object.keys(FUNCTIONS);

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const text = String(source ?? '');
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) { i++; continue; }
    // Número: dígitos, com UM separador decimal (vírgula ou ponto) entre dígitos.
    if (/[0-9]/.test(ch) || ((ch === '.' || ch === ',') && /[0-9]/.test(text[i + 1] || ''))) {
      const start = i;
      let digits = '';
      let seenSep = false;
      while (i < text.length) {
        const c = text[i];
        if (/[0-9]/.test(c)) { digits += c; i++; continue; }
        if ((c === '.' || c === ',') && !seenSep && /[0-9]/.test(text[i + 1] || '')) {
          digits += '.'; seenSep = true; i++; continue;
        }
        break;
      }
      tokens.push({ kind: 'num', value: parseFloat(digits.startsWith('.') ? `0${digits}` : digits), pos: start });
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const start = i;
      let name = '';
      while (i < text.length && /[A-Za-z0-9_]/.test(text[i])) { name += text[i]; i++; }
      // "x" sozinho é multiplicação ("campos_ticket x 0,3"); nenhuma variável se chama x.
      if (name === 'x' || name === 'X') {
        tokens.push({ kind: 'op', value: '*', pos: start });
        continue;
      }
      tokens.push({ kind: 'id', value: name.toLowerCase(), pos: start });
      continue;
    }
    const two = text.slice(i, i + 2);
    if (['>=', '<=', '==', '!='].includes(two)) {
      tokens.push({ kind: 'op', value: two, pos: i });
      i += 2;
      continue;
    }
    if ('+-*/^()<>;×÷'.includes(ch)) {
      const value = ch === '×' ? '*' : ch === '÷' ? '/' : ch;
      tokens.push({ kind: 'op', value, pos: i });
      i++;
      continue;
    }
    if (ch === ',') {
      throw new FormulaError('Use ";" para separar os argumentos de uma função (a vírgula é o separador decimal).', i);
    }
    throw new FormulaError(`Caractere inválido: "${ch}"`, i);
  }
  tokens.push({ kind: 'end', pos: text.length });
  return tokens;
}

export function parseFormula(source: string): FormulaNode {
  if (!String(source ?? '').trim()) throw new FormulaError('A fórmula está vazia.', 0);
  const tokens = tokenize(source);
  let index = 0;
  const peek = () => tokens[index];
  const next = () => tokens[index++];
  const isOp = (value: string) => {
    const tk = peek();
    return tk.kind === 'op' && tk.value === value;
  };
  const expectOp = (value: string) => {
    const tk = next();
    if (tk.kind !== 'op' || tk.value !== value) {
      throw new FormulaError(`Esperava "${value}".`, tk.pos);
    }
  };

  const parseComparison = (): FormulaNode => {
    let left = parseAdditive();
    while (peek().kind === 'op' && ['>', '<', '>=', '<=', '==', '!='].includes((peek() as any).value)) {
      const op = (next() as any).value;
      left = { type: 'binary', op, left, right: parseAdditive() };
    }
    return left;
  };
  const parseAdditive = (): FormulaNode => {
    let left = parseTerm();
    while (isOp('+') || isOp('-')) {
      const op = (next() as any).value;
      left = { type: 'binary', op, left, right: parseTerm() };
    }
    return left;
  };
  const parseTerm = (): FormulaNode => {
    let left = parsePower();
    while (isOp('*') || isOp('/')) {
      const op = (next() as any).value;
      left = { type: 'binary', op, left, right: parsePower() };
    }
    return left;
  };
  const parsePower = (): FormulaNode => {
    const base = parseUnary();
    if (isOp('^')) {
      next();
      return { type: 'binary', op: '^', left: base, right: parsePower() };
    }
    return base;
  };
  const parseUnary = (): FormulaNode => {
    if (isOp('-') || isOp('+')) {
      const op = (next() as any).value as '-' | '+';
      return { type: 'unary', op, arg: parseUnary() };
    }
    return parsePrimary();
  };
  const parsePrimary = (): FormulaNode => {
    const tk = next();
    if (tk.kind === 'num') return { type: 'num', value: tk.value };
    if (tk.kind === 'id') {
      if (isOp('(')) {
        next();
        const spec = FUNCTIONS[tk.value];
        if (!spec) throw new FormulaError(`Função desconhecida: ${tk.value}`, tk.pos);
        const args: FormulaNode[] = [];
        if (!isOp(')')) {
          args.push(parseComparison());
          while (isOp(';')) { next(); args.push(parseComparison()); }
        }
        expectOp(')');
        if (args.length < spec.min || args.length > spec.max) {
          throw new FormulaError(`Número de argumentos inválido em ${tk.value}().`, tk.pos);
        }
        return { type: 'call', name: tk.value, args };
      }
      return { type: 'var', name: tk.value };
    }
    if (tk.kind === 'op' && tk.value === '(') {
      const inner = parseComparison();
      expectOp(')');
      return inner;
    }
    if (tk.kind === 'end') throw new FormulaError('A fórmula terminou antes do esperado.', tk.pos);
    throw new FormulaError(`Símbolo inesperado: "${(tk as any).value}"`, tk.pos);
  };

  const ast = parseComparison();
  const rest = peek();
  if (rest.kind !== 'end') {
    throw new FormulaError(`Símbolo inesperado: "${(rest as any).value}"`, rest.pos);
  }
  return ast;
}

/** Nomes de variável usados pela fórmula. */
export function formulaVariables(node: FormulaNode, out: Set<string> = new Set()): Set<string> {
  switch (node.type) {
    case 'var': out.add(node.name); break;
    case 'unary': formulaVariables(node.arg, out); break;
    case 'binary': formulaVariables(node.left, out); formulaVariables(node.right, out); break;
    case 'call': node.args.forEach((a) => formulaVariables(a, out)); break;
    default: break;
  }
  return out;
}

export function evaluateFormula(node: FormulaNode, vars: Record<string, number>): number {
  switch (node.type) {
    case 'num': return node.value;
    case 'var': {
      const value = vars[node.name];
      return typeof value === 'number' && Number.isFinite(value) ? value : 0;
    }
    case 'unary': {
      const v = evaluateFormula(node.arg, vars);
      return node.op === '-' ? -v : v;
    }
    case 'binary': {
      const a = evaluateFormula(node.left, vars);
      const b = evaluateFormula(node.right, vars);
      switch (node.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return b === 0 ? 0 : a / b;
        case '^': return Math.pow(a, b);
        case '>': return a > b ? 1 : 0;
        case '<': return a < b ? 1 : 0;
        case '>=': return a >= b ? 1 : 0;
        case '<=': return a <= b ? 1 : 0;
        case '==': return a === b ? 1 : 0;
        case '!=': return a !== b ? 1 : 0;
        default: return 0;
      }
    }
    case 'call': {
      const args = node.args;
      switch (node.name) {
        case 'min': return Math.min(...args.map((a) => evaluateFormula(a, vars)));
        case 'max': return Math.max(...args.map((a) => evaluateFormula(a, vars)));
        case 'se':
        case 'if':
          return evaluateFormula(args[0], vars) !== 0
            ? evaluateFormula(args[1], vars)
            : evaluateFormula(args[2], vars);
        case 'arred':
        case 'round': {
          const x = evaluateFormula(args[0], vars);
          const d = args[1] ? Math.max(0, Math.min(10, Math.round(evaluateFormula(args[1], vars)))) : 0;
          const f = Math.pow(10, d);
          return Math.round(x * f) / f;
        }
        case 'teto':
        case 'ceil': return Math.ceil(evaluateFormula(args[0], vars));
        case 'piso':
        case 'floor': return Math.floor(evaluateFormula(args[0], vars));
        case 'abs': return Math.abs(evaluateFormula(args[0], vars));
        default: return 0;
      }
    }
    default: return 0;
  }
}

const compiledCache = new Map<string, FormulaNode>();

/** Avalia uma fórmula (com cache da árvore). Resultado não finito vira 0. */
export function runFormula(source: string, vars: Record<string, number>): number {
  let ast = compiledCache.get(source);
  if (!ast) {
    ast = parseFormula(source);
    compiledCache.set(source, ast);
  }
  const value = evaluateFormula(ast, vars);
  return Number.isFinite(value) ? value : 0;
}
