"""Reproducible development and annual walk-forward evaluation.

Run: python -m research.train
Interrupted runs resume from completed model and forecast files.
"""
import argparse
import hashlib
import json
import platform
from importlib.metadata import version
from pathlib import Path
import numpy as np
import pandas as pd
from scipy.stats import norm
from hmmlearn.hmm import GaussianHMM
from research.data import DATA, FEATURES, ROOT, download, features, manifest
from research.hsmm import GaussianDurationHSMM, initialize_hmm

ARTIFACTS = ROOT / "models" / "research"
SEEDS = [7, 21, 42]
HORIZONS = [1, 5, 21]
LABELS = ["Low volatility", "Elevated volatility", "Stress"]
COLORS = ["#17745e", "#a56b25", "#b84e4e"]


def fit_year(frame, year, maximum, iterations=200):
    path = ARTIFACTS / f"hsmm_{year}_d{maximum}.npz"
    fit_revision = 1
    if path.exists():
        cached, cached_metadata = GaussianDurationHSMM.load(path)
        if not (cached_metadata.get("em_iterations", 0) >= cached_metadata.get("max_iterations", 30)
                and cached_metadata.get("stop_reason", "iteration_limit") == "iteration_limit"):
            return cached, cached_metadata
        fit_revision = cached_metadata.get("fit_revision", 1) + 1
    train = frame.loc[f"{year-10}-01-01":f"{year-1}-12-31"]
    values = train[FEATURES].to_numpy()
    center, scale = values.mean(axis=0), values.std(axis=0)
    x = (values-center)/scale
    models = []
    for seed in SEEDS:
        model = GaussianDurationHSMM(3, maximum, iterations, seed).fit(x).order_states()
        model.center_, model.scale_ = center, scale
        model.return_means_ = model.means_[:, 0]*scale[0]+center[0]
        model.return_stds_ = np.sqrt(model.covars_[:, 0, 0])*scale[0]
        models.append(model)
        print(f"fit {year} D={maximum} seed={seed} likelihood={model.log_likelihood_:.1f} iterations={len(model.history_)}", flush=True)
    model = max(models, key=lambda item: item.log_likelihood_)
    revision = f"-fitv{fit_revision}" if fit_revision > 1 else ""
    metadata = {"model_id": f"hsmm3-{year}-d{maximum}{revision}", "training_start": str(train.index[0].date()),
                "fit_revision": fit_revision,
                "training_end": str(train.index[-1].date()), "features": FEATURES,
                "training_data_hash": hashlib.sha256(train.to_csv().encode()).hexdigest(),
                "source_snapshot": manifest()["snapshot_id"], "python": platform.python_version(),
                "dependencies": {name: version(name) for name in ["numpy", "scipy", "pandas", "scikit-learn", "hmmlearn", "numba"]},
                "seed_likelihoods": {str(m.seed): m.log_likelihood_ for m in models},
                "state_labels": LABELS, "state_colors": COLORS,
                "states": [{"id": k, "label": LABELS[k], "color": COLORS[k],
                            "daily_return_mean": float(model.return_means_[k]),
                            "daily_return_std": float(model.return_stds_[k]),
                            "training_volatility_pct": float(np.exp(model.means_[k, 1]*scale[1]+center[1])*100),
                            "training_vix": float(np.exp(model.means_[k, 2]*scale[2]+center[2]))}
                           for k in range(3)]}
    model.save(path, metadata)
    return GaussianDurationHSMM.load(path)


def hmm_filter(hmm, x):
    log_b = hmm._compute_log_likelihood(x)
    probabilities = np.empty_like(log_b)
    state = hmm.startprob_.copy()
    for t, row in enumerate(log_b):
        if t:
            state = state @ hmm.transmat_
        state *= np.exp(row-row.max())
        state /= state.sum()
        probabilities[t] = state
    return probabilities


def hmm_paths(hmm, probabilities, center, scale, simulations, rng):
    states = rng.choice(3, simulations, p=probabilities)
    paths = np.zeros((simulations, 21))
    for t in range(21):
        previous = states.copy()
        for k in range(3):
            mask = previous == k
            states[mask] = rng.choice(3, mask.sum(), p=hmm.transmat_[k])
        paths[:, t] = rng.normal(hmm.means_[states, 0]*scale[0]+center[0],
                                 np.sqrt(hmm.covars_[states, 0, 0])*scale[0])
    return np.expm1(paths.cumsum(axis=1))


def row_metrics(date, name, horizon, quantiles, p_loss, actual, state, model_id):
    q05, q25, q50, q75, q95 = map(float, quantiles)
    interval = q95-q05 + 20*max(q05-actual, 0) + 20*max(actual-q95, 0)
    error = actual-q05
    return {"date": str(date.date()), "method": name, "horizon": horizon, "model_id": model_id,
            "state": int(state), "actual": float(actual), "q05": q05, "q25": q25, "q50": q50,
            "q75": q75, "q95": q95, "p_loss": float(p_loss), "interval_score": interval,
            "covered": int(q05 <= actual <= q95), "width": q95-q05,
            "quantile_loss": max(.05*error, -.95*error), "breach": int(actual < q05),
            "brier": (p_loss-int(actual < 0))**2}


def evaluate_year(frame, year, maximum, simulations=2000):
    output = DATA / f"forecasts_{year}_d{maximum}.csv"
    history_path = DATA / f"filtered_{year}_d{maximum}.csv"
    model, metadata = fit_year(frame, year, maximum)
    if output.exists() and history_path.exists():
        cached = pd.read_csv(output)
        history = pd.read_csv(history_path)
        if (cached.model_id.eq(metadata["model_id"]).all()
                and history.model_id.eq(metadata["model_id"]).all()):
            return cached
    period = frame.loc[metadata["training_start"]:f"{year}-12-31"]
    train = period.loc[:metadata["training_end"]]
    x = (period[FEATURES].to_numpy()-model.center_)/model.scale_
    probs, joint = model.filter(x)
    candidates = [initialize_hmm(x[:len(train)], seed) for seed in SEEDS]
    hmm = max(candidates, key=lambda item: item.score(x[:len(train)]))
    hmm_probs = hmm_filter(hmm, x)
    full_index = frame.index
    simple_mean, simple_std = train.log_return.mean(), train.log_return.std()
    # EWMA at t includes the return observed at t, forecasts begin at t+1.
    ewma = period.log_return.pow(2).ewm(alpha=.06, adjust=False).mean().to_numpy()
    rows, histories = [], []
    for i in range(len(train), len(period)):
        date = period.index[i]
        global_i = full_index.get_loc(date)
        state = int(probs[i].argmax())
        histories.append({"date": str(date.date()), "spx": float(period.spx.iloc[i]), "vix": float(period.vix.iloc[i]),
                          "state": state, "p0": probs[i, 0], "p1": probs[i, 1], "p2": probs[i, 2],
                          "model_id": metadata["model_id"], "training_end": metadata["training_end"]})
        seed = int(date.strftime("%Y%m%d"))
        paths = {"HSMM": model.simulate(joint[i], simulations=simulations, seed=seed),
                 "HSMM age reset": model.simulate(joint[i], simulations=simulations, seed=seed, reset_age=True),
                 "HMM": hmm_paths(hmm, hmm_probs[i], model.center_, model.scale_, simulations,
                                  np.random.default_rng(seed))}
        for horizon in HORIZONS:
            if global_i+horizon >= len(frame) or frame.index[global_i+horizon].year > 2025:
                continue
            actual = float(frame.spx.iloc[global_i+horizon]/frame.spx.iloc[global_i]-1)
            for name, series in paths.items():
                terminal = series[:, horizon-1]
                rows.append(row_metrics(date, name, horizon, np.quantile(terminal, [.05, .25, .5, .75, .95]),
                                         (terminal < 0).mean(), actual, state, metadata["model_id"]))
            for name, mean, std in [("Gaussian", simple_mean, simple_std), ("EWMA", 0., np.sqrt(ewma[i]))]:
                quantiles = np.expm1(norm.ppf([.05, .25, .5, .75, .95], mean*horizon, std*np.sqrt(horizon)))
                p_loss = norm.cdf(-mean*horizon/(std*np.sqrt(horizon)))
                rows.append(row_metrics(date, name, horizon, quantiles, p_loss, actual, state, metadata["model_id"]))
    result = pd.DataFrame(rows)
    result.to_csv(output, index=False)
    pd.DataFrame(histories).to_csv(history_path, index=False)
    print(f"evaluated {year} D={maximum}, {len(histories)} origins", flush=True)
    return result


def summaries(table):
    result = table.groupby(["method", "horizon"]).agg(
        observations=("covered", "size"), coverage=("covered", "mean"), interval_score=("interval_score", "mean"),
        width=("width", "mean"), quantile_loss=("quantile_loss", "mean"), breach_rate=("breach", "mean"),
        brier=("brier", "mean")).reset_index()
    return result.to_dict("records")


def run(refresh=False):
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    daily = download(refresh=refresh)
    frozen = DATA / "evaluation_prices_1990_2025.csv"
    if not frozen.exists():
        daily.loc[:"2025-12-31"].to_csv(frozen)
    frame = features(pd.read_csv(frozen, index_col="date", parse_dates=True))
    configuration = DATA / "configuration.json"
    if configuration.exists():
        config = json.loads(configuration.read_text())
    else:
        scores = []
        for maximum in [126, 252]:
            development = pd.concat([evaluate_year(frame, year, maximum) for year in range(2000, 2007)])
            # Configuration selection cannot use outcomes from the test period.
            development = development[pd.to_datetime(development.date).map(
                lambda date: frame.index[min(frame.index.get_loc(date)+21, len(frame)-1)].year <= 2006)]
            score = development[development.method == "HSMM"].interval_score.mean()
            scores.append({"max_duration": maximum, "development_interval_score": float(score)})
        config = {"max_duration": min(scores, key=lambda row: row["development_interval_score"])["max_duration"],
                  "development": scores, "features": FEATURES, "seeds": SEEDS, "simulations": 2000,
                  "training_window_years": 10, "development_years": [2000, 2006], "test_years": [2007, 2025],
                  "source_snapshot": manifest()["snapshot_id"], "frozen_at": pd.Timestamp.now(tz="UTC").isoformat()}
        configuration.write_text(json.dumps(config, indent=2), encoding="utf-8")
    maximum = config["max_duration"]
    test = pd.concat([evaluate_year(frame, year, maximum) for year in range(2007, 2026)])
    results = {"run_id": f"walkforward-{config['source_snapshot']}-d{maximum}", "configuration": config,
               "overall": summaries(test),
               "by_state": {LABELS[state]: summaries(test[test.state == state]) for state in range(3)},
               "by_year": {str(year): summaries(test[pd.to_datetime(test.date).dt.year == year]) for year in range(2007, 2026)},
               "non_overlapping": summaries(pd.concat([group.iloc[::int(horizon)]
                    for (_, horizon), group in test.groupby(["method", "horizon"])])),
               "data_verification": manifest()["verification"],
               "limitations": ["Gaussian emissions can underestimate extreme tails.",
                               "Market state probabilities are not classification accuracy.",
                               "Overlapping horizons have dependent forecast errors.",
                               "Revised vendor history is not a vintage point-in-time dataset."]}
    # Paired block bootstrap of interval-score differences preserves local dependence.
    differences = []
    rng = np.random.default_rng(42)
    for horizon in HORIZONS:
        pivot = test[test.horizon == horizon].pivot(index="date", columns="method", values="interval_score")
        for baseline in ["HMM", "EWMA", "Gaussian", "HSMM age reset"]:
            delta = (pivot.HSMM-pivot[baseline]).dropna().to_numpy()
            means = []
            for _ in range(500):
                starts = rng.integers(0, len(delta)-63+1, int(np.ceil(len(delta)/63)))
                sample = np.concatenate([delta[start:start+63] for start in starts])[:len(delta)]
                means.append(sample.mean())
            differences.append({"horizon": horizon, "baseline": baseline, "hsmm_minus_baseline": float(delta.mean()),
                                "block_bootstrap_95": np.quantile(means, [.025, .975]).tolist()})
    results["paired_interval_score"] = differences
    results["evaluation_prices_sha256"] = hashlib.sha256(frozen.read_bytes()).hexdigest()
    results["fit_diagnostics"] = []
    for year in range(2007, 2026):
        metadata = json.loads((ARTIFACTS / f"hsmm_{year}_d{maximum}.json").read_text())
        results["fit_diagnostics"].append({"model_id": metadata["model_id"], "iterations": metadata["em_iterations"],
                                           "iteration_budget_reached": metadata["em_iterations"] >= metadata.get("max_iterations", 30),
                                           "stop_reason": metadata.get("stop_reason", "legacy record; inspected separately")})
    (DATA / "evaluation.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    model, metadata = fit_year(frame, 2026, maximum)
    (DATA / "active_model.json").write_text(json.dumps({"file": f"hsmm_2026_d{maximum}.npz",
        "evaluation_run": results["run_id"], "status": "evaluated research model", "model_id": metadata["model_id"]}), encoding="utf-8")
    print(json.dumps({"run_id": results["run_id"], "overall": results["overall"]}, indent=2), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh-data", action="store_true")
    args = parser.parse_args()
    run(args.refresh_data)
