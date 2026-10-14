/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "var(--primary)",
          secondary: "var(--secondary)",
          accent: "var(--accent)",
          dark: "var(--dark)",
          // Texto sobre o verde (ink). Aceita opacidade: text-brand-ink/70
          ink: "rgb(var(--on-primary-rgb) / <alpha-value>)",
          muted: "var(--text-muted)",
          subtle: "var(--text-subtle)",
          soft: "var(--accent-soft)",
          "soft-fg": "var(--accent-soft-fg)",
          line: "var(--border-main)",
          "line-strong": "var(--border-strong)",
        },
        // Pre-Sales Ops: tokens em canais RGB (definidos em app/globals.scss,
        // com valor próprio no tema escuro) para aceitar opacidade: bg-psops-acento/10
        psops: {
          surf1: "rgb(var(--psops-surf-1) / <alpha-value>)",
          surf2: "rgb(var(--psops-surf-2) / <alpha-value>)",
          surf3: "rgb(var(--psops-surf-3) / <alpha-value>)",
          texto: "rgb(var(--psops-texto) / <alpha-value>)",
          muted: "rgb(var(--psops-muted) / <alpha-value>)",
          linha: "rgb(var(--psops-linha) / <alpha-value>)",
          forte: "rgb(var(--psops-linha-forte) / <alpha-value>)",
          acento: "rgb(var(--psops-acento) / <alpha-value>)",
          tinta: "rgb(var(--psops-acento-tinta) / <alpha-value>)",
          sobre: "rgb(var(--psops-sobre-acento) / <alpha-value>)",
          alerta: "rgb(var(--psops-alerta) / <alpha-value>)",
          alertatinta: "rgb(var(--psops-alerta-tinta) / <alpha-value>)",
        },
      },
      // Aktie Now: Bebas Neue (títulos e números) + Roboto (todo o resto).
      // As variáveis vêm do next/font em app/layout.tsx.
      fontFamily: {
        sans: ["var(--font-body)", "Roboto", "-apple-system", "Segoe UI", "sans-serif"],
        heading: ["var(--font-display)", "Bebas Neue", "Arial Narrow", "sans-serif"],
        display: ["var(--font-display)", "Bebas Neue", "Arial Narrow", "sans-serif"],
      },
      // Escala semântica: os valores mudam com a densidade (.compact) em globals.scss.
      fontSize: {
        caption: ["var(--fs-caption)", { lineHeight: "1.4" }],
        label: ["var(--fs-label)", { lineHeight: "1.4" }],
        body: ["var(--fs-body)", { lineHeight: "1.55" }],
        title: ["var(--fs-title)", { lineHeight: "1.3" }],
        section: ["var(--fs-section)", { lineHeight: "1" }],
        page: ["var(--fs-page)", { lineHeight: "0.95" }],
        kpi: ["var(--fs-kpi)", { lineHeight: "0.9" }],
      },
    },
  },
  plugins: [],
}
