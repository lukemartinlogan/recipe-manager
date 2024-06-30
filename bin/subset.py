import json
import sys
import yaml
import pandas as pd
from foods.meal_plan import MealPlan, FOOD_ROOT

food_conv_path = sys.argv[1]
food_conv_path = food_conv_path.replace('\\', '/')

print(food_conv_path)
food_comp = pd.read_parquet(food_conv_path)

print('Subsetting data')
# Other
with open(f'{FOOD_ROOT}/datasets/food_names.yaml') as f:
    food_names = yaml.safe_load(f)

dfs = []
for key, value in food_names.items():
    dfs.append(food_comp[food_comp.fdc_id == value])
dfs = pd.concat(dfs)

print('Saving to food_comp.parquet')
dfs.to_parquet(f'{FOOD_ROOT}/datasets/food_comp.parquet', index=False)
