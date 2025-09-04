# Realtime setup (Express + Socket.IO)

## Dev
```bash
npm i
npm run dev
# open http://localhost:3000
# for external users open the given IP
```

## How it works
- `server.js` runs Express + Socket.IO.
- Characters are loaded from `src/data/characters/*.json` into an in-memory store.
- Client pages join a room per character and receive live patches.
- Toggle **Edit** on a character sheet to modify basic info; all connected clients see updates instantly.
