Non-deployment synthetic isolation test only.
No Firebase SDK/config, credentials, real accounts, curriculum assets or cloud traffic.
New isolated browser contexts; local generated fixtures; service workers blocked;
all non-exact-loopback requests denied, WebSockets closed.
Covers parser stop behavior and 76 learning / 14 story guards with mock readers.
Does NOT prove full UI, maps, static CDN compatibility, actual Safari/iOS or SW cache isolation.
Bootstrap/guard candidate code originates from public Learning Planet paths and local requested fixes.
No production deployment workflow is modified or dispatched.

Coverage correction: 76 unique protected paths = 62 direct learning fixtures plus 14 actual public story HTML wrappers. Story wrappers run candidate page-access -> original page-script-loader -> candidate story-entry -> local mock reader. Checks assert hidden/inert cleared and loader descriptors replaced. Still NOT real reader UI or Safari/iOS.
