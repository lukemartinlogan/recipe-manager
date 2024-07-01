import json
import sys
import yaml
import pandas as pd

usda_path = sys.argv[1]
food_conv_path = sys.argv[2]
usda_path = usda_path.replace('\\', '/')
food_conv_path = food_conv_path.replace('\\', '/')

# Read json file
# with open(usda_path, encoding='utf-8', errors='replace') as fp:
#     print('Loading into JSON format')

print('Food CSV')
# fdc_id, description
food_id_df = pd.read_csv(f'{usda_path}/food.csv')
food_id_df = food_id_df[['fdc_id', 'description']]
print('NUTRIENT ID CSV')
# nutrient_id, unit_name, nutrient
nutrient_id_df = pd.read_csv(f'{usda_path}/nutrient.csv')
nutrient_id_df.rename(columns={'id': 'nutrient_id', 'name': 'nutrient'}, inplace=True)
nutrient_id_df = nutrient_id_df[['nutrient_id', 'unit_name', 'nutrient']]
print('NUTRIENT CSV')
# fdc_id, nutrient_id, amount, percent_daily_value
nutrient_df = pd.read_csv(f'{usda_path}/food_nutrient.csv')
nutrient_df = nutrient_df[['fdc_id', 'nutrient_id', 'amount', 'percent_daily_value']]

# Join the dataframes
print('Joining dataframes')
food_df = food_id_df.merge(nutrient_df, on='fdc_id')
food_df = food_df.merge(nutrient_id_df, on='nutrient_id')
food_df = food_df.drop(columns=['nutrient_id'])

# Save to parquet
# fdc_id, nutrient, unit_name, amount, percent_daily_value
print(f'Saving to {food_conv_path}')
food_df.to_parquet(food_conv_path, index=False)
