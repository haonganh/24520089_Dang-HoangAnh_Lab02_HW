# Task Decomposition — Homework 3: High-Concurrency Flash-Sale E-Commerce Engine

**Course:** Web Application Development (Practical)  
**Duration:** One week  
**Standard:** WCAG 2.2 Level AA  
**Assignment:** Vietnam flash-sale simulation (11.11 / midnight promotion)  
**Companion rules:** [`ai_rule.md`](./ai_rule.md)  
**Mandatory audit:** `AI_FAILURE_AUDIT.md` with **at least three evidenced AI flaws**  
**Mandatory Git history:** **at least eight discrete Conventional Commits**

> **Project goal:** Implement a flash-sale e-commerce simulation with a `Date.now()`-based anti-drift millisecond countdown driven by `requestAnimationFrame()`, plus an optimistic inventory reservation/checkout state machine. Prioritize deterministic correctness, accessibility, and an auditable Git history.
>
> **Scope:** Browser-side simulation is suitable for this homework. Real multi-user stock correctness would require backend atomic transactions/conditional updates and authoritative deadlines; do not describe the client prototype as providing those guarantees.

## 1. Instructor Requirements and Acceptance Matrix

| ID | Instructor requirement | Acceptance evidence |
|---|---|---|
| R1 | Vietnam Mega-Sale scenario | Shop/catalog, VND pricing, sale timer, stock/checkout flow |
| R2 | Zero-drift timer using `Date.now()` delta | A fixed deadline; `requestAnimationFrame` ticks; drift/background tests |
| R3 | Optimistic inventory lock as finite state machine | Explicit legal transitions, no negative stock, rollback and checkout tests |
| R4 | AI failure mode audit | `AI_FAILURE_AUDIT.md` describing **≥ 3** authentic AI flaws, DevTools/test evidence, and fixes |
| R5 | Atomic Conventional Commits | **≥ 8 real commits** with distinct focused diffs and valid prefixes |
| R6 | WCAG 2.2 Level AA | Keyboard, screen reader, focus, contrast, zoom/reflow, status, time-limit checks |

### Required Timer API

Preserve the instructor's exported function name and parameters:

```ts
// src/timer/anti-drift-timer.ts
export function createAntiDriftTimer(
  durationMs: number,
  onTick: (remaining: number) => void
) {
  const targetTime = Date.now() + durationMs;
  let rafId: number;

  function tick() {
    const remaining = Math.max(0, targetTime - Date.now());
    onTick(remaining);
    if (remaining > 0) {
      rafId = requestAnimationFrame(tick);
    }
  }

  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}
```

This is the **instructor-style baseline**. Implementation should additionally validate inputs, handle idempotent cleanup/restart, and consider zero-duration behavior. The target is recomputed from wall time rather than decremented per callback; system-clock changes remain a known limitation.

## 2. Proposed Technical Structure

Use **React + TypeScript + Vite** unless the instructor supplies a different starter project. Test logic with **Vitest**; use React Testing Library and a browser automation tool if time permits.

```text
Homework_3/
├── ai_rule.md
├── task_decomposition.md
├── AI_FAILURE_AUDIT.md             # Required before submission
├── README.md                        # Final documentation
└── app/
    ├── public/
    ├── src/
    │   ├── timer/
    │   │   ├── anti-drift-timer.ts
    │   │   └── anti-drift-timer.test.ts
    │   ├── inventory/
    │   │   ├── inventory-types.ts
    │   │   ├── inventory-reducer.ts
    │   │   └── inventory-reducer.test.ts
    │   ├── components/
    │   │   ├── CountdownTimer.tsx
    │   │   ├── ProductCard.tsx
    │   │   ├── InventoryStatus.tsx
    │   │   └── CheckoutPanel.tsx
    │   ├── data/
    │   │   └── products.ts
    │   ├── App.tsx
    │   ├── App.css
    │   └── index.css
    ├── package.json
    └── index.html
```

**Architecture:** `timer utility → countdown UI`; `product fixtures → inventory reducer/state transitions → reservation and checkout UI`; tests and the failure audit cross-cut all components.

## 3. Ordered Implementation Tasks

### T00 — Repository and Documentation Setup

- [ ] Confirm repository root with `git rev-parse --show-toplevel` and check `git status`.
- [ ] Create `Homework_3/` without altering `Homework_1/` or `Homework_2/`.
- [ ] Add `ai_rule.md` and `task_decomposition.md` to `Homework_3/`.
- [ ] Confirm `.gitignore` protects `node_modules/`, `dist/`, `.env` and secrets.
- [ ] Commit the two documents as one coherent documentation change.

**Done when:** Markdown files are in the correct folder, linked to each other, and tracked by Git.  
**Commit 1:** `docs(hw3): add AI rules and task decomposition`

### T01 — Scaffold React + TypeScript and Accessible Layout

- [ ] Scaffold Vite React + TypeScript into `Homework_3/app/`.
- [ ] Install dependencies, inspect actual script names and paths, and run `npm run build`.
- [ ] Set `index.html` language (`lang="en"` unless the UI is primarily Vietnamese) and descriptive page title.
- [ ] Create semantic landmarks: header, main, product section, checkout section; use a logical heading hierarchy.
- [ ] Add responsive CSS with visible focus, readable font sizes, and WCAG-aware color tokens.

**Done when:** Dev server renders cleanly at desktop and narrow mobile widths; TypeScript build passes.  
**Commit 2:** `chore(hw3): initialize React TypeScript flash sale app`

### T02 — Anti-Drift Timer Utility

- [ ] Create `src/timer/anti-drift-timer.ts` with the **exact instructor function signature**.
- [ ] Capture `targetTime = Date.now() + durationMs` once and calculate each remaining time from `targetTime - Date.now()`.
- [ ] Schedule updates using `requestAnimationFrame()`; **do not** decrement a counter using `setInterval()`.
- [ ] Clamp remaining milliseconds to zero and guarantee the final completion signal once.
- [ ] Return a cleanup function and cancel pending animation frames when stopping or restarting.
- [ ] Validate zero/negative/non-finite durations; document expected behavior for a clock adjustment.

**Done when:** Utility has deterministic behavior and does not create orphaned animation loops.  
**Commit 3:** `feat(hw3): implement Date now anti drift countdown`

### T03 — Timer React Component and Time Accessibility

- [ ] Implement `CountdownTimer.tsx` using the timer utility in an effect with cleanup.
- [ ] Show hours/minutes/seconds and, where helpful, milliseconds; never display negative values.
- [ ] Show the sale deadline and the user's local time context; consider `Asia/Ho_Chi_Minh` for fixed campaign data.
- [ ] Start, restart, or expire the countdown without duplicate animation frames.
- [ ] Prefer `role="timer"` / `aria-live="off"` for rapidly changing time; announce sale start/end separately via a polite status region.
- [ ] Respect reduced motion and avoid flashing, unnecessary auto-focus or announcements each frame.
- [ ] Clearly communicate any time limit and evaluate WCAG 2.2.1 Timing Adjustable / exceptions.

**Done when:** Timer survives foreground/background transitions and is usable with keyboard/screen reader.  
**Commit 4:** `feat(hw3): add accessible flash sale countdown`

### T04 — Inventory Model and Finite-State Machine

- [ ] Define product type (`id`, `name`, `priceVnd`, `initialStock`, etc.) with stable IDs.
- [ ] Define reservation state and typed events. Suggested flow: `available → reserved → checking_out → purchased`; allowed rollback to available on cancel, expiration or checkout failure.
- [ ] Document a transition table: event, allowed source states, next state, stock delta, invalid-event behavior.
- [ ] Build a **pure reducer** or equivalent central event processor; prohibit negative stock, duplicate sell/rollback and invalid transitions.
- [ ] Enforce the simulation invariant: `available + reserved + sold === initialStock`.
- [ ] Store reservation ID, product ID, deadline and request ID; avoid mutable shared counters and React index keys.

**Done when:** State transitions are explicit, consistent, and testable independently of UI.  
**Commit 5:** `feat(hw3): implement inventory reservation state machine`

### T05 — Optimistic Reservation and Concurrency Simulation

- [ ] Add a **Reserve** action with immediate UI feedback and controlled inventory decrement.
- [ ] Disable/deduplicate conflicting actions while a reservation is pending; validate quantity and remaining stock.
- [ ] Simulate asynchronous API confirmations/failures with a clear deterministic test adapter (no real payments).
- [ ] Correlate responses with reservation IDs; ignore stale/duplicate/late confirmations safely.
- [ ] Implement cancellation and reservation expiry with idempotent release of stock.
- [ ] Stress-test many nearly simultaneous requests within the app's defined scope; verify first-come transitions, no overselling, and exact stock invariants.
- [ ] Explicitly document why client-only logic is insufficient to guarantee multi-user atomicity; describe server-side conditional updates for production.

**Done when:** Rapid clicks and simulated request races never make local stock negative or double-purchase a reservation.  
**Commit 6:** `feat(hw3): handle optimistic stock reservations`

### T06 — Checkout State Machine and Failure Recovery

- [ ] Implement a clear checkout confirmation panel with item, quantity and total price formatted in VND.
- [ ] Permit checkout only from a valid, unexpired reservation; distinguish checking out, completed, failed and cancelled states.
- [ ] On success, transfer reserved stock to sold exactly once.
- [ ] On failure, timeout or cancellation, return stock exactly once according to documented policy.
- [ ] Prevent repeated submission while a checkout request is in flight; handle late responses after cancellation.
- [ ] Provide review/confirmation and comprehensible feedback; never request real card data.

**Done when:** Checkout transitions and rollback are deterministic under success, failure and repeated actions.  
**Commit 7:** `feat(hw3): implement checkout and reservation rollback`

### T07 — Flash-Sale Interface and Responsive Behavior

- [ ] Render sample Vietnam sale products, clear stock counts, sold-out states and VND prices.
- [ ] Show the status of a reservation (remaining time, expiry, success, failure) without depending on color alone.
- [ ] Use native labelled buttons and form elements; preserve focus after UI changes.
- [ ] Avoid layout shifts that hide the active controls; make the checkout flow usable at 320 CSS px equivalent and 200–400% zoom.
- [ ] Use pointer targets meeting WCAG 2.5.8 and visible focus styles; keep mobile and desktop interaction consistent.

**Done when:** A keyboard-only user can reserve, cancel, complete checkout and recover from errors.  
**Commit 8:** `style(hw3): improve accessible flash sale layout`

### T08 — Automated Unit and Concurrency Tests

- [ ] Test timer initial duration, final zero, cleanup, repeated start, delayed frames and background-tab return using fake clock and RAF mocks.
- [ ] Test inventory transition table and invariants for success, cancel, failure, expiry and out-of-stock.
- [ ] Test rapid repeated reserve/checkout actions and late/cancelled responses; check zero overselling in the simulation scope.
- [ ] Add component-level keyboard, accessible-name and status-message tests as feasible.
- [ ] Run `npx vitest run` (or the project's actual test script) and `npm run build`.
- [ ] Record the **actual** test output; do not replace missing output with invented green results.

**Done when:** Core scenarios pass, with failures investigated and corrected.  
**Commit 9:** `test(hw3): cover timer stock invariants and races`

### T09 — WCAG 2.2 AA Audit and Remediation

- [ ] Keyboard-only: Tab/Shift+Tab, button activation, checkout, cancellation, error recovery, focus order and no keyboard traps.
- [ ] Screen reader: label/role/value, sale timer context, stock changes, reservation/checkout announcements; no per-frame announcement spam.
- [ ] Check text contrast ≥ 4.5:1, large text ≥ 3:1, and non-text component contrast ≥ 3:1 when applicable.
- [ ] Confirm visible focus, minimum pointer targets/spacing, color-independent status, input labels and error messages.
- [ ] Test 200% zoom, 320px reflow, text spacing, reduced motion and no obscured focused elements.
- [ ] Audit time-limit fairness under WCAG 2.2.1; make restrictions and available extensions/exceptions explicit.
- [ ] Run Lighthouse against the **production preview**; also run manual accessibility tests. Record measured scores without claiming that a 100/100 score proves conformance.

**Done when:** Identified accessibility failures are fixed or transparently documented, with evidence.  
**Commit 10:** `fix(hw3): remediate accessibility audit findings`

### T10 — Required AI Failure Mode Audit and Refactoring

- [ ] Create **`Homework_3/AI_FAILURE_AUDIT.md`** using the instructor's sample structure.
- [ ] Inspect the **actual generated code**, not generic examples, for at least **three independent** AI flaws (security, race handling, state correctness, accessibility, timer cleanup, rendering, or React keys).
- [ ] For each entry include: AI Prompt, AI-Generated Code, Risk, Detection via DevTools/tests, Engineering Refactor, and before/after verification.
- [ ] Include observed error messages/screenshots or explicitly state `NOT YET VERIFIED` where evidence is pending.
- [ ] Implement the repairs in the application; rerun tests, check UI and document outcomes.
- [ ] Do not invent `innerHTML` XSS, memory leaks, or any other defect that the implementation does not actually exhibit.

**Done when:** At least three defensible AI failures and remediation steps are recorded, with reproducible proof where available.  
**Commit 11:** `docs(hw3): add evidenced AI failure mode audit`

### T11 — Final Validation and GitHub Submission

- [ ] Create a concise `README.md` with project purpose, installation, scripts, state transitions, simulation limitations, accessibility notes, and tests.
- [ ] Run clean build and test commands; fix unresolved TypeScript errors and console exceptions.
- [ ] Run production preview, verify reserve/checkout/countdown, and record available performance/DevTools evidence.
- [ ] Ensure `ai_rule.md`, `task_decomposition.md`, and `AI_FAILURE_AUDIT.md` are tracked.
- [ ] Inspect `git status`, `git log --oneline`, and `git remote -v`.
- [ ] Verify **at least eight** focused Conventional Commits are truly present; do not squash them into one commit.
- [ ] Push to the correct GitHub remote and verify `Homework_3/` appears on the target branch.
- [ ] Submit the repository URL and any evidence/format explicitly required by the instructor.

**Done when:** Homework 3 is reproducible, auditable and visible in the intended GitHub repository.  
**Commit 12:** `docs(hw3): finalize submission instructions`

## 4. Legal State Transitions and Critical Invariants

| State | Event | Next state | Expected stock effect |
|---|---|---|---|
| `available` | Valid reserve | `reserved` | `available - quantity; reserved + quantity` |
| `reserved` | Begin checkout | `checking_out` | No stock delta; units still held |
| `reserved` | Cancel / expire | `available` | `reserved - quantity; available + quantity` |
| `checking_out` | Confirm purchase | `purchased` | `reserved - quantity; sold + quantity` |
| `checking_out` | Failed / cancelled checkout | `available` | `reserved - quantity; available + quantity` |
| `purchased` | Duplicate confirmation | `purchased` | No further change (idempotent) |
| Any invalid source state | Disallowed event | Unchanged / rejected | No change |

For multi-item inventory, apply the stock invariant **per product**. These states describe an individual reservation lifecycle; aggregate product stock remains separate. A reservation timeout policy must state what happens if checkout already began, rather than silently releasing held units.

## 5. WCAG 2.2 AA Checklist by User Journey

| Journey | Required accessibility check | Example criteria |
|---|---|---|
| Read sale and countdown | Timer label and understandable deadline; no announcements every 16ms | 1.3.1, 4.1.3, 2.2.1 |
| Browse products | Headings, accessible names, available stock not color-only | 1.3.1, 1.4.1, 1.4.3 |
| Reserve a product | Keyboard access, focus visible, non-obscured focus, target size | 2.1.1, 2.4.7, 2.4.11, 2.5.8 |
| Receive reservation result | Polite status announcements; clear errors | 3.3.1, 4.1.3 |
| Checkout | Labels, predictable actions, duplicate-action prevention, clear result | 2.1.1, 3.3.2, 3.3.4 when applicable |
| Mobile / zoom / low motion | Content reflows and remains operable; motion is not required | 1.4.4, 1.4.10, 1.4.12 |

**Important:** WCAG conformance must be evaluated against the rendered interface and user flows. A Lighthouse score is an automated signal, not proof of complete compliance.

## 6. One-Week Execution Plan

| Day | Deliverables | Commit targets |
|---|---|---|
| 1 | T00–T01: setup and scaffold | 1–2 |
| 2 | T02–T03: timer utility and accessible display | 3–4 |
| 3 | T04–T05: state machine and reservation concurrency | 5–6 |
| 4 | T06–T07: checkout and responsive UI | 7–8 |
| 5 | T08: automated timer/inventory/concurrency tests | 9 |
| 6 | T09–T10: WCAG audit and AI failure remediation | 10–11 |
| 7 | T11: final verification, docs, GitHub submission | 12 |

> The twelve example commits above exceed the **instructor's minimum of eight**. They must correspond to real incremental changes; never create empty or misleading commits solely to satisfy a count.

## 7. Definition of Done

- [ ] Flash-sale experience visibly simulates a Vietnam promotional event with correct VND formatting.
- [ ] Timer matches the required `createAntiDriftTimer` API, calculates `Date.now()` remaining time, uses RAF, cleans up and stops at zero.
- [ ] Inventory transitions are typed, legal, idempotent and tested against rapid concurrent interactions; no local stock invariant violations.
- [ ] Reservations can expire or be cancelled; checkout success/failure produces consistent stock results.
- [ ] Keyboard and screen-reader flows are manually verified; WCAG 2.2 AA issues are fixed or reported honestly.
- [ ] Tests and production build pass with documented results.
- [ ] `AI_FAILURE_AUDIT.md` contains at least **three authentic, code-grounded AI failures**, risk, detection and refactor evidence.
- [ ] Git has **at least eight meaningful Conventional Commits**, and the correct homework folder is pushed to GitHub.
- [ ] No fake Lighthouse scores, performance claims, audit evidence or source-code fixes are reported.

## 8. References

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [WAI Understanding WCAG 2.2](https://www.w3.org/WAI/WCAG22/understanding/)
- [WAI-ARIA `timer` role](https://www.w3.org/TR/wai-aria-1.2/#timer)
- [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
