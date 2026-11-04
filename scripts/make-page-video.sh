#!/usr/bin/env bash
# Builds the page's background video from the original clip: in its ORIGINAL colours (no grade: the site palette is sampled from this clip), cut into a seamless loop
# (the last second is crossfaded into the first, so the loop has no jump), no audio, in MP4 (H.264) and WebM (VP9), plus a poster frame.
#   usage: scripts/make-page-video.sh [input.mp4] [output-dir]
#   needs ffmpeg with libx264 and libvpx-vp9. Defaults write into public/.
set -euo pipefail
IN="${1:-reference/inputs/cosmos_123539191.mp4}"
OUT="${2:-public}"
mkdir -p "$OUT"
# 5.03 s original -> crossfade the last 1 s into the first 1 s -> a 4.03 s loop. No colour grade: the clip's own electric blues on deep navy.
D=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$IN")
OFFSET=$(python3 -c "print(round($D - 2, 2))")
FILT="[0:v]format=yuv420p,split[a][b];[a]trim=start=1,setpts=PTS-STARTPTS[v1];[b]trim=end=1,setpts=PTS-STARTPTS[v2];[v1][v2]xfade=transition=fade:duration=1:offset=${OFFSET},format=yuv420p[out]"
ffmpeg -v error -y -i "$IN" -an -filter_complex "$FILT" -map "[out]" -c:v libx264 -preset slow -crf 33 -profile:v main -movflags +faststart -pix_fmt yuv420p "$OUT/page-bg.mp4"
ffmpeg -v error -y -i "$IN" -an -filter_complex "$FILT" -map "[out]" -c:v libvpx-vp9 -crf 45 -b:v 0 -row-mt 1 -pix_fmt yuv420p "$OUT/page-bg.webm"
ffmpeg -v error -y -i "$OUT/page-bg.mp4" -ss 1.6 -frames:v 1 -vf "scale=480:-2" -q:v 8 "$OUT/page-bg-poster.jpg"
ls -l "$OUT"/page-bg.mp4 "$OUT"/page-bg.webm "$OUT"/page-bg-poster.jpg
