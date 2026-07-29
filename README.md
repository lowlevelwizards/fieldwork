# Fieldwork 0.1A — Movement Test

A phone-first browser prototype for the earliest playable seed of Fieldwork.

## Included

- Title screen
- One fixed roadside clearing
- One controllable operator
- Floating touch joystick
- WASD / arrow-key fallback
- Smooth camera follow
- Collision with trees, rocks, and shed walls
- Portrait and landscape support
- Visible return zone placeholder
- Debug panel and position reset

## Run locally

Because the project uses JavaScript modules, serve the folder with any simple local server rather than opening `index.html` directly as a file.

Examples:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## GitHub Pages

1. Create a new GitHub repository.
2. Upload the contents of this folder to the repository root.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the `main` branch and `/ (root)` folder.
6. Save, then open the Pages URL once deployment completes.

## Controls

### Phone / tablet

Touch and drag in the lower-left area to move. The joystick relocates to the initial touch point.

### Keyboard

Use WASD or the arrow keys.

## Test focus

Evaluate:

- operator speed
- acceleration and stopping
- joystick comfort
- camera scale and follow
- collision readability
- portrait versus landscape preference
- whether the clearing already feels pleasant to move through
