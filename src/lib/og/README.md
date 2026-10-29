# openGym's progression engine

`progression.js`, `rep-range.js` and `workout-model.js` (and their tests) are copied unchanged
from [openGym](https://github.com/DuarteSantos8/openGym) (AGPL-3.0-or-later). `history.js` and
`exercises.js` are small stand-ins for openGym's own files of those names: they hold only what
the engine reads, and answer it from Circle's exercise library.

Circle talks to the engine through `../smart.js`. To take a newer engine from openGym, copy the
three files again and run the tests here (`npx vitest run src/lib/og`).
