# Acceptance Tests — MVP1

Manual BDD suite for validating the UI and the end-to-end journeys before
taking ownership of the code. Written 2026-08-28, covers Phases 0–6.

---

## How to use this

Work top to bottom. Each `Scenario` is a checkbox — tick it when the
**Then** steps all hold. Features are ordered so earlier ones set up state
for later ones; do **Feature A (Connection)** first.

### Prerequisites

- Spotify **Premium** account (playback control needs it; triage + notes
  work without it, see Feature I).
- At least **two Spotify devices** reachable (phone + desktop app, or a
  speaker) — needed for the device-picker and fallback scenarios.
- A few of **your own playlists** exist (for the Banger picker).
- App running: `npm install && npm run dev`, open **http://127.0.0.1:5173**.
- `.env` filled with your client id/secret and redirect URI
  `http://127.0.0.1:8888/callback` (already done).

### This suite has side effects on your real account

You will **Like** tracks, **save/remove albums**, and **add tracks to a
playlist**. Use a throwaway playlist as the Banger target, and see the
**Appendix** for how to reset local state and undo account changes.

### Terms

- **home** = the `/` page (Now Playing panel + Recently-listened list below it)
- **big Like / big Banger** = the two large buttons under the transport controls on home
- **row Like / row Banger** = the small buttons on each recently-listened / tracklist row

---

## Feature A — Connect to Spotify

```gherkin
Feature: Spotify connection
  As a listener
  I want the app linked to my Spotify account
  So that it can read and control my listening

  Background:
    Given the app is running
    And I am on the Settings page

  Scenario: First run shows a connect prompt
    Given I have never connected (data/.auth.json does not exist)
    When I open any page
    Then every page shows "Spotify isn't connected" with a link to Settings
    And Settings shows a green "Connect Spotify" button
    OK @sergio

  Scenario: Connecting
    When I click "Connect Spotify"
    Then I am sent to accounts.spotify.com to approve the app
    When I approve
    Then I land back on Settings with a green banner "Connected to Spotify."
    And Settings shows "Connected as <my name>"
    And it shows "10 granted" scopes and a token-expiry time
    OK @sergio


  Scenario: Declining
    When I click "Connect Spotify" and then cancel on Spotify's screen
    Then I land on Settings with a red banner about declining
    And I am still not connected

  Scenario: Connection survives a server restart
    Given I am connected
    When I stop the dev server (Ctrl-C) and run `npm run dev` again
    And I reload the app
    Then Settings still shows "Connected as <my name>" without re-approving
    OK @sergio

  Scenario: Access token refreshes transparently (dev build only)
    Given I am connected
    When I click "Expire access token" in the Developer section
    And I reload the Settings page
    Then the status still shows "Connected" (a refresh happened silently)
    When I click "Corrupt access token (force 401)"
    And I reload
    Then the status recovers to "Connected" again
    OK @sergio

  Scenario: Disconnecting
    When I click "Disconnect"
    Then the status returns to "Not connected" with a Connect button
    And data/.auth.json is removed
    OK @sergio

  Scenario: Missing credentials
    Given SPOTIFY_CLIENT_ID / SECRET are blank in .env
    When I open Settings
    Then it tells me to add them to .env and restart
    And "Connect Spotify" is not offered
    OK @sergio

```

---

## Feature B — Now Playing

```gherkin
Feature: Now Playing panel
  As a listener
  I want to see and control what is playing

  Background:
    Given I am connected
    And something is playing in any Spotify app

  Scenario: The panel reflects reality
    When I open home
    Then within a few seconds it shows the current track name, artist,
      album, and cover art
    And "Playing on <device name>" is shown
    And the progress bar advances roughly in real time
    OK @sergio


  Scenario: Album position
    Given the current track is being played from its album (not a playlist)
    Then the panel shows "track N of M"
    OK @sergio


  Scenario: Pause and resume
    When I click "Pause"
    Then the button flips to "Play" immediately
    And the music stops within ~1 second
    When I click "Play"
    Then the music resumes and the button flips back to "Pause"
    OK @sergio


  Scenario: Skip
    When I click the ⏭ button
    Then playback advances to the next track and the panel updates
    When I click ⏮
    Then it goes back
    OK @sergio


  Scenario: Seek by clicking the bar
    When I click near the right end of the progress bar
    Then playback jumps to roughly that position
    And the elapsed / remaining times update
    OK @sergio // this is crazy we have our own client

  Scenario: Album link
    When I click the album name in the panel
    Then I land on that album's page
    OK @sergio


  Scenario: Nothing playing
    Given playback is stopped on every device
    When I open home
    Then it says "Nothing is playing" with a hint to start Spotify or pick
      a device
    And the recently-listened list is still shown below
    OK @sergio

```

---

## Feature C — Playback device

```gherkin
Feature: Device selection
  As a listener
  I want to choose where playback happens

  Background:
    Given I am connected
    And I am on Settings, in the "Playback device" card

  Scenario: Devices are listed
    Then I see each of my active Spotify devices with its name and type
    And the currently-active one is tagged "active"
    OK @sergio


  Scenario: Setting a preferred device persists
    When I select a device with the radio button
    And I reload the page
    Then that device is still selected
    And data/config/settings.json shows its id as preferredDeviceId
    OK @sergio


  Scenario: Play here
    Given a device is not the active one
    When I click "Play here" on its row
    Then playback transfers to that device within a couple of seconds
    OK @sergio


  Scenario: Fallback when nothing is active
    Given no device is currently active
    And I have set a preferred device
    When I press Play on home, or "Play album" anywhere
    Then playback starts on the preferred device
    And it starts from the beginning of the track/album
    OK @sergio

  Scenario: No device and no preference
    Given no device is active and no preferred device is set
    When I try to Play
    Then I get a calm message: "No active Spotify device. Open Spotify
      somewhere, or pick a device in Settings."
    OK @sergio  

```

---

## Feature D — Track triage (Like + Banger)

```gherkin
Feature: Like and Banger
  As a listener
  I want to pull the good tracks out as I listen

  Background:
    Given I am connected
    And a Banger playlist is configured (Feature E)
    And a track is playing

  Scenario: Like the current track with the button
    When I click the big Like button
    Then it fills in (♥ "Liked") immediately
    And the track appears in my Spotify "Liked Songs"
    When I click it again
    Then it un-likes and the track leaves Liked Songs

  Scenario: Like with the keyboard
    Given focus is not in a text field
    When I press "L"
    Then the current track's Like state toggles

  Scenario: Banger the current track
    When I click the big Banger button (or press "B")
    Then the button shows "✓ <label>" and becomes disabled
    And the track is added to the configured Banger playlist
    And the track is also added to Liked Songs (auto-like)

  Scenario: Banger is idempotent
    Given the current track is already in the Banger playlist
    Then the Banger button already shows "✓ <label>" and does nothing
    And pressing it does not create a duplicate in the playlist

  Scenario: Triage a past track from the list
    Given the recently-listened list shows a track I played earlier
    When I click that row's Like (or Banger)
    Then it acts on that track, not the current one
    And the row's state updates

  Scenario: State matches Spotify
    Given I Liked / Bangered some tracks
    When I refresh the app (or wait ~15s for the list to poll)
    Then each row's ♥ / ✓ state matches what Spotify actually shows

  Scenario: Hotkeys are ignored while typing
    Given my cursor is in the notes box of the verdict dialog
    When I type a word containing "l" or "b"
    Then nothing is Liked or Bangered
```

---

## Feature E — Banger playlist configuration

```gherkin
Feature: Choosing the Banger playlist
  Background:
    Given I am connected
    And I am on Settings, in the "Banger playlist" card

  Scenario: Only editable playlists are offered
    Then the dropdown lists my own + collaborative playlists
      (not playlists I merely follow)

  Scenario: Changing the target
    When I pick a different playlist
    Then data/config/buttons.json updates its playlistId
    And the recently-listened list re-checks membership against the new
      playlist (rows' ✓ state may change)

  Scenario: No playlist set
    Given buttons.json has an empty playlistId
    When I open home
    Then a "Set a Banger playlist →" hint links to Settings
    And pressing Banger returns a message telling me to pick one
```

---

## Feature F — Backlog

```gherkin
Feature: Album backlog
  As a listener
  I want a queue of albums to work through

  Background:
    Given I am connected
    And I am on the Backlog page

  Scenario: Search and add
    When I type an album name in the search box
    Then after a moment I see matching albums with cover, artist, year
    When I click "Add" on one
    Then it appears as a card in the backlog list
    And the card shows "year · N tracks · <duration>"
    OK @sergio

  Scenario: Add by link
    When I paste an open.spotify.com/album/... URL into the search box
    Then the search results are replaced by an "Add album from link" button
    When I click it
    Then that album is added to the backlog

  Scenario: No duplicates
    Given an album is already in the backlog
    When I try to add it again (its search row shows "Added")
    Then the backlog count does not increase

  Scenario: Reorder
    When I click ▲ / ▼ on a card
    Then the card moves up / down and the order persists on reload

  Scenario: Remove
    When I click "Remove" on a card
    Then it disappears and does not come back on reload

  Scenario: Play album
    Given I have an active or preferred device
    When I click "Play album" on a card
    Then that album starts playing from track 1
    OK @sergio

  Scenario: Open the album
    When I click a card's cover or title
    Then I land on that album's page

  Scenario: Empty backlog
    Given the backlog is empty
    Then the page says so and points me at the search box
    OK @sergio

  Scenario: A removed-from-Spotify album degrades gracefully
    Given an album in the backlog no longer resolves on Spotify
    Then its card shows "album unavailable" but the rest of the list works
```

---

## Feature G — Album experience

```gherkin
Feature: Album page
  As a listener
  I want the full album context while I listen

  Background:
    Given I am connected
    And I am on an album's page (from the backlog or "View album")

  Scenario: Header metadata
    Then I see the cover, album name, artist(s)
    And a line with year · track count · total duration · label
    And genres (if Spotify provides any)
    And a copyright line near the lyrics
    OK @sergio

  Scenario: Full tracklist
    Then every track is listed with its number, title, and duration
    And explicit tracks show an "E" tag
    And a track has track-level Like and Banger buttons
    OK @sergio

  Scenario: Selecting a track shows its lyrics
    When I click a track row
    Then the row highlights
    And the lyrics panel switches to that track's lyrics
    And the panel heading reads "<track name> — lyrics"
    OK @sergio

  Scenario: Play from a track
    When I click a row's number (it becomes ▶ on hover) 
    Then playback starts the album from that track
    OK @sergio

  Scenario: Synced lyrics follow the music
    Given the selected track is the one currently playing
    And that track has time-synced lyrics on LRCLIB
    Then the current line is highlighted and the panel auto-scrolls to it
    And past lines are dimmed
    OK @sergio 

  Scenario: Lyrics fallbacks
    Given a track has only plain lyrics
    Then the panel shows the plain text
    Given a track is instrumental on LRCLIB
    Then the panel says "Instrumental."
    Given a track has no lyrics anywhere
    Then the panel says "No lyrics found."
    And the rest of the album still works
    OK @sergio 


  Scenario: Backlog toggle
    Given the album is in my backlog
    Then a "Remove from backlog" button is shown
    Given it is not
    Then an "Add to backlog" button is shown, and clicking it adds it
    NOTOK @sergio - add to backlog here seems broken, review.


  Scenario: Track-level triage state is accurate
    Then a track I have already Liked shows a filled ♥
    And a track already in the Banger playlist shows "✓ <label>"
    NOTOK @sergio - tracks liked on spotify not reflect as liked in this app.

```

---

## Feature H — Verdict and review

```gherkin
Feature: Finishing an album
  As a listener
  I want to record a verdict and clear the album from my backlog

  Background:
    Given I am connected
    And I am on an album's page for an album in my backlog

  Scenario: Opening the dialog
    When I click "Finish album"
    Then a dialog opens with four verdicts (Keep / Revisit / Pass / Delete),
      a 1–10 rating, a tags field, and a notes box
    OK @sergio


  Scenario: Pass
    When I choose "Pass", add a note, and click "Save & clear"
    Then the dialog closes
    And the album is gone from my backlog
    And a file data/reviews/2026/<artist>-<album>.md is written with my
      note and `verdict: pass`
    And nothing changes in my Spotify library
    OK @sergio


  Scenario: Keep
    When I choose "Keep" and save
    Then the album is saved to my Spotify "Saved Albums"
    And the review file records `verdict: keep`
    And it leaves the backlog
    OK @sergio


  Scenario: Revisit
    When I choose "Revisit" and save
    Then the album appears on the Revisit page
    And a review file is written
    And it leaves the backlog
    OK @sergio



  Scenario: Delete
    Given the album is currently in my Saved Albums
    When I choose "Delete" and save
    Then the album is removed from my Saved Albums
    And a review file records `verdict: delete`

  Scenario: Rating and tags are captured
    When I pick a rating and enter "tag one, tag two"
    Then the review file has `rating:` and a `tags:` list
    OK @sergio


  Scenario: Re-reviewing
    Given a review already exists for this album
    Then the album page shows a banner with the prior verdict + notes
    And the button reads "Update review"
    When I open it, the dialog is pre-filled with the prior values
    When I change the verdict and save
    Then the file is updated and `listenedOn` (the original date) is kept
    OK @sergio


  Scenario: Escape / backdrop close
    When I press Escape or click outside the dialog
    Then it closes without saving
    OK @sergio

```

---

## Feature I — Revisit list

```gherkin
Feature: Revisit page
  Background:
    Given I am connected
    And I have marked at least one album "Revisit"

  Scenario: The list
    When I open the Revisit page
    Then each album shows its cover, name, artist
    And its prior verdict, rating, and notes preview
    And a "revisited N×" count if it has been through more than once
    OK @sergio


  Scenario: Acting on a revisit item
    When I click "Play"
    Then the album starts playing
    When I click "Open"
    Then I land on the album page, where I can Update the review
    OK @sergio


  Scenario: Completing a revisit
    Given an album is on the Revisit page
    When I open it and give it a non-Revisit verdict (Keep / Pass / Delete)
    Then it disappears from the Revisit page
    And its review's `revisitedOn` gains today's date
    OK @sergio

```

---

## Feature J — Resilience and edge cases

```gherkin
Feature: Graceful failure

  Scenario: Not connected
    Given data/.auth.json is absent
    Then home, Backlog, Revisit, and album pages all show a connect prompt
      rather than an error or a blank screen

  Scenario: Server down
    Given the dev server is stopped
    When I have the app open
    Then the header status dot turns red ("api offline")
    And actions show an error message, not a stuck spinner

  Scenario: Free (non-Premium) account
    Given I am connected with a non-Premium account
    Then reading works (now-playing, recent, lyrics, backlog)
    And playback controls return Spotify's "Premium required" message
      shown as a dismissible error, not a crash

  Scenario: No active device for a control
    When I press Pause / Next with nothing active
    Then I get a clear message and the app stays usable

  Scenario: Rate limiting (hard to force manually)
    Given Spotify returns 429 under heavy use
    Then the server retries after the Retry-After delay
    And the user sees at worst a slightly delayed response, not an error
    # verify indirectly: the app stays responsive during rapid clicking

  Scenario: Review files are clean
    When I open a generated review .md
    Then it has valid YAML frontmatter and my notes below `---`
    And it is a sensible thing to commit to git
```

---

## Full journey — smoke test

```gherkin
Feature: A deliberate listening session end to end

  Scenario: Backlog to review
    Given I am connected with a working device
    And a throwaway Banger playlist is set in Settings

    When I add 3 albums to my backlog by search
    And I reorder them so the one I want first is on top
    And I click "Play album" on the top one
    Then it starts playing from track 1

    When I open that album's page
    Then I see the tracklist and lyrics start loading
    When the third track plays and I like it
    Then the big Like fills in and it lands in Liked Songs
    When I hit "B" on a standout track
    Then it lands in the Banger playlist and Liked Songs
    When I click through a few tracks
    Then each one's lyrics load, with the playing track's lyrics synced

    When the album ends and I click "Finish album"
    And I choose "Keep", rate it 8, tag it, write two lines, and save
    Then the album is saved to my Spotify library
    And it is gone from my backlog (now 2 albums)
    And data/reviews/2026/ has a new .md file with my review

    When I mark the second album "Revisit" the same way
    Then it shows on the Revisit page
    And the backlog is down to 1

    Then I can close the app, come back tomorrow, and everything —
      connection, backlog, reviews, revisit list — is still there
```

---

## Appendix — where state lives, and how to reset

| What | Where | Reset |
|---|---|---|
| Spotify refresh token | `data/.auth.json` (git-ignored) | delete it, or click Disconnect |
| Preferred device | `data/config/settings.json` | edit to `{"preferredDeviceId": null}` |
| Banger playlist | `data/config/buttons.json` | edit `banger.playlistId` |
| Backlog | `data/config/backlog.json` | `{"items": []}` |
| Revisit list | `data/config/revisit.json` | `{"items": []}` |
| Reviews | `data/reviews/<year>/*.md` | delete the files |
| Spotify metadata / lyrics cache | `data/cache/` (git-ignored) | `rm -rf data/cache` |

**Undoing account changes made during testing:**
- Liked test tracks → remove from Liked Songs in Spotify
- Bangered test tracks → remove from the throwaway playlist (and Liked Songs)
- "Keep" verdicts → the album is in your Saved Albums; remove there if unwanted
- "Delete" verdicts → the album was removed from Saved Albums; re-save if it was yours

**Known rough edges (tracked in `implementation-plan.md` Phase 7):**
- Nav bar and backlog cards overflow below ~360 px width
- Album tracklist "play from here" only appears on hover (no touch target)
- Thumbnails load full-size images; polling continues while the tab is hidden
- Not reachable from a separate phone (server binds `127.0.0.1` only)
