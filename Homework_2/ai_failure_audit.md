# AI FAILURE AUDIT — Detecting Hallucinations, Security Risks, and Runtime Defects

**Project:** Homework 2 — Concurrent FIFO Audio Visualizer Queue Engine  
**Course:** Web Application Development (Practical)  
**Audit date:** 2026-10-21  
**Target:** Assignment requirements and applicable WCAG 2.2 Level AA criteria  
**Source reviewed:** The AI-generated versions of `AudioTaskQueue` (T04), `AudioPlaybackEngine` (T07), `App.tsx` (T07), and `AudioVisualizer.tsx` (T10), plus the automated tests provided in T04/T09.  
**Audit status:** **OPEN — findings require remediation and runtime evidence before submission.**

> **Evidence boundary:** This is a static audit of code provided during the Homework 2 conversation. The current local project files and GitHub `main` branch were **not independently verified**, and no Chrome DevTools recordings or screenshots were produced by the auditor. Where a problem depends on timing, browser behavior, file size, or user interaction, it is marked as a **conditional risk** rather than a confirmed runtime failure. The testing instructions below are intended to generate the instructor-requested DevTools proof. AI prompts are concise reconstructions of the requests made during development, not verbatim transcripts.

## 1. Audit Scope and Method

The instructor's model uses **AI Prompt → AI-Generated Code → Risk → Detection → Engineering Refactor**. Every finding below follows that structure and adds a severity and evidence status. The assessment covers functional correctness, async concurrency, browser resource safety, React lifecycle, visual performance, and accessibility.

**Classification:**

- **Confirmed in code:** The stated behavior/omission follows directly from the code excerpt.
- **Conditional risk:** The code has a demonstrable failure path under particular inputs or async scheduling; runtime reproduction is still required.
- **Verification gap:** An objective requirement has not yet been established by appropriate evidence.

**Important non-findings:** The reviewed code does **not** use `innerHTML`, `dangerouslySetInnerHTML`, `key={Math.random()}`, or DOM event-listener registration directly inside a React render body. Accordingly, this report does **not** invent an XSS vulnerability, random-key bug, or listener leak merely to reproduce the instructor's examples. The visualizer *does* unregister its `ResizeObserver`, media-query listener, visibility listener, and animation frame in its T10 cleanup; that is a positive design choice, although it still needs runtime verification.

## 2. Findings Overview

| ID | Severity | Type | Identified issue | Location |
|---|---|---|---|---|
| AF2-01 | **HIGH** | Confirmed in code | Single-file user interface cannot demonstrate multiple simultaneous enqueue requests | `app/src/App.tsx` |
| AF2-02 | **HIGH** | Confirmed omission; conditional impact | Unbounded local audio file size can exhaust browser memory | `app/src/App.tsx` |
| AF2-03 | **MEDIUM** | Confirmed in code | Queue status is only sampled once and does not react to queue transitions | `app/src/App.tsx` and queue controller |
| AF2-04 | **HIGH** | Conditional risk | Cancellation cannot interrupt decoding; worker may block later queued tasks and `dispose()` | `app/src/audio/audio-queue-controller.ts` |
| AF2-05 | **MEDIUM** | Conditional race | Concurrent `dispose()` calls can appear finished before `AudioContext.close()` resolves | `app/src/audio/audio-playback-engine.ts` |
| AF2-06 | **MEDIUM** | Accessibility verification gap | Frequency visualization has no numerical or descriptive frequency-equivalent output | `app/src/components/AudioVisualizer.tsx` |
| AF2-07 | **MEDIUM** | Verification gap | 60 FPS, zero leaks, and full WCAG conformance are not proven by build/unit tests or Lighthouse alone | Testing/evidence |
| AF2-08 | **LOW** | Confirmed test coverage gap | Playback and FIFO mocks do not test browser-level integration or visualizer teardown | `app/src/audio/*.test.ts` |

**Suggested correction order:** AF2-01 → AF2-02 → AF2-04 → AF2-03 → AF2-05 → AF2-06 → AF2-07/08.

## 3. Detailed AI Failure Audit Entries

### Vulnerability / Failure 01 — FIFO Concurrency Exists in the Class, but Not in the User Interface

**Severity:** HIGH  
**Classification:** Confirmed feature gap (UI); the underlying queue supports repeated calls to `enqueueTask(...)`.  
**AI Prompt:** "Implement a concurrent FIFO audio task queue and an interface for audio loading."

**AI-Generated Code:**

```tsx
const [file, setFile] = useState<File | null>(null);

<input
  id="audio-file"
  type="file"
  accept="audio/*,.mp3,.wav"
  onChange={handleFileChange}
/>

<button
  type="button"
  onClick={() => void handleLoad()}
  disabled={!file || isLoading}
>
  Load Audio
</button>
```

**Risk:** The assignment explicitly calls for a FIFO controller handling simultaneous incoming track requests. The engine can enqueue several requests in code, but this UI holds only one `File` and disables loading while a task runs. A demonstrator cannot submit two or three files together, inspect the waiting queue, or cancel a specific queued file. Presenting this UI alone as proof of concurrent inputs would overstate completion.

**Detection — DevTools proof (PENDING):**

1. Open the player with **DevTools → Network** and enable throttling (e.g., Slow 3G).
2. Select one large but valid audio file and press **Load Audio**.
3. While it is loading, try to queue another file. Confirm that the file input represents one file and the Load button is disabled.
4. Capture the UI, disabled button in **Elements**, and current requests in **Network**. Save to `evidence/AF2-01-before.png`.
5. After refactoring, enqueue at least three legal tracks rapidly and capture the queue display plus chronological request-start logs in `evidence/AF2-01-after.png`. Assert FIFO **processing order**, not that network fetches must happen in parallel.

**Engineering Refactor — manual fix:** Accept multiple files and submit all their requests *without awaiting each one in the enqueue loop*. Keep the per-file object URLs alive until each promise settles.

```tsx
// Illustrative submission logic; integrate with UI state and cancellation.
const files = Array.from(event.target.files ?? []);
const tasks = files.map((file) => {
  const url = URL.createObjectURL(file);
  const handle = queue.enqueueTask(url);
  return {
    id: handle.id,
    name: file.name,
    cancel: handle.cancel,
    result: handle.promise.finally(() => URL.revokeObjectURL(url)),
  };
});

// Store task IDs/handles for a visible queued/running/completed list.
// Aggregate completions with Promise.allSettled to preserve per-track errors.
```

The UI should provide a multi-file input, per-track status, and a cancellation control. Avoid claiming *parallel decoding*: the instructor's FIFO worker processes one active task at a time.

**Acceptance:** Three requests can be queued before the first finishes; each receives a stable ID; execution order is FIFO and cancellation works for an individual pending item.

### Vulnerability / Failure 02 — Unbounded Audio File Input (Client-Side Resource Exhaustion)

**Severity:** HIGH  
**Classification:** Confirmed missing validation; memory impact depends on file contents and the browser.  
**AI Prompt:** "Allow users to select MP3/WAV files and decode them in the browser."

**AI-Generated Code:**

```tsx
const selectedFile = event.target.files?.[0] ?? null;
setFile(selectedFile);
// ...later...
const buffer = await queue.enqueue(objectUrl);
```

**Risk:** `accept="audio/*"` is only a file-picker hint; it does not enforce MIME type, duration, or file size. The queue reads the entire response with `response.arrayBuffer()` and `decodeAudioData()` creates decoded audio, potentially far larger than the compressed file. A very large file can produce excessive CPU/RAM use, stalled UI, or browser-tab termination. This is a **resource-exhaustion risk**, not evidence of remote-code execution or XSS.

**Detection — DevTools proof (PENDING):**

1. Use a legally obtained, moderately large audio file (do **not** deliberately crash the machine).
2. Open **DevTools → Performance monitor**; observe JS heap and CPU, and note that decoded/native audio memory may not be fully represented in JS heap.
3. Attempt to load an unsupported non-audio file by modifying its extension or MIME metadata; check whether validation happens before decoding.
4. Capture the result and the error/status message as `evidence/AF2-02-before.png`.
5. After adding validation, verify that oversized or unsupported files are rejected **before** creating a blob URL; capture `evidence/AF2-02-after.png`.

**Engineering Refactor — manual fix:** Add a configurable upper bound and a positive allowlist of file types; still handle decoder rejection because file headers can lie.

```ts
const MAX_FILE_BYTES = 30 * 1024 * 1024; // example cap: 30 MiB
const ALLOWED_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
]);

function validateAudioFile(file: File): string | null {
  if (file.size === 0) return "The audio file is empty.";
  if (file.size > MAX_FILE_BYTES) return "Audio file is too large.";
  if (!ALLOWED_MIME.has(file.type)) {
    return "Only supported MP3 or WAV files are accepted.";
  }
  return null;
}
```

The exact size limit should match tested hardware and assignment expectations. Some browsers produce an empty MIME type for otherwise valid files; decide and document a safe fallback rather than silently trusting the extension. Validate before `URL.createObjectURL(...)`.

**Acceptance:** Inputs outside documented limits fail fast with an accessible error message; normal MP3/WAV files still load successfully.

### Vulnerability / Failure 03 — Stale or Misleading Queue Status

**Severity:** MEDIUM  
**Classification:** Confirmed snapshot-only update.  
**AI Prompt:** "Add an accessible FIFO queue status indicator."

**AI-Generated Code:**

```tsx
const task = queue.enqueue(objectUrl);
setPendingTasks(queue.getStatus().pending);
const buffer = await task;
// ...
setPendingTasks(0);
```

**Risk:** `getStatus()` is read immediately after enqueue and again when the local request finishes, rather than on every enqueue/dequeue/cancel/settle transition. The queue's `pending` count excludes the active task because it was removed by `shift()`. Thus `Pending tasks: 0` can be correct while one download is actively processing, but the UI does not communicate the active task separately from the engine. Once multi-file requests are implemented, this polling design can leave stale counts. Misleading status messages impair the FIFO demonstration and may confuse screen-reader users.

**Detection — DevTools proof (PENDING):**

1. Add three tasks with network throttling after AF2-01 is implemented.
2. Observe the status indicator while the first, second, and third tasks start or finish.
3. Record actual queue transitions via temporary `console.debug(queue.getStatus())` calls or DevTools breakpoints; compare to rendered text.
4. Save mismatches as `evidence/AF2-03-before.png`; after the fix, save the synchronized UI as `evidence/AF2-03-after.png`.

**Engineering Refactor — manual fix:** Publish queue status after every mutation (enqueue, dequeue, cancel, resolve/reject). Keep **waiting count** and **active processing** as separate values.

```ts
// Example shape for a queue status notification API:
type QueueSnapshot = {
  pending: number;
  isProcessing: boolean;
  activeTaskId: number | null;
};

// In the React component, subscribe once in useEffect,
// update a snapshot from real queue events, and unsubscribe on cleanup.
// Use one stable aria-live region for meaningful transitions.
```

**Acceptance:** Queue status matches real engine state throughout three simultaneous submissions and both active/pending cancellation.

### Vulnerability / Failure 04 — Cancellation Can Leave the FIFO Worker Waiting on Decoding

**Severity:** HIGH  
**Classification:** Conditional async-stall risk, not a proven permanent leak.  
**AI Prompt:** "Cancel individual tasks with AbortController and safely dispose of the audio queue."

**AI-Generated Code:**

```ts
const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

// Elsewhere, active cancellation rejects the public Promise:
this.activeController?.abort();
this.rejectTask(this.activeTask, this.createAbortError());

// During disposal:
if (this.processingPromise) {
  await this.processingPromise;
}
```

**Risk:** `AbortController` cancels fetch, but the Web Audio `decodeAudioData()` operation is **not AbortSignal-aware**. The public task promise can reject promptly while the single FIFO worker remains stuck awaiting that decoder. Any later queue entries wait, and `dispose()` can also wait a long time if the decoder never settles. This does not automatically mean a memory leak; it is a cancellation/latency and resource-lifetime problem.

**Detection — DevTools and deterministic test (PENDING):**

1. In a unit test, mock `decodeAudioData` with a deferred Promise that does not resolve immediately.
2. Enqueue A, wait until decoding begins, enqueue B, and cancel A.
3. Verify A rejects with `AbortError`; inspect whether `fetch` for B begins before the deferred decode finishes.
4. Call `dispose()` with a bounded testing timeout and verify whether it remains pending. Do not leave the test indefinitely hung.
5. Capture Vitest output and DevTools **Network/Performance** recordings as `evidence/AF2-04-test.txt` and `evidence/AF2-04-before.png`.

**Engineering Refactor — manual fix:** Design an explicit policy for in-flight decoding. Separate **logical cancellation** (immediate rejection/discard of stale result) from **native decoding cleanup** (may complete later). If canceled decode should not block the next queued item, move to a generation-token worker design and track every detached decode until it settles; do not close its `AudioContext` prematurely or allow unhandled Promise rejections. Alternatively, document that decoding is non-preemptible and acceptance requires eventual completion before processing continues. Add a deterministic deferred-decoder test for whichever policy is selected.

```ts
// A generation token prevents a late decode from resolving a canceled task.
const generationAtStart = this.generation;
const decoded = await context.decodeAudioData(arrayBuffer);
if (signal.aborted || generationAtStart !== this.generation) {
  throw new DOMException("Cancelled", "AbortError");
}
```

A token protects results **but does not itself make decoding abortable**; the worker lifecycle must be redesigned if cancellation is required to unblock waiting tasks immediately.

**Acceptance:** The chosen cancellation semantics are documented; canceled outputs are never used; no task or disposal promise silently hangs under the documented test limits.

### Vulnerability / Failure 05 — Non-idempotent Completion Semantics for Player Disposal

**Severity:** MEDIUM  
**Classification:** Conditional race confirmed by the control flow.  
**AI Prompt:** "Dispose audio sources and close AudioContext without memory leaks."

**AI-Generated Code:**

```ts
async dispose(): Promise<void> {
  if (this.disposed) return;
  this.disposed = true;
  // ...
  if (context && context.state !== "closed") {
    await context.close();
  }
}
```

**Risk:** A second caller invoking `dispose()` after `disposed` becomes `true` immediately receives an already-resolved Promise, even if the first caller's `AudioContext.close()` is still running. Consumers awaiting that second call may falsely assume native cleanup has completed. This is an **async completion race**, not proof that `close()` is never called.

**Detection — deterministic test (PENDING):**

1. Mock `AudioContext.close()` with a Promise that resolves only when manually released.
2. Call `const first = engine.dispose(); const second = engine.dispose();`.
3. Observe that `second` may resolve before `close()` completes; save the failing test log as `evidence/AF2-05-before.txt`.
4. Re-run after implementing a shared disposal Promise; both callers must await the same close operation.

**Engineering Refactor — manual fix:** Cache the first disposal Promise and return it to all callers.

```ts
private disposalPromise: Promise<void> | null = null;

dispose(): Promise<void> {
  if (this.disposalPromise) return this.disposalPromise;
  this.disposed = true;

  this.disposalPromise = (async () => {
    // Stop and disconnect source, analyser, and gain here.
    // Close the captured AudioContext exactly once.
    if (context && context.state !== "closed") {
      await context.close();
    }
  })();

  return this.disposalPromise;
}
```

This is a **refactor pattern**, not copy-paste-ready code: capture `context` and preserve the existing source-disconnection and state-notification logic from the class.

**Acceptance:** Two concurrent disposal calls both complete only after native cleanup, and `close()` runs once.

### Vulnerability / Failure 06 — Frequency Visualization Lacks a Nonvisual Data Alternative

**Severity:** MEDIUM  
**Classification:** Accessibility review gap; applicability depends on whether the spectrum communicates meaningful information or is purely decorative.  
**AI Prompt:** "Add a screen-reader-accessible 60 FPS audio-frequency canvas."

**AI-Generated Code:**

```tsx
<canvas
  ref={canvasRef}
  className="audio-canvas"
  width={900}
  height={240}
  aria-hidden="true"
/>

<p className="visualizer-status" role="status">
  {isPlaying
    ? "Audio is playing. Visualization respects reduced-motion settings."
    : "Visualization paused or waiting for audio."}
</p>
```

**Risk:** The canvas is intentionally hidden from assistive technologies and the status only describes playback, not frequency distribution. If users are expected to obtain information from the audio-frequency chart, this is not an equivalent nonvisual presentation (consider WCAG 2.2 SC **1.1.1 Non-text Content** and meaningful information relationships). If the chart is declared decorative and playback state is all that matters to the task, a frequency-data alternative may not be required. This distinction must be documented rather than inferred from Lighthouse 100/100.

**Detection — screen-reader proof (PENDING):**

1. Play audio and navigate with NVDA or Windows Narrator.
2. Confirm the chart has no accessible representation and the status only reports playing/paused.
3. Decide and document whether the spectrum conveys analytical information needed to use the app.
4. If it does, verify a textual summary or data table is announced and updates at a reasonable rate; save notes/screenshots as `evidence/AF2-06-before.png` and `evidence/AF2-06-after.png`.

**Engineering Refactor — manual fix:** Provide an accessible static description and, if the visualizer is informational, a low-frequency textual summary (e.g., low/mid/high energy bands) computed from sampled frequency bins at **at most once per second**. Do **not** put per-frame updates into an `aria-live` region or React state; this would create excessive announcements and re-renders.

```tsx
<p id="spectrum-description">
  The chart shows 48 frequency bands from low to high energy.
</p>
{/* If informational, provide a periodically updated text summary separately. */}
<canvas aria-hidden="true" /* visual representation only */ />
```

**Acceptance:** Keyboard-only and screen-reader users can accomplish the same audio-player tasks. If spectral data is an essential feature, it is available nonvisually in a meaningful form.

### Vulnerability / Failure 07 — Performance and Compliance Claims Are Not Independently Proven

**Severity:** MEDIUM  
**Classification:** Verification gap, **not** a confirmed source-code defect.  
**AI Prompt:** "Make the audio visualizer 60 FPS, leak-free, and compliant with WCAG 2.2 AA."

**AI-Generated Code / Claims:**

```ts
animationId = window.requestAnimationFrame(animate);
// Cleanup:
window.cancelAnimationFrame(animationId);
```

**Risk:** Use of `requestAnimationFrame()` is appropriate, but it does not guarantee a measured 60 FPS. Event-listener cleanup is necessary but does not establish "zero memory leaks." The earlier screenshot showed **Lighthouse on the Vite development site** with Performance **70**, Accessibility **100**, Best Practices **96**, and SEO **82**; it was not evidence of a successful production re-audit. Lighthouse 100 Accessibility, even if achieved on production, does not establish complete WCAG 2.2 AA conformance.

**Detection — performance and accessibility proof (PENDING):**

1. Run `npm run build` and `npm run preview`; audit the preview URL, not the development server.
2. Use **DevTools → Performance**, record at least 20 seconds of playback, and inspect frame pacing, long tasks, and dropped frames. Compare with the display refresh rate.
3. Use **Performance monitor** and repeat Play/Pause/Stop plus track reloads; take heap snapshots before and after garbage collection, accounting for native Web Audio memory.
4. Run a keyboard-only test, reduced-motion test, zoom/reflow test, and NVDA/Narrator test.
5. Save genuine audit exports/screenshots as `evidence/AF2-07-performance.png`, `evidence/AF2-07-memory.png`, and `evidence/AF2-07-lighthouse.html`.

**Engineering Refactor — manual fix:** Keep Canvas work outside React state on every animation frame; update only when visible and playing; retain cleanup for RAF, `ResizeObserver`, and listeners. Fix issues shown by actual traces rather than claiming performance based on code structure. Add tested results and known limitations to the submission.

**Acceptance:** Measured FPS, browser memory behavior, production Lighthouse results, and manual accessibility checks are recorded with device/browser information; no unverified claim of "100/100" or "zero leaks" remains.

### Vulnerability / Failure 08 — Test Suite Has Incomplete Browser/Concurrency Coverage

**Severity:** LOW  
**Classification:** Confirmed coverage gap in AI-provided tests.  
**AI Prompt:** "Write automated tests for the FIFO queue and audio playback engine."

**AI-Generated Code:**

```ts
vi.stubGlobal("AudioContext", FakeAudioContext);
vi.stubGlobal("fetch", fetchMock);

// Tests assert mocked source.start/stop and decode call order.
```

**Risk:** The supplied Vitest tests cover core queue behavior, cancellation of one waiting task, late decode settlement, playback, volume, and cleanup under mocks. However, they do not prove browser autoplay policy, real codec compatibility, object-URL lifecycle, multiple simultaneous file submissions through the UI, analyser rendering, or complete listener/RAF teardown in a real browser. A green unit-test suite should not be described as complete functional certification.

**Detection — automated/manual proof (PENDING):**

1. Run `npx vitest run` and capture the actual test list and result as `evidence/AF2-08-unit-tests.txt`.
2. Add a regression test that submits three files at once, cancels the second while waiting, and checks the third completes.
3. Use Playwright or manual DevTools to verify real audio playback and that navigating/unmounting stops RAF and closes the context.
4. Record failures first, then rerun and store a passing report.

**Engineering Refactor — manual fix:** Expand tests to include file-size validation, concurrent UI submission, active cancellation during decode, repeated disposal, object-URL revocation, visualizer `requestAnimationFrame` cleanup, and keyboard/assistive-technology acceptance tests. Keep mocked unit tests and real-browser tests separate.

**Acceptance:** Tests cover critical failure paths; browser-only claims have browser evidence.

## 4. DevTools Evidence Register

The instructor requires **detected bugs with DevTools proof and manual fixes**. The table below intentionally contains no invented observations.

| ID | What to capture | Evidence path | Status |
|---|---|---|---|
| AF2-01 | Disabled second enqueue; corrected 3-track FIFO queue | `evidence/AF2-01-before.png`, `AF2-01-after.png` | PENDING |
| AF2-02 | Oversized/invalid file acceptance and rejected-file message | `evidence/AF2-02-before.png`, `AF2-02-after.png` | PENDING |
| AF2-03 | Queue status vs. actual enqueue/dequeue events | `evidence/AF2-03-before.png`, `AF2-03-after.png` | PENDING |
| AF2-04 | Deferred decode + cancellation timing | `evidence/AF2-04-test.txt`, `AF2-04-before.png` | PENDING |
| AF2-05 | Two concurrent disposal calls | `evidence/AF2-05-before.txt` | PENDING |
| AF2-06 | Screen-reader evaluation and any new textual spectrum summary | `evidence/AF2-06-before.png`, `AF2-06-after.png` | PENDING |
| AF2-07 | Production Lighthouse, FPS, heap snapshots | `evidence/AF2-07-*` | PENDING |
| AF2-08 | Actual Vitest output and browser integration tests | `evidence/AF2-08-unit-tests.txt` | PENDING |

**Minimum instructor demonstration:** Select **three** reproducible findings (recommended: AF2-01, AF2-02, and AF2-03), preserve a **before** screenshot/log, implement the manual fix, and preserve an **after** screenshot/log. For concurrency/cancellation, deterministic test logs complement—but do not replace—the UI and DevTools evidence.

## 5. Corrective Action Status

| Priority | Action | Current status | Completion condition |
|---|---|---|---|
| P0 | Add multi-track queue demonstration | OPEN | Three requests enqueued together and executed FIFO |
| P0 | Validate audio size and format before decoding | OPEN | Oversized/invalid inputs rejected predictably |
| P0 | Specify/test non-abortable decode cancellation behavior | OPEN | No uncontrolled waits under documented test scenarios |
| P1 | Publish live queue status | OPEN | Waiting/active/completed states match the engine |
| P1 | Make player disposal awaitable and idempotent | OPEN | Repeated `dispose()` callers await actual close |
| P1 | Provide nonvisual spectrum meaning where required | OPEN | Screen-reader inspection verifies equivalence |
| P1 | Capture real performance, memory, and WCAG evidence | OPEN | Production and manual results archived |
| P2 | Strengthen integration test coverage | OPEN | Regression and browser tests pass |

**Final audit conclusion:** The AI-generated Homework 2 implementation has a functional foundation: a FIFO decoding queue, cancellation primitives, Web Audio playback graph, accessible controls, and a Canvas visualizer with RAF cleanup. The audit identifies specific incompleteness and conditional failure modes that must not be mislabeled as runtime-confirmed bugs. It is **not yet accurate to claim full assignment acceptance, 60 FPS on all devices, zero memory leaks, or complete WCAG 2.2 AA conformance** without the corrections and evidence listed above.

**References:** [Assignment criteria](./task_decomposition.md) · [WCAG 2.2](https://www.w3.org/TR/WCAG22/) · [MDN: AudioBufferSourceNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode) · [MDN: decodeAudioData](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData) · [MDN: AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController) · [MDN: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame).
