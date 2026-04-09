export interface Vector2D {
  x: number;
  y: number;
}

export interface Arrow {
  position: Vector2D;
  velocity: Vector2D;
  angle: number;
  isActive: boolean;
  isStuck: boolean;
  trail: Vector2D[];
}

export interface Target {
  position: Vector2D;
  radius: number;
  distance: number; // For perspective
}

export interface GameState {
  score: number;
  highScore: number;
  arrowsRemaining: number;
  wind: Vector2D;
  isDrawing: boolean;
  drawPower: number;
  currentArrow: Arrow | null;
  target: Target;
  gameOver: boolean;
}
