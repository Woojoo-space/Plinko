import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

const ROWS = 9;
const SLOT_COUNT = 10;
const STARTING_BALANCE = 1000;
const INITIAL_BET = 25;
const MULTIPLIERS = [5, 2.5, 1.4, 0.8, 0.4, 0.4, 0.8, 1.4, 2.5, 5];

function formatMoney(amount) {
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function createBall(id) {
  const slot = Math.floor(Math.random() * SLOT_COUNT);
  const jitter = Math.random() * 10 - 5;

  return {
    id,
    slot,
    x: ((slot + 0.5) / SLOT_COUNT) * 100 + jitter,
    drift: Math.random() > 0.5 ? 1 : -1,
    spin: Math.random() * 300 - 150,
  };
}

function App() {
  const [balance, setBalance] = useState(STARTING_BALANCE);
  const [bet, setBet] = useState(INITIAL_BET);
  const [balls, setBalls] = useState([]);
  const [lastDrop, setLastDrop] = useState('Drop a ball to start playing.');
  const [history, setHistory] = useState([]);
  const nextBallId = useRef(1);
  const payoutTimers = useRef([]);

  const pegRows = useMemo(
    () =>
      Array.from({ length: ROWS }, (_, row) =>
        Array.from({ length: row + 3 }, (__, peg) => ({
          id: `${row}-${peg}`,
          left: ((peg + 1) / (row + 4)) * 100,
          top: 11 + row * 8.5,
        })),
      ),
    [],
  );

  const canDrop = balance >= bet;

  useEffect(() => {
    return () => {
      payoutTimers.current.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, []);

  function dropBall() {
    if (!canDrop) {
      setLastDrop('Not enough fake money for that bet.');
      return;
    }

    const newBall = createBall(nextBallId.current);
    nextBallId.current += 1;
    const multiplier = MULTIPLIERS[newBall.slot];
    const payout = bet * multiplier;
    const profit = payout - bet;

    setBalance((current) => current - bet);
    setBalls((current) => [...current, newBall]);
    setLastDrop(`Ball is falling toward ${multiplier}x...`);

    const payoutTimer = window.setTimeout(() => {
      setBalance((current) => current + payout);
      setBalls((current) => current.filter((ball) => ball.id !== newBall.id));
      setLastDrop(
        `${multiplier}x slot paid ${formatMoney(payout)} (${profit >= 0 ? '+' : ''}${formatMoney(profit)}).`,
      );
      setHistory((current) =>
        [
          {
            id: newBall.id,
            multiplier,
            payout,
            profit,
          },
          ...current,
        ].slice(0, 5),
      );
      payoutTimers.current = payoutTimers.current.filter((timerId) => timerId !== payoutTimer);
    }, 3200);

    payoutTimers.current = [...payoutTimers.current, payoutTimer];
  }

  function updateBet(value) {
    const nextBet = Number(value);
    setBet(clamp(Number.isNaN(nextBet) ? INITIAL_BET : nextBet, 5, 250));
  }

  function resetGame() {
    payoutTimers.current.forEach((timerId) => window.clearTimeout(timerId));
    payoutTimers.current = [];
    setBalance(STARTING_BALANCE);
    setBet(INITIAL_BET);
    setBalls([]);
    setHistory([]);
    setLastDrop('Balance reset. The board is ready.');
  }

  return (
    <main className="plinko-page">
      <section className="game-shell" aria-labelledby="game-title">
        <div className="game-panel">
          <div className="game-intro">
            <p className="eyebrow">Fake-money arcade</p>
            <h1 id="game-title">Plinko Rush</h1>
            <p>
              Drop a ball, watch it bounce through the pegs, and land in a multiplier slot to grow
              your balance.
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
                min="5"
                max="250"
                step="5"
                value={bet}
                onChange={(event) => updateBet(event.target.value)}
              />
            </label>

            <button className="drop-button" type="button" onClick={dropBall} disabled={!canDrop}>
              Drop Ball
            </button>

            <button className="reset-button" type="button" onClick={resetGame}>
              Reset
            </button>
          </div>

          <p className="status" role="status" aria-live="polite">
            {lastDrop}
          </p>

          <div className="plinko-board" aria-label="Plinko board">
            <div className="drop-zone" />

            {pegRows.flat().map((peg) => (
              <span
                className="peg"
                key={peg.id}
                style={{
                  left: `${peg.left}%`,
                  top: `${peg.top}%`,
                }}
              />
            ))}

            {balls.map((ball) => (
              <span
                className="ball"
                key={ball.id}
                style={{
                  '--ball-x': `${ball.x}%`,
                  '--ball-drift': ball.drift,
                  '--ball-spin': `${ball.spin}deg`,
                }}
              />
            ))}

            <div className="slots">
              {MULTIPLIERS.map((multiplier, index) => (
                <div className="slot" key={`${multiplier}-${index}`}>
                  <span>{multiplier}x</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="history-panel" aria-label="Recent drops">
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
