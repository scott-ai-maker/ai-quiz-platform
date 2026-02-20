class DecisionEngine {
  constructor() {
    this.approveThreshold = Number(
      process.env.VERIFICATION_APPROVE_THRESHOLD || 80
    );
    this.flagThreshold = Number(process.env.VERIFICATION_FLAG_THRESHOLD || 60);
  }

  decide(score) {
    if (score >= this.approveThreshold) {
      return 'approve';
    }
    if (score >= this.flagThreshold) {
      return 'flag';
    }
    return 'reject';
  }
}

module.exports = DecisionEngine;
