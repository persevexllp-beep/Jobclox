# CandidateDashboard.tsx — JSX Hierarchy Audit

**Date:** 2026-06-09  
**File:** `src/components/CandidateDashboard.tsx`  
**Issue:** Vite/esbuild parse failure — adjacent JSX / unterminated expression at line 707

---

## Root JSX Hierarchy

```
return (
  <div>                                    // L298  ROOT — min-h-screen relative overflow-hidden
    <CareerFlowBackground />               // L300  self-closing
    <div>                                  // L302  INNER — max-w-7xl container (header + tabs)
      <motion.div>                         // L304  header block
        <GlassCard>
          <div> … stats … </div>           // L311, L327–347
        </GlassCard>
      </motion.div>                        // L349
      <motion.div>                         // L352  tab navigation
        <motion.button> … </motion.button> // ×4 (L358–408)
      </motion.div>                        // L409
    </div>                                 // L410  closes INNER (L302)

    {loading ? (                          // L414  ternary — sibling of INNER, still inside ROOT
      <SkeletonLoader … />                 // L415–423
    ) : (
      <>                                   // L425  fragment — non-loading tab content
        {activeTab === 'jobs' && (
          <motion.div> … </motion.div>     // L427–493
        )}
        {activeTab === 'applications' && (
          <motion.div> … </motion.div>     // L496–573
        )}
        {activeTab === 'profile' && (
          <motion.div> … </motion.div>     // L576–660
        )}
        {activeTab === 'emails' && (
          <motion.div> … </motion.div>     // L663–703
        )}
      </>                                  // L704
    )}                                     // L705

  </div>                                   // L706  closes ROOT (L298)
);                                         // L707
```

**Verified:** `return()` contains exactly **one** root JSX element — the outer `<div>` at line 298.

---

## Tag Mismatch Found

| Location | Tag | Expected | Actual |
|----------|-----|----------|--------|
| **L707 (before fix)** | `</div>` | None — ROOT already closed at L706 | **Extra closing `</div>`** |

### Balance check (before fix)

| Open | Line | Close | Line |
|------|------|-------|------|
| `<div>` ROOT | 298 | `</div>` | 706 ✓ |
| `<div>` INNER | 302 | `</div>` | 410 ✓ |
| `<>` fragment | 425 | `</>` | 704 ✓ |
| — | — | `</div>` | **707 ✗ EXTRA** |

All other structural tags (`motion.div`, `GlassCard`, conditionals, maps) were correctly nested within their parents. The only imbalance was the stray `</div>` after the root container had already closed.

---

## Exact Lines Changed

**Removed line 707** — the extra `</div>`.

```diff
         </>
       )}
     </div>
-  </div>
   );
 }
```

After fix, the file ends at lines 706–708:

```
    </div>   // closes ROOT (L298)
  );         // closes return
}            // closes function
```

---

## Why React/esbuild Reported Adjacent Elements

esbuild reported:

```
CandidateDashboard.tsx:707:8: ERROR: Unterminated regular expression
705|        )}
706|      </div>
707|    </div>
   |          ^
```

Once the ROOT `<div>` closed at line 706, the parser treated line 707’s `</div>` as **content outside the JSX tree**. In that position, `/` in `</div>` is parsed as the start of a **regular expression literal**, not a closing tag — hence “Unterminated regular expression” rather than the more common “Adjacent JSX elements” wording.

Both errors share the same root cause: **one closing tag too many**, which pops the JSX stack past the single allowed root and leaves orphaned syntax at the `return` level.

---

## Build & Lint Results

### `npm run build` — **PASS** ✓

```
✓ 2741 modules transformed.
✓ built in 5.94s
dist/server.cjs — Done
```

No JSX parser errors. `CandidateDashboard.tsx` compiles successfully.

### `npm run lint` — **FAIL** (pre-existing TypeScript issues, not JSX)

`tsc --noEmit` reports errors unrelated to JSX structure:

- `services/applicationService.ts` — type assertion issues (×3)
- `src/components/CandidateDashboard.tsx` — undefined identifiers (`searchQuery`, `handleApply`, `saving`, etc.) and type mismatches on `CandidateProfile` / `Application`
- `src/components/motion/AnimatedButton.tsx` — Motion `animate` prop typing

These are **TypeScript semantic errors**, not JSX hierarchy problems. They were not modified in this fix per scope: JSX structure only, no business-logic or UI changes.

---

## Summary

| Check | Status |
|-------|--------|
| Single root JSX element | ✓ |
| All tags balanced | ✓ (after removing L707) |
| JSX parser / Vite build | ✓ Pass |
| UI / animation changes | None |
| Lines modified | 1 removed (`</div>` at former L707) |

**Conclusion:** The JSX hierarchy is valid. The build blocker was a single extra `</div>` after the root container close.
