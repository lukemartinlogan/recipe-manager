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
with open(f'{FOOD_ROOT}/datasets/usda/food_names.yaml') as f:
    food_names = yaml.safe_load(f)

dfs = []
for key, value in food_names.items():
    dfs.append(food_comp[food_comp.fdc_id == value])
dfs = pd.concat(dfs)

# Make a dict is a list of the

print('Saving to food_comp.yaml')
dfs.drop(columns=['fdc_id'], inplace=True)
food_dict = dfs.to_parquet(f'{FOOD_ROOT}/datasets/usda/food_comp.parquet', index=False)
