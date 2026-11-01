/* Snake on a grid of CELL-pixel cells that fills the screen (the UI sets W
   and H, then COLS and ROWS follow). Swipe to turn. Eating grows the snake
   and, every few apples, speeds it up a notch. Turns are buffered (up to
   two) so quick swipes are never lost, and a turn that would reverse into the
   neck is ignored. Wrap mode lets the snake pass through the walls: easier,
   and the best choice for little players. Now and then a golden apple
   appears for a few seconds, worth extra. */

var W = 240, H = 320, CELL = 12, COLS = 20, ROWS = 26;

function snakeGrid() {
  COLS = Math.max(10, Math.floor(W / CELL));
  ROWS = Math.max(10, Math.floor(H / CELL));
}

function SnakeGame(wrap) {
  snakeGrid();
  this.wrap = !!wrap;
  var r = Math.floor(ROWS * 0.6), c = Math.floor(COLS / 2);
  this.snake = [[c, r], [c - 1, r], [c - 2, r]];   // head first, [col, row]
  this.dir = [1, 0];
  this.queue = [];       // buffered turns, applied one per step
  this.score = 0;
  this.apples = 0;
  this.stepTime = 0.2;
  this.acc = -0.6;       // short grace period before the first move
  this.dead = false;
  this.gold = null;      // { c, r, t } a golden apple, for a little while
  this.goldIn = 6;       // apples until the next golden one may appear
  this.ate = null;       // what was just eaten: 'apple' | 'gold'
  this.placeApple();
}

SnakeGame.prototype.free = function () {
  var used = {}, out = [];
  this.snake.forEach(function (s) { used[s[0] + ',' + s[1]] = 1; });
  if (this.apple) used[this.apple[0] + ',' + this.apple[1]] = 1;
  if (this.gold) used[this.gold.c + ',' + this.gold.r] = 1;
  for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (!used[c + ',' + r]) out.push([c, r]);
  return out;
};

/* Pick from every free cell (not random tries), so a nearly full board
   still gets an apple and "the board is full" really means full. */
SnakeGame.prototype.placeApple = function () {
  this.apple = null;
  var f = this.free();
  this.apple = f.length ? f[Math.floor(Math.random() * f.length)] : null;
};

/* Queue a turn. It is checked against the last queued direction (or the
   current one), so two quick swipes ("up" then "left") both count, while a
   reversal or a repeat is dropped. */
SnakeGame.prototype.turn = function (dx, dy) {
  var ref = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
  if (dx === -ref[0] && dy === -ref[1]) return false;
  if (dx === ref[0] && dy === ref[1]) return false;
  if (this.queue.length < 2) { this.queue.push([dx, dy]); return true; }
  return false;
};

/* Returns 'eat', 'die', 'win', 'step' or null (no step this frame). */
SnakeGame.prototype.update = function (dt) {
  if (this.dead) return null;
  if (this.gold) { this.gold.t -= dt; if (this.gold.t <= 0) this.gold = null; }
  this.acc += dt;
  if (this.acc < this.stepTime) return null;
  this.acc -= this.stepTime;
  if (this.acc > this.stepTime) this.acc = 0;   // never owe more than one step

  if (this.queue.length) this.dir = this.queue.shift();
  var head = [this.snake[0][0] + this.dir[0], this.snake[0][1] + this.dir[1]];
  if (this.wrap) { head[0] = (head[0] + COLS) % COLS; head[1] = (head[1] + ROWS) % ROWS; }
  else if (head[0] < 0 || head[1] < 0 || head[0] >= COLS || head[1] >= ROWS) { this.dead = true; return 'die'; }
  var eating = !!this.apple && head[0] === this.apple[0] && head[1] === this.apple[1];
  var golden = !!this.gold && head[0] === this.gold.c && head[1] === this.gold.r;
  var grow = eating || golden;
  // the tail cell moves away unless we are growing
  for (var i = 0; i < this.snake.length - (grow ? 0 : 1); i++) {
    if (this.snake[i][0] === head[0] && this.snake[i][1] === head[1]) { this.dead = true; return 'die'; }
  }
  this.snake.unshift(head);
  if (golden) {
    this.gold = null;
    this.score += 50;
    this.ate = 'gold';
    this.lastPts = 50;
    return 'eat';
  }
  if (eating) {
    this.apples++;
    this.lastPts = 10 + Math.floor(this.apples / 5) * 5;
    this.score += this.lastPts;
    this.ate = 'apple';
    if (this.apples % 4 === 0) this.stepTime = Math.max(0.085, this.stepTime * 0.93);
    this.placeApple();
    if (!this.apple) { this.dead = true; return 'win'; }   // the board is full!
    if (--this.goldIn <= 0 && !this.gold) {
      var f = this.free();
      if (f.length) { var g = f[Math.floor(Math.random() * f.length)]; this.gold = { c: g[0], r: g[1], t: 7 }; }
      this.goldIn = 5 + Math.floor(Math.random() * 4);
    }
    return 'eat';
  }
  this.snake.pop();
  return 'step';
};
