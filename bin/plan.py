from foods.meal_plan import MealPlan
from foods.meals import *


plan = MealPlan(2200)

# Breakfast
plan.ingest('Eggs, Grade A, Large, egg whole', 50)
PackedYogurt(plan)
ProteinMilk(plan)

# Snack
plan.ingest('Mangos, raw', 100)

# Lunch
ChickenSandwhich(plan)

# Snack
VeggieHumus(plan)
plan.ingest('Grapes, red, seedless, raw', 40)
plan.ingest('SKINNY POP, POPCORN PACK', 40)

# Dinner
# SalmonDinner(plan)
# TonySalmon(plan)
SpaghettiSquash(plan)

plan.report('today')
