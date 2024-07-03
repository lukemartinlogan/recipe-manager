import pandas as pd
import yaml
import math
import pathlib
import datetime


FOOD_ROOT = str(pathlib.Path(__file__).absolute().parent.parent).replace('\\', '/')


class MealPlan:
    @staticmethod
    def load_food_composition_part(name):
        food_comp_path = f'{FOOD_ROOT}/datasets/{name}/food_comp.yaml'
        with open(food_comp_path, 'r') as fp:
            food_comp_dict = yaml.safe_load(fp)
        food_comp = pd.DataFrame(food_comp_dict)
        food_comp = food_comp.fillna(0)
        return food_comp

    @staticmethod
    def load_food_composition():
        manual = MealPlan.load_food_composition_part('manual')
        usda = MealPlan.load_food_composition_part('large')
        return pd.concat([manual, usda], ignore_index=True)

    @staticmethod
    def load_dv():
        with open(f'{FOOD_ROOT}/datasets/food_dv.yaml') as f:
            dv = yaml.safe_load(f)
        return dv

    def __init__(self, cals):
        self.food_comp = self.load_food_composition()
        self.food_dv = self.load_dv()
        self.cals = cals
        self.nutrient_names = list(self.food_dv.keys())
        self.nutrient_names.sort()
        self.nutrient_amts = {n: 0 for n in self.nutrient_names}
        self.nutrient_dvs = {n: 0 for n in self.nutrient_names}
        self.components = {}

    def ingest(self, food_name, grams):
        food = self.food_comp[self.food_comp.Name == food_name]
        weight = food.Weight.iloc[0]
        weight_amp = (grams / weight)
        dv_amp = (self.cals / 2000)
        for n in self.nutrient_names:
            amt = food[n].mean()
            if math.isnan(amt):
                amt = 0
            amt *= weight_amp
            amt = float(amt)
            food.loc[:,n] = amt
            self.nutrient_amts[n] += amt
            if n in self.food_dv and self.food_dv[n]['amt'] > 0:
                self.nutrient_dvs[n] += (amt / self.food_dv[n]['amt']) / dv_amp
        if food_name not in self.components:
            self.components[food_name] = food
        else:
            self.components[food_name] += food

    def report(self, date=None):
        # DV / 2000
        lines = []
        info = {}
        for n in self.nutrient_names:
            unit = self.food_dv[n]['unit']
            dv_amp = (self.cals / 2000)
            info[n] = {
                'amt': round(self.nutrient_amts[n], 2),
                'percent_dv': round(100 * self.nutrient_dvs[n], 2),
                'unit': unit,
                'components': {}
            }
            lines.append(f'{n}: {round(self.nutrient_amts[n], 2)}{unit}, {round(100 * self.nutrient_dvs[n], 2)}% DV')
            sum = 0
            for component in self.components:
                amt = float(self.components[component][n].sum())
                if amt > 0:
                    frac = 100 * amt / self.food_dv[n]['amt'] / dv_amp
                    if frac > 5:
                        lines.append(f'  {component}: {round(frac, 2)}%')
                        info[n]['components'][component] = round(frac, 2)
                        sum += frac
            lines.append(f'  (viewed total): {round(sum, 2)}%')

        print('\n'.join(lines))
        if date is not None:
            if date == 'today':
                date = datetime.datetime.now().strftime('%Y-%m-%d')
            # with open(f'{FOOD_ROOT}/datasets/reports/{date}.txt', 'w') as f:
            #     f.write('\n'.join(lines))
            with open(f'{FOOD_ROOT}/datasets/reports/{date}.yaml', 'w') as f:
                yaml.dump(info, f)
