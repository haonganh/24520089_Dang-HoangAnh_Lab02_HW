# Task Decomposition — Homework 2: Concurrent FIFO Audio Visualizer Queue Engine

> **Course:** Web Application Development (Practical)  
> **Time box:** 1 week  
> **Implementation target:** React + TypeScript + Vite (recommended, not mandated by the slide)  
> **Accessibility standard:** WCAG 2.2 Level AA  
> **AI operating rules:** [ai_rule.md](./ai_rule.md)

## 0. Assignment scope and definition of done

### Instructor's explicit requirements

1. **Web Audio Engine:** integrate the Web Audio API using `AnalyserNode`; FFT size **256 or 512**.
2. **Concurrency Controller:** implement a **FIFO queue** that handles multiple incoming track download and audio decoding requests.
3. **Memory Safety:** explicitly clean up `AudioBufferSourceNode` instances and support cancellation with `AbortController`.
4. **Visualization Performance:** draw with **Canvas or SVG** using `requestAnimationFrame` and target **60 FPS** without excessive React state updates.
5. **Required code contract:** an exported `AudioTaskQueue` class with `enqueue(trackUrl: string): Promise<AudioBuffer>`, and internal queue/processing/controller fields consistent with the slide.

### Additional project quality target

Design and manually verify the application against applicable **WCAG 2.2 Level AA** criteria. WCAG does not define a single automatic “pass”; testing evidence is part of the deliverable. This requirement is part of this project's working standard, not a claim that the Homework 2 slide explicitly mandates a Lighthouse 100 score.

### Scope interpretation and assumptions

- Many callers may invoke `enqueue(...)` concurrently, while one FIFO worker handles **one active fetch/decode job at a time**. This matches the screenshot's `isProcessing` design; parallel downloads are **not** assumed unless the instructor clarifies.
- The queue's job is download/decode; the audio engine's job is playback/visualization. Keep them separate.
- Use a few legal, testable audio files served from `public/audio/` or a CORS-enabled URL for the first version. Do not assume third-party URLs are universally fetchable.
- Implement local file loading only if time allows or explicitly required; don't sacrifice FIFO, cancellation, or cleanup.
- Build the smallest correct solution first; polish later.

### Final acceptance checklist

- [ ] Application builds without TypeScript errors.
- [ ] Queue starts tasks in FIFO order under multiple rapid enqueue calls.
- [ ] A failed, canceled, or invalid task never blocks the next task.
- [ ] Queued and active cancellations settle the relevant promises correctly.
- [ ] `AudioContext`, `AnalyserNode`, source nodes, and decoded buffers are handled safely.
- [ ] Audio plays from a user action; play/pause/stop work.
- [ ] The visualizer uses FFT 256 or 512 and `requestAnimationFrame`.
- [ ] Animation targets 60 FPS and avoids React re-rendering each frame; measured results are documented.
- [ ] Animation stops on pause/unmount and respects reduced-motion preferences.
- [ ] Accessible controls, error/status text, and nonvisual visualizer information are present.
- [ ] Keyboard, screen-reader, contrast, reflow, and focus tests have been performed.
- [ ] README, test evidence, and GitHub repository are ready for submission.

---

## T00 — Repository and requirements baseline

**Priority:** P0 | **Depends on:** None  
**Deliverables:** `Homework_2/ai_rule.md`, `Homework_2/task_decomposition.md`, project folder, first commit.

- [ ] Create `Homework_2/` beside `Homework_1/` (or follow the instructor's repository naming requirement).
- [ ] Save both Markdown files and review the slide requirements.
- [ ] Confirm whether the existing Git repository should contain both homework folders; do not run `git init` inside a nested project accidentally.
- [ ] Record the implementation decision: sequential FIFO worker with concurrently arriving requests.
- [ ] Ensure `.gitignore` excludes `node_modules/`, `dist/`, and secrets.
- [ ] Check `git status` and identify the actual repository root.

**Acceptance:** Both `.md` files are present in the Homework 2 directory and the intended repository is known.

**Suggested commit:** `docs(hw2): add AI rules and implementation plan`

## T01 — Scaffold React + TypeScript application

**Priority:** P0 | **Depends on:** T00  
**Deliverables:** Vite app, type-checking, basic accessible UI shell.

- [ ] In `Homework_2/`, run `npm create vite@latest app -- --template react-ts` (only if the app does not exist).
- [ ] Run `cd app`, `npm install`, then `npm run dev`.
- [ ] Remove starter logos/demo styles and set a meaningful page `<title>`.
- [ ] Create an application shell with `<main>`, `<h1>`, and clear descriptions.
- [ ] Build with `npm run build`.

**Acceptance:** The application renders, builds, and can be started from the `app/` directory.

**Suggested commit:** `chore(hw2): scaffold React TypeScript audio app`

## T02 — Define audio task types and FIFO queue contract

**Priority:** P0 | **Depends on:** T01  
**Deliverables:** `src/audio/audio-queue-controller.ts`, typed internal `AudioTask`.

- [ ] Export `class AudioTaskQueue` and preserve `enqueue(trackUrl: string): Promise<AudioBuffer>`.
- [ ] Define a typed task record containing a stable ID, URL, controller, resolve/reject callbacks, and task state.
- [ ] Maintain `queue`, `isProcessing`, and `activeController` (or equivalent internal invariants without changing the public contract).
- [ ] Choose how to receive/use `AudioContext` for decoding (e.g., dependency injection in constructor).
- [ ] Validate nonempty, supported input URLs; surface useful error messages.
- [ ] Plan `cancel(taskId)`, `cancelAll()`, and `dispose()` without changing required `enqueue`.
- [ ] Define expected state progression: `queued -> downloading -> decoding -> completed`, with failure/cancellation branches.

**Acceptance:** All types compile; the public contract remains consistent with the slide; queue invariants are documented.

**Suggested commit:** `feat(hw2): define typed audio queue contract`

## T03 — Implement FIFO downloads and decoding

**Priority:** P0 | **Depends on:** T02  
**Deliverables:** Working queue implementation.

- [ ] `enqueue()` appends each task and triggers the worker.
- [ ] `processNext()` uses an ownership guard to allow **one active task**.
- [ ] Process the oldest waiting task first, using `shift()` or an equivalent FIFO structure.
- [ ] Fetch with `fetch(trackUrl, { signal })`; check `response.ok`.
- [ ] Read an `ArrayBuffer`, then call `audioContext.decodeAudioData(arrayBuffer)`.
- [ ] Resolve with the resulting `AudioBuffer` on success.
- [ ] Reject on network, HTTP, CORS, unsupported format, or decode failure.
- [ ] Use `try/catch/finally` so a failed task cannot stall the queue.
- [ ] Ensure promises settle once and the worker continues after failures.

**Acceptance:** Three enqueues made rapidly begin in FIFO order and produce usable buffers for valid files; invalid input does not block later tasks.

**Suggested commit:** `feat(hw2): implement FIFO audio download and decode worker`

## T04 — Implement cancellation and disposal safely

**Priority:** P0 | **Depends on:** T03  
**Deliverables:** Abort/cleanup API, cancellation tests.

- [ ] Associate an `AbortController` with every queued task.
- [ ] Cancel a **waiting** task: remove/invalidate it and reject its promise with a distinguishable cancellation result.
- [ ] Cancel an **active fetch**: call `controller.abort()` and let the worker finish cleanup before starting the next task.
- [ ] Handle cancellation during **decode**: recognize that `decodeAudioData()` is not abortable; ignore its late result and reject or preserve the existing cancellation rejection exactly once.
- [ ] `cancelAll()` settles waiting tasks and cancels the active task.
- [ ] `dispose()` prevents new enqueues and frees queue references.
- [ ] Guard against race conditions: cancel-before-start, cancel-during-fetch, cancel-during-decode, repeated cancel, and cancellation after completion.

**Acceptance:** All cancellation cases settle promises; no canceled track starts playing; later queued tracks still process; no unhandled promise rejections.

**Suggested commit:** `fix(hw2): implement robust AbortController cancellation`

## T05 — Build the playback engine and audio graph

**Priority:** P0 | **Depends on:** T03 (coordinate with T04)  
**Deliverables:** `src/audio/audio-engine.ts`.

- [ ] Create/resume the `AudioContext` only when user interaction permits playback.
- [ ] Create one `AnalyserNode` and set `fftSize` to **256 or 512**.
- [ ] Connect graph deliberately: `source -> analyser -> gain -> destination` (or equivalent).
- [ ] Decode using the queue and create a **fresh** `AudioBufferSourceNode` for each playback.
- [ ] Implement `play(buffer)`, `pause()`, `resume()`, and `stop()` with defined lifecycle semantics.
- [ ] Safely handle `onended`, repeated stop, track replacement, and attempts to play before data is ready.
- [ ] Disconnect and drop old source references; close the owned context on final disposal.
- [ ] Expose a read-only analyser reference to the visualization layer without per-frame React state.

**Acceptance:** Loaded audio can be played, paused, resumed, and stopped without duplicate playback or exceptions in the console.

**Suggested commit:** `feat(hw2): implement Web Audio playback engine`

## T06 — Create the 60 FPS-targeted visualizer

**Priority:** P0 | **Depends on:** T05  
**Deliverables:** `src/components/AudioVisualizer.tsx`, styles.

- [ ] Use `<canvas>` (simpler per-frame drawing) or an efficient SVG strategy.
- [ ] Allocate `Uint8Array(analyser.frequencyBinCount)`; confirm **128 bins for FFT 256** and **256 bins for FFT 512**.
- [ ] Each frame: obtain frequency data, clear the drawing region, and draw bars or a frequency curve.
- [ ] Start exactly one `requestAnimationFrame` loop; keep frame ID in a ref.
- [ ] Do not `setState` 60 times per second for the frequency data.
- [ ] Handle canvas dimensions and device pixel ratio during resize.
- [ ] Stop animation when paused, disabled, hidden (as practical), or unmounted.
- [ ] Provide a visualizer pause/resume toggle independent from audio playback.
- [ ] Respect `prefers-reduced-motion`; render a static state or textual alternative when reduced motion is requested.

**Acceptance:** Bars react to playing audio; no duplicate RAF loops or runaway React renders; no drawing continues after unmount.

**Suggested commit:** `feat(hw2): add requestAnimationFrame frequency visualizer`

## T07 — Build accessible queue and player controls

**Priority:** P0 | **Depends on:** T04–T06  
**Deliverables:** `src/components/AudioPlayerControls.tsx`, queue display integrated in `App.tsx`.

- [ ] Provide a labeled track URL field and Add to Queue button (or a safe local test-track selector).
- [ ] Display pending tasks with a stable ID, visible status, and a dedicated Cancel button.
- [ ] Add Play, Pause/Resume, Stop, volume/mute, and Pause/Resume Visualization buttons as appropriate.
- [ ] Use native buttons, labels, list semantics, and consistent disabled states.
- [ ] Provide `role="status"` or an appropriate `aria-live="polite"` area for queue changes and useful playback updates.
- [ ] Provide visible loading/error text and retry guidance.
- [ ] Keep keyboard focus predictable when queue entries disappear; do not trap focus.
- [ ] Never display an untrusted track name with `innerHTML`.

**Acceptance:** All actions work with keyboard only; screen readers can identify controls and queue task statuses.

**Suggested commit:** `feat(hw2): add accessible player and queue interface`

## T08 — Accessible visualization and WCAG 2.2 AA styling

**Priority:** P0 | **Depends on:** T06–T07  
**Deliverables:** Accessible visualizer description, responsive styles.

- [ ] Give the Canvas/SVG visualization a meaningful accessible name or provide an adjacent textual explanation.
- [ ] Provide nonvisual summaries of useful signal information (e.g., overall activity and coarse low/mid/high frequency activity) when they communicate meaningful content; **throttle** live updates to avoid screen-reader spam.
- [ ] Do not use color alone for play/pause/error/queue state.
- [ ] Confirm text contrast >= **4.5:1** for normal text and >= **3:1** for large text, with applicable WCAG exceptions.
- [ ] Confirm non-text UI indicators >= **3:1** where applicable.
- [ ] Provide obvious `:focus-visible` styles and keyboard-accessible toggles.
- [ ] Prefer >= **44×44 px** controls; satisfy WCAG 2.5.8's **24×24 CSS px** threshold or documented exceptions.
- [ ] Test **200%/400% zoom**, a **320 CSS px** viewport, text resizing, and reduced motion.
- [ ] Check focus is not completely obscured by overlays or sticky controls.
- [ ] Validate input labels, error text, accessible names, and status messages.

**Acceptance:** The visualizer has a useful nonvisual alternative; keyboard and responsive behavior pass manual checks; no known contrast failures remain.

**Suggested commit:** `style(hw2): improve visual accessibility and responsive layout`

## T09 — Automated unit and integration tests

**Priority:** P0 | **Depends on:** T04–T08  
**Deliverables:** Test suite; reproducible test commands.

- [ ] Add a lightweight test stack (such as Vitest; React Testing Library where useful).
- [ ] Mock `fetch`, `AbortController` behavior, `AudioContext`, and `decodeAudioData` as needed.
- [ ] Test rapid enqueues: start order = A, B, C; active job count never exceeds 1.
- [ ] Test network error, HTTP failure, decode failure, and queue progression.
- [ ] Test cancellation of waiting, fetching, and decoding jobs.
- [ ] Test `cancelAll`, `dispose`, repeated cancel, and promise settlement.
- [ ] Test track replacement and old-source cleanup.
- [ ] Verify RAF cancellation on visualization pause/unmount; ensure no animation-created listener leaks.
- [ ] Test accessible labels/buttons and readable status in UI.

**Acceptance:** Automated tests pass and include negative/cancellation cases; `npm run build` remains successful.

**Suggested commit:** `test(hw2): cover FIFO cancellation and audio cleanup`

## T10 — Browser performance, memory, and accessibility audit

**Priority:** P0 | **Depends on:** T09  
**Deliverables:** Saved measurements, screenshots/reports, defects log.

- [ ] Test supported browser(s) in a production build: `npm run build && npm run preview` (run from `app/`).
- [ ] Use Chrome DevTools **Network**: verify FIFO request start ordering, HTTP responses, abort behavior, and CORS errors.
- [ ] Use DevTools **Performance**: inspect actual frame rates, long tasks, and excessive React commits while audio plays.
- [ ] Use DevTools **Memory** / Performance memory view: repeat play/stop/replace cycles and check for persistent nodes/listeners/large buffers. Avoid making absolute “zero leaks” claims based on a single snapshot.
- [ ] Verify no RAF loop persists when visualizer is disabled or component unmounts.
- [ ] Run Lighthouse Accessibility and Best Practices; **record measured scores without inventing a requirement of 100**.
- [ ] Run a second accessibility check (e.g., axe DevTools) if available.
- [ ] Manually verify Tab/Shift+Tab, Enter/Space, focus, labels/status with NVDA or another screen reader, 320px reflow/zoom, color contrast, and reduced motion.
- [ ] Record each finding and its remediation, then rerun the affected tests.

**Acceptance:** Report contains real test evidence, known limitations, and no unresolved critical FIFO/cancellation/resource-leak/accessibility defects.

**Suggested commit:** `test(hw2): validate performance memory and accessibility`

## T11 — Documentation and final submission

**Priority:** P0 | **Depends on:** T10  
**Deliverables:** `Homework_2/README.md`, evidence directory, final GitHub commit.

- [ ] Document scope, stack, architecture, FIFO guarantees, queue cancellation semantics, Web Audio graph, and FFT size.
- [ ] Add installation and run commands, sample audio setup, and reproduction steps for tests.
- [ ] Document keyboard commands and accessibility features.
- [ ] Record actual FPS data, memory/cleanup observations, browser environment, Lighthouse results, and remaining limitations.
- [ ] Ensure no `node_modules/`, `dist/`, `.env`, or copyrighted audio files without permission are committed.
- [ ] Verify the instructor's submission location and repository URL.
- [ ] At the **actual Git root**, run `git status`, `git add Homework_2`, `git commit -m "docs(hw2): finalize audio queue homework"`, and `git push origin main` (adjust branch/path if necessary).
- [ ] Open GitHub and verify that `Homework_2/` and its source/documentation are visible.

**Acceptance:** A reviewer can clone, install, run, and evaluate the application from README instructions; GitHub contains the latest work.

---

## Suggested directory layout

```text
repository-root/
├── Homework_1/
└── Homework_2/
    ├── ai_rule.md
    ├── task_decomposition.md
    ├── README.md                    # T11
    ├── evidence/                   # T10, when generated
    └── app/
        ├── public/
        │   └── audio/              # permitted test audio, if used
        ├── src/
        │   ├── audio/
        │   │   ├── audio-queue-controller.ts
        │   │   └── audio-engine.ts
        │   ├── components/
        │   │   ├── AudioVisualizer.tsx
        │   │   └── AudioPlayerControls.tsx
        │   ├── App.tsx
        │   └── main.tsx
        ├── package.json
        └── vite.config.ts
```

*This is a suggested layout. Preserve the existing Git root and any instructor-required naming conventions.*

## One-week execution plan

| Day | Tasks | Milestone |
| --- | --- | --- |
| **Day 1** | T00–T02 | Repo, rules, scaffold, queue contract |
| **Day 2** | T03–T04 | FIFO fetch/decode, AbortController cancellation |
| **Day 3** | T05 | Web Audio playback engine and cleanup |
| **Day 4** | T06–T07 | Visualizer and usable accessible controls |
| **Day 5** | T08–T09 | WCAG improvements and automated tests |
| **Day 6** | T10 | Performance, memory, keyboard/screen-reader audit |
| **Day 7** | T11 | README, evidence, final GitHub submission |

## Fast regression checklist (run after each integration change)

| Action | Expected result |
| --- | --- |
| Enqueue A, B, C quickly | A starts before B, B before C; one active decode job |
| Cancel B while A runs | B rejects cleanly; C continues when A finishes |
| Cancel A during network transfer | Fetch aborts; later jobs continue |
| Cancel A during `decodeAudioData` | Late result is discarded; no canceled playback |
| Enqueue invalid URL | Clear error; worker is not blocked |
| Play, pause, resume, stop repeatedly | Controls work; no duplicate sources or console errors |
| Change track | Previous source is stopped/disconnected |
| Hide/unmount visualizer | No active RAF loop remains |
| Enable reduced motion | Animation stops or switches to a non-animated alternative |
| Use keyboard only | All controls actionable, ordered focus, no trap |
| Disable Canvas/display | Meaningful track, queue and signal status remain available as text |
| Resize to 320px / zoom 400% | No loss of required controls; content remains usable |

## References

- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [WCAG 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
- [MDN Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [MDN AnalyserNode.fftSize](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/fftSize)
- [MDN decodeAudioData](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData)
- [MDN AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
- [MDN requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)
