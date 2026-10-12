import unittest
from evaluate import evaluate,metrics,predict
class ForecastTests(unittest.TestCase):
    def test_zero(self):self.assertIsNone(metrics([0,0],[0,0])['wape'])
    def test_metrics(self):self.assertAlmostEqual(metrics([1,2],[2,4])['mae'],1.5)
    def test_no_leakage(self):
        a=list(range(36));b=a[:-3]+[10000,10000,10000]
        self.assertEqual(evaluate(a)['validation_scores'],evaluate(b)['validation_scores'])
        self.assertNotEqual(evaluate(a)['holdout'],evaluate(b)['holdout'])
    def test_short_history(self):
        with self.assertRaises(ValueError):evaluate([0]*17)
    def test_seasonal_minimum(self):
        with self.assertRaises(ValueError):predict([1,2,3],'seasonal_naive')
if __name__=='__main__':unittest.main()
