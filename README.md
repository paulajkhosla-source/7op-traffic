# 7OP Traffic

A phone-first web app for the drive to [Sevenoaks Padel Club](https://sevenoakspadel.co.uk/) at Polhill Garden Centre, Badgers Mount (TN14 7AD). It shows how long the drive takes right now, when to leave for a booked court, and which departures over the next few hours are quieter.

It installs as a PWA: add it to your home screen and it opens full screen, including from the last saved reading when you are offline.

## Traffic data

Live traffic comes from the [TomTom Routing API](https://developer.tomtom.com/routing-api/documentation/tomtom-maps/v1/calculate-route). The app reads the key from `TOMTOM_API_KEY` on the server and never sends it to the browser. Live results are served only to a signed-in viewer of the published app.

The app does not invent a drive time. With no key, or when the viewer is signed out, it says live traffic is unavailable. If TomTom fails to answer, the last live reading stays on screen and the app retries; it never substitutes a guessed ETA.

Later departures use TomTom's `departAt` so the forecast is that provider's historic traffic profile for the slot, not a homemade curve. A booked court uses `arriveAt` to work out when to leave.

Postcodes are resolved with [postcodes.io](https://postcodes.io/). The map uses [OpenFreeMap](https://openfreemap.org/).

## Develop

```bash
npm install
npm run dev
```

```bash
npm test
npm run lint
npm run build
```
