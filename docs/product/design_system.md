# Telos Design System & UI Principles

To ensure a consistently beautiful, "desktop-class," and hyper-minimalist feel across the entire application, all UI development must adhere to the following principles.

## 1. Core Aesthetic: Unobtrusive Power
The primary feature of a Gospel Library app is the **text itself**. Therefore, the UI should disappear when not actively needed.
- **Inspiration:** Claude Desktop app, native macOS design, Arc Browser.
- **Colors:** Minimal use of color. UI chrome (sidebars, toolbars) should be muted grays/monochrome or slightly translucent. Color is reserved exclusively for user content (highlights, tags) and primary actions.
- **Typography:** 
    - UI Elements: Modern sans-serif (e.g., `Inter`, `SF Pro`, or `Geist`).
    - Reading Canvas: Beautiful, legible serif fonts (e.g., `Merriweather`, `Newsreader`, or `Crimson Text`).

## 2. Interaction Design: Hover-First
To maintain a clean reading canvas, action buttons should not clutter the screen by default.
- **Reveal on Hover:** Buttons for actions (like "Add Note", "Copy", "Share", or verse numbers) should only become fully visible when the user hovers over the surrounding block or verse.
- **Context Menus:** Heavy reliance on right-click context menus rather than permanent toolbars.
- **Keyboard First:** Every major action should have a clear keyboard shortcut (`Cmd+T` for new tab, `Cmd+K` for search, etc.)

## 3. The Reusable Component Library
Before building full screens, we will establish a core set of reusable components built with **Tailwind CSS** and **Radix UI** (for accessibility and native feel).

### 3.1. Layout Shell
- `AppWindow`: The root container, handling the custom title bar drag region (to fake the native OS title bar) and global keyboard listeners.
- `SplitPane`: A resizable divider separating the main reading canvas from notes/reference sidebars.

### 3.2. Core Primitives
- `IconButton`: A button containing only an icon (Lucide or Radix Icons). Must have a subtle hover state (`bg-gray-100 dark:bg-gray-800`) and only show its border/background on hover.
- `ContextMenu`: A Radix-powered right-click menu styled to look identical to native macOS menus (blur background, tight padding, rounded corners).
- `HoverCard`: A popover that appears when hovering over a linked scripture, showing a preview of the text without needing to click it.

### 3.3. Content Blocks
- `VerseBlock`: The fundamental unit of reading. Contains the verse text, a subtle verse number (opacity-50, full opacity on hover), and a hidden "Action Menu" button that appears on hover.
- `VerseHighlight`: A text span with a background color applied by the user.

## 4. Dark Mode & Accessibility
- The app must support a system-linked Dark Mode from day one.
- We will rely purely on CSS variables (or Tailwind's `dark:` classes) to ensure perfect contrast switching. 
- The background of the reading canvas should not be pure `#FFFFFF` or pure `#000000`, but rather a very slightly warm or cool off-white/off-black to reduce eye strain.
