// Editor UI themes, all in the "Mint Matcha" style: Quicksand, rounded corners, a pastel gradient
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
  theme('mint', 'Mint Matcha', 'Fresh mint greens with a hint of lime.', {
    accent: '#3fae84', soft: '#e2f5ea', g1: '#c9f0dc', g2: '#e6f7c9', text: '#2f4a3e', muted: '#7a978a',
    border: '#d4ebde', bg: '#f4faf6', canvas: '#edf6f0', desk: '#eaf4ed',
  }),
  theme('pistachio', 'Pistachio', 'Soft pistachio green with buttery yellow.', {
    accent: '#86ad45', soft: '#eef6dc', g1: '#e0f1c2', g2: '#fff4c4', text: '#3d4a2a', muted: '#8a9672',
    border: '#e1ebcc', bg: '#fafcf2', canvas: '#f2f6e6', desk: '#eff4e3',
  }),
  theme('seafoam', 'Seafoam', 'Aqua and seafoam, like a calm beach.', {
    accent: '#2aa9a6', soft: '#dcf4f3', g1: '#bdeeea', g2: '#d6ecff', text: '#24474a', muted: '#76999a',
    border: '#cfe9e8', bg: '#f3fbfb', canvas: '#eaf6f6', desk: '#e6f3f3',
  }),
  theme('sage', 'Sage & Cream', 'Muted sage green on warm cream.', {
    accent: '#76956f', soft: '#e9f0e5', g1: '#dbe7d3', g2: '#f6efdc', text: '#3a4637', muted: '#8b9886',
    border: '#e0e7da', bg: '#f9faf5', canvas: '#f1f3ea', desk: '#eef1e7',
  }),
  theme('latte', 'Matcha Latte', 'Matcha green with a milky coffee touch.', {
    accent: '#7d9a55', soft: '#eef2e1', g1: '#dfe8c8', g2: '#efe2cf', text: '#44402f', muted: '#968f78',
    border: '#e6e3d2', bg: '#fbfaf4', canvas: '#f4f1e6', desk: '#f1eee3',
  }),
  theme('strawberry', 'Strawberry Milk', 'Sweet strawberry pink and milky peach.', {
    accent: '#ec6a8c', soft: '#ffe4ea', g1: '#ffd1dc', g2: '#ffe9d6', text: '#533843', muted: '#a88592',
    border: '#f6dae2', bg: '#fff7f9', canvas: '#fbedf1', desk: '#f9eaee',
  }),
  theme('apricot', 'Apricot', 'Warm apricot and peach, cozy and friendly.', {
    accent: '#ee8a5a', soft: '#ffebe0', g1: '#ffd3b8', g2: '#ffe7a8', text: '#4d3a30', muted: '#a28675',
    border: '#f5ddcc', bg: '#fff8f3', canvas: '#fbf0e8', desk: '#f9eee6',
  }),
  theme('butter', 'Butter', 'Buttery yellow and cream, sunny and soft.', {
    accent: '#d39a12', soft: '#fff3cc', g1: '#fff0b3', g2: '#ffe1c4', text: '#4a432c', muted: '#9a9072',
    border: '#f0e5c0', bg: '#fffdf4', canvas: '#faf6e6', desk: '#f8f3e1',
  }),
  theme('lilac', 'Lilac Mint', 'Lilac with a minty finish.', {
    accent: '#9b74d6', soft: '#f1e9fb', g1: '#e3d3fb', g2: '#d3f0e7', text: '#43385a', muted: '#958aac',
    border: '#e7def5', bg: '#faf7fe', canvas: '#f2edf9', desk: '#efe9f7',
  }),
  theme('baby-blue', 'Baby Blue', 'Baby blue fading into mint.', {
    accent: '#4f9fdf', soft: '#e3f0fc', g1: '#cfe8ff', g2: '#dff7f0', text: '#2e3d52', muted: '#8193a8',
    border: '#d9e7f6', bg: '#f5f9ff', canvas: '#eef4fb', desk: '#ebf2fa',
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
