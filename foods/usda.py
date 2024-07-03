import json
import sys
import yaml
import pandas as pd
from foods.meal_plan import MealPlan, FOOD_ROOT
import requests
import zipfile
import os
import urllib.parse



class UsdaBigDownload:
    def __init__(self):
        pass

    def download(self):
        urls = {
            'foundation': 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_csv_2024-04-18.zip',
            'legacy': 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip',
            'survey': 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_survey_food_csv_2022-10-28.zip',
            'branded': 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_branded_food_csv_2024-04-18.zip',
        }
        # Download
        for name, url in urls.items():
            print(f'Downloading {name}')
            response = requests.get(url)
            if response.status_code == 200:
                zip_path = f'{FOOD_ROOT}/datasets/large/{url.split("/")[-1]}'
                with open(zip_path, 'wb') as f:
                    f.write(response.content)
            else:
                print(f'Failed to download {url}')
        # Unzip the files
        for name, url in urls.items():
            print(f'Unzipping {name}')
            zip_path = f'{FOOD_ROOT}/datasets/large/{url.split("/")[-1]}'
            extract_path = f'{FOOD_ROOT}/datasets/large'
            os.makedirs(extract_path, exist_ok=True)
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(extract_path)
            unzip_name = url.split("/")[-1].replace('.zip', '')
            os.rename(f'{extract_path}/{unzip_name}', f'{extract_path}/{name}')
        # Delete the zip files
        for name, url in urls.items():
            print(f'Removing {name}.zip')
            zip_path = f'{FOOD_ROOT}/datasets/large/{url.split("/")[-1]}'
            os.remove(zip_path)


class UsdaCsvToParquet:
    def __init__(self):
        self.usda_path = f'{FOOD_ROOT}/datasets/large/'

    def load(self, name, food_id_dfs, nutrient_id_dfs, nutrient_dfs):
        print(f'Loading the food CSV for {name}')
        # fdc_id, description
        food_id_df = pd.read_csv(f'{self.usda_path}/{name}/food.csv')
        food_id_df = food_id_df[['fdc_id', 'description']]
        print('Loading the nutrient ID csv')
        # nutrient_id, unit_name, nutrient
        nutrient_id_df = pd.read_csv(f'{self.usda_path}/{name}/nutrient.csv')
        if name == 'survey':
            nutrient_id_df.rename(columns={'nutrient_nbr': 'nutrient_id', 'name': 'nutrient'}, inplace=True)
        else:
            nutrient_id_df.rename(columns={'id': 'nutrient_id', 'name': 'nutrient'}, inplace=True)
        nutrient_id_df = nutrient_id_df[['nutrient_id', 'unit_name', 'nutrient']]
        print('Loading the nutrient dataset')
        # fdc_id, nutrient_id, amount, percent_daily_value
        nutrient_df = pd.read_csv(f'{self.usda_path}/{name}/food_nutrient.csv')
        nutrient_df = nutrient_df[['fdc_id', 'nutrient_id', 'amount']]
        # Register the dataframes
        food_id_dfs.append(food_id_df)
        nutrient_id_dfs.append(nutrient_id_df)
        nutrient_dfs.append(nutrient_df)


    def convert(self):
        """
        Convert the USDA data to a parquet file with only relevant info

        :return: A CSV with the columns fdc_id, description, nutrient, unit_name, amount, percent_daily_value
        """
        # Load dataframes
        food_id_dfs = []
        nutrient_id_dfs = []
        nutrient_dfs = []
        self.load('foundation', food_id_dfs, nutrient_id_dfs, nutrient_dfs)
        self.load('legacy', food_id_dfs, nutrient_id_dfs, nutrient_dfs)
        self.load('survey', food_id_dfs, nutrient_id_dfs, nutrient_dfs)
        self.load('branded', food_id_dfs, nutrient_id_dfs, nutrient_dfs)

        # Concatenate the dfs
        print('Concatenating the dataframes')
        food_id_df = pd.concat(food_id_dfs)
        nutrient_id_df = pd.concat(nutrient_id_dfs)
        nutrient_df = pd.concat(nutrient_dfs)
        nutrient_df.drop_duplicates(inplace=True)

        # Save to parquet
        print(f'Saving to {self.usda_path}')
        food_id_df.to_parquet(f'{self.usda_path}/food_id.parquet', index=False)
        nutrient_id_df.to_parquet(f'{self.usda_path}/nutrient_id.parquet', index=False)
        nutrient_df.to_parquet(f'{self.usda_path}/nutrients.parquet', index=False)


class UsdaParquetSubset:
    def __init__(self):
        self.usda_path = f'{FOOD_ROOT}/datasets/large/'

    def subset(self):
        food_id_df = pd.read_parquet(f'{self.usda_path}/food_id.parquet')
        nutrient_id_df = pd.read_parquet(f'{self.usda_path}/nutrient_id.parquet')
        nutrient_df = pd.read_parquet(f'{self.usda_path}/nutrients.parquet')

        # Locate the chosen foods
        print('Subsetting data')
        with open(f'{FOOD_ROOT}/datasets/usda_food_subset.yaml') as f:
            food_names = yaml.safe_load(f)
        nutrient_sub_dfs = []
        for name, fdc_id in food_names.items():
            subset = nutrient_df[nutrient_df.fdc_id == fdc_id]
            if len(subset) == 0:
                print(f'No data for {name}')
            nutrient_sub_dfs.append(subset)
        nutrient_sub_df = pd.concat(nutrient_sub_dfs)
        nutrient_sub_df.nutrient_id = nutrient_sub_df.nutrient_id.astype(float)

        # Merge with the semantic name tables
        food_df = nutrient_sub_df.merge(food_id_df, on='fdc_id')
        food_df = food_df.merge(nutrient_id_df, on='nutrient_id')
        food_df = food_df.drop(columns=['nutrient_id'])
        food_df.drop_duplicates(inplace=True)

        print('Saving to food_comp.parquet')
        food_df.to_parquet(f'{FOOD_ROOT}/datasets/large/food_comp.parquet', index=False)


class UsdaSmallDownload:
    def __init__(self):
        self.usda_path = f'{FOOD_ROOT}/datasets/large/'
        self.api_key = 'EkYDoeP2gdMW2lgSPghpBXbRol3e5ZLHy0LfGEdo'

    @staticmethod
    def divide_into_batches(input_list, batch_size=25):
        # Use a list comprehension to create batches
        batches = [input_list[i:i + batch_size] for i in range(0, len(input_list), batch_size)]
        return batches

    def subset(self):
        print('Subsetting data')
        with open(f'{FOOD_ROOT}/datasets/usda_food_subset.yaml') as f:
            food_names = yaml.safe_load(f)

        # Don't redownload cached foods
        subset_path = f'{FOOD_ROOT}/datasets/large/food_comp.parquet'
        try:
            subset_df = pd.read_parquet(subset_path)
            cached_fdc_ids = set(subset_df['fdc_id'])
            food_names = {name: fdc_id for name, fdc_id in food_names.items() if fdc_id not in cached_fdc_ids}
        except:
            subset_df = pd.DataFrame()

        print('Downloading from usda')
        batched_food_df = self.download_usda(food_names, mode='abridged')
        missing = self.find_missing(batched_food_df, food_names)
        fixed_food_df = self.download_usda(missing, mode='full')

        # Identify missing foods
        food_df = pd.concat([subset_df, fixed_food_df, batched_food_df])
        missing = self.find_missing(food_df, food_names)
        for name, fdc_id in missing.items():
            print(f'No data for {name}: {fdc_id}')

        # Save to parquet
        print('Saving to food_comp.parquet')
        food_df.to_parquet(f'{FOOD_ROOT}/datasets/large/food_comp.parquet', index=False)

    def download_usda(self, food_names, mode='abridged'):
        # Download the chosen foods using batched REST
        fdc_id_batches = self.divide_into_batches(list(food_names.values()))
        food_info_set = []
        for fdc_ids in fdc_id_batches:
            fdc_id_list = [f'{fdc_id}' for fdc_id in fdc_ids]
            fdc_id_str = ','.join(fdc_id_list)
            url = f'https://api.nal.usda.gov/fdc/v1/foods?fdcIds={fdc_id_str}&format={mode}&api_key={self.api_key}'
            response = requests.get(url)
            if response.status_code != 200:
                print(f'Failed to download food data')
            batch_dict = yaml.safe_load(response.content)
            for food_data in batch_dict:
                for nutrient_info in food_data['foodNutrients']:
                    if mode == 'full':
                        nutrient_info = nutrient_info['nutrient']
                    food_dict = {
                        'fdc_id': food_data['fdcId'],
                        'description': str(food_data['description']),
                        'nutrient': str(nutrient_info['name']),
                        'unit_name': str(nutrient_info['unitName']),
                        'amount': float(nutrient_info['amount']) if 'amount' in nutrient_info else 0,
                    }
                    food_info_set.append(food_dict)
        food_df = pd.DataFrame(food_info_set)
        return food_df

    def find_missing(self, food_df, food_names):
        if len(food_df) == 0:
            return food_names
        fdc_id_sub = set(food_df['fdc_id'])
        return {name: fdc_id for name, fdc_id in food_names.items()
                if fdc_id not in fdc_id_sub}

class UsdaSubsetToYaml:
    def __init__(self):
        df_path = f'{FOOD_ROOT}/datasets/large/food_comp.parquet'
        self.df = pd.read_parquet(df_path)
        self.nmap = None  # Nutrient map
        self.unit_map = None  # Unit map

    def convert(self):
        self.nutrient_map()
        self.fix_columns()
        self.derive_info()
        self.normalize_units()
        self.save()

    def nutrient_map(self):
        # Make a pandas pivot table that turns the values of column 'nutrients' into columns
        self.df = self.df.drop_duplicates(['fdc_id', 'nutrient'])
        self.df = self.df.apply(lambda x: self.normalize_unit_names(x), axis=1)
        self.nmap = self.df.pivot_table(index=['description'],
                                        columns='nutrient',
                                        values='amount')  # 'description', 'unit_name', 'percent_daily_value'
        self.nmap = self.nmap.fillna(0)

    @staticmethod
    def normalize_unit_names(x):
        x = dict(x)
        if x['unit_name'] == 'kJ':
            x['amount'] /= 4.184
            x['unit_name'] = 'KCAL'
        if 'IU' == x['unit_name']:
            return
        elif 'kcal' == x['unit_name'].lower():
            x['unit_name'] = 'kCal'
        else:
            x['unit_name'] = x['unit_name'].lower()
        return pd.Series(x)

    def fix_columns(self):
        columns = {
            # Carbs
            'Carbohydrate, by difference': 'Total carbs',
            'Fiber, total dietary': 'Fiber',
            'Total Sugars': 'Total Sugar',
            'Sugars, added': 'Added Sugar',
            # Fats
            'Fatty acids, total saturated': 'Sat. fat',
            'Fatty acids, total trans': 'Trans. fat',
            'Total lipid (fat)': 'Total fat',
            # Vitamins
            'Thiamin': 'Vitamin B-1, Thiamin',
            'Riboflavin': 'Vitamin B-2, Riboflavin',
            'Niacin': 'Vitamin B-3, Niacin',
            'Pantothenic acid': 'Vitamin B-5, Pantothenic Acid',
            'Vitamin B-6': 'Vitamin B-6',
            'Biotin': 'Vitamin B-7, Biotin',
            'Folate, total': 'Vitamin B-9, Folate',
            'Vitamin B-12': 'Vitamin B-12, Cobalamin',
            'Vitamin C, total ascorbic acid': 'Vitamin C',
            'Vitamin D2 (ergocalciferol)': 'Vitamin D2',
            'Vitamin D3 (cholecalciferol)': 'Vitamin D3',
            'Vitamin E (alpha-tocopherol)': 'Vitamin E',
            # Minerals
            'Iron, Fe': 'Iron',
            'Calcium, Ca': 'Calcium',
            'Copper, Cu': 'Copper',
            # 'a': 'Chloride',
            'Iodine, I': 'Iodine',
            'Sodium, Na': 'Sodium',
            # 'a': 'Sulfur',
            'Potassium, K': 'Potassium',
            'Manganese, Mn': 'Manganese',
            'Phosphorus, P': 'Phosphorus',
            'Fluoride, F': 'Fluoride',
            'Magnesium, Mg': 'Magnesium',
            'Zinc, Zn': 'Zinc',
            'Selenium, Se': 'Selenium',
            # 'a': 'Chromium',
            # 'a': 'Molybdenum',
        }
        self.nmap.rename(columns=columns, inplace=True)
        self.nmap['Name'] = self.nmap.index

        # Drop weird columns
        for col in self.nmap.columns:
            if ':' in col:
                self.nmap.drop(col, axis=1, inplace=True)

    def derive_info(self):
        # Weight (all 100g)
        self.nmap['Weight'] = 100

        # Energy
        self.nmap['Energy'] = self.nmap[['Energy',
                                         'Energy (Atwater General Factors)',
                                         'Energy (Atwater Specific Factors)']].max(axis=1)

        # Vitamin K
        # self.nmap['Vitamin K'] = self.nmap[
        #     ['Vitamin K (phylloquinone)',
        #      'Vitamin K (Dihydrophylloquinone)',
        #      'Vitamin K (Menaquinone-4)']].sum(axis=1)
        self.nmap['Vitamin K'] = self.nmap['Vitamin K (phylloquinone)']

        # Vitamin A, IU
        # ug = .3*IU
        # self.nmap['Vitamin A'] = self.nmap['Vitamin A, IU'] * .3

        self.nmap.apply(lambda x: self.missing_values(x))

        # Carbohydrate, by difference
        # Carbohydrate, by summation
        # Choose the larger maybe?
        # ignoring for now

        # Fat
        # Total fat (NLEA)
        # Total lipid (fat)
        # ignoring for now

        # Vitamin E
        # Vitamin E, added
        # Vitamin E (alpha-tocopherol)
        # ignoring for now

    def normalize_units(self):
        # Describe units
        self.unit_map = self.df[['nutrient', 'unit_name']].drop_duplicates()
        self.unit_map = self.unit_map.set_index('nutrient')
        self.unit_map = self.unit_map.to_dict()['unit_name']
        self.unit_map['Vitamin K'] = self.unit_map['Vitamin K (phylloquinone)']
        # self.unit_map['Energy'] = self.unit_map['Energy (Atwater General Factors)']

        unit_conv = {
            'g': 10**9,
            'mg': 10**6,
            'ug': 10**3,
            'ng': 1,
        }

        # Compare against DV units
        with open(f'{FOOD_ROOT}/datasets/food_dv.yaml', 'r') as f:
            dv_units = yaml.load(f, Loader=yaml.FullLoader)
        for nutrient, unit in self.unit_map.items():
            if nutrient in dv_units:
                if dv_units[nutrient]['unit'] != unit:
                    orig_unit = unit_conv[unit]
                    new_unit = unit_conv[dv_units[nutrient]['unit']]
                    self.unit_map[nutrient] = dv_units[nutrient]
                    self.nmap[nutrient] = self.nmap[nutrient] * new_unit / orig_unit


    @staticmethod
    def missing_values(x):
        # Vitamin D (D2 + D3), International Units
        # Vitamin D (D2 + D3)
        # Vitamin D2 (ergocalciferol)
        # ug = IU / 40
        # D2 = (10/25)*ug
        # D3 = (15/25)*ug
        if 'Vitamin D (D2 + D3)' in x and x['Vitamin D (D2 + D3)'] > 0:
            if x['Vitamin D2'] + x['Vitamin D3'] == 0:
                x['Vitamin D2'] = (10 / 25) * x['Vitamin D (D2 + D3)']
                x['Vitamin D3'] = (15 / 25) * x['Vitamin D (D2 + D3)']

    def save(self):
        pretty_df = list(self.nmap.transpose().to_dict().values())
        lines = []
        for entry in pretty_df:
            lines.append('##############################################')
            lines.append(f"- Name: {entry['Name']}")
            for key, value in entry.items():
                if key != 'Name':
                    lines.append(f"  {key}: {value}")

        new_df_path = f'{FOOD_ROOT}/datasets/large/food_comp.yaml'
        with open(new_df_path, 'w') as f:
            f.write('\n'.join(lines))