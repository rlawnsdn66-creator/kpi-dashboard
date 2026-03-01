function determineStatus(avgProgress) {
  if (avgProgress >= 100) return 'completed';
  if (avgProgress < 30) return 'behind';
  if (avgProgress < 60) return 'at_risk';
  return 'on_track';
}

module.exports = { determineStatus };
