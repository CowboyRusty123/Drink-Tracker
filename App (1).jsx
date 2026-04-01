import { useState, useEffect, useRef } from "react";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, push, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDKNedtyqAAl6iGwk0ThhnaPLKw17XuxPM",
  authDomain: "drink-tracker-3e11c.firebaseapp.com",
  databaseURL: "https://drink-tracker-3e11c-default-rtdb.firebaseio.com",
  projectId: "drink-tracker-3e11c",
  storageBucket: "drink-tracker-3e11c.firebasestorage.app",
  messagingSenderId: "27005216782",
  appId: "1:27005216782:web:9bebbfe9cfe13925baf45f"
};

const DEFAULT_DRINKS = [
  { id: "hahn",       name: "Hahn Super Dry",  emoji: "🍺", size: "Schooner 425ml", price: 7.60, happyPrice: 5.50, calories: 114, std: 1.2, color: "#C8102E", textColor: "#fff" },
  { id: "tooheysnew", name: "Tooheys New",      emoji: "🍺", size: "Schooner 425ml", price: 7.60, happyPrice: 5.50, calories: 120, std: 1.2, color: "#003087", textColor: "#fff" },
  { id: "tooheyold",  name: "Tooheys Old",      emoji: "🍺", size: "Schooner 425ml", price: 7.60, happyPrice: 5.50, calories: 125, std: 1.2, color: "#1a0a00", textColor: "#d4a843" },
  { id: "vb",         name: "VB",               emoji: "🍺", size: "Schooner 425ml", price: 7.60, happyPrice: 5.50, calories: 118, std: 1.2, color: "#FFD700", textColor: "#c8102e" },
  { id: "xxxx",       name: "XXXX Gold",        emoji: "🍺", size: "Schooner 425ml", price: 7.60, happyPrice: 5.50, calories: 116, std: 1.2, color: "#F4A300", textColor: "#1a1a1a" },
  { id: "jimbeam",    name: "Jim Beam Cola",    emoji: "🥃", size: "UDL Can 375ml",  price: 9.50, happyPrice: 9.50, calories: 228, std: 1.5, color: "#BF0000", textColor: "#fff" },
  { id: "rumcola",    name: "Rum & Cola",       emoji: "🧃", size: "UDL Can 375ml",  price: 9.50, happyPrice: 9.50, calories: 210, std: 1.5, color: "#4a1c00", textColor: "#f59e0b" },
  { id: "scotchudl",  name: "Scotch & Cola",    emoji: "🥃", size: "UDL Can 375ml",  price: 9.50, happyPrice: 9.50, calories: 220, std: 1.5, color: "#5c3d1e", textColor: "#f0c040" },
  { id: "scotch7oz",  name: "Scotch & Coke",    emoji: "🥃", size: "7oz Glass",      price: 8.00, happyPrice: 8.00, calories: 130, std: 1.0, color: "#2c1a00", textColor: "#c8a45a" },
];

const ADMIN_PASS_DEFAULT = "Sydneybuses1977";
const HAPPY_DAYS = [5, 6, 0];
const HAPPY_START = 16;
const HAPPY_END = 18;

function playCowbell() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const play = (freq, start, dur, vol = 0.4) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "square"; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, ctx.currentTime + start);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      o.start(ctx.currentTime + start); o.stop(ctx.currentTime + start + dur);
    };
    play(800, 0, 0.05, 0.5); play(600, 0.02, 0.08, 0.4);
    play(800, 0.12, 0.05, 0.4); play(600, 0.14, 0.08, 0.3);
    play(800, 0.28, 0.05, 0.3); play(600, 0.30, 0.06, 0.2);
  } catch {}
}

function playAirhorn() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [233, 311, 466, 554].forEach(freq => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      const dist = ctx.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) curve[i] = i < 128 ? -1 : 1;
      dist.curve = curve;
      o.connect(dist); dist.connect(g); g.connect(ctx.destination);
      o.type = "sawtooth"; o.frequency.value = freq;
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
      g.gain.setValueAtTime(0.3, ctx.currentTime + 1.5);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + 2.0);
      o.start(); o.stop(ctx.currentTime + 2.0);
    });
  } catch {}
}

function isHappyHour() {
  const now = new Date();
  return HAPPY_DAYS.includes(now.getDay()) && now.getHours() >= HAPPY_START && now.getHours() < HAPPY_END;
}
function fmtMoney(n) { return `$${Number(n).toFixed(2)}`; }
function fmtClock(t) { return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function fmtTime(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h > 0) return `${h}h ${m}m`; if (m > 0) return `${m}m ${s}s`; return `${s}s`;
}
function genCode() { return Math.random().toString(36).substring(2, 7).toUpperCase(); }

export default function App() {
  const [db, setDb] = useState(null);
  const [screen, setScreen] = useState("home");
  const [userName, setUserName] = useState(localStorage.getItem("dt_name") || "");
  const [nameInput, setNameInput] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminInput, setAdminInput] = useState("");
  const [adminError, setAdminError] = useState(false);
  const [roomData, setRoomData] = useState(null);
  const [drinks, setDrinks] = useState(DEFAULT_DRINKS);
  const [adminPass, setAdminPass] = useState(ADMIN_PASS_DEFAULT);
  const [stdWarnAt, setStdWarnAt] = useState(4);
  const [spendWarnAt, setSpendWarnAt] = useState(50);
  const [lastDrinksTime, setLastDrinksTime] = useState("22:00");
  const [tab, setTab] = useState("session");
  const [flash, setFlash] = useState(null);
  const [happyHour, setHappyHour] = useState(isHappyHour());
  const [showHappyNotif, setShowHappyNotif] = useState(false);
  const [now, setNow] = useState(new Date());
  const [spinning, setSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState(null);
  const [newMemberInput, setNewMemberInput] = useState("");
  const [adminSection, setAdminSection] = useState("prices");
  const [newPassInput, setNewPassInput] = useState("");
  const prevHappyRef = useRef(isHappyHour());

  useEffect(() => {
    try {
      const app = initializeApp(FIREBASE_CONFIG);
      setDb(getDatabase(app));
    } catch (e) { console.error("Firebase init error:", e); }
  }, []);

  useEffect(() => {
    if (!db || !roomCode) return;
    const unsub = onValue(ref(db, `rooms/${roomCode}`), snap => setRoomData(snap.val() || {}));
    return () => unsub();
  }, [db, roomCode]);

  useEffect(() => {
    const t = setInterval(() => {
      setNow(new Date());
      const happy = isHappyHour();
      if (happy && !prevHappyRef.current) setShowHappyNotif(true);
      prevHappyRef.current = happy;
      setHappyHour(happy);
    }, 10000);
    return () => clearInterval(t);
  }, []);

  const drinkLog = roomData?.drinkLog ? Object.entries(roomData.drinkLog) : [];
  const myLog = drinkLog.filter(([, e]) => e.member === userName && e.drinkId !== "LASTDRINKS");
  const myTotals = myLog.reduce((a, [, e]) => ({ spent: a.spent + e.price, cal: a.cal + e.calories, std: a.std + e.std }), { spent: 0, cal: 0, std: 0 });
  const allLog = drinkLog.filter(([, e]) => e.drinkId !== "LASTDRINKS");
  const allTotals = allLog.reduce((a, [, e]) => ({ spent: a.spent + e.price, cal: a.cal + e.calories, std: a.std + e.std }), { spent: 0, cal: 0, std: 0 });
  const shoutOrder = roomData?.shoutOrder || [];
  const currentShout = roomData?.currentShout || 0;
  const roundCount = roomData?.roundCount || 0;
  const shoutHistory = roomData?.shoutHistory ? Object.values(roomData.shoutHistory).sort((a, b) => b.time - a.time) : [];

  const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const dateStr = `${dayNames[now.getDay()]} ${now.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}`;
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  function createRoom() {
    if (!userName.trim() || !db) return;
    const code = genCode();
    setRoomCode(code);
    set(ref(db, `rooms/${code}`), {
      created: Date.now(),
      members: { [userName]: { joinedAt: Date.now(), shoutCount: 0 } },
      drinkLog: {},
      shoutOrder: [userName],
      currentShout: 0,
      roundCount: 0,
      shoutHistory: {},
    });
    setScreen("session");
  }

  function joinRoom() {
    if (!userName.trim() || !roomInput.trim() || !db) return;
    const code = roomInput.toUpperCase();
    setRoomCode(code);
    update(ref(db, `rooms/${code}/members/${userName}`), { joinedAt: Date.now(), shoutCount: 0 });
    setScreen("session");
  }

  function addDrink(drinkId) {
    const drink = drinks.find(d => d.id === drinkId);
    if (!drink || !db || !roomCode) return;
    const price = happyHour ? drink.happyPrice : drink.price;
    push(ref(db, `rooms/${roomCode}/drinkLog`), {
      drinkId, member: userName, timestamp: Date.now(),
      price, calories: drink.calories, std: drink.std, done: false,
    });
    setFlash(drinkId); setTimeout(() => setFlash(null), 400);
  }

  function markDone(entryKey) {
    if (!db || !roomCode) return;
    const entry = roomData?.drinkLog?.[entryKey];
    playCowbell();
    update(ref(db, `rooms/${roomCode}/drinkLog/${entryKey}`), { done: !entry?.done });
  }

  function nextShout() {
    if (!db || !roomCode || !roomData) return;
    const order = roomData.shoutOrder || [];
    const curr = roomData.currentShout || 0;
    const nextIdx = (curr + 1) % order.length;
    const shouter = order[curr];
    const newRound = nextIdx === 0 ? (roomData.roundCount || 0) + 1 : roomData.roundCount || 0;
    update(ref(db, `rooms/${roomCode}`), { currentShout: nextIdx, roundCount: newRound });
    update(ref(db, `rooms/${roomCode}/members/${shouter}`), { shoutCount: ((roomData.members?.[shouter]?.shoutCount) || 0) + 1 });
    set(ref(db, `rooms/${roomCode}/shoutHistory/${Date.now()}`), { name: shouter, time: Date.now() });
  }

  function spinForFirst() {
    if (!roomData?.shoutOrder?.length) return;
    setSpinning(true); setSpinResult(null);
    let count = 0;
    const order = roomData.shoutOrder;
    const interval = setInterval(() => {
      setSpinResult(order[Math.floor(Math.random() * order.length)]);
      count++;
      if (count > 20) {
        clearInterval(interval);
        const winner = order[Math.floor(Math.random() * order.length)];
        setSpinResult(winner);
        setSpinning(false);
        if (db && roomCode) update(ref(db, `rooms/${roomCode}`), { currentShout: order.indexOf(winner) });
      }
    }, 100);
  }

  function addMember() {
    if (!newMemberInput.trim() || !db || !roomCode) return;
    const name = newMemberInput.trim();
    const order = [...(roomData?.shoutOrder || []), name];
    update(ref(db, `rooms/${roomCode}/members/${name}`), { joinedAt: Date.now(), shoutCount: 0 });
    update(ref(db, `rooms/${roomCode}`), { shoutOrder: order });
    setNewMemberInput("");
  }

  function removeMember(name) {
    if (!db || !roomCode) return;
    const order = (roomData?.shoutOrder || []).filter(n => n !== name);
    remove(ref(db, `rooms/${roomCode}/members/${name}`));
    update(ref(db, `rooms/${roomCode}`), { shoutOrder: order });
  }

  function clearRoom() {
    if (!db || !roomCode) return;
    update(ref(db, `rooms/${roomCode}`), { drinkLog: {}, roundCount: 0, currentShout: 0, shoutHistory: {} });
  }

  function lastDrinks() {
    playAirhorn();
    if (db && roomCode) push(ref(db, `rooms/${roomCode}/drinkLog`), {
      drinkId: "LASTDRINKS", member: "SYSTEM", timestamp: Date.now(), price: 0, calories: 0, std: 0, done: false,
    });
  }

  function tryAdmin() {
    if (adminInput === adminPass) {
      setIsAdmin(true); setShowAdminModal(false); setAdminError(false); setAdminInput(""); setTab("admin");
    } else setAdminError(true);
  }

  if (!userName) {
    return (
      <div style={s.root}>
        <div style={s.gate}>
          <div style={{ fontSize: 72 }}>🍺</div>
          <div style={s.gateTitle}>Drink Tracker</div>
          <div style={s.gateSub}>Enter your name to get started</div>
          <input style={s.input} placeholder="Your name..." value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && nameInput.trim()) { setUserName(nameInput.trim()); localStorage.setItem("dt_name", nameInput.trim()); }}} autoFocus />
          <button style={s.btnGold} onClick={() => { if (nameInput.trim()) { setUserName(nameInput.trim()); localStorage.setItem("dt_name", nameInput.trim()); }}}>
            Let's Go 🍻
          </button>
        </div>
      </div>
    );
  }

  if (screen === "home") {
    return (
      <div style={s.root}>
        <div style={s.gate}>
          <div style={{ fontSize: 72 }}>🍺</div>
          <div style={s.gateTitle}>Drink Tracker</div>
          <div style={s.gateSub}>G'day {userName}!</div>
          <div style={s.dateBar}>{dateStr} · {timeStr}{happyHour && <span style={{ color: "#10b981", fontWeight: "bold" }}> 🍺 HAPPY HOUR!</span>}</div>
          <button style={s.btnGold} onClick={createRoom}>+ Create New Session</button>
          <div style={{ color: "#444", fontSize: 12, margin: "4px 0" }}>— or join existing —</div>
          <input style={s.input} placeholder="Enter room code..." value={roomInput}
            onChange={e => setRoomInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && joinRoom()} maxLength={5} />
          <button style={s.btnOutline} onClick={joinRoom}>Join Session</button>
          <button style={s.linkBtn} onClick={() => { setUserName(""); localStorage.removeItem("dt_name"); }}>Not {userName}? Change name</button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.root}>
      {showHappyNotif && (
        <div style={s.happyNotif}>
          🍺 HAPPY HOUR! Beer prices have dropped to $5.50!
          <button style={{ background: "transparent", border: "none", color: "#6ee7b7", cursor: "pointer", fontSize: 16 }} onClick={() => setShowHappyNotif(false)}>✕</button>
        </div>
      )}

      {showAdminModal && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={{ fontSize: 18, fontWeight: "bold", color: "#f59e0b", textAlign: "center" }}>⚙️ Admin Access</div>
            <input style={s.input} type="password" placeholder="Password..." value={adminInput}
              onChange={e => setAdminInput(e.target.value)} onKeyDown={e => e.key === "Enter" && tryAdmin()} autoFocus />
            {adminError && <div style={{ color: "#f87171", fontSize: 12, textAlign: "center" }}>Incorrect password</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button style={{ ...s.btnOutline, flex: 1 }} onClick={() => { setShowAdminModal(false); setAdminInput(""); setAdminError(false); }}>Cancel</button>
              <button style={{ ...s.btnGold, flex: 1 }} onClick={tryAdmin}>Unlock</button>
            </div>
          </div>
        </div>
      )}

      <div style={s.header}>
        <div>
          <div style={s.headerTitle}>🍺 Drink Tracker</div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
            <span style={{ color: "#f59e0b", fontWeight: "bold" }}>#{roomCode}</span>
            <span> · {userName}</span>
            {happyHour && <span style={{ color: "#10b981" }}> · 🍺 Happy Hour!</span>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 14, fontWeight: "bold", color: "#f0f0f0" }}>{timeStr}</div>
            <div style={{ fontSize: 9, color: "#555", letterSpacing: 1 }}>{dateStr}</div>
          </div>
          <button style={s.gearBtn} onClick={() => isAdmin ? setTab("admin") : setShowAdminModal(true)}>⚙️</button>
        </div>
      </div>

      <div style={s.tabBar}>
        {[["session","🍺 My Drinks"],["shout","🔔 The Shout"],["history","📋 History"]].map(([t, label]) => (
          <button key={t} style={{ ...s.tab, ...(tab === t ? s.tabOn : {}) }} onClick={() => setTab(t)}>{label}</button>
        ))}
      </div>

      {tab === "session" && (
        <div style={s.page}>
          <div style={s.statRow}>
            <Stat label="Spent" val={fmtMoney(myTotals.spent)} color="#f59e0b" />
            <Stat label="Calories" val={Math.round(myTotals.cal)} color="#ef4444" />
            <Stat label="Std Drinks" val={myTotals.std.toFixed(1)} color="#3b82f6" />
            <Stat label="My Drinks" val={myLog.length} color="#10b981" />
          </div>
          {myTotals.std >= stdWarnAt && <div style={s.warn}>⚠️ {myTotals.std.toFixed(1)} standard drinks — please be careful</div>}
          {myTotals.spent >= spendWarnAt && <div style={s.warn}>💸 You've spent {fmtMoney(myTotals.spent)} tonight</div>}
          {happyHour && <div style={s.happyBar}>🍺 Happy Hour — Beers are {fmtMoney(5.50)}!</div>}
          <div style={s.sectionLabel}>TAP TO ADD YOUR DRINK</div>
          {drinks.map(d => <DrinkBtn key={d.id} drink={d} happy={happyHour} flash={flash === d.id} onTap={() => addDrink(d.id)} />)}
          {myLog.length > 0 && (
            <>
              <div style={s.sectionLabel}>MY LOG — TAP 🔔 WHEN FINISHED</div>
              {[...myLog].reverse().map(([key, e]) => {
                const d = drinks.find(x => x.id === e.drinkId);
                return d ? <LogRow key={key} entry={e} drink={d} onBell={() => markDone(key)} /> : null;
              })}
            </>
          )}
          <button style={{ ...s.btnRed, width: "100%", marginTop: 16 }} onClick={lastDrinks}>📯 LAST DRINKS!</button>
        </div>
      )}

      {tab === "shout" && (
        <div style={s.page}>
          <div style={s.statRow}>
            <Stat label="Group $" val={fmtMoney(allTotals.spent)} color="#f59e0b" />
            <Stat label="Calories" val={Math.round(allTotals.cal)} color="#ef4444" />
            <Stat label="Rounds" val={roundCount} color="#a78bfa" />
            <Stat label="Drinks" val={allLog.length} color="#10b981" />
          </div>

          {shoutOrder.length > 0 && (
            <div style={s.shoutBanner}>
              <div>
                <div style={{ fontSize: 16, fontWeight: "bold", color: "#10b981" }}>🔔 {shoutOrder[currentShout]}'s shout!</div>
                <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>Round {roundCount + 1}</div>
              </div>
              <button style={s.nextBtn} onClick={nextShout}>Next →</button>
            </div>
          )}

          {shoutOrder.length > 1 && (
            <div style={s.spinBox}>
              <button style={s.spinBtn} onClick={spinForFirst} disabled={spinning}>
                {spinning ? `🎲 ${spinResult}...` : "🎲 Spin for First Shout!"}
              </button>
              {spinResult && !spinning && <div style={{ marginTop: 10, fontSize: 16, fontWeight: "bold", color: "#f59e0b" }}>🎉 {spinResult} goes first!</div>}
            </div>
          )}

          <div style={s.sectionLabel}>WHO'S IN THE SHOUT?</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input style={{ ...s.input, flex: 1, padding: "10px 12px", marginBottom: 0 }} placeholder="Add member..."
              value={newMemberInput} onChange={e => setNewMemberInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addMember()} />
            <button style={{ ...s.btnGold, padding: "10px 16px", width: "auto" }} onClick={addMember}>+ Add</button>
          </div>
          <div style={s.chips}>
            {shoutOrder.map((m, i) => (
              <div key={m} style={{ ...s.chip, ...(i === currentShout ? s.chipOn : {}) }}>
                {m}
                {isAdmin && <span style={{ cursor: "pointer", color: "#ef4444", marginLeft: 4, fontWeight: "bold" }} onClick={() => removeMember(m)}>×</span>}
              </div>
            ))}
          </div>

          {shoutHistory.length > 0 && (
            <>
              <div style={s.sectionLabel}>SHOUT HISTORY</div>
              <div style={{ background: "#161e2e", borderRadius: 10, border: "1px solid #1e2a3a", overflow: "hidden", marginBottom: 12 }}>
                {shoutHistory.slice(0, 10).map((h, i) => (
                  <div key={i} style={{ padding: "7px 12px", display: "flex", justifyContent: "space-between", borderBottom: "1px solid #1a2030", fontSize: 13 }}>
                    <span style={{ color: "#f59e0b" }}>{h.name}</span>
                    <span style={{ fontSize: 11, color: "#555" }}>{fmtClock(h.time)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {allLog.length > 0 && (
            <>
              <div style={s.sectionLabel}>GROUP LOG — TAP 🔔 WHEN FINISHED</div>
              {[...allLog].reverse().map(([key, e]) => {
                const d = drinks.find(x => x.id === e.drinkId);
                return d ? <LogRow key={key} entry={e} drink={d} member={e.member} onBell={() => markDone(key)} /> : null;
              })}
            </>
          )}
          <button style={{ ...s.btnRed, width: "100%", marginTop: 16 }} onClick={lastDrinks}>📯 LAST DRINKS!</button>
        </div>
      )}

      {tab === "history" && (
        <div style={s.page}>
          {drinkLog.length === 0
            ? <div style={{ textAlign: "center", color: "#444", padding: "60px 20px", fontSize: 14, lineHeight: 2 }}>No drinks logged yet this session.</div>
            : <>
                <div style={s.sectionLabel}>THIS SESSION — ALL DRINKS</div>
                {[...drinkLog].reverse().map(([key, e]) => {
                  if (e.drinkId === "LASTDRINKS") return (
                    <div key={key} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#f87171", marginBottom: 5, textAlign: "center" }}>
                      📯 LAST DRINKS called at {fmtClock(e.timestamp)}
                    </div>
                  );
                  const d = drinks.find(x => x.id === e.drinkId);
                  return d ? <LogRow key={key} entry={e} drink={d} member={e.member} showMember /> : null;
                })}
                {isAdmin && <button style={{ ...s.btnOutline, width: "100%", marginTop: 16, color: "#ef4444", borderColor: "#ef4444" }} onClick={clearRoom}>🗑 Clear Session History</button>}
              </>
          }
        </div>
      )}

      {tab === "admin" && isAdmin && (
        <div style={s.page}>
          <div style={{ fontSize: 18, fontWeight: "bold", color: "#f59e0b", marginBottom: 14 }}>⚙️ Admin Panel</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {[["prices","💰 Prices"],["happyhour","🍺 Happy Hour"],["warnings","⚠️ Warnings"],["members","👥 Members"],["password","🔒 Password"]].map(([k, label]) => (
              <button key={k} style={{ ...s.chip, ...(adminSection === k ? s.chipOn : {}), cursor: "pointer", border: "1px solid" }} onClick={() => setAdminSection(k)}>{label}</button>
            ))}
          </div>

          {adminSection === "prices" && drinks.map(d => (
            <div key={d.id} style={s.adminRow}>
              <span style={{ fontSize: 20 }}>{d.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: "bold", color: d.color }}>{d.name}</div>
                <div style={{ fontSize: 10, color: "#555" }}>{d.size}</div>
              </div>
              <div style={s.priceBox}>
                <span style={{ color: "#f59e0b", fontWeight: "bold" }}>$</span>
                <input type="number" step="0.10" min="0" value={d.price} style={s.priceInput}
                  onChange={e => setDrinks(prev => prev.map(x => x.id === d.id ? { ...x, price: parseFloat(e.target.value) || 0 } : x))} />
              </div>
            </div>
          ))}

          {adminSection === "happyhour" && (
            <>
              <div style={s.sectionLabel}>HAPPY HOUR BEER PRICES</div>
              {drinks.filter(d => ["hahn","tooheysnew","tooheyold","vb","xxxx"].includes(d.id)).map(d => (
                <div key={d.id} style={s.adminRow}>
                  <span style={{ fontSize: 20 }}>{d.emoji}</span>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: "bold", color: d.color }}>{d.name}</div></div>
                  <div style={s.priceBox}>
                    <span style={{ color: "#10b981", fontWeight: "bold" }}>$</span>
                    <input type="number" step="0.10" min="0" value={d.happyPrice} style={s.priceInput}
                      onChange={e => setDrinks(prev => prev.map(x => x.id === d.id ? { ...x, happyPrice: parseFloat(e.target.value) || 0 } : x))} />
                  </div>
                </div>
              ))}
            </>
          )}

          {adminSection === "warnings" && (
            <>
              <div style={s.sectionLabel}>STD DRINKS WARNING</div>
              <div style={s.adminRow}>
                <span style={{ flex: 1, color: "#aaa" }}>Warn after std drinks:</span>
                <input type="number" min="1" max="20" value={stdWarnAt} style={{ ...s.priceInput, width: 60, background: "#161e2e", border: "1px solid #2a3a50", borderRadius: 8, padding: "6px 10px" }}
                  onChange={e => setStdWarnAt(parseInt(e.target.value) || 4)} />
              </div>
              <div style={s.sectionLabel}>SPENDING WARNING</div>
              <div style={s.adminRow}>
                <span style={{ flex: 1, color: "#aaa" }}>Warn after spending $:</span>
                <input type="number" min="1" value={spendWarnAt} style={{ ...s.priceInput, width: 60, background: "#161e2e", border: "1px solid #2a3a50", borderRadius: 8, padding: "6px 10px" }}
                  onChange={e => setSpendWarnAt(parseInt(e.target.value) || 50)} />
              </div>
              <div style={s.sectionLabel}>LAST DRINKS</div>
              <button style={{ ...s.btnRed, width: "100%", marginTop: 4 }} onClick={lastDrinks}>📯 Trigger Last Drinks Now</button>
            </>
          )}

          {adminSection === "members" && (
            <>
              <div style={s.sectionLabel}>REMOVE MEMBERS</div>
              {shoutOrder.map(m => (
                <div key={m} style={s.adminRow}>
                  <span style={{ flex: 1, color: "#f0f0f0" }}>👤 {m}</span>
                  <button style={{ background: "transparent", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}
                    onClick={() => removeMember(m)}>Remove</button>
                </div>
              ))}
              <div style={s.sectionLabel}>SESSION</div>
              <button style={{ ...s.btnOutline, width: "100%", marginBottom: 8 }} onClick={clearRoom}>🗑 Clear All Drink History</button>
              <button style={{ ...s.btnOutline, width: "100%" }} onClick={() => { setScreen("home"); setRoomCode(""); setRoomData(null); setIsAdmin(false); }}>🚪 Leave Session</button>
            </>
          )}

          {adminSection === "password" && (
            <>
              <div style={s.sectionLabel}>CHANGE ADMIN PASSWORD</div>
              <input style={s.input} type="password" placeholder="New password..." value={newPassInput} onChange={e => setNewPassInput(e.target.value)} />
              <button style={{ ...s.btnGold, width: "100%" }} onClick={() => { if (newPassInput.trim()) { setAdminPass(newPassInput.trim()); setNewPassInput(""); alert("Password updated!"); }}}>Update Password</button>
            </>
          )}

          <button style={{ ...s.btnOutline, width: "100%", marginTop: 20, color: "#ef4444", borderColor: "#333" }}
            onClick={() => { setIsAdmin(false); setTab("session"); }}>🔒 Lock Admin</button>
        </div>
      )}

      <div style={{ padding: "8px 14px", borderTop: "1px solid #1e2a3a" }}>
        <button style={s.linkBtn} onClick={() => { setScreen("home"); setRoomCode(""); setRoomData(null); }}>← Back to Lobby</button>
      </div>
    </div>
  );
}

function DrinkBtn({ drink: d, happy, flash, onTap }) {
  const price = happy ? d.happyPrice : d.price;
  return (
    <button onClick={onTap} style={{
      width: "100%", background: `linear-gradient(135deg, ${d.color}33, ${d.color}11)`,
      border: `2px solid ${d.color}`, borderRadius: 13, padding: "12px 14px",
      cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
      marginBottom: 8, textAlign: "left",
      boxShadow: flash ? `0 0 20px ${d.color}bb` : "none",
      transform: flash ? "scale(0.97)" : "scale(1)",
      transition: "transform 0.1s, box-shadow 0.15s",
    }}>
      <span style={{ fontSize: 24, flexShrink: 0 }}>{d.emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: "bold", color: d.color }}>{d.name}</div>
        <div style={{ fontSize: 10, color: "#666" }}>{d.size} · {d.calories} cal · {d.std} std</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 16, fontWeight: "bold", color: happy && d.happyPrice < d.price ? "#10b981" : "#f0f0f0" }}>{fmtMoney(price)}</div>
        {happy && d.happyPrice < d.price && <div style={{ fontSize: 10, color: "#555", textDecoration: "line-through" }}>{fmtMoney(d.price)}</div>}
      </div>
    </button>
  );
}

function LogRow({ entry: e, drink: d, member, showMember, onBell }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#161e2e", borderRadius: 10, padding: "8px 10px", marginBottom: 5, border: "1px solid #1e2a3a", opacity: e.done ? 0.4 : 1, transition: "opacity 0.3s" }}>
      <span style={{ fontSize: 16 }}>{d.emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: d.color, textDecoration: e.done ? "line-through" : "none" }}>{d.name}</div>
        {(member || showMember) && <div style={{ fontSize: 10, color: "#555" }}>{member}</div>}
      </div>
      <span style={{ fontSize: 11, color: "#555" }}>{fmtClock(e.timestamp)}</span>
      <span style={{ fontSize: 12, color: "#aaa" }}>{fmtMoney(e.price)}</span>
      {onBell && <button onClick={onBell} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 18, padding: "0 2px" }}>{e.done ? "✅" : "🔔"}</button>}
    </div>
  );
}

function Stat({ label, val, color }) {
  return (
    <div style={{ flex: 1, background: "#161e2e", borderRadius: 10, padding: "10px 4px", textAlign: "center", border: "1px solid #1e2a3a", borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 16, fontWeight: "bold", color }}>{val}</div>
      <div style={{ fontSize: 8, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>{label}</div>
    </div>
  );
}

const s = {
  root: { minHeight: "100vh", background: "#0a0d14", color: "#f0f0f0", fontFamily: "'Georgia','Times New Roman',serif", maxWidth: 480, margin: "0 auto", paddingBottom: 20 },
  gate: { display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 24px", gap: 14, minHeight: "100vh", justifyContent: "center" },
  gateTitle: { fontSize: 30, fontWeight: "bold", color: "#f59e0b", letterSpacing: 2 },
  gateSub: { fontSize: 16, color: "#888" },
  dateBar: { fontSize: 12, color: "#555", marginBottom: 4 },
  input: { width: "100%", boxSizing: "border-box", background: "#161e2e", border: "2px solid #2a3a50", borderRadius: 12, padding: "14px 16px", color: "#f0f0f0", fontSize: 16, fontFamily: "inherit", outline: "none", marginBottom: 4 },
  btnGold: { width: "100%", background: "linear-gradient(135deg,#f59e0b,#d97706)", border: "none", borderRadius: 12, padding: "15px", fontSize: 16, fontWeight: "bold", cursor: "pointer", fontFamily: "inherit", color: "#000" },
  btnOutline: { width: "100%", background: "transparent", border: "1px solid #2a3a50", borderRadius: 12, padding: "13px", fontSize: 14, cursor: "pointer", fontFamily: "inherit", color: "#aaa" },
  btnRed: { background: "linear-gradient(135deg,#7f1d1d,#991b1b)", border: "2px solid #ef4444", borderRadius: 12, padding: "16px", fontSize: 16, fontWeight: "bold", cursor: "pointer", fontFamily: "inherit", color: "#fca5a5", letterSpacing: 1 },
  linkBtn: { background: "transparent", border: "none", color: "#555", fontSize: 12, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" },
  happyNotif: { background: "linear-gradient(135deg,#064e3b,#065f46)", border: "1px solid #10b981", padding: "12px 16px", fontSize: 13, color: "#6ee7b7", display: "flex", justifyContent: "space-between", alignItems: "center" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 24 },
  modal: { background: "#161e2e", borderRadius: 16, padding: 24, width: "100%", maxWidth: 340, border: "1px solid #2a3a50", display: "flex", flexDirection: "column", gap: 10 },
  header: { background: "linear-gradient(135deg,#1a2235,#0a0d14)", borderBottom: "2px solid #f59e0b", padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontSize: 16, fontWeight: "bold", color: "#f59e0b", letterSpacing: 1 },
  gearBtn: { background: "transparent", border: "1px solid #333", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 16, marginLeft: 6 },
  tabBar: { display: "flex", borderBottom: "1px solid #1e2a3a" },
  tab: { flex: 1, background: "transparent", border: "none", borderBottom: "3px solid transparent", color: "#555", padding: "12px 4px", cursor: "pointer", fontSize: 11, fontFamily: "inherit", transition: "all 0.2s" },
  tabOn: { color: "#f59e0b", borderBottomColor: "#f59e0b" },
  page: { padding: "14px 12px" },
  sectionLabel: { fontSize: 9, letterSpacing: 3, color: "#444", textTransform: "uppercase", marginBottom: 8, marginTop: 10 },
  statRow: { display: "flex", gap: 6, marginBottom: 12 },
  warn: { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "9px 12px", fontSize: 12, color: "#f87171", marginBottom: 10, textAlign: "center" },
  happyBar: { background: "linear-gradient(135deg,#064e3b,#065f46)", border: "1px solid #10b981", borderRadius: 10, padding: "9px 14px", fontSize: 13, color: "#6ee7b7", marginBottom: 10, textAlign: "center", fontWeight: "bold" },
  shoutBanner: { background: "linear-gradient(135deg,#1e3a2a,#162a1e)", border: "1px solid #10b981", borderRadius: 14, padding: "14px 16px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" },
  nextBtn: { background: "#10b981", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontWeight: "bold", fontFamily: "inherit", color: "#000", fontSize: 13 },
  spinBox: { background: "#161e2e", border: "1px solid #2a3a50", borderRadius: 12, padding: "12px 14px", marginBottom: 12, textAlign: "center" },
  spinBtn: { background: "linear-gradient(135deg,#4c1d95,#5b21b6)", border: "none", borderRadius: 10, padding: "11px 20px", cursor: "pointer", color: "#ddd6fe", fontWeight: "bold", fontFamily: "inherit", fontSize: 14 },
  chips: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  chip: { background: "#1e2a3a", border: "1px solid #2a3a50", borderRadius: 20, padding: "5px 12px", fontSize: 13, display: "flex", alignItems: "center", color: "#aaa", gap: 4 },
  chipOn: { borderColor: "#f59e0b", color: "#f59e0b", background: "rgba(245,158,11,0.1)" },
  adminRow: { display: "flex", alignItems: "center", gap: 10, background: "#161e2e", borderRadius: 12, padding: "11px 12px", marginBottom: 8, border: "1px solid #1e2a3a" },
  priceBox: { display: "flex", alignItems: "center", background: "#0a0d14", border: "1px solid #2a3a50", borderRadius: 8, padding: "5px 8px" },
  priceInput: { background: "transparent", border: "none", color: "#f0f0f0", fontSize: 15, fontWeight: "bold", fontFamily: "inherit", width: 55, outline: "none" },
};
