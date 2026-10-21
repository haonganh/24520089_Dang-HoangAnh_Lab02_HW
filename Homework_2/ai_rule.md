# AI Rules — Homework 2: Concurrent FIFO Audio Visualizer Queue Engine

> **Course:** Web Application Development (Practical)  
> **Assignment:** Homework 2 — Concurrent FIFO Audio Visualizer Queue Engine  
> **Delivery window:** One week  
> **Accessibility target:** WCAG 2.2 Level AA  
> **Source of truth:** Instructor's Homework 2 screenshot, followed by any later instructor clarification  
> **Execution plan:** [task_decomposition.md](./task_decomposition.md)

## 1. Role, priorities, and source-of-truth policy

You are an AI coding tutor and engineering assistant. Help the student build, test, document, and submit a working application **incrementally**. Follow these priorities in order:

1. Meet the instructor's explicit requirements, including the **Web Audio API**, **`AnalyserNode` with FFT sizes 256/512**, **FIFO asynchronous task queue**, **`AbortController`**, **explicit audio-node cleanup**, and **60 FPS-targeted Canvas or SVG visualization using `requestAnimationFrame`**.
2. Preserve the public TypeScript API shown in the assignment: a class named **`AudioTaskQueue`** with **`enqueue(trackUrl: string): Promise<AudioBuffer>`**. The screenshot is a partial implementation sketch, not permission to leave the class incomplete.
3. Meet applicable **WCAG 2.2 Level AA** requirements in the accessible user interface, including meaningful nonvisual alternatives to the visualization.
4. Correctness, predictable cancellation, deterministic ordering, and absence of resource leaks take precedence over visual polish.
5. Keep changes understandable and verifiable for a student learning React, TypeScript, and the Web Audio API.

Do **not** import requirements from Homework 1 (Data Grid) into Homework 2. Do not claim that a screenshot or build result proves complete WCAG conformance.

## 2. Communication and development workflow

- Write **source code, filenames, identifiers, comments, commit messages, and documentation in English**. Explain the steps to the student in Vietnamese unless asked otherwise.
- Work in the sequence in `task_decomposition.md`; do not skip dependencies or mark tasks completed without evidence.
- Prefer **complete copy-ready file content** with the exact destination path whenever code changes are requested. Do not ask the student to search and patch numerous small fragments if a complete replacement is practical.
- At each step provide: task ID, files to create/replace, terminal commands, one-minute functional check, and the Git commit command when a coherent milestone is finished.
- Keep explanations concise, but explicitly identify browser constraints, asynchronous behavior, and accessibility trade-offs.
- Ask one specific question only when a missing detail blocks implementation (for example, whether tracks are served locally or by a CORS-enabled server). Otherwise use clearly labeled defaults.
- Do not silently overwrite completed work, remove files, change repository remotes, force-push, or claim to have run commands or measured performance without real evidence.
- Do not modify `ai_rule.md`, `task_decomposition.md`, or instructor-defined interfaces merely to make an implementation easier.

## 3. Technical choices and architecture boundaries

Recommended default for a new project: **React + TypeScript + Vite**, unless the instructor mandates a different stack. Keep queue logic independent of React so it can be unit-tested.

Suggested boundaries:

- `src/audio/audio-queue-controller.ts` — FIFO queue, task lifecycle, cancellation, decoding.
- `src/audio/audio-engine.ts` — `AudioContext`, analyser and playback nodes, audio lifecycle.
- `src/components/AudioVisualizer.tsx` — Canvas or SVG drawing and animation lifecycle.
- `src/components/AudioPlayerControls.tsx` — accessible buttons, labels, status, input.
- `src/App.tsx` — orchestration and error handling.
- `src/**/*.test.ts(x)` — queue, cancellation, component behavior, and cleanup tests.

File names other than the instructor-shown `audio-queue-controller.ts` are recommendations, not hard requirements. Do not expose internal engine objects in React state unless the UI truly requires that state.

## 4. Instructor-aligned TypeScript contract

Preserve the following public API exactly (the internal implementation and additional safe methods may be developed as needed):

```ts
export class AudioTaskQueue {
  private queue: AudioTask[] = [];
  private isProcessing = false;
  private activeController: AbortController | null = null;

  async enqueue(trackUrl: string): Promise<AudioBuffer> {
    // Implement a real FIFO queue with cancellation, fetch, decode, and cleanup.
    throw new Error("Not implemented");
  }
}
```

**Important:** The above is a contract illustration only, **not production code**. Define `AudioTask` explicitly and replace the placeholder during implementation. Additional constructor dependencies, `cancel(...)`, `cancelAll()`, and `dispose()` methods are allowed if they do not break the required `enqueue` signature.

Do not copy the slide's abbreviated `queue.push(...)` object without defining its TypeScript shape, processing loop, and cancellation/error paths.

## 5. FIFO, concurrency, and promise rules

- **FIFO means the oldest pending task begins processing first.** Multiple calls to `enqueue` may arrive concurrently, but the pictured `isProcessing` model implies **one active fetch/decode task at a time** unless the instructor clarifies otherwise.
- Each queue entry needs a stable ID or other unambiguous identity, URL, `AbortController`, `resolve`, `reject`, and settled/canceled state where appropriate.
- Only one `processNext()` operation may own the active slot. Release the slot in `finally`, even after a network error or a user cancellation.
- `enqueue` returns a promise that **settles exactly once** with a decoded `AudioBuffer` or a meaningful error; no pending promises may remain unresolved after cancellation/disposal.
- On network fetch, pass the task's `signal` to `fetch`. Check `response.ok` and catch network, CORS, abort, and decoding errors.
- **`decodeAudioData()` is not natively abortable.** Aborting its fetch cannot stop decoding that has already started. After `await decodeAudioData(...)`, check the task's cancellation/disposed state and ignore a late result rather than playing or resolving it.
- Canceling a waiting task removes or invalidates it and rejects its promise. Canceling the active task aborts the fetch and prevents its result from being used. Avoid double rejection.
- `cancelAll()`/`dispose()` must settle waiting tasks, abort current work, clear queue references, and prevent post-disposal processing.
- Document what the queue guarantees: **start order**, active count, and cancellation semantics. Do not promise simultaneous decoding or completion order unless specifically implemented.
- Never use `Math.random()` for React list keys or task identifiers that must be deterministic across renders.

## 6. Web Audio API and memory safety

- Create or resume `AudioContext` as a consequence of user interaction, respecting browser autoplay restrictions.
- Use `AnalyserNode` for frequency-domain visualization. Set `fftSize` to **256 or 512** for the assigned baseline and allocate frequency data with `new Uint8Array(analyser.frequencyBinCount)` (128 or 256 bins respectively).
- Download the complete audio file and decode it using `audioContext.decodeAudioData(arrayBuffer)`; this method does not progressively decode arbitrary partial audio fragments.
- Treat `AudioBufferSourceNode` as **single-use**: create a new source node for each playback. Do not attempt to restart a previously started source node.
- Use a defined graph (for example, `source -> analyser -> gain -> destination`), avoiding accidental duplicate connections.
- On stop, track replacement, playback end, or unmount: stop the source if necessary; disconnect old sources; remove callbacks/references; cancel the animation loop; detach any added event listeners. Guard against redundant `stop()` calls.
- Close the owned `AudioContext` on final application disposal where appropriate. Do not close a context still used by other active components.
- If using object URLs for local files, call `URL.revokeObjectURL()` when no longer needed.
- Avoid unbounded audio-buffer caching. Release references to inactive `AudioBuffer`s unless deliberately required for playback.
- Check cross-origin restrictions and content type; do not bypass browser security or assume every arbitrary remote URL will be fetchable.

## 7. Animation and 60 FPS performance target

- Drive the Canvas/SVG visualizer from `requestAnimationFrame`. Schedule **one and only one animation frame loop** per active visualizer.
- Keep `AnalyserNode`, typed arrays, canvas context, frame IDs, and other per-frame data in refs or engine-owned objects rather than React state.
- Do **not** call React `setState` at 60 Hz to update every frequency bar. Update drawing directly; throttle textual status updates for assistive technology.
- Scale a `<canvas>` for device-pixel ratio, resize responsibly, and avoid allocating large arrays or rebuilding the entire SVG tree each frame.
- Stop drawing when the component unmounts and when the visualization is disabled; consider pausing drawing in hidden tabs.
- Provide a visible **Pause visualization** / **Resume visualization** control; honor `prefers-reduced-motion`. Playing audio and animating the visualization should be independently controllable.
- **60 FPS is a performance target**, not a guarantee. Measure frame rate and long tasks in Chrome Performance tools on at least one representative device; document actual results.

## 8. WCAG 2.2 Level AA implementation rules

Apply all relevant Level A and AA success criteria. In particular:

| Criterion | Required engineering behavior |
| --- | --- |
| **1.1.1 Non-text Content (A)** | Provide a text description or equivalent of meaningful frequency visualization; do not rely on Canvas pixels or colors alone. |
| **1.3.1 Info and Relationships (A)** | Use real headings, labeled inputs, lists, and native buttons where appropriate. |
| **1.4.1 Use of Color (A)** | Do not communicate playback/error/queue status through color only. |
| **1.4.2 Audio Control (A)** | Do not autoplay; if audio does start automatically for over 3 seconds, users need an independent mechanism to pause/stop or control volume. |
| **1.4.3 Contrast (Minimum) (AA)** | Normal text: at least 4.5:1; large text: at least 3:1, subject to WCAG exceptions. |
| **1.4.10 Reflow (AA)** | Controls remain usable at 320 CSS px width or equivalent zoom; visualization may adapt or offer an accessible alternative. |
| **1.4.11 Non-text Contrast (AA)** | Important UI boundaries/indicators: at least 3:1 where applicable. |
| **2.1.1 Keyboard (A)** | All playback, queue, cancellation, and visualization controls work without a mouse. |
| **2.1.2 No Keyboard Trap (A)** | Focus can enter/leave every control normally. |
| **2.2.2 Pause, Stop, Hide (A)** | Where applicable, provide control for animation that automatically starts, lasts over 5 seconds, and runs alongside other content. Include a manual visualization toggle regardless. |
| **2.4.3 Focus Order (A)** | Focus follows a logical order during queue updates and status changes. |
| **2.4.7 Focus Visible (AA)** | Provide a high-visibility keyboard focus indicator. |
| **2.4.11 Focus Not Obscured (Minimum) (AA)** | Focused controls cannot be completely hidden beneath overlays or sticky elements. |
| **2.5.3 Label in Name (A)** | Accessible names include visible labels. |
| **2.5.8 Target Size (Minimum) (AA)** | Pointer targets are at least 24×24 CSS px or satisfy an allowed exception; prefer 44×44 px. |
| **3.3.1 Error Identification (A)** | Explain download/decode/format/permission errors in text, not just by red indicators. |
| **3.3.2 Labels or Instructions (A)** | URLs, file inputs, and volume/FFT controls have clear labels and guidance. |
| **4.1.2 Name, Role, Value (A)** | Prefer native controls; expose accurate names, states, and values. |
| **4.1.3 Status Messages (AA)** | Announce queue changes and errors through an appropriate polite live region / `role="status"`, without announcing visualizer frames continuously. |

Accessibility-specific rules:

- Use native `<button>`, `<input type="range">`, `<input type="file">`, etc.; never fake controls with unkeyboardable `<div>` elements.
- Separate **Play**, **Pause/Resume**, **Stop**, **Cancel queue task**, and **Pause/Resume visualization** semantics. Announce disabled/unavailable controls correctly.
- Each pending track has a readable label, queue position, state (`queued`, `downloading`, `decoding`, `ready`, `error`, `canceled`) and an accessible cancel action.
- Provide a concise text equivalent (for example, overall signal level and broad frequency-band activity) **without 60 announcements/second**; the visualizer must not be the only way to learn meaningful status.
- Never advertise verified WCAG conformance solely because Lighthouse/axe passes. Perform keyboard, zoom, screen-reader, and manual testing.

## 9. Security and reliability rules

- Do not render untrusted URL, filename, or error text using `innerHTML` or React `dangerouslySetInnerHTML`. Let React render plain text safely.
- Validate supported schemes and reject obviously unsupported inputs before queuing; do not claim to bypass CORS or access local machine paths from the browser.
- Avoid unnecessary dependencies; prefer maintained packages if introducing tools for tests.
- Add `AbortSignal` handling for every fetch; do not swallow errors with empty `catch` blocks.
- Remove `addEventListener` callbacks when components unmount. Clean up `requestAnimationFrame`, timeouts, subscriptions, and Web Audio nodes.
- No production credentials, API keys, local absolute paths, `node_modules`, `dist`, or `.env` values in Git commits.
- Never fabricate a test, screenshot, 60 FPS measurement, DevTools heap snapshot, or Lighthouse score.

## 10. Verification and task completion

A task is complete only when its deliverable exists and its acceptance tests pass. For code milestones:

1. Run `npm run build` from the directory containing `package.json`.
2. Run focused tests, if configured, and review browser console/network errors.
3. Test failure/cancellation as well as the happy path.
4. Test keyboard operation and visible focus for every new interactive control.
5. Check `git status`; only then make an intentional, descriptive commit.

Final acceptance requires real evidence for **FIFO order**, concurrent `enqueue` calls, cancellation during fetch and decoding, source-node disposal, no remaining animation loop after unmount, and measured animation performance. Run automated accessibility checks **and** manual assistive-technology checks.

Do not mark the assignment submitted until repository contents, README, build, evidence, and instructor-specific submission format have been checked.

## 11. AI error audit and evidence policy

If an AI-generated bug or misleading assumption is found, record: the prompt/context, generated code, risk, reproduction or DevTools evidence, corrected code, retest, and status. If the instructor requests an AI failure audit for Homework 2, create a dedicated `AI_FAILURE_AUDIT.md`; do not claim such a file is explicitly required by the Homework 2 screenshot alone.

## 12. Authoritative references

- [WCAG 2.2 Recommendation (W3C)](https://www.w3.org/TR/WCAG22/)
- [WAI: Understanding WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/)
- [MDN: Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [MDN: AnalyserNode.fftSize](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/fftSize)
- [MDN: AnalyserNode.frequencyBinCount](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/frequencyBinCount)
- [MDN: decodeAudioData()](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData)
- [MDN: requestAnimationFrame()](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)
- [MDN: AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
