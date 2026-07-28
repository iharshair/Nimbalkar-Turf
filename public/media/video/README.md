# Video assets

This directory is intentionally empty in the repo — video files don't belong in git.

The site expects three files here, and **degrades gracefully when they're absent**:

| File | Used by | Fallback if missing |
| --- | --- | --- |
| `hero-night-turf.mp4` | Hero background | `onError` hides the `<video>` and the poster (`/media/hero-poster.svg`) stays visible |
| `match-highlight.mp4` | Gallery → Videos | Card shows its poster; the lightbox shows an empty player |
| `turf-tour.mp4` | Gallery → Videos | Same as above |

So you can develop and deploy without them. Add them when you have real footage.

## Encoding the hero loop

The hero video is decorative, muted and looping, so optimise hard for weight —
target **under 2.5 MB**. A 10–12 second loop at 1280×720 is plenty; it sits
behind a dark gradient scrim, so detail is wasted bytes.

```bash
ffmpeg -i source.mov \
  -t 12 -an \
  -vf "scale=1280:-2,fps=24" \
  -c:v libx264 -crf 30 -preset slow -profile:v main \
  -movflags +faststart -pix_fmt yuv420p \
  hero-night-turf.mp4
```

Then export a matching first frame and replace `public/media/hero-poster.svg`
with it (a real JPEG at ~80 KB), updating the `poster` attribute in
`src/components/sections/Hero.tsx` and the OG image in `src/app/layout.tsx`.

For anything larger than a few MB, host on Firebase Storage or a CDN and point
the `src` there instead of shipping it in `public/`.
