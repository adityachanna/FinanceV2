"""Daily close snapshots. No forward filling or invented market observations."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import io
import json
import numpy as np
import pandas as pd
import requests
import yfinance as yf

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "research"
FEATURES = ["log_return", "log_realized_vol", "log_vix"]
CBOE_URL = "https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv"


def features(prices):
    frame = prices.copy().sort_index()
    if frame.index.has_duplicates or not frame.index.is_monotonic_increasing:
        raise ValueError("Market dates must be unique and sorted")
    frame["log_return"] = np.log(frame.spx).diff()
    frame["log_realized_vol"] = np.log(frame.log_return.rolling(21).std() * np.sqrt(252))
    frame["log_vix"] = np.log(frame.vix)
    return frame.replace([np.inf, -np.inf], np.nan).dropna()


def download(refresh=False):
    DATA.mkdir(parents=True, exist_ok=True)
    path = DATA / "daily.csv"
    if path.exists() and not refresh:
        return load_prices()
    # Exclude the current New York session even when the program runs before close.
    today = pd.Timestamp.now(tz="America/New_York").date().isoformat()
    raw = yf.download(["^GSPC", "^VIX"], start="1990-01-01", end=today,
                      auto_adjust=False, progress=False, threads=False)
    close = raw["Close"]
    frame = close.rename(columns={"^GSPC": "spx", "^VIX": "vix"})[["spx", "vix"]]
    frame.index = pd.to_datetime(frame.index).tz_localize(None)
    frame = frame.dropna()
    if len(frame) < 7000 or (frame <= 0).any().any():
        raise ValueError("Incomplete market download; existing snapshot was not replaced")
    # Independent source check, stored with the snapshot rather than guessed from events.
    response = requests.get(CBOE_URL, timeout=45)
    response.raise_for_status()
    official = pd.read_csv(io.StringIO(response.text))
    official.index = pd.to_datetime(official["DATE"], format="%m/%d/%Y")
    check = frame.join(official["CLOSE"].rename("cboe_vix")).dropna()
    differences = (check.vix - check.cboe_vix).abs()
    verification = {
        "source": CBOE_URL, "matched_observations": len(check),
        "max_absolute_difference": float(differences.max()),
        "within_0_05_fraction": float((differences <= .05).mean()),
        "differences_over_0_05": {str(date.date()): float(value) for date, value in differences[differences > .05].items()},
        "examples": {date: {"yahoo": float(check.loc[date, "vix"]),
                             "cboe": float(check.loc[date, "cboe_vix"])}
                     for date in ["2008-11-20", "2020-03-16", "2022-03-07"] if date in check.index},
    }
    if len(check) < 1000 or verification["within_0_05_fraction"] < .99:
        raise ValueError("Yahoo/Cboe VIX cross-check failed; inspect provider data")
    # Use the exchange's close where providers disagree. Drop dates without an
    # exchange observation, rather than carrying a prior day's VIX forward.
    frame = check[["spx", "cboe_vix"]].rename(columns={"cboe_vix": "vix"})
    try:
        fred_response = requests.get("https://fred.stlouisfed.org/graph/fredgraph.csv",
                                     params={"id": "SP500"}, timeout=45)
        fred_response.raise_for_status()
        fred = pd.read_csv(io.StringIO(fred_response.text), index_col=0, parse_dates=True)
        fred["SP500"] = pd.to_numeric(fred.SP500, errors="coerce")
        compared = frame.join(fred.SP500).dropna()
        gap = (compared.spx-compared.SP500).abs()
        verification["spx_fred"] = {"source": "https://fred.stlouisfed.org/series/SP500",
                                    "observations": len(gap), "max_absolute_difference": float(gap.max()),
                                    "within_0_1_fraction": float((gap < .1).mean())}
        if len(gap) < 100 or (gap < .1).mean() < .99:
            raise ValueError("Yahoo/FRED S&P 500 cross-check failed")
    except requests.RequestException as error:
        verification["spx_fred"] = {"status": "unavailable", "error": str(error)}
    frame.index.name = "date"
    payload = frame.to_csv(float_format="%.8f").encode()
    path.write_bytes(payload)
    manifest = {"snapshot_id": hashlib.sha256(payload).hexdigest()[:16],
                "retrieved_at": datetime.now(timezone.utc).isoformat(),
                "first_date": str(frame.index[0].date()), "last_date": str(frame.index[-1].date()),
                "observations": len(frame), "source": "Yahoo Finance S&P 500 and Cboe VIX daily close",
                "return_convention": "S&P 500 price index, excludes dividends",
                "features": FEATURES, "verification": verification}
    (DATA / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return frame


def load_prices():
    path = DATA / "daily.csv"
    if not path.exists():
        raise FileNotFoundError("Run python -m research.train first to download market data")
    return pd.read_csv(path, index_col="date", parse_dates=True)


def manifest():
    return json.loads((DATA / "manifest.json").read_text(encoding="utf-8"))


if __name__ == "__main__":
    download(refresh=True)
    print(json.dumps(manifest(), indent=2))
