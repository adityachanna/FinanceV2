import unittest
from pathlib import Path
from research.data import DATA
from research import service


@unittest.skipUnless((DATA/'active_model.json').exists(), 'Requires generated research artifacts')
class ServingTests(unittest.TestCase):
    def test_current_state_matches_catalog_and_training_precedes_snapshot(self):
        value = service.snapshot(horizon=5)
        self.assertLess(value['training_end'], value['as_of'])
        self.assertEqual(value['state']['label'], value['states'][value['state']['id']]['label'])
        self.assertAlmostEqual(sum(state['probability'] for state in value['states']), 1)
        self.assertEqual(len(value['fan']), 5)
        self.assertGreaterEqual(value['risk']['expected_shortfall_95'], value['risk']['var_95'])

    def test_replay_does_not_leak_outcome_and_stress_is_sensible(self):
        hidden = service.replay('2020-03-16', 21, False)
        self.assertNotIn('outcome', hidden)
        self.assertTrue(all('actual' not in row for row in hidden['comparisons']))
        self.assertEqual(hidden['state']['label'], 'Stress')
        self.assertEqual(hidden['training_end'], '2019-12-31')
        visible = service.replay('2020-03-16', 21, True)
        self.assertIn('outcome', visible)
        self.assertEqual(visible['snapshot_id'], hidden['snapshot_id'])
        self.assertNotIn('outcome', service.replay('2020-03-16', 21, False))

    def test_holiday_resolves_before_selecting_model_vintage(self):
        value = service.snapshot('2008-01-01', 1)
        self.assertEqual(value['as_of'], '2007-12-31')
        self.assertLess(value['training_end'], value['as_of'])

    def test_history_returns_real_requested_observations(self):
        value = service.history(504)
        self.assertEqual(value['observations_returned'], 504)
        self.assertEqual(len({row['date'] for row in value['history']}), 504)
        self.assertEqual(sorted(row['date'] for row in value['history']), [row['date'] for row in value['history']])

    def test_invalid_and_future_dates_fail(self):
        with self.assertRaises(ValueError): service.snapshot('not-a-date')
        with self.assertRaises(ValueError): service.snapshot('2099-01-01')
        with self.assertRaises(ValueError): service.replay('2020-01-01', 7)


if __name__ == '__main__':
    unittest.main()
