# Fleet Maintenance Card

A custom Lovelace card for Home Assistant to track your vehicle maintenance, companion to the Fleet Maintenance OS.

## Installation via HACS

1. Open Home Assistant and navigate to **HACS**.
2. Click on **Frontend**.
3. Click the three dots (`...`) in the top right corner and select **Custom repositories**.
4. Paste the URL of this repository: `https://github.com/officialxndr/fleet-maintenance-card`
5. Select **Lovelace** as the Category and click **Add**.
6. Close the modal, find **Fleet Maintenance Card** in the list, and click **Download**.
7. When prompted, reload your browser.

## Manual Configuration
If HACS doesn't automatically add the resource, go to **Settings > Dashboards > Click the three dots top right > Resources** and add:
* **URL:** `/hacsfiles/fleet-maintenance-card/fleet-maintenance-card.js`
* **Resource Type:** `JavaScript Module`