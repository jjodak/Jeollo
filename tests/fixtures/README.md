# Development Fixtures

- `recognition/`: original wallet, AirPods and laptop photos retained for manual recognition checks.
- `stamps/seokryeondae.svg`: artwork served by Playwright route interception only.

These files are not imported by the app and are not included in `dist`.
Do not use these paths as production database image URLs. Use public storage URLs
for real heritage content. No fixture data is inserted into Supabase by the tests.
