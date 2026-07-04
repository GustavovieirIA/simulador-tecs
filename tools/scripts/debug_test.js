import { Game } from './src/engine/Game.js';
import { TerrainGrid } from './src/world/TerrainGrid.js';
import { Tractor } from './src/entities/Tractor.js';
import { Truck } from './src/entities/Truck.js';
import { JSDOM } from 'jsdom';

// Mock DOM
const dom = new JSDOM(`
  <!DOCTYPE html>
  <html>
    <body>
      <canvas id="gameCanvas"></canvas>
      <div id="tutorial-modal"></div>
      <div id="tutorial-title"></div>
      <div id="tutorial-text"></div>
      <div id="tutorial-graphic"></div>
      <div id="tutorial-dots"></div>
      <div id="tutorial-prev"></div>
      <div id="tutorial-next"></div>
      <div id="btn-take-control"></div>
      <div id="demo-banner"></div>
      <div id="quiz-modal"></div>
      <div id="quiz-question"></div>
      <div id="quiz-options"></div>
      <div id="quiz-feedback"></div>
      
      <div id="gear-value"></div>
      <div id="blade-value"></div>
      <div id="blade-bar"></div>
      <div id="batch-value"></div>
      <div id="radio-messages"></div>
      <canvas id="minimapCanvas"></canvas>
    </body>
  </html>
`);

global.window = dom.window;
global.document = dom.window.document;
global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);

try {
  const game = new Game('gameCanvas');
  game.terrain = new TerrainGrid(40, 60, 20);
  game.tractor = new Tractor(40 * 20 / 2, 55 * 20);
  game.truckClass = Truck;

  console.log("Game initialized.");
  
  game.state.phase = 'DEMO';
  game.start();
  game.tractor.isLocked = false;
  
  console.log("Starting update loop (DEMO)...");
  for (let i = 0; i < 50; i++) {
    game.update(0.1);
  }
  console.log("DEMO updates passed without crashing. Tractor Y:", game.tractor.y);

  console.log("Simulating 'Take Control' click...");
  game.state.phase = 'WAITING_TRUCKS';
  game.tractor.speed = 0;
  game.input.keys = {};
  
  // Fake trucks all DONE
  game.state.batch = 5;
  game.trucks = [ 
    { state: 'DONE', update: () => {} }, 
    { state: 'DONE', update: () => {} }, 
    { state: 'DONE', update: () => {} }, 
    { state: 'DONE', update: () => {} }, 
    { state: 'DONE', update: () => {} } 
  ];
  
  console.log("Starting update loop (Manual)...");
  for (let i = 0; i < 500; i++) {
    game.update(0.1);
  }
  
  console.log("All passed!");
} catch (e) {
  console.error("CRASHED:", e);
}
