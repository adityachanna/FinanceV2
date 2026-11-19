# AlphaSharp

AlphaSharp studies S&P 500 market regimes and loss scenarios. It combines a three-state explicit-duration Hidden Semi-Markov Model (HSMM), historical replay, measured forecast comparisons, company research and a browser-local portfolio. It answers questions like "What is Apple's valuation?" with or without an AI key.

The research paper is in [`paper/`](paper/) and as a PDF in [`output/research/`](output/research/).

## Run it (no technical knowledge needed)

### Windows

1. On this page, click the green **Code** button, then **Download ZIP**.
2. Right-click the downloaded ZIP, choose **Extract All**, and open the extracted folder.
3. Double-click **`Start AlphaSharp.bat`**. If Windows shows "Windows protected your PC", click **More info**, then **Run anyway**.
4. Wait. The first run installs Python, Node.js and the app's packages. That takes 5–15 minutes and may ask for permission to install. Later runs start in under a minute.
5. Your browser opens **http://127.0.0.1:5173**. Create a local profile (it stays on your computer) and start exploring.

To stop AlphaSharp, press **Enter** in the black window, or double-click **`Stop AlphaSharp.bat`**.

### macOS or Linux

Install [Python 3.13](https://www.python.org/downloads/) and [Node.js LTS](https://nodejs.org/), then open a terminal in the folder and run:

```bash
./start-mac-linux.sh
```

Press **Ctrl+C** in that terminal to stop.

### AI answers are optional

Without a key, the **built-in analyst** answers from data. It reports valuation multiples with peer comparison, financials, price performance and the model's current market risk. Every figure comes straight from Yahoo Finance or the HSMM; no language model writes it.

To turn on AI-written answers, get a key from [OpenRouter](https://openrouter.ai/keys), open the `.env` file in the AlphaSharp folder with Notepad, paste the key after `OPENROUTER_API_KEY=`, save, and restart AlphaSharp. If the AI provider fails or runs out of credit, the built-in analyst answers instead. Keys stay in `.env`, which is never uploaded to GitHub.

### If something goes wrong

- **A window flashes and closes:** right-click `Start AlphaSharp.bat` and choose **Run as administrator** once.
- **"Port is already listening":** AlphaSharp is already running. Open http://127.0.0.1:5173.
- **A page shows no data:** check your internet connection. Market data comes from Yahoo Finance.
- Logs are in the `.local-logs` folder. Send them along when asking for help.

## Developer setup

Use Node.js 20+ and Python 3.12–3.14. The one-click launcher was tested from a clean folder with Python 3.12 and Node 26; development also used Python 3.14 and Node 22. LangChain emits a Pydantic compatibility warning on Python 3.14.

From the folder containing this README:

```powershell
python -m pip install -r .\Finance-v1\requirements.txt
npm ci --prefix .\AlphaSharp\backend
npm ci --prefix .\AlphaSharp\frontend
```

An isolated Python virtual environment is optional. Activate it before installing and starting Python if you use one.

The trained model and evaluation are already present in this workspace. To reproduce them or prepare a fresh checkout:

```powershell
cd .\Finance-v1
python -m research.train
cd ..
```

Training downloads market data when needed, selects the duration cap on development data, and evaluates annual model vintages. It can take several minutes. Completed artifacts and forecast files are reused after an interruption. Keep the frozen evaluation data and configuration together with their generated results.

Start all three services:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-local.ps1
```

Open **http://127.0.0.1:5173**. Logs are in `.local-logs`. The launcher skips ports that already have a running service. After code or environment changes, restart the affected service. `stop-local.ps1` stops only processes recorded by the launcher.

For separate terminals, run these from the top folder:

```powershell
cd .\Finance-v1
python -m uvicorn combined_api:app --host 127.0.0.1 --port 4000
```

```powershell
cd .\AlphaSharp\backend
npm start
```

```powershell
cd .\AlphaSharp\frontend
npm run dev -- --host 127.0.0.1
```

## Use the workspace

- **Public market explorer** opens without a profile. The illustrated homepage includes cross-asset prices, an interactive S&P 500/VIX history chart and a scenario exposure calculator connected to the Python model.
- **Overview** shows the latest completed observation, state probability, historical classifications, Macro Pulse and saved companies.
- **Risk lab / Scenarios** shows 1, 5 and 21-session return ranges, loss probabilities, 95% value at risk and expected shortfall. An exposure amount translates percentages into USD. The model applies to S&P 500 exposure, not an arbitrary stock portfolio.
- **Historical replay** loads the model trained before the chosen date. Future outcomes stay hidden until Reveal outcome is selected. Presets cover the financial crisis, COVID and 2022 tightening. JSON exports include the snapshot and model identifiers.
- **Model evaluation** compares the HSMM with a matched HMM, Gaussian returns, EWMA and an HSMM that resets regime age. It shows interval scores, coverage, widths, tail breaches, Brier scores, state-level results and block-bootstrap comparisons.
- **Explore stocks** loads company metrics, daily price history and news independently. AI explanations run only when requested.

Company news uses `yfinance.Search` rather than the retired Yahoo ticker-news endpoint. It falls back to Yahoo RSS, normalizes article links and UTC publication dates, and removes duplicate or invalid entries. The company page distinguishes loading, a successful empty feed and a provider error, with a Refresh news action. Express caches only nonempty feeds, separates cache entries by requested article count and supports an explicit refresh. No additional API key is required for news.
- **Portfolio** tracks USD positions, current quotes, weights and cost-based unrealized P/L. There is no invented historical performance chart. Quotes may be delayed; P/L excludes dividends, taxes and fees.
- **AI assistant** can retrieve company financials, observed stock returns and the same market-risk snapshot used by the interface.

The local email/password page creates a browser profile. It does not create an online account or protect the public API. Signing out removes the origin's local and session storage, including credentials, watchlist and positions. The next visit creates a fresh profile.

## Frontend design and interaction

The homepage takes its layout direction from [Groww](https://groww.in/): generous white space, large centered type, an illustrated financial landscape and direct, useful controls. The SVG artwork is original, and the AlphaSharp mark is shared across the page and workspace. Manrope headings, DM Sans body text, mint surfaces, graphite type and restrained lilac details keep the product light and consistent. The hero illustration is decorative; it does not display a quote feed.

The public market preview, authenticated overview and company research share the same price-chart implementation. Select 1M, 3M, 6M, 1Y or 2Y within the available history; hover to inspect an observation; use the session slider with the mouse or keyboard; or replay the observed prices chronologically. Replay is historical playback, not simulated live trading. Use Latest to restore the full series. Market charts also support S&P 500/VIX switching and regime shading. Company charts show the company's own prices without S&P 500 regime overlays. VIX and the S&P 500 use separate views to avoid mixing incompatible units on one scale.

The exposure calculator supports $1,000–$100,000 and 1, 5 or 21 trading sessions. Its number field and slider stay synchronized. Adjusting exposure scales the model's return distribution into USD; changing the horizon requests the corresponding Python snapshot. This calculation represents S&P 500 exposure, not the risk of a custom stock portfolio. The model's 5th and 95th percentile terminal values, loss probability and 95% value at risk remain labeled as estimates.

The homepage refreshes market observations and cross-asset prices every 60 seconds while active. Sources remain daily observations or provider-delayed prices; the animation does not invent price changes. Motion includes a short chart reveal, subtle illustrative data connections and user-triggered playback. Reduced-motion preferences disable automatic decorative animation. Chart controls remain keyboard accessible, and layouts adapt to mobile and tablet screens.

Frontend changes are in `AlphaSharp/frontend/src/pages/HomePage.jsx`, `components/home/`, `components/dashboard/SignalCanvas.jsx`, `components/charts/RegimeHistoryChart.jsx`, `components/layout/Navbar.jsx` and `styles/landing.css`. The existing Python model, training windows, OpenRouter configuration and local profile behavior are retained. No additional runtime dependencies or environment variables are required for this redesign.

## Model and data

The new model has three volatility states: Low volatility, Elevated volatility and Stress. Their labels and colors come from model metadata. Daily features are S&P 500 log return, log 21-session realized volatility and log VIX. The model uses regularized Gaussian emissions and shifted negative-binomial durations. Duration probabilities participate in training and filtering. It is not an HMM followed by a smoothing rule.

Filtering retains a joint probability over state and elapsed age. It uses only observations available at the selected time. Scenarios condition remaining duration on elapsed age. Initial age is integrated over a fixed survival-weighted prior, and the final training segment is right-censored.

The active 2026 model was trained on 2016–2025 observations. A snapshot is identified by its observation date, data version, model version and forecast horizon. Daily closes exclude dividends. State probabilities are model probabilities, not measured classification accuracy.

Data is in `Finance-v1/data/research`. S&P 500 closes come from Yahoo Finance. VIX closes use [Cboe's published history](https://www.cboe.com/tradable-products/vix/vix-historical-data). The data manifest records discrepancies between Yahoo and Cboe. S&P 500 observations were also compared against [FRED](https://fred.stlouisfed.org/series/SP500). Missing observations are not forward-filled.

To fetch newly completed closes:

```powershell
cd .\Finance-v1
python -m research.data
```

Refresh the page afterward. Snapshot caches use the data-version identifier. Refreshing prices does not retrain the model or change the frozen 1990–2025 evaluation file. The current production artifact is a 2026 vintage; a future annual rollout needs a newly trained and evaluated vintage.

The original model remains available for rollback with `REGIME_MODEL_VERSION=legacy`. It is described accurately as an HMM with duration postprocessing. The default is `hsmm3`.

## What the evaluation found

Development years are 2000–2006. Final evaluation years are 2007–2025. Each annual fit uses the preceding ten years, with preprocessing fitted on that training window. Three initialization seeds are evaluated. The selected duration cap is 252 sessions. Forecasts use 2,000 simulated paths and fixed seeds. The final period was not used to select the duration cap.

| Horizon | HSMM 90% range coverage | HSMM interval score | HMM interval score | EWMA interval score |
| --- | --- | --- | --- | --- |
| 1 session | 89.64% | 0.05186 | 0.05178 | 0.04784 |
| 5 sessions | 91.75% | 0.10567 | 0.10553 | 0.09848 |
| 21 sessions | 92.75% | 0.21161 | 0.21086 | 0.20088 |

Lower interval scores are better. The HSMM did not beat the matched HMM or EWMA in this run. It is a regime-research model, not evidence of superior forecasting. Gaussian emissions can miss extreme tails. Overlapping horizons produce dependent errors; the exported results include non-overlapping comparisons and paired 63-session block-bootstrap intervals. Market history is revised vendor data, not a historical archive of what each provider published at the time.

The training-window audit checks all 27 annual models for 2000–2026. Each has 2,503–2,523 training observations; for example, the 2007 model uses 1997–2006 and the active 2026 model uses 2016–2025. Features and scaling use training data only. Later yearly fits may use previous evaluation years once those observations have occurred. Forecasts are issued after the daily close, with outcomes starting at the next session. Ten years is a fixed rolling-window choice, not an empirically established optimum.

An audit found the original 2013 fit still improving at its 30-iteration limit. The budget is now 200; that fit reached the likelihood tolerance after 49 recorded iterations, using the same data, seeds, duration setting and features. Its forecasts and aggregate metrics were regenerated. The previous artifacts remain in `Finance-v1/data/research/audit_previous_fit/`. This is a documented numerical correction after inspecting evaluation results, not a new untouched holdout. All selected annual models now satisfy the recorded likelihood tolerance and pass chronology, preprocessing, covariance and forecast-target checks. Convergence does not establish predictive skill. Run `python -m research.audit` from `Finance-v1` to regenerate `data/research/training_audit.json`.

The model identifies Stress on 20 November 2008, 16 March 2020 and 7 March 2022, and Low volatility on 3 July 2017. These are sanity checks against observed VIX, not ground-truth regime labels.

## Configuration

Copy an example file only when changing defaults. Keep existing `.env` files and keys private.

| File | Settings |
| --- | --- |
| `.env` (top folder, created by the launcher) or `Finance-v1/.env` | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, optional `OPENROUTER_SITE_URL`, `OPENROUTER_SITE_NAME`, `TAVILY_API_KEY`, `REGIME_MODEL_VERSION=hsmm3` |
| `AlphaSharp/backend/.env` | `PORT=5000`, `FRONTEND_URL=http://localhost:5173`, `PYTHON_API_URL=http://127.0.0.1:4000`, `PYTHON_API_TIMEOUT=60000`, `PYTHON_AI_TIMEOUT=180000` |
| `AlphaSharp/frontend/.env` | Optional `VITE_API_URL`; defaults to `/api` through the development proxy. Set a public Express URL ending in `/api` for deployment. |

Leave the OpenRouter key empty to use the built-in analyst (`Finance-v1/fallback.py`). It also answers when a configured provider fails. All AI functions use the model specified by `OPENROUTER_MODEL`. Keys belong only in Python's environment. Restart Python after changing its environment. Never place a provider key in a `VITE_` variable, which is exposed to the browser.

AI requests allow 180 seconds from Express to Python and 195 seconds in the frontend. Each provider call allows 150 seconds, with automatic retries disabled to avoid an unexpected repeated charge. The assistant can make multiple tool/model steps; a request can still fail if it exceeds the overall proxy budget. Market requests retain shorter limits.

## Architecture and maintenance

The frontend uses a persistent workspace sidebar, a chart-led market overview, and a shared light interface with Manrope headings and DM Sans body text. Press Ctrl+K or Cmd+K to search companies or jump between pages. On narrow screens, the sidebar opens from the menu button. The home page uses the real signal desk as its product preview.

```text
React + Vite :5173 -> Express :5000 -> FastAPI :4000
                               |         |
                               |         +-- explicit-duration HSMM and local research artifacts
                               |         +-- Yahoo company data and optional OpenRouter
                               +-- Yahoo quotes and Macro Pulse
```

The browser uses one shared API client. Express provides one browser-facing API and memory caches. Python owns model training, filtering, simulation and evidence snapshots. There is no database dependency. Unused MongoDB, OAuth and JWT modules were removed. Route loading is split by page; the SVG brand and restrained light palette are shared across views.

Main research endpoints are `/api/research/snapshot`, `/api/research/replay`, `/api/research/evaluation` and `/api/research/brief`. Existing market endpoints adapt the same model. Python API documentation is at `http://127.0.0.1:4000/docs`.

For deployment, keep the Python model/data files with the Python service. Run training offline. Deploy the frontend's `dist` directory with React route fallback, Express as a Node service, and FastAPI as a Python service. Set the public API origins and CORS environment correctly. A public paid AI API needs server access controls; the browser profile is only a local UI gate.

## Checks

With services running, from the top folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\check-local.ps1
npm run lint --prefix .\AlphaSharp\frontend
npm run build --prefix .\AlphaSharp\frontend
npm test --prefix .\AlphaSharp\frontend
npm test --prefix .\AlphaSharp\backend
cd .\Finance-v1
python -m unittest discover -s tests -v
```

The frontend tests include a 35-second mock AI request through the actual frontend service and Express. It uses no provider key. Python checks cover exact small-sequence inference, synthetic state recovery, prefix stability, artifact serialization, data processing, risk metrics, replay chronology, holiday handling and outcome hiding. The smoke check also probes live quotes and stock search, which require network access.
