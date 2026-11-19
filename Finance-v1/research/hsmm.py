"""Explicit-duration Gaussian HSMM.

The hidden process is (state, elapsed age). A learned duration hazard controls
exits; the segment transition matrix has no self transitions. Forward filtering
uses no future observations. EM uses forward/backward sufficient statistics.
The final segment is right censored: no exit is forced at the last observation.
"""
import json
from pathlib import Path
import numpy as np
from scipy.optimize import minimize
from scipy.special import logsumexp
from scipy.stats import nbinom
from hmmlearn.hmm import GaussianHMM
from sklearn.cluster import KMeans
try:
    from numba import njit
except ImportError:
    def njit(*args, **kwargs):
        return lambda function: function


@njit(cache=True)
def forward(emissions, transition, hazard, initial):
    t_count, k_count = emissions.shape
    d_count = hazard.shape[1]
    alpha = np.zeros((t_count, k_count, d_count))
    scales = np.zeros(t_count)
    for k in range(k_count):
        for age in range(d_count):
            alpha[0, k, age] = initial[k, age] * emissions[0, k]
            scales[0] += alpha[0, k, age]
    alpha[0] /= max(scales[0], 1e-300)
    for t in range(1, t_count):
        exits = np.zeros(k_count)
        for k in range(k_count):
            for age in range(d_count):
                exits[k] += alpha[t-1, k, age] * hazard[k, age]
        for k in range(k_count):
            for j in range(k_count):
                alpha[t, k, 0] += exits[j] * transition[j, k]
            for age in range(1, d_count):
                alpha[t, k, age] = alpha[t-1, k, age-1] * (1-hazard[k, age-1])
            for age in range(d_count):
                alpha[t, k, age] *= emissions[t, k]
                scales[t] += alpha[t, k, age]
        alpha[t] /= max(scales[t], 1e-300)
    return alpha, scales


@njit(cache=True)
def backward_stats(alpha, emissions, scales, transition, hazard):
    t_count, k_count, d_count = alpha.shape
    beta = np.ones((k_count, d_count))
    weights = np.zeros((t_count, k_count))
    exits = np.zeros_like(hazard)
    stays = np.zeros_like(hazard)
    transitions = np.zeros_like(transition)
    for k in range(k_count):
        weights[-1, k] = alpha[-1, k].sum()
    for t in range(t_count-2, -1, -1):
        next_beta = np.zeros_like(beta)
        entry = emissions[t+1] * beta[:, 0]
        normalizer = max(scales[t+1], 1e-300)
        for k in range(k_count):
            exit_value = 0.0
            for j in range(k_count):
                exit_value += transition[k, j] * entry[j]
            exit_mass = 0.0
            for age in range(d_count):
                leave = hazard[k, age] * exit_value / normalizer
                remain = 0.0
                if age < d_count-1:
                    remain = (1-hazard[k, age]) * emissions[t+1, k] * beta[k, age+1] / normalizer
                exits[k, age] += alpha[t, k, age] * leave
                stays[k, age] += alpha[t, k, age] * remain
                next_beta[k, age] = leave + remain
                weights[t, k] += alpha[t, k, age] * next_beta[k, age]
                exit_mass += alpha[t, k, age] * hazard[k, age]
            for j in range(k_count):
                transitions[k, j] += exit_mass * transition[k, j] * entry[j] / normalizer
        beta = next_beta
    return weights, exits, stays, transitions


def duration_probabilities(mean_excess, dispersion, maximum):
    # D = 1 + NB(r, p). Normalize the finite support explicitly.
    log_pmf = nbinom.logpmf(np.arange(maximum), dispersion,
                           dispersion / (dispersion + mean_excess))
    return np.exp(log_pmf - logsumexp(log_pmf))


def duration_hazard(mean_excess, dispersion, maximum):
    pmf = duration_probabilities(mean_excess, dispersion, maximum)
    survival = np.cumsum(pmf[::-1])[::-1]
    hazard = pmf / np.maximum(survival, 1e-300)
    hazard[-1] = 1.0
    return hazard


def initialize_hmm(x, seed=42, n_states=3):
    clusters = KMeans(n_clusters=n_states, n_init=10, random_state=seed).fit(x)
    hmm = GaussianHMM(n_states, covariance_type="full", n_iter=100, min_covar=1e-3,
                      init_params="", random_state=seed)
    hmm.startprob_ = np.full(n_states, 1/n_states)
    hmm.transmat_ = np.full((n_states, n_states), .05/(n_states-1))
    np.fill_diagonal(hmm.transmat_, .95)
    hmm.means_ = clusters.cluster_centers_
    hmm.covars_ = np.array([np.cov(x[clusters.labels_ == k].T)+np.eye(x.shape[1])*1e-3
                            for k in range(n_states)])
    return hmm.fit(x)


class GaussianDurationHSMM:
    def __init__(self, n_states=3, max_duration=126, n_iter=35, seed=42):
        self.n_states, self.max_duration, self.n_iter, self.seed = n_states, max_duration, n_iter, seed
        self.history_ = []

    def _hazards(self):
        return np.array([duration_hazard(*row, self.max_duration) for row in self.duration_])

    def log_emissions(self, x):
        result = np.empty((len(x), self.n_states))
        for k in range(self.n_states):
            chol = np.linalg.cholesky(self.covars_[k])
            whitened = np.linalg.solve(chol, (x-self.means_[k]).T).T
            result[:, k] = -.5 * (x.shape[1] * np.log(2*np.pi)
                                   + 2*np.log(np.diag(chol)).sum() + (whitened**2).sum(axis=1))
        return result

    def _forward(self, x):
        logs = self.log_emissions(x)
        offsets = logs.max(axis=1)
        emissions = np.exp(logs-offsets[:, None])
        alpha, scales = forward(emissions, self.transition_, self._hazards(), self.initial_)
        likelihood = float(np.log(np.maximum(scales, 1e-300)).sum()+offsets.sum())
        return alpha, emissions, scales, likelihood

    def fit(self, x):
        x = np.asarray(x, dtype=float)
        if x.ndim != 2 or len(x) < 50 or not np.isfinite(x).all():
            raise ValueError("HSMM fitting needs at least 50 finite observations")
        hmm = initialize_hmm(x, self.seed, self.n_states)
        self.means_, self.covars_ = hmm.means_.copy(), hmm.covars_.copy()
        self.transition_ = hmm.transmat_.copy()
        np.fill_diagonal(self.transition_, 0)
        self.transition_ += (1-np.eye(self.n_states)) * .001
        self.transition_ /= self.transition_.sum(axis=1, keepdims=True)
        means = np.minimum(1/np.maximum(1-np.diag(hmm.transmat_), .01), self.max_duration/2)
        self.duration_ = np.column_stack([np.maximum(means-1, 1), np.full(self.n_states, 2.0)])
        # Unknown age at the beginning integrates over a fixed survival-weighted
        # prior. This allows left censoring instead of asserting a new segment.
        self.initial_ = np.array([np.cumsum(duration_probabilities(*row, self.max_duration)[::-1])[::-1]
                                  for row in self.duration_])
        self.initial_ /= self.initial_.sum()
        self.history_ = []
        self.stop_reason_ = "iteration_limit"
        for iteration in range(self.n_iter):
            alpha, emissions, scales, likelihood = self._forward(x)
            self.history_.append(likelihood)
            weights, exits, stays, transitions = backward_stats(
                alpha, emissions, scales, self.transition_, self._hazards())
            old = (self.means_.copy(), self.covars_.copy(), self.transition_.copy(), self.duration_.copy())
            masses = weights.sum(axis=0)
            if masses.min() < 10:
                self.stop_reason_ = "insufficient_state_mass"
                break
            for k in range(self.n_states):
                self.means_[k] = (weights[:, k, None]*x).sum(axis=0)/masses[k]
                diff = x-self.means_[k]
                self.covars_[k] = (diff.T*weights[:, k])@diff/masses[k] + np.eye(x.shape[1])*1e-4
                def objective(params):
                    h = np.clip(duration_hazard(*np.exp(params), self.max_duration), 1e-14, 1-1e-14)
                    return -float((exits[k]*np.log(h)+stays[k]*np.log1p(-h)).sum())
                fitted = minimize(objective, np.log(self.duration_[k]), method="L-BFGS-B",
                                  bounds=[(np.log(.05), np.log(self.max_duration*2)),
                                          (np.log(.1), np.log(100))])
                if fitted.success:
                    self.duration_[k] = np.exp(fitted.x)
            self.transition_ = transitions + (1-np.eye(self.n_states))*1e-6
            np.fill_diagonal(self.transition_, 0)
            self.transition_ /= self.transition_.sum(axis=1, keepdims=True)
            new_likelihood = self._forward(x)[-1]
            if new_likelihood < likelihood-1e-5:
                self.means_, self.covars_, self.transition_, self.duration_ = old
                self.stop_reason_ = "update_rejected"
                break
            if new_likelihood-likelihood < .01:
                self.history_.append(new_likelihood)
                self.stop_reason_ = "likelihood_tolerance"
                break
        self.log_likelihood_ = self._forward(x)[-1]
        return self

    def filter(self, x):
        alpha = self._forward(np.asarray(x, dtype=float))[0]
        return alpha.sum(axis=2), alpha

    def order_states(self, feature=1):
        order = np.argsort(self.means_[:, feature])
        self.means_, self.covars_ = self.means_[order], self.covars_[order]
        self.duration_, self.initial_ = self.duration_[order], self.initial_[order]
        self.transition_ = self.transition_[order][:, order]
        return self

    def simulate(self, joint, horizon=21, simulations=2000, seed=42, reset_age=False):
        rng = np.random.default_rng(seed)
        ids = rng.choice(joint.size, simulations, p=(joint/joint.sum()).ravel())
        states, ages = np.divmod(ids, self.max_duration)
        if reset_age:
            ages[:] = 0
        hazards = self._hazards()
        paths = np.zeros((simulations, horizon))
        for t in range(horizon):
            leaving = rng.random(simulations) < hazards[states, ages]
            previous = states.copy()
            for k in range(self.n_states):
                selected = leaving & (previous == k)
                states[selected] = rng.choice(self.n_states, selected.sum(), p=self.transition_[k])
            ages = np.where(leaving, 0, np.minimum(ages+1, self.max_duration-1))
            paths[:, t] = rng.normal(self.return_means_[states], self.return_stds_[states])
        return np.expm1(np.cumsum(paths, axis=1))

    def save(self, path, metadata):
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        np.savez_compressed(path, means=self.means_, covars=self.covars_, transition=self.transition_,
                            duration=self.duration_, initial=self.initial_, center=self.center_, scale=self.scale_,
                            return_means=self.return_means_, return_stds=self.return_stds_)
        metadata = {**metadata, "n_states": self.n_states, "max_duration": self.max_duration,
                    "log_likelihood": self.log_likelihood_, "em_iterations": len(self.history_),
                    "likelihood_history": self.history_, "seed": self.seed,
                    "max_iterations": self.n_iter, "stop_reason": getattr(self, "stop_reason_", "unknown"),
                    "duration_family": "shifted negative binomial", "implementation": "explicit age-state HSMM EM"}
        path.with_suffix(".json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    @classmethod
    def load(cls, path):
        metadata = json.loads(Path(path).with_suffix(".json").read_text(encoding="utf-8"))
        model = cls(metadata["n_states"], metadata["max_duration"],
                    metadata.get("max_iterations", 30), metadata.get("seed", 42))
        with np.load(path, allow_pickle=False) as arrays:
            for name in ["means", "covars", "transition", "duration", "initial", "center", "scale", "return_means", "return_stds"]:
                setattr(model, name+"_", arrays[name])
        model.log_likelihood_ = metadata["log_likelihood"]
        model.history_ = metadata.get("likelihood_history", [])
        model.stop_reason_ = metadata.get("stop_reason", "unknown")
        return model, metadata
