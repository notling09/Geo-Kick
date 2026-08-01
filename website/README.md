# Geo-Kick — Landing page

A single, self-contained landing page (`index.html`) for the Geo-Kick Android game.
No build step, no dependencies: all CSS, the app icon (data URI) and SVG art are
inlined, so the file works as-is when opened locally or hosted anywhere static.

## Download buttons

The two buttons point at the **latest GitHub Release** with stable, version-agnostic
asset names, so they keep working across future releases without editing the page:

- `https://github.com/notling09/Geo-Kick/releases/latest/download/GeoKick-arm64.apk`
- `https://github.com/notling09/Geo-Kick/releases/latest/download/GeoKick-armv7.apk`

For these links to resolve, publish a GitHub Release whose attached files are named
exactly `GeoKick-arm64.apk` (64-bit / arm64-v8a) and `GeoKick-armv7.apk` (32-bit /
armeabi-v7a).

## Deploy to Vercel

Static site, no configuration needed:

1. Push this repo to GitHub (already done).
2. In Vercel: **New Project → Import** this repo.
3. Set **Root Directory** to `website`. Framework preset: **Other**. No build command,
   output is the folder itself.
4. Deploy. Vercel serves `index.html` automatically.

Then link to the deployed URL from your portfolio site.
