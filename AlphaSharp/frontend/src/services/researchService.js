import api from './api';
import { API_TIMEOUT } from '../utils/constants';

export const researchService = {
  snapshot: (horizon = 21) => api.get('/research/snapshot', { params: { horizon } }),
  replay: (asOf, horizon = 21, reveal = false) => api.get('/research/replay', { params: { as_of: asOf, horizon, reveal } }),
  evaluation: () => api.get('/research/evaluation'),
  brief: snapshot => api.post('/research/brief', {
    snapshot_id: snapshot.snapshot_id, as_of: snapshot.requested_as_of, horizon: snapshot.horizon,
  }, { timeout: API_TIMEOUT.AI }),
};
