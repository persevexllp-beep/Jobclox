/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Persevex Design Tokens
 * 
 * Centralized design system tokens for the Career Flow visual identity.
 * All design decisions are encoded here for consistency and maintainability.
 */

// ============================================================================
// COLOR SYSTEM
// ============================================================================

export const colors = {
  persevex: {
    light: {
      background: '#F8FAFC',
      surface: '#FFFFFF',
      surfaceSecondary: '#F1F5F9',
      textPrimary: '#0F172A',
      textSecondary: '#475569',
      textMuted: '#64748B',
      border: '#E2E8F0',
      accent: '#2563EB',
      success: '#16A34A',
      warning: '#EA580C',
    },
    dark: {
      background: '#020617',
      surface: '#0F172A',
      surfaceSecondary: '#1E293B',
      textPrimary: '#F8FAFC',
      textSecondary: '#CBD5E1',
      textMuted: '#94A3B8',
      border: '#334155',
      accent: '#3B82F6',
      success: '#22C55E',
      warning: '#F97316',
    },
  },

  // Career Flow OS — Primary Palette
  careerFlow: {
    indigo: {
      400: '#818cf8',
      500: '#6366f1', // Electric Indigo
      600: '#4f46e5',
      700: '#4338ca',
    },
    violet: {
      500: '#7c3aed',
      700: '#5b21b6', // Deep Violet
      900: '#4c1d95',
    },
    cyan: {
      400: '#22d3ee', // Aurora Cyan
      500: '#06b6d4',
    },
    green: '#10b981',   // Career Green
    blue: '#3b82f6',    // Future Blue
    gold: '#fbbf24',    // Achievement Gold
  },

  // Career Flow Primary Palette (legacy compat)
  primary: {
    emerald: {
      50: '#ecfdf5',
      100: '#d1fae5',
      200: '#a7f3d0',
      300: '#6ee7b7',
      400: '#34d399',
      500: '#10b981',
      600: '#059669',
      700: '#047857',
      800: '#065f46',
      900: '#064e3b',
      950: '#022c22',
    },
    blue: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
      950: '#172554',
    },
    violet: {
      50: '#f5f3ff',
      100: '#ede9fe',
      200: '#ddd6fe',
      300: '#c4b5fd',
      400: '#a78bfa',
      500: '#8b5cf6',
      600: '#7c3aed',
      700: '#6d28d9',
      800: '#5b21b6',
      900: '#4c1d95',
      950: '#2e1065',
    },
  },

  // Semantic Colors
  semantic: {
    success: '#16A34A',
    warning: '#EA580C',
    error: '#DC2626',
    info: '#2563EB',
  },

  // Dark Mode Palette
  dark: {
    background: {
      deep: '#020617',
      twilight: '#0F172A',
      midnight: '#1E293B',
      surface: '#0F172A',
    },
    text: {
      primary: '#F8FAFC',
      secondary: '#CBD5E1',
      tertiary: '#94A3B8',
      muted: '#94A3B8',
    },
    border: {
      subtle: '#334155',
      default: '#334155',
      strong: '#475569',
    },
  },

  // Light Mode Palette
  light: {
    background: {
      canvas: '#F8FAFC',
      surface: '#FFFFFF',
      elevated: '#F1F5F9',
      glass: '#FFFFFF',
    },
    text: {
      primary: '#0F172A',
      secondary: '#475569',
      tertiary: '#64748B',
      muted: '#64748B',
    },
    border: {
      subtle: '#E2E8F0',
      default: '#E2E8F0',
      strong: '#CBD5E1',
    },
  },

  // Gradients
  gradients: {
    // Career Flow OS Signature Gradient
    careerFlow: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
    careerFlowSoft: 'linear-gradient(135deg, rgba(37, 99, 235, 0.1) 0%, rgba(37, 99, 235, 0.04) 100%)',

    // Career Flow Gradient (legacy)
    primary: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
    
    // Semantic Gradients
    success: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)',
    warning: 'linear-gradient(135deg, #EA580C 0%, #C2410C 100%)',
    error: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
    info: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    
    // Glass Gradients
    glassDark: 'linear-gradient(145deg, rgba(255, 255, 255, 0.02) 0%, rgba(0, 0, 0, 0.25) 100%)',
    glassLight: 'linear-gradient(145deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.7) 100%)',
    
    // Ambient Gradients — Career Flow OS mesh
    ambient1: 'radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.12) 0px, transparent 45%)',
    ambient2: 'radial-gradient(at 100% 0%, rgba(34, 211, 238, 0.08) 0px, transparent 50%)',
    ambient3: 'radial-gradient(at 50% 100%, rgba(91, 33, 182, 0.1) 0px, transparent 55%)',
    ambient4: 'radial-gradient(at 80% 80%, rgba(16, 185, 129, 0.06) 0px, transparent 40%)',

    // Orb Gradients
    orb1: 'radial-gradient(circle, rgba(99, 102, 241, 0.35) 0%, transparent 70%)',
    orb2: 'radial-gradient(circle, rgba(34, 211, 238, 0.3) 0%, transparent 70%)',
    orb3: 'radial-gradient(circle, rgba(91, 33, 182, 0.35) 0%, transparent 70%)',
    orb4: 'radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, transparent 70%)',
  },
} as const;

export const persevexProductTokens = {
  color: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    primary: '#2563EB',
    success: '#16A34A',
    warning: '#EA580C',
    danger: '#DC2626',
    text: '#0F172A',
    muted: '#64748B',
    surfaceSecondary: '#F1F5F9',
    border: '#E2E8F0',
    darkBackground: '#020617',
    darkSurface: '#0F172A',
    darkSurfaceSecondary: '#1E293B',
    darkText: '#F8FAFC',
    darkTextSecondary: '#CBD5E1',
    darkMuted: '#94A3B8',
    darkBorder: '#334155',
  },
  spacing: [4, 8, 12, 16, 24, 32, 48],
  radius: {
    card: '18px',
    button: '12px',
    input: '12px',
  },
  motion: {
    fast: '150ms',
    base: '200ms',
    slow: '250ms',
  },
} as const;

// ============================================================================
// TYPOGRAPHY SYSTEM
// ============================================================================

export const typography = {
  // Font Families
  families: {
    sans: 'Inter, ui-sans-serif, system-ui, sans-serif',
    display: 'Sora, ui-sans-serif, system-ui, sans-serif',
    metric: 'Space Grotesk, ui-sans-serif, system-ui, sans-serif',
    mono: 'Space Grotesk, ui-sans-serif, system-ui, sans-serif',
  },

  // Font Sizes - Display Scale
  display: {
    hero: { size: '48px', lineHeight: '56px', weight: 700 },
    h1: { size: '36px', lineHeight: '44px', weight: 700 },
    h2: { size: '28px', lineHeight: '36px', weight: 600 },
    h3: { size: '22px', lineHeight: '28px', weight: 600 },
    h4: { size: '18px', lineHeight: '24px', weight: 600 },
  },

  // Font Sizes - Body Scale
  body: {
    large: { size: '16px', lineHeight: '24px', weight: 400 },
    base: { size: '14px', lineHeight: '20px', weight: 400 },
    small: { size: '12px', lineHeight: '16px', weight: 400 },
    xSmall: { size: '11px', lineHeight: '14px', weight: 500 },
  },

  // Font Sizes - Mono Scale
  mono: {
    large: { size: '14px', lineHeight: '20px', weight: 400 },
    base: { size: '12px', lineHeight: '16px', weight: 400 },
    small: { size: '11px', lineHeight: '14px', weight: 400 },
    xSmall: { size: '10px', lineHeight: '12px', weight: 500 },
  },

  // Letter Spacing
  letterSpacing: {
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
} as const;

// ============================================================================
// SPACING SYSTEM
// ============================================================================

export const spacing = {
  // Base Unit
  base: 4,

  // Scale
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
  '3xl': '64px',
  '4xl': '96px',
  '5xl': '128px',

  // Component Spacing
  components: {
    card: {
      padding: '24px',
      gap: '16px',
      borderRadius: '16px',
    },
    section: {
      padding: '32px',
      gap: '24px',
      borderRadius: '24px',
    },
    container: {
      padding: '48px',
      gap: '32px',
      borderRadius: '32px',
    },
  },
} as const;

// ============================================================================
// BORDER RADIUS
// ============================================================================

export const borderRadius = {
  none: '0',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  '3xl': '32px',
  full: '9999px',
} as const;

// ============================================================================
// SHADOWS
// ============================================================================

export const shadows = {
  // Glass Shadows
  glass: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05), 0 1px 4px rgba(0, 0, 0, 0.03)',
    md: '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.04)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.15), 0 10px 10px rgba(0, 0, 0, 0.04)',
  },

  // Glow Shadows
  glow: {
    emerald: '0 0 20px rgba(16, 185, 129, 0.3)',
    blue: '0 0 20px rgba(59, 130, 246, 0.3)',
    violet: '0 0 20px rgba(139, 92, 246, 0.3)',
    success: '0 0 20px rgba(16, 185, 129, 0.4)',
    warning: '0 0 20px rgba(245, 158, 11, 0.4)',
    error: '0 0 20px rgba(239, 68, 68, 0.4)',
  },

  // Inner Shadows
  inner: {
    sm: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)',
    md: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
    lg: 'inset 0 4px 8px rgba(0, 0, 0, 0.08)',
  },
} as const;

// ============================================================================
// ANIMATION TIMING
// ============================================================================

export const animation = {
  // Durations
  duration: {
    instant: '150ms',
    fast: '250ms',
    normal: '400ms',
    slow: '600ms',
    verySlow: '1000ms',
  },

  // Easing Functions
  easing: {
    easeOut: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
    easeInOut: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    elastic: 'cubic-bezier(0.68, -0.6, 0.32, 1.6)',
  },

  // Presets
  presets: {
    // Micro Interactions
    buttonHover: {
      duration: '250ms',
      easing: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
    },
    buttonPress: {
      duration: '150ms',
      easing: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
    },
    inputFocus: {
      duration: '200ms',
      easing: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
    },

    // Page Transitions
    pageEnter: {
      duration: '600ms',
      easing: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
    },
    tabSwitch: {
      duration: '300ms',
      easing: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
    },
    modalOpen: {
      duration: '400ms',
      easing: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
    },

    // Card Animations
    cardHover: {
      duration: '300ms',
      easing: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
    },
    cardFloat: {
      duration: '600ms',
      easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
    cardEnter: {
      duration: '400ms',
      easing: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
    },

    // Ambient Effects
    particleMove: {
      duration: '10000ms',
      easing: 'linear',
    },
    gradientMorph: {
      duration: '8000ms',
      easing: 'linear',
    },
    orbFloat: {
      duration: '6000ms',
      easing: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
    },
  },
} as const;

// ============================================================================
// Z-INDEX SCALE
// ============================================================================

export const zIndex = {
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
  notification: 1080,
  cursor: 9999,
} as const;

// ============================================================================
// TRANSITION PROPERTIES
// ============================================================================

export const transitions = {
  // Standard transitions
  standard: 'all 0.2s ease',
  fast: 'all 0.15s ease',
  slow: 'all 0.25s ease',

  // Property-specific transitions
  transform: 'transform 0.2s ease',
  opacity: 'opacity 0.2s ease',
  color: 'color 0.15s ease',
  shadow: 'box-shadow 0.2s ease',
  border: 'border-color 0.15s ease',
} as const;

// ============================================================================
// GLASSMORPHISM
// ============================================================================

export const glassmorphism = {
  // Legacy-compatible premium surfaces. Keep the export name for older imports,
  // but avoid blur-heavy glass in the current product direction.
  surface: {
    backdropBlur: '0',
    background: '#FFFFFF',
    border: '1px solid rgba(15, 23, 42, 0.08)',
  },

  light: {
    backdropBlur: '0',
    background: '#FFFFFF',
    border: '1px solid rgba(15, 23, 42, 0.08)',
  },

  heavy: {
    backdropBlur: '0',
    background: '#FFFFFF',
    border: '1px solid rgba(15, 23, 42, 0.1)',
  },
} as const;

// ============================================================================
// CAREER FLOW SPECIFIC
// ============================================================================

export const careerFlow = {
  // Journey stages — Career Flow OS
  journeyStages: ['training', 'internship', 'applications', 'interviews', 'placement'] as const,

  // Animation States (legacy)
  stages: ['training', 'internship', 'placement', 'growth'] as const,

  // Progress Colors — Career Flow OS
  progress: {
    training: '#6366f1',
    internship: '#7c3aed',
    applications: '#22d3ee',
    interviews: '#3b82f6',
    placement: '#10b981',
    growth: '#fbbf24',
  },

  // Particle Configuration
  particles: {
    count: 50,
    size: { min: 2, max: 6 },
    speed: { min: 0.5, max: 2 },
    opacity: { min: 0.3, max: 0.7 },
  },

  // Orb Configuration
  orbs: {
    count: 3,
    size: { min: 200, max: 400 },
    speed: { min: 0.2, max: 0.5 },
    blur: 60,
  },
} as const;

// ============================================================================
// EXPORT ALL TOKENS
// ============================================================================

export const tokens = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  animation,
  zIndex,
  transitions,
  glassmorphism,
  careerFlow,
} as const;
