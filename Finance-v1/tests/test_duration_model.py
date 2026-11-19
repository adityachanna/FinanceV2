import itertools
import tempfile
import unittest
from pathlib import Path
import numpy as np
from research.hsmm import forward, backward_stats, duration_hazard, GaussianDurationHSMM


class ExactInferenceTests(unittest.TestCase):
    def test_forward_and_backward_match_enumeration(self):
        a = np.array([[0., 1.], [1., 0.]])
        h = np.array([[.2, 1.], [.7, 1.]])
        initial = np.array([[.3, .2], [.4, .1]])
        b = np.array([[.9, .2], [.4, .8], [.7, .3]])
        alpha, c = forward(b, a, h, initial)
        transition = np.zeros((4, 4))
        for s in range(2):
            for age in range(2):
                if age == 0:
                    transition[s*2+age, s*2+1] = 1-h[s, age]
                transition[s*2+age, (1-s)*2] = h[s, age]
        likelihood = 0.
        post = np.zeros((3, 2))
        for path in itertools.product(range(4), repeat=3):
            p = initial.ravel()[path[0]]*b[0, path[0]//2]
            for t in range(1, 3):
                p *= transition[path[t-1], path[t]]*b[t, path[t]//2]
            likelihood += p
            for t, state in enumerate(path):
                post[t, state//2] += p
        np.testing.assert_allclose(c.prod(), likelihood, atol=1e-12)
        weights, exits, stays, switches = backward_stats(alpha, b, c, a, h)
        np.testing.assert_allclose(weights, post/likelihood, atol=1e-12)
        self.assertAlmostEqual(exits.sum()+stays.sum(), 2, places=10)
        self.assertAlmostEqual(exits.sum(), switches.sum(), places=10)

    def test_causal_prefix_and_probabilities(self):
        b = np.array([[.9, .2], [.4, .8], [.7, .3], [.01, .99]])
        a, h, initial = np.array([[0., 1.], [1., 0.]]), np.array([[.2, 1.], [.7, 1.]]), np.full((2, 2), .25)
        first = forward(b[:3], a, h, initial)[0]
        full = forward(b, a, h, initial)[0]
        np.testing.assert_allclose(first, full[:3], atol=1e-12)
        np.testing.assert_allclose(full.sum(axis=(1, 2)), 1, atol=1e-12)

    def test_duration_hazard_is_not_memoryless(self):
        h = duration_hazard(20, 5, 126)
        self.assertNotAlmostEqual(h[0], h[20])
        self.assertEqual(h[-1], 1)
        self.assertTrue(np.all((h >= 0) & (h <= 1)))

    def test_em_on_known_regimes_and_round_trip(self):
        rng = np.random.default_rng(8)
        labels = np.tile(np.repeat([0, 1, 2], [30, 18, 12]), 4)
        means = np.array([[-.05, -1, -1], [0, 0, 0], [-.2, 1, 1]])
        x = means[labels] + rng.normal(0, .2, (len(labels), 3))
        model = GaussianDurationHSMM(3, 50, n_iter=8, seed=42).fit(x).order_states()
        probs, joint = model.filter(x)
        self.assertGreater((probs.argmax(axis=1) == labels).mean(), .9)
        self.assertTrue(np.all(np.diff(model.history_) >= -1e-5))
        np.testing.assert_allclose(model.transition_.sum(axis=1), 1)
        np.testing.assert_allclose(np.diag(model.transition_), 0)
        model.center_, model.scale_ = np.zeros(3), np.ones(3)
        model.return_means_, model.return_stds_ = model.means_[:, 0]*.01, np.full(3, .01)
        paths = model.simulate(joint[-1], simulations=200)
        np.testing.assert_array_equal(paths, model.simulate(joint[-1], simulations=200))
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory)/"model.npz"
            model.save(file, {"training_end": "2020-01-01"})
            loaded, metadata = GaussianDurationHSMM.load(file)
            np.testing.assert_allclose(loaded.filter(x)[0], probs)
            self.assertEqual(metadata['max_iterations'], 8)
            self.assertEqual(loaded.n_iter, model.n_iter)
            self.assertEqual(loaded.stop_reason_, model.stop_reason_)
            self.assertEqual(loaded.history_, model.history_)


if __name__ == "__main__":
    unittest.main()
