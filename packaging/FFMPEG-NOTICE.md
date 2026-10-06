# FFmpeg sidecar notice

Correntra invokes `ffmpeg.exe` as a replaceable, separate process for
unencrypted media remuxing and audio conversion. Correntra does not link to
FFmpeg libraries and does not contain FFmpeg source code.

This package uses BtbN's FFmpeg 8.1 Windows x64 `lgpl-shared` build, pinned
to an immutable dated autobuild tag. The release gate verifies the upstream
archive SHA-256 and rejects a build whose reported configuration contains
`--enable-gpl` or `--enable-nonfree`.

- Archive: `ffmpeg-n8.1.3-9-g29e619e767-win64-lgpl-shared-8.1.zip`
- Pinned upstream tag: `autobuild-2026-09-30-13-08`
- SHA-256: `3E47BDA1607740550141E37C0E49D1E5182B34699F15ADFD137EE266D346811A`
- Upstream build scripts: <https://github.com/BtbN/FFmpeg-Builds>
- FFmpeg source: <https://github.com/FFmpeg/FFmpeg/tree/n8.1>
- Upstream binary feed:
  <https://github.com/BtbN/FFmpeg-Builds/releases/tag/autobuild-2026-09-30-13-08>

These values must stay identical to `scripts/get-ffmpeg.ps1`, which is the
single source of truth; `scripts/check-docs.ps1` enforces the match in CI.

The exact LGPLv3 license supplied by the binary distributor is included as
`LICENSE.txt` in this directory. You may replace the contents of this folder
with another compatible FFmpeg build; Correntra verifies the build before use.

