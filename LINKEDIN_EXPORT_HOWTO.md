# How to test the LinkedIn Connections Exporter on your real connections page

This guide walks from a fresh terminal to a downloaded CSV. No programming knowledge is needed after the build step.

---

## Step 1 — Build the extension

Open a terminal and run:

```
cd D:\AI\linkedin_connections
npm run build
```

You should see:

```
Build complete.
```

This produces a `dist\` folder containing four files:
- `manifest.json`
- `content.js`
- `popup.js`
- `popup.html`

That folder is the extension. You point Chrome at it directly.

---

## Step 2 — Load the extension in Chrome (unpacked)

1. Open Chrome.
2. In the address bar type `chrome://extensions` and press Enter.
3. Toggle **Developer mode** on — the switch is in the top-right corner of that page.
4. Click **Load unpacked**.
5. In the file picker, navigate to:
   ```
   D:\AI\linkedin_connections\dist
   ```
   Select the `dist` folder and click **Select Folder**.
6. The extension appears in the list as **LinkedIn Connections Exporter**.
7. If you see a red error badge, click **Details** and read the error — most likely the build didn't finish. Re-run `npm run build` and then click the refresh icon on the extension card.

> **Keep this tab open.** Any time you rebuild the extension you need to come back here and click the refresh (↺) icon on the extension card, otherwise Chrome keeps running the old version.

---

## Step 3 — Pin the extension to the toolbar (optional but useful)

1. Click the puzzle-piece icon (🧩) in the Chrome toolbar.
2. Find **LinkedIn Connections Exporter** in the list.
3. Click the pin icon next to it.

The extension icon now sits in the toolbar so you can click it without going through the puzzle-piece menu.

---

## Step 4 — Navigate to your connections page

Sign in to LinkedIn in the same Chrome window, then go to:

```
https://www.linkedin.com/mynetwork/invite-connect/connections/
```

You should see a list of your connections with names, headlines, and "Connected on" dates.

---

## Step 5 — Scroll to load the connections you want

LinkedIn renders connections lazily — it only adds cards to the page as you scroll down. The extension can only export cards that are currently in the DOM.

- To export your most recent ~20 connections: no scrolling needed.
- To export more: scroll down slowly and wait for new cards to appear before stopping.
- To export everything visible: scroll all the way to the bottom of the list and wait for it to stop loading new cards.

There is no auto-scroll in this version. What is on screen when you click Export is what you get.

---

## Step 6 — Export

1. Click the **LinkedIn Connections Exporter** icon in the toolbar.
2. A small popup appears with an **Export Connections** button.
3. Click it.
4. The popup shows `Exporting...` then `Exported N connection(s).`
5. Chrome downloads a file named `linkedin-connections.csv` automatically. Check your Downloads folder.

---

## Step 7 — Verify the CSV

Open `linkedin-connections.csv` in Excel, Google Sheets, or any text editor.

**Expected header row:**
```
name,profileUrl,headline,connectedOn,messageUrl
```

**Example data row:**
```
Siba Prasad,https://www.linkedin.com/in/sibaps/,"Talent Acquisition Lead || VLSI and Embedded || Hardware",Connected on March 19 2026,https://www.linkedin.com/messaging/compose/?profileUrn=...
```

**Things to check:**
- Row count roughly matches what was visible on the page
- Names look correct — no stray quotes or broken columns
- `profileUrl` column: paste one into your browser and confirm it opens the right profile
- `connectedOn` column: should say `Connected on [Month Day, Year]`
- `headline` column: may be empty for connections without a headline set — that is expected
- No cell contains the literal text `null` or `undefined`

---

## Troubleshooting

### "Exported 0 connection(s)."

LinkedIn may have updated its page structure. To diagnose:

1. On the connections page, press **F12** to open DevTools.
2. Click the **Console** tab.
3. Paste and run this:
   ```javascript
   document.querySelectorAll('[data-testid="lazy-column"] [data-display-contents="true"] > [componentkey]').length
   ```
4. If the result is `0`, the card selector no longer matches LinkedIn's current DOM. The selectors need updating — open `D:\AI\linkedin_connections\src\content\selectors.ts`, inspect the live page to find the new structure, update the selectors, rebuild, and reload the extension.
5. If the result is a positive number, the cards are found but something else broke. Check the console for red error messages.

### The popup says "Error: Could not establish connection"

The content script only loads on `https://www.linkedin.com/mynetwork/invite-connect/connections/*`. Make sure you are on exactly that URL, not a search or filtered view. Reload the connections page and try again.

### Chrome blocked the download

Chrome sometimes blocks multiple rapid downloads. Check the address bar for a download-blocked icon and allow it.

### I rebuilt but the extension still behaves the old way

Go to `chrome://extensions`, find the extension card, and click the **↺** refresh icon. Chrome does not auto-reload unpacked extensions when files change.

---

## What this extension does and does not do

| Does | Does not |
|------|---------|
| Read the connection cards currently visible in the DOM | Auto-scroll or paginate |
| Export name, profile URL, headline, connected date, message URL | Access private data beyond what is visible |
| Download a local CSV file | Send any data to a server |
| Run only when you click Export | Run in the background |
