# PickUp

Pickup sports scheduling app — post games and book spots across 12 sports.

## Getting started

```bash
npm install
npm start
```

## Structure

```
src/
  types/        shared TypeScript interfaces
  data/         sports config and seed games
  utils/        formatting and helper functions
  components/   Avatar, GameCard, GameModal, SpotsBadge
  pages/        BrowsePage, PostPage, MyGamesPage
  App.tsx       root component, global state
  App.css       all styles
```

## Next steps

- Add a backend (Node/Express or FastAPI) with a PostgreSQL database
- Add auth (Clerk or Supabase Auth)
- Real-time spot updates via WebSockets or Supabase Realtime
- Push notifications when games fill up or get cancelled
- Map view with Google Maps or Mapbox
- Package as a mobile app with Expo
