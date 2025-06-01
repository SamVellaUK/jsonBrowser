# Phase 0‑5 Implementation Plan – Overview

## Purpose  
Phase 0‑5 will convert the current prototype into a maintainable, feature‑complete **v1 baseline**.  
Each step is deliberately **non‑breaking**—after it merges, the web‑app must still load data, render the table, and allow search/expand exactly as today.

## Sequence  

| Step | Core deliverable | Why it must come first |
|------|------------------|------------------------|
| **0** | Centralised `applyColumnState()` refresh engine | Later features only mutate `state.columnState` and invoke this function. |
| **1** | Promotion API (logic only) | Console‑testable; UI‑agnostic. |
| **2** | Hook promotion into Edit‑mode UI | Visual proof that flattening works. |
| **3** | Visibility toggle support | Underpins hide/show in chooser. |
| **4** | Column re‑order helpers | Enables “move up/down” semantics. |
| **5** | Column‑chooser overlay (view layer) | Final consumer of 1‑4 helpers. |

*Phase 6 (performance & UX hardening) is deferred to a future “v2”.*

## Shared Principles  

* **Single source of truth** – `state.columnState` is authoritative.  
* **No direct DOM mutation outside `applyColumnState()`**.  
* **Zero regressions** – existing features must keep working at the end of every PR.  
* **Test harness first** – each step ships with a repeatable manual test sheet.  
* **Review discipline** – see per‑step checklists in the detail docs.
