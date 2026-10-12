# Intelligence methods and interview guide

## Forecasts

The application compares naive last-value, three-month moving average, exponential smoothing with fixed alpha 0.3, and seasonal naive with period 12. These are interpretable baselines. The seasonal method is eligible only if every training fold contains 24 months. Forecasting is withheld with fewer than 18 complete calendar months, 12 active months or 36 recorded bookings. Incomplete current-month values never enter training. Gaps between observed months are filled with zero, including complete empty months after the latest booking.

For `n` months, the last three form rolling holdout origins. The preceding six are rolling validation origins (at least 12 months of initial training). Each prediction uses only data strictly earlier than its target. Select the method with the smallest validation MAE, evaluate that fixed choice on the three later holdout origins, then refit on the full available history for a three-step recursive projection. No random train/test split is used.

MAE is average absolute error in the target's units. RMSE emphasizes larger errors. WAPE divides total absolute error by total absolute observed target values, making it robust to individual zero months; it is undefined when the entire denominator is zero. MAPE is avoided because individual zero observations break it. The UI presents selection scores separately from the final held-out scores. With only three untouched residuals, there is no defensible calibrated uncertainty interval, so none is invented.

The Python implementation uses Pandas to validate the regular monthly series and NumPy for metrics, while retaining understandable explicit model code. It provides an independent check on the browser implementation. Statsmodels/Scikit-learn are not required for these chosen methods. ARIMA, K-Means and Isolation Forest are future candidates if enough meaningful real history becomes available; more complex models are not automatically better.

These are retrospective **current-adjusted** booking totals. Later charge corrections are allocated back to booking months; they do not reconstruct what was known at a historic decision date. A prospective evaluation needs point-in-time snapshots and a longer untouched observation period. Synthetic series are useful for testing mechanics and screenshots, not learning actual customer demand.

## RFM and descriptive intelligence

Recency is days since the last booking, frequency is booking count, and monetary value is current adjusted customer charges. Rules prioritize inactive (>180 days), then high value (5+ bookings and >=₹100,000), regular (3+), and new/occasional. UI filters define the reporting cohort; full customer history remains accessible in each profile. Labels are explainable rule groups, not learned clusters. Negative profit and cancellations remain part of the history rather than disappearing silently.

Route and airline profitability attribute a booking's total to its first segment, avoiding double-counting multi-leg booking amounts. This is an explicit attribution convention, not actual per-leg fare allocation. Revenue concentration measures the five largest customer shares; repeat behavior measures customers with at least two bookings. Margin bands describe distributions, not causal drivers.

## Anomaly rules

- Negative gross profit, or non-negative margin below 5%.
- Modified z-score of charges >3.5 using median absolute deviation and scale constant 0.6745, with at least 20 records and positive MAD. Only high charges are flagged by this rule.
- Repeated PNR and first departure date. Saving also checks matching customer/flight/departure.
- Agency cost greater than twice the prior median on the same first-segment route/airline, with at least ten earlier comparable bookings.

All flags are review prompts. They never delete or rewrite records. A flat distribution with zero MAD receives no invented division-based score. Calendar aggregation shows activity changes, but this release does not claim a fitted change-point detector or Isolation Forest model.

## What-if scenarios

Expected fulfilled bookings = expected monthly bookings × (1 + growth/100) × (1 − cancellations/100). Revenue and gross profit multiply fulfilled volume by average charge and average charge minus cost. Changing the average gross profit updates the implied cost so the assumptions cannot contradict each other. The simplified scenario treats cancellations as zero-revenue, zero-cost; it is labelled simulation rather than a statistical forecast.

## Explain it in an interview

1. Start with the data model: a PNR is not a primary key, and a payment is not a booking's price.
2. Demonstrate a multi-segment PDF with a fare printed on it. Show both financial inputs remain blank and require human entry.
3. Record a partial payment and explain how the remaining balance changes without changing gross profit.
4. Explain chronology: a model can only see the past at each origin, and model selection must not use the final holdout.
5. Explain why the measured synthetic WAPE is sizeable and why reporting it honestly is better than inventing accuracy.
6. Show a negative-profit alert, the reason, and the original booking for review.
7. Describe the demo/private boundary, membership checks, composite foreign keys and RLS, then distinguish local verification from outstanding live-provider tests.
