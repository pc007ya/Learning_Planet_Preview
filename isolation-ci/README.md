Non-deployment synthetic isolation test only.
No Firebase SDK/config, credentials, real accounts, curriculum assets or cloud traffic.
New isolated browser contexts; local generated fixtures; service workers blocked;
all non-exact-loopback requests denied, WebSockets closed.
Covers parser stop behavior and 76 learning / 14 story guards with mock readers.
Does NOT prove full UI, maps, static CDN compatibility, actual Safari/iOS or SW cache isolation.
Bootstrap/guard candidate code originates from public Learning Planet paths and local requested fixes.
No production deployment workflow is modified or dispatched.

Coverage correction: 76 unique protected paths = 62 direct learning fixtures plus 14 actual public story HTML wrappers. Story wrappers run candidate page-access -> original page-script-loader -> candidate story-entry -> local mock reader. Checks assert hidden/inert cleared and loader descriptors replaced. Still NOT real reader UI or Safari/iOS.

Additional tests: context-bound reader execution log survives no-DEMO redirects; records must be zero when anonymous. Native SW tests and actual app shell/subject smoke run only in disposable Docker --network none, verified with loopback-only interfaces. Public React/Babel dependencies downloaded and SRI checked before runtime. No app execution during dependency preparation. SW and UI results are distinct from synthetic guard tests. Repeated import tests prove module effects once, not import-call count.

Ephemeral WebKit diagnostic preserves earlier failure and separately compares native scalar/Blob writes before worker registration. A DEGRADED_SAFE result means public image network fallback succeeds without original cache/progress mutation, NOT that offline image caching works in private mode. Persistent-profile results do not establish Safari/iOS compatibility.
