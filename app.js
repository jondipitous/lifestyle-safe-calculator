
"use strict";

// Lifestyle Upgrade Protection V33.9
// Part 1 of 3 — Settings and calculations

const defaults = {
  mode: "upgrader",
  sale: 950000,
  hdb: 180000,
  refund: 310000,
  oa: 25000,
  pureCash: 103000,
  pureCPF: 668000,
  joint: true,
  name1: "Buyer 1",
  age1: 34,
  wage1: 8000,
  status1: "SC",
  name2: "Buyer 2",
  age2: 43,
  wage2: 6500,
  status2: "SC",
  backup: 0,
  topup: 0,
  topupOn: false,
  commit: 1000,
  protection: false,
  choice: "protect",
  debts: 0,
  rate: 3
};

let v = { ...defaults };
let step = 3;

const STORAGE = "lifestyle-upgrade-v339";

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE));
  if (saved && typeof saved === "object") {
    v = { ...defaults, ...saved };
  }
} catch (_) {}

const $ = id => document.getElementById(id);

const esc = value => String(value ?? "").replace(
  /[&<>"']/g,
  ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[ch]
);

const fmt = n => {
  if (!Number.isFinite(n)) return "—";
  return (n < -0.5 ? "−" : "") + "$" +
    Math.round(Math.abs(n)).toLocaleString("en-SG");
};

const row = (label, amount) =>
  `<div class="row"><span>${label}</span>` +
  `<span class="money">${amount}</span></div>`;

const grid = html =>
  `<div class="grid2">${html}</div>`;

const note = text =>
  `<p class="small">${text}</p>`;

function save() {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(v));
  } catch (_) {}
}

function field(key, label, type = "money") {
  const value = type === "money"
    ? "$" + v[key] : String(v[key]);

  return `<div class="field">
    <label>${esc(label)}</label>
    <input data-key="${key}"
      type="${type === "number" ? "number" : "text"}"
      value="${esc(value)}">
  </div>`;
}

function segment(key, options) {
  return `<div class="segment">${
    options.map(([value, label]) =>
      `<button type="button" data-set="${key}"
        data-val="${value}"
        class="${v[key] === value ? "active" : ""}">
        ${esc(label)}</button>`
    ).join("")
  }</div>`;
}

function pills(key, options) {
  return `<div class="pills">${
    options.map(([value, label]) =>
      `<button type="button" data-set="${key}"
        data-val="${value}"
        class="${v[key] === value ? "active" : ""}">
        ${esc(label)}</button>`
    ).join("")
  }</div>`;
}

function calculate() {
  const selling = v.sale * 0.0218 + 2800;
  const net = v.sale - v.hdb - selling;
  const refunded = Math.min(
    Math.max(0, net), v.refund
  );

  const rawCash = v.mode === "upgrader"
    ? net - refunded : v.pureCash;

  const rawCPF = v.mode === "upgrader"
    ? refunded + v.oa : v.pureCPF;

  const equity = Math.floor(
    Math.max(0, rawCash + rawCPF) / 1000
  ) * 1000;

  const cpf = Math.min(Math.max(0, rawCPF), equity);
  const cash = equity - cpf;
  const topup = v.topupOn ? v.topup : 0;

  const income = v.wage1 +
    (v.joint ? v.wage2 : 0);

  const age = income > 0
    ? (v.age1 * v.wage1 +
      (v.joint ? v.age2 * v.wage2 : 0)) / income
    : 0;

  const tenure = income > 0
    ? Math.max(0, Math.min(30, Math.floor(65 - age)))
    : 0;

  const factor = rate => {
    const months = tenure * 12;
    const r = rate / 1200;

    if (months <= 0 || rate > 100) return Infinity;

    return r === 0
      ? 1 / months
      : r / (1 - Math.pow(1 + r, -months));
  };

  const actual = factor(v.rate);
  const stress = factor(4);

  const rawCap = (income * 0.55 - v.debts) / stress;

  const bankCap = Number.isFinite(rawCap)
    ? Math.max(0, Math.floor(rawCap / 1000) * 1000)
    : 0;

  // Simplified illustrative ABSD assumption.
  const mixed = v.joint && v.status1 !== v.status2;
  const absdRate = !mixed &&
    (v.status1 === "PR" ||
    (v.joint && v.status2 === "PR")) ? 0.05 : 0;

  const oaRate = a =>
    a <= 35 ? 0.23 :
    a <= 45 ? 0.21 :
    a <= 50 ? 0.19 :
    a <= 55 ? 0.15 :
    a <= 60 ? 0.12 :
    a <= 65 ? 0.035 :
    a <= 70 ? 0.01 : 0;

  const b1 = Array.from({ length: 10 }, (_, y) =>
    Math.min(8000, v.wage1) * oaRate(v.age1 + y)
  );

  const b2 = Array.from({ length: 10 }, (_, y) =>
    v.joint
      ? Math.min(8000, v.wage2) * oaRate(v.age2 + y)
      : 0
  );

  const combined = b1.map((x, i) => x + b2[i]);

  const forecast = Array.from(
    { length: 48 },
    (_, i) => combined[Math.floor(i / 12)]
  );

  const bsd = price => {
    let remaining = price;
    let total = 0;

    for (const [limit, rate] of [
      [180000, 0.01],
      [180000, 0.02],
      [640000, 0.03],
      [500000, 0.04],
      [1500000, 0.05],
      [Infinity, 0.06]
    ]) {
      const amount = Math.min(
        Math.max(0, remaining), limit
      );
      total += amount * rate;
      remaining -= amount;
      if (remaining <= 0) break;
    }

    return total;
  };

  const benchP = bankCap / 0.75;
  const benchDown = 0.25 * benchP;
  const benchCashDown = 0.05 * benchP;
  const benchFlexibleDown = 0.20 * benchP;
  const benchDuty = bsd(benchP);
  const benchLegal = bankCap ? 3000 : 0;
  const benchABSD = benchP * absdRate;

  const benchUp = benchDown + benchDuty +
    benchLegal + benchABSD;

  const benchCPFUsed = Math.max(
    0, Math.min(cpf, benchUp - benchCashDown)
  );

  const benchCash = cash - (benchUp - benchCPFUsed);
  const benchCPF = cpf - benchCPFUsed;

  const benchFunded =
    bankCap > 0 &&
    benchCash >= -0.001 &&
    benchCPF >= -0.001 &&
    equity >= benchUp - 0.001;

  function payments(loan, commit, protect) {
    const monthly = loan * actual;
    let carry = 0;
    let shortfall = 0;
    let paid = 0;
    let rawShield = 0;
    const years = [];

    for (let y = 0; y < 4; y++) {
      let cpfPaid = 0;
      let cashPaid = 0;
      let shieldPaid = 0;

      for (let m = 0; m < 12; m++) {
        const available =
          carry + forecast[y * 12 + m];

        const used = Math.min(monthly, available);
        const gap = Math.max(0, monthly - used);

        const fromCash = protect
          ? Math.min(commit, gap) : gap;

        const fromShield = protect
          ? gap - fromCash : 0;

        carry = Math.max(0, available - used);

        cpfPaid += used;
        cashPaid += fromCash;
        shieldPaid += fromShield;

        shortfall += gap;
        paid += fromCash;
        rawShield += fromShield;
      }

      years.push({
        cpf: cpfPaid / 12,
        cash: cashPaid / 12,
        shield: shieldPaid / 12
      });
    }

    const shield = protect
      ? Math.ceil(
          Math.max(0, rawShield - 0.0000001) / 1000
        ) * 1000
      : 0;

    return {
      monthly, shortfall, paid,
      rawShield, shield, years
    };
  }

  function evaluate(
    price, loan, additional,
    commit, useBackup, protect
  ) {
    const spend = cash + additional -
      (useBackup ? v.backup : 0);

    if (
      price <= 0 ||
      tenure <= 0 ||
      spend < 0 ||
      !Number.isFinite(actual) ||
      (v.mode === "upgrader" && net < 0) ||
      loan < 0 ||
      loan > Math.min(bankCap, 0.75 * price) + 0.001
    ) return null;

    const duty = bsd(price);
    const legal = 3000;
    const ab = price * absdRate;
    const fees = duty + legal + ab;
    const down = price - loan;
    const upfront = down + fees;

    const pm = payments(loan, commit, protect);

    const cpfFee = Math.min(cpf, fees);
    const cashFee = fees - cpfFee;

    const cpfShield = Math.min(
      Math.max(0, cpf - cpfFee), pm.shield
    );

    const cashShield = pm.shield - cpfShield;
    const cpfAvail = cpf - cpfFee - cpfShield;
    const cashAvail = spend - cashFee - cashShield;

    const cashDP = Math.max(
      0.05 * price, down - cpfAvail
    );
    const cpfDP = down - cashDP;

    const available = spend + cpf - pm.shield;

    if (
      available + 0.000001 < upfront ||
      cashAvail + 0.000001 < cashDP ||
      cpfDP < -0.000001 ||
      cpfDP > cpfAvail + 0.000001
    ) return null;

    return {
      p: price, loan, down,
      duty, legal, ab, fees,
      upfront, available, cashDP, cpfDP,
      cpfFee, cashFee,
      ltv: 100 * loan / price,
      cpfShield, cashShield,
      remainingCash: spend - cashShield,
      remainingCPF: cpf - cpfShield,
      ...pm
    };
  }

  function at(
    price, additional, commit,
    useBackup, protect, alternatives
  ) {
    const high = Math.min(
      bankCap, 0.75 * price
    );

    const direct = evaluate(
      price, high, additional,
      commit, useBackup, protect
    );

    if (direct || !alternatives || !protect) {
      return direct;
    }

    for (
      let deduction = 5000;
      deduction <= Math.min(high, 300000);
      deduction += 5000
    ) {
      const result = evaluate(
        price, high - deduction,
        additional, commit, useBackup, protect
      );

      if (result) return result;
    }

    return null;
  }

  function solve(
    additional, commit, useBackup,
    protect, alternatives
  ) {
    if (
      bankCap <= 0 ||
      tenure <= 0 ||
      (v.mode === "upgrader" && net < 0)
    ) return null;

    let low = 1;
    let high = 4500;
    let best = null;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);

      const result = at(
        mid * 1000, additional,
        commit, useBackup, protect, alternatives
      );

      if (result) {
        best = result;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return best;
  }

  const A = solve(
    0, 0, false, false, false
  );

  const base = solve(
    topup, v.commit, true, v.protection, true
  );

  let B = base;
  let smart = null;

  if (base) {
    const spare = Math.max(
      0,
      cpf - base.cpfFee -
      base.cpfShield - base.cpfDP
    );

    const trigger = spare >= 1000 && base.loan > 0;
    const reduction = trigger
      ? Math.min(spare, base.loan) : 0;

    if (
      trigger &&
      v.choice === "reduce" &&
      reduction > 0
    ) {
      const loan = base.loan - reduction;
      const pm = payments(loan, 0, false);

      B = {
        ...base,
        loan,
        down: base.down + reduction,
        upfront: base.upfront + reduction,
        ltv: 100 * loan / base.p,
        cpfDP: base.cpfDP + reduction,
        cpfShield: 0,
        cashShield: 0,
        remainingCash: cash + topup - v.backup,
        remainingCPF: cpf,
        available: cash + topup - v.backup + cpf,
        ...pm
      };
    }

    smart = {
      trigger,
      spare,
      reduction,
      originalMonthly: base.monthly
    };
  }

  const reduceActive = !!(
    smart &&
    smart.trigger &&
    v.choice === "reduce"
  );

  const aDiff = A ? equity - A.upfront : 0;

  const aDisplayUpfront =
    A && aDiff >= 0 && aDiff <= 1000
      ? equity
      : A ? A.upfront : 0;

  const bDiff =
    B ? B.available - B.upfront : 0;

  const bDisplayUpfront =
    B && !reduceActive &&
    bDiff >= 0 && bDiff <= 1000
      ? B.available
      : B ? B.upfront : 0;

  return {
    selling, net, cash, cpf, equity, topup,
    income, age, tenure, bankCap,
    b1, b2, combined,
    benchP, benchDown, benchCashDown,
    benchFlexibleDown, benchDuty, benchLegal,
    benchABSD, benchUp, benchCash, benchCPF,
    benchFunded, A, B, smart, reduceActive,
    aDisplayUpfront, bDisplayUpfront
  };
}

/* ---------------------------------------
   PART 2 — CALCULATOR LAYOUTS
---------------------------------------- */

/* STEP 1 — AVAILABLE FUNDS */

function funds(R) {
  const modes = segment("mode", [
    ["upgrader", "HDB Upgrader"],
    ["purchaser", "Pure Purchaser"]
  ]);

  const inputs = v.mode === "upgrader"
    ? grid(
      field("sale", "HDB Selling Price") +
      field("hdb", "Outstanding HDB Loan") +
      field("refund", "CPF Refund + Interest") +
      field("oa", "Existing CPF OA")
    )
    : grid(
      field("pureCash", "Available Cash") +
      field("pureCPF", "Available CPF OA")
    );

  const selling = v.mode === "upgrader"
    ? `<div class="panel section">
        ${row("Agent Commission (2%)",
          fmt(v.sale * 0.02))}
        ${row("GST on Commission (9%)",
          fmt(v.sale * 0.0018))}
        ${row("Selling Legal Fees", "$2,800")}
        <hr>
        ${row("<b>Selling Expenses</b>",
          fmt(R.selling))}
        ${row("<b>Net Sale Proceeds</b>",
          fmt(R.net))}
      </div>`
    : "";

  return `
    <h2>Step 1 · Available Purchase Funds</h2>
    <div class="section">
      ${modes}
      ${inputs}
      ${selling}

      ${grid(`
        <div class="panel stat">
          <div class="statlabel">Available Cash</div>
          <div class="med money">${fmt(R.cash)}</div>
        </div>

        <div class="panel stat">
          <div class="statlabel">Available CPF OA</div>
          <div class="med money">${fmt(R.cpf)}</div>
        </div>
      `)}

      ${row(
        "<b>Available Purchase Funds</b>",
        `<b>${fmt(R.equity)}</b>`
      )}

      ${note(
        "Purchase funds rounded down to the nearest $1,000."
      )}
    </div>`;
}

/* STEP 2 — BUYER DETAILS */

function buyer(n) {
  const name = "name" + n;
  const age = "age" + n;
  const wage = "wage" + n;
  const status = "status" + n;

  return `
    <div class="buyer-group section">
      <div class="field">
        <label>Buyer ${n} · Name</label>

        <input type="text"
          data-key="${name}"
          value="${esc(v[name])}"
          placeholder="Enter Buyer ${n} name">
      </div>

      <div class="buyer-grid">
        ${field(age, "Age", "number")}
        ${field(wage, "Income ($/mo)")}

        <div class="field">
          <label class="center">SC / PR</label>
          ${segment(status, [
            ["SC", "SC"],
            ["PR", "PR"]
          ])}
        </div>
      </div>
    </div>`;
}

/* Individual CPF OA charts */

function individualBars(data, name, age, color) {
  const max = Math.max(1, ...data);

  return `
    <div class="section cpf-chart">
      <div class="chart-heading">
        <b>
          <i class="dot"
            style="background:${color}"></i>
          ${esc(name)}
        </b>

        <b>${fmt(data[0])}/mo</b>
      </div>

      ${data.map((amount, i) => `
        <div class="chart-row">
          <span class="chart-age">
            Age ${age + i}
          </span>

          <div class="bar pill-bar">
            <div style="
              width:${100 * amount / max}%;
              background:${color};
              border-radius:999px">
            </div>
          </div>

          <span class="chart-value">
            ${fmt(amount)}
          </span>
        </div>
      `).join("")}
    </div>`;
}

/* Combined CPF OA stacked chart */

function combinedBars(R) {
  const max = Math.max(
    1, ...R.combined
  );

  const name1 =
    v.name1.trim() || "Buyer 1";
  const name2 =
    v.name2.trim() || "Buyer 2";

  return `
    <div class="panel section">
      <div class="chart-heading">
        <b>Combined CPF OA</b>
        <b>${fmt(R.combined[0])}/mo</b>
      </div>

      ${R.combined.map((amount, i) => `
        <div class="chart-row">
          <span class="chart-age">
            Year ${i + 1}
          </span>

          <div class="bar pill-bar">
            <div class="stack" style="
              width:${100 * amount / max}%">

              <div style="
                width:${
                  amount
                    ? 100 * R.b1[i] / amount
                    : 0
                }%;
                background:#278fb9">
              </div>

              ${v.joint ? `
                <div style="
                  flex:1;
                  background:#58a89c">
                </div>
              ` : ""}
            </div>
          </div>

          <span class="chart-value">
            ${fmt(amount)}
          </span>
        </div>
      `).join("")}

      <div class="legend centered">
        <span>
          <i class="dot"
            style="background:#278fb9"></i>
          ${esc(name1)}
        </span>

        ${v.joint ? `
          <span>
            <i class="dot"
              style="background:#58a89c"></i>
            ${esc(name2)}
          </span>
        ` : ""}
      </div>
    </div>`;
}

/* STEP 2 — CPF OA FORECAST */

function cpfStep(R) {
  const name1 =
    v.name1.trim() || "Buyer 1";
  const name2 =
    v.name2.trim() || "Buyer 2";

  return `
    <h2>Step 2 · CPF OA Forecast</h2>

    <div class="section">
      <label class="checkline">
        <input type="checkbox"
          data-key="joint"
          ${v.joint ? "checked" : ""}>
        Joint Buyers
      </label>

      ${buyer(1)}
      ${v.joint ? "<hr>" + buyer(2) : ""}

      <div class="panel section">
        ${row(
          "Combined Monthly Income",
          fmt(R.income)
        )}

        ${row(
          "First-Year CPF OA / Month",
          fmt(R.combined[0])
        )}
      </div>

      <hr>

      <h3>10-Year Monthly CPF OA Forecast</h3>

      ${individualBars(
        R.b1, name1, v.age1, "#278fb9"
      )}

      ${v.joint ? `
        <hr>
        ${individualBars(
          R.b2, name2, v.age2, "#58a89c"
        )}
      ` : ""}

      ${combinedBars(R)}

      ${note(
        "Illustrative CPF OA forecast using simplified age-related allocation rates."
      )}
    </div>`;
}

/* STEP 3 — PROTECTED BACKUP */

function backupStep(R) {
  return `
    <h2>Step 3 · Protected Backup</h2>

    <div class="section">
      ${row(
        "Available Cash",
        fmt(R.cash)
      )}

      ${field(
        "backup",
        "Protected Backup (Cash)"
      )}

      <hr>

      ${row(
        "<b>Cash After Backup</b>",
        `<b>${fmt(R.cash - v.backup)}</b>`
      )}

      ${note(
        "Protected Backup applies to Structure B only. Default: $0."
      )}
    </div>`;
}

/* STRUCTURE A/B — FINANCE CARDS */

function finance(x, upfront) {
  return grid(`
    <div class="finance">
      <div class="statlabel">
        Selected Bank Loan
      </div>

      <div class="med money">
        ${fmt(x.loan)}
      </div>

      <hr>

      <div class="tiny">
        Loan-to-Value
      </div>

      <b>${x.ltv.toFixed(1)}% LTV</b>
    </div>

    <div class="finance">
      <div class="statlabel">
        Upfront Required
      </div>

      <div class="med money">
        ${fmt(upfront)}
      </div>

      <hr>

      <div class="tiny">
        Downpayment ${fmt(x.down)}
      </div>

      <div class="tiny">
        BSD + Legal ${fmt(x.duty + x.legal)}
      </div>

      ${x.ab > 0 ? `
        <div class="tiny">
          ABSD ${fmt(x.ab)}
        </div>
      ` : ""}
    </div>
  `);
}

/* FOUR-YEAR MORTGAGE FUNDING */

function funding(x, isB, reduceActive) {
  const protect =
    isB && v.protection && !reduceActive;

  return `
    <div class="section">
      <h3>Four-Year Mortgage Funding</h3>

      <div class="legend">
        <span>
          <i class="dot"
            style="background:#278fb9"></i>
          CPF OA
        </span>

        <span>
          <i class="dot"
            style="background:#e5a047"></i>
          Cash
        </span>

        ${protect ? `
          <span>
            <i class="dot"
              style="background:#8972ce"></i>
            Shield
          </span>
        ` : ""}
      </div>

      ${x.years.map((y, i) => `
        <div class="bars">
          ${row(
            `<b>Year ${i + 1}</b>`,
            fmt(x.monthly) + "/mo"
          )}

          <div class="bar funding-bar">
            <div style="
              background:#278fb9;
              width:${
                100 * y.cpf /
                Math.max(1, x.monthly)
              }%">
            </div>

            <div style="
              background:#e5a047;
              width:${
                100 * y.cash /
                Math.max(1, x.monthly)
              }%">
            </div>

            ${protect ? `
              <div style="
                background:#8972ce;
                width:${
                  100 * y.shield /
                  Math.max(1, x.monthly)
                }%">
              </div>
            ` : ""}
          </div>

          <div class="funding-labels">
            <span>CPF ${fmt(y.cpf)}</span>
            <span>Cash ${fmt(y.cash)}</span>
            ${protect
              ? `<span>Shield ${fmt(y.shield)}</span>`
              : ""}
          </div>
        </div>
      `).join("")}
    </div>`;
}

/* MORTGAGE PROTECTION TOGGLE */

function protectionBox(R) {
  const disabled = R.reduceActive;
  const x = R.B;

  return `
    <div class="panel section">
      <div class="flex">
        <div>
          <b>48-Month Mortgage Protection</b>

          <div class="tiny">
            ${disabled
              ? "Loan reduction selected"
              : v.protection
                ? "ON · Shield reserve enabled"
                : "OFF · No shield reserve"}
          </div>
        </div>

        <button type="button"
          data-toggle="protection"
          ${disabled ? "disabled" : ""}
          class="${v.protection ? "active" : ""}">
          ${disabled
            ? "N/A"
            : v.protection ? "ON" : "OFF"}
        </button>
      </div>

      ${v.protection && !disabled ? `
        <hr>

        ${field(
          "commit",
          "Monthly Cash Commitment (48 Months)"
        )}

        ${pills("commit", [
          [0, "$0"],
          [1000, "$1k"],
          [2000, "$2k"],
          [3000, "$3k"]
        ])}

        ${x ? `
          <hr>

          ${row(
            "Mortgage Shortfall (4 Years)",
            fmt(x.shortfall)
          )}

          ${row(
            "Cash Contributions (4 Years)",
            fmt(x.paid)
          )}

          <hr>

          ${row(
            "<b>Mortgage Shield Required</b>",
            `<b>${fmt(x.shield)}</b>`
          )}
        ` : ""}
      ` : ""}
    </div>`;
}

/* CASH TOP-UP TOGGLE */

function topupBox() {
  return `
    <div class="panel section">
      <div class="flex">
        <div>
          <b>Cash Top-Up (Personal Savings)</b>

          <div class="tiny">
            ${v.topupOn
              ? "ON · Additional cash included"
              : "OFF · No additional cash included"}
          </div>
        </div>

        <button type="button"
          data-toggle="topupOn"
          class="${v.topupOn ? "active" : ""}">
          ${v.topupOn ? "ON" : "OFF"}
        </button>
      </div>

      ${v.topupOn ? `
        <hr>

        ${field(
          "topup", "Additional Cash"
        )}

        ${pills("topup", [
          [0, "$0"],
          [50000, "$50k"],
          [100000, "$100k"],
          [200000, "$200k"]
        ])}
      ` : ""}
    </div>`;
}

/* STRUCTURE B — EQUITY ALLOCATION */

function allocation(R) {
  const x = R.B;
  if (!x) return "";

  const showShield =
    v.protection && !R.reduceActive;

  return `
    <div class="section">
      <h3>Equity Allocation</h3>

      ${row(
        "<b>Assets (Cash)</b>",
        fmt(R.cash + R.topup)
      )}

      ${row(
        "− Protected Backup (Cash)",
        "−" + fmt(v.backup)
      )}

      ${showShield &&
        x.cashShield > 0.5 ? row(
          "− Mortgage Shield (Cash)",
          "−" + fmt(x.cashShield)
        ) : ""}

      ${row(
        "<b>Remaining Cash</b>",
        `<b>${fmt(x.remainingCash)}</b>`
      )}

      <hr>

      ${row(
        "<b>Assets (CPF)</b>",
        fmt(R.cpf)
      )}

      ${showShield ? row(
        "− Mortgage Shield (CPF)",
        "−" + fmt(x.cpfShield)
      ) : ""}

      ${row(
        "<b>Remaining CPF</b>",
        `<b>${fmt(x.remainingCPF)}</b>`
      )}

      <hr>

      ${row(
        "<b>Available for Purchase</b>",
        `<b>${fmt(x.available)}</b>`
      )}
    </div>`;
}

/* SMART CPF ALLOCATION */

function smartBox(R) {
  if (!R.smart || !R.smart.trigger) {
    return "";
  }

  return `
    <div class="panel section">
      <h3>Smart CPF Allocation</h3>

      ${note(
        "Surplus CPF OA after the illustrated purchase and mortgage shield: " +
        fmt(R.smart.spare)
      )}

      ${segment("choice", [
        ["protect", "Protect Mortgage"],
        ["reduce", "Reduce Loan"]
      ])}

      ${R.reduceActive ? `
        ${row(
          "CPF Used to Reduce Loan",
          fmt(R.smart.reduction)
        )}

        ${row(
          "Monthly Mortgage Saving",
          fmt(
            R.smart.originalMonthly -
            R.B.monthly
          )
        )}
      ` : note(
        "Mortgage protection remains the selected approach."
      )}
    </div>`;
}

/* INCOME-BASED PURCHASE CAPACITY */

function benchmark(R) {
  const cashShare = R.equity
    ? 100 * R.cash / R.equity
    : 0;

  return `
    <div class="panel section">
      <h3>
        Purchase Capacity Based on Income/Age
      </h3>

      <div class="capacity-grid">
        <div class="capacity-stat">
          <div class="statlabel">
            Max Bank Loan
          </div>
          <b>${fmt(R.bankCap)}</b>
        </div>

        <div class="capacity-stat">
          <div class="statlabel">
            Upfront Required
          </div>
          <b>${R.bankCap
            ? fmt(R.benchUp) : "—"}</b>
        </div>

        <div class="capacity-stat">
          <div class="statlabel">
            Max Price
          </div>
          <b>${R.bankCap
            ? fmt(R.benchP) : "—"}</b>
        </div>
      </div>

      ${note(
        "75% LTV · " +
        R.tenure +
        "-year tenure · Income-weighted age " +
        R.age.toFixed(1)
      )}

      <hr>

      ${row(
        "<b>5% Cash Downpayment</b>",
        `<b>${fmt(R.benchCashDown)}</b>`
      )}

      ${row(
        "20% CPF / Cash Downpayment",
        fmt(R.benchFlexibleDown)
      )}

      ${row(
        "BSD + Legal",
        fmt(R.benchDuty + R.benchLegal)
      )}

      ${R.benchABSD > 0 ? row(
        "Assumed ABSD",
        fmt(R.benchABSD)
      ) : ""}

      <hr>

      ${row(
        "<b>Total Available Equity</b>",
        fmt(R.equity)
      )}

      <div class="bar equity-bar">
        <div style="
          width:${cashShare}%;
          background:#5479a8">
        </div>
        <div style="
          flex:1;
          background:#64ada2">
        </div>
      </div>

      <div class="legend">
        <span>
          <i class="dot"
            style="background:#5479a8"></i>
          <b>${fmt(R.cash)}</b> (Cash)
        </span>

        <span>
          <i class="dot"
            style="background:#64ada2"></i>
          ${fmt(R.cpf)} (CPF)
        </span>
      </div>

      ${R.benchFunded ? `
        <div class="capacity-stat">
          <h3>Remaining Equity After Benchmark</h3>

          ${grid(`
            <div class="stat">
              <div class="statlabel">
                Cash Remaining
              </div>
              <div class="med">
                ${fmt(R.benchCash)}
              </div>
            </div>

            <div class="stat">
              <div class="statlabel">
                CPF OA Remaining
              </div>
              <div class="med">
                ${fmt(R.benchCPF)}
              </div>
            </div>
          `)}
        </div>
      ` : `
        <p class="warning">
          Insufficient cash funding
        </p>
      `}

      <hr>

      ${note(
        "55% TDSR · 4% Stress Test · Loan rounded to $1k"
      )}

      ${grid(
        field(
          "debts", "Existing Monthly Debts"
        ) +
        field(
          "rate", "Mortgage Interest (%)", "number"
        )
      )}
    </div>`;
}

/* STEP 4 — RESULTS */

function results(R) {
  const A = R.A;
  const B = R.B;

  return `
    <h2>Step 4 · Purchase Structures</h2>

    <div class="section">
      ${benchmark(R)}

      <div class="card structure-a section">
        <div>
          <h3>
            ↗ Structure A · Maximum Purchase Power
          </h3>

          ${note(
            "Maximise available purchase funds"
          )}
        </div>

        ${grid(`
          <div class="stat">
            <div class="statlabel">
              Max Purchase Price
            </div>
            <div class="big">
              ${A ? fmt(A.p) : "—"}
            </div>
          </div>

          <div class="stat">
            <div class="statlabel">
              Monthly Mortgage
            </div>
            <div class="big">
              ${A ? fmt(A.monthly) : "—"}
            </div>
          </div>
        `)}

        ${A ? `
          ${finance(A, R.aDisplayUpfront)}
          <hr>
          ${funding(A, false, false)}
        ` : note(
          "No feasible purchase under these assumptions."
        )}
      </div>

      <div class="card structure-b section">
        <div>
          <h3>
            ◈ Structure B · Lifestyle Protection
          </h3>

          ${note(
            "Protect backup cash and mortgage funding"
          )}
        </div>

        ${grid(`
          <div class="stat">
            <div class="statlabel">
              Max Purchase Price
            </div>
            <div class="big">
              ${B ? fmt(B.p) : "—"}
            </div>
          </div>

          <div class="stat">
            <div class="statlabel">
              Monthly Mortgage
            </div>
            <div class="big">
              ${B ? fmt(B.monthly) : "—"}
            </div>
          </div>
        `)}

        ${B
          ? finance(B, R.bDisplayUpfront)
          : ""}

        ${smartBox(R)}
        ${protectionBox(R)}
        ${topupBox()}

        ${B ? `
          <hr>
          ${allocation(R)}
          <hr>
          ${funding(B, true, R.reduceActive)}
        ` : note(
          "No feasible protected purchase under these assumptions."
        )}
      </div>
    </div>`;
}

/* ---------------------------------------
   PART 3 — INTERACTIVE CONTROLS
---------------------------------------- */

function render() {
  const container = $("calculator-content");

  try {
    const R = calculate();

    const views = [
      funds,
      cpfStep,
      backupStep,
      results
    ];

    container.innerHTML = views[step](R);

    document.querySelectorAll(
      "[data-step]"
    ).forEach(button => {
      const selected =
        Number(button.dataset.step) === step;

      button.classList.toggle(
        "active", selected
      );

      button.setAttribute(
        "aria-current",
        selected ? "step" : "false"
      );
    });

    $("back-button").style.display =
      step === 0 ? "none" : "";

    $("next-button").textContent =
      step === 3
        ? "Review Funds →"
        : "Next →";

  } catch (error) {
    console.error("Calculator error:", error);

    container.innerHTML = `
      <p class="warning">
        Calculator could not load:
        ${esc(error.message)}
      </p>`;
  }
}

function updateField(node) {
  const key = node.dataset.key;

  if (!(key in defaults)) return;

  if (node.type === "checkbox") {
    v[key] = node.checked;

  } else if (
    key === "name1" ||
    key === "name2"
  ) {
    v[key] = node.value;

  } else {
    const cleaned = String(node.value)
      .replace(/[^0-9.]/g, "");

    v[key] = Math.max(
      0, Number(cleaned) || 0
    );
  }

  save();
  render();
}

/* Step navigation and preset buttons */

document.addEventListener("click", event => {
  const tab = event.target.closest(
    "[data-step]"
  );

  if (tab) {
    step = Number(tab.dataset.step);
    render();
    return;
  }

  const preset = event.target.closest(
    "[data-set]"
  );

  if (preset) {
    const key = preset.dataset.set;
    const value = preset.dataset.val;

    if (
      key === "mode" ||
      key === "status1" ||
      key === "status2" ||
      key === "choice"
    ) {
      v[key] = value;
    } else {
      v[key] = Number(value);
    }

    save();
    render();
    return;
  }

  const toggle = event.target.closest(
    "[data-toggle]"
  );

  if (toggle && !toggle.disabled) {
    const key = toggle.dataset.toggle;

    v[key] = !v[key];

    save();
    render();
  }
});

/* Editable input fields */

document.addEventListener("change", event => {
  const node = event.target.closest(
    "[data-key]"
  );

  if (node) {
    updateField(node);
  }
});

/* Bottom navigation */

$("back-button").addEventListener(
  "click", () => {
    step = Math.max(0, step - 1);
    render();
  }
);

$("next-button").addEventListener(
  "click", () => {
    step = step === 3 ? 0 : step + 1;
    render();
  }
);

/* Open calculator on Results tab */

render();
