# Website Design

Build a small self-hosted website for hosting recipes. Each recipe should be its own file in markdown format. Use some service to compile the recipe into HTML. This website does not require logging in or authentication. Use nodejs for the server. Do not use databases in this project.

## Main Page

### Menu Bar

This bar should be fixed on the screen. So when users scroll, it will stay in place and not disappear.

In the top middle, there should be a search bar. It will search recipes based on their name.

### Recipe Selection

Each recipe should be a clickable tile. When I click on the recipe it should take us to the page for the recipe.

Each recipe should have an image and a page.

### Recipe Page.

Each recipe has the following sections: Ingredients, Steps, and Nutrition Info.

The ingredients section should have a form to multiply the ingredient quantities.

Each ingredient should essentially render to a javascript variable. 

In the markdown, I should be able to reference variable names using $$.

Here is an example markdown:

```
# Chicken Sandwhich

## Ingredients

* $chicken = 1/4lb$ 
* $black pepper = 1tsp$
* $liquid smoke = 1/2tsp$ 

## Steps

* Put $black pepper$ and $liquid smoke$ on chicken
* Heat up stove to medium-high
* Put chicken on stove and char in olive oil
* Put chicken in oven for 15 minutes

## Nutrition Info

* 10g fat
* 50g carbs
```

It should render to:
```
# Chicken Sandwhich

## Ingredients

* 1/4lb of chicken
* 1tsp of black pepper
* 1/2tsp of liquid smoke

## Steps

* Put 1tsp of black pepper and 1/2tsp of liquid smoke on chicken
* Heat up stove to medium-high
* Put chicken on stove and char in olive oil
* Put chicken in oven for 15 minutes

## Nutrition Info

* 10g fat
* 50g carbs
```