class PackedYogurt:
    def __init__(self, plan):
        plan.ingest('STRAWBERRY ZERO SUGAR NONFAT GREEK YOGURT, STRAWBERRY', 170)
        plan.ingest('Peanuts, raw', 40)
        plan.ingest('Protein Powder, Vanilla, Body Fortress', 22)
        plan.ingest('OATS & HONEY GRANOLAS WITH TOASTED COCONUT, OATS & HONEY WITH TOASTED COCONUT', 20)
        plan.ingest('Almond Butter Clusters 10g Protein, KIND', 20)


class ChickenSandwhich:
    def __init__(self, plan, scale=1):
        # Main Dish
        plan.ingest('Peppers, bell, red, raw', 28*scale)
        plan.ingest('Peppers, bell, green, raw', 21*scale)
        plan.ingest('Peppers, bell, orange, raw', 20*scale)
        plan.ingest('Peppers, bell, yellow, raw', 35*scale)
        plan.ingest('Onions, yellow, raw', 24*scale)
        plan.ingest('Avocado, raw', 50*scale)
        plan.ingest('Tomato, roma', 40*scale)
        plan.ingest('Lettuce, romaine, green, raw', 40*scale)
        plan.ingest('WHOLE WHEAT BREAD', 100*scale)
        plan.ingest('Chicken breast, rotisserie, skin not eaten', 100*scale)

        # Sides
        plan.ingest('Beets, Canned, Sliced, Del Monte', 234)
        CookedAsparagus(plan, 100)


class GarlicSpinach:
    def __init__(self, plan):
        plan.ingest('Spinach, raw', 100)
        plan.ingest('Garlic, raw', 5)
        plan.ingest('Olive Oil, Extra Virgin, Kirkland', 5)


class CookedSpinach:
    def __init__(self, plan):
        """
        Instructions:
        https://www.loveandlemons.com/sauteed-spinach/

        Ingredients
        5 oz mature spinach
        1 garlic clove (minced)
        2 tsp extra virgin olive oil
        1/4 tsp of salt
        Some lemon.

        Instructions:
        1. Put raw spinach in a drainable container.
        2. Pour boiling water slowly over the spinach until leafy green.
        3. Add two tsp extra virgin olive oil to pan. Medium heat.
        4. Add garlic. Cook for 30ish seconds.
        5. Add spinach + salt. Cook for 1 - 2 minutes.
        6. Remove from heat. Season with lemon juice + black pepper.
        """
        plan.ingest('Spinach, mature', 100)
        plan.ingest('Oil, olive, extra virgin', 5)
        plan.ingest('Garlic, raw', 5)


class CookedAsparagus:
    def __init__(self, plan, weight):
        plan.ingest('Asparagus, raw', weight)
        plan.ingest('Oil, olive, extra virgin', 5 * (weight / 100))


class CoconutPancake:
    def __init__(self, plan):
        """
        Instructions:
        https://www.twospoons.ca/vegan-coconut-flour-pancakes/

        Ingredients:
        1.5 cups almond milk
        1/2 banana
        1/4 cup coconut flour
        1 tsp baking flour
        1/4 tsp baking soda
        Some salt
        Some oil for greasing pan.

        Toppings:
        Maple syrup
        Butter

        Instructions:
        Combine main ingredients and blend until smooth.
        Grease nonstick pan. Stir up the batter.
        Pour approximately 2TBSP per pancake.


        :param plan:
        """
        plan.ingest('Almond milk, unsweetened, plain, refrigerated')



class TonySalmon:
    def __init__(self, plan):
        plan.ingest('Fish, salmon, Atlantic, farm raised, raw', 137)
        plan.ingest('Oil, olive, extra virgin', 5)
        plan.ingest('Peppers, bell, red, raw', 73)
        plan.ingest('Peppers, jalapeno, raw', 37)
        plan.ingest('SPANISH RICE, SPANISH', 130)


class SalmonDinner:
    def __init__(self, plan, salmon='fresh'):
        """
        Instructions:
        https://www.lecremedelacrumb.com/best-easy-healthy-baked-salmon/

        4 servings:
        1. Preheat oven to 400f
        2. Place salmon on baking sheet. Season salt + pepper.
        3. Combine olive oil, salt, cracked black pepper, minced garlic, italian herbs, and 1/2 lemon.
        Make sure to zest the lemon.
        4. Coat the salmon in the seasoning.
        5. Thinly slice the other 1/2 of the lemon and place on the salmon
        6. Bake for 12 - 15 minutes.
        7. Broil for 2 minutes.
        8. Garnish with thyme/parsley
        """
        if salmon == 'fresh':
            plan.ingest('Fish, salmon, sockeye, wild caught, raw', 170)
        else:
            plan.ingest('Fish, salmon, Atlantic, farm raised, raw', 170)
        plan.ingest('Oil, olive, extra virgin', 4)
        plan.ingest('PINK HIMALAYAN SALT, PINK', .300)  # 300 mg
        plan.ingest('Rice, brown, long grain, unenriched, raw', 125)

        # plan.ingest('SIGNATURE MASHED POTATOES', 125)
        plan.ingest('Green Beans, Canned, Del Monte', 40)
        plan.ingest('Sweet Peas, Canned, Del Monte', 40)
        CookedSpinach(plan)


class ProteinMilk:
    def __init__(self, plan):
        plan.ingest('Almond milk, unsweetened, plain, refrigerated', 334)
        plan.ingest('Protein Powder, Vanilla, Body Fortress', 22)


class VeggieHumus:
    def __init__(self, plan):
        plan.ingest('Broccoli, raw', 115)
        plan.ingest('Carrots, baby, raw', 100)
        plan.ingest('Sabra Roasted Pine Nut Humus', 20)


class SpaghettiSquash:
    def __init__(self, plan):
        plan.ingest('Spaghetti squash, cooked', 130)
        plan.ingest('Prego Hidden Super Veggies Traditional Pasta Sauce, 24 oz Jar', 110)
