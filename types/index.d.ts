// The plugin's contract: the host state it keeps for a session.
//   game        the whole game: lit letters, chart rank, sins, the log of hits,
//               and whether the next reply is the coronation reply. Held by
//               the host, so a hot reload of the code keeps the progress.
//   fx          what the band shows instead of the letters right now: a burst
//               (a chant and a picture) or the coronation (the chant and the
//               dancing crowd), under the hit that set it off when a hit did
//               (its popup text, and the energy before it); null while the
//               letters show.
//   pop         the "+3 田所浩二" next to the letters for two seconds after a
//               hit, and the energy before it (the letters it lit are drawn
//               inverse); null otherwise.
//   bandHidden  the band hidden for this session (/inmu band off).
//   unsaved     a save the plugin store has not taken yet: the band says 未存.
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
  sins: number
  muted: boolean
  crownPending: boolean
  log: LogItem[]
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
      unsaved: boolean
    }
  }
}
