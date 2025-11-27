import { Tile, TileType, Question } from './types';

// A 20-tile board (6x6 grid perimeter) for faster gameplay on web
export const INITIAL_TILES: Tile[] = [
  { id: 0, name: 'GO', type: TileType.START, description: 'Collect $200' },
  { id: 1, name: 'Solar Field', type: TileType.PROPERTY, price: 60, rent: 2, group: 'brown' },
  { id: 2, name: 'Community Chest', type: TileType.CHANCE },
  { id: 3, name: 'Wind Farm', type: TileType.PROPERTY, price: 60, rent: 4, group: 'brown' },
  { id: 4, name: 'Carbon Tax', type: TileType.TAX, price: 100, description: 'Pay $100' },
  { id: 5, name: 'Hydro Plant', type: TileType.PROPERTY, price: 100, rent: 6, group: 'light_blue' },
  { id: 6, name: 'Recycling Ctr', type: TileType.PROPERTY, price: 100, rent: 6, group: 'light_blue' },
  { id: 7, name: 'Bio Lab', type: TileType.PROPERTY, price: 120, rent: 8, group: 'light_blue' },
  { id: 8, name: 'Eco Prison', type: TileType.JAIL, description: 'Just Visiting' },
  { id: 9, name: 'Urban Garden', type: TileType.PROPERTY, price: 140, rent: 10, group: 'pink' },
  { id: 10, name: 'Green School', type: TileType.PROPERTY, price: 140, rent: 10, group: 'pink' },
  { id: 11, name: 'Eco University', type: TileType.PROPERTY, price: 160, rent: 12, group: 'pink' },
  { id: 12, name: 'Public Park', type: TileType.PARKING, description: 'Free Resting' },
  { id: 13, name: 'Electric Bus', type: TileType.PROPERTY, price: 180, rent: 14, group: 'orange' },
  { id: 14, name: 'Chance', type: TileType.CHANCE },
  { id: 15, name: 'Metro Line', type: TileType.PROPERTY, price: 200, rent: 16, group: 'orange' },
  { id: 16, name: 'Forest Reserve', type: TileType.PROPERTY, price: 220, rent: 18, group: 'red' },
  { id: 17, name: 'Ocean Cleanup', type: TileType.PROPERTY, price: 220, rent: 18, group: 'red' },
  { id: 18, name: 'Clean Water', type: TileType.PROPERTY, price: 240, rent: 20, group: 'red' },
  { id: 19, name: 'Global Summit', type: TileType.PROPERTY, price: 350, rent: 35, group: 'blue' },
];

export const SDG_QUESTIONS: Question[] = [
  {
    id: 1,
    question: "Which SDG aims to end poverty in all its forms everywhere?",
    options: ["Goal 1: No Poverty", "Goal 5: Gender Equality", "Goal 13: Climate Action", "Goal 10: Reduced Inequalities"],
    correctIndex: 0,
    fact: "Goal 1 aims to eradicate extreme poverty for all people everywhere by 2030.",
  },
  {
    id: 2,
    question: "What is the main focus of SDG 13?",
    options: ["Life Below Water", "Quality Education", "Climate Action", "Zero Hunger"],
    correctIndex: 2,
    fact: "SDG 13 urges us to take urgent action to combat climate change and its impacts.",
  },
  {
    id: 3,
    question: "Which goal promotes inclusive and equitable quality education?",
    options: ["Goal 3", "Goal 4", "Goal 8", "Goal 9"],
    correctIndex: 1,
    fact: "Goal 4 ensures inclusive and equitable quality education and promotes lifelong learning opportunities for all.",
  },
  {
    id: 4,
    question: "SDG 7 focuses on affordable and clean...?",
    options: ["Water", "Energy", "Air", "Food"],
    correctIndex: 1,
    fact: "Goal 7 aims to ensure access to affordable, reliable, sustainable and modern energy for all.",
  },
  {
    id: 5,
    question: "Which goal aims to conserve and sustainably use the oceans?",
    options: ["Goal 15: Life on Land", "Goal 6: Clean Water", "Goal 14: Life Below Water", "Goal 12: Responsible Consumption"],
    correctIndex: 2,
    fact: "Goal 14 focuses on conserving and sustainably using the oceans, seas and marine resources.",
  },
];

export const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b']; // Red, Blue, Green, Yellow
