// Editor UI themes, all in one style: Quicksand, rounded corners, a pastel gradient
// title bar and soft buttons. Only the colors change. Each theme overrides the CSS variables
// defined in style.css (:root). The theme picker (bubble in the bottom-right corner) is a
// temporary tool to choose a look.

const FONT = 'Quicksand';

/** Builds a theme from its palette; everything that isn't color is shared. */
function theme(id, name, note, c) {
  return {
    id, name, note, font: FONT, swatch: [c.accent, c.g2],
    vars: {
      '--bg': c.bg, '--panel': '#ffffff', '--border': c.border, '--text': c.text, '--muted': c.muted,
      '--accent': c.accent, '--accent-soft': c.soft, '--on-accent': '#ffffff', '--danger': '#d64545',
      '--canvas': c.canvas, '--desk': c.desk,
      '--titlebar': `linear-gradient(90deg, ${c.g1}, ${c.g2})`, '--titlebar-text': c.text,
      '--titlebar-btn': 'rgba(255,255,255,.6)', '--titlebar-btn-border': 'rgba(255,255,255,.9)',
      '--titlebar-primary': c.accent, '--titlebar-primary-text': '#ffffff',
      '--radius': '14px', '--radius-sm': '10px', '--toast': c.text,
    },
  };
}

export const THEMES = [
  theme('peach-fuzz', 'Peach Fuzz', 'Velvety peach, soft and warm.', {
    accent: '#e8875e', soft: '#ffece2', g1: '#ffd6c0', g2: '#ffe9dc', text: '#4f3a30', muted: '#a68979',
    border: '#f6dfd2', bg: '#fff8f4', canvas: '#fcf0e9', desk: '#faede5',
  }),
  theme('apricot', 'Apricot', 'Warm apricot and peach with a sunny glow.', {
    accent: '#ee8a5a', soft: '#ffebe0', g1: '#ffd3b8', g2: '#ffe7a8', text: '#4d3a30', muted: '#a28675',
    border: '#f5ddcc', bg: '#fff8f3', canvas: '#fbf0e8', desk: '#f9eee6',
  }),
  theme('strawberry', 'Strawberry Milk', 'Sweet strawberry pink and milky peach.', {
    accent: '#ec6a8c', soft: '#ffe4ea', g1: '#ffd1dc', g2: '#ffe9d6', text: '#533843', muted: '#a88592',
    border: '#f6dae2', bg: '#fff7f9', canvas: '#fbedf1', desk: '#f9eaee',
  }),
  theme('peach-blossom', 'Peach Blossom', 'Pink-peach petals, delicate and romantic.', {
    accent: '#ea7f7f', soft: '#ffe7e4', g1: '#ffd4cf', g2: '#ffe6d8', text: '#523a3a', muted: '#a98886',
    border: '#f6dcd8', bg: '#fff8f7', canvas: '#fcefed', desk: '#faecea',
  }),
  theme('coral', 'Coral Candy', 'Playful coral with a peachy finish.', {
    accent: '#ef6f5c', soft: '#ffe5df', g1: '#ffc9bd', g2: '#ffe2cf', text: '#52352f', muted: '#a8847c',
    border: '#f7d9d1', bg: '#fff7f5', canvas: '#fcede9', desk: '#faeae5',
  }),
  theme('melon', 'Melon', 'Cantaloupe orange melting into cream.', {
    accent: '#ef8c66', soft: '#ffeadf', g1: '#ffd4c2', g2: '#fff0d4', text: '#4e3b2f', muted: '#a58a76',
    border: '#f6dfcf', bg: '#fffaf5', canvas: '#fcf2ea', desk: '#faefe6',
  }),
  theme('rose-petal', 'Rose Petal', 'Dusty rose with a warm peach blush.', {
    accent: '#d9758f', soft: '#fbe6ec', g1: '#f7d2de', g2: '#fde5da', text: '#4f3640', muted: '#a3868f',
    border: '#f1dbe2', bg: '#fdf8f9', canvas: '#f8eef1', desk: '#f6ebee',
  }),
  theme('guava', 'Guava', 'Juicy guava pink with tropical peach.', {
    accent: '#e5688a', soft: '#ffe3eb', g1: '#ffc8d6', g2: '#ffdfc6', text: '#55333f', muted: '#ab8290',
    border: '#f7d6df', bg: '#fff6f8', canvas: '#fcecf0', desk: '#fae8ed',
  }),
  theme('vanilla-peach', 'Vanilla Peach', 'Creamy vanilla with a hint of peach.', {
    accent: '#e2925f', soft: '#fdeedf', g1: '#ffe2cb', g2: '#fff4dd', text: '#4c3d31', muted: '#a38d7b',
    border: '#f3e3d2', bg: '#fffbf6', canvas: '#fbf4ec', desk: '#f9f1e8',
  }),
  theme('grapefruit', 'Grapefruit', 'Pink grapefruit, bright and zesty.', {
    accent: '#ec6b67', soft: '#ffe3e1', g1: '#ffc6c0', g2: '#ffdcc8', text: '#533634', muted: '#aa8582',
    border: '#f7d7d4', bg: '#fff6f5', canvas: '#fcecea', desk: '#fae8e6',
  }),
];

const ALL_VARS = [...new Set(THEMES.flatMap((t) => Object.keys(t.vars)))];

/** Applies a theme to the editor UI (not to the CV). Returns the theme applied. */
export function applyTheme(id) {
  const chosen = THEMES.find((t) => t.id === id) ?? THEMES[0];
  const root = document.documentElement;
  for (const k of ALL_VARS) root.style.removeProperty(k);
  root.style.removeProperty('--font');
  for (const [k, v] of Object.entries(chosen.vars)) root.style.setProperty(k, v);
  if (chosen.font) {
    root.style.setProperty('--font', `"${chosen.font}", -apple-system, BlinkMacSystemFont, sans-serif`);
    loadFont(chosen.font);
  }
  root.dataset.theme = chosen.id;
  return chosen;
}

function loadFont(name) {
  const id = `theme-font-${name.replace(/\s+/g, '-')}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${name.replace(/ /g, '+')}:wght@400;500;600;700&display=swap`;
  document.head.append(link);
}
