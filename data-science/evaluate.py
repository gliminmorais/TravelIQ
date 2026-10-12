"""Offline rolling-origin evaluation. No service or Python process is required on Vercel.

Only publish reports from explicitly synthetic inputs. Keep real exports in private/.
"""
from pathlib import Path
import argparse
import json
import numpy as np
import pandas as pd

def predict(train, method):
    train=np.asarray(train,dtype=float)
    if len(train)==0: raise ValueError('Empty training set')
    if method=='naive': return float(train[-1])
    if method=='moving_average_3': return float(np.mean(train[-3:]))
    if method=='seasonal_naive':
        if len(train)<24: raise ValueError('24 training months required')
        return float(train[-12])
    if method=='exponential_smoothing':
        level=train[0]
        for value in train[1:]: level=0.3*value+0.7*level
        return float(level)
    raise ValueError('Unknown method')

def metrics(actual, predicted):
    actual=np.asarray(actual,dtype=float);predicted=np.asarray(predicted,dtype=float)
    if len(actual)==0 or actual.shape!=predicted.shape: raise ValueError('Invalid evaluation series')
    error=actual-predicted;scale=np.sum(np.abs(actual))
    return {'mae':float(np.mean(np.abs(error))),'rmse':float(np.sqrt(np.mean(error**2))),
            'wape':float(100*np.sum(np.abs(error))/scale) if scale else None}

def evaluate(values):
    values=list(values)
    if len(values)<18: raise ValueError('At least 18 complete months required')
    split=len(values)-3;start=max(12,split-6)
    methods=['naive','moving_average_3','exponential_smoothing']
    if start>=24: methods.append('seasonal_naive')
    scores=[]
    for method in methods:
        pred=[predict(values[:i],method) for i in range(start,split)]
        scores.append({'method':method,**metrics(values[start:split],pred)})
    scores.sort(key=lambda item:item['mae']);winner=scores[0]['method']
    held_out=[predict(values[:i],winner) for i in range(split,len(values))]
    future=[];history=list(values)
    for _ in range(3):
        value=predict(history,winner);future.append(value);history.append(value)
    return {'selected_method':winner,'validation_origins':split-start,'test_origins':3,
            'validation_scores':scores,'holdout':metrics(values[split:],held_out),'future':future,
            'interval':None,'interval_reason':'Too few untouched residuals to validate interval coverage'}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--input',type=Path,default=Path(__file__).parent/'data/synthetic-monthly.csv')
    parser.add_argument('--output',type=Path,default=Path(__file__).parent/'reports/synthetic-evaluation.json')
    args=parser.parse_args();df=pd.read_csv(args.input)
    if df['month'].duplicated().any():raise ValueError('Duplicate months')
    periods=pd.PeriodIndex(df['month'],freq='M')
    if not periods.is_monotonic_increasing or len(pd.period_range(periods.min(),periods.max(),freq='M'))!=len(periods):raise ValueError('Sort and fill complete monthly periods before evaluation')
    if not np.isfinite(df[['bookings','revenue','profit']].to_numpy(dtype=float)).all():raise ValueError('Non-finite data')
    report={'input':args.input.name,'observations':len(df),'synthetic':args.input.name=='synthetic-monthly.csv',
            'methodology':'rolling-origin validation, then three untouched sequential holdout origins; fixed alpha 0.3',
            'results':{metric:evaluate(df[metric]) for metric in ['bookings','revenue','profit']}}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,indent=2,allow_nan=False)+'\n',encoding='utf8')
    print(json.dumps({k:v['holdout'] for k,v in report['results'].items()},indent=2))

if __name__=='__main__':main()
