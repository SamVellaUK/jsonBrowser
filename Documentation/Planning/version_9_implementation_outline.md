
# 🔎 Version 9.0 — Full Table Search (Implementation Outline)

This document outlines the required changes and approaches for implementing Version 9.0 (Full Table Search) in the interactive JSON data viewer. Each subtask is rated for complexity on a scale from 1 (simple) to 5 (complex).

---

## 📌 9.1 – Add Search UI Components

### 9.1.1 – Add Search Box in Top Bar
- **What to change**: HTML layout (top bar), `setupUIListeners()`, CSS
- **How**: Add `<input>` for query text and a Search button
- **Complexity**: 1️⃣

### 9.1.2 – Add Next / Previous Navigation Buttons
- **What to change**: HTML layout, navigation state in JS
- **How**: Add buttons and wire to search result navigation
- **Complexity**: 2️⃣

### 9.1.3 – Add Result Counter Display
- **What to change**: DOM + state tracking
- **How**: Track current index and total match count; update UI
- **Complexity**: 2️⃣

---

## 🔍 9.2 – Implement Search Mechanics

### 9.2.1 – Manual Search Trigger
- **What to change**: New `performSearch(query)` function
- **How**: Recursively search `window.DATA`, including nested fields
- **Complexity**: 3️⃣

### 9.2.2 – Highlight All Matches
- **What to change**: Cell rendering and styling
- **How**: Add `.highlight` class to all matching cells
- **Complexity**: 3️⃣

### 9.2.3 – Auto-Expand Nested Matches
- **What to change**: DOM control of expand toggles
- **How**: Trigger expansion on match ancestor containers
- **Complexity**: 4️⃣

### 9.2.4 – Navigate Between Matches
- **What to change**: New navigation logic
- **How**: Scroll to and style current match
- **Complexity**: 3️⃣

### 9.2.5 – Wraparound Notice
- **What to change**: `navigateSearch()` function
- **How**: Detect loop and show popup/alert
- **Complexity**: 2️⃣

---

## 🚫 9.3 – Handle Hidden Column Matches

### 9.3.1 – Detect Matches in Hidden Columns
- **What to change**: Extend `performSearch()`
- **How**: Search all paths in `window.DATA`, not just visible ones
- **Complexity**: 4️⃣

### 9.3.2 – Exclude Hidden Matches from Navigation
- **What to change**: Result filtering logic
- **How**: Maintain `visibleMatches[]` and `hiddenMatches[]`
- **Complexity**: 3️⃣

---

## 🎨 9.4 – Styling

- **What to change**: CSS
- **How**: 
  - `.highlight`: `background-color: #ffffcc`
  - `.highlight-active`: `box-shadow` or bold outline
- **Complexity**: 1️⃣

---

## 🧠 Summary Table

| Task Group                  | Max Complexity |
|----------------------------|----------------|
| 9.1 – Search UI             | 2️⃣             |
| 9.2 – Search Mechanics      | 4️⃣             |
| 9.3 – Hidden Match Handling | 4️⃣             |
| 9.4 – Styling               | 1️⃣             |
