class PackedYogurt:
    def __init__(self, plan):
        plan.ingest('STRAWBERRY ZERO SUGAR NONFAT GREEK YOGURT, STRAWBERRY', 170)
        plan.ingest('Peanuts, raw', 40)
        plan.ingest('Protein Powder, Vanilla, Body Fortress', 22)
        plan.ingest('OATS & HONEY GRANOLAS WITH TOASTED COCONUT, OATS & HONEY WITH TOASTED COCONUT', 20)
        plan.ingest('Almond Butter Clusters 10g Protein, KIND', 20)


class ChickenSandwhich:
    def __init__(self, plan, scale=1):
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


class GarlicSpinach:
    def __init__(self, plan):
        plan.ingest('Spinach, raw', 100)
        plan.ingest('Garlic, raw', 5)
        plan.ingest('Olive Oil, Extra Virgin, Kirkland', 5)


class CookedSpinach:
    def __init__(self, plan):
        plan.ingest('Spinach, raw', 100)
        plan.ingest('Oil, olive, extra virgin', 5)
        plan.ingest('Garlic, raw', 5)


class SalmonDinner:
    def __init__(self, plan, salmon='fresh'):
        """


        :param plan:
        :param salmon:
        """
        if salmon == 'fresh':
            plan.ingest('Fish, salmon, sockeye, wild caught, raw', 100)
        else:
            plan.ingest('Fish, salmon, Atlantic, farm raised, raw', 100)
        plan.ingest('Oil, olive, extra virgin', 4)
        plan.ingest('PINK HIMALAYAN SALT, PINK', .005)  # 5 mg
        plan.ingest('SIGNATURE MASHED POTATOES', 125)
        plan.ingest('Green Beans, Canned, Del Monte', 40)
        plan.ingest('Sweet Peas, Canned, Del Monte', 40)
        CookedSpinach(plan)


class TonySalmon:
    def __init__(self, plan):
        plan.ingest('Fish, salmon, Atlantic, farm raised, raw', 137)
        plan.ingest('Oil, olive, extra virgin', 5)
        plan.ingest('Peppers, bell, red, raw', 73)
        plan.ingest('Peppers, jalapeno, raw', 37)
        plan.ingest('SPANISH RICE, SPANISH', 130)


class ProteinMilk:
    def __init__(self, plan):
        plan.ingest('Almond milk, unsweetened, plain, refrigerated', 334)
        plan.ingest('Protein Powder, Vanilla, Body Fortress', 22)


class VeggieHumus:
    def __init__(self, plan):
        plan.ingest('Broccoli, raw', 100)
        plan.ingest('Carrots, baby, raw', 100)
        plan.ingest('Sabra Roasted Pine Nut Humus', 20)


class SpaghettiSquash:
    def __init__(self, plan):
        plan.ingest('Spaghetti squash, cooked', 130)
        plan.ingest('Prego Hidden Super Veggies Traditional Pasta Sauce, 24 oz Jar', 110)
