from foods.usda import UsdaCsvToParquet, UsdaParquetSubset, UsdaSubsetToYaml
from foods.meal_plan import MealPlan, FOOD_ROOT
from jarvis_util import *


class FoodArgs(ArgParse):
    def define_options(self):
        self.jutil = JutilManager.get_instance()
        self.add_menu()
        # usda summarize
        self.add_cmd('usda summarize',
                      msg='Convert the USDA CSV files to a single, large parquet')
        self.add_args([
            {
                'name': 'usda_path',
                'msg': 'Directory containing the CSV files.',
                'required': True,
                'pos': True
            },
            {
                'name': 'food_conv_path',
                'msg': 'Where to place the final parquet.',
                'required': True,
                'pos': True
            },
        ])

        # usda subset
        self.add_cmd('usda subset',
                     msg='Convert the USDA parquet to a subset'
                         'defined in datasets/usda/food_names.yaml')
        self.add_args([
            {
                'name': 'food_conv_path',
                'msg': 'The full parquet file.',
                'required': True,
                'pos': True
            },
        ])

        # usda normalize
        self.add_cmd('usda normalize',
                     msg='Convert the USDA parquet to a human-readable YAML format'
                         'defined in datasets/usda/food_comp.yaml')



        # man summarize
        self.add_cmd('make index',
                     msg=['Get the name of all foods in the manual and usda subsets'])

    def usda_summarize(self):
        conv = UsdaCsvToParquet(self.kwargs['usda_path'],
                         self.kwargs['food_conv_path'])
        conv.convert()

    def usda_subset(self):
        sub = UsdaParquetSubset(self.kwargs['food_conv_path'])
        sub.subset()

    def usda_normalize(self):
        norm = UsdaSubsetToYaml()
        norm.convert()

    def make_index(self):
        food_df = MealPlan.load_food_composition()
        names = list(food_df['Name'])
        names.sort()
        with open(f'{FOOD_ROOT}/datasets/food_names.yaml', 'w') as f:
            yaml.dump(names, f)


if __name__ == '__main__':
    args = FoodArgs()
    args.process_args()
