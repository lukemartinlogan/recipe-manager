import json
import sys
import yaml
import pandas as pd

food_conv_path = sys.argv[1]
food_conv_path = food_conv_path.replace('\\', '/')

print(food_conv_path)
df = pd.read_parquet(food_conv_path)

print('Subsetting data')
# Other
with open('subset.yaml') as f:
    subset = yaml.safe_load(f)

dfs = []
for key, value in subset.items():
    dfs.append(df[df.fdc_id == value])
dfs = pd.concat(dfs)

print('Saving to subset.parquet')
dfs.to_parquet('subset.parquet', index=False)
