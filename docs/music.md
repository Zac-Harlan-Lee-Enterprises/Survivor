# Music

The champion's scene (`src/components/crowning.ts`) has one cue, played by
`src/components/music.ts`:

| File | Plays | Source | Cut |
|------|-------|--------|-----|
| `public/audio/crowning.m4a` | from the moment the light comes down, looping until the page is left or it is silenced | "Winning Awards - Celebration Symphony" by Sonican, [Pixabay](https://pixabay.com/music/main-title-winning-awards-celebration-symphony-424004/) | 3–117.5 s (starts so the swell lands with the confetti; stops before the ending tail, for the loop) |

It is under the [Pixabay Content License](https://pixabay.com/service/license-summary/):
free to use in a project like this one, no attribution required (given here anyway).
It is used inside the site, not offered as a file to download.

To change it: download the MP3 from Pixabay and cut it with
`python3 scripts/cut-music.py IN.mp3 public/audio/crowning.m4a --start S --length L`
(macOS only: it uses `afconvert`).

**Sound and the viewer.** Browsers hold sound back on a page nobody has touched;
the music then comes in at the first tap, click or key, where the scene has got to.
A speaker switch sits in the corner while music is on: it silences it and
remembers that on the device (`localStorage`, `survivor.music.muted`), or brings it
back. Viewers who prefer reduced motion get no scene, so no music.
