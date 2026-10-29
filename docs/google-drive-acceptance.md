# Opt-in Google Drive acceptance on real devices

This is a manual acceptance procedure, not a report of a completed live test.
Automated transport and browser tests mock Google. They cannot establish that an
OAuth client, authorized origin, real consent popup or physical-device browser
works. Run this procedure only when the operator explicitly chooses to connect
a dedicated Google test account. No access token or recovery key belongs in a
terminal command, CI log, screenshot, issue or test report.

## Prepare the candidate

1. Use a dedicated Google test account and a non-production Nest origin. Do not
   reuse a library containing personal bookmarks. Configure the OAuth project,
   Drive API, test account and exact authorized HTTPS origin as described in
   [the sync setup guide](sync.md#set-up-google-drive-as-the-site-owner).
2. Build the candidate with its real **public** OAuth client ID, not the mock
   `test-client.apps.googleusercontent.com` value:

   ```sh
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=YOUR_PUBLIC_CLIENT_ID corepack pnpm build
   corepack pnpm start
   ```

   Both physical devices must open the same reviewed HTTPS deployment of that
   build. `localhost` can test one browser but cannot prove the two-device path.

3. Record the candidate commit, origin, date, device models and browser versions.
   Keep provider credentials, account identifiers, bookmark contents and the
   recovery key out of the report. Do not enable Playwright routing or substitute
   Google responses during this test.
4. On both devices, choose an empty workspace and add only fictional bookmarks.
   Use a unique run suffix in their titles so they are easy to identify. Save an
   encrypted local backup before testing recovery.

## Execute the journey

| Action                                                                                                                                       | Required observation                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| On device A, open **Settings → Sync & data → Set up Google Drive** and complete the real popup.                                              | The requested permission is only Nest's hidden app data (`drive.appdata`). Cancelled consent reports an error; accepting consent reaches **Up to date**. |
| Save A's recovery key privately. On device B, paste it under **Already syncing on another device?** and choose the same test Google account. | A's fictional bookmark appears on B without removing B's own bookmark. After **Sync now** on A, both devices have both records.                          |
| On B, reload the page.                                                                                                                       | **Reconnect Google** appears. After real reauthorization, the library remains intact and reaches **Up to date**.                                         |
| Take A offline. On A, edit one bookmark's note; on B, edit a different bookmark's note. Bring A online, then sync both.                      | Both independent edits converge. Offline UI does not claim a successful upload.                                                                          |
| Take A offline again. On B, remove a bookmark and sync. On A, leave its old copy unchanged, reconnect and sync.                              | The removal propagates to A and remains removed after repeated syncs. Check **Recently removed** rather than expecting history to vanish.                |
| Edit the same record on A and B at separate, recorded times, then sync both.                                                                 | The later record wins on both devices; **Revision history** makes the superseded version recoverable. Device clocks must be reasonably accurate.         |
| Disconnect Google on A. Make a local edit and reload A.                                                                                      | Local bookmarks remain, no Drive sync is claimed, and B's copy is retained. Re-pair using the saved key and verify convergence.                          |
| In a fresh, empty browser profile, try pairing with a different valid recovery key.                                                          | Pairing fails before uploading; the existing two-device library is unchanged and still syncs with its original key.                                      |
| Restore the encrypted local backup into a separate, empty profile.                                                                           | Personal records restore; Google tokens and recovery keys are absent. Restoring a backup does not silently connect a provider.                           |

If any row fails, stop and record the visible message and reproduction steps.
Do not delete hidden Drive app data to make a failing test pass. Do not overwrite
the original library or weaken permissions. Deterministic tests separately cover
quota responses, a committed upload with a lost response, cyclic pagination and
the 200-snapshot limit; exhausting a real Google account is unnecessary.

In browser developer tools, check only the destination and request type when
confirming direct Google traffic: Drive payloads must be encrypted, and Google
sync must not send the library to `/api/sync`. Do not export a HAR or copy request
headers; they contain bearer authorization. Never publish ciphertext together
with its recovery key.

## Record the result

Keep this acceptance record alongside the pull request's automated results:

```text
Live Google acceptance: NOT RUN / PASS / FAIL
Candidate commit:
HTTPS origin:
Date:
Device A / browser version:
Device B / browser version:
Real Google consent and drive.appdata permission checked:
Pairing / reload reconnect:
Independent offline edits / deletion tombstones / conflict recovery:
Disconnect / wrong-key rejection / local backup restore:
Failed row, visible error and reproduction steps (redacted):
```

Mark **PASS** only after every row is observed on the recorded devices. A green
CI run, configured client ID or successful `/api/health` response is not this
acceptance result. Remove fictional test bookmarks through Nest when finished;
their deletion history intentionally remains in sync snapshots.
