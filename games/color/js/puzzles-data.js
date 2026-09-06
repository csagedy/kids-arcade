/* Built-in pictures, authored as 16x16 character art.
   '.' is blank (stays white, never needs painting).
   Every other char maps to a colour in `legend`; legend order sets the numbers. */

var BUILTIN_PUZZLES = [
  {
    id: 'fox',
    name: 'Fox',
    legend: { o: '#e8792b', d: '#b4571f', w: '#fff6ec', k: '#2b2118', p: '#f0938e' },
    art: [
      '................',
      '.dd..........dd.',
      '.dooo......oood.',
      '.doooo....ooood.',
      '..oooooooooooo..',
      '.oooooooooooooo.',
      '.owwoooooooowwo.',
      '.owkwoooooowkwo.',
      '.owwwoooooowwwo.',
      '.oooooooooooooo.',
      '.ooowwwwwwwwooo.',
      '..owwwwwwwwwwo..',
      '...wwwkkkkwww...',
      '....wwwppwww....',
      '.....wwwwww.....',
      '................'
    ]
  },
  {
    id: 'rocket',
    name: 'Rocket',
    legend: { w: '#eceff4', b: '#4fc3f7', r: '#e5484d', f: '#ff8a3d', y: '#ffd645' },
    art: [
      '................',
      '.......ww.......',
      '......wwww......',
      '......wbbw......',
      '......wbbw......',
      '......wwww......',
      '.....wwwwww.....',
      '.....wwwwww.....',
      '....rwwwwwwr....',
      '...rrwwwwwwrr...',
      '...rr.wwww.rr...',
      '......wwww......',
      '.......ff.......',
      '......fyyf......',
      '.......fy.......',
      '................'
    ]
  },
  {
    id: 'flower',
    name: 'Flower',
    legend: { p: '#f06ca8', y: '#ffd645', g: '#2fa84f', l: '#6dd36d' },
    art: [
      '................',
      '......pppp......',
      '.....pppppp.....',
      '....ppp..ppp....',
      '....pp.yy.pp....',
      '....pp.yy.pp....',
      '....ppp..ppp....',
      '.....pppppp.....',
      '......pppp......',
      '.......gg.......',
      '.......gg.......',
      '...lll.gg.......',
      '..lllll.gg......',
      '...lll..gg.lll..',
      '.......gg.lllll.',
      '.......gg..lll..'
    ]
  },
  {
    id: 'fish',
    name: 'Fish',
    legend: { o: '#ff9b3d', d: '#e5622a', w: '#fff6ec', k: '#2b2118', b: '#7fd8f7' },
    art: [
      '................',
      '................',
      '....oooooo......',
      '..oooooooooo.dd.',
      '.okooooooooooddd',
      '.oooooooooooodd.',
      '.owwwwwwwwwwodd.',
      '..owwwwwwwww.dd.',
      '....wwwwww......',
      '................',
      '.........b......',
      '..........b.....',
      '.........bb.....',
      '................',
      '................',
      '................'
    ]
  }
];
