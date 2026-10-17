# Free sync and device recovery

Nest works without an account, subscription, database, or billing details. Open **Settings → Sync & data** to choose one of these paths.

| Option | Best for | Cost and limits |
| --- | --- | --- |
| Local JSON backup and restore | Changing devices, offline recovery, keeping your own copy | No service or setup. Save the file anywhere. Up to 20 MB, 10,000 bookmarks including trash, and 200 collections including removed collections. |
| Google Drive | Syncing your own devices with the same Google account | Uses the account's storage. Google accounts normally include 15 GB shared across Drive, Gmail, and Photos. Requires a free OAuth project; no Nest database. Standard API usage is currently available at no additional cost, subject to Google's quotas and policy changes. |
| Existing Neon sync | Automatic retries across sessions and optional scheduled link checking | Uses this deployment's database. Start with Neon's Free plan, monitor its current limits, and leave paid upgrades disabled. Every user's collection shares the deployment's database allowance. |

For a zero-budget deployment, start with local backups and optionally Google Drive. No paid service is provisioned by this implementation. Keep a downloaded backup even when syncing.

## Back up and restore

1. On the old device, choose **JSON** in Sync & data. Save the downloaded `nest-backup-YYYY-MM-DD.json` somewhere you can access again. Google Drive, iCloud Drive, OneDrive, Dropbox, a USB drive, or another local folder all work; these are ordinary files, not additional automatic sync providers.
2. On the new device, open Nest and choose **Choose backup** in Sync & data.
3. Review the bookmark, collection, and trash counts. Choose whether to restore appearance and preferences, then select **Restore backup**.

The versioned backup keeps IDs, timestamps, collections (including empty ones), notes, tags, favorites, read/archive states, link health, and deletion tombstones. Samples are omitted. Restoring merges with the device's existing records: the newer version wins, and repeated restores preserve IDs. Removed records stay removed unless you explicitly restore them from Recently removed. Restored changes also sync if a provider is connected.

Preferences include theme, automatic organization, effects, and link-check preference. Recovery keys, OAuth access tokens, model downloads, and device-specific model selection are excluded. Files are not encrypted, so treat a backup like a private document. Older unversioned Nest JSON exports can also be restored; information absent from those files cannot be recovered. Browser HTML/JSON imports still use **Import**. HTML export remains a flat browser-compatible list of active bookmarks.

## Set up Google Drive as the site owner

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/) and enable the [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com). Standard Drive API use does not require purchasing storage or enabling a paid database. Stay within the default quotas; no billing account is needed for the ordinary free path.
2. In **Google Auth Platform**, configure Branding and Audience for your app. Select External for ordinary Google accounts. In Testing, add your test accounts; publish the consent configuration before offering it to other users. Google may require additional branding/domain checks depending on the deployment.
3. Add only the non-sensitive scope `https://www.googleapis.com/auth/drive.appdata` in Data Access. Nest does not request access to the user's other Drive files, email, contacts, or profile.
4. Create an OAuth client of type **Web application**. Add each exact **Authorized JavaScript origin**, for example `http://localhost:3000` and `https://your-nest-domain.example`. Use a stable production origin. This popup token flow does not use a client secret or a server OAuth callback route.
5. Set the public client ID as `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in the deployment environment and rebuild/redeploy. It is a public identifier; never put a client secret in a `NEXT_PUBLIC_` variable. Use the same OAuth client and Google project for every device that should share data.
6. In Nest, choose **Connect Google Drive**. Grant access to Nest's app data, then connect the same Google account on the other device. Wait for **Up to date** before leaving the old device.

The hidden `appDataFolder` is accessible only to this OAuth application and is not a normal visible file folder in Drive. Nest sends library records directly from the browser to Google over HTTPS; its server and Neon database are not involved in Google sync. Data is not end-to-end encrypted. You can manage or remove the application's hidden data and authorization through Google's Drive/app-access settings. Removing that data removes this recovery path.

Google's browser token model gives short-lived access tokens. Tokens stay in memory, not localStorage, IndexedDB, or backup files. **Reconnect Google Drive** is required after a reload or when authorization expires; there is no refresh token or unattended background sync. While open and authorized, Nest syncs after edits, on reconnection/foregrounding, and every 30 seconds while visible. Offline edits remain in browser storage until the next authorized sync. Disconnecting stops sync on that device and keeps local and cloud copies. It does not revoke the application's Google grant.

Each device writes its own snapshot and reads/merges the other snapshots. This prevents concurrent devices from replacing each other's entire library. Modern browsers use Web Locks to serialize tabs sharing a device file; browsers without Web Locks use a separate file per tab session. Last-write-wins reconciliation keeps tombstones; equal timestamps use a deterministic tie break with removals taking precedence. Device clocks should be reasonably accurate. Unchanged snapshots are not uploaded. Permission/quota failures back off from 30 seconds to five minutes; Sync now lets the user retry immediately. Snapshots accumulate as devices are added; very large libraries or many old devices increase storage and download usage. A malformed or oversized snapshot stops sync before any file is overwritten.

Google Drive sync does not run the server's scheduled broken-link checker. That feature still requires Neon and the existing cron setup.

## Service limits

Google's current documentation says standard Drive API usage is available at no additional cost, with quotas and planned changes to excess-usage billing later in 2026. Ordinary bookmark libraries are small, but do not promise unlimited API usage or buy quota increases for this feature. Review the live limits before a wider public launch. A full Google account or denied API request pauses sync; it does not erase the device library. Local JSON transfer continues to work independently.

References checked on 2026-10-17:

- [Google account storage plans and free allowance](https://one.google.com/about/plans)
- [Drive API app data and its non-sensitive scope](https://developers.google.com/workspace/drive/api/guides/appdata)
- [Drive API quotas and pricing](https://developers.google.com/workspace/drive/api/guides/limits)
- [Google browser access-token model and expiration](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
- [Neon plans](https://neon.com/pricing)

## Verification

`pnpm test` covers backup round trips, legacy files, schema rejection, credentials exclusion, repeat restores, tombstones, deterministic conflicts, and mocked Drive transport including independent device files and failed requests. `tests/sync-backup.spec.ts` exercises downloads, restore on another browser profile, offline restore, mobile settings, and (when a Google client ID is configured in the build and test process) mocked OAuth/Drive pairing and reauthorization. These mocks do not establish that a real OAuth project is configured correctly; verify the deployed origin with two Google-authorized browser profiles before release.
