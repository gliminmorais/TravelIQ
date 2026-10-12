export const methods = [
  'Naive',
  'Moving average (3)',
  'Exponential smoothing',
  'Seasonal naive',
] as const;
export type Method = (typeof methods)[number];
export function predict(train: number[], method: Method) {
  if (!train.length) throw Error('Training history is empty');
  if (method === 'Naive') return train.at(-1)!;
  if (method === 'Moving average (3)')
    return train.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, train.length);
  if (method === 'Seasonal naive') {
    if (train.length < 24) throw Error('Seasonal method needs 24 training months');
    return train.at(-12)!;
  }
  return train.slice(1).reduce((level, x) => 0.3 * x + 0.7 * level, train[0]);
}
export function metrics(actual: number[], forecast: number[]) {
  if (!actual.length || actual.length !== forecast.length) throw Error('Invalid evaluation series');
  const errors = actual.map((v, i) => v - forecast[i]),
    scale = actual.reduce((s, n) => s + Math.abs(n), 0);
  return {
    mae: errors.reduce((s, n) => s + Math.abs(n), 0) / errors.length,
    rmse: Math.sqrt(errors.reduce((s, n) => s + n * n, 0) / errors.length),
    wape: scale ? (100 * errors.reduce((s, n) => s + Math.abs(n), 0)) / scale : null,
  };
}
export function forecast(series: number[]) {
  if (series.length < 18) return null;
  // Select using rolling origins before the final three months, then evaluate on untouched final origins.
  const split = series.length - 3,
    validationStart = Math.max(12, split - 6);
  const eligible = methods.filter((m) => m !== 'Seasonal naive' || validationStart >= 24);
  const scores = eligible
    .map((method) => {
      const actual = series.slice(validationStart, split),
        pred = actual.map((_, i) => predict(series.slice(0, validationStart + i), method));
      return { method, ...metrics(actual, pred) };
    })
    .sort((a, b) => a.mae - b.mae);
  const winner = scores[0].method;
  const test = metrics(
    series.slice(split),
    series.slice(split).map((_, i) => predict(series.slice(0, split + i), winner)),
  );
  const history = [...series],
    future = [];
  for (let i = 0; i < 3; i++) {
    const next = predict(history, winner);
    future.push(next);
    history.push(next);
  }
  return {
    method: winner,
    scores,
    test,
    future,
    trainingMonths: series.length,
    validationOrigins: split - validationStart,
    testOrigins: 3,
  };
}
