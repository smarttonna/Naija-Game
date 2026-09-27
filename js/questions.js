/**
 * Naija Math Battle — Question Generator
 * Deterministic: same seed + round = same question on all devices
 * Shuffled & varied per time: operations and question types are shuffled
 */

// --- Seeded RNG (Mulberry32) ---
function createRNG(seed) {
  let s = (seed >>> 0) || 123456789;
  return function () {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Utility: Fisher-Yates array shuffle using seeded RNG
function shuffleArray(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Nigerian names & items for authentic cultural context
const NG_NAMES = [
  'Tunde', 'Amaka', 'Emeka', 'Fatima', 'Chike', 'Sade', 
  'Biodun', 'Ngozi', 'Yusuf', 'Chioma', 'Bello', 'Adaeze',
  'Obinna', 'Zainab', 'Kunle', 'Folake', 'Ibrahim', 'Halima'
];

const NG_ITEMS = [
  'tubers of yam', 'oranges', 'crates of eggs', 'bags of rice', 
  'baskets of tomatoes', 'mangoes', 'bunches of plantain', 'bottles of groundnut', 
  'sachets of pure water', 'packs of noodles', 'sticks of suya', 'pieces of meat pie',
  'packs of puff-puff', 'loaves of Agege bread', 'sticks of gala'
];

const NG_PLACES = [
  'Balogun Market', 'the school canteen', 'Mile 12 Market', 'Onitsha Main Market', 
  'Wuse Market Abuja', 'Bodija Market Ibadan', 'Oshodi Market', 'Alaba International', 
  'the street corner shop', 'the school gate'
];

/**
 * Generate a question deterministically from seed + round number
 * Questions are shuffled per round and across games
 * @param {number} seed - Room or game random seed
 * @param {number} round - Current round (1-based)
 * @param {string[]} operations - Array of: 'add','subtract','multiply','divide'
 * @param {string} difficulty - 'easy'|'medium'|'hard'
 * @param {string} type - 'arithmetic'|'story'|'mixed'
 * @returns {{ text: string, answer: number }}
 */
function generateQuestion(seed, round, operations, difficulty = 'easy', type = 'arithmetic') {
  // Use Knuth multiplicative hash for high-entropy deterministic round RNG
  const roundSeed = (seed ^ Math.imul(round, 2654435761)) >>> 0;
  const rng = createRNG(roundSeed);

  // Determine question type: if 'mixed', deterministically shuffle between arithmetic and story
  let chosenType = type;
  if (type === 'mixed') {
    chosenType = rng() < 0.5 ? 'arithmetic' : 'story';
  }

  // Shuffle operations so questions don't repeat the same operator consecutively
  let op = 'add';
  const validOps = (operations && operations.length > 0) ? operations : ['add'];
  if (validOps.length === 1) {
    op = validOps[0];
  } else {
    // Generate a shuffled cycle of operations based on room seed
    const cycleNum = Math.floor((round - 1) / validOps.length);
    const cycleIndex = (round - 1) % validOps.length;
    const cycleRng = createRNG((seed + cycleNum * 99991) >>> 0);
    const shuffledOps = shuffleArray(validOps, cycleRng);
    op = shuffledOps[cycleIndex];
  }

  if (chosenType === 'story') {
    return generateStory(rng, difficulty, op);
  }
  return generateArithmetic(rng, difficulty, op);
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function generateArithmetic(rng, difficulty, op) {
  let a, b, answer, symbol;

  switch (difficulty) {
    case 'easy':
      a = randInt(rng, 2, 12);
      b = randInt(rng, 1, 12);
      break;
    case 'medium':
      a = randInt(rng, 10, 50);
      b = randInt(rng, 4, 35);
      break;
    case 'hard':
      a = randInt(rng, 25, 120);
      b = randInt(rng, 12, 85);
      break;
  }

  switch (op) {
    case 'add': {
      // Occasional 3-number addition on medium and hard for variety
      if (difficulty !== 'easy' && rng() < 0.3) {
        const c = randInt(rng, 2, difficulty === 'medium' ? 15 : 30);
        answer = a + b + c;
        return { text: `${a} + ${b} + ${c} = ?`, answer };
      }
      answer = a + b;
      symbol = '+';
      break;
    }
    case 'subtract': {
      if (b > a) [a, b] = [b, a];
      answer = a - b;
      symbol = '−';
      break;
    }
    case 'multiply': {
      if (difficulty === 'easy') { a = randInt(rng, 2, 9); b = randInt(rng, 2, 9); }
      else if (difficulty === 'medium') { a = randInt(rng, 3, 14); b = randInt(rng, 3, 12); }
      else { a = randInt(rng, 6, 25); b = randInt(rng, 4, 18); }
      answer = a * b;
      symbol = '×';
      break;
    }
    case 'divide': {
      let divisorMax = difficulty === 'easy' ? 9 : difficulty === 'medium' ? 12 : 18;
      let quotientMax = difficulty === 'easy' ? 10 : difficulty === 'medium' ? 15 : 22;
      b = randInt(rng, 2, divisorMax);
      answer = randInt(rng, 2, quotientMax);
      a = b * answer;
      symbol = '÷';
      break;
    }
  }

  // Missing number variant on medium/hard (e.g. "? + b = answer" or "a - ? = answer")
  if (difficulty !== 'easy' && rng() < 0.25) {
    if (op === 'add') {
      return { text: `${a} + ? = ${a + b}`, answer: b };
    }
    if (op === 'subtract') {
      return { text: `${a} − ? = ${a - b}`, answer: b };
    }
    if (op === 'multiply' && a <= 15 && b <= 12) {
      return { text: `${a} × ? = ${a * b}`, answer: b };
    }
  }

  return { text: `${a} ${symbol} ${b} = ?`, answer };
}

function generateStory(rng, difficulty, op) {
  const name = pick(rng, NG_NAMES);
  const name2 = pick(rng, NG_NAMES.filter(n => n !== name));
  const item = pick(rng, NG_ITEMS);
  const place = pick(rng, NG_PLACES);

  let a, b, answer, text;

  switch (op) {
    case 'add': {
      if (difficulty === 'easy') {
        a = randInt(rng, 2, 12);
        b = randInt(rng, 2, 12);
      } else if (difficulty === 'medium') {
        a = randInt(rng, 10, 45);
        b = randInt(rng, 10, 45);
      } else {
        a = randInt(rng, 35, 120);
        b = randInt(rng, 25, 95);
      }
      answer = a + b;

      const nairaA = pick(rng, [100, 200, 300, 500, 750]);
      const nairaB = pick(rng, [50, 100, 150, 250, 350]);

      const templates = [
        `${name} bought ${a} ${item} on Monday and ${b} more on Tuesday at ${place}. How many in total?`,
        `${name} had ${a} ${item}. ${name2} gave him ${b} more. How many does he have now?`,
        `${a} students entered the school bus from Ikeja, and ${b} more joined at Yaba. How many students altogether?`,
        `${name} saved ₦${nairaA} in his piggy bank (kolo) and his uncle gave him ₦${nairaB}. How much does he have now?`,
        `Mama fried ${a} puff-puff in the morning and ${b} puff-puff in the evening. How many puff-puff did she fry in total?`,
        `${name} scored ${a} points in the first math round and ${b} points in the second. What is his total score?`,
        `At ${place}, ${name} bought ₦${nairaA} MTN airtime and ₦${nairaB} Airtel airtime. How much airtime did he buy in total?`
      ];

      // If naira template picked, adjust answer
      const chosenTemplate = pick(rng, templates);
      if (chosenTemplate.includes('piggy bank')) {
        text = chosenTemplate;
        answer = nairaA + nairaB;
      } else if (chosenTemplate.includes('airtime')) {
        text = chosenTemplate;
        answer = nairaA + nairaB;
      } else {
        text = chosenTemplate;
      }
      break;
    }

    case 'subtract': {
      if (difficulty === 'easy') {
        b = randInt(rng, 2, 10);
        a = b + randInt(rng, 2, 12);
      } else if (difficulty === 'medium') {
        b = randInt(rng, 8, 30);
        a = b + randInt(rng, 10, 40);
      } else {
        b = randInt(rng, 25, 75);
        a = b + randInt(rng, 30, 95);
      }
      answer = a - b;

      const fareTotal = pick(rng, [200, 300, 500, 1000]);
      const fareRide = pick(rng, [50, 100, 150, 200, 300]);

      const templates = [
        `${name} had ${a} ${item}. She sold ${b} of them at ${place}. How many are left?`,
        `There were ${a} students in the classroom. ${b} went out for sports. How many students remained?`,
        `Mama bought ${a} ${item} and used ${b} for cooking party jollof rice. How many are left?`,
        `${name} gave the Danfo conductor ₦${fareTotal} for a ₦${fareRide} trip. How much change will he collect?`,
        `${name} loaded ₦${fareTotal} airtime and used ₦${fareRide} for data. How much balance remains?`,
        `A baker had ${a} loaves of Agege bread. Customers bought ${b} loaves. How many loaves are left in the shop?`,
        `${name} picked ${a} oranges from the farm. ${b} of them were not ripe. How many ripe oranges does he have?`
      ];

      const chosenTemplate = pick(rng, templates);
      if (chosenTemplate.includes('Danfo conductor')) {
        text = chosenTemplate;
        answer = fareTotal - fareRide;
      } else if (chosenTemplate.includes('airtime')) {
        text = chosenTemplate;
        answer = fareTotal - fareRide;
      } else {
        text = chosenTemplate;
      }
      break;
    }

    case 'multiply': {
      if (difficulty === 'easy') {
        a = randInt(rng, 2, 8);
        b = randInt(rng, 2, 6);
      } else if (difficulty === 'medium') {
        a = randInt(rng, 3, 12);
        b = randInt(rng, 3, 10);
      } else {
        a = randInt(rng, 5, 20);
        b = randInt(rng, 4, 15);
      }
      answer = a * b;

      const suyaPrice = pick(rng, [50, 100, 150, 200]);
      const suyaQty = randInt(rng, 2, difficulty === 'easy' ? 5 : 8);

      const templates = [
        `${name} bought ${a} baskets. Each basket holds ${b} ${item}. How many ${item} altogether?`,
        `${a} students each contributed ₦${difficulty === 'easy' ? 20 : 50} for school project. How much was raised in total?`,
        `${name} bought ${suyaQty} sticks of suya at ₦${suyaPrice} each. How much did he pay in total?`,
        `A Danfo bus has ${a} rows of seats, and each row takes ${b} passengers. How many passengers can sit?`,
        `${name} packs ${b} meat pies in each takeaway box. If he has ${a} boxes, how many meat pies in total?`,
        `At ${place}, ${name} sells ${item} in groups of ${b}. If he sells ${a} groups, how many did he sell?`,
        `${name} solves ${b} math battle questions every day for ${a} days. How many questions has he solved?`
      ];

      const chosenTemplate = pick(rng, templates);
      if (chosenTemplate.includes('suya')) {
        text = chosenTemplate;
        answer = suyaQty * suyaPrice;
      } else if (chosenTemplate.includes('contributed')) {
        text = chosenTemplate;
        answer = a * (difficulty === 'easy' ? 20 : 50);
      } else {
        text = chosenTemplate;
      }
      break;
    }

    case 'divide': {
      let bLimit = difficulty === 'easy' ? 6 : difficulty === 'medium' ? 10 : 15;
      let ansLimit = difficulty === 'easy' ? 8 : difficulty === 'medium' ? 12 : 20;
      b = randInt(rng, 2, bLimit);
      answer = randInt(rng, 2, ansLimit);
      a = answer * b;

      const moneyTotal = pick(rng, [200, 400, 500, 1000]);
      const friendsCount = moneyTotal === 500 ? pick(rng, [2, 5]) : pick(rng, [2, 4]);

      const templates = [
        `${name} shared ${a} ${item} equally among ${b} friends at ${place}. How many did each friend get?`,
        `${a} students formed ${b} equal lines on the assembly ground. How many students in each line?`,
        `Mama bought ${a} oranges and divided them equally into ${b} bags. How many oranges in each bag?`,
        `Uncle shared ₦${moneyTotal} equally between his ${friendsCount} children. How much did each child get?`,
        `A teacher shared ${a} notebooks equally among ${b} pupils. How many notebooks did each pupil receive?`,
        `${a} pieces of puff-puff were distributed equally to ${b} guests at the party. How many did each guest receive?`
      ];

      const chosenTemplate = pick(rng, templates);
      if (chosenTemplate.includes('Uncle shared')) {
        text = chosenTemplate;
        answer = moneyTotal / friendsCount;
      } else {
        text = chosenTemplate;
      }
      break;
    }
  }

  return { text, answer };
}

// Export
window.Questions = { generateQuestion };

