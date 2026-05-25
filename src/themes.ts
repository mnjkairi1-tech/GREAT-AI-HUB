
export interface ThemeConfig {
  id: string;
  name: string;
  primaryHex: string;
  secondaryHex: string;
  bgHex: string;
  cardHex: string;
  textHex: string;
  borderHex: string;
  description: string;
}

export const THEMES: Record<string, ThemeConfig> = {
  'classic-orange': {
    id: 'classic-orange',
    name: 'Classic Orange',
    primaryHex: '#ea580c',
    secondaryHex: '#fff7ed',
    bgHex: '#fafafa',
    cardHex: '#ffffff',
    textHex: '#171717',
    borderHex: '#f5f5f5',
    description: 'The standard, high-energy look for food and beverage.'
  },
  'noir-dark': {
    id: 'noir-dark',
    name: 'Noir Mono',
    primaryHex: '#ffffff',
    secondaryHex: '#171717',
    bgHex: '#000000',
    cardHex: '#0a0a0a',
    textHex: '#ffffff',
    borderHex: '#262626',
    description: 'Pure black & white. Extremely sharp, minimal, and premium.'
  },
  'glass-morphic': {
    id: 'glass-morphic',
    name: 'Dreamy Glass',
    primaryHex: '#f472b6',
    secondaryHex: 'rgba(255, 255, 255, 0.3)',
    bgHex: '#fce7f3',
    cardHex: 'rgba(255, 255, 255, 0.45)',
    textHex: '#831843',
    borderHex: 'rgba(255, 255, 255, 0.8)',
    description: 'Cute translucent frosted glass with soft pastel pink effects.'
  },
  'cute-marshmallow': {
    id: 'cute-marshmallow',
    name: 'Marshmallow',
    primaryHex: '#ec4899',
    secondaryHex: '#fdf2f8',
    bgHex: '#fff1f2',
    cardHex: '#ffffff',
    textHex: '#831843',
    borderHex: '#ffe4e6',
    description: 'Ultra-cute layered soft pink aesthetics. Fun and vibrant.'
  },
  'matcha-cafe': {
    id: 'matcha-cafe',
    name: 'Matcha Cafe',
    primaryHex: '#10b981',
    secondaryHex: '#ecfdf5',
    bgHex: '#f0fdf4',
    cardHex: '#ffffff',
    textHex: '#064e3b',
    borderHex: '#d1fae5',
    description: 'Refreshing and calming soft pastel greens. Perfect for cafes.'
  }
};

export function getTheme(id?: string): ThemeConfig {
  return THEMES[id || 'classic-orange'] || THEMES['classic-orange'];
}

export function applyTheme(themeId?: string) {
  const theme = getTheme(themeId);
  const root = document.documentElement;
  root.style.setProperty('--brand-primary', theme.primaryHex);
  root.style.setProperty('--brand-secondary', theme.secondaryHex);
  root.style.setProperty('--brand-bg', theme.bgHex);
  root.style.setProperty('--brand-card', theme.cardHex);
  root.style.setProperty('--brand-text', theme.textHex);
  root.style.setProperty('--brand-border', theme.borderHex);
}
