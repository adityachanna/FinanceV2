"""Generate the figures and derived numbers used in the AlphaSharp HSMM paper.

Run from the paper directory:  python figures/make_figures.py

Inputs are read-only artifacts produced by Finance-v1/research/train.py:
  Finance-v1/data/research/{evaluation.json, evaluation_prices_1990_2025.csv,
                            filtered_YYYY_d252.csv}
  Finance-v1/models/research/hsmm_YYYY_d252.{json,npz}

The forward filter and scenario simulator are re-implemented here with NumPy
so that the script does not import (or write caches into) the application
package. verify() checks the re-implementation against the saved filtered
probabilities and forecast quantiles before any figure is drawn.
"""
import json
from pathlib import Path

import matplotlib
matplotlib.use("pdf")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.lines import Line2D
from matplotlib.patches import Patch
import numpy as np
import pandas as pd
from scipy.special import logsumexp
from scipy.stats import nbinom, norm

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1] / "Finance-v1"
DATA = ROOT / "data" / "research"
MODELS = ROOT / "models" / "research"
OUT = HERE
FEATURES = ["log_return", "log_realized_vol", "log_vix"]
D = 252

LABELS = ["Low volatility", "Elevated volatility", "Stress"]
STATE_COLORS = ["#17745e", "#a56b25", "#b23a3a"]
STATE_STYLES = ["-", "--", ":"]
INK, MUTED, GRID = "#1b1b1b", "#5a5a5a", "#d9d9d9"
FAN = "#2f4b7c"

COL = 3.5  # IEEE single-column width in inches
plt.rcParams.update({
    "font.family": "serif",
    "font.serif": ["Times New Roman", "Times", "DejaVu Serif"],
    "mathtext.fontset": "stix",
    "font.size": 8, "axes.labelsize": 8, "axes.titlesize": 8,
    "xtick.labelsize": 7, "ytick.labelsize": 7, "legend.fontsize": 7,
    "axes.linewidth": 0.6, "xtick.major.width": 0.6, "ytick.major.width": 0.6,
    "xtick.major.size": 2.5, "ytick.major.size": 2.5,
    "axes.edgecolor": INK, "axes.labelcolor": INK, "text.color": INK,
    "xtick.color": INK, "ytick.color": INK,
    "axes.spines.top": False, "axes.spines.right": False,
    "legend.frameon": False, "pdf.fonttype": 42, "savefig.bbox": "tight",
    "savefig.pad_inches": 0.02,
})


# ---------------------------------------------------------------- model code
def features(prices):
    frame = prices.copy().sort_index()
    frame["log_return"] = np.log(frame.spx).diff()
    frame["log_realized_vol"] = np.log(frame.log_return.rolling(21).std() * np.sqrt(252))
    frame["log_vix"] = np.log(frame.vix)
    return frame.replace([np.inf, -np.inf], np.nan).dropna()


def duration_pmf(mean_excess, dispersion, maximum=D):
    log_pmf = nbinom.logpmf(np.arange(maximum), dispersion, dispersion / (dispersion + mean_excess))
    return np.exp(log_pmf - logsumexp(log_pmf))


def duration_hazard(mean_excess, dispersion, maximum=D):
    pmf = duration_pmf(mean_excess, dispersion, maximum)
    survival = np.cumsum(pmf[::-1])[::-1]
    hazard = pmf / np.maximum(survival, 1e-300)
    hazard[-1] = 1.0
    return hazard


def load_model(year):
    meta = json.loads((MODELS / f"hsmm_{year}_d{D}.json").read_text())
    with np.load(MODELS / f"hsmm_{year}_d{D}.npz", allow_pickle=False) as z:
        model = {k: z[k] for k in z.files}
    model["hazard"] = np.array([duration_hazard(*row) for row in model["duration"]])
    return model, meta


def log_emissions(model, x):
    out = np.empty((len(x), len(model["means"])))
    for k, (mu, cov) in enumerate(zip(model["means"], model["covars"])):
        chol = np.linalg.cholesky(cov)
        w = np.linalg.solve(chol, (x - mu).T).T
        out[:, k] = -0.5 * (x.shape[1] * np.log(2 * np.pi) + 2 * np.log(np.diag(chol)).sum() + (w ** 2).sum(1))
    return out


def forward(model, x):
    """Scaled forward recursion over (state, age); returns joint filtered probabilities."""
    logs = log_emissions(model, x)
    em = np.exp(logs - logs.max(1, keepdims=True))
    h, A = model["hazard"], model["transition"]
    alpha = np.zeros((len(x), *h.shape))
    a = model["initial"] * em[0][:, None]
    alpha[0] = a / a.sum()
    for t in range(1, len(x)):
        prev = alpha[t - 1]
        new = np.zeros_like(prev)
        new[:, 0] = (prev * h).sum(1) @ A
        new[:, 1:] = prev[:, :-1] * (1 - h[:, :-1])
        new *= em[t][:, None]
        alpha[t] = new / new.sum()
    return alpha


def simulate(model, joint, horizon=21, simulations=2000, seed=42):
    """Same random-number sequence as GaussianDurationHSMM.simulate."""
    rng = np.random.default_rng(seed)
    ids = rng.choice(joint.size, simulations, p=(joint / joint.sum()).ravel())
    states, ages = np.divmod(ids, D)
    paths = np.zeros((simulations, horizon))
    for t in range(horizon):
        leaving = rng.random(simulations) < model["hazard"][states, ages]
        previous = states.copy()
        for k in range(3):
            sel = leaving & (previous == k)
            states[sel] = rng.choice(3, sel.sum(), p=model["transition"][k])
        ages = np.where(leaving, 0, np.minimum(ages + 1, D - 1))
        paths[:, t] = rng.normal(model["return_means"][states], model["return_stds"][states])
    return np.expm1(np.cumsum(paths, axis=1))


def frame():
    prices = pd.read_csv(DATA / "evaluation_prices_1990_2025.csv", index_col="date", parse_dates=True)
    return features(prices)


def vintage(fr, year):
    model, meta = load_model(year)
    period = fr.loc[meta["training_start"]:f"{year}-12-31"]
    x = (period[FEATURES].to_numpy() - model["center"]) / model["scale"]
    return model, meta, period, forward(model, x)


# ---------------------------------------------------------------- checks
def verify(fr):
    report = {}
    for year in (2008, 2020):
        model, meta, period, alpha = vintage(fr, year)
        saved = pd.read_csv(DATA / f"filtered_{year}_d{D}.csv")
        idx = period.index.get_indexer(pd.to_datetime(saved.date))
        probs = alpha.sum(2)[idx]
        report[f"max_abs_prob_diff_{year}"] = float(np.abs(probs - saved[["p0", "p1", "p2"]].to_numpy()).max())
        fc = pd.read_csv(DATA / f"forecasts_{year}_d{D}.csv")
        diffs = []
        for date in saved.date.iloc[::50]:
            i = period.index.get_loc(pd.Timestamp(date))
            paths = simulate(model, alpha[i], seed=int(date.replace("-", "")))
            for hzn in (1, 5, 21):
                row = fc[(fc.date == date) & (fc.method == "HSMM") & (fc.horizon == hzn)]
                if len(row):
                    q = np.quantile(paths[:, hzn - 1], [.05, .95])
                    diffs.append(np.abs(q - row[["q05", "q95"]].to_numpy()[0]).max())
        report[f"max_abs_quantile_diff_{year}"] = float(max(diffs))
    return report


# ---------------------------------------------------------------- figures
def shade_states(ax, dates, states, alphas=(0.16, 0.22, 0.30)):
    change = np.flatnonzero(np.diff(states)) + 1
    starts = np.r_[0, change]
    ends = np.r_[change, len(states)]
    for s, e in zip(starts, ends):
        right = dates[e] if e < len(dates) else dates[-1]
        k = states[s]
        ax.axvspan(dates[s], right, color=STATE_COLORS[k], alpha=alphas[k], lw=0)


def fig_regimes(fr):
    files = [DATA / f"filtered_{y}_d{D}.csv" for y in range(2007, 2026)]
    hist = pd.concat([pd.read_csv(f) for f in files])
    hist["date"] = pd.to_datetime(hist.date)
    dates, states = hist.date.to_numpy(), hist.state.to_numpy()
    fig, (a1, a2) = plt.subplots(2, 1, figsize=(7.16, 2.9), sharex=True,
                                 gridspec_kw={"height_ratios": [1.6, 1], "hspace": 0.08})
    for ax in (a1, a2):
        shade_states(ax, dates, states)
    a1.plot(dates, hist.spx, color=INK, lw=0.7)
    a1.set_yscale("log")
    a1.set_yticks([750, 1000, 1500, 2000, 3000, 4000, 6000])
    a1.get_yaxis().set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: f"{v:,.0f}"))
    a1.yaxis.set_minor_locator(matplotlib.ticker.NullLocator())
    a1.set_ylabel("S&P 500 (log scale)")
    a2.plot(dates, hist.vix, color=INK, lw=0.6)
    a2.set_ylabel("VIX")
    a2.set_ylim(0, 90)
    a2.xaxis.set_major_locator(mdates.YearLocator(2))
    a2.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
    a2.set_xlim(dates[0], dates[-1])
    handles = [Patch(color=c, alpha=a, lw=0, label=l)
               for c, a, l in zip(STATE_COLORS, (0.16, 0.22, 0.30), LABELS)]
    a1.legend(handles=handles, loc="upper left", ncol=3, handlelength=1.2, columnspacing=1.0)
    fig.savefig(OUT / "fig_regimes.pdf")
    plt.close(fig)
    counts = hist.state.value_counts().sort_index()
    runs = int((np.diff(states) != 0).sum())
    return {"filtered_sessions": int(len(hist)), "state_counts": counts.tolist(),
            "state_share": (counts / len(hist)).round(4).tolist(), "label_switches": runs,
            "first_date": str(hist.date.min().date()), "last_date": str(hist.date.max().date())}


def fig_durations():
    model, meta = load_model(2026)
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(COL, 1.75), gridspec_kw={"wspace": 0.45})
    d = np.arange(1, D + 1)
    summary = []
    for k in range(3):
        pmf = duration_pmf(*model["duration"][k])
        survival = np.cumsum(pmf[::-1])[::-1]  # P(D >= d)
        style = dict(color=STATE_COLORS[k], ls=STATE_STYLES[k], lw=1.1, label=LABELS[k])
        a1.plot(d[:63], pmf[:63], **style)
        a2.plot(d, survival, **style)
        mean = float((d * pmf).sum())
        cdf = np.cumsum(pmf)
        summary.append({"state": LABELS[k], "mean_excess": float(model["duration"][k, 0]),
                        "dispersion": float(model["duration"][k, 1]), "mean_duration": mean,
                        "median_duration": int(d[np.searchsorted(cdf, 0.5)]),
                        "p_exceed_63": float(1 - cdf[62]),
                        "daily_return_mean": meta["states"][k]["daily_return_mean"],
                        "daily_return_std": meta["states"][k]["daily_return_std"],
                        "training_volatility_pct": meta["states"][k]["training_volatility_pct"],
                        "training_vix": meta["states"][k]["training_vix"]})
    a1.set_xlim(1, 63)
    a1.set_xticks([1, 21, 42, 63])
    a1.set_ylim(0, 0.08)
    a1.set_ylabel("$p_k(d)$")
    a1.annotate(f"Stress: $p(1)={duration_pmf(*model['duration'][2])[0]:.2f}$", xy=(1.5, 0.079),
                xytext=(14, 0.07), fontsize=6.5, color=MUTED,
                arrowprops=dict(arrowstyle="->", lw=0.5, color=MUTED))
    a2.set_yscale("log")
    a2.set_ylim(1e-4, 1.2)
    a2.set_xlim(1, D)
    a2.set_xticks([1, 63, 126, 189, 252])
    a2.set_ylabel("$P(D_k \geq d)$")
    for ax in (a1, a2):
        ax.set_xlabel("Duration $d$ (sessions)")
    fig.legend(*a1.get_legend_handles_labels(), loc="upper center", ncol=3, bbox_to_anchor=(0.5, 1.08),
               handlelength=2.2, columnspacing=1.0)
    fig.savefig(OUT / "fig_durations.pdf")
    plt.close(fig)
    return {"model_id": meta["model_id"], "transition": model["transition"].round(4).tolist(),
            "stress_p1": float(duration_pmf(*model["duration"][2])[0]), "states": summary}


METHODS = ["HSMM", "HSMM age reset", "HMM", "EWMA", "Gaussian"]
METHOD_STYLE = {
    "HSMM": dict(color="#1f2a44", marker="o"),
    "HSMM age reset": dict(color="#6b7fa8", marker="D"),
    "HMM": dict(color="#7a7a7a", marker="s"),
    "EWMA": dict(color="#c47f17", marker="^"),
    "Gaussian": dict(color="#9b9b9b", marker="v"),
}


def fig_scores():
    ev = json.loads((DATA / "evaluation.json").read_text())
    tab = pd.DataFrame(ev["overall"])
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(COL, 1.85), gridspec_kw={"wspace": 0.55})
    horizons = [1, 5, 21]
    xpos = np.arange(3)
    offsets = np.linspace(-0.24, 0.24, len(METHODS))
    for off, m in zip(offsets, METHODS):
        rows = tab[tab.method == m].set_index("horizon").loc[horizons]
        ref = tab[tab.method == "HSMM"].set_index("horizon").loc[horizons]
        st = METHOD_STYLE[m]
        a1.plot(xpos + off, rows.interval_score / ref.interval_score, ls="none", ms=3.6,
                mec="white", mew=0.4, label=m, **st)
        a2.plot(xpos + off, 100 * rows.coverage, ls="none", ms=3.6, mec="white", mew=0.4, **st)
    a1.axhline(1, color=MUTED, lw=0.5, ls="--")
    a2.axhline(90, color=MUTED, lw=0.5, ls="--")
    for ax in (a1, a2):
        ax.set_xticks(xpos, [str(h) for h in horizons])
        ax.set_xlabel("Horizon (sessions)")
        ax.set_xlim(-0.5, 2.5)
        ax.yaxis.grid(True, color=GRID, lw=0.4)
        ax.set_axisbelow(True)
    a1.set_ylabel("Interval score / HSMM")
    a2.set_ylabel("90% interval coverage (%)")
    a2.set_ylim(87, 96)
    fig.legend(*a1.get_legend_handles_labels(), loc="upper center", ncol=5, bbox_to_anchor=(0.5, 1.07),
               handletextpad=0.1, columnspacing=0.7, fontsize=6.5)
    fig.savefig(OUT / "fig_scores.pdf")
    plt.close(fig)


def fig_fans(fr):
    cases = [(2008, "2008-09-12"), (2020, "2020-02-21")]
    fig, axes = plt.subplots(2, 1, figsize=(COL, 3.5), gridspec_kw={"hspace": 0.62, "top": 0.9})
    out = []
    for ax, (year, date) in zip(axes, cases):
        model, meta, period, alpha = vintage(fr, year)
        i = period.index.get_loc(pd.Timestamp(date))
        paths = simulate(model, alpha[i], seed=int(date.replace("-", "")))
        q = np.quantile(paths, [.05, .25, .5, .75, .95], axis=0)
        g = fr.index.get_loc(pd.Timestamp(date))
        realized = fr.spx.iloc[g + 1:g + 22].to_numpy() / fr.spx.iloc[g] - 1
        ewma = period.log_return.iloc[:i + 1].pow(2).ewm(alpha=.06, adjust=False).mean().iloc[-1]
        h = np.arange(1, 22)
        e05, e95 = (np.expm1(norm.ppf(p) * np.sqrt(ewma * h)) for p in (.05, .95))
        hh = np.r_[0, h]
        z = lambda v: np.r_[0, v]
        ax.fill_between(hh, 100 * z(q[0]), 100 * z(q[4]), color=FAN, alpha=0.16, lw=0, label="HSMM 5–95%")
        ax.fill_between(hh, 100 * z(q[1]), 100 * z(q[3]), color=FAN, alpha=0.32, lw=0, label="HSMM 25–75%")
        ax.plot(hh, 100 * z(q[2]), color=FAN, lw=0.9, label="HSMM median")
        ax.plot(hh, 100 * z(e05), color=METHOD_STYLE["EWMA"]["color"], lw=0.8, ls="--", label="EWMA 5/95%")
        ax.plot(hh, 100 * z(e95), color=METHOD_STYLE["EWMA"]["color"], lw=0.8, ls="--")
        ax.plot(hh, 100 * z(realized), color=INK, lw=1.1, marker="o", ms=1.8, label="Realized")
        ax.axhline(0, color=MUTED, lw=0.4)
        probs = alpha[i].sum(1)
        k = int(probs.argmax())
        ax.set_title(f"Origin {pd.Timestamp(date):%d %b %Y} ({meta['model_id']}); "
                     f"P({LABELS[k]}) = {probs[k]:.2f}", loc="left", fontsize=7.5)
        ax.set_xlim(0, 21)
        ax.set_xticks([0, 1, 5, 10, 15, 21])
        ax.set_xlabel("Sessions after origin")
        ax.set_ylabel("Cumulative return (%)")
        ax.yaxis.grid(True, color=GRID, lw=0.4)
        ax.set_axisbelow(True)
        age = float((alpha[i, k] / probs[k] * np.arange(1, D + 1)).sum())
        out.append({"date": date, "model_id": meta["model_id"], "state": LABELS[k], "prob": float(probs[k]),
                    "expected_age": age, "q05_21": float(q[0, -1]), "q50_21": float(q[2, -1]),
                    "q95_21": float(q[4, -1]), "ewma_q05_21": float(e05[-1]), "ewma_q95_21": float(e95[-1]),
                    "realized_21": float(realized[-1]), "realized_min": float(realized.min()),
                    "realized_end_date": str(fr.index[g + 21].date())})
    fig.legend(*axes[0].get_legend_handles_labels(), loc="upper center", ncol=3, bbox_to_anchor=(0.5, 1.035),
               fontsize=6.5, handlelength=1.6, columnspacing=0.8)
    fig.savefig(OUT / "fig_fans.pdf")
    plt.close(fig)
    return out


def main():
    fr = frame()
    numbers = {"verification": verify(fr)}
    print("verification", numbers["verification"])
    numbers["regimes"] = fig_regimes(fr)
    numbers["durations"] = fig_durations()
    fig_scores()
    numbers["fans"] = fig_fans(fr)
    numbers["evaluation_rows"] = int(len(fr.loc["2007":"2025"]))
    (OUT / "derived_numbers.json").write_text(json.dumps(numbers, indent=2))
    print(json.dumps(numbers, indent=2))


if __name__ == "__main__":
    main()
