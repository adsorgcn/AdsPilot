import type { CSSProperties } from 'react';

export type ThemeMode = 'dark' | 'light';

export interface BackgroundTheme {
  id: string;
  name: string;
  description: string;
  mode: ThemeMode;
  style: CSSProperties;
  darkStyle?: CSSProperties;
}

export const BACKGROUND_THEMES: BackgroundTheme[] = [
  {
    id: 'aurora-nightfall',
    name: '夜幕极光',
    description: '顶部极光辉光营造沉浸夜色体验',
    mode: 'dark',
    style: {
      background:
        'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(120, 180, 255, 0.08), transparent 70%), #f5f7ff',
    },
    darkStyle: {
      background:
        'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(120, 180, 255, 0.25), transparent 70%), #04070d',
    },
  },
  {
    id: 'quantum-circuit',
    name: '量子电路',
    description: '科技感矩阵电路纹理，突出AI与数据氛围',
    mode: 'dark',
    style: {
      backgroundColor: '#101010',
      backgroundImage: [
        'repeating-linear-gradient(0deg, transparent, transparent 19px, rgba(34, 197, 94, 0.1) 19px, rgba(34, 197, 94, 0.1) 20px, transparent 20px, transparent 39px, rgba(34, 197, 94, 0.1) 39px, rgba(34, 197, 94, 0.1) 40px)',
        'repeating-linear-gradient(90deg, transparent, transparent 19px, rgba(34, 197, 94, 0.1) 19px, rgba(34, 197, 94, 0.1) 20px, transparent 20px, transparent 39px, rgba(34, 197, 94, 0.1) 39px, rgba(34, 197, 94, 0.1) 40px)',
        'radial-gradient(circle at 20px 20px, rgba(16, 185, 129, 0.16) 2px, transparent 2px)',
        'radial-gradient(circle at 40px 40px, rgba(16, 185, 129, 0.16) 2px, transparent 2px)',
      ].join(', '),
      backgroundSize: '40px 40px, 40px 40px, 40px 40px, 40px 40px',
    },
    darkStyle: {
      backgroundColor: '#050505',
      backgroundImage: [
        'repeating-linear-gradient(0deg, transparent, transparent 19px, rgba(34, 197, 94, 0.18) 19px, rgba(34, 197, 94, 0.18) 20px, transparent 20px, transparent 39px, rgba(34, 197, 94, 0.18) 39px, rgba(34, 197, 94, 0.18) 40px)',
        'repeating-linear-gradient(90deg, transparent, transparent 19px, rgba(34, 197, 94, 0.18) 19px, rgba(34, 197, 94, 0.18) 20px, transparent 20px, transparent 39px, rgba(34, 197, 94, 0.18) 39px, rgba(34, 197, 94, 0.18) 40px)',
        'radial-gradient(circle at 20px 20px, rgba(16, 185, 129, 0.25) 2px, transparent 2px)',
        'radial-gradient(circle at 40px 40px, rgba(16, 185, 129, 0.25) 2px, transparent 2px)',
      ].join(', '),
      backgroundSize: '40px 40px, 40px 40px, 40px 40px, 40px 40px',
    },
  },
  {
    id: 'cosmic-nebula',
    name: '宇宙星云',
    description: '多层星云高光营造未来感舞台',
    mode: 'dark',
    style: {
      background:
        'radial-gradient(ellipse 110% 70% at 25% 80%, rgba(147, 51, 234, 0.08), transparent 55%), radial-gradient(ellipse 130% 60% at 75% 15%, rgba(59, 130, 246, 0.06), transparent 65%), radial-gradient(ellipse 80% 90% at 20% 30%, rgba(236, 72, 153, 0.08), transparent 50%), radial-gradient(ellipse 100% 40% at 60% 70%, rgba(16, 185, 129, 0.05), transparent 45%), #f3f4ff',
    },
    darkStyle: {
      background:
        'radial-gradient(ellipse 110% 70% at 25% 80%, rgba(147, 51, 234, 0.14), transparent 55%), radial-gradient(ellipse 130% 60% at 75% 15%, rgba(59, 130, 246, 0.12), transparent 65%), radial-gradient(ellipse 80% 90% at 20% 30%, rgba(236, 72, 153, 0.16), transparent 50%), radial-gradient(ellipse 100% 40% at 60% 70%, rgba(16, 185, 129, 0.08), transparent 45%), #02030a',
    },
  },
  {
    id: 'sunrise-halo',
    name: '晨曦暖光',
    description: '柔和暖色渐变带来亲和力与活力',
    mode: 'light',
    style: {
      backgroundColor: '#fff7ed',
      backgroundImage: [
        'linear-gradient(180deg, rgba(255,247,237,1) 0%, rgba(255,237,213,0.8) 25%, rgba(254,215,170,0.6) 50%, rgba(251,146,60,0.4) 75%, rgba(249,115,22,0.3) 100%)',
        'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.6) 0%, transparent 40%)',
        'radial-gradient(circle at 80% 20%, rgba(254,215,170,0.5) 0%, transparent 50%)',
        'radial-gradient(circle at 60% 60%, rgba(252,165,165,0.3) 0%, transparent 45%)',
      ].join(', '),
    },
    darkStyle: {
      backgroundColor: '#3b2412',
      backgroundImage: [
        'linear-gradient(180deg, rgba(64,36,20,1) 0%, rgba(79,42,22,0.9) 30%, rgba(124,49,21,0.65) 60%, rgba(173,83,32,0.4) 100%)',
        'radial-gradient(circle at 20% 80%, rgba(255,179,71,0.24) 0%, transparent 45%)',
        'radial-gradient(circle at 80% 20%, rgba(255,123,47,0.2) 0%, transparent 55%)',
      ].join(', '),
    },
  },
  {
    id: 'ocean-mist',
    name: '海雾晨曦',
    description: '蓝绿交织的渐变营造清新调性',
    mode: 'light',
    style: {
      background:
        'linear-gradient(225deg, #B3E5FC 0%, #E0F2F1 25%, #F0F4C3 50%, #FFF8E1 75%, #FFECB3 100%)',
    },
    darkStyle: {
      background:
        'linear-gradient(225deg, rgba(33, 60, 74, 0.9) 0%, rgba(25, 61, 54, 0.82) 25%, rgba(22, 54, 41, 0.78) 50%, rgba(35, 50, 35, 0.75) 75%, rgba(48, 44, 30, 0.7) 100%)',
    },
  },
];

export const DEFAULT_THEME_ID = 'aurora-nightfall';

export function getThemeById(id: string): BackgroundTheme | undefined {
  return BACKGROUND_THEMES.find(theme => theme.id === id);
}

export function getThemeStyle(id: string, isDark: boolean): CSSProperties {
  const theme = getThemeById(id);
  if (!theme) {
    return BACKGROUND_THEMES[0].style;
  }

  return isDark && theme.darkStyle ? theme.darkStyle : theme.style;
}
