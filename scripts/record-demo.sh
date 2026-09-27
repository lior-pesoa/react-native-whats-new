#!/usr/bin/env bash
# Record the booted iOS simulator (or a connected Android device) and turn
# the clip into the README's demo GIF.
#
#   scripts/record-demo.sh            # iOS simulator (booted)
#   scripts/record-demo.sh android    # adb device, max 180 s
#
# Press Ctrl-C to stop recording. Output: docs/demo.mp4 + docs/demo.gif.
# Needs ffmpeg (brew install ffmpeg).
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p docs
RAW="$(mktemp -t whats-new-demo).mp4"
platform="${1:-ios}"

stop() { :; }
trap stop INT

if [ "$platform" = "android" ]; then
  echo "Recording Android — Ctrl-C to stop."
  adb shell screenrecord --bit-rate 8000000 /sdcard/whats-new-demo.mp4 || true
  sleep 1
  adb pull /sdcard/whats-new-demo.mp4 "$RAW" >/dev/null
  adb shell rm /sdcard/whats-new-demo.mp4
else
  echo "Recording the booted iOS simulator — Ctrl-C to stop."
  xcrun simctl io booted recordVideo --codec=h264 --force "$RAW" || true
fi
trap - INT

# A web-friendly MP4 (GitHub plays these inline too) and a GIF.
ffmpeg -loglevel error -y -i "$RAW" -vf "scale=720:-2" -c:v libx264 \
  -pix_fmt yuv420p -crf 26 -movflags +faststart -an docs/demo.mp4
ffmpeg -loglevel error -y -i "$RAW" -vf \
  "fps=20,scale=360:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4" \
  docs/demo.gif
rm -f "$RAW"

ls -lh docs/demo.mp4 docs/demo.gif
echo "Next: replace <!-- demo gif --> in README.md with ![demo](docs/demo.gif)"
