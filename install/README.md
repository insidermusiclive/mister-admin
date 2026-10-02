# Installing Mister Admin in your own Cloudflare account

You need: a free Cloudflare account (https://dash.cloudflare.com/sign-up) and Node.js (https://nodejs.org, the LTS version).

1. Download the zip of Mister Admin and unzip it.
2. Open the `install` folder.
3. **Mac:** double-click `install-mac.command`. If macOS says it cannot be opened, right-click it, choose **Open**, then **Open** again.
   **Windows:** double-click `install-windows.bat`.
4. A browser window opens asking you to log into Cloudflare. Click **Allow**.
5. Wait about two minutes. The window prints your personal admin address and opens it.
6. On the Welcome screen create your administrator account. Done.

If the installer says R2 is not enabled: open https://dash.cloudflare.com, click **R2**, enable it
(free up to 10 GB; Cloudflare may ask for a card but does not charge within the free limits), then run the installer again.

To update to a newer version later: unzip the new version over the old folder and run the installer again.
Your data is in Cloudflare, not in the folder, so nothing is lost.
