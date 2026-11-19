"""Verify annual training windows, preprocessing and saved forecast targets."""
import json
import numpy as np
import pandas as pd
from research.data import DATA, FEATURES, features
from research.hsmm import GaussianDurationHSMM
from research.train import ARTIFACTS


def audit():
    config = json.loads((DATA/'configuration.json').read_text())
    maximum = config['max_duration']
    frame = features(pd.read_csv(DATA/'evaluation_prices_1990_2025.csv', index_col='date', parse_dates=True))
    records = []
    for year in range(2000, 2027):
        model, metadata = GaussianDurationHSMM.load(ARTIFACTS/f'hsmm_{year}_d{maximum}.npz')
        train = frame.loc[metadata['training_start']:metadata['training_end']]
        history = np.array(metadata['likelihood_history'])
        checks = {'training_precedes_forecast_year': metadata['training_end'] < f'{year}-01-01',
                  'ten_year_window': pd.Timestamp(metadata['training_start']).year == year-10,
                  'training_only_center': bool(np.allclose(model.center_, train[FEATURES].mean().values)),
                  'training_only_scale': bool(np.allclose(model.scale_, train[FEATURES].std(ddof=0).values)),
                  'likelihood_non_decreasing': bool((np.diff(history) >= -1e-5).all()),
                  'likelihood_tolerance_reached': bool(len(history) > 1 and
                      -1e-5 <= history[-1]-history[-2] < .01 and
                      np.isclose(metadata['log_likelihood'], history[-1], atol=1e-5, rtol=0)),
                  'positive_covariances': bool(all(np.linalg.eigvalsh(c).min() > 0 for c in model.covars_))}
        forecast = DATA/f'forecasts_{year}_d{maximum}.csv'
        if forecast.exists():
            rows = pd.read_csv(forecast)
            checks['all_forecast_dates_after_training'] = bool((rows.date > metadata['training_end']).all())
            checks['forecasts_match_model_revision'] = bool(rows.model_id.eq(metadata['model_id']).all())
            valid = True
            for row in rows[rows.method == 'HSMM'].itertuples():
                i = frame.index.get_loc(pd.Timestamp(row.date))
                expected = frame.spx.iloc[i+row.horizon]/frame.spx.iloc[i]-1
                valid &= bool(np.isclose(row.actual, expected, atol=1e-10))
            checks['saved_outcomes_match_future_closes'] = valid
        budget = metadata.get('max_iterations', 30)
        checks['iteration_budget_not_exhausted'] = metadata['em_iterations'] < budget
        records.append({'model_id': metadata['model_id'], 'training_start': metadata['training_start'],
                        'training_end': metadata['training_end'], 'training_observations': len(train),
                        'iterations': metadata['em_iterations'], 'max_iterations': budget,
                        'stop_reason': metadata.get('stop_reason', 'not recorded in original artifact'),
                        'checks': checks})
    current, metadata = GaussianDurationHSMM.load(ARTIFACTS/f'hsmm_2026_d{maximum}.npz')
    train = frame.loc[metadata['training_start']:metadata['training_end']]
    probabilities, _ = current.filter((train[FEATURES].values-current.center_)/current.scale_)
    result = {'passed': all(all(row['checks'].values()) for row in records), 'models': records,
              'current_training_state_probability_sums': probabilities.sum(axis=0).tolist(),
              'notes': ['Passing numerical checks does not establish forecasting superiority.',
                        'Ten years is a fixed design choice, not a validated optimal window.',
                        'Forecasts use daily close information and are issued after the close.',
                        'Later annual fits can use earlier evaluation years once those observations have occurred.']}
    (DATA/'training_audit.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    return result


if __name__ == '__main__':
    result = audit()
    print(json.dumps({'passed': result['passed'], 'models_checked': len(result['models']),
                      'training_rows_min': min(row['training_observations'] for row in result['models']),
                      'training_rows_max': max(row['training_observations'] for row in result['models']),
                      'current_state_weights': result['current_training_state_probability_sums']}, indent=2))
    if not result['passed']:
        raise SystemExit('Training audit failed. Inspect data/research/training_audit.json')
