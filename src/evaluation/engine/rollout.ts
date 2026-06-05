export function getRolloutBucket(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index++) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash) % 100;
}

export function isInRollout(value: string, percentage: number): boolean {
  if (percentage <= 0) {
    return false;
  }

  if (percentage >= 100) {
    return true;
  }

  return getRolloutBucket(value) < percentage;
}
