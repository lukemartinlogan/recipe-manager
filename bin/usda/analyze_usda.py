import pandas as pd
import yaml
import math
from foods.meal_plan import MealPlan
from foods.packed_yogurt import PackedYogurt


plan = MealPlan(2300)
# plan.ingest('almond_milk', 500)
# plan.ingest('body_fortress', 20)
#
# plan.ingest('babby_carrots', 40)
# plan.ingest('broccoli', 100)
# plan.ingest('mango', 120)
plan.ingest('pinto_beans_bush', 80)
# plan.ingest('beets_del_monte_canned', 234)
# plan.ingest('green_beans_del_monte_canned', 120)

# Packed Yogurt
plan.ingest('chicken_breast', 200)
plan.ingest('wild_salmon', 200)
PackedYogurt(plan)

plan.report()
