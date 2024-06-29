import pandas as pd
import yaml
import math

subset_path = 'subset.parquet'
df = pd.read_parquet(subset_path)
with open('subset.yaml') as f:
    subset = yaml.safe_load(f)
df = df.fillna(0)

with open('dv.yaml') as f:
    dv = yaml.safe_load(f)

class MealPlan:
    def __init__(self, df, cals):
        self.cals = cals
        self.nutrient_names = df['nutrient'].unique()
        self.nutrient_amts = {n: 0 for n in self.nutrient_names}
        self.nutrient_dvs = {n: 0 for n in self.nutrient_names}

    def ingest(self, food_name, grams):
        food = df[df.fdc_id == subset[food_name]]
        # print(food[['nutrient', 'amount', 'unit_name']])
        food.amount = food.amount * (grams / 100)
        food.percent_daily_value = food.percent_daily_value * (grams / 100) / (self.cals / 2000)
        for n in self.nutrient_names:
            amt = food[food.nutrient == n].amount.mean()
            if math.isnan(amt):
                amt = 0
            self.nutrient_amts[n] += amt

    def report(self):
        for n in self.nutrient_names:
            unit = df[df.nutrient == n].unit_name.iloc[0]
            print(f'{n}: {self.nutrient_amts[n]}{unit}')


plan = MealPlan(df, 2300)
plan.ingest('babby_carrots', 100)
plan.report()
