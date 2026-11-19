# AlphaSharp HSMM paper

IEEE conference-format paper (IEEEtran, two-column) describing the explicit-duration HSMM in `Finance-v1/research` and its 2007–2025 walk-forward evaluation.

## Files

| Path | Contents |
| --- | --- |
| `main.tex` | Paper source. Figures 1 and 2 (architecture and rolling-window timeline) are TikZ inside this file. |
| `figures/make_figures.py` | Generates `fig_regimes.pdf`, `fig_durations.pdf`, `fig_scores.pdf`, `fig_fans.pdf` and `derived_numbers.json`. |
| `figures/derived_numbers.json` | Numbers computed from the artifacts that are quoted in the paper but not stored directly in `evaluation.json` (state shares, label switches, duration summaries, fan-chart quantiles). |
| `AlphaSharp_HSMM_Paper.pdf` | Compiled paper. |

## Rebuild

From this directory:

```powershell
python figures\make_figures.py
tectonic main.tex
Move-Item -Force main.pdf AlphaSharp_HSMM_Paper.pdf
```

`make_figures.py` needs Python 3 with NumPy, pandas, SciPy and matplotlib. It reads, and never writes, these inputs:

- `../Finance-v1/data/research/evaluation.json`, `evaluation_prices_1990_2025.csv`, `filtered_YYYY_d252.csv`, `forecasts_YYYY_d252.csv`
- `../Finance-v1/models/research/hsmm_YYYY_d252.json` and `.npz`

The script re-implements the forward filter and scenario simulator with NumPy instead of importing the application package. Before drawing, it checks the re-implementation against the stored filtered probabilities and forecast quantiles for the 2008 and 2020 vintages and prints the maximum absolute differences (about 1e-15 in the current build).

Tectonic (https://tectonic-typesetting.github.io) downloads the required LaTeX packages on first use, so the first build needs network access. Any TeX Live installation also works: `pdflatex main.tex` twice.

## Source of numbers

Every result in the paper comes from `evaluation.json`, `configuration.json`, `manifest.json`, `training_audit.json`, the model metadata files, or `figures/derived_numbers.json`. If the model is retrained, rerun both commands and update the numbers in `main.tex`, which are typed into the text and tables.
