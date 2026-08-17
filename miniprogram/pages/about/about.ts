import { CONFIG, DISCLAIMER } from '../../config/index';
import { shareDefault } from '../../utils/share';

Page({
  data: {
    version: '0.1.0',
    modelVersion: CONFIG.MODEL_VERSION,
    disclaimer: DISCLAIMER,
  },

  onShareAppMessage: () => shareDefault(),
});
