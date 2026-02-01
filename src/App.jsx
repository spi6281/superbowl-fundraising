import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Super Bowl Squares Fundraiser – Plain React + Tailwind (no shadcn/ui)
 *
 * Public pages: Intro, Board, Rules
 * Admin page: edit square names + update score last-digits (Q1/Half/Q3/Final)
 * No donation tracking.
 *
 * Storage: localStorage + Export/Import JSON.
 */

const LS_KEY = "sb_squares_fundraiser_plain_v1";
const range10 = [...Array(10)].map((_, i) => i);

// ----------------------------
// Tiny UI primitives (Tailwind)
// ----------------------------

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function Card({ className = "", children }) {
  return <div className={cx("rounded-2xl border bg-white shadow-sm", className)}>{children}</div>;
}

function CardHeader({ className = "", children }) {
  return <div className={cx("p-4 md:p-5 border-b", className)}>{children}</div>;
}

function CardTitle({ className = "", children }) {
  return <div className={cx("text-base font-semibold", className)}>{children}</div>;
}

function CardContent({ className = "", children }) {
  return <div className={cx("p-4 md:p-5", className)}>{children}</div>;
}

function Button({ className = "", variant = "primary", as = "button", ...props }) {
  const base = "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2";
  const styles = {
    primary: "bg-black text-white hover:bg-black/90 focus:ring-black",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-400",
    outline: "border bg-white text-gray-900 hover:bg-gray-50 focus:ring-gray-400",
    ghost: "bg-transparent text-gray-900 hover:bg-gray-100 focus:ring-gray-400",
  };
  const Comp = as;
  return <Comp className={cx(base, styles[variant] || styles.primary, className)} {...props} />;
}

function Input({ className = "", ...props }) {
  return (
    <input
      className={cx(
        "w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20",
        className
      )}
      {...props}
    />
  );
}

function Label({ className = "", children }) {
  return <label className={cx("text-sm font-medium", className)}>{children}</label>;
}

function Switch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cx(
        "relative inline-flex h-6 w-11 items-center rounded-full border transition",
        disabled ? "opacity-60" : "",
        checked ? "bg-black" : "bg-gray-200"
      )}
      aria-pressed={checked}
    >
      <span
        className={cx(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
          checked ? "translate-x-5" : "translate-x-1"
        )}
      />
    </button>
  );
}

function Separator() {
  return <div className="h-px w-full bg-gray-200" />;
}

function Badge({ children, variant = "secondary" }) {
  const styles = {
    secondary: "bg-gray-100 text-gray-900",
    outline: "border bg-white text-gray-900",
  };
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs", styles[variant])}>{children}</span>;
}

function ToastHost() {
  // simple toast system
  const [toasts, setToasts] = useState([]);
  const addToastRef = useRef(null);

  useEffect(() => {
    addToastRef.current = (t) => {
      const id = Math.random().toString(16).slice(2);
      setToasts((s) => [...s, { id, ...t }]);
      setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), 2200);
    };
    window.__SB_TOAST__ = (title, description) => addToastRef.current?.({ title, description });
    return () => {
      delete window.__SB_TOAST__;
    };
  }, []);

  return (
    <div className="fixed right-4 top-4 z-50 space-y-2">
      {toasts.map((t) => (
        <div key={t.id} className="w-[320px] rounded-2xl border bg-white p-3 shadow-lg">
          <div className="text-sm font-semibold">{t.title}</div>
          {t.description ? <div className="text-xs text-gray-600 mt-0.5">{t.description}</div> : null}
        </div>
      ))}
    </div>
  );
}

function toast(title, opts = {}) {
  if (typeof window !== "undefined" && window.__SB_TOAST__) {
    window.__SB_TOAST__(title, opts.description || "");
  }
}

function Tabs({ value, onValueChange, children }) {
  // children expect TabsList + TabsContent(s)
  return <div>{React.Children.map(children, (c) => React.cloneElement(c, { value, onValueChange }))}</div>;
}

function TabsList({ value, onValueChange, children, className = "" }) {
  return <div className={cx("grid gap-2", className)}>{React.Children.map(children, (c) => React.cloneElement(c, { value, onValueChange }))}</div>;
}

function TabsTrigger({ value: current, onValueChange, tabValue, children, className = "" }) {
  const active = current === tabValue;
  return (
    <button
      type="button"
      onClick={() => onValueChange(tabValue)}
      className={cx(
        "rounded-xl px-3 py-2 text-sm font-medium border transition",
        active ? "bg-black text-white border-black" : "bg-white text-gray-900 hover:bg-gray-50",
        className
      )}
    >
      {children}
    </button>
  );
}

function TabsContent({ value: current, tabValue, children, className = "" }) {
  if (current !== tabValue) return null;
  return <div className={className}>{children}</div>;
}

function Dialog({ open, onOpenChange, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/40" onClick={() => onOpenChange(false)} />
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2">
        <div className="rounded-2xl border bg-white shadow-xl">
          <div className="flex items-center justify-between gap-3 border-b p-4">
            <div className="font-semibold text-sm">{title}</div>
            <Button variant="ghost" onClick={() => onOpenChange(false)} aria-label="Close">✕</Button>
          </div>
          <div className="p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------
// App state
// ----------------------------

function defaultState() {
  const grid = range10.map(() => range10.map(() => ({ name: "" })));

  return {
    meta: {
      title: "Super Bowl Squares – Westford Food Pantry Fundraiser",
      subtitle: "Game day fun for a great cause 💙",
      introHeadline: "Super Bowl Squares to Support the Westford Food Pantry",
      introBody:
        "Hi! This fundraiser is run by our daughter to support the Westford Food Pantry. Thank you for helping families in our community.",
    },
    teams: { top: "Team A", left: "Team B" },
    numbers: { top: range10, left: range10, randomized: false },
    rules: {
      bullets: [
        "Each square is one entry.",
        "Numbers across the top and side will be randomized AFTER all squares are filled.",
        "Winners are determined by the LAST digit of each team’s score at Q1, Halftime, Q3, and Final.",
        "We will contact winners after the game.",
      ],
      notes: "All proceeds go to the Westford Food Pantry. Thank you for supporting our community!",
    },
    grid,
    scoreboard: {
      teamA: { q1: 0, halftime: 0, q3: 0, final: 0 },
      teamB: { q1: 0, halftime: 0, q3: 0, final: 0 },
    },
    payouts: { q1: "", halftime: "", q3: "", final: "" },
    admin: { enabled: false, passcode: "" },
    ui: { lockedBoard: false },
    updatedAt: new Date().toISOString(),
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      ...defaultState(),
      ...parsed,
      meta: { ...defaultState().meta, ...(parsed?.meta || {}) },
      teams: { ...defaultState().teams, ...(parsed?.teams || {}) },
      numbers: { ...defaultState().numbers, ...(parsed?.numbers || {}) },
      rules: { ...defaultState().rules, ...(parsed?.rules || {}) },
      scoreboard: { ...defaultState().scoreboard, ...(parsed?.scoreboard || {}) },
      payouts: { ...defaultState().payouts, ...(parsed?.payouts || {}) },
      admin: { ...defaultState().admin, ...(parsed?.admin || {}) },
      ui: { ...defaultState().ui, ...(parsed?.ui || {}) },
    };
  } catch {
    return defaultState();
  }
}

function saveState(s) {
  localStorage.setItem(LS_KEY, JSON.stringify({ ...s, updatedAt: new Date().toISOString() }));
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
    winners[key] = { teamA_last: a, teamB_last: b, rowIndex, colIndex, valid: rowIndex >= 0 && colIndex >= 0 };
  }
  return winners;
}

// ----------------------------
// Features
// ----------------------------

function ExportImport({ state, setState }) {
  const exportJson = () => {
    const payload = JSON.stringify(state, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "super-bowl-squares.json";
    a.click();
    URL.revokeObjectURL(url);
    toast("Exported!", { description: "Downloaded super-bowl-squares.json" });
  };

  const importJson = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(String(e.target?.result || ""));
        const merged = {
          ...defaultState(),
          ...parsed,
          meta: { ...defaultState().meta, ...(parsed?.meta || {}) },
          teams: { ...defaultState().teams, ...(parsed?.teams || {}) },
          numbers: { ...defaultState().numbers, ...(parsed?.numbers || {}) },
          rules: { ...defaultState().rules, ...(parsed?.rules || {}) },
          scoreboard: { ...defaultState().scoreboard, ...(parsed?.scoreboard || {}) },
          payouts: { ...defaultState().payouts, ...(parsed?.payouts || {}) },
          admin: { ...defaultState().admin, ...(parsed?.admin || {}) },
          ui: { ...defaultState().ui, ...(parsed?.ui || {}) },
        };
        setState(merged);
        toast("Imported!", { description: "Board updated from JSON" });
      } catch {
        toast("Import failed", { description: "That file wasn't valid JSON." });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" onClick={exportJson}>Export</Button>

      <label className="inline-flex">
        <input
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importJson(f);
            e.currentTarget.value = "";
          }}
        />
        <Button variant="secondary" as="span">Import</Button>
      </label>

      <Button
        variant="ghost"
        onClick={() => {
          localStorage.removeItem(LS_KEY);
          setState(defaultState());
          toast("Reset", { description: "Board reset to defaults" });
        }}
      >
        Reset
      </Button>
    </div>
  );
}

function ScoreInputs({ state, setState, disabled }) {
  const sb = state.scoreboard;
  const setDigit = (team, key, v) => {
    const digit = clampDigit(v);
    setState((s) => ({
      ...s,
      scoreboard: { ...s.scoreboard, [team]: { ...s.scoreboard[team], [key]: digit } },
    }));
  };

  const box = (teamKey, title) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-4 gap-3">
        {([
          ["q1", "Q1"],
          ["halftime", "Half"],
          ["q3", "Q3"],
          ["final", "Final"],
        ]).map(([k, label]) => (
          <div key={k} className="space-y-1">
            <Label className="text-xs text-gray-600">{label}</Label>
            <Input disabled={disabled} value={sb[teamKey][k]} onChange={(e) => setDigit(teamKey, k, e.target.value)} inputMode="numeric" />
          </div>
        ))}
      </CardContent>
    </Card>
  );

  return (
    <div className={cx("grid gap-4 md:grid-cols-2", disabled ? "opacity-60" : "")}> 
      {box("teamA", `${state.teams.top} last digit`)}
      {box("teamB", `${state.teams.left} last digit`)}
    </div>
  );
}

function PayoutInputs({ state, setState, disabled }) {
  const setPayout = (key, v) => setState((s) => ({ ...s, payouts: { ...s.payouts, [key]: v } }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Prizes (optional)</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {([
          ["q1", "Q1"],
          ["halftime", "Halftime"],
          ["q3", "Q3"],
          ["final", "Final"],
        ]).map(([k, label]) => (
          <div key={k} className="space-y-1">
            <Label className="text-xs text-gray-600">{label}</Label>
            <Input disabled={disabled} placeholder="$" value={state.payouts[k]} onChange={(e) => setPayout(k, e.target.value)} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RulesPage({ state }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="list-disc pl-5 space-y-2 text-sm">
            {state.rules.bullets.map((b, idx) => (
              <li key={idx}>{b}</li>
            ))}
          </ul>
          {state.rules.notes ? <div className="text-sm text-gray-600">{state.rules.notes}</div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How winners are picked</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600 space-y-2">
          <div>Example: If the score is 17–24 at the end of the quarter, the last digits are 7 and 4.</div>
          <div>Find 7 across the top (Team A) and 4 down the side (Team B). That square wins.</div>
        </CardContent>
      </Card>
    </div>
  );
}

function IntroPage({ state }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{state.meta.introHeadline}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-gray-600">{state.meta.introBody}</div>
          <Separator />
          <div className="text-sm">
            <div className="font-medium">What you can do here</div>
            <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600 mt-2">
              <li>Check the board to see which squares are taken.</li>
              <li>See the current winning squares as score digits are updated.</li>
              <li>Read the rules so you know how winners work.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SquaresGrid({ state, setState, mode }) {
  const isAdmin = mode === "admin";
  const locked = state.ui.lockedBoard && isAdmin;
  const winners = useMemo(() => computeWinners(state.numbers, state.scoreboard), [state.numbers, state.scoreboard]);

  const [dialog, setDialog] = useState({ open: false, r: 0, c: 0 });

  const cellIsWinner = (r, c) => {
    for (const k of ["q1", "halftime", "q3", "final"]) {
      const w = winners[k];
      if (w?.valid && w.rowIndex === r && w.colIndex === c) return k;
    }
    return null;
  };

  const updateCell = (r, c, patch) => {
    setState((s) => {
      const next = structuredClone(s);
      next.grid[r][c] = { ...next.grid[r][c], ...patch };
      return next;
    });
  };

  const openEdit = (r, c) => setDialog({ open: true, r, c });
  const closeEdit = () => setDialog((d) => ({ ...d, open: false }));

  const activeCell = dialog.open ? state.grid[dialog.r][dialog.c] : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">{state.meta.title}</div>
          <div className="text-sm text-gray-600">{state.meta.subtitle}</div>
          <div className="mt-1 text-xs text-gray-500">Last updated: {new Date(state.updatedAt).toLocaleString()}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {state.ui.lockedBoard ? <Badge>Locked</Badge> : <Badge variant="outline">Editable</Badge>}
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="w-full overflow-auto">
            <table className="min-w-[900px] border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-20 bg-white border p-2 text-xs text-gray-600">{state.teams.left} \ {state.teams.top}</th>
                  {state.numbers.top.map((d, idx) => (
                    <th key={idx} className="sticky top-0 z-10 bg-white border p-2 text-center text-sm font-semibold">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {range10.map((r) => (
                  <tr key={r}>
                    <th className="sticky left-0 z-10 bg-white border p-2 text-center text-sm font-semibold">{state.numbers.left[r]}</th>
                    {range10.map((c) => {
                      const cell = state.grid[r][c];
                      const winKey = cellIsWinner(r, c);
                      const isWin = Boolean(winKey);
                      return (
                        <td key={c} className={cx("border align-top", isWin ? "bg-gray-100" : "")}>
                          <button
                            className={cx(
                              "w-full h-[72px] p-2 text-left text-sm transition",
                              isAdmin ? "hover:bg-gray-50" : "cursor-default"
                            )}
                            disabled={!isAdmin}
                            onClick={() => openEdit(r, c)}
                            title={isAdmin ? "Click to edit" : ""}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-medium truncate">{cell.name || ""}</div>
                              </div>
                              {isWin ? <Badge>{winKey === "halftime" ? "Half" : winKey.toUpperCase()}</Badge> : null}
                            </div>
                          </button>
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Winners (auto)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {([
              ["q1", "Q1"],
              ["halftime", "Halftime"],
              ["q3", "Q3"],
              ["final", "Final"],
            ]).map(([k, label]) => {
              const w = winners[k];
              const cell = w?.valid ? state.grid[w.rowIndex][w.colIndex] : null;
              const payout = state.payouts[k];
              return (
                <div key={k} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{label}</div>
                    <div className="text-xs text-gray-600">Last digits: {state.teams.left} {w.teamB_last} / {state.teams.top} {w.teamA_last}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold truncate max-w-[240px]">{cell?.name || "—"}</div>
                    <div className="text-xs text-gray-600">
                      {cell ? `Square ${state.numbers.left[w.rowIndex]}–${state.numbers.top[w.colIndex]}` : "—"}
                      {payout ? ` • Prize ${payout}` : ""}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 space-y-2">
            <div>• Names only on the board (no donation info shown).</div>
            <div>• Admin can update score digits as the game progresses.</div>
            <div>• Use Export/Import to move this board to another device.</div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={dialog.open}
        onOpenChange={(v) => (v ? null : closeEdit())}
        title={dialog.open ? `Square ${state.numbers.left[dialog.r]} – ${state.numbers.top[dialog.c]}` : ""}
      >
        {dialog.open && activeCell ? (
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label>Name</Label>
              <Input
                disabled={locked}
                value={activeCell.name}
                onChange={(e) => updateCell(dialog.r, dialog.c, { name: e.target.value })}
                placeholder="Name"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                disabled={locked}
                onClick={() => {
                  updateCell(dialog.r, dialog.c, { name: "" });
                  toast("Cleared", { description: "Square cleared" });
                }}
              >
                Clear
              </Button>
              <Button
                onClick={() => {
                  toast("Saved", { description: "Changes are saved automatically" });
                  closeEdit();
                }}
              >
                Done
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

function AdminGate({ state, setAuthed, children }) {
  const [code, setCode] = useState("");

  if (!state.admin.enabled) return children;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin access</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-gray-600">Enter the passcode to edit the board.</div>
        <div className="flex items-center gap-2">
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Passcode" type="password" className="max-w-xs" />
          <Button
            onClick={() => {
              if (code === state.admin.passcode) {
                setAuthed(true);
                toast("Welcome", { description: "Admin mode enabled" });
              } else {
                toast("Nope", { description: "Wrong passcode" });
              }
            }}
          >
            Unlock
          </Button>
        </div>
        <div className="text-xs text-gray-600">Note: This is a simple client-side gate (convenience only, not strong security).</div>
      </CardContent>
    </Card>
  );
}

// ----------------------------
// Main component
// ----------------------------

export default function SuperBowlSquaresFundraiser() {
  const [state, setState] = useState(() => (typeof window === "undefined" ? defaultState() : loadState()));
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState("intro");

  useEffect(() => {
    saveState(state);
  }, [state]);

  const randomizeNumbers = () => {
    const shuffleArr = (arr) => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    setState((s) => ({
      ...s,
      numbers: { ...s.numbers, top: shuffleArr(range10), left: shuffleArr(range10), randomized: true },
    }));
    toast("Randomized", { description: "Header numbers shuffled" });
  };

  const isAdminMode = authed || !state.admin.enabled;

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastHost />
      <div className="mx-auto max-w-6xl p-4 md:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-2xl md:text-3xl font-bold tracking-tight">Super Bowl Squares</div>
            <div className="text-sm text-gray-600">Intro + Rules + Live Board (names only) + Admin updates</div>
          </div>
          <ExportImport state={state} setState={setState} />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2 gap-2 md:grid-cols-4 md:w-[680px]">
            <TabsTrigger tabValue="intro">Intro</TabsTrigger>
            <TabsTrigger tabValue="board">Board</TabsTrigger>
            <TabsTrigger tabValue="rules">Rules</TabsTrigger>
            <TabsTrigger tabValue="admin">Admin</TabsTrigger>
          </TabsList>

          <TabsContent tabValue="intro" className="mt-4 space-y-4">
            <IntroPage state={state} />
          </TabsContent>

          <TabsContent tabValue="board" className="mt-4 space-y-4">
            <SquaresGrid state={state} setState={setState} mode="board" />
          </TabsContent>

          <TabsContent tabValue="rules" className="mt-4 space-y-4">
            <RulesPage state={state} />
          </TabsContent>

          <TabsContent tabValue="admin" className="mt-4 space-y-4">
            <AdminGate state={state} setAuthed={setAuthed}>
              <div className="grid gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Title</Label>
                      <Input value={state.meta.title} onChange={(e) => setState((s) => ({ ...s, meta: { ...s.meta, title: e.target.value } }))} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Subtitle</Label>
                      <Input value={state.meta.subtitle} onChange={(e) => setState((s) => ({ ...s, meta: { ...s.meta, subtitle: e.target.value } }))} />
                    </div>

                    <div className="grid gap-2 md:col-span-2">
                      <Label>Intro headline</Label>
                      <Input value={state.meta.introHeadline} onChange={(e) => setState((s) => ({ ...s, meta: { ...s.meta, introHeadline: e.target.value } }))} />
                    </div>
                    <div className="grid gap-2 md:col-span-2">
                      <Label>Intro text</Label>
                      <Input value={state.meta.introBody} onChange={(e) => setState((s) => ({ ...s, meta: { ...s.meta, introBody: e.target.value } }))} />
                    </div>

                    <div className="grid gap-2">
                      <Label>Top team name</Label>
                      <Input value={state.teams.top} onChange={(e) => setState((s) => ({ ...s, teams: { ...s.teams, top: e.target.value } }))} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Left team name</Label>
                      <Input value={state.teams.left} onChange={(e) => setState((s) => ({ ...s, teams: { ...s.teams, left: e.target.value } }))} />
                    </div>

                    <div className="flex items-center justify-between md:col-span-2">
                      <div className="grid gap-0.5">
                        <Label>Lock board edits</Label>
                        <div className="text-xs text-gray-600">Prevents changes to squares unless you unlock</div>
                      </div>
                      <Switch checked={state.ui.lockedBoard} onChange={(v) => setState((s) => ({ ...s, ui: { ...s.ui, lockedBoard: v } }))} />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between md:col-span-2">
                      <div className="grid gap-0.5">
                        <Label>Enable admin passcode gate</Label>
                        <div className="text-xs text-gray-600">Convenience only (not strong security)</div>
                      </div>
                      <Switch
                        checked={state.admin.enabled}
                        onChange={(v) => {
                          setAuthed(!v);
                          setState((s) => ({ ...s, admin: { ...s.admin, enabled: v } }));
                        }}
                      />
                    </div>

                    {state.admin.enabled ? (
                      <div className="grid gap-2 md:col-span-2">
                        <Label>Admin passcode</Label>
                        <Input
                          value={state.admin.passcode}
                          onChange={(e) => setState((s) => ({ ...s, admin: { ...s.admin, passcode: e.target.value } }))}
                          placeholder="Set a passcode"
                          type="password"
                        />
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2 md:col-span-2">
                      <Button variant="secondary" onClick={randomizeNumbers}>Randomize header numbers</Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setState((s) => ({ ...s, numbers: { ...s.numbers, top: range10, left: range10, randomized: false } }));
                          toast("Reset", { description: "Header numbers set to 0–9" });
                        }}
                      >
                        Reset numbers
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <ScoreInputs state={state} setState={setState} disabled={!isAdminMode} />
                <PayoutInputs state={state} setState={setState} disabled={!isAdminMode} />

                <SquaresGrid state={state} setState={setState} mode="admin" />
              </div>
            </AdminGate>
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle>GitHub Pages tip</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 space-y-2">
            <div>This file is now plain React + Tailwind, so it works great with a Vite build on GitHub Pages.</div>
            <div>Next step: create a Vite React app, paste this component into <span className="font-mono">src/App.jsx</span>, then deploy.</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
