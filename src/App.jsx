import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

const ROWS = 8;
const HIDDEN_TOP_ROWS = 2;
const STARTING_BALANCE = 1000;
const INITIAL_BET = 25;
const DEFAULT_MULTIPLIERS = addEdgeMultipliers([2.1, 1.1, 1, 0.5, 1, 1.1, 2.1]);
const SLOT_COUNT = DEFAULT_MULTIPLIERS.length;
const REROLL_COST = 500;
const REROLL_COST_LABEL = '$500';
const SAVE_KEY = 'plinko-progress-v1';
const BALL_RADIUS = 12;
const PEG_RADIUS = 7;
const GRAVITY = 0.34;
const AIR_RESISTANCE = 0.997;
const RESTITUTION = 0.38;
const PEG_IMPACT_DAMPING = 0.82;
const MAX_LAUNCH_ANGLE = 0.18;
const MAX_SPIN = 0.045;
const MULTIPLIER_PRESETS = {
  common: [
    { name: 'Common 1', values: addEdgeMultipliers([2.4, 1, 0.9, 0.55, 0.9, 1, 2.4]) },
    { name: 'Common 2', values: addEdgeMultipliers([3, 0.9, 0.9, 0.6, 0.9, 0.9, 3]) },
    { name: 'Common 3', values: addEdgeMultipliers([3.6, 0.8, 0.9, 0.65, 0.9, 0.8, 3.6]) },
    { name: 'Common 4', values: addEdgeMultipliers([4.2, 0.8, 0.9, 0.6, 0.9, 0.8, 4.2]) },
    { name: 'Common 5', values: addEdgeMultipliers([2.6, 1.2, 0.9, 0.55, 0.9, 1.2, 2.6]) },
    { name: 'Common 6', values: addEdgeMultipliers([3.2, 1.1, 0.9, 0.55, 0.9, 1.1, 3.2]) },
    { name: 'Common 7', values: addEdgeMultipliers([4.5, 0.7, 0.95, 0.6, 0.95, 0.7, 4.5]) },
    { name: 'Common 8', values: addEdgeMultipliers([5, 0.7, 0.95, 0.6, 0.95, 0.7, 5]) },
  ],
  uncommon: [
    { name: 'Uncommon 1', values: addEdgeMultipliers([2.8, 1.3, 0.95, 0.5, 0.95, 1.3, 2.8]) },
    { name: 'Uncommon 2', values: addEdgeMultipliers([3.5, 1.1, 0.95, 0.55, 0.95, 1.1, 3.5]) },
    { name: 'Uncommon 3', values: addEdgeMultipliers([4, 1, 1, 0.55, 1, 1, 4]) },
    { name: 'Uncommon 4', values: addEdgeMultipliers([4.8, 0.9, 1, 0.55, 1, 0.9, 4.8]) },
    { name: 'Uncommon 5', values: addEdgeMultipliers([5.5, 0.8, 1, 0.55, 1, 0.8, 5.5]) },
  ],
  rare: [
    { name: 'Rare 1', values: addEdgeMultipliers([3, 1.4, 1, 0.5, 1, 1.4, 3]) },
    { name: 'Rare 2', values: addEdgeMultipliers([4, 1.2, 1.05, 0.5, 1.05, 1.2, 4]) },
    { name: 'Rare 3', values: addEdgeMultipliers([5, 1, 1.05, 0.55, 1.05, 1, 5]) },
    { name: 'Rare 4', values: addEdgeMultipliers([6, 0.9, 1.05, 0.55, 1.05, 0.9, 6]) },
  ],
  epic: [
    { name: 'Epic 1', values: addEdgeMultipliers([4, 1.4, 1.05, 0.5, 1.05, 1.4, 4]) },
    { name: 'Epic 2', values: addEdgeMultipliers([5.5, 1.1, 1.1, 0.55, 1.1, 1.1, 5.5]) },
  ],
  legendary: [
    { name: 'Legendary 1', values: addEdgeMultipliers([6, 1.2, 1.1, 0.5, 1.1, 1.2, 6], 1.1) },
  ],
};
const RARITY_CHANCES = [
  { rarity: 'common', chance: 0.45 },
  { rarity: 'uncommon', chance: 0.3 },
  { rarity: 'rare', chance: 0.16 },
  { rarity: 'epic', chance: 0.07 },
  { rarity: 'legendary', chance: 0.02 },
];

function formatMoney(amount) {
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatBetInput(amount) {
  return String(Number(amount.toFixed(2)));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function addEdgeMultipliers(multipliers, edgeMultiplier = 0) {
  return [edgeMultiplier, ...multipliers, edgeMultiplier];
}

function isValidMultiplierSet(multipliers) {
  return (
    Array.isArray(multipliers) &&
    multipliers.length === SLOT_COUNT &&
    multipliers.every((multiplier) => Number.isFinite(multiplier))
  );
}

function loadSavedProgress() {
  if (typeof window === 'undefined') {
    return {
      balance: STARTING_BALANCE,
      multipliers: DEFAULT_MULTIPLIERS,
      rarity: 'default',
    };
  }

  try {
    const savedProgress = JSON.parse(window.localStorage.getItem(SAVE_KEY));
    const savedBalance = Number(savedProgress?.balance);
    const hasSavedMultipliers = isValidMultiplierSet(savedProgress?.multipliers);

    return {
      balance: Number.isFinite(savedBalance) && savedBalance >= 0 ? savedBalance : STARTING_BALANCE,
      multipliers: hasSavedMultipliers ? savedProgress.multipliers : DEFAULT_MULTIPLIERS,
      rarity: hasSavedMultipliers ? savedProgress?.rarity || 'custom' : 'default',
    };
  } catch {
    return {
      balance: STARTING_BALANCE,
      multipliers: DEFAULT_MULTIPLIERS,
      rarity: 'default',
    };
  }
}

function saveProgress(progress) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
}

function rerollMultiplierPreset() {
  const rarityRoll = Math.random();
  let cumulativeChance = 0;
  let selectedRarity = RARITY_CHANCES[RARITY_CHANCES.length - 1].rarity;

  for (const { rarity, chance } of RARITY_CHANCES) {
    cumulativeChance += chance;
    if (rarityRoll <= cumulativeChance) {
      selectedRarity = rarity;
      break;
    }
  }

  const presets = MULTIPLIER_PRESETS[selectedRarity];
  const preset = presets[Math.floor(Math.random() * presets.length)];

  return {
    rarity: selectedRarity,
    name: preset.name,
    multipliers: [...preset.values],
  };
}

function getBoardGeometry(width, height) {
  const sidePadding = 8;
  const top = 86;
  const slotTop = height - 86;
  const rowGap = (slotTop - top - 36) / (ROWS - 1);
  const spacing = Math.min((width - sidePadding * 2) / ROWS, rowGap * 1.2);
  const boardWidth = spacing * ROWS;
  const left = width / 2 - boardWidth / 2;
  const slotWidth = boardWidth / SLOT_COUNT;

  const pegs = Array.from({ length: ROWS }, (_, row) => {
    const count = row + 1;
    const rowWidth = row * spacing;
    const startX = width / 2 - rowWidth / 2;

    return Array.from({ length: count }, (_, index) => ({
      hidden: row < HIDDEN_TOP_ROWS,
      x: startX + index * spacing,
      y: top + row * rowGap,
    }));
  })
    .flat()
    .filter((peg) => !peg.hidden);

  return {
    boardLeft: left,
    boardRight: left + boardWidth,
    boardWidth,
    width,
    height,
    pegs,
    slotTop,
    slotWidth,
  };
}

function drawBoard(context, geometry, balls) {
  const { boardLeft, boardRight, boardWidth, height, pegs, slotTop, slotWidth, width } = geometry;

  context.clearRect(0, 0, width, height);

  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#ff7fbd');
  gradient.addColorStop(0.48, '#f3a7d5');
  gradient.addColorStop(1, '#87d8ff');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.fillStyle = 'rgba(255, 255, 255, 0.16)';
  context.beginPath();
  context.arc(width * 0.18, height * 0.16, 74, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.arc(width * 0.9, height * 0.07, 112, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.arc(width * 0.08, height * 0.58, 48, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = 'rgba(255, 255, 255, 0.1)';
  context.strokeStyle = 'rgba(255, 255, 255, 0.24)';
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(width / 2 - 42, 22, 84, 26, 13);
  context.fill();
  context.stroke();

  pegs.forEach((peg) => {
    const glow = context.createRadialGradient(peg.x, peg.y, 2, peg.x, peg.y, 22);
    glow.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    glow.addColorStop(0.35, 'rgba(186, 239, 255, 0.52)');
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(peg.x, peg.y, 22, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(peg.x, peg.y, PEG_RADIUS, 0, Math.PI * 2);
    context.fill();
  });

  context.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  context.lineWidth = 2;
  for (let divider = 0; divider <= SLOT_COUNT; divider += 1) {
    const x = boardLeft + divider * slotWidth;
    context.beginPath();
    context.moveTo(x, slotTop);
    context.lineTo(x, height - 8);
    context.stroke();
  }

  balls.forEach((ball) => {
    const highlightX = ball.x - Math.cos(ball.rotation) * 4;
    const highlightY = ball.y - Math.sin(ball.rotation) * 5;
    const ballGradient = context.createRadialGradient(
      highlightX,
      highlightY,
      2,
      ball.x,
      ball.y,
      BALL_RADIUS,
    );
    ballGradient.addColorStop(0, '#fff7bb');
    ballGradient.addColorStop(0.42, '#ffd15c');
    ballGradient.addColorStop(1, '#f16f42');
    context.fillStyle = ballGradient;
    context.beginPath();
    context.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(ball.x, ball.y, BALL_RADIUS - 4, ball.rotation, ball.rotation + Math.PI * 0.72);
    context.stroke();
  });

  context.fillStyle = 'rgba(255, 255, 255, 0.12)';
  context.fillRect(boardLeft, slotTop, boardWidth, 2);
}

function resolvePegCollision(ball, peg) {
  const dx = ball.x - peg.x;
  const dy = ball.y - peg.y;
  const minDistance = BALL_RADIUS + PEG_RADIUS;
  const distance = Math.hypot(dx, dy);

  if (distance === 0 || distance >= minDistance) {
    return;
  }

  const normalX = dx / distance;
  const normalY = dy / distance;
  const overlap = minDistance - distance;
  const speedAlongNormal = ball.vx * normalX + ball.vy * normalY;

  ball.x += normalX * overlap;
  ball.y += normalY * overlap;

  if (speedAlongNormal < 0) {
    ball.vx -= (1 + RESTITUTION) * speedAlongNormal * normalX;
    ball.vy -= (1 + RESTITUTION) * speedAlongNormal * normalY;
    ball.vx *= PEG_IMPACT_DAMPING;
    ball.vy *= PEG_IMPACT_DAMPING;
  }

  ball.vx += normalX * 0.08;
}

function App() {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const ballsRef = useRef([]);
  const geometryRef = useRef(null);
  const nextBallId = useRef(1);
  const activeBetsRef = useRef(new Map());
  const multipliersRef = useRef(DEFAULT_MULTIPLIERS);
  const rerollInProgressRef = useRef(false);
  const rerollTimerRef = useRef(null);
  const initialProgress = useMemo(loadSavedProgress, []);

  const [balance, setBalance] = useState(initialProgress.balance);
  const [betInput, setBetInput] = useState(String(INITIAL_BET));
  const [activeMultipliers, setActiveMultipliers] = useState(initialProgress.multipliers);
  const [activeRarity, setActiveRarity] = useState(initialProgress.rarity);
  const [isRerolling, setIsRerolling] = useState(false);
  const [rerollMessage, setRerollMessage] = useState(
    initialProgress.rarity === 'default' ? 'Default multipliers active.' : `${initialProgress.rarity} multipliers active.`,
  );
  const [activeBalls, setActiveBalls] = useState(0);
  const [lastDrop, setLastDrop] = useState('Drop a ball to start playing.');
  const [history, setHistory] = useState([]);

  const maxBet = Math.floor(balance * 90) / 100;
  const bet = Number(betInput);
  const canDrop = Number.isFinite(bet) && bet > 0 && bet <= maxBet && balance >= bet;

  const slotLabels = useMemo(
    () =>
      activeMultipliers.map((multiplier, index) => ({
        id: `${multiplier}-${index}`,
        multiplier,
      })),
    [activeMultipliers],
  );

  useEffect(() => {
    multipliersRef.current = activeMultipliers;
  }, [activeMultipliers]);

  useEffect(() => {
    saveProgress({
      balance,
      multipliers: activeMultipliers,
      rarity: activeRarity,
    });
  }, [activeMultipliers, activeRarity, balance]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) {
      return undefined;
    }

    let lastFrame = performance.now();

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * pixelRatio);
      canvas.height = Math.floor(rect.height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      geometryRef.current = getBoardGeometry(rect.width, rect.height);
      drawBoard(context, geometryRef.current, ballsRef.current);
    }

    function finishBall(ball, slotIndex) {
      const dropBet = activeBetsRef.current.get(ball.id) ?? 0;
      const multiplier = multipliersRef.current[slotIndex] ?? 0;
      const payout = dropBet * multiplier;
      const profit = payout - dropBet;

      activeBetsRef.current.delete(ball.id);
      setBalance((current) => current + payout);
      setLastDrop(
        `${multiplier}x slot paid ${formatMoney(payout)} (${profit >= 0 ? '+' : ''}${formatMoney(profit)}).`,
      );
      setHistory((current) =>
        [
          {
            id: ball.id,
            multiplier,
            payout,
            profit,
          },
          ...current,
        ].slice(0, 5),
      );
    }

    function updateBall(ball, geometry, timeScale) {
      ball.vy += GRAVITY * timeScale;
      ball.vx *= AIR_RESISTANCE;
      ball.vy *= AIR_RESISTANCE;
      ball.vx += ball.spin * timeScale;
      ball.spin *= 0.993;
      ball.rotation += ball.spin * 32 * timeScale;
      ball.x += ball.vx * timeScale;
      ball.y += ball.vy * timeScale;

      const wallLeft = BALL_RADIUS;
      const wallRight = geometry.width - BALL_RADIUS;

      if (ball.x < wallLeft) {
        ball.x = wallLeft;
        ball.vx = Math.abs(ball.vx) * 0.25;
      }

      if (ball.x > wallRight) {
        ball.x = wallRight;
        ball.vx = -Math.abs(ball.vx) * 0.25;
      }

      geometry.pegs.forEach((peg) => resolvePegCollision(ball, peg));

      if (ball.y + BALL_RADIUS >= geometry.slotTop) {
        const slotIndex = clamp(
          Math.floor((ball.x - geometry.boardLeft) / geometry.slotWidth),
          0,
          SLOT_COUNT - 1,
        );

        finishBall(ball, slotIndex);
        return false;
      }

      return true;
    }

    function tick(now) {
      const geometry = geometryRef.current;
      const timeScale = clamp((now - lastFrame) / 16.67, 0.5, 2);
      lastFrame = now;

      if (geometry) {
        ballsRef.current = ballsRef.current.filter((ball) => updateBall(ball, geometry, timeScale));
        drawBoard(context, geometry, ballsRef.current);
        setActiveBalls(ballsRef.current.length);
      }

      animationRef.current = window.requestAnimationFrame(tick);
    }

    resizeCanvas();
    const resizeObserver =
      'ResizeObserver' in window
        ? new ResizeObserver(resizeCanvas)
        : {
            disconnect: () => window.removeEventListener('resize', resizeCanvas),
            observe: () => window.addEventListener('resize', resizeCanvas),
          };
    resizeObserver.observe(canvas);
    animationRef.current = window.requestAnimationFrame(tick);

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationRef.current);
      window.clearTimeout(rerollTimerRef.current);
    };
  }, []);

  function dropBall() {
    const geometry = geometryRef.current;

    if (!geometry) {
      return;
    }

    if (!Number.isFinite(bet) || bet <= 0) {
      setLastDrop('Type a valid bet amount first.');
      return;
    }

    if (bet > maxBet) {
      setLastDrop(`Max bet is ${formatMoney(maxBet)} (90% of your balance).`);
      return;
    }

    if (!canDrop) {
      setLastDrop('Not enough fake money for that bet.');
      return;
    }

    const launchAngle = (Math.random() - 0.5) * MAX_LAUNCH_ANGLE;
    const launchSpeed = 0.75 + Math.random() * 0.65;
    const spin = (Math.random() - 0.5) * MAX_SPIN;

    const ball = {
      id: nextBallId.current,
      x: geometry.boardLeft + geometry.boardWidth / 2 + (Math.random() - 0.5) * 10,
      y: 36,
      vx: Math.sin(launchAngle) * launchSpeed,
      vy: Math.cos(launchAngle) * launchSpeed,
      rotation: Math.random() * Math.PI * 2,
      spin,
    };

    nextBallId.current += 1;
    ballsRef.current = [...ballsRef.current, ball];
    activeBetsRef.current.set(ball.id, bet);
    setBalance((current) => current - bet);
    setActiveBalls(ballsRef.current.length);
    setLastDrop('Ball dropped. Gravity and collisions decide the slot.');
  }

  function updateBet(value) {
    setBetInput(value);
  }

  function normalizeBet() {
    const nextBet = Number(betInput);

    if (!Number.isFinite(nextBet) || nextBet <= 0) {
      setBetInput(formatBetInput(Math.min(INITIAL_BET, maxBet)));
      return;
    }

    setBetInput(formatBetInput(Math.min(nextBet, maxBet)));
  }

  function handleRerollMultipliers() {
    if (rerollInProgressRef.current) {
      return;
    }

    if (balance < REROLL_COST) {
      setRerollMessage(`Not enough money. Reroll costs ${formatMoney(REROLL_COST)}.`);
      setLastDrop(`Not enough money to reroll multipliers.`);
      return;
    }

    rerollInProgressRef.current = true;
    setIsRerolling(true);

    const result = rerollMultiplierPreset();
    setBalance((current) => current - REROLL_COST);
    setActiveMultipliers(result.multipliers);
    setActiveRarity(result.rarity);
    setRerollMessage(`${result.rarity.toUpperCase()} MULTIPLIERS! ${result.name} activated.`);
    setLastDrop(`New multiplier set: ${result.rarity}. Reroll cost ${formatMoney(REROLL_COST)}.`);

    window.clearTimeout(rerollTimerRef.current);
    rerollTimerRef.current = window.setTimeout(() => {
      rerollInProgressRef.current = false;
      setIsRerolling(false);
    }, 400);
  }

  function resetGame() {
    ballsRef.current = [];
    activeBetsRef.current.clear();
    setBalance(STARTING_BALANCE);
    setBetInput(String(INITIAL_BET));
    setActiveMultipliers(DEFAULT_MULTIPLIERS);
    setActiveRarity('default');
    setRerollMessage('Default multipliers active.');
    setActiveBalls(0);
    setHistory([]);
    setLastDrop('Balance reset. The board is ready.');
  }

  return (
    <main className="plinko-page">
      <section className="game-shell" aria-labelledby="game-title">
        <div className="game-panel">
          <div className="game-intro">
            <p className="eyebrow">Arcade game</p>
            <h1 id="game-title">Plinko</h1>
            <p>
              Drop chips through the peg pyramid and aim for the biggest multiplier at the edge.
            </p>
          </div>

          <div className="controls" aria-label="Game controls">
            <div>
              <span className="label">Balance</span>
              <strong>{formatMoney(balance)}</strong>
            </div>

            <label className="bet-control">
              <span className="label">Bet amount</span>
              <input
                type="number"
                min="0"
                max={maxBet}
                step="0.01"
                value={betInput}
                onChange={(event) => updateBet(event.target.value)}
                onBlur={normalizeBet}
              />
              <small>Max {formatMoney(maxBet)}</small>
            </label>

            <button className="drop-button" type="button" onClick={dropBall} disabled={!canDrop}>
              Drop Ball
            </button>

            <button className="reset-button" type="button" onClick={resetGame}>
              Reset
            </button>
          </div>

          <p className="status" role="status" aria-live="polite">
            {lastDrop} {activeBalls > 0 ? `${activeBalls} in motion.` : ''}
          </p>

          <div className="plinko-board" aria-label="Physics Plinko board">
            <div className="board-title">Plinko</div>
            <canvas ref={canvasRef} aria-hidden="true" />

            <div className="slots" aria-label="Multiplier slots">
              {slotLabels.map(({ id, multiplier }) => (
                <div className="slot" key={id}>
                  <span>{multiplier}x</span>
                </div>
              ))}
            </div>
          </div>

          <div className={`reroll-panel rarity-${activeRarity}`}>
            <div>
              <span className="label">Multiplier reroll</span>
              <strong>{rerollMessage}</strong>
            </div>
            <button
              className="reroll-button"
              type="button"
              onClick={handleRerollMultipliers}
              disabled={isRerolling}
            >
              Reroll Multipliers &mdash; {REROLL_COST_LABEL}
            </button>
          </div>
        </div>

        <aside className="history-panel" aria-label="Recent drops">
          <h2>How to Play</h2>
          <p className="how-to">
            Pick your bet, drop a chip, and let the pegs decide which prize slot pays out.
          </p>
          <h2>Recent drops</h2>
          {history.length === 0 ? (
            <p className="empty-history">Your first drop will show up here.</p>
          ) : (
            <ul>
              {history.map((drop) => (
                <li key={drop.id}>
                  <span>{drop.multiplier}x</span>
                  <strong className={drop.profit >= 0 ? 'win' : 'loss'}>
                    {drop.profit >= 0 ? '+' : ''}
                    {formatMoney(drop.profit)}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </section>
    </main>
  );
}

export default App;
