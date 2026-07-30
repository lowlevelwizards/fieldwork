# Fieldwork 0.2A — Touch the World

A phone-first browser prototype for the earliest playable seed of Fieldwork.

## 0.2A focus

This build adds the first complete physical interaction loop:

- shared stateful world entities
- contextual mobile interaction button and keyboard `E` fallback
- target highlighting and ground-y depth sorting
- openable utility-shed door
- searchable crate with interruptible progress
- physically revealed radio battery
- one-item carried state with take and drop behavior
- carried battery presentation on the operator
- short interaction messages and expanded debug readouts

## Included foundation

- title screen and fixed roadside clearing
- one controllable four-facing operator
- floating touch joystick
- WASD / arrow-key fallback
- smooth camera follow
- collision with trees, rocks, shed walls, door, and crate
- portrait and landscape support
- visible return-zone placeholder

## Run locally

Because the project uses JavaScript modules, serve the folder with a small local server rather than opening `index.html` directly:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## GitHub Pages

Upload the project contents to the repository root, then deploy the `main` branch from `/ (root)` under **Settings → Pages**.

## Controls

### Phone / tablet

- Touch and drag in the lower-left area to move.
- Tap the contextual button in the lower-right to interact.
- While carrying the battery, the same button drops it.

### Keyboard

- WASD or arrow keys: move
- E: interact, take, or drop

## Test sequence

1. Walk east to the utility shed.
2. Approach the bottom doorway and open the door.
3. Enter and search the storage crate.
4. Stay close until the search finishes.
5. Take the revealed radio battery.
6. Walk with it, drop it, and pick it up again.

Persistence, backpack capacity, extraction, and container inventory are intentionally deferred.
