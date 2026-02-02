import React, { useEffect, useMemo, useState } from "react";

// ============================
// VERSION + CHANGELOG
// ============================
// I will update this section every time I change this file.
// You can also copy it into a separate CHANGELOG.md if you prefer.
const APP_VERSION = "0.13.0";
const CHANGELOG = [
  {
    version: "0.13.0",
    date: "2026-02-01",
    changes: [
      "Minor changes to Rules and Intro",
    ],
  },
  {
    version: "0.12.0",
    date: "2026-02-01",
    changes: [
      "Added Total money raised section (filled squares × $5) with $500 goal progress on Intro and Board pages.",
    ],
  },
  {
    version: "0.11.3",
    date: "2026-02-01",
    changes: [
      "Rules page now renders a structured doc-style layout (title, section headings, indented examples) matching the uploaded Word document.",
      "Default rules converted to structured blocks while keeping backward compatibility with older Firestore docs.",
    ],
  },
  {
    version: "0.11.2",
    date: "2026-02-01",
    changes: [
      "Updated Rules page content to the new Official Rules text (multiline, formatted).",
      "Rules page now renders multiline rules text with preserved line breaks.",
    ],
  },
  {
    version: "0.11.1",
    date: "2026-02-01",
    changes: [
      "Fix crash in Intro page when introBody is an array with heading objects (render it safely).",
      "Intro now supports either a single string (with line breaks) or a structured array of paragraphs/headings.",
    ],
  },
  {
    version: "0.6.0",
    date: "2026-02-01",
    changes: [
      "Admin edits now save only when clicking Save changes (draft + discard).",
      "Firestore-safe grid storage using an object map (no nested arrays).",
      "Fix: winner cell lookup uses grid map keys (r{row}c{col}).",
    ],
  },
  {
    version: "0.7.0",
    date: "2026-02-01",
    changes: [
      "Change grid layout",
    ],
  },
 {
  version: "0.8.0",
  date: "2026-02-01",
  changes: [
    "Manual winner reveal added: Q1/Half/Q3/Final highlights and winner names stay hidden until an admin reveals them (then clicks Save changes).",
  ],
 },
 {
  version: "0.9.0",
  date: "2026-02-01",
  changes: [
    "Fixed Bug: Fix: Board page no longer crashes when winners are hidden; last-digit line now only renders after a quarter is revealed.",
  ],
 },

 {
  version: "0.10.0",
  date: "2026-02-01",
  changes: [
    "Removed grid numbers until randomized",
  ],
 },
 {
  version: "0.11.0",
  date: "2026-02-01",
  changes: [
    "Changed intro, header and rules",
  ],
 },

];


/**
 * Super Bowl Squares Fundraiser – Secure (Firebase Auth + Firestore)
 *
 * ✅ Public: Intro / Board / Rules
 * ✅ Admin tab is HIDDEN unless signed-in user email is allow-listed
 * ✅ Live sync for everyone via Firestore
 * ✅ Real security must be enforced via Firestore Rules (admin-only writes)
 *
 * Vite env required (project root .env.local):
 *  VITE_FIREBASE_API_KEY=...
 *  VITE_FIREBASE_AUTH_DOMAIN=...
 *  VITE_FIREBASE_PROJECT_ID=...
 *  VITE_FIREBASE_APP_ID=...
 */

import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

// ----------------------------
// Safe env access (Vite)
// ----------------------------
const ENV = import.meta.env || {};

const REQUIRED_ENV_KEYS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
];

const missingEnvKeys = REQUIRED_ENV_KEYS.filter((k) => !ENV[k]);

// ----------------------------
// Firebase init (guarded)
// ----------------------------
let auth = null;
let db = null;

if (missingEnvKeys.length === 0) {
  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        apiKey: ENV.VITE_FIREBASE_API_KEY,
        authDomain: ENV.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: ENV.VITE_FIREBASE_PROJECT_ID,
        appId: ENV.VITE_FIREBASE_APP_ID,
        storageBucket: ENV.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: ENV.VITE_FIREBASE_MESSAGING_SENDER_ID,
      });
  auth = getAuth(app);
  db = getFirestore(app);
}

// ----------------------------
// Config
// ----------------------------
const FUNDRAISER_DOC_PATH = { collection: "fundraisers", id: "default" };

// 3 admins (Google emails)
const ADMIN_EMAILS = [
  "spiyer@gmail.com",
  "sandhya.vsv@gmail.com",
  "shriyaiyer23@gmail.com",
].map((e) => e.toLowerCase());

const range10 = [...Array(10)].map((_, i) => i);

const DONATION_PER_SQUARE = 5;
const FUNDRAISING_GOAL = 500;

// ----------------------------
// Tiny UI primitives (Tailwind)
// ----------------------------
function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function Card({ className = "", children }) {
  return (
    <div className={cx("rounded-2xl border bg-white shadow-sm", className)}>
      {children}
    </div>
  );
}

function CardHeader({ children }) {
  return <div className="p-4 border-b">{children}</div>;
}

function CardTitle({ children }) {
  return <div className="font-semibold">{children}</div>;
}

function CardContent({ children }) {
  return <div className="p-4">{children}</div>;
}

function Button({ variant = "primary", className = "", ...props }) {
  const base =
    "rounded-xl px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2";
  const styles = {
    primary: "bg-black text-white hover:bg-black/90 focus:ring-black",
    outline: "border bg-white text-gray-900 hover:bg-gray-50 focus:ring-gray-400",
    ghost: "bg-transparent text-gray-900 hover:bg-gray-100 focus:ring-gray-400",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-600",
  };
  return (
    <button
      {...props}
      className={cx(base, styles[variant] || styles.primary, className)}
    />
  );
}

function Input({ className = "", ...props }) {
  return (
    <input
      {...props}
      className={cx(
        "w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20",
        className
      )}
    />
  );
}

function Badge({ children, tone = "neutral" }) {
  const styles = {
    neutral: "bg-gray-100 text-gray-900",
    outline: "border bg-white text-gray-900",
    ok: "bg-emerald-100 text-emerald-900",
    warn: "bg-amber-100 text-amber-900",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs",
        styles[tone] || styles.neutral
      )}
    >
      {children}
    </span>
  );
}

function Tabs({ value, onChange, tabs }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((t) => {
        const active = value === t.value;
        return (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className={cx(
              "rounded-xl border px-3 py-2 text-sm font-medium transition",
              active
                ? "bg-black text-white border-black"
                : "bg-white text-gray-900 hover:bg-gray-50"
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ----------------------------
// Data model
// ----------------------------
function defaultState() {
  // Firestore does NOT allow nested arrays.
  // We store the grid as an object map instead of a 2D array.
  // Key format: "r{row}c{col}" → { name }
  const grid = {};
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      grid[`r${r}c${c}`] = { name: "" };
    }
  }
  return {
    meta: {
      title: "Super Bowl Squares",
      subtitle: "Game day fun for a great cause",
      introHeadline: "Super Bowl Squares to Support the Westford Food Pantry",
      introBody: [
  "Hi! My name is Shriya, and I’m raising money to help the Westford Food Pantry. My goal is to raise $500.",
  "I’m doing a Super Bowl Squares fundraiser because it’s fun and it helps people at the same time!",
  { heading: "How it works" },
  "You can donate to pick a Super Bowl square. While you watch the game, you might win a prize—and your donation helps families in Westford.",
  { heading: "Why I’m doing this" },
  "My parents taught me that helping others is important. This is my first time doing a fundraiser, and I’m doing it to learn how I can help people in our community.",
  "All the money raised will go to the Westford Food Pantry.",
  "Thank you for helping me help others. Every donation makes a difference!",
],
    },
    teams: { top: "New England Patriots", left: "Seattle Seahawks" },
    numbers: { top: range10, left: range10, randomized: false },
    rules: {
      title: "Super Bowl Fundraising - Official Rules",
      blocks: [
        { type: "p", text: "- Each $5.00 donation earns one square on the Super Bowl grid." },
        { type: "p", text: "- Squares are assigned on a first-come, first-served basis." },
        { type: "h", text: "Number Assignment" },
        { type: "p", text: "- Row and column numbers (0–9) will be assigned randomly once the grid is completely filled." },
        { type: "p", text: "- If the grid is not fully populated, row and column numbers will be assigned randomly one (1) hour before kickoff." },
        { type: "h", text: "How Winners Are Determined" },
        { type: "p", text: "- Winners for each quarter are determined by the last digit of each team’s score at the end of the quarter." },
        { type: "p", text: "- The numbers on the row(left to right) represent the Pats and the numbers in the column(top to bottom) represent the Seahawks" },
        { type: "indent", text: "Example: If the score is 21–14 at the end of Q1, Pats being 21 and Seahawks being 14." },
        { type: "indent2", text: "The winning square for Q1 is found at row with the number “1” and at column with the nunber “4.”" },
        { type: "p", text: "- There will be one winner per quarter." },
        { type: "p", text: "- Each quarter winner will receive a $20 Amazon gift card." },
        { type: "h", text: "Overtime" },
        { type: "p", text: "- Overtime scores do not count." },
        { type: "p", text: "- Only the scores at the end of Q1, Q2, Q3, and Q4 are eligible." },
        { type: "h", text: "If the Grid Is Not Fully Filled" },
        { type: "p", text: "- If the grid is not completely filled and no winner is determined for a quarter, a winner will be selected as follows:" },
        { type: "indent", text: "- At the end of the 4th quarter, a winner will be chosen randomly from the list of donors who have not already won." },
        { type: "indent", text: "- For every quarter without a winner, one different donor who has not already won will be chosen at random." },
        { type: "indent2", text: "Example: If 2 quarters have no winner, 2 different donors will be selected randomly." }
      ],
      // Backward-compat fields (older docs may still have these)
      bullets: [],
      notes: "",
    },
    grid,
    scoreboard: {
      teamA: { q1: 0, halftime: 0, q3: 0, final: 0 },
      teamB: { q1: 0, halftime: 0, q3: 0, final: 0 },
    },
    reveals: { q1: false, halftime: false, q3: false, final: false },
    ui: { lockedBoard: false },
    updatedAt: new Date().toISOString(),
  };
}

function clampDigit(v) {
  const n = Number(String(v).replace(/[^0-9]/g, "").slice(0, 1) || 0);
  return Math.max(0, Math.min(9, n));
}

function computeWinners(numbers, scoreboard) {
  const checkpoints = ["q1", "halftime", "q3", "final"];
  const winners = {};
  for (const key of checkpoints) {
    const a = clampDigit(scoreboard.teamA[key]);
    const b = clampDigit(scoreboard.teamB[key]);
    const colIndex = numbers.top.indexOf(a);
    const rowIndex = numbers.left.indexOf(b);
    winners[key] = {
      teamA_last: a,
      teamB_last: b,
      rowIndex,
      colIndex,
      valid: rowIndex >= 0 && colIndex >= 0,
    };
  }
  return winners;
}

// ----------------------------
// Firestore helpers
// ----------------------------
function fundraiserDocRef() {
  return doc(db, FUNDRAISER_DOC_PATH.collection, FUNDRAISER_DOC_PATH.id);
}

async function writeFundraiserState(nextState) {
  await setDoc(
    fundraiserDocRef(),
    {
      ...nextState,
      updatedAt: new Date().toISOString(),
      updatedAtServer: serverTimestamp(),
    },
    { merge: true }
  );
}

// ----------------------------
// Pages
// ----------------------------
function FirebaseSetupHelp() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-xl w-full">
        <CardHeader>
          <CardTitle>Firebase not configured</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-700">
          <div>Missing environment variables:</div>
          <ul className="list-disc pl-5">
            {missingEnvKeys.map((k) => (
              <li key={k} className="font-mono">
                {k}
              </li>
            ))}
          </ul>
          <div>
            Create <span className="font-mono">.env.local</span> next to
            <span className="font-mono"> package.json</span> and restart
            <span className="font-mono"> npm run dev</span>.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function IntroPage({ state }) {
  const body = state?.meta?.introBody;

  const renderBody = () => {
    // Option A: introBody is a simple string (supports line breaks)
    if (typeof body === "string") {
      return <div className="whitespace-pre-line">{body}</div>;
    }

    // Option B: introBody is a structured array (strings + { heading })
    if (Array.isArray(body)) {
      return (
        <div className="space-y-3">
          {body.map((item, idx) => {
            if (typeof item === "string") {
              return <p key={idx}>{item}</p>;
            }
            if (item && typeof item === "object" && typeof item.heading === "string") {
              return (
                <div key={idx} className="font-semibold pt-1">
                  {item.heading}
                </div>
              );
            }
            // Unknown item type: ignore rather than crash
            return null;
          })}
        </div>
      );
    }

    // Fallback
    return null;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{state.meta.introHeadline}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-700">
          {renderBody()}
          <div className="text-xs text-gray-500">
            Tip: refresh the Board page to see live updates.
          </div>
        </CardContent>
      </Card>

      <FundraisingProgress state={state} />
    </div>
  );
}

function RulesPage({ state }) {
  const title = state.rules?.title || "Official Rules";
  const blocks = Array.isArray(state.rules?.blocks) ? state.rules.blocks : null;

  const renderBlock = (b, idx) => {
    const type = b?.type || "p";
    const txt = b?.text || "";

    if (type === "h") {
      return (
        <div key={idx} className="mt-4 font-semibold text-gray-900">
          {txt}
        </div>
      );
    }

    const indentClass =
      type === "indent2" ? "pl-10" : type === "indent" ? "pl-6" : "";

    return (
      <div key={idx} className={cx("text-sm text-gray-700 whitespace-pre-line", indentClass)}>
        {txt}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {blocks ? (
            <div className="space-y-2">{blocks.map(renderBlock)}</div>
          ) : (
            <>
              <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
                {(state.rules?.bullets || []).map((b, idx) => (
                  <li key={idx}>{b}</li>
                ))}
              </ul>
              {state.rules?.notes ? (
                <div className="text-sm text-gray-700 whitespace-pre-line">{state.rules.notes}</div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ScoreInputs({ state, onUpdate, disabled }) {
  const sb = state.scoreboard;
  const setDigit = (team, key, v) => {
    const digit = clampDigit(v);
    onUpdate({
      scoreboard: {
        ...state.scoreboard,
        [team]: { ...state.scoreboard[team], [key]: digit },
      },
    });
  };

  const box = (teamKey, title) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className={cx("grid grid-cols-4 gap-3", disabled ? "opacity-60" : "")}>
        {[
          ["q1", "Q1"],
          ["halftime", "Half"],
          ["q3", "Q3"],
          ["final", "Final"],
        ].map(([k, label]) => (
          <div key={k} className="space-y-1">
            <div className="text-xs text-gray-600">{label}</div>
            <Input
              disabled={disabled}
              value={sb[teamKey][k]}
              onChange={(e) => setDigit(teamKey, k, e.target.value)}
              inputMode="numeric"
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {box("teamA", `${state.teams.top} last digit`)}
      {box("teamB", `${state.teams.left} last digit`)}
    </div>
  );
}

function BoardPage({ state }) {
  const winners = useMemo(
    () => computeWinners(state.numbers, state.scoreboard),
    [state.numbers, state.scoreboard]
  );

  const cellIsWinner = (r, c) => {
    for (const k of ["q1", "halftime", "q3", "final"]) {
      if (!state.reveals?.[k]) continue; 
      const w = winners[k];
      if (w?.valid && w.rowIndex === r && w.colIndex === c) return k;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">{state.meta.title}</div>
          <div className="text-sm text-gray-600">{state.meta.subtitle}</div>
          <div className="text-xs text-gray-500 mt-1">
            Last updated: {new Date(state.updatedAt).toLocaleString()}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {state.ui.lockedBoard ? (
            <Badge>Locked</Badge>
          ) : (
            <Badge tone="outline">Open</Badge>
          )}
        </div>
      </div>

      <FundraisingProgress state={state} />


      <Card className="overflow-hidden">
        <CardContent>
          <div className="w-full overflow-auto">
            <table className="min-w-[980px] border-collapse border-4 border-black bg-white">
              <thead>
                {/* Row 1: top team name */}
                <tr>
                  <th className="border-2 border-black w-10" />
                  <th className="border-2 border-black w-10" />
                  <th colSpan={10} className="border-2 border-black text-center font-semibold py-2">
                    {state.teams.top}
                  </th>
                </tr>

                {/* Row 2: top digits */}
                <tr>
                  <th className="border-2 border-black w-10" />
                  <th className="border-2 border-black w-10" />
                  {state.numbers.top.map((d, idx) => (
                    <th 
                      key={idx} 
                      className="border-2 border-black text-center font-semibold w-20 py-1"
                    >
                      {state.numbers.randomized ? d : `X${idx}`}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {range10.map((r) => (
                  <tr key={r}>
                    {/* Left team name, vertical, spans all 10 rows */}
                    {r === 0 ? (
                      <th rowSpan={10} className="border-2 border-black w-10 text-center font-semibold">
                        <div className="[writing-mode:vertical-rl] rotate-180 mx-auto">
                          {state.teams.left}
                        </div>
                      </th>
                    ) : null}

                    {/* Row digit */}
                    <th className="border-2 border-black text-center font-semibold w-10">
                      {state.numbers.randomized ? state.numbers.left[r] : `Y${r}`}
                    </th>

                    {/* 10 squares */}
                    {range10.map((c) => {
                      const cell = state.grid[`r${r}c${c}`];
                      const winKey = cellIsWinner(r, c);
                      const isWin = Boolean(winKey);

                      return (
                        <td
                          key={c}
                          className={cx("border-2 border-black align-top p-2 h-12", isWin ? "bg-gray-100" : "")}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-medium truncate max-w-[220px]">
                              {cell?.name || ""}
                            </div>

                            {isWin ? (
                              <span className="text-[11px] font-semibold border border-black rounded-full px-2 py-0.5">
                                {winKey === "halftime" ? "Half" : winKey.toUpperCase()}
                              </span>
                           ) : null}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current winners</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {[
            ["q1", "Q1"],
            ["halftime", "Halftime"],
            ["q3", "Q3"],
            ["final", "Final"],
          ].map(([k, label]) => {
            const revealed = Boolean(state.reveals?.[k]);
            const w = revealed ? winners[k] : null;
            const cell = revealed && w?.valid ? state.grid[`r${w.rowIndex}c${w.colIndex}`] : null;
            return (
              <div key={k} className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{label}</div>
                  {revealed ? (
                    <div className="text-xs text-gray-600">
                      Last digits: {state.teams.left} {w.teamB_last} / {state.teams.top} {w.teamA_last}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500">
                      Will be revealed at end of {label}.
                    </div>
                  )}
                </div>
                <div className="font-semibold truncate max-w-[260px]">
                  {revealed ? (cell?.name || "—") : "Hidden (not revealed yet)"}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function deepClone(obj) {
  // structuredClone is supported in modern browsers; fallback is fine for this simple JSON state.
  if (typeof structuredClone === "function") return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

function shallowEqualJSON(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function countFilledSquares(grid) {
  if (!grid) return 0;
  let n = 0;
  for (const k of Object.keys(grid)) {
    const name = (grid[k]?.name || "").trim();
    if (name.length > 0) n += 1;
  }
  return n;
}

function formatMoneyUSD(amount) {
  return `$${Math.round(amount)}`;
}

function FundraisingProgress({ state }) {
  const filled = countFilledSquares(state.grid);
  const total = filled * DONATION_PER_SQUARE;
  const goal = FUNDRAISING_GOAL;
  const pct = goal > 0 ? Math.min(100, Math.round((total / goal) * 100)) : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Total money raised</CardTitle>
          <Badge tone={pct >= 100 ? "ok" : "outline"}>Goal: {formatMoneyUSD(goal)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-3xl font-bold">{formatMoneyUSD(total)}</div>
            <div className="text-xs text-gray-600">
              {filled} squares filled × {formatMoneyUSD(DONATION_PER_SQUARE)} per square
            </div>
          </div>
          <div className="text-sm font-semibold">{pct}%</div>
        </div>

        <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden border">
          <div className="h-full bg-black" style={{ width: `${pct}%` }} />
        </div>

        <div className="text-xs text-gray-600">
          {pct >= 100 ? "Goal reached — thank you!" : `${formatMoneyUSD(goal - total)} to go to reach the goal.`}
        </div>
      </CardContent>
    </Card>
  );
}

function AdminPage({ state, onAdminUpdate, isAdmin }) {
  const [draft, setDraft] = useState(() => deepClone(state));

  // When the Firestore-backed state changes (or admin opens page), refresh draft
  useEffect(() => {
    setDraft(deepClone(state));
  }, [state]);

  const locked = draft.ui.lockedBoard;
  const dirty = useMemo(() => !shallowEqualJSON(draft, state), [draft, state]);

  const updateDraft = (patch) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const updateDraftDeep = (pathSetter) => {
    setDraft((prev) => {
      const next = deepClone(prev);
      pathSetter(next);
      return next;
    });
  };

  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const randomizeNumbers = () => {
    updateDraft({
      numbers: {
        ...draft.numbers,
        top: shuffle(range10),
        left: shuffle(range10),
        randomized: true,
      },
    });
  };

  const setCellNameLocal = (r, c, name) => {
    const key = `r${r}c${c}`;
    updateDraftDeep((next) => {
      next.grid[key] = { name };
    });
  };

  const saveNow = async () => {
    if (!isAdmin) return;
    await onAdminUpdate(draft, true);
  };

  const discard = () => {
    setDraft(deepClone(state));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Admin controls</CardTitle>
            <div className="flex items-center gap-2">
              {dirty ? <Badge tone="warn">Unsaved changes</Badge> : <Badge tone="ok">Saved</Badge>}
              <Button variant="outline" onClick={discard} disabled={!dirty}>
                Discard
              </Button>
              <Button onClick={saveNow} disabled={!dirty || !isAdmin}>
                Save changes
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <div className="text-sm font-medium">Title</div>
              <Input
                value={draft.meta.title}
                onChange={(e) => updateDraft({ meta: { ...draft.meta, title: e.target.value } })}
              />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium">Subtitle</div>
              <Input
                value={draft.meta.subtitle}
                onChange={(e) =>
                  updateDraft({ meta: { ...draft.meta, subtitle: e.target.value } })
                }
              />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium">Top team name</div>
              <Input
                value={draft.teams.top}
                onChange={(e) => updateDraft({ teams: { ...draft.teams, top: e.target.value } })}
              />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium">Left team name</div>
              <Input
                value={draft.teams.left}
                onChange={(e) =>
                  updateDraft({ teams: { ...draft.teams, left: e.target.value } })
                }
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={randomizeNumbers} disabled={!isAdmin}>
              Randomize header numbers
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                updateDraft({ ui: { ...draft.ui, lockedBoard: !draft.ui.lockedBoard } })
              }
              disabled={!isAdmin}
            >
              {locked ? "Unlock board edits" : "Lock board edits"}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                const ok = window.confirm(
                  "Reset the entire board to defaults? This overwrites Firestore."
                );
                if (!ok) return;
                const fresh = defaultState();
                await onAdminUpdate(fresh, true);
              }}
              disabled={!isAdmin}
            >
              Reset board
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reveal winners (manual)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {[
            ["q1", "Q1"],
            ["halftime", "Halftime"],
            ["q3", "Q3"],
            ["final", "Final"],
          ].map(([k, label]) => (
            <label key={k} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(draft.reveals?.[k])}
                onChange={(e) =>
                  updateDraft({
                    reveals: { ...(draft.reveals || {}), [k]: e.target.checked },
                  })
                }
                disabled={!isAdmin}
             />
             <span>Reveal {label} winner</span>
           </label>
         ))}

         <div className="text-xs text-gray-500">
           Winners on the Board stay hidden until you reveal them, then click{" "}
           <span className="font-medium">Save changes</span>.
         </div>
       </CardContent>
     </Card>

      <ScoreInputs
        state={draft}
        onUpdate={(patch) => updateDraft(patch)}
        disabled={!isAdmin}
      />

      <Card>
        <CardHeader>
          <CardTitle>Edit squares</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-auto">
            <table className="min-w-[980px] border-collapse border-4 border-black bg-white">
              <thead>
                <tr>
                  <th className="border-2 border-black w-10" />
                  <th className="border-2 border-black w-10" />
                  <th colSpan={10} className="border-2 border-black text-center font-semibold py-2">
                    {draft.teams.top}
                  </th>
                </tr>

                <tr>
                  <th className="border-2 border-black w-10" />
                  <th className="border-2 border-black w-10" />
                  {draft.numbers.top.map((d, idx) => (
                    <th 
                      key={idx} 
                      className="border-2 border-black text-center font-semibold w-20 py-1"
                    >
                      {draft.numbers.randomized ? d : `X${idx}`}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {range10.map((r) => (
                  <tr key={r}>
                    {r === 0 ? (
                      <th rowSpan={10} className="border-2 border-black w-10 text-center font-semibold">
                        <div className="[writing-mode:vertical-rl] rotate-180 mx-auto">
                          {draft.teams.left}
                        </div>
                      </th>
                    ) : null}

                    <th className="border-2 border-black text-center font-semibold w-10">
                      {draft.numbers.randomized ? draft.numbers.left[r] : `Y${r}`}
                    </th>

                    {range10.map((c) => (
                      <td key={c} className="border-2 border-black p-1 h-12">
                        <Input
                          disabled={!isAdmin || locked}
                          value={draft.grid[`r${r}c${c}`]?.name || ""}
                          onChange={(e) => setCellNameLocal(r, c, e.target.value)}
                          placeholder=""
                          className="h-10"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {locked ? (
            <div className="mt-3 text-xs text-gray-600">
              Board is locked. Unlock to edit.
            </div>
          ) : null}
          <div className="mt-3 text-xs text-gray-600">
            Tip: Names and scores are saved only when you click <span className="font-medium">Save changes</span>.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ----------------------------
// Main
// ----------------------------
export default function SuperBowlSquaresFundraiser() {
  // If Firebase is not configured, show instructions instead of crashing
  if (!auth || !db) {
    return <FirebaseSetupHelp />;
  }

  const [tab, setTab] = useState("intro");
  const [state, setState] = useState(null);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      const email = (u?.email || "").toLowerCase();
      setIsAdmin(Boolean(email) && ADMIN_EMAILS.includes(email));
    });
  }, []);

  useEffect(() => {
    return onSnapshot(
      fundraiserDocRef(),
      (snap) => {
        if (!snap.exists()) {
          setState(defaultState());
          setLoading(false);
          return;
        }
        const data = snap.data();
        // Merge with defaults so old docs don't break new fields
        const d = defaultState();
        const merged = {
          ...d,
          ...data,
          meta: { ...d.meta, ...(data?.meta || {}) },
          teams: { ...d.teams, ...(data?.teams || {}) },
          numbers: { ...d.numbers, ...(data?.numbers || {}) },
          rules: { ...d.rules, ...(data?.rules || {}) },
          scoreboard: { ...d.scoreboard, ...(data?.scoreboard || {}) },
          reveals: { ...d.reveals, ...(data?.reveals || {}) },
          ui: { ...d.ui, ...(data?.ui || {}) },
        };
        setState(merged);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
    );
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signOutNow = async () => {
    await signOut(auth);
    setTab("intro");
  };

  // Admin-only update: optimistic UI + write to Firestore
  const onAdminUpdate = async (patchOrFullState, isFullReplace = false) => {
    if (!isAdmin) return;
    const next = isFullReplace ? patchOrFullState : { ...state, ...patchOrFullState };
    setState(next);
    try {
      await writeFundraiserState(next);
    } catch (e) {
      console.error(e);
      alert(`Save failed: ${e?.message || e}`);
    }
  };

  const tabs = [
    { value: "intro", label: "Intro" },
    { value: "board", label: "Board" },
    { value: "rules", label: "Rules" },
    ...(isAdmin ? [{ value: "admin", label: "Admin" }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl p-4 md:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">Super Bowl Fundraising</div>
              <Badge tone="outline">v{APP_VERSION}</Badge>
            </div>
            <div className="text-sm text-gray-600">
              Signed in: {user?.email || "public"}{" "}
              {isAdmin ? <Badge tone="ok">Admin</Badge> : <Badge tone="outline">Public</Badge>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!user ? (
              <Button variant="outline" onClick={signIn}>
                Sign in (Admin)
              </Button>
            ) : (
              <Button variant="outline" onClick={signOutNow}>
                Sign out
              </Button>
            )}
          </div>
        </div>

        <Tabs value={tab} onChange={setTab} tabs={tabs} />

        {loading || !state ? (
          <Card>
            <CardContent>
              <div className="text-sm text-gray-600">Loading board…</div>
            </CardContent>
          </Card>
        ) : null}

        {!loading && state ? (
          <>
            {tab === "intro" ? <IntroPage state={state} /> : null}
            {tab === "board" ? <BoardPage state={state} /> : null}
            {tab === "rules" ? <RulesPage state={state} /> : null}
            {tab === "admin" && isAdmin ? (
              <AdminPage state={state} onAdminUpdate={onAdminUpdate} isAdmin={isAdmin} />
            ) : null}
          </>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>One-time setup reminder</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-700 space-y-2">
            <div>
              If you can sign in but edits fail, your Firestore Rules may be blocking writes (that’s good!).
            </div>
            <div>
              You must allow public reads and admin-only writes in Firestore Rules.
            </div>
          </CardContent>
        </Card>

        <div className="text-xs text-gray-500">
          Version {APP_VERSION} • Last change: {CHANGELOG[0]?.date}
        </div>
      </div>
    </div>
  );
}
