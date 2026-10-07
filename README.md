# CanteenSimulator — 甲粗飽食堂

A hand-painted, Ghibli-style 3D canteen in the browser: pick a dish, order from the wooden menu tags,
and watch it fill up.

- **小火鍋** — hot pot on a cassette gas stove, three soup bases, adjustable heat (火候)
- **牛肉麵** — braised beef noodle soup in a blue-and-white bowl
- **烤魚** — salt-grilled fish and skewers around a campfire; they roast over time, and a click takes them off
  the fire onto the plate

Click a menu tag to add a portion, right-click to take one away. Day / night toggle in the top-right corner.

## Run

```
npm install
npm run dev
```

Open http://localhost:5173/.

## Models

The dishes are generated with Blender 5.2 scripts in `blender/` and exported to `public/models/*.glb`:

```
blender -b --factory-startup --python blender/hotpot.py -- .
blender -b --factory-startup --python blender/beefnoodle.py -- .
blender -b --factory-startup --python blender/grilledfish.py -- .
```

To have a Blender window follow the page (dish, ordered items, camera) while `npm run dev` is running:

```
blender blender/hotpot.blend --python blender/open_live.py
```

## Stack

React + TypeScript + Vite, three.js via @react-three/fiber and drei.
