import json
import sys
import yaml
import pandas as pd
from foods.meal_plan import MealPlan, FOOD_ROOT


class UsdaCsvToParquet:

    def __init__(self, usda_path, food_conv_path):
        self.usda_path = usda_path
        self.food_conv_path = food_conv_path
        self.usda_path = self.usda_path.replace('\\', '/')
        self.food_conv_path = self.food_conv_path.replace('\\', '/')

    def convert(self):
        """
        Convert the USDA data to a parquet file with only relevant info

        :return: A CSV with the columns fdc_id, description, nutrient, unit_name, amount, percent_daily_value
        """
        print('Food CSV')
        # fdc_id, description
        food_id_df = pd.read_csv(f'{self.usda_path}/food.csv')
        food_id_df = food_id_df[['fdc_id', 'description']]
        print('NUTRIENT ID CSV')
        # nutrient_id, unit_name, nutrient
        nutrient_id_df = pd.read_csv(f'{self.usda_path}/nutrient.csv')
        nutrient_id_df.rename(columns={'id': 'nutrient_id', 'name': 'nutrient'}, inplace=True)
        nutrient_id_df = nutrient_id_df[['nutrient_id', 'unit_name', 'nutrient']]
        print('NUTRIENT CSV')
        # fdc_id, nutrient_id, amount, percent_daily_value
        nutrient_df = pd.read_csv(f'{self.usda_path}/food_nutrient.csv')
        nutrient_df = nutrient_df[['fdc_id', 'nutrient_id', 'amount', 'percent_daily_value']]

        # Join the dataframes
        print('Joining dataframes')
        food_df = food_id_df.merge(nutrient_df, on='fdc_id')
        food_df = food_df.merge(nutrient_id_df, on='nutrient_id')
        food_df = food_df.drop(columns=['nutrient_id'])

        # Save to parquet
        # fdc_id, nutrient, unit_name, amount, percent_daily_value
        print(f'Saving to {self.food_conv_path}')
        food_df.to_parquet(self.food_conv_path, index=False)


class UsdaParquetSubset:
    def __init__(self, food_conv_path):
        self.food_conv_path = food_conv_path
        self.food_conv_path = self.food_conv_path.replace('\\', '/')

    def subset(self):
        print(self.food_conv_path)
        food_comp = pd.read_parquet(self.food_conv_path)

        print('Subsetting data')
        # Other
        with open(f'{FOOD_ROOT}/datasets/usda/food_names.yaml') as f:
            food_names = yaml.safe_load(f)

        dfs = []
        for key, value in food_names.items():
            dfs.append(food_comp[food_comp.fdc_id == value])
        dfs = pd.concat(dfs)

        # Make a dict is a list of the

        print('Saving to food_comp.parquet')
        dfs.to_parquet(f'{FOOD_ROOT}/datasets/usda/food_comp.parquet', index=False)


class UsdaSubsetToYaml:
    def __init__(self):
        df_path = f'{FOOD_ROOT}/datasets/usda/food_comp.parquet'
        self.df = pd.read_parquet(df_path)
        self.nmap = None  # Nutrient map
        self.unit_map = None  # Unit map

    def convert(self):
        self.nutrient_map()
        self.fix_columns()
        self.derive_info()
        self.normalize_units()
        self.save()

    @staticmethod
    def normalize_unit_names(x):
        if x == 'kJ':
            return x
        elif 'IU' == x:
            return x
        elif 'KCAL' == x:
            return 'kCal'
        else:
            return x.lower()

    def nutrient_map(self):
        # Make a pandas pivot table that turns the values of column 'nutrients' into columns
        self.df = self.df.drop_duplicates(['fdc_id', 'nutrient'])
        self.nmap = self.df.pivot_table(index=['description'],
                                        columns='nutrient',
                                        values='amount')  # 'description', 'unit_name', 'percent_daily_value'
        self.nmap = self.nmap.fillna(0)

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
        self.nmap['Energy'] = self.nmap[['Energy (Atwater General Factors)',
                                         'Energy (Atwater Specific Factors)']].max()

        # Vitamin K
        self.nmap['Vitamin K'] = self.nmap[
            ['Vitamin K (phylloquinone)',
             'Vitamin K (Dihydrophylloquinone)',
             'Vitamin K (Menaquinone-4)']].sum(axis=1)

        # Vitamin A, IU
        # ug = .3*IU
        self.nmap['Vitamin A'] = self.nmap['Vitamin A, IU'] * .3

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
        self.df['unit_name'] = self.df['unit_name'].apply(lambda x: self.normalize_unit_names(x))
        self.unit_map = self.df[['nutrient', 'unit_name']].drop_duplicates()
        self.unit_map = self.unit_map.set_index('nutrient')
        self.unit_map = self.unit_map.to_dict()['unit_name']
        self.unit_map['Vitamin K'] = self.unit_map['Vitamin K (phylloquinone)']
        self.unit_map['Energy'] = self.unit_map['Energy (Atwater General Factors)']

        unit_conv = {
            'g': 10**9,
            'mg': 10**6,
            'ug': 10**3,
            'ng': 1
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

        new_df_path = f'{FOOD_ROOT}/datasets/usda/food_comp.yaml'
        with open(new_df_path, 'w') as f:
            f.write('\n'.join(lines))