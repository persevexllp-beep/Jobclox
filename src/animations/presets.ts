/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Persevex Animation Presets
 * 
 * Pre-built animation presets using Motion One for the Career Flow visual identity.
 * These presets implement the 10 crazy unique animations defined in the design strategy.
 */

import { animate, inView, scroll, spring, stagger } from 'motion';
import { tokens } from '../tokens';

// ============================================================================
// ANIMATION PRESETS
// ============================================================================

/**
 * 1. Liquid Cursor Effect
 * Cursor creates subtle liquid ripples in backgrounds
 */
export const liquidCursorPreset = {
  ripple: {
    scale: [0, 1],
    opacity: [1, 0],
    borderRadius: ['50%', '50%'],
    transition: {
      duration: 600,
      easing: 'ease-out',
    },
  },
  cursor: {
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 28,
    },
  },
};

/**
 * 2. Career Flow Background
 * Animated flowing particles representing careers moving through the platform
 */
export const careerFlowBackgroundPreset = {
  particle: {
    initial: { 
      opacity: 0,
      scale: 0,
    },
    animate: { 
      opacity: [0.3, 0.7, 0.3],
      scale: [1, 1.2, 1],
    },
    transition: {
      duration: 3000,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
  path: {
    initial: { 
      pathLength: 0,
      opacity: 0,
    },
    animate: { 
      pathLength: 1,
      opacity: 1,
    },
    transition: {
      duration: 2000,
      ease: 'easeInOut',
    },
  },
};

/**
 * 3. Dashboard Entrance Sequence
 * Cards float in, stagger, slightly rotate, settle naturally
 */
export const dashboardEntrancePreset = {
  container: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 400 },
  },
  card: {
    initial: { 
      opacity: 0,
      y: 40,
      rotate: 5,
    },
    animate: { 
      opacity: 1,
      y: 0,
      rotate: 0,
    },
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 15,
    },
  },
  stagger: {
    transition: {
      delayChildren: 0.1,
      staggerChildren: 0.1,
    },
  },
};

/**
 * 4. Morphing Gradient Orbs
 * Background blobs move slowly, merge, split, react to mouse movement
 */
export const morphingOrbsPreset = {
  orb: {
    initial: { 
      scale: 1,
      x: 0,
      y: 0,
    },
    animate: { 
      scale: [1, 1.2, 1],
      x: [0, 50, -50, 0],
      y: [0, -30, 30, 0],
    },
    transition: {
      duration: 8000,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
  merge: {
    initial: { scale: 1, opacity: 0.6 },
    animate: { 
      scale: [1, 1.5, 1],
      opacity: [0.6, 0.8, 0.6],
    },
    transition: {
      duration: 6000,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

/**
 * 5. Floating Glass Cards
 * Cards slightly levitate, react to cursor position, tilt in 3D
 */
export const floatingGlassCardsPreset = {
  levitate: {
    initial: { y: 0 },
    animate: { y: [-4, 4, -4] },
    transition: {
      duration: 4000,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
  tilt: {
    initial: { rotateX: 0, rotateY: 0 },
    hover: { 
      rotateX: -5,
      rotateY: 5,
      scale: 1.02,
    },
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 20,
    },
  },
  glow: {
    initial: { boxShadow: '0 0 0 rgba(16, 185, 129, 0)' },
    hover: { 
      boxShadow: '0 0 30px rgba(16, 185, 129, 0.3)',
    },
    transition: {
      duration: 300,
    },
  },
};

/**
 * 6. Job Card Hover Experience
 * Card expands slightly, glow activates, company logo animates, salary highlights, skills flow into view
 */
export const jobCardHoverPreset = {
  card: {
    initial: { scale: 1 },
    hover: { 
      scale: 1.02,
      borderColor: 'rgba(16, 185, 129, 0.5)',
    },
    transition: {
      duration: 300,
      ease: 'easeOut',
    },
  },
  glow: {
    initial: { opacity: 0 },
    hover: { 
      opacity: 1,
      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
    },
    transition: {
      duration: 300,
    },
  },
  logo: {
    initial: { scale: 1, rotate: 0 },
    hover: { 
      scale: 1.1,
      rotate: 5,
    },
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 20,
    },
  },
  salary: {
    initial: { opacity: 0.7 },
    hover: { 
      opacity: 1,
      color: '#10b981',
    },
    transition: {
      duration: 200,
    },
  },
  skills: {
    initial: { opacity: 0, y: 10 },
    hover: { 
      opacity: 1,
      y: 0,
    },
    transition: {
      duration: 200,
      delay: 100,
    },
  },
};

/**
 * 7. Sidebar Transformation
 * Sidebar morphs, compresses, transforms like Arc Browser
 */
export const sidebarTransformationPreset = {
  expand: {
    initial: { width: 64, opacity: 0.5 },
    animate: { 
      width: 256,
      opacity: 1,
    },
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
    },
  },
  collapse: {
    initial: { width: 256, opacity: 1 },
    animate: { 
      width: 64,
      opacity: 0.5,
    },
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
    },
  },
  icon: {
    initial: { scale: 1, rotate: 0 },
    animate: { 
      scale: [1, 1.2, 1],
      rotate: [0, 10, 0],
    },
    transition: {
      duration: 300,
      ease: 'easeOut',
    },
  },
  text: {
    initial: { opacity: 0, x: -10 },
    animate: { 
      opacity: 1,
      x: 0,
    },
    transition: {
      duration: 200,
      delay: 100,
    },
  },
};

/**
 * 8. AI Energy Effects
 * AI features have flowing energy, neon gradients, pulse effects
 */
export const aiEnergyEffectsPreset = {
  pulse: {
    initial: { scale: 1, opacity: 0.8 },
    animate: { 
      scale: [1, 1.05, 1],
      opacity: [0.8, 1, 0.8],
    },
    transition: {
      duration: 2000,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
  glow: {
    initial: { 
      boxShadow: '0 0 0 rgba(139, 92, 246, 0)',
    },
    animate: { 
      boxShadow: [
        '0 0 0 rgba(139, 92, 246, 0)',
        '0 0 20px rgba(139, 92, 246, 0.4)',
        '0 0 0 rgba(139, 92, 246, 0)',
      ],
    },
    transition: {
      duration: 2000,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
  gradient: {
    initial: { 
      backgroundPosition: '0% 50%',
    },
    animate: { 
      backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
    },
    transition: {
      duration: 3000,
      repeat: Infinity,
      ease: 'linear',
    },
  },
  particles: {
    initial: { 
      opacity: 0,
      scale: 0,
    },
    animate: { 
      opacity: [0, 0.6, 0],
      scale: [0, 1, 0],
    },
    transition: {
      duration: 1500,
      repeat: Infinity,
      ease: 'easeOut',
    },
  },
};

/**
 * 9. Career Progress Animation
 * Training → Internship → Placement → Growth as animated journey
 */
export const careerProgressPreset = {
  timeline: {
    initial: { width: 0 },
    animate: { width: '100%' },
    transition: {
      duration: 2000,
      ease: 'easeOut',
    },
  },
  stage: {
    initial: { 
      scale: 0.8,
      opacity: 0,
    },
    animate: { 
      scale: 1,
      opacity: 1,
    },
    transition: {
      type: 'spring',
      stiffness: 200,
      damping: 20,
    },
  },
  connection: {
    initial: { 
      pathLength: 0,
      opacity: 0,
    },
    animate: { 
      pathLength: 1,
      opacity: 1,
    },
    transition: {
      duration: 1000,
      ease: 'easeInOut',
    },
  },
  milestone: {
    initial: { scale: 0 },
    animate: { 
      scale: [0, 1.2, 1],
    },
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 15,
    },
  },
};

/**
 * 10. Success Moments
 * Premium celebration animations for job apply, profile completion, company verification
 */
export const successMomentsPreset = {
  burst: {
    initial: { 
      scale: 0,
      opacity: 1,
    },
    animate: { 
      scale: [0, 2, 0],
      opacity: [1, 0, 0],
    },
    transition: {
      duration: 600,
      ease: 'easeOut',
    },
  },
  ring: {
    initial: { 
      scale: 0.8,
      opacity: 0,
    },
    animate: { 
      scale: [0.8, 1.2, 1],
      opacity: [0, 1, 1],
    },
    transition: {
      type: 'spring',
      stiffness: 200,
      damping: 15,
    },
  },
  pulse: {
    initial: { 
      scale: 1,
      opacity: 1,
    },
    animate: { 
      scale: [1, 1.3, 1],
      opacity: [1, 0.5, 1],
    },
    transition: {
      duration: 800,
      repeat: 2,
      ease: 'easeOut',
    },
  },
  checkmark: {
    initial: { 
      pathLength: 0,
      opacity: 0,
    },
    animate: { 
      pathLength: 1,
      opacity: 1,
    },
    transition: {
      duration: 400,
      ease: 'easeOut',
      delay: 200,
    },
  },
  confetti: {
    initial: { 
      y: 0,
      opacity: 1,
      rotate: 0,
    },
    animate: { 
      y: -100,
      opacity: 0,
      rotate: 360,
    },
    transition: {
      duration: 1000,
      ease: 'easeOut',
    },
  },
};

// ============================================================================
// MICRO INTERACTION PRESETS
// ============================================================================

/**
 * Button Animations
 */
export const buttonPresets = {
  magnetic: {
    initial: { x: 0, y: 0 },
    hover: { 
      x: (mouseX: number) => mouseX * 0.1,
      y: (mouseY: number) => mouseY * 0.1,
    },
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 20,
    },
  },
  glow: {
    initial: { boxShadow: '0 0 0 rgba(16, 185, 129, 0)' },
    hover: { 
      boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)',
    },
    transition: {
      duration: 300,
    },
  },
  press: {
    initial: { scale: 1 },
    press: { 
      scale: 0.98,
    },
    transition: {
      duration: 150,
      ease: 'easeOut',
    },
  },
  ripple: {
    initial: { scale: 0, opacity: 1 },
    animate: { 
      scale: 4,
      opacity: 0,
    },
    transition: {
      duration: 600,
      ease: 'easeOut',
    },
  },
};

/**
 * Form Input Animations
 */
export const inputPresets = {
  focus: {
    initial: { borderColor: 'rgba(255, 255, 255, 0.08)' },
    focus: { 
      borderColor: 'rgba(16, 185, 129, 0.5)',
      boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.15)',
    },
    transition: {
      duration: 200,
      ease: 'easeOut',
    },
  },
  label: {
    initial: { y: 0, fontSize: '14px' },
    focus: { 
      y: -24,
      fontSize: '11px',
    },
    transition: {
      duration: 200,
      ease: 'easeOut',
    },
  },
  validation: {
    error: {
      animate: { 
        x: [0, -5, 5, -5, 5, 0],
      },
      transition: {
        duration: 400,
        ease: 'easeOut',
      },
    },
    success: {
      initial: { scale: 0, opacity: 0 },
      animate: { 
        scale: 1,
        opacity: 1,
      },
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 15,
      },
    },
  },
};

/**
 * Loading Animations
 */
export const loadingPresets = {
  skeleton: {
    initial: { opacity: 0.5 },
    animate: { 
      opacity: [0.5, 1, 0.5],
    },
    transition: {
      duration: 1500,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
  shimmer: {
    initial: { x: '-100%' },
    animate: { 
      x: '100%',
    },
    transition: {
      duration: 1500,
      repeat: Infinity,
      ease: 'linear',
    },
  },
  pulse: {
    initial: { opacity: 0.4 },
    animate: { 
      opacity: [0.4, 1, 0.4],
    },
    transition: {
      duration: 2000,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
  spinner: {
    initial: { rotate: 0 },
    animate: { 
      rotate: 360,
    },
    transition: {
      duration: 1000,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

// ============================================================================
// PAGE TRANSITION PRESETS
// ============================================================================

export const pageTransitionPresets = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 400 },
  },
  slideUp: {
    initial: { y: 20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -20, opacity: 0 },
    transition: { duration: 400 },
  },
  scaleIn: {
    initial: { scale: 0.95, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 1.05, opacity: 0 },
    transition: { duration: 400 },
  },
  blurIn: {
    initial: { filter: 'blur(10px)', opacity: 0 },
    animate: { filter: 'blur(0px)', opacity: 1 },
    exit: { filter: 'blur(10px)', opacity: 0 },
    transition: { duration: 400 },
  },
};

// ============================================================================
// EXPORT ALL PRESETS
// ============================================================================

export const animationPresets = {
  // 10 Crazy Unique Animations
  liquidCursor: liquidCursorPreset,
  careerFlowBackground: careerFlowBackgroundPreset,
  dashboardEntrance: dashboardEntrancePreset,
  morphingOrbs: morphingOrbsPreset,
  floatingGlassCards: floatingGlassCardsPreset,
  jobCardHover: jobCardHoverPreset,
  sidebarTransformation: sidebarTransformationPreset,
  aiEnergyEffects: aiEnergyEffectsPreset,
  careerProgress: careerProgressPreset,
  successMoments: successMomentsPreset,

  // Micro Interactions
  button: buttonPresets,
  input: inputPresets,
  loading: loadingPresets,

  // Page Transitions
  pageTransition: pageTransitionPresets,
} as const;
