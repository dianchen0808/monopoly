export enum TileType {
  PROPERTY = 'PROPERTY',
  START = 'START',
  CHANCE = 'CHANCE',
  JAIL = 'JAIL',
  TAX = 'TAX',
  PARKING = 'PARKING', // Free resting spot
}

export interface Tile {
  id: number;
  name: string;
  type: TileType;
  price?: number;
  rent?: number;
  group?: string; // Color group
  ownerId?: string | null; // PeerID of owner
  description?: string;
}

export interface Player {
  peerId: string;
  name: string;
  color: string;
  money: number;
  position: number;
  isJailed: boolean;
  jailTurns: number;
  properties: number[]; // IDs of owned tiles
}

export interface Question {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  fact: string;
}

export interface GameState {
  players: Player[];
  currentPlayerIndex: number;
  tiles: Tile[];
  gameStatus: 'LOBBY' | 'PLAYING' | 'GAME_OVER';
  logs: string[];
  dice: [number, number];
  winner?: string;
}

// Network Payloads
export type Action =
  | { type: 'JOIN_GAME'; payload: Player }
  | { type: 'SYNC_STATE'; payload: GameState }
  | { type: 'ROLL_DICE' }
  | { type: 'END_TURN' }
  | { type: 'BUY_PROPERTY'; payload: { tileId: number } }
  | { type: 'PAY_RENT'; payload: { amount: number; to: string } }
  | { type: 'RESET_GAME' };
