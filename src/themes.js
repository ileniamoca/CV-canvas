// Editor UI themes. Each theme overrides the CSS variables defined in style.css (:root);
// "classic" overrides nothing, so it keeps the original look and follows the system dark mode.
// The theme picker (bubble in the bottom-right corner) is a temporary tool to choose a look.

export const THEMES = [
  {
    id: 'classic', name: 'Classic', note: 'The original blue look. Follows your system dark mode.',
    swatch: ['#2b5797', '#e5edf8'], vars: {},
  },
  {
    id: 'cotton', name: 'Cotton Candy', note: 'Soft pink and lilac, rounded and airy.',
    swatch: ['#e66fa6', '#d9c8f5'], font: 'Nunito',
    vars: {
      '--bg': '#fdf6fa', '--panel': '#ffffff', '--border': '#f1dbe7', '--text': '#4a3848', '--muted': '#9b8297',
      '--accent': '#e66fa6', '--accent-soft': '#fde8f2', '--on-accent': '#ffffff', '--danger': '#d64545',
      '--canvas': '#f8eef4', '--desk': '#f6ecf2',
      '--titlebar': 'linear-gradient(90deg, #f9c6dd, #d9c8f5)', '--titlebar-text': '#4a3848',
      '--titlebar-btn': 'rgba(255,255,255,.6)', '--titlebar-btn-border': 'rgba(255,255,255,.9)',
      '--titlebar-primary': '#e66fa6', '--titlebar-primary-text': '#ffffff',
      '--radius': '14px', '--radius-sm': '10px', '--toast': '#6b4a68',
    },
  },
  {
    id: 'mint', name: 'Mint Matcha', note: 'Fresh mint greens with a hint of lime.',
    swatch: ['#3fae84', '#e6f7c9'], font: 'Quicksand',
    vars: {
      '--bg': '#f4faf6', '--panel': '#ffffff', '--border': '#d4ebde', '--text': '#2f4a3e', '--muted': '#7a978a',
      '--accent': '#3fae84', '--accent-soft': '#e2f5ea', '--on-accent': '#ffffff', '--danger': '#d64545',
      '--canvas': '#edf6f0', '--desk': '#eaf4ed',
      '--titlebar': 'linear-gradient(90deg, #c9f0dc, #e6f7c9)', '--titlebar-text': '#2f4a3e',
      '--titlebar-btn': 'rgba(255,255,255,.6)', '--titlebar-btn-border': 'rgba(255,255,255,.9)',
      '--titlebar-primary': '#3fae84', '--titlebar-primary-text': '#ffffff',
      '--radius': '14px', '--radius-sm': '10px', '--toast': '#2f4a3e',
    },
  },
  {
    id: 'peach', name: 'Peach Sorbet', note: 'Warm peach and apricot, cozy and friendly.',
    swatch: ['#f08a5d', '#ffe7a8'], font: 'Nunito',
    vars: {
      '--bg': '#fff8f3', '--panel': '#ffffff', '--border': '#f5ddcc', '--text': '#4d3a30', '--muted': '#a28675',
      '--accent': '#f08a5d', '--accent-soft': '#ffebe0', '--on-accent': '#ffffff', '--danger': '#d64545',
      '--canvas': '#fbf0e8', '--desk': '#f9eee6',
      '--titlebar': 'linear-gradient(90deg, #ffd3b8, #ffe7a8)', '--titlebar-text': '#4d3a30',
      '--titlebar-btn': 'rgba(255,255,255,.6)', '--titlebar-btn-border': 'rgba(255,255,255,.9)',
      '--titlebar-primary': '#f08a5d', '--titlebar-primary-text': '#ffffff',
      '--radius': '14px', '--radius-sm': '10px', '--toast': '#6b4a3a',
    },
  },
  {
    id: 'lavender', name: 'Lavender Dream', note: 'Dreamy lavender fading into baby blue.',
    swatch: ['#8b6fe0', '#c4e2ff'], font: 'Quicksand',
    vars: {
      '--bg': '#f8f6fe', '--panel': '#ffffff', '--border': '#e3ddf7', '--text': '#3b3558', '--muted': '#8c86ad',
      '--accent': '#8b6fe0', '--accent-soft': '#efeafd', '--on-accent': '#ffffff', '--danger': '#d64545',
      '--canvas': '#f1eefb', '--desk': '#efecf9',
      '--titlebar': 'linear-gradient(90deg, #d8ccff, #c4e2ff)', '--titlebar-text': '#3b3558',
      '--titlebar-btn': 'rgba(255,255,255,.6)', '--titlebar-btn-border': 'rgba(255,255,255,.9)',
      '--titlebar-primary': '#8b6fe0', '--titlebar-primary-text': '#ffffff',
      '--radius': '14px', '--radius-sm': '10px', '--toast': '#3b3558',
    },
  },
  {
    id: 'sky', name: 'Sky Cloud', note: 'Light sky blue, calm and clean.',
    swatch: ['#4a9be8', '#e3f2ff'], font: 'Nunito',
    vars: {
      '--bg': '#f5f9ff', '--panel': '#ffffff', '--border': '#d9e7f6', '--text': '#2e3d52', '--muted': '#8193a8',
      '--accent': '#4a9be8', '--accent-soft': '#e5f1fd', '--on-accent': '#ffffff', '--danger': '#d64545',
      '--canvas': '#eef4fb', '--desk': '#ebf2fa',
      '--titlebar': 'linear-gradient(90deg, #bfe0ff, #e3f2ff)', '--titlebar-text': '#2e3d52',
      '--titlebar-btn': 'rgba(255,255,255,.6)', '--titlebar-btn-border': 'rgba(255,255,255,.95)',
      '--titlebar-primary': '#4a9be8', '--titlebar-primary-text': '#ffffff',
      '--radius': '14px', '--radius-sm': '10px', '--toast': '#2e3d52',
    },
  },
  {
    id: 'lemon', name: 'Lemon Cream', note: 'Buttery yellow and cream, sunny and soft.',
    swatch: ['#e0a91b', '#ffe1c4'], font: 'Quicksand',
    vars: {
      '--bg': '#fffdf4', '--panel': '#ffffff', '--border': '#f0e5c0', '--text': '#4a432c', '--muted': '#9a9072',
      '--accent': '#d99a0b', '--accent-soft': '#fff3cc', '--on-accent': '#ffffff', '--danger': '#d64545',
      '--canvas': '#faf6e6', '--desk': '#f8f3e1',
      '--titlebar': 'linear-gradient(90deg, #fff0b3, #ffe1c4)', '--titlebar-text': '#4a432c',
      '--titlebar-btn': 'rgba(255,255,255,.6)', '--titlebar-btn-border': 'rgba(255,255,255,.95)',
      '--titlebar-primary': '#d99a0b', '--titlebar-primary-text': '#ffffff',
      '--radius': '14px', '--radius-sm': '10px', '--toast': '#4a432c',
    },
  },
];

const ALL_VARS = [...new Set(THEMES.flatMap((t) => Object.keys(t.vars)))];

/** Applies a theme to the editor UI (not to the CV). Returns the theme applied. */
export function applyTheme(id) {
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0];
  const root = document.documentElement;
  for (const k of ALL_VARS) root.style.removeProperty(k);
  root.style.removeProperty('--font');
  for (const [k, v] of Object.entries(theme.vars)) root.style.setProperty(k, v);
  if (theme.font) {
    root.style.setProperty('--font', `"${theme.font}", -apple-system, BlinkMacSystemFont, sans-serif`);
    loadFont(theme.font);
  }
  root.dataset.theme = theme.id;
  return theme;
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
