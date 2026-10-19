# Kingdom Clash: Rise of the Realm (3D)

Browser-based 3D medieval kingdom strategy game (Three.js r164, no build step). Hosted on GitHub Pages.

**Play:** build on plots, grow resources, train footmen / archers / knights, upgrade the castle (5 levels), and attack the bandit camp in a real-time 3D battle (click to move, click enemies to attack).

## Controls
Desktop: drag = pan, right-drag or Shift+drag = rotate, wheel = zoom, WASD/arrows + Q/E. Touch: drag = pan, pinch = zoom, tap = select/command.

## Status / known limitations
- Rendering was written without a GPU test environment; logic (economy, training, quests, saves, combat balance) is tested in Node (`tests/`) and the UI flow with a stubbed 3D engine. Expect visual bugs on first real run.
- Not implemented yet: ambient villagers/wildlife, audio, settings/graphics menu, pause menu, particle smoke, grass/flowers, bloom.
- Three.js is vendored at deploy time into `vendor/` (see workflow); locally it falls back to a pinned CDN.
- Online multiplayer is not connected.
