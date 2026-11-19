import unittest
import numpy as np
import pandas as pd
from research.data import features, FEATURES
from research.train import row_metrics


class DataAndMetricTests(unittest.TestCase):
    def test_features_are_prefix_stable_and_never_fill_missing_closes(self):
        index = pd.bdate_range('2020-01-01', periods=100)
        frame = pd.DataFrame({'spx': np.exp(np.arange(100)*.001+np.sin(np.arange(100))*.01)*100,
                              'vix': np.ones(100)*20}, index=index)
        early = features(frame.iloc[:70])[FEATURES]
        full = features(frame)[FEATURES].loc[early.index]
        np.testing.assert_array_equal(early, full)
        frame.loc[index[40], 'vix'] = np.nan
        self.assertNotIn(index[40], features(frame).index)

    def test_interval_score_penalizes_misses_and_brier_is_probability_error(self):
        row = row_metrics(pd.Timestamp('2020-01-01'), 'test', 1, [-.1,-.05,0,.05,.1], .4, -.2, 0, 'test')
        self.assertAlmostEqual(row['interval_score'], 2.2)
        self.assertAlmostEqual(row['brier'], .36)
        self.assertEqual(row['breach'], 1)
        self.assertEqual(row['covered'], 0)


if __name__ == '__main__':
    unittest.main()
