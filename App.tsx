import React, { useEffect, useState, useRef, useReducer, useMemo } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { GameState, Player, Action, TileType, Tile, Question } from './types';
import { INITIAL_TILES, SDG_QUESTIONS, PLAYER_COLORS } from './constants';
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, Users, Copy, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

// --- INITIAL STATE ---
const initialState: GameState = {
  players: [],
  currentPlayerIndex: 0,
  tiles: INITIAL_TILES,
  gameStatus: 'LOBBY',
  logs: ['Welcome to EcoPoly! Create or join a game.'],
  dice: [1, 1],
};

// --- GAME LOGIC REDUCER ---
// This runs on the HOST. Clients receive the full new state.
const gameReducer = (state: GameState, action: Action): GameState => {
  switch (action.type) {
    case 'JOIN_GAME': {
      if (state.players.find(p => p.peerId === action.payload.peerId)) return state;
      const newPlayer = { ...action.payload, color: PLAYER_COLORS[state.players.length % 4] };
      return {
        ...state,
        players: [...state.players, newPlayer],
        logs: [`${newPlayer.name} joined the game.`, ...state.logs],
      };
    }
    case 'RESET_GAME': {
       return {
         ...initialState,
         gameStatus: 'PLAYING',
         players: state.players.map(p => ({
            ...p,
            money: 1500,
            position: 0,
            isJailed: false,
            properties: []
         })),
         logs: ['Game started! Player 1 turn.'],
       };
    }
    case 'ROLL_DICE': {
      const pIndex = state.currentPlayerIndex;
      const player = state.players[pIndex];
      const d1 = Math.ceil(Math.random() * 6);
      const d2 = Math.ceil(Math.random() * 6);
      const total = d1 + d2;
      
      let newLogs = [...state.logs];
      let newPos = player.position;
      let money = player.money;

      // Handle Jail
      if (player.isJailed) {
        if (d1 === d2) {
          newLogs.unshift(`${player.name} rolled doubles and got out of jail!`);
          return {
            ...state,
            dice: [d1, d2],
            players: state.players.map((p, i) => i === pIndex ? { ...p, isJailed: false, jailTurns: 0 } : p),
            logs: newLogs
          };
        } else {
           // Stay in jail
           return {
             ...state,
             dice: [d1, d2],
             logs: [`${player.name} stays in jail.`, ...newLogs],
             currentPlayerIndex: (state.currentPlayerIndex + 1) % state.players.length
           }
        }
      }

      // Move
      newPos = (player.position + total) % state.tiles.length;
      if (newPos < player.position) {
        money += 200; // Passed GO
        newLogs.unshift(`${player.name} passed GO! Collected $200.`);
      }

      newLogs.unshift(`${player.name} rolled ${total} (moved to ${state.tiles[newPos].name}).`);
      
      // Handle Tile Landing Logic logic is partially handled here, 
      // but interactions (buying) are separate actions.
      // Instant effects (Tax, Jail) happen immediately.
      
      const landedTile = state.tiles[newPos];
      let isJailed = false;

      if (landedTile.type === TileType.JAIL && landedTile.id !== 8) { 
        // Logic for "Go To Jail" tile if we had one, but currently index 8 is just visiting.
        // Let's say index 8 is the jail, so just landing on it is "visiting".
        // If we add a "Go To Jail" tile later at index 15, we'd handle it here.
      }
      
      if (landedTile.type === TileType.TAX) {
        money -= (landedTile.price || 0);
        newLogs.unshift(`${player.name} paid $${landedTile.price} tax.`);
      }
      
      if (landedTile.type === TileType.CHANCE) {
          const r = Math.random();
          if (r > 0.5) {
              money += 50;
              newLogs.unshift("Chance: You won a sustainability grant! +$50");
          } else {
              money -= 30;
              newLogs.unshift("Chance: Carbon offset fee. -$30");
          }
      }

      return {
        ...state,
        dice: [d1, d2],
        players: state.players.map((p, i) => 
          i === pIndex ? { ...p, position: newPos, money, isJailed } : p
        ),
        logs: newLogs,
      };
    }
    case 'BUY_PROPERTY': {
      const pIndex = state.currentPlayerIndex;
      const player = state.players[pIndex];
      const tileId = action.payload.tileId;
      const tile = state.tiles[tileId];

      if (player.money >= (tile.price || 0)) {
        return {
          ...state,
          players: state.players.map((p, i) => 
            i === pIndex ? { ...p, money: p.money - (tile.price || 0), properties: [...p.properties, tileId] } : p
          ),
          tiles: state.tiles.map(t => t.id === tileId ? { ...t, ownerId: player.peerId } : t),
          logs: [`${player.name} bought ${tile.name} for $${tile.price}.`, ...state.logs],
        };
      }
      return state;
    }
    case 'PAY_RENT': {
      const payerIndex = state.currentPlayerIndex;
      const payer = state.players[payerIndex];
      const receiver = state.players.find(p => p.peerId === action.payload.to);
      const amount = action.payload.amount;

      if (!receiver) return state;

      // Check bankruptcy
      if (payer.money < amount) {
          // Simplification: Game Over for payer
          return {
              ...state,
              gameStatus: 'GAME_OVER',
              winner: receiver.name,
              logs: [`${payer.name} went bankrupt! ${receiver.name} wins!`, ...state.logs]
          }
      }

      return {
        ...state,
        players: state.players.map(p => {
          if (p.peerId === payer.peerId) return { ...p, money: p.money - amount };
          if (p.peerId === receiver.peerId) return { ...p, money: p.money + amount };
          return p;
        }),
        logs: [`${payer.name} paid $${amount} rent to ${receiver.name}.`, ...state.logs],
      };
    }
    case 'END_TURN': {
      return {
        ...state,
        currentPlayerIndex: (state.currentPlayerIndex + 1) % state.players.length,
      };
    }
    case 'SYNC_STATE': {
      return action.payload; // Update client state to match host
    }
    default:
      return state;
  }
};

// --- COMPONENTS ---

// 1. Dice Component
const DiceDisplay = ({ dice }: { dice: [number, number] }) => {
  const getIcon = (num: number) => {
    switch(num) {
      case 1: return <Dice1 className="w-8 h-8 text-slate-700" />;
      case 2: return <Dice2 className="w-8 h-8 text-slate-700" />;
      case 3: return <Dice3 className="w-8 h-8 text-slate-700" />;
      case 4: return <Dice4 className="w-8 h-8 text-slate-700" />;
      case 5: return <Dice5 className="w-8 h-8 text-slate-700" />;
      case 6: return <Dice6 className="w-8 h-8 text-slate-700" />;
      default: return <Dice1 className="w-8 h-8 text-slate-700" />;
    }
  }
  return (
    <div className="flex gap-2 bg-white p-2 rounded shadow-sm border">
      {getIcon(dice[0])}
      {getIcon(dice[1])}
    </div>
  );
};

// 2. Tile Component
const BoardTile = ({ 
  tile, 
  players, 
  isCorner 
}: { 
  tile: Tile, 
  players: Player[], 
  isCorner: boolean 
}) => {
  const getGroupColor = (group?: string) => {
    switch(group) {
      case 'brown': return 'bg-amber-800';
      case 'light_blue': return 'bg-sky-400';
      case 'pink': return 'bg-pink-500';
      case 'orange': return 'bg-orange-500';
      case 'red': return 'bg-red-600';
      case 'blue': return 'bg-blue-800';
      default: return 'bg-slate-200';
    }
  }

  const owner = players.find(p => p.peerId === tile.ownerId);

  return (
    <div className={`relative flex flex-col items-center justify-between border border-slate-300 bg-white text-[10px] md:text-xs select-none 
      ${isCorner ? 'aspect-square' : 'aspect-[3/4] md:aspect-[3/5]'}
      ${tile.type === TileType.START ? 'bg-green-100' : ''}
    `}>
      {/* Color Strip */}
      {tile.group && (
        <div className={`w-full h-[20%] ${getGroupColor(tile.group)} border-b border-slate-300`}></div>
      )}
      
      {/* Content */}
      <div className="flex-1 flex flex-col justify-center items-center p-1 text-center w-full">
        <span className="font-bold leading-tight">{tile.name}</span>
        {tile.price && !owner && <span className="text-slate-500">${tile.price}</span>}
        {owner && (
           <div className="mt-1 px-1 py-0.5 rounded text-white text-[9px]" style={{ backgroundColor: owner.color }}>
             Owner: {owner.name.substring(0,6)}
           </div>
        )}
        {tile.type === TileType.CHANCE && <span className="text-2xl">❓</span>}
      </div>

      {/* Players on Tile */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="flex flex-wrap gap-1 justify-center">
            {players.filter(p => p.position === tile.id).map(p => (
            <div 
                key={p.peerId} 
                className="w-3 h-3 md:w-5 md:h-5 rounded-full border-2 border-white shadow-md z-10 transition-all duration-300 transform hover:scale-125"
                style={{ backgroundColor: p.color }}
                title={p.name}
            />
            ))}
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP ---
export default function App() {
  const [peerId, setPeerId] = useState<string>('');
  const [hostId, setHostId] = useState<string>('');
  const [myId, setMyId] = useState<string>('');
  const [userName, setUserName] = useState<string>('Player ' + Math.floor(Math.random() * 100));
  
  // Game State
  const [gameState, dispatch] = useReducer(gameReducer, initialState);
  const [modalQuestion, setModalQuestion] = useState<Question | null>(null);
  const [tileToBuy, setTileToBuy] = useState<number | null>(null);

  // PeerJS Refs
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<DataConnection[]>([]);
  const isHost = useMemo(() => peerId === myId, [peerId, myId]);

  // Initialize Peer
  useEffect(() => {
    const peer = new Peer();
    
    peer.on('open', (id) => {
      setMyId(id);
      console.log('My ID:', id);
    });

    peer.on('connection', (conn) => {
      // Logic for HOST receiving connections
      conn.on('data', (data: any) => {
        // As Host, we receive actions, process them, and broadcast state
        if (data.type) {
            // Apply locally first
            dispatch(data);
            
            // If action needs reducer logic (like Roll Dice), we need the *new* state to broadcast.
            // Since useReducer is async in updates effectively, we can't grab the new state immediately here easily without effects.
            // HOWEVER, for simplicity in this P2P model:
            // 1. Host receives ACTION.
            // 2. Host applies ACTION.
            // 3. Host sends NEW STATE to all clients.
        }
      });
      connectionsRef.current.push(conn);
    });

    peerRef.current = peer;
    return () => peer.destroy();
  }, []);

  // Broadcast State (Host Only)
  useEffect(() => {
      if (isHost && connectionsRef.current.length > 0) {
          // Whenever gameState changes, broadcast to all
          connectionsRef.current.forEach(conn => {
              conn.send({ type: 'SYNC_STATE', payload: gameState });
          });
      }
  }, [gameState, isHost]);

  // Join Game Logic
  const joinGame = () => {
    if (!hostId) return alert('Enter a Game ID');
    
    const conn = peerRef.current?.connect(hostId);
    if (!conn) return;

    conn.on('open', () => {
      setPeerId(hostId);
      // Send Join Action
      const player: Player = {
        peerId: myId,
        name: userName,
        color: '#000', // Host will assign real color
        money: 1500,
        position: 0,
        isJailed: false,
        jailTurns: 0,
        properties: []
      };
      conn.send({ type: 'JOIN_GAME', payload: player });
    });

    conn.on('data', (data: any) => {
      if (data.type === 'SYNC_STATE') {
        dispatch({ type: 'SYNC_STATE', payload: data.payload });
      }
    });

    // Store Host Connection
    connectionsRef.current = [conn];
  };

  const createGame = () => {
    setPeerId(myId);
    setHostId(myId);
    // Add self as player
    const player: Player = {
        peerId: myId,
        name: userName,
        color: PLAYER_COLORS[0],
        money: 1500,
        position: 0,
        isJailed: false,
        jailTurns: 0,
        properties: []
    };
    dispatch({ type: 'JOIN_GAME', payload: player });
  };

  const startGame = () => {
     if (isHost) {
         sendAction({ type: 'RESET_GAME' });
     }
  };

  const sendAction = (action: Action) => {
    if (isHost) {
      dispatch(action); // Update self
    } else {
      // Send to host
      connectionsRef.current[0].send(action);
    }
  };

  // --- GAMEPLAY HANDLERS ---
  const myPlayer = gameState.players.find(p => p.peerId === myId);
  const isMyTurn = myPlayer && gameState.players[gameState.currentPlayerIndex]?.peerId === myId;

  const handleRoll = () => {
      if (!isMyTurn) return;
      sendAction({ type: 'ROLL_DICE' });
  };

  const handleEndTurn = () => {
      if (!isMyTurn) return;
      sendAction({ type: 'END_TURN' });
  };

  // Effect to handle landing logic *after* state update
  // We need to detect if *my* position changed to trigger modals
  const prevPosRef = useRef<number>(0);
  useEffect(() => {
      if (!myPlayer) return;
      if (myPlayer.position !== prevPosRef.current) {
          // I moved!
          const tile = gameState.tiles[myPlayer.position];
          
          // 1. Check if unowned property
          if (tile.type === TileType.PROPERTY && !tile.ownerId && isMyTurn) {
              // Trigger Question
              const randomQ = SDG_QUESTIONS[Math.floor(Math.random() * SDG_QUESTIONS.length)];
              setModalQuestion(randomQ);
              setTileToBuy(tile.id);
          }
          
          // 2. Check if owned (Rent)
          if (tile.type === TileType.PROPERTY && tile.ownerId && tile.ownerId !== myId && isMyTurn) {
              const rent = tile.rent || 0;
              // Auto Pay Rent for MVP simplicity
              // In real game, show modal "You owe rent!"
              setTimeout(() => {
                alert(`You landed on ${tile.name}. Paying $${rent} rent.`);
                sendAction({ type: 'PAY_RENT', payload: { amount: rent, to: tile.ownerId! } });
              }, 500);
          }

          prevPosRef.current = myPlayer.position;
      }
  }, [myPlayer?.position, isMyTurn]);

  // Handle Question Answer
  const handleAnswer = (index: number) => {
      if (!modalQuestion) return;
      
      if (index === modalQuestion.correctIndex) {
          // Correct! Buy it?
          const confirmBuy = window.confirm(`Correct! Do you want to buy this property for $${gameState.tiles[tileToBuy!].price}?`);
          if (confirmBuy) {
            sendAction({ type: 'BUY_PROPERTY', payload: { tileId: tileToBuy! } });
          }
      } else {
          alert(`Wrong! The answer was: ${modalQuestion.options[modalQuestion.correctIndex]}`);
      }
      setModalQuestion(null);
      setTileToBuy(null);
  };


  // --- RENDER HELPERS ---
  
  // Grid Logic: 20 tiles. 6x6 perimeter.
  // Top Row: 0 -> 5 (0,1,2,3,4,5)
  // Right Col: 5 -> 10 (6,7,8,9,10 is corner) -> wait, grid logic:
  // Indices: 
  // Bottom: 0 (Go) -> 5 (Jail-ish/Corner)
  // Left: 6 -> 9
  // Top: 10 -> 15
  // Right: 16 -> 19
  
  // Let's re-map standard 20 tile array to visual grid positions
  // Grid is 6 columns x 6 rows.
  // 0(Go) is bottom-right? Traditionally Go is bottom-right.
  // Let's make 0 Bottom-Right (row 6, col 6).
  // 1-4 Bottom Row (row 6, cols 5,4,3,2)
  // 5 Bottom-Left (row 6, col 1)
  // 6-9 Left Col (row 5,4,3,2 col 1)
  // 10 Top-Left (row 1, col 1)
  // 11-14 Top Row (row 1, cols 2,3,4,5)
  // 15 Top-Right (row 1, col 6)
  // 16-19 Right Col (row 2,3,4,5 col 6)
  
  const getGridStyle = (index: number) => {
     // Indices 0-19
     if (index === 0) return { gridRow: 6, gridColumn: 6 };
     if (index > 0 && index < 5) return { gridRow: 6, gridColumn: 6 - index };
     if (index === 5) return { gridRow: 6, gridColumn: 1 };
     if (index > 5 && index < 10) return { gridRow: 6 - (index - 5), gridColumn: 1 };
     if (index === 10) return { gridRow: 1, gridColumn: 1 };
     if (index > 10 && index < 15) return { gridRow: 1, gridColumn: 1 + (index - 10) };
     if (index === 15) return { gridRow: 1, gridColumn: 6 };
     if (index > 15 && index < 20) return { gridRow: 1 + (index - 15), gridColumn: 6 };
     return {};
  };


  // --- UI RENDER ---

  if (gameState.gameStatus === 'LOBBY') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-green-400 to-blue-500">
        <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full text-center space-y-6">
          <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight">EcoPoly 🌍</h1>
          <p className="text-slate-500">SDG Edition • Multiplayer</p>
          
          <div className="space-y-4 text-left">
            <div>
              <label className="block text-sm font-medium text-slate-700">Your Name</label>
              <input 
                type="text" 
                value={userName} 
                onChange={e => setUserName(e.target.value)}
                className="mt-1 w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
              />
            </div>
            
            <div className="border-t pt-4">
              <button 
                onClick={createGame} 
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition"
              >
                Create New Game
              </button>
            </div>
            
            <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-300"></div>
                <span className="flex-shrink-0 mx-4 text-gray-400">OR</span>
                <div className="flex-grow border-t border-gray-300"></div>
            </div>

            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Paste Game ID here" 
                value={hostId}
                onChange={e => setHostId(e.target.value)}
                className="flex-1 px-4 py-2 border rounded-lg outline-none"
              />
              <button 
                onClick={joinGame}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // LOBBY WAITING ROOM (Inside Game Status 'LOBBY' technically, but simplified here logic uses PLAYING for board)
  if (gameState.gameStatus === 'PLAYING' && !peerId) {
      // Should not happen, just fallback
      return <div>Loading...</div>;
  }

  // THE BOARD UI
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      
      {/* LEFT PANEL: INFO & CHAT */}
      <div className="w-full md:w-80 bg-white border-r p-4 flex flex-col gap-4 order-2 md:order-1 h-[30vh] md:h-screen overflow-y-auto">
        <div className="space-y-2">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="w-5 h-5" /> Players
          </h2>
          {gameState.players.map((p, i) => (
            <div key={p.peerId} className={`flex justify-between items-center p-3 rounded-lg border ${gameState.currentPlayerIndex === i ? 'border-green-500 bg-green-50 ring-1 ring-green-500' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.color }}></div>
                <span className="font-semibold text-slate-700">{p.name} {p.peerId === myId && '(You)'}</span>
              </div>
              <div className="text-green-700 font-mono font-bold">${p.money}</div>
            </div>
          ))}
        </div>
        
        {/* Connection Info */}
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm">
            <p className="font-semibold text-blue-800 mb-1">Invite Friends</p>
            <div className="flex items-center gap-2 bg-white p-2 rounded border">
                <code className="flex-1 truncate text-xs">{peerId}</code>
                <button onClick={() => navigator.clipboard.writeText(peerId)} className="text-blue-500 hover:text-blue-700">
                    <Copy className="w-4 h-4" />
                </button>
            </div>
        </div>

        {/* Game Logs */}
        <div className="flex-1 bg-slate-100 rounded-lg p-2 overflow-y-auto text-xs font-mono border space-y-1 max-h-40 md:max-h-full">
            {gameState.logs.map((log, i) => (
                <div key={i} className="text-slate-600 border-b border-slate-200 pb-1 last:border-0">{log}</div>
            ))}
        </div>
      </div>

      {/* CENTER: BOARD */}
      <div className="flex-1 flex flex-col items-center justify-center p-2 md:p-8 order-1 md:order-2 bg-[#dcfce7]">
        {/* Start Game Button for Host */}
        {gameState.players.length > 0 && gameState.logs.length === 1 && isHost && (
             <div className="absolute top-4 z-50">
                 <button onClick={startGame} className="bg-green-600 text-white px-8 py-3 rounded-full shadow-lg font-bold text-lg animate-bounce">
                     Start Game
                 </button>
             </div>
        )}

        <div className="relative w-full max-w-[650px] aspect-square bg-white shadow-2xl rounded-xl border-4 border-slate-800 p-1 md:p-2">
            
            {/* CSS GRID BOARD */}
            <div className="grid grid-cols-6 grid-rows-6 gap-1 w-full h-full bg-slate-100">
                {/* Render Center Content (Dice, Turn Info) */}
                <div className="col-start-2 col-end-6 row-start-2 row-end-6 flex flex-col items-center justify-center p-4 text-center bg-white">
                    <h1 className="text-4xl md:text-6xl font-black text-green-600 opacity-20 transform -rotate-12 select-none mb-4">EcoPoly</h1>
                    
                    {/* Controls */}
                    <div className="z-10 bg-white/90 p-6 rounded-xl shadow-lg border border-slate-200 backdrop-blur-sm">
                        <div className="mb-4">
                            <span className="text-sm uppercase tracking-wider text-slate-500 font-bold">Current Turn</span>
                            <div className="text-xl font-bold" style={{ color: gameState.players[gameState.currentPlayerIndex]?.color }}>
                                {gameState.players[gameState.currentPlayerIndex]?.name}
                            </div>
                        </div>

                        <div className="flex flex-col items-center gap-4">
                            <DiceDisplay dice={gameState.dice} />
                            
                            {isMyTurn && (
                                <div className="flex gap-2">
                                    <button 
                                        onClick={handleRoll}
                                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold shadow-md active:transform active:scale-95 transition"
                                    >
                                        Roll Dice
                                    </button>
                                    <button 
                                        onClick={handleEndTurn}
                                        className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-bold shadow-md active:transform active:scale-95 transition"
                                    >
                                        End Turn
                                    </button>
                                </div>
                            )}
                            {!isMyTurn && (
                                <div className="text-slate-400 italic text-sm">Waiting for opponent...</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Render Tiles */}
                {gameState.tiles.map((tile, i) => (
                    <div key={tile.id} style={getGridStyle(i)} className="w-full h-full">
                        <BoardTile 
                            tile={tile} 
                            players={gameState.players} 
                            isCorner={[0, 5, 10, 15].includes(i)} 
                        />
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* QUESTION MODAL */}
      {modalQuestion && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-300">
                <div className="bg-green-600 p-4 text-white flex items-center gap-2">
                    <AlertCircle />
                    <h3 className="font-bold text-lg">Answer to Buy Property</h3>
                </div>
                <div className="p-6">
                    <p className="text-lg font-medium text-slate-800 mb-6">{modalQuestion.question}</p>
                    <div className="grid gap-3">
                        {modalQuestion.options.map((opt, idx) => (
                            <button 
                                key={idx}
                                onClick={() => handleAnswer(idx)}
                                className="text-left p-3 rounded-lg border border-slate-200 hover:bg-green-50 hover:border-green-500 transition font-medium text-slate-700"
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="bg-slate-50 p-3 text-xs text-center text-slate-400">
                    EcoPoly Knowledge Check
                </div>
            </div>
        </div>
      )}

      {/* GAME OVER MODAL */}
      {gameState.gameStatus === 'GAME_OVER' && (
           <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center text-white">
               <div className="text-center">
                   <h1 className="text-6xl font-bold mb-4 text-green-400">Winner!</h1>
                   <p className="text-3xl">{gameState.winner} won the game!</p>
                   <button onClick={() => window.location.reload()} className="mt-8 bg-white text-black px-6 py-2 rounded-full font-bold">Play Again</button>
               </div>
           </div>
      )}
    </div>
  );
}