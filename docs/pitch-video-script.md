# Gatefold — pitch / demo video

Working doc: critique of your brainstorm, then a tightened shot‑by‑shot script.

**Decisions locked:**
- Audience: **music listeners**, not the dev/AI crowd.
- The AI‑built angle is **one honest sentence** and nothing more.
- License framing: brief, friendly, states the AGPL boundary once. Staying AGPL.

---

## Part 1 — Honest critique of the brainstorm

### What already works
- **The hook is right.** "Miss the album‑listening experience of physical media"
  is a real feeling and a real audience. Keep it.
- **The honest, personal framing** (bored, incapacitated, wanted an AI
  experiment) is charming and disarming. Keep a *trace* of it — one sentence.
- **You know the product cold.** Every feature you listed is worth showing.

### What to fix

1. **Audience is locked to music listeners.** The draft drifted toward a second
   video about building an app with AI. That angle now gets exactly one honest
   sentence ("I wanted to try building something mostly by talking to an AI")
   and is never returned to. Don't tease the AI process, don't promise a
   how‑it‑was‑built payoff — this is a video about a listening tool.

2. **The backstory is a paragraph; it should be a sentence.**
   "I've been incapacitated for two weeks and very bored" — that's the whole
   thing. Cut the rest. The viewer came for the app.

3. **Demo the *journey*, not the *UI*.** Your draft walks the menus
   ("this is the UI, here's a list, here's a backlog, here's the album view…").
   Instead: **run one album end to end.** Queue it → start it → read lyrics and
   context while it plays → hit Banger on a great track → finish it → leave a
   verdict and a review. That arc *is* the pitch. Everything else (playlist
   import, revisit list) is a 20‑second "there's also this" afterward.

4. **Land the emotional payoff.** The point of the app isn't the buttons — it's
   finishing a record and writing down what you thought while it's still in your
   chest. Structure the demo so it *ends* on the review screen, not on a feature
   list.

5. **The "pricing" section is too formal for a free AGPL project.** "Let's talk
   pricing. This app is completely free." → just say "It's free and
   open‑source, AGPL." One breath.

6. **"Spotify, give me a job" — one throwaway line, said once, with a smile.**
   Belaboring it reads as desperate and undercuts the confident tone the rest
   of the video should have.

7. **State the caveats plainly, not apologetically.** Self‑hosted; you need your
   own Spotify developer app; Premium only for playback *control* (observing +
   triage + reviews work without it); reaching it from your phone needs HTTPS in
   front. These are facts, not confessions. Say them fast and move on.

8. **End on a call to action that isn't just the coffee link.** "Star the repo,
   open an issue, send a PR" first; coffee link second.

### Factual corrections (your draft got a few things fuzzy)

| Draft said | Actually |
|---|---|
| context "from Wikipedia" | Wikipedia **+ MusicBrainz + Discogs** (blurb, personnel/credits, label) |
| lyrics from "a different provider" | **LRCLIB** — free, no key; synced or plain; sometimes missing a track |
| "there's a reject one, I don't remember" | The fourth verdict is **Delete** = Pass **and** removes the album from your saved albums if it was there |
| Banger "sends to a playlist" | Banger adds to your chosen playlist **and** auto‑Likes the track |
| "add to library button" | It's the **Like** button (save to Liked Songs) — `L` on the keyboard |
| Revisit "a special backlog" | A **separate Revisit list**; replaying shows your **prior review + rating** alongside now‑playing |
| "it has a license" | **AGPL‑3.0** specifically — modified network service → must publish changes. This already blocks the "closed paid SaaS fork" scenario; say the boundary once, don't dwell. |
| keyboard | `P` play/pause, `L` like, `B` banger |

### Suggested length
Aim **4–6 minutes**. Your draft, read aloud, is ~8–9 min of mostly talking. The
cut below is ~5.

---

## Part 2 — The script

Format: **[VISUAL]** = what's on screen · **VO** = what you say.
Record the demo screen‑capture separately and narrate over it — don't try to
talk and click live.

---

### 0:00 – 0:10 · Cold open (no talking)

**[VISUAL]** Straight into the app: an album view, cover art, the tracklist,
synced lyrics scrolling a line at a time, the ambient player bar at the bottom.
Hold ~6 seconds. Music you can *just* hear under it.

**[VO]** *(none — let it breathe, then hard cut to you)*

---

### 0:10 – 0:35 · Hook

**[VISUAL]** Talking head.

**VO:**
> Remember when listening to an album meant *sitting with it* — the sleeve in
> your hands, the liner notes, going front to back in order? Streaming kind of
> killed that. I missed it enough that I built a thing to get it back. It's
> called Gatefold.

---

### 0:35 – 1:05 · What it is (and the honest disclosure)

**[VISUAL]** Talking head, then cut to the backlog screen.

**VO:**
> Quick honesty: I've been laid up at home for a couple of weeks and very bored,
> and I wanted to try building something almost entirely by talking to an AI
> instead of writing the code myself. Gatefold is what came out.
>
> It's a self‑hosted companion app that sits *on top of* Spotify. It is **not**
> a Spotify player and not a downloader. It's for one person, working through a
> backlog of albums, one at a time, front to back — and then actually writing
> down what they thought.

---

### 1:05 – 1:40 · Core loop, step 1: the backlog

**[VISUAL]** Screen capture. Show the backlog list. Add an album (search or
paste a link). Then hit play on one — call out that **shuffle is forced off**.

**VO:**
> Everything starts here. You queue albums — search, paste a link, or import
> every album out of a playlist a friend sent you. You pick one, and it starts
> playing on whatever device you already have Spotify open on — with shuffle
> forced off, because that's the whole point.

---

### 1:40 – 2:30 · Core loop, step 2: listening with context

**[VISUAL]** The album view. Scroll the full tracklist. Open the **About this
album** panel — blurb, personnel/credits, label. Then the lyrics: click a track
that *isn't* playing and show its lyrics anyway. Show a synced/timestamped one
following along.

**VO:**
> While it plays, this is where you live. Full tracklist. An "about this album"
> panel — a short blurb, the personnel and credits, the label — pulled from
> Wikipedia, MusicBrainz and Discogs, so you get a feel for who actually made
> this and when.
>
> And the lyrics — from LRCLIB, a free open source lyrics database. The nice
> part: you can read the lyrics of **any** track without playing it. So on a
> concept album you can flip back to an earlier song and check — *wait, was
> this referenced before?* If the lyrics are timestamped they'll follow along;
> if a track's missing, it just says so.

---

### 2:30 – 3:05 · Core loop, step 3: triage while you listen

**[VISUAL]** The now‑playing bar. Hit **Like**. Then hit **Banger** on the
current track — show the little confirmation. Mention the keyboard keys with a
lower‑third or just point.

**VO:**
> Two buttons while you listen. **Like** saves the track to your Liked Songs —
> basically the "add to library" button Spotify took away. And **Banger** — for
> that moment where a song floors you and you know you'll never find it again.
> One press: it goes into a playlist you picked in settings, and it gets Liked
> too. You can hit either one on the current track or any recent one. `P`, `L`,
> `B` from the keyboard.

---

### 3:05 – 3:55 · Core loop, step 4: the verdict + review (the payoff)

**[VISUAL]** Album finishes. The verdict prompt appears. Show the four options.
Pick one. Then the review form: rating out of 10, tags, free‑text notes. Type a
real sentence or two. Save. Land on the finished review and hold.

**VO:**
> Then the album ends, and Gatefold makes you decide. Four verdicts:
> **Keep** saves it to your library. **Revisit** parks it in a separate list
> for another pass later. **Pass** is the default — not for me, move on.
> **Delete** is Pass *and* pull it out of my saved albums, get it away from me.
>
> And you leave a review — a score out of ten, some tags for how it felt or what
> genre you think it is, and notes. It's saved as plain Markdown that you own.
> That's the actual point of the app: consciously keep the gold, let everything
> else go — and remember why.

---

### 3:55 – 4:20 · The "there's also" round

**[VISUAL]** Quick cuts: the Revisit list (with a prior review shown next to
now‑playing), the playlist‑import screen, editing an older review.

**VO:**
> A few other things, quickly: the Revisit list replays an album with your old
> review sitting right next to it, so you can amend it. Playlist import pulls in
> whole albums, not just loose tracks. And every review stays editable later.

---

### 4:20 – 4:35 · Roadmap / invite

**[VISUAL]** Back to the album view; gesture at the cover art area.

**VO:**
> What I want next is more of the *physical* feeling — bigger art, the gatefold
> sleeve, liner‑note texture. It's a companion for how you listen, and it's not
> done.

---

### 4:35 – 5:05 · How to get it + caveats

**[VISUAL]** The GitHub repo. The `docker compose up -d` block from the README.
The Settings page showing the Spotify client ID field and the redirect URI.

**VO:**
> It's free and open source. It runs as one Docker container — repo and full
> instructions are in the description. Fair warning on the setup: it's
> self‑hosted, and you create your own Spotify developer app and paste the
> client ID in. You only need Spotify Premium for playback *control* — watching
> and triaging and reviewing work without it. And getting to it from your phone
> means putting HTTPS in front of it; the docs walk through that.

---

### 5:05 – 5:30 · License, contributing, outro

**[VISUAL]** Talking head. LICENSE file / contributing section on screen briefly.

**VO:**
> It's free and open source, under the AGPL. Use it, run it, change it. The one
> rule that matters: if you run a modified version as a service, your changes
> have to be open too — same as mine. If Gatefold helps you, star the repo or
> send a PR — I'm watching them. Coffee link's in the description if you want to
> chip in.
>
> And Spotify — if you're seeing this, big fan. Give me a job.
>
> That's it. Hope it changes how you listen to something this week. Thanks for
> watching.

---

## Rejected: the AI‑build angle

Considered and dropped. Leading with "I built this by talking to an AI" pulls in
a different audience and sets up a how‑it‑was‑built payoff this video doesn't
deliver. It stays as one throwaway sentence at 0:35 and nothing more.
