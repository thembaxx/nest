# Free sync and device recovery

Nest works without an account, subscription, database, or billing details. Open **Settings → Sync & data** to choose one of these paths.

| Option                                  | Best for                                                               | Cost and limits                                                                                                                                                                                                                                                             |
| --------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Encrypted local backup and JSON restore | Changing devices, offline recovery, keeping your own copy              | No service or setup. Save the file anywhere. Up to 20 MB, 10,000 bookmarks including trash, and 200 collections including removed collections.                                                                                                                              |
| Google Drive                            | Syncing your own devices with the same Google account                  | Uses the account's storage. Google accounts normally include 15 GB shared across Drive, Gmail, and Photos. Requires a free OAuth project; no Nest database. Standard API usage is currently available at no additional cost, subject to Google's quotas and policy changes. |
| Existing Neon sync                      | Automatic retries across sessions and optional scheduled link checking | Uses this deployment's database. Start with Neon's Free plan, monitor its current limits, and leave paid upgrades disabled. Every user's collection shares the deployment's database allowance.                                                                             |

For a zero-budget deployment, start with local backups and optionally Google Drive. No paid service is provisioned by this implementation. Keep a downloaded backup even when syncing.

## Back up and restore

1. On the old device, enter and confirm a password of at least 12 characters in Sync & data, then choose **Download encrypted backup**. Keep the `.nest` file and its password safe. JSON is also available as a readable export. Save the file locally or transfer it through Drive, iCloud Drive, OneDrive, Dropbox, or USB; these are ordinary files, not additional automatic sync providers.
2. On the new device, choose the file under **Restore on this device** in Sync & data. Enter its password if encrypted, then select **Preview backup**.
3. Review the bookmark, collection, and trash counts. Choose whether to restore appearance and preferences, then select **Restore backup**.

The versioned backup keeps IDs, timestamps, collections (including empty ones), notes, tags, favorites, read/archive states, link health, and deletion tombstones. Samples are omitted. Restoring merges with the device's existing records: the newer version wins, and repeated restores preserve IDs. Removed records stay removed unless you explicitly restore them from Recently removed. Restored changes also sync if a provider is connected.

Preferences include theme, automatic organization, effects, and link-check preference. Recovery keys, OAuth access tokens, model downloads, and device-specific model selection are excluded. Encrypted .nest backups use AES-256-GCM with PBKDF2-SHA256 (600,000 iterations), a random salt and fresh nonce. JSON and HTML files are readable, so treat them like private documents. Lost backup passwords cannot be recovered. Older unversioned Nest JSON exports can also be restored; information absent from those files cannot be recovered. Browser HTML/JSON imports still use **Import**. HTML export remains a flat browser-compatible list of active bookmarks.

## Set up Google Drive as the site owner

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/) and enable the [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com). Standard Drive API use does not require purchasing storage or enabling a paid database. Stay within the default quotas; no billing account is needed for the ordinary free path.
2. In **Google Auth Platform**, configure Branding and Audience for your app. Select External for ordinary Google accounts. In Testing, add your test accounts; publish the consent configuration before offering it to other users. Google may require additional branding/domain checks depending on the deployment.
3. Add only the non-sensitive scope `https://www.googleapis.com/auth/drive.appdata` in Data Access. Nest does not request access to the user's other Drive files, email, contacts, or profile.
4. Create an OAuth client of type **Web application**. Add each exact **Authorized JavaScript origin**, for example `http://localhost:3000` and `https://your-nest-domain.example`. Use a stable production origin. This popup token flow does not use a client secret or a server OAuth callback route.
5. Set the public client ID as `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in the deployment environment and rebuild/redeploy. It is a public identifier; never put a client secret in a `NEXT_PUBLIC_` variable. Use the same OAuth client and Google project for every device that should share data.
6. In Nest, open **Settings → Sync & data**, choose **Set up Google Drive**, and grant access only to Nest's app data. The Google sign-in script is prepared when this panel opens, rather than waiting for a mobile tap. Once **Up to date** appears, choose **Copy recovery key** and keep it in a private password manager. You can show the key as eight-character groups to verify it visually.
7. On your other device, open **Settings → Sync & data → Already syncing on another device?**. Paste the same key (spaces and hyphens are accepted) and connect the **same Google account**. Wait for **Up to date** before leaving either device. Do not choose **Set up Google Drive** to create a new key for an existing encrypted library.

The hidden `appDataFolder` is accessible only to this OAuth application and is not a normal visible file folder in Drive. Nest sends library records directly from the browser to Google over HTTPS; its server and Neon database are not involved in Google sync. New snapshots are encrypted on the device with AES-256-GCM and a random 256-bit recovery key before upload. Both the Google account and the original recovery key are required on another device; lost keys cannot be recovered. Google sees account and request metadata, but the new library payload is encrypted. The locally stored library and remembered key remain readable to someone with access to an unlocked browser. You can manage or remove the application's hidden data and authorization through Google's Drive/app-access settings. Removing that data removes this recovery path.

Google's browser token model gives short-lived access tokens. Tokens stay in memory, not localStorage, IndexedDB, or backup files. **Reconnect Google** is required after a reload or when authorization expires; there is no refresh token or unattended background sync. While open and authorized, Nest syncs after edits, on reconnection/foregrounding, and every 30 seconds while visible. Offline edits remain in browser storage until the next authorized sync. Disconnecting stops sync on that device and keeps local and cloud copies. It does not revoke the application's Google grant.

Each device writes its own snapshot and reads/merges the other snapshots. This prevents concurrent devices from replacing each other's entire library. Google sync requires Web Locks to serialize tabs sharing a device file. Local backups remain available without Web Locks. Last-write-wins reconciliation keeps tombstones; equal timestamps use a deterministic tie break with removals taking precedence. Device clocks should be reasonably accurate. Unchanged snapshots are not uploaded. Permission/quota failures back off from 30 seconds to five minutes; Sync now lets the user retry immediately. There is a limit of 200 device snapshots and 20 MB per snapshot. Snapshots accumulate as devices are added; very large libraries or many old devices increase storage and download usage. A malformed, oversized, or incorrectly encrypted snapshot stops sync before any file is overwritten.

### Upgrading the earlier Google integration

The earlier release wrote readable Google snapshots and a flat version-1 JSON backup. Both remain supported: restoring accepts both old and new backup shapes, and Google sync reads the older device files into the new encrypted snapshot. Existing files are retained so an upgrade cannot erase recovery data. A saved local/Google provider choice is respected even when an old Neon recovery key is still present; upgrading does not silently resume server sync.

Older plaintext Drive files remain readable through the Google account until removed. To replace them, first save a password-protected backup, update Nest on all your devices, remove Nest's hidden application data through Google Drive Manage apps, and reconnect/sync to create encrypted copies. Removing hidden app data erases every Nest snapshot, so keep that backup and your recovery key first. No migration automatically deletes cloud data.

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

`pnpm test` covers backup round trips, legacy files, schema rejection, credentials exclusion, repeat restores, tombstones, deterministic conflicts, and mocked Drive transport including independent device files and failed requests. `tests/sync-backup.spec.ts` checks older backup formats, repeated restores, optional preferences, offline recovery, 320px settings, and migration of existing Google snapshots. `tests/sync-data.spec.ts` checks encrypted downloads, pairing between profiles, offline edits, reauthorization, and recovery after a lost upload response. These mocks do not establish that a real OAuth project is configured correctly; verify the deployed origin with two Google-authorized browser profiles before release.
