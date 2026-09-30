# Bodymovin integration fixture

`bodymovin.json` is the unmodified real animation from the official `airbnb/lottie-web` repository:

https://github.com/airbnb/lottie-web/blob/master/demo/bodymovin/data.json

Downloaded from:
https://raw.githubusercontent.com/airbnb/lottie-web/master/demo/bodymovin/data.json

SHA-256: `c1bee3ea1ac093290891e8bede8ecc6335a3910df9eee684fe8fe5663db8745d`

The fixture is checked in so the test suite does not depend on network access. It exercises legacy colors, multiple layers and precompositions, nested groups, Bezier paths, ellipses, fills, strokes, parenting, masks and animation. Unsupported merge-path nodes must remain in the model and render diagnostic placeholders.

Upstream license: MIT, copyright (c) 2015 Bodymovin. See `LICENSE.bodymovin.md`.
