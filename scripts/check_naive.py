import pandas as pd, numpy as np, os
os.chdir(os.path.join(os.path.dirname(__file__), ".."))
from sklearn.metrics import r2_score

for t in ['VCB','BID','CTG']:
    df = pd.read_csv('data/processed/' + t + '_features.csv')
    n = len(df); val_end = int(n*0.9)
    prices = df['close_winsorized'].values
    test_prices = prices[val_end:]
    actual = test_prices[1:]
    naive  = test_prices[:-1]   # predict: gia ngay mai = gia hom nay
    r2_naive   = r2_score(actual, naive)
    mape_naive = float(np.mean(np.abs((actual - naive) / actual)) * 100)
    print(t + " | Naive baseline (P_hat=P_t-1): R2=" + str(round(r2_naive,4)) + " | MAPE=" + str(round(mape_naive,2)) + "%")
