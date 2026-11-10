export const CLUB = {
  name: "Sevenoaks Padel Club",
  shortName: "Sevenoaks Padel",
  venue: "Polhill Garden Centre",
  address: "London Road (A224), Badgers Mount, Sevenoaks, Kent",
  postcode: "TN14 7AD",
  timeZone: "Europe/London",
  firstCourtHour: 7,
  lastCourtHour: 22,
  /** The courts, at the rear of the garden centre. Used for the map pin. */
  courts: { lat: 51.32964, lon: 0.15422 },
  /**
   * Site entrance off the A224. Routing targets this point rather than the
   * courts: the courts sit about as close to the M25 as to the A224, so a
   * router without the garden centre's service roads could snap to the
   * motorway and report a journey that never leaves it.
   */
  entrance: { lat: 51.33008, lon: 0.15131 },
} as const;
