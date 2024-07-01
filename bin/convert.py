from foods.usda import UsdaCsvToParquet, UsdaParquetSubset, UsdaSubsetToYaml, UsdaDownload
from foods.meal_plan import MealPlan, FOOD_ROOT
from jarvis_util import *


class FoodArgs(ArgParse):
    def define_options(self):
        self.jutil = JutilManager.get_instance()
        self.add_menu()
        # usda download
        self.add_cmd('usda download',
                     msg='Download the USDA CSV files')

        # usda summarize
        self.add_cmd('usda combine',
                      msg='Convert the USDA CSV files to a single, large parquet')

        # usda subset
        self.add_cmd('usda subset',
                     msg='Convert the USDA parquet to a subset'
                         'defined in datasets/usda/food_names.yaml')

        # usda normalize
        self.add_cmd('usda normalize',
                     msg='Convert the USDA parquet to a human-readable YAML format'
                         'defined in datasets/usda/food_comp.yaml')



        # man summarize
        self.add_cmd('make index',
                     msg=['Get the name of all foods in the manual and usda subsets'])

    def usda_download(self):
        download = UsdaDownload()
        download.download()

    def usda_combine(self):
        conv = UsdaCsvToParquet()
        conv.convert()

    def usda_subset(self):
        sub = UsdaParquetSubset()
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
