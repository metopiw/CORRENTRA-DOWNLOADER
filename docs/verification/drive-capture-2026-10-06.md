# Drive download handoff verification — 2026-10-06

Validated on Windows with .NET SDK 8.0.424 and Node.js 24.19.0.

- Debug solution build: 0 warnings, 0 errors.
- All six .NET test projects: 308 passed, no failures or skips.
- Extension event regression suite: 14 passed. Covers refreshed Drive URL/name,
  request cookies/authentication, duplicate events, late HTTP metadata, private
  session isolation, expiration, cancellation, failure recovery and POST fallback.
- A loopback server rejects missing browser Cookie, Authorization, Referer or
  an altered User-Agent. Probe and segmented transfer passed, with SHA-256.
- Redirect tests retain credentials on the same origin and strip them when
  the origin changes.
- Documentation gate and formatting check for changed C# files passed.

Live agent bridge downloads (`scripts/test-bridge.ps1`):

| Source | Result | Verification |
| --- | --- | --- |
| GitHub raw, repository LICENSE.txt | Completed (9), 3,890 bytes | SHA-256 matches independently downloaded source |
| W3C, /Icons/w3c_home.png | Completed (9), 1,848 bytes | SHA-256 matches independently downloaded source |
| Public Google Drive sample spam.txt | Completed (9), 5 bytes | Contents `spam` followed by LF; SHA-256 `284E3029CCE3AE5EE0B05866100E300046359F53AE4C77FE6B34C05AA7A72CEE` |

The public Drive sample is referenced by the gdown project's README, file ID
`0B9P1L--7Wd2vU3VUVlFnbTgtS2c`. Its viewer's download button opened
`https://drive.usercontent.google.com/download?id=0B9P1L--7Wd2vU3VUVlFnbTgtS2c&export=download`;
that observed URL was offered to the live agent and confirmed via the bridge.
Existing filenames are safely uniquified (`spam (2).txt`, for example).

Limitations: the available browser automation exposes the in-app browser,
without the Correntra Chrome/Edge extension. Actual Chrome/Edge event delivery
and a signed-in/private Drive download remain unverified; those capture paths
are covered with mocked browser events and real session-protected HTTP transfer
tests. The user's affected Drive file was not supplied. POST-only exports and
browser-only blobs continue in the browser rather than being replayed as GET.

Run the source app with `baslat.bat` and load/reload this checkout's
`browser-extension` directory to use the updated capture code. No release or
installed application files were replaced.
