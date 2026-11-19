"""Compatibility API for the evaluated model, with an explicit legacy switch."""
import os
from pathlib import Path
from research import service


def use_new():
    return os.getenv("REGIME_MODEL_VERSION", "hsmm3") != "legacy"


def get_market_condition():
    if use_new():
        return service.condition()
    import hsmm_api
    result = hsmm_api.get_market_condition()
    result["model_info"]["type"] = "Legacy HMM with duration postprocessing"
    result["summary"] = "Legacy classification. Training-sample averages are not expected future returns."
    result["states"] = [{**row, "id": row["state_id"]} for row in hsmm_api.get_all_regimes()["regimes"]]
    return result


def get_all_regimes():
    if use_new():
        return service.regimes()
    import hsmm_api
    result = hsmm_api.get_all_regimes()
    result["model_type"] = "Legacy HMM with duration postprocessing"
    return result


def get_regime_history(days_back=90):
    if use_new():
        return service.history(days_back)
    import hsmm_api
    return hsmm_api.get_regime_history(days_back)


def get_regime_forecast(horizon_days=21, n_simulations=2000, include_paths=False):
    if not use_new():
        import hsmm_api
        return hsmm_api.get_regime_forecast(horizon_days=horizon_days, n_simulations=n_simulations, include_paths=include_paths)
    value = service.snapshot(horizon=horizon_days, simulations=n_simulations)
    price = value["market"]["spx"]
    last = value["fan"][-1]
    return {"ticker": "SPX", "forecast_date": value["as_of"], "horizon_days": horizon_days,
            "n_simulations": n_simulations, "starting_price": price, "current_regime": value["state"],
            "forecast": {"expected_price": price*(1+value["risk"]["mean_return"]),
                         "expected_return_pct": value["risk"]["mean_return"]*100,
                         "median_price": price*(1+last["median"]), "bull_case_95pct": price*(1+last["p95"]),
                         "bear_case_5pct": price*(1+last["p05"])},
            "model_info": {"type": value["model_type"], "model_id": value["model_id"]},
            "confidence_intervals": {"90_pct": {"lower": price*(1+last["p05"]), "upper": price*(1+last["p95"])},
                                     "50_pct": {"lower": price*(1+last["p25"]), "upper": price*(1+last["p75"])}},
            "mean_path": {"days": [row["session"] for row in value["fan"]],
                          "prices": [price*(1+row["mean"]) for row in value["fan"]]} if include_paths else None,
            "snapshot_id": value["snapshot_id"]}


def get_short_term_prediction(days=5):
    if not use_new():
        import hsmm_api
        return hsmm_api.get_short_term_prediction(days=days)
    value = service.snapshot(horizon=days)
    price = value["market"]["spx"]
    return {"ticker": "SPX", "prediction_date": value["as_of"], "horizon_days": days,
            "daily_predictions": [{"day": row["session"], "expected_price": price*(1+row["mean"]),
                                   "range_low": price*(1+row["p25"]), "range_high": price*(1+row["p75"])} for row in value["fan"]],
            "summary": {"start_price": price, "expected_end_price": price*(1+value["risk"]["mean_return"]),
                        "expected_return_pct": value["risk"]["mean_return"]*100}}
