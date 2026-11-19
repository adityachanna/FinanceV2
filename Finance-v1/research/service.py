"""Read-only serving of evaluated HSMM artifacts and replay snapshots."""
from functools import lru_cache
import hashlib
import json
from pathlib import Path
import numpy as np
import pandas as pd
from scipy.stats import norm
from research.data import DATA, ROOT, FEATURES, load_prices, features, manifest
from research.hsmm import GaussianDurationHSMM, duration_probabilities
from research.train import ARTIFACTS, LABELS, COLORS


def evaluation():
    path = DATA / "evaluation.json"
    if not path.exists():
        return {"status": "not_ready", "message": "Run python -m research.train to complete evaluation", "overall": []}
    return {"status": "complete", **json.loads(path.read_text(encoding="utf-8"))}


def active():
    path = DATA / "active_model.json"
    if not path.exists():
        raise FileNotFoundError("No evaluated HSMM is active. Run python -m research.train.")
    return json.loads(path.read_text(encoding="utf-8"))


@lru_cache(maxsize=4)
def _context(model_file, data_version):
    model, metadata = GaussianDurationHSMM.load(ARTIFACTS / model_file)
    vintage_end = f"{pd.Timestamp(metadata['training_end']).year+1}-12-31"
    frame = features(load_prices()).loc[metadata["training_start"]:vintage_end]
    probabilities, joint = model.filter((frame[FEATURES].to_numpy()-model.center_)/model.scale_)
    return model, metadata, frame, probabilities, joint


def context(as_of=None):
    selected = active()
    data = manifest()
    if as_of:
        date = pd.Timestamp(as_of)
        if date.tzinfo is not None:
            raise ValueError("Use an observation date without a time zone")
        if date > pd.Timestamp(data["last_date"]):
            raise ValueError("Replay date exceeds the latest available observation")
        if date < pd.Timestamp("2007-01-01"):
            raise ValueError("Evaluated replay starts in 2007")
        dates = load_prices().index
        date = dates[dates.searchsorted(date, side="right")-1]
        if date.year < 2007:
            raise ValueError("Select a date on or after the first trading session of 2007")
        maximum = json.loads((DATA / "configuration.json").read_text())["max_duration"]
        filename = f"hsmm_{date.year}_d{maximum}.npz"
    else:
        date = pd.Timestamp(data["last_date"])
        filename = selected["file"]
    model, metadata, frame, probabilities, joint = _context(filename, data["snapshot_id"])
    index = frame.index.searchsorted(date, side="right")-1
    if index < 0 or metadata["training_end"] >= str(frame.index[index].date()):
        raise ValueError("A model trained strictly before the selected date is required")
    return model, metadata, frame, probabilities, joint, index


@lru_cache(maxsize=128)
def _snapshot(as_of, horizon, simulations, data_version):
    model, metadata, frame, probabilities, joint, index = context(as_of)
    observation = frame.iloc[index]
    date = str(frame.index[index].date())
    distribution = probabilities[index]
    state = int(distribution.argmax())
    paths = model.simulate(joint[index], horizon, simulations, seed=int(date.replace("-", "")))
    quantiles = np.quantile(paths, [.05, .25, .5, .75, .95], axis=0)
    terminal = paths[:, -1]
    losses = -terminal
    var = float(np.quantile(losses, .95))
    expected_shortfall = float(losses[losses >= var].mean())
    age_prob = joint[index, state]/distribution[state]
    age = float((age_prob*np.arange(1, model.max_duration+1)).sum())
    changed = float((joint[index]*model._hazards()).sum())
    snapshot_id = hashlib.sha256(f"{metadata['model_id']}:{data_version}:{date}:{horizon}:{simulations}".encode()).hexdigest()[:20]
    output = {"snapshot_id": snapshot_id, "as_of": date, "requested_as_of": as_of,
              "horizon": horizon, "horizon_unit": "trading sessions", "simulations": simulations,
              "source": manifest()["source"], "data_snapshot": data_version,
              "model_id": metadata["model_id"], "training_start": metadata["training_start"],
              "training_end": metadata["training_end"], "model_type": "Explicit-duration Gaussian HSMM",
              "state": {"id": state, "label": LABELS[state], "color": COLORS[state],
                        "probability": float(distribution[state]), "estimated_age": round(age, 1)},
              "states": [{**row, "probability": float(distribution[k])} for k, row in enumerate(metadata["states"])],
              "switch_probability_next_session": changed,
              "market": {"spx": float(observation.spx), "vix": float(observation.vix),
                         "realized_volatility_pct": float(np.exp(observation.log_realized_vol)*100)},
              "risk": {"probability_loss": float((terminal < 0).mean()),
                       "probability_decline_5pct": float((terminal < -.05).mean()),
                       "var_95": var, "expected_shortfall_95": expected_shortfall,
                       "median_return": float(np.median(terminal)), "mean_return": float(terminal.mean())},
              "fan": [{"session": day+1, "p05": float(quantiles[0, day]), "p25": float(quantiles[1, day]),
                       "median": float(quantiles[2, day]), "p75": float(quantiles[3, day]),
                       "p95": float(quantiles[4, day]), "mean": float(paths[:, day].mean())} for day in range(horizon)],
              "notes": ["Probabilities describe this model, not verified classification accuracy.",
                        "Gaussian scenarios can underestimate extreme losses. Compare the evaluation before relying on a range.",
                        "All inputs are completed daily closes; prices exclude dividends."]}
    # Present the simpler reference beside the research model, including its
    # measured performance. This is not a calibration fitted to the final test.
    sigma = float(np.sqrt(frame.log_return.iloc[:index+1].pow(2).ewm(alpha=.06, adjust=False).mean().iloc[-1]*horizon))
    output["reference"] = {"method": "EWMA", "p05": float(np.expm1(norm.ppf(.05)*sigma)),
                           "p95": float(np.expm1(norm.ppf(.95)*sigma))}
    result = evaluation()
    output["historical_evaluation"] = [row for row in result.get("overall", [])
                                        if row["horizon"] == horizon and row["method"] in ["HSMM", "EWMA"]]
    return output


def snapshot(as_of=None, horizon=21, simulations=2000):
    if horizon < 1 or horizon > 120 or simulations < 100 or simulations > 10000:
        raise ValueError("Use horizons 1–120 and simulations 100–10000")
    # Never return the mutable cached object to a caller that adds outcome data.
    return json.loads(json.dumps(_snapshot(as_of, horizon, simulations, manifest()["snapshot_id"])))


def replay(as_of, horizon=21, reveal=False):
    if horizon not in [1, 5, 21]:
        raise ValueError("Evaluated replay horizons are 1, 5 and 21 sessions")
    value = snapshot(as_of, horizon)
    config = json.loads((DATA / "configuration.json").read_text())
    file = DATA / f"forecasts_{pd.Timestamp(value['as_of']).year}_d{config['max_duration']}.csv"
    value["comparisons"] = []
    if file.exists():
        table = pd.read_csv(file)
        selected = table[(table.date == value["as_of"]) & (table.horizon == horizon)]
        for _, row in selected.iterrows():
            item = {"method": row.method, "q05": row.q05, "median": row.q50, "q95": row.q95}
            if reveal:
                item.update({"actual": row.actual, "covered": bool(row.covered)})
            value["comparisons"].append(item)
    if reveal:
        prices = load_prices()
        i = prices.index.get_loc(pd.Timestamp(value["as_of"]))
        if i+horizon < len(prices):
            value["outcome"] = {"date": str(prices.index[i+horizon].date()),
                                "return": float(prices.spx.iloc[i+horizon]/prices.spx.iloc[i]-1),
                                "path": [{"session": day, "return": float(prices.spx.iloc[i+day]/prices.spx.iloc[i]-1)}
                                         for day in range(1, horizon+1)]}
    return value


def condition():
    value = snapshot(horizon=21)
    s = value["state"]
    return {"ticker": "SPX", "date": value["as_of"],
            "regime": {**s, "days_in_regime": s["estimated_age"]}, "confidence": s["probability"],
            "market_data": {"spx_price": value["market"]["spx"], "vix": value["market"]["vix"]},
            "summary": f"{s['label']} is the most probable state. Estimated regime age is {s['estimated_age']} trading sessions.",
            "states": value["states"], "snapshot_id": value["snapshot_id"],
            "model_info": {"type": "Explicit-duration HSMM", "states": 3, "training_start": value["training_start"],
                           "training_end": value["training_end"], "model_id": value["model_id"]}}


def regimes():
    model, metadata = GaussianDurationHSMM.load(ARTIFACTS / active()["file"])
    return {"total_regimes": 3, "model_type": "Explicit-duration Gaussian HSMM", "training_period":
            f"{metadata['training_start']} to {metadata['training_end']}",
            "regimes": [{**row, "state_id": row["id"], "annual_volatility_pct": row["training_volatility_pct"],
                         "avg_duration_days": float(np.dot(np.arange(1, model.max_duration+1),
                                                          duration_probabilities(*model.duration_[k], model.max_duration)))}
                        for k, row in enumerate(metadata["states"])]}


def history(count=90):
    # Concatenate genuinely past-only annual vintages. Do not relabel old dates
    # using a model fitted to a later period.
    maximum = json.loads((DATA / "configuration.json").read_text())["max_duration"]
    files = sorted(DATA.glob(f"filtered_*_d{maximum}.csv"))
    tables = [pd.read_csv(file) for file in files]
    model, metadata, frame, probs, _, _ = context()
    latest = frame[frame.index > pd.Timestamp(metadata["training_end"])].copy()
    p = probs[-len(latest):]
    latest["state"] = p.argmax(axis=1)
    latest["model_id"], latest["training_end"] = metadata["model_id"], metadata["training_end"]
    latest = latest.reset_index()
    latest["date"] = latest["date"].dt.strftime("%Y-%m-%d")
    tables.append(latest)
    rows = pd.concat(tables).drop_duplicates("date", keep="last").sort_values("date").tail(count)
    records = [{"date": str(row.date)[:10], "spx_price": float(row.spx), "vix": float(row.vix),
                "regime_id": int(row.state), "regime_label": LABELS[int(row.state)],
                "regime_color": COLORS[int(row.state)], "model_id": row.model_id} for row in rows.itertuples()]
    return {"days_analyzed": len(records), "observations_returned": len(records), "requested_observations": count,
            "history": records, "states": regimes()["regimes"],
            "date_range": {"start": records[0]["date"], "end": records[-1]["date"]}}
