import { DISCLAIMER } from '../../config/index';
import { shareDefault, triggerShareBonus } from '../../utils/share';

Page({
  data: {
    version: '0.1.0',
    disclaimer: DISCLAIMER,
  },

  onShareAppMessage() { triggerShareBonus('forward'); return shareDefault(); },
});
