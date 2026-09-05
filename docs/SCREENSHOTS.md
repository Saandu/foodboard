# Screenshots referenced by the README

## `menu-mobile.png` — the published menu ✅ done

Captured from the running app at 390×1300 CSS px, `deviceScaleFactor: 2`,
through the DevTools Protocol with `mobile: true`. Device emulation is the part
that matters: `chrome --headless --screenshot` lays the page out at the host's
DPI-scaled width and then clips to `--window-size`, which silently crops the
right-hand column of dish photos.

## `editor.png` — the menu editor ⬜ still needed

This one needs a signed-in session, so it has to be captured by hand.

The dashboard doing the thing the product is for. Sign in, open a category, and
capture a dish's edit modal with the per-language tabs visible — that is the
part of the interface worth showing. Desktop width, roughly 1280×800.

- PNG, no browser chrome, no visible personal data (email address, real
  restaurant details) in the frame.
- Keep it under ~400 KB; `npx sharp` or any compressor will do it.

Then restore the two-up table in the README:

```markdown
| | |
| --- | --- |
| ![Published menu on a phone](docs/menu-mobile.png) | ![Menu editor](docs/editor.png) |
| The published menu a diner sees | The editor, with per-language tabs |
```

Delete this file once both are in.
