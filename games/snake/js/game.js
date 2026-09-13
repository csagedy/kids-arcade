/* Snake on a 24x30 grid (8px cells on the 240x320 screen). Swipe to turn.
   Eating grows the snake and, every few apples, speeds it up a notch. */

var W = 240, H = 320, CELL = 8, COLS = W / CELL, ROWS = (H - 16) / CELL;   // 16px header

function SnakeGame() {
  this.snake = [[12, 18], [11, 18], [10, 18]];   // head first, [col, row]
  this.dir = [1, 0];
  this.nextDir = [1, 0];
  this.score = 0;
  this.apples = 0;
  this.stepTime = 0.16;
  this.acc = 0;
  this.dead = false;
  this.placeApple();
}

SnakeGame.prototype.placeApple = function () {
  var self = this;
  for (var tries = 0; tries < 500; tries++) {
    var c = Math.floor(Math.random() * COLS), r = Math.floor(Math.random() * ROWS);
    if (!self.snake.some(function (s) { return s[0] === c && s[1] === r; })) { this.apple = [c, r]; return; }
  }
  this.apple = null;
};

/* Only accept turns that aren't a reversal; the turn applies on the next step. */
SnakeGame.prototype.turn = function (dx, dy) {
  if (dx === -this.dir[0] && dy === -this.dir[1]) return;
  this.nextDir = [dx, dy];
};

/* Returns 'eat', 'die', 'step' or null (no step this frame). */
SnakeGame.prototype.update = function (dt) {
  if (this.dead) return null;
  this.acc += dt;
  if (this.acc < this.stepTime) return null;
  this.acc -= this.stepTime;

  this.dir = this.nextDir;
  var head = [this.snake[0][0] + this.dir[0], this.snake[0][1] + this.dir[1]];
  if (head[0] < 0 || head[1] < 0 || head[0] >= COLS || head[1] >= ROWS) { this.dead = true; return 'die'; }
  for (var i = 0; i < this.snake.length - 1; i++) {   // tail cell will move, so it's safe
    if (this.snake[i][0] === head[0] && this.snake[i][1] === head[1]) { this.dead = true; return 'die'; }
  }
  this.snake.unshift(head);
  if (this.apple && head[0] === this.apple[0] && head[1] === this.apple[1]) {
    this.apples++;
    this.score += 10 + Math.floor(this.apples / 5) * 5;
    if (this.apples % 4 === 0) this.stepTime = Math.max(0.07, this.stepTime * 0.9);
    this.placeApple();
    return 'eat';
  }
  this.snake.pop();
  return 'step';
};
