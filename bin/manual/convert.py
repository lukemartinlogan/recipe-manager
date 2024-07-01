from foods.meal_plan import MealPlan, FOOD_ROOT
import yaml
import pandas as pd

food_df = MealPlan.load_food_composition()
names = list(food_df['Name'])
names.sort()
with open(f'{FOOD_ROOT}/datasets/food_names.yaml', 'w') as f:
    yaml.dump(names, f)

