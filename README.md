# Dockhunt CLI

Scans which apps you have in your macOS dock and shares the result with
Dockhunt.

## Usage

```
npx dockhunt
```

## What does it do?
1. Scan your macOS dock
   - For each app, find its name and the path to its icon file
     - Using `defaults export com.apple.dock persistent-apps`
   - Convert each icon file from `ICNS` to `PNG`
   - Upload the app names and PNGs to the Dockhunt server
2. Open the Dockhunt website in your browser
   - Where you'll be invited to sign up (via authenticating with Twitter) and
   then to share the result publicly.
