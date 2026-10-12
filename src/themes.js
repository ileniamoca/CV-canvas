// Editor UI themes, all in one style: Quicksand, rounded corners, a pastel gradient
// title bar and soft buttons. Only the colors change. Each theme overrides the CSS variables
// defined in style.css (:root). The theme picker (bubble in the bottom-right corner) is a
// temporary tool to choose a look.

const FONT = 'Quicksand';

/** Builds a theme from its palette; everything that isn't color is shared. */
function theme(id, name, note, c, group = 'Warm peach') {
  return {
    id, name, note, group, font: FONT, swatch: [c.accent, group === 'Peach & grey' ? c.g1 : c.g2],
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
  // Peach, coral, pink and orange accents over grey neutrals (warm stone/taupe, cool slate/graphite, plain concrete).
  ...[
    ['peach-slate', 'Peach Slate', 'Soft peach over cool slate greys.', {
      accent: '#e8875e', soft: '#fdece3', g1: '#dfe2e7', g2: '#ffd9c4', text: '#3d4148', muted: '#8a8f98',
      border: '#e3e4e7', bg: '#f7f7f8', canvas: '#eeeff1', desk: '#ebecef',
    }],
    ['coral-stone', 'Coral Stone', 'Coral on warm stone grey.', {
      accent: '#ec6f5c', soft: '#fde6e1', g1: '#e6e1dc', g2: '#ffc9bd', text: '#44403c', muted: '#8f8a85',
      border: '#e7e3df', bg: '#f9f8f6', canvas: '#f0eeeb', desk: '#edeae7',
    }],
    ['rose-taupe', 'Rose Taupe', 'Dusty rose with a soft taupe.', {
      accent: '#d9758f', soft: '#f9e6ec', g1: '#e4dde0', g2: '#f7d2de', text: '#4a4245', muted: '#978d91',
      border: '#e8e2e4', bg: '#faf8f9', canvas: '#f1edef', desk: '#eeeaec',
    }],
    ['apricot-fog', 'Apricot Fog', 'Apricot glowing through a light grey fog.', {
      accent: '#ee8a5a', soft: '#ffece1', g1: '#d9dde2', g2: '#ffe0c4', text: '#3f4246', muted: '#8c9096',
      border: '#e2e3e5', bg: '#f6f7f8', canvas: '#eceef0', desk: '#e9ebee',
    }],
    ['blush-graphite', 'Blush Graphite', 'Pink blush against graphite grey: the most contrasted.', {
      accent: '#e5688a', soft: '#fbe4eb', g1: '#c9cdd3', g2: '#f9cfdb', text: '#2f3237', muted: '#7f848b',
      border: '#dfe1e4', bg: '#f5f6f7', canvas: '#eaecee', desk: '#e6e8eb',
    }],
    ['melon-ash', 'Melon Ash', 'Melon orange with warm ash grey.', {
      accent: '#ef8c66', soft: '#ffebe1', g1: '#dcd8d2', g2: '#ffd4c2', text: '#403e3b', muted: '#8d8984',
      border: '#e5e2de', bg: '#f8f7f5', canvas: '#efedea', desk: '#ecebe7',
    }],
    ['grapefruit-mist', 'Grapefruit Mist', 'Pink grapefruit in a cool grey mist.', {
      accent: '#ec6b67', soft: '#fde3e1', g1: '#d5d9e0', g2: '#ffc6c0', text: '#3b3e44', muted: '#868b93',
      border: '#e1e3e7', bg: '#f6f7f9', canvas: '#ecedf1', desk: '#e8eaee',
    }],
    ['peach-concrete', 'Peach Concrete', 'Muted terracotta peach on plain concrete grey.', {
      accent: '#d9805a', soft: '#f8e8df', g1: '#d6d6d4', g2: '#f6cfb8', text: '#3a3a3a', muted: '#888888',
      border: '#e2e2e2', bg: '#f6f6f5', canvas: '#ececeb', desk: '#e8e8e7',
    }],
    ['dusty-coral', 'Dusty Coral', 'Dusty coral with a pinkish warm grey.', {
      accent: '#d6735f', soft: '#f6e3dd', g1: '#ded5d2', g2: '#f3c6b8', text: '#463f3d', muted: '#958b88',
      border: '#e7e1df', bg: '#f9f7f6', canvas: '#f0ecea', desk: '#ede8e6',
    }],
    ['pink-pewter', 'Pink Pewter', 'Candy pink softened by pewter grey.', {
      accent: '#e07a95', soft: '#fae5ec', g1: '#cfd3da', g2: '#f6d0dc', text: '#3c3f45', muted: '#8a8e96',
      border: '#e0e2e6', bg: '#f7f7f9', canvas: '#edeef1', desk: '#e9eaee',
    }],
  ].map(([id, name, note, c]) => theme(id, name, note, c, 'Peach & grey')),
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

// ---------- UI styles (src/ui-styles.css) ----------
// A style is a whole look for the editor (fonts, shapes, textures and its own colors). "cute" is the
// default look colored by the palettes above; any other style replaces the palette while it's on.
// `fonts` are Google Fonts "family" parameters (only weights each font really has).
export const STYLES = [
  { id: 'cute', name: 'Cute (palettes)', note: 'Rounded and soft, in the palette you choose below.', fonts: [] },
  { id: 'clay', name: 'Claymorphism', note: 'Puffy, inflated shapes with soft inner light, like modelling clay.', fonts: ['Nunito:wght@400;600;700', 'Fredoka:wght@500;600'] },
  { id: 'cybercore', name: 'Cybercore', note: 'Terminal-dark with cyan glow, mono type and a grid.', fonts: ['Share+Tech+Mono', 'Orbitron:wght@500;700'] },
  { id: 'brutal', name: 'Neo-Brutalism', note: 'Thick black outlines, hard offset shadows and loud flat colors.', fonts: ['Space+Grotesk:wght@400;500;700', 'Archivo+Black'] },
  { id: 'surreal', name: 'Surrealism', note: 'A dreamlike sky with a melting sun; asymmetric, soft shapes.', fonts: ['DM+Sans:wght@400;500;700', 'Fraunces:ital,wght@0,600;1,600'] },
  { id: 'y2k', name: 'Y2K Aesthetic', note: 'Glossy chrome, bubble buttons and iridescent pastels.', fonts: ['Nunito:wght@400;600;700', 'Audiowide'] },
  { id: 'pixel', name: 'Pixel art', note: '8-bit type, square corners and chunky pixel borders.', fonts: ['VT323', 'Press+Start+2P'] },
  { id: 'synthwave', name: 'Synthwave', note: '80s neon: magenta and cyan glow over a retro sunset grid.', fonts: ['Exo+2:wght@400;600;700', 'Orbitron:wght@500;700'] },
  { id: 'glass', name: 'Glassmorphism', note: 'Frosted glass panels floating over colorful blurred blobs.', fonts: ['Inter:wght@400;500;600;700'] },
  { id: 'neu', name: 'Neumorphism', note: 'Everything carved from one soft surface: light and shadow only.', fonts: ['Nunito:wght@400;600;700'] },
  { id: 'bento', name: 'Bento grid', note: 'Everything in rounded tiles with gaps, like a bento box.', fonts: ['Manrope:wght@400;500;600;700'] },
  { id: 'editorial', name: 'Editorial design', note: 'Magazine layout: serif type, hairline rules, small caps, red ink.', fonts: ['Source+Serif+4:wght@400;600', 'Playfair+Display:ital,wght@0,700;1,700'] },
  { id: 'swiss', name: 'Swiss design', note: 'International style: grid, black and white, one strong red, sans-serif.', fonts: ['Inter:wght@400;600;800;900'] },
  { id: 'minimal', name: 'Minimalism', note: 'Almost nothing: white space, light type, hairlines, black accent.', fonts: ['Inter:wght@300;400;500'] },
  { id: 'maximal', name: 'Maximalism', note: 'More is more: rainbow, patterns, dots, stacked shadows.', fonts: ['DM+Sans:wght@400;500;700', 'Bricolage+Grotesque:wght@600;800'] },
  { id: 'luxury', name: 'Luxury typography', note: 'Black and gold, Roman capitals and wide letter-spacing.', fonts: ['Cormorant+Garamond:wght@400;500;600', 'Cinzel:wght@500;600'] },
  { id: 'sketch', name: 'Conceptual sketch', note: 'Hand-drawn: wobbly ink outlines, handwriting, grid paper.', fonts: ['Patrick+Hand', 'Caveat:wght@600;700'] },
  { id: 'ethereal', name: 'Ethereal', note: 'Airy pastel haze, soft glows and light italic serif.', fonts: ['Nunito+Sans:wght@300;400;600', 'Cormorant+Garamond:ital,wght@1,500'] },
  { id: 'boho', name: 'Bohemian', note: 'Earthy terracotta, mustard and olive with woven patterns.', fonts: ['Lora:wght@400;600', 'Yeseva+One'] },
  { id: 'victorian', name: 'Victorian', note: 'Burgundy and gold, double frames, fleurons and old-style type.', fonts: ['EB+Garamond:wght@400;600', 'IM+Fell+English+SC'] },
  { id: 'cyberpunk', name: 'Cyberpunk', note: 'Yellow and black, cut corners, cyan and red glitch shadows.', fonts: ['Rajdhani:wght@500;600;700', 'Orbitron:wght@600;800'] },
  { id: 'wabisabi', name: 'Wabi-sabi', note: 'Imperfect and calm: earthy greys, paper texture, uneven corners.', fonts: ['Zen+Kaku+Gothic+New:wght@400;500', 'Shippori+Mincho:wght@500;600'] },
];

/** Applies a UI style; `palette` is the palette to use when going back to "cute". */
export function applyStyle(id, palette) {
  const style = STYLES.find((s) => s.id === id) ?? STYLES[0];
  const root = document.documentElement;
  if (style.id === 'cute') {
    delete root.dataset.style;
    applyTheme(palette);
  } else {
    // The style brings its own colors: drop the palette's inline variables (they would win over the CSS).
    for (const k of [...ALL_VARS, '--font']) root.style.removeProperty(k);
    root.dataset.style = style.id;
    if (style.fonts.length) {
      const id = `style-fonts-${style.id}`;
      if (!document.getElementById(id)) {
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?${style.fonts.map((f) => `family=${f}`).join('&')}&display=swap`;
        document.head.append(link);
      }
    }
  }
  return style;
}
