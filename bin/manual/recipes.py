from foods.meal_plan import MealPlan


plan = MealPlan(2000)

# Protein Drink
# plan.ingest('Almond Milk Unsweetened', 334)
# plan.ingest('Protein Powder, Vanilla, Body Fortress', 44)

# Vegetable Snack
# plan.ingest('Broccoli', 80)
# plan.ingest('Sabra Roasted Pine Nut Humus', 60)

# Breakfast
# plan.ingest('Chobani Zero Sugar Strawberry Yogurt', 120)
# plan.ingest('Peanuts', 30)
# plan.ingest('Oats & Honey Granola with Coconut, KIND', 20)
# plan.ingest('Almond Butter Clusters 10g Protein, KIND', 20)
plan.ingest('Pear', 140)

# Lunch
# plan.ingest('Home Run Inn Personal - Uncured Pepperoni', 220)

# Chicken
# Green Beans
# Quinoa

plan.report()
