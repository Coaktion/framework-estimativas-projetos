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
      fontFamily: {
        heading: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
}
