# Privacy Policy — LinkedIn Connections Exporter

**Last updated:** 2026-03-22

---

## Summary

LinkedIn Connections Exporter does not collect, store, or transmit any personal data. Everything stays on your machine.

---

## What the extension does

When you click **Export Connections**, the extension:

1. Reads the connection cards currently displayed on your LinkedIn connections page (`linkedin.com/mynetwork/invite-connect/connections/`)
2. Extracts the following fields from the visible DOM: name, profile URL, headline, connected date, and message URL
3. Writes those fields into a CSV file and downloads it directly to your browser's Downloads folder

That is the complete list of actions the extension performs.

---

## What the extension does NOT do

- **No data collection.** No information about you or your connections is collected or retained by the extension.
- **No network requests.** The extension makes zero outbound network requests. It does not communicate with any server, API, or third-party service.
- **No background activity.** The extension runs only when you explicitly click the Export button. It does not run in the background, does not track your browsing, and does not observe any pages other than the LinkedIn connections page.
- **No analytics or telemetry.** No usage data, error reports, or diagnostics are sent anywhere.
- **No storage.** The extension does not use `chrome.storage`, cookies, or any other persistence mechanism. Nothing is written to disk except the CSV file you explicitly download.

---

## Permissions used

| Permission | Purpose |
|-----------|---------|
| `activeTab` | Read the DOM of the LinkedIn connections page you have open |
| `scripting` | Inject the export script into the active tab when you click Export |

These permissions are the minimum required to read the page and trigger the download. They grant access only to the tab you are actively viewing, only when you click Export.

---

## Data the CSV file contains

The downloaded CSV contains data that is already visible to you on your LinkedIn connections page: your connections' names, public profile URLs, headlines, the date you connected, and a link to message them. This data is yours — you are exporting your own network data from a page you have access to.

The CSV file is saved locally to your computer. It is not sent anywhere by this extension.

---

## Third-party services

This extension does not integrate with any third-party service. It has no relationship with LinkedIn beyond reading the page you navigate to in your own browser.

---

## Changes to this policy

If the extension's behaviour changes in a way that affects data handling, this policy will be updated and the extension version will be incremented.

---

## Contact

For questions or concerns, open an issue at:
https://github.com/nanaoosaki/linkedin_connections/issues
