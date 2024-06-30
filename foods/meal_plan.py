import pandas as pd
import yaml
import math
import pathlib


FOOD_ROOT = str(pathlib.Path(__file__).absolute().parent.parent).replace('\\', '/')


class MealPlan:
    @staticmethod
    def load_usda_food_composition():
        food_comp_path = f'{FOOD_ROOT}/datasets/food_comp.json'
        food_comp = pd.read_json(food_comp_path)
        food_comp = food_comp.fillna(0)
        return food_comp

    @staticmethod
    def load_usda_dv():
        with open(f'{FOOD_ROOT}/datasets/food_dv.yaml') as f:
            dv = yaml.safe_load(f)
        return dv

    def __init__(self, cals):
        self.food_comp = self.load_usda_food_composition()
        self.food_names = self.load_usda_food_names()
        self.food_dv = self.load_usda_dv()
        self.cals = cals
        self.nutrient_names = list(self.food_comp['nutrient'].unique())
        self.nutrient_names.sort()
        self.nutrient_amts = {n: 0 for n in self.nutrient_names}
        self.nutrient_dvs = {n: 0 for n in self.nutrient_names}
        self.essentials = [
            'Energy',
            'Protein',

            'Carbohydrate, by difference',
            'Fiber, total dietary',
            'Total dietary fiber (AOAC 2011.25)',
            'Total Sugars',
            'Sugars, Total',
            'Sugars, added',

            'Sodium, Na',
            'Calcium, Ca',
            'Cholesterol',

            'Total lipid (fat)',
            'Fatty acids, total saturated',
            'Fatty acids, total polyunsaturated',
            'Fatty acids, total monounsaturated',
            'Fatty acids, total trans-polyenoic',
            'Fatty acids, total trans-monoenoic',

            'Vitamin A, RAE',
            'Vitamin A, IU',
            'Vitamin B-6',
            # 'Folic acid',
            'Folate, total',
            # 'Folate, DFE',
            # 'Folate, food',
            'Vitamin B-12',
            'Vitamin B-12, added',
            'Vitamin K (phylloquinone)',
            'Vitamin K (Dihydrophylloquinone)',
            'Vitamin K (Menaquinone-4)',
            'Vitamin C, total ascorbic acid',
            'Vitamin D (D2 + D3), International Units',
            'Vitamin D (D2 + D3)',
            'Vitamin D3 (cholecalciferol)',
            'Vitamin D2 (ergocalciferol)',
            'Vitamin E (alpha-tocopherol)',
            'Vitamin E, added',
            # 'Tocopherol, delta',
            # 'Tocopherol, beta',
            # 'Tocotrienol, gamma',
            # 'Tocopherol, gamma',
        ]

    def ingest(self, food_name, grams):
        food = self.food_comp[self.food_comp.fdc_id == self.food_names[food_name]]
        # print(food[['nutrient', 'amount', 'unit_name']])
        food.amount = food.amount * (grams / 100)
        # food.percent_daily_value = food.percent_daily_value * (grams / 100) / (self.cals / 2000)
        for n in self.nutrient_names:
            amt = food[food.nutrient == n].amount.mean()
            if math.isnan(amt):
                amt = 0
            self.nutrient_amts[n] += amt
            if n in self.food_dv and self.food_dv[n] > 0:
                self.nutrient_dvs[n] += (amt / self.food_dv[n]) * (grams / 100) / (self.cals / 2000)

    def report(self):
        # for n in self.nutrient_names:
        for n in self.essentials:
            unit = self.food_comp[self.food_comp.nutrient == n].unit_name.iloc[0]
            print(f'{n}: {round(self.nutrient_amts[n], 2)}{unit}, {round(100 * self.nutrient_dvs[n], 2)}% DV')
