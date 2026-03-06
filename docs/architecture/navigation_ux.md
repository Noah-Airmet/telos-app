# Navigation & Parallel Syncing UX

Building a tool that gracefully handles multiple scripture translations—especially when one is a "Study Bible" filled with extra commentary paragraphs, and others include the Doctrine & Covenants—is the hardest UX problem in Bible software.

Here is the strategy to make navigation intuitive and synchronized.

## 1. The Universal Addressing System
To sync two panes together (e.g., LDS KJV on the left, Oxford Annotated Book of Mormon on the right), we cannot rely on scrolling pixel percentages. The Oxford edition will be twice as long because of the commentary.

We must use a **Universal Verse ID (UVID)** system. Every block in our database must have an ID structured like:
`[work]-[book]-[chapter]-[verse]`
- Example 1: `bom-1-ne-3-7`
- Example 2: `dc-section-89-2`
- Example 3: `pgp-abr-3-22`

### How Syncing Works:
1. When the user scrolls the left pane, the app detects which `UVID` is currently at the top of the viewport using the `IntersectionObserver` API.
2. The app broadcasts an event: `SyncScrolled(bom-1ne-3-7)`.
3. The right pane listens for this event. Even if the right pane is an Annotated Study Bible filled with 5 paragraphs of commentary before verse 7, it finds the block with `block_id: "bom-1-ne-3-7"` and smoothly scrolls it to the top of the viewport.

### Handling Study Commentary:
Study notes in ePubs (like the Oxford Annotated) must be parsed slightly differently. They must be ingested with a `type: "commentary"`.
If the commentary applies to verses 5-7, it should be anchored to `bom-1-ne-3-5`. When parsing, the script must assign the UVID of the *preceding* verse to the commentary block so that it stays grouped with the text it is explaining.

## 2. The Navigation UI (The Breadcrumb Picker)
Logos and the Gospel Library app use very different approaches. The Gospel Library uses a massive drill-down menu (tiling). Logos uses a command bar. We will use a **Cascading Breadcrumb Picker**.

At the top of the `ReadingCanvas` pane, there is a breadcrumb.
`Book of Mormon ▶ 1 Nephi ▶ Chapter 3`

### Interaction:
- **Clicking "Book of Mormon"** opens a popover showing all volumes (Bible, BoM, D&C, PoGP).
- **Clicking "1 Nephi"** opens a popover showing all books in that volume.
- **Clicking "Chapter 3"** opens a grid of chapter numbers.

This allows a user to jump from `1 Nephi 3` to `Alma 32` in two clicks, rather than having to navigate "Back, Back, Back, Forward, Forward" like the mobile app.

## 3. The Command Palette (The Power User Way)
As a desktop app, users should rarely need to click the breadcrumbs.
Hitting `Cmd + K` opens a fuzzy search palette.
- Typing "1 ne 3" and hitting enter instantly routes the active pane to 1 Nephi 3.
- Typing "dc 89" instantly routes to Doctrine and Covenants Section 89.

## 4. Switching Translations
Next to the breadcrumb is the Translation Selector (e.g., a button that says `[ LDS Edition v ]`).
- Changing this dropdown keeps the pane at the exact same Universal Verse ID, but re-queries the database for the new translation's text.
- If the selected translation does not contain that book (e.g., switching from KJV to an NRSVue while reading the Book of Mormon), the UI gracefully displays: *"The NRSVue translation does not contain the Book of Mormon,"* rather than crashing or showing a 404.
