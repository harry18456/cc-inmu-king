// The plugin's contract: the host state it keeps for a session. A session
// plays a game of its own: nothing goes to the plugin store, and the next
// session starts over.
//   game        the whole game: lit letters, chart rank, points, bursts,
//               coronations, sins, the collection, the log of hits, whether the next reply
//               is the coronation reply, and the day the clock memes last
//               paid out. Held by the host, so a hot reload of the code (or a
//               settings change) keeps it.
//   fx          what the band shows instead of the letters right now: a burst
//               (a chant and a picture) or the coronation (the chant and the
//               dancing crowd), under the hit that set it off when a hit did
//               (its popup text, and the energy before it); null while the
//               letters show.
//   pop         the "+3 田所浩二" next to the letters for two seconds after a
//               hit, and the energy before it (the letters it lit are drawn
//               inverse); null otherwise.
//   bandHidden  the band hidden for this session (/inmu band off).
export type By = 'you' | 'claude' | 'clock'

export type LogItem = {
  label: string
  points: number
  by: By
  at: number
}

export type Game = {
  energy: number
  rank: number
  points: number
  bursts: number
  crowns: number
  sins: number
  found: string[]
  muted: boolean
  crownPending: boolean
  log: LogItem[]
  // The day 11:45:14 last paid out (a date string), and the year August 10 last crowned.
  clockDay: string
  crownYear: number
}

export type Art = 'beast' | 'tea' | 'digits' | 'crowd'

export type Fx = {
  kind: 'burst' | 'crown'
  text: string
  art: Art
  until: number
  hit?: string
  from?: number
}

export type Pop = {
  text: string
  from: number
  until: number
}

declare module 'claude-code' {
  interface PluginState {
    'inmu-king': {
      game: Game
      fx: Fx | null
      pop: Pop | null
      bandHidden: boolean
    }
  }
}
