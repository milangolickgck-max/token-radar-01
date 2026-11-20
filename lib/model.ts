// Token Radar's model, radar-3: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and every
// other rankable pre-token protocol below the floor: the early rows the radar exists to find. A
// protocol is pre-token when its record carries no token (no market cap, no CoinGecko id, no
// symbol); the snapshot's live-token protocols are kept apart and shown with the market's own
// values, never mixed into the ranked board.
//
// radar-3 fits its value model at run time from the snapshot's own live-token comps, instead of
// the hand-set multipliers radar-2 used. The fit, in log space, is:
//
//   log(market cap) = intercept + slope x log(TVL) + category effect
//
//   - intercept and slope come from ordinary least squares on the 128 live-token protocols
//     that carry a market cap (a power law: the fitted slope is about 0.52, so a launch is
//     worth far less per TVL dollar at $1B of TVL than at $10M — the constant multiple radar-2
//     used (0.214) overvalues big protocols by an order of magnitude).
//   - the category effect is the mean residual of the protocol's category, shrunk toward zero
//     by n / (n + k): a category with one comp cannot swing a row. k is picked by
//     leave-one-out cross-validation over {2, 5, 10, 20}, so the shrinkage is the data's own.
//   - seven-day growth and age were fitted and tested the same way, as extra terms under
//     the same 5-fold protocol, and both were dropped: growth, clamped to each training
//     fold's growth range, scores 1.251 (R-squared 0.119) held out against 1.308 (0.130)
//     for the fitted model — a slightly smaller median error but a worse R-squared — and
//     its slope is negative in every fold (median -3.79 per 100 points of growth), so
//     unclamped it would swing board rows with growth up to +4,448% far beyond anything
//     the comps support; age, as a log-age term, scores 1.252 (R-squared 0.090), the same
//     shape, so it stays out too. The fit prices on TVL and business type alone. The
//     validation numbers below are the evidence, not an assertion.
//
// Validation is computed at run time, deterministically, by 5-fold cross-validation over the
// 128 comps (folds by sorted slug, index mod 5): each fold's k is picked by leave-one-out on
// its training part only, the fold's held-out rows are predicted once, and the pooled
// held-out predictions give the median absolute log error and R-squared. The same folds score
// two baselines: the pure median multiple (radar-2's 0.214, recomputed on the training fold)
// and the full radar-2 formula. The fitted model must beat both, or it is not an improvement.
//
// No protocol name is ever special-cased: the same function scores every row, and the same
// function builds every farm plan from the protocol's own record (category, chains, TVL, age).

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The fitted value model: every number in it is computed at run time from the snapshot. */
export interface FittedModel {
  version: string;
  intercept: number;
  slope_ln_tvl: number;
  category_effects: Record<string, number>;
  k_cat: number;
}

/** One error summary: median absolute log error and R-squared on held-out rows. */
export interface ErrorSummary {
  median_abs_log_error: number;
  r2: number;
}

/** The held-out validation, computed at run time by 5-fold cross-validation. */
export interface ModelValidation {
  folds: number;
  held_out_n: number;
  fitted: ErrorSummary;
  baseline_median: ErrorSummary;
  baseline_v1: ErrorSummary;
  /** Held-out error of the fitted model with a comp-range-clamped growth term added. */
  growth_variant: ErrorSummary;
  /** Held-out error of the fitted model with a log-age term added. */
  age_variant: ErrorSummary;
  /** The fitted growth slope per fold, per 100 points of seven-day growth. */
  growth_slopes: number[];
  /** The comps' seven-day growth range in percent, the clamp the variants respect. */
  growth_range: [number, number];
  /** Correlation of the log multiple with 7-day growth across the 128 comps. */
  growth_corr: number;
  /** Correlation of the log multiple with log age across the comps that carry a date. */
  age_corr: number;
}

/** Snapshot facts the dashboard states: the comps the model was fitted on. */
export interface ModelCalibration {
  live_with_mcap: number;
  median_mcap_tvl: number;
  known_age_count: number;
  unknown_age_count: number;
  median_age_days: number;
}

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** The shrinkage grid the leave-one-out search picks k_cat from. */
export const K_GRID = [2, 5, 10, 20];

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** The fitted model's own breakdown of one row, for the detail view's recompute check. */
export interface ModelBreakdown {
  intercept: number;
  ln_tvl_term: number;
  category_effect: number;
  log_mcap_pred: number;
  age_days: number | null;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  watchlist: boolean;
  implied_value_usd: number;
  model: ModelBreakdown;
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  watchlist: boolean;
  implied_value_usd: number;
  model: ModelBreakdown;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: FittedModel;
  model_version: string;
  validation: ModelValidation;
  calibration: ModelCalibration;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a non-empty list of finite numbers, else `fallback`. */
function median(values: number[], fallback: number): number {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (xs.length === 0) return fallback;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 === 1 ? xs[mid]! : (xs[mid - 1]! + xs[mid]!) / 2;
}

/** Round to three decimals, for a constant the dashboard states. */
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Round to two decimals, for a fitted slope the dashboard states. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** The snapshot's live-token protocols that carry a market cap over a positive TVL. */
function livePriced(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0)
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

/** Solve a small dense linear system by Gaussian elimination with partial pivoting. */
function solveLinear(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r]![col]!) > Math.abs(m[piv]![col]!)) piv = r;
    if (Math.abs(m[piv]![col]!) < 1e-12) throw new Error('singular matrix in least squares');
    if (piv !== col) {
      const t = m[col]!;
      m[col] = m[piv]!;
      m[piv] = t;
    }
    for (let r = col + 1; r < n; r++) {
      const f = m[r]![col]! / m[col]![col]!;
      for (let c = col; c <= n; c++) m[r]![c]! -= f * m[col]![c]!;
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = m[r]![n]!;
    for (let c = r + 1; c < n; c++) s -= m[r]![c]! * x[c]!;
    x[r] = s / m[r]![r]!;
  }
  return x;
}

/** Least squares for y ~ a + b*x, via the normal equations; flat x falls back to the mean. */
function ols2(xs: number[], ys: number[]): [number, number] {
  const n = xs.length;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i]!;
    sy += ys[i]!;
    sxx += xs[i]! * xs[i]!;
    sxy += xs[i]! * ys[i]!;
  }
  const beta = solveLinear(
    [
      [n, sx],
      [sx, sxx],
    ],
    [sy, sxy],
  );
  return [beta[0]!, beta[1]!];
}

/** One fitted model: the OLS core plus the shrunk category effects for a training set. */
interface CoreFit {
  intercept: number;
  slope: number;
  effects: Record<string, number>;
}

/** The shrunk mean residual per category: n / (n + k) of the category's mean residual. */
function categoryEffects(train: SnapshotProtocol[], residuals: number[], k: number): Record<string, number> {
  const sums = new Map<string, { sum: number; n: number }>();
  train.forEach((p, i) => {
    const key = p.category ?? '';
    const e = sums.get(key) ?? { sum: 0, n: 0 };
    e.sum += residuals[i]!;
    e.n += 1;
    sums.set(key, e);
  });
  const effects: Record<string, number> = {};
  for (const [key, e] of sums) effects[key] = (e.n / (e.n + k)) * (e.sum / e.n);
  return effects;
}

/** Fit the core and the category effects on one training set, at one k. */
function fitOn(train: SnapshotProtocol[], k: number): CoreFit {
  const xs = train.map((p) => Math.log(p.tvl_usd));
  const ys = train.map((p) => Math.log(p.mcap_usd!));
  const [intercept, slope] = ols2(xs, ys);
  const residuals = train.map((_, i) => ys[i]! - (intercept + slope * xs[i]!));
  return { intercept, slope, effects: categoryEffects(train, residuals, k) };
}

/** The fitted log market cap of one protocol under one fit; an unseen category counts as zero. */
function predictLog(fit: CoreFit, p: SnapshotProtocol): number {
  return fit.intercept + fit.slope * Math.log(p.tvl_usd) + (fit.effects[p.category ?? ''] ?? 0);
}

/** Leave-one-out mean squared error of one k on one training set: refit per held-out comp. */
function looMse(train: SnapshotProtocol[], k: number): number {
  let se = 0;
  for (let held = 0; held < train.length; held++) {
    const rest = train.filter((_, i) => i !== held);
    const fit = fitOn(rest, k);
    const d = predictLog(fit, train[held]!) - Math.log(train[held]!.mcap_usd!);
    se += d * d;
  }
  return se / train.length;
}

/** Pick k_cat by leave-one-out mean squared error; the smallest k wins an exact tie. */
function pickK(train: SnapshotProtocol[]): number {
  let bestK = K_GRID[0]!;
  let bestErr = Infinity;
  for (const k of K_GRID) {
    const err = looMse(train, k);
    if (err < bestErr) {
      bestErr = err;
      bestK = k;
    }
  }
  return bestK;
}

/** One extra model term, as a function of a protocol: growth or age, built from a training set. */
type FeatureFn = (p: SnapshotProtocol) => number;

/** Least squares for y ~ X, rows already carrying the intercept column, via the normal equations. */
function ols(rows: number[][], ys: number[]): number[] {
  const m = rows[0]!.length;
  const ata: number[][] = Array.from({ length: m }, () => new Array<number>(m).fill(0));
  const atb = new Array<number>(m).fill(0);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    for (let a = 0; a < m; a++) {
      atb[a]! += row[a]! * ys[i]!;
      for (let b = 0; b < m; b++) ata[a]![b]! += row[a]! * row[b]!;
    }
  }
  return solveLinear(ata, atb);
}

/** One fitted variant: the OLS core with one extra term, plus the shrunk category effects. */
interface VariantFit {
  coefs: number[];
  effects: Record<string, number>;
}

/** Fit the variant on one training set, at one k: the extra term joins ln(TVL) in the OLS. */
function fitVariant(train: SnapshotProtocol[], k: number, feat: FeatureFn): VariantFit {
  const rows = train.map((p) => [1, Math.log(p.tvl_usd), feat(p)]);
  const ys = train.map((p) => Math.log(p.mcap_usd!));
  const coefs = ols(rows, ys);
  const residuals = train.map(
    (p, i) => ys[i]! - (coefs[0]! + coefs[1]! * Math.log(p.tvl_usd) + coefs[2]! * feat(p)),
  );
  return { coefs, effects: categoryEffects(train, residuals, k) };
}

/** The fitted log market cap of one protocol under one variant fit. */
function predictVariant(fit: VariantFit, p: SnapshotProtocol, featVal: number): number {
  return (
    fit.coefs[0]! + fit.coefs[1]! * Math.log(p.tvl_usd) + fit.coefs[2]! * featVal + (fit.effects[p.category ?? ''] ?? 0)
  );
}

/** Leave-one-out mean squared error of one k on one training set, for a variant fit. */
function looMseVariant(
  train: SnapshotProtocol[],
  k: number,
  featBuilder: (t: SnapshotProtocol[]) => FeatureFn,
): number {
  let se = 0;
  for (let held = 0; held < train.length; held++) {
    const rest = train.filter((_, i) => i !== held);
    const feat = featBuilder(rest);
    const fit = fitVariant(rest, k, feat);
    const d = predictVariant(fit, train[held]!, feat(train[held]!)) - Math.log(train[held]!.mcap_usd!);
    se += d * d;
  }
  return se / train.length;
}

/** Pick k_cat for a variant by leave-one-out mean squared error; the smallest k wins an exact tie. */
function pickKVariant(train: SnapshotProtocol[], featBuilder: (t: SnapshotProtocol[]) => FeatureFn): number {
  let bestK = K_GRID[0]!;
  let bestErr = Infinity;
  for (const k of K_GRID) {
    const err = looMseVariant(train, k, featBuilder);
    if (err < bestErr) {
      bestErr = err;
      bestK = k;
    }
  }
  return bestK;
}

/**
 * The growth term: seven-day growth as a fraction, clamped to the training set's own growth
 * range, so a held-out row never stretches the term past what its fold trained on.
 */
function growthFeature(train: SnapshotProtocol[]): FeatureFn {
  const gs = train.map((p) => finite(p.change_7d, 0));
  const lo = Math.min(...gs);
  const hi = Math.max(...gs);
  return (p) => Math.min(hi, Math.max(lo, finite(p.change_7d, 0))) / 100;
}

/**
 * The age term: log days since listing, with a protocol that carries no date scored at the
 * training set's median log age, so a missing date is the middle of the pack, not an extreme.
 */
function ageFeature(asOf: string, train: SnapshotProtocol[]): FeatureFn {
  const logs = train
    .map((p) => {
      const a = ageDays(asOf, p.listed_at);
      return a === null ? NaN : Math.log(a + 1);
    })
    .filter((v) => Number.isFinite(v));
  const med = median(logs, Math.log(365));
  return (p) => {
    const a = ageDays(asOf, p.listed_at);
    return a === null ? med : Math.log(a + 1);
  };
}

/** Median absolute error and R-squared of pooled held-out predictions. */
function errorSummary(predicted: number[], actual: number[]): ErrorSummary {
  const errs = predicted.map((p, i) => Math.abs(p - actual[i]!));
  const mean = actual.reduce((s, v) => s + v, 0) / actual.length;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < actual.length; i++) {
    ssRes += (predicted[i]! - actual[i]!) ** 2;
    ssTot += (actual[i]! - mean) ** 2;
  }
  return { median_abs_log_error: round3(median(errs, 0)), r2: round3(1 - ssRes / ssTot) };
}

/** Pearson correlation of two equal-length lists, skipping non-finite pairs. */
function correlation(xs: number[], ys: number[]): number {
  const pairs = xs.map((x, i) => [x, ys[i]!] as const).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  const n = pairs.length;
  if (n < 3) return 0;
  const mx = pairs.reduce((s, [x]) => s + x, 0) / n;
  const my = pairs.reduce((s, [, y]) => s + y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const [x, y] of pairs) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  if (sxx <= 0 || syy <= 0) return 0;
  return sxy / Math.sqrt(sxx * syy);
}

/** radar-2's formula as a baseline: median multiple times its hand-set growth and maturity. */
function v1BaselineLog(p: SnapshotProtocol, asOf: string, medRatio: number, unknownAge: number): number {
  const age = ageDays(asOf, p.listed_at) ?? unknownAge;
  const rawGrowth = finite(p.change_7d, 0);
  const growthPct = Math.min(120, Math.max(-60, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * 0.5;
  const maturityMult = 0.6 + (Math.min(Math.max(age, 0), 1095) / 1095) * 0.4;
  return Math.log(Math.max(1, p.tvl_usd * medRatio * growthMult * maturityMult));
}

/**
 * The 5-fold held-out validation and the dropped-feature evidence, all computed at run time.
 * Each fold's k is picked by leave-one-out on its training part only; the fold's held-out rows
 * are predicted once, and the pooled predictions give every number below. The two baselines
 * are scored on the same folds, their median multiple recomputed on the training fold. The
 * growth and age variants are scored the same way — the same folds, their own k picked by
 * leave-one-out on the variant fit, the extra term clamped or centred on the training fold
 * alone — so the decision to leave either term out is measured, not asserted.
 */
function validate(comps: SnapshotProtocol[], snapshot: Snapshot): ModelValidation {
  const folds = 5;
  const actual = comps.map((p) => Math.log(p.mcap_usd!));
  const fittedPred = new Array<number>(comps.length).fill(0);
  const medianPred = new Array<number>(comps.length).fill(0);
  const v1Pred = new Array<number>(comps.length).fill(0);
  const growthPred = new Array<number>(comps.length).fill(0);
  const agePred = new Array<number>(comps.length).fill(0);
  const growthSlopes: number[] = [];
  const preToken = snapshot.protocols.filter(isPreToken);
  const knownAges = preToken.map((p) => ageDays(snapshot.as_of, p.listed_at)).filter((a): a is number => a !== null);
  const unknownAge = Math.round(median(knownAges, 365));
  const ageBuilder = (t: SnapshotProtocol[]) => ageFeature(snapshot.as_of, t);
  for (let f = 0; f < folds; f++) {
    const te = comps.map((_, i) => i).filter((i) => i % folds === f);
    const tr = comps.map((_, i) => i).filter((i) => i % folds !== f);
    const train = tr.map((i) => comps[i]!);
    const k = pickK(train);
    const fit = fitOn(train, k);
    const medRatio = median(train.map((p) => p.mcap_usd! / p.tvl_usd), 0.25);
    const gFeat = growthFeature(train);
    const gk = pickKVariant(train, growthFeature);
    const gfit = fitVariant(train, gk, gFeat);
    growthSlopes.push(gfit.coefs[2]!);
    const aFeat = ageBuilder(train);
    const ak = pickKVariant(train, ageBuilder);
    const afit = fitVariant(train, ak, aFeat);
    for (const i of te) {
      fittedPred[i] = predictLog(fit, comps[i]!);
      medianPred[i] = Math.log(comps[i]!.tvl_usd * medRatio);
      v1Pred[i] = v1BaselineLog(comps[i]!, snapshot.as_of, medRatio, unknownAge);
      growthPred[i] = predictVariant(gfit, comps[i]!, gFeat(comps[i]!));
      agePred[i] = predictVariant(afit, comps[i]!, aFeat(comps[i]!));
    }
  }
  const logRatio = comps.map((p) => Math.log(p.mcap_usd! / p.tvl_usd));
  const growths = comps.map((p) => finite(p.change_7d, 0));
  const logAges = comps.map((p) => {
    const a = ageDays(snapshot.as_of, p.listed_at);
    return a === null ? NaN : Math.log(a + 1);
  });
  return {
    folds,
    held_out_n: comps.length,
    fitted: errorSummary(fittedPred, actual),
    baseline_median: errorSummary(medianPred, actual),
    baseline_v1: errorSummary(v1Pred, actual),
    growth_variant: errorSummary(growthPred, actual),
    age_variant: errorSummary(agePred, actual),
    growth_slopes: growthSlopes.map((s) => round2(s)),
    growth_range: [Math.round(Math.min(...growths) * 10) / 10, Math.round(Math.max(...growths) * 10) / 10],
    growth_corr: round3(correlation(logRatio, growths)),
    age_corr: round3(correlation(logRatio, logAges)),
  };
}

/**
 * Fit radar-3 on the snapshot: the leave-one-out k, the full-data fit, the 5-fold validation,
 * and the snapshot facts the dashboard states.
 */
export function fitRadar(snapshot: Snapshot): { model: FittedModel; validation: ModelValidation; calibration: ModelCalibration } {
  const comps = livePriced(snapshot);
  const k = pickK(comps);
  const fit = fitOn(comps, k);
  const ratios = comps.map((p) => p.mcap_usd! / p.tvl_usd);
  const preToken = snapshot.protocols.filter(isPreToken);
  const knownAges = preToken.map((p) => ageDays(snapshot.as_of, p.listed_at)).filter((a): a is number => a !== null);
  return {
    model: {
      version: MODEL_VERSION,
      // Full precision, not rounded: the dashboard recomputes every row from these numbers, and
      // the recompute must land on the same dollar board.json carries. The panel rounds for display.
      intercept: fit.intercept,
      slope_ln_tvl: fit.slope,
      category_effects: fit.effects,
      k_cat: k,
    },
    validation: validate(comps, snapshot),
    calibration: {
      live_with_mcap: comps.length,
      median_mcap_tvl: round3(median(ratios, 0.25)),
      known_age_count: knownAges.length,
      unknown_age_count: preToken.length - knownAges.length,
      median_age_days: Math.round(median(knownAges, 365)),
    },
  };
}

/** The fitted log market cap and implied value one protocol gets, with its breakdown. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  fit: CoreFit,
): { implied: number; logPred: number; lnTvlTerm: number; catEffect: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const lnTvlTerm = fit.slope * Math.log(protocol.tvl_usd);
  const catEffect = fit.effects[protocol.category ?? ''] ?? 0;
  const logPred = fit.intercept + lnTvlTerm + catEffect;
  return { implied: Math.max(1, Math.round(Math.exp(logPred))), logPred, lnTvlTerm, catEffect, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, fit: CoreFit): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const watchlist = new Set(snapshot.watchlist);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but
  // the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every rankable pre-token protocol below the watchlist floor, not just the top
  // few by TVL. The floor is never the whole board: the radar exists to find the early ones.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, fit);
    return { p, ...v };
  });
  scored.sort((a, b) => b.logPred - a.logPred || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  // Rounding guard: two rows that round to the same dollar are separated by $1, so the ranks
  // stay distinct without moving any value by more than a few dollars.
  let prev = Infinity;
  return scored.map((s, i) => {
    let implied = s.implied;
    if (implied >= prev) implied = prev - 1;
    if (implied < 1) implied = 1;
    prev = implied;
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token' as const,
      age_days: s.age,
      watchlist: watchlist.has(s.p.slug),
      implied_value_usd: implied,
      model: {
        intercept: round4(fit.intercept),
        ln_tvl_term: round4(s.lnTvlTerm),
        category_effect: round4(s.catEffect),
        log_mcap_pred: round4(s.logPred),
        age_days: s.age,
      },
      farm_steps: farmSteps(s.p, s.age).map(stepText),
    };
  });
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** Why the hold lasts that long, from the protocol's age. */
function holdReasonFor(age: number | null): string {
  if (age === null) return 'the listing date is missing, so a full monthly cycle is the safe assumption';
  if (age < 180) return 'the protocol is young and snapshots reward early, steady activity';
  if (age < 365) return 'a full monthly cycle proves the position is not a one-week spike';
  return 'the position still needs a full cycle to register in the next snapshot';
}

/** What one transaction costs on a chain, as the steps state it: an estimate, not a quote. */
function gasFor(chain: string): string {
  if (chain === 'Ethereum') return 'about $12 of gas';
  if (chain === 'Solana') return 'under $1 of gas';
  if (['Arbitrum', 'Optimism', 'Base', 'Polygon', 'zkSync', 'Blast', 'Linea', 'Scroll', 'Mantle', 'Mode'].includes(chain)) return 'about $2 of gas';
  return 'about $4 of gas';
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('basis')) return `Deposit $${capital} of USDC as margin for the basis trade on ${name} on ${chain} and keep the hedge open.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of ${name}'s yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c === 'chain') return `Bridge $${capital} of USDC to ${name} and use its apps every week so the address stays active.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The weekly action that keeps one position counting, by what the protocol does. */
function weeklyActionFor(p: SnapshotProtocol, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral'))
    return `lend a little more to ${name} on ${chain}, or repay a small part of a borrow there`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm'))
    return `swap a few dollars through ${name}'s main pool on ${chain}, or add a little liquidity`;
  if (c.includes('bridge'))
    return `bridge a small amount to the other side through ${name} and back, so both directions show activity`;
  if (c.includes('basis')) return `check the basis trade's funding rate on ${name} and rebalance the hedge if it flips`;
  if (c.includes('staking') || c.includes('restak')) return `restake the week's rewards through ${name} instead of withdrawing them`;
  if (c.includes('perpetual') || c.includes('derivative')) return `close and reopen one small hedge on ${name} so the position stays fresh`;
  if (c.includes('prediction')) return `settle one market position on ${name} and open the next`;
  if (c.includes('curator') || c.includes('allocator')) return `check ${name}'s vault allocation on ${chain} and top it up if the strategy changed`;
  if (c.includes('stable')) return `mint or redeem a small amount of the stable asset through ${name} on ${chain}`;
  if (c.includes('rwa')) return `check the yield asset's accrual on ${name} and reinvest the week's yield`;
  if (c.includes('insurance')) return `review the cover's expiry on ${name} and renew before it lapses`;
  if (c === 'chain') return `use one of ${name}'s apps so the address stays active`;
  return `make one small deposit, swap or vote on ${name} on ${chain}`;
}

/** The risk one position carries, by what the protocol does. */
function riskNoteFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('leveraged farm'))
    return 'Keep it small: a leveraged position can be liquidated, so size it to survive a bad week.';
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral'))
    return 'Watch the borrow rate: if it jumps, the position costs more than it earns.';
  if (c.includes('bridge')) return 'Bridges settle slowly: never farm with funds you need back the same day.';
  if (c.includes('staking') || c.includes('restak')) return 'Staked receipts unlock slowly, so do not lock funds you may need soon.';
  if (c.includes('rwa')) return "The yield asset tracks a real-world issuer, so check its reports before adding more.";
  if (c.includes('insurance')) return 'Cover pays only for the risks it names, so read what is actually covered.';
  return 'Never farm with funds you cannot afford to leave in the position.';
}

/** How to unwind one position, by what the protocol does. */
function exitFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'withdrawing the supply and repaying any borrow';
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return 'removing the liquidity and swapping back to USDC';
  if (c.includes('bridge')) return 'bridging the funds back to the chain you started on';
  if (c.includes('staking') || c.includes('restak')) return 'unstaking and waiting out the unlock period';
  if (c.includes('perpetual') || c.includes('derivative')) return 'closing the hedge and withdrawing the margin';
  if (c.includes('curator') || c.includes('allocator')) return 'redeeming the vault shares back to USDC';
  if (c.includes('stable')) return 'redeeming the stable asset back to USDC';
  if (c.includes('rwa')) return 'redeeming the yield asset back to USDC';
  return 'withdrawing the position back to USDC';
}

/** What to watch when claiming, by what the protocol does. */
function claimClauseFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('bridge')) return 'claim only from the link it publishes — a bridge never asks for a seed phrase to release funds';
  if (c.includes('staking') || c.includes('restak')) return 'claim only from the link it publishes — unstaking never asks for a payment to unlock';
  if (c.includes('perpetual') || c.includes('derivative')) return "claim only from the link it publishes — never pay to 'unlock' a position";
  return 'claim only from the link it publishes — the protocol never asks for a seed phrase or a payment to claim';
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. Every step is
 * written from the protocol's own record — its name, category, chains, TVL and age — so no two
 * rows share a plan: the action, the weekly work, the hold, the claim warning, the exit and
 * the second-chain step all vary with the record. The safety guidance (a fresh wallet; claim
 * only from the protocol's own published links) stays, phrased per protocol.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasFor(chain);
  const steps: FarmStep[] = [
    {
      text: `Open a fresh wallet on ${chain} holding only the $${capital} you plan to farm with ${p.name}, and keep its seed phrase offline.`,
      cost: `${gas} for the first transaction`,
      time: '5 minutes',
    },
    {
      text: `${actionFor(p, capital, chain)} ${riskNoteFor(p)}`,
      cost: `$${capital} of capital and ${gas}`,
      time: '15 minutes to set up',
    },
    {
      text: `Each week, ${weeklyActionFor(p, chain)}.`,
      cost: `${gas} a week`,
      time: '10 minutes a week',
    },
    {
      text: `Keep the $${capital} in ${p.name} for at least ${hold} days — ${holdReasonFor(age)} — so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw from ${p.name}, open its own points or rewards page and ${claimClauseFor(p)}.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every ${p.name} transaction in a farm log, then unwind by ${exitFor(p)} when you are done.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
  if (p.chains.length > 1) {
    const second = p.chains[1]!;
    steps.push({
      text: `Repeat the $${capital} deposit on ${second} as well: ${p.name} counts TVL on ${p.chains.length} chains, and activity on a second chain is a second footprint.`,
      cost: `${gasFor(second)}, split the $${capital} across the two chains`,
      time: '15 minutes',
    });
  } else {
    steps.push({
      text: `Check ${p.name}'s ${chain} pool every week: if its TVL falls by more than half, move the $${capital} to the protocol's next pool on ${chain}.`,
      cost: `${gas} to move`,
      time: '10 minutes a week',
    });
  }
  return steps;
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    watchlist: row.watchlist,
    implied_value_usd: row.implied_value_usd,
    model: row.model,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const { model, validation, calibration } = fitRadar(snapshot);
  const comps = livePriced(snapshot);
  const k = model.k_cat;
  const fit = fitOn(comps, k);
  const board = buildBoard(snapshot, fit);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !r.watchlist).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    validation,
    calibration,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
