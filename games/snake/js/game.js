/* Snake on a 24x30 grid (8px cells on the 240x320 screen). Swipe to turn.
   Eating grows the snake and, every few apples, speeds it up a notch.
   Turns are buffered (up to two) so quick swipes are never lost, and a turn
   that would reverse into the neck is ignored. Wrap mode lets the snake pass
   through the walls: easier, and the best choice for little players. */

var W = 240, H = 320, CELL = 8, COLS = W / CELL, ROWS = (H - 16) / CELL;   // 16px header

function SnakeGame(wrap) {
  this.wrap = !!wrap;
  this.snake = [[12, 18], [11, 18], [10, 18]];   // head first, [col, row]
  this.dir = [1, 0];
  this.queue = [];       // buffered turns, applied one per step
  this.score = 0;
  this.apples = 0;
  this.stepTime = 0.18;
  this.acc = -0.45;      // short grace period before the first move
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

/* Queue a turn. It is checked against the last queued direction (or the
   current one), so two quick swipes ("up" then "left") both count, while a
   reversal or a repeat is dropped. */
SnakeGame.prototype.turn = function (dx, dy) {
  var ref = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
  if (dx === -ref[0] && dy === -ref[1]) return;
  if (dx === ref[0] && dy === ref[1]) return;
  if (this.queue.length < 2) this.queue.push([dx, dy]);
};

/* Returns 'eat', 'die', 'win', 'step' or null (no step this frame). */
SnakeGame.prototype.update = function (dt) {
  if (this.dead) return null;
  this.acc += dt;
  if (this.acc < this.stepTime) return null;
  this.acc -= this.stepTime;
  if (this.acc > this.stepTime) this.acc = 0;   // never owe more than one step

  if (this.queue.length) this.dir = this.queue.shift();
  var head = [this.snake[0][0] + this.dir[0], this.snake[0][1] + this.dir[1]];
  if (this.wrap) { head[0] = (head[0] + COLS) % COLS; head[1] = (head[1] + ROWS) % ROWS; }
  else if (head[0] < 0 || head[1] < 0 || head[0] >= COLS || head[1] >= ROWS) { this.dead = true; return 'die'; }
  var eating = !!this.apple && head[0] === this.apple[0] && head[1] === this.apple[1];
  // the tail cell moves away unless we are growing
  for (var i = 0; i < this.snake.length - (eating ? 0 : 1); i++) {
    if (this.snake[i][0] === head[0] && this.snake[i][1] === head[1]) { this.dead = true; return 'die'; }
  }
  this.snake.unshift(head);
  if (eating) {
    this.apples++;
    this.score += 10 + Math.floor(this.apples / 5) * 5;
    if (this.apples % 4 === 0) this.stepTime = Math.max(0.08, this.stepTime * 0.92);
    this.placeApple();
    if (!this.apple) { this.dead = true; return 'win'; }   // the board is full!
    return 'eat';
  }
  this.snake.pop();
  return 'step';
};
