# Push the layover and README update

This ZIP includes the complete public source, the layover fix, the updated README and its PNG/SVG architecture diagram. Your reset cleanup is already in GitHub (`Remove obsolete private backend files`), so this update can be copied over the current public source.

1. Extract the ZIP. Open its `traveliq-public` folder; it contains `package.json`, `README.md`, `src` and `docs`.
2. Open PowerShell and download a fresh copy of your repository:

   ```powershell
   cd "$env:USERPROFILE\Downloads"
   git clone https://github.com/gliminmorais/TravelIQ.git TravelIQ-layover-update
   cd TravelIQ-layover-update
   ```

3. In File Explorer, copy **all contents inside the extracted `traveliq-public` folder** into `Downloads\TravelIQ-layover-update`. Choose **Replace the files in the destination**. Put the files directly in the repository root, beside its existing `package.json`; do not paste the outer `traveliq-public` folder as a nested folder. Preserve the repository's `.git` folder.
4. Return to the same PowerShell window and run:

   ```powershell
   git status
   git add .
   git commit -m "Show final layover destination and add architecture README"
   git push origin main
   ```

5. Complete GitHub sign-in if prompted. On GitHub, open the README and confirm that the architecture picture is visible.
6. In Vercel, open the project serving `traveliqdemo.vercel.app`. Under Deployments, wait for the commit from step 4 to become **Ready**. If no deployment starts automatically, use **Create Deployment**, select `main` and deploy its latest commit.
7. Open the site and press **Ctrl + Shift + R**. A saved connecting ticket with `TRV → BLR` and `BLR → MAA` should now show **TRV → MAA, via BLR**. Opening the booking still shows both flight legs. No re-import or demo reset is necessary.

If any command reports an error, stop at that step and share the message. If the clone folder already exists, use your existing clean checkout or choose a different folder name instead of deleting it.
