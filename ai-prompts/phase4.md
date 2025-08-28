It still seems to either not be fully loading or infinitely refreshing. 

In addition, the quantity on the meal tiles do not match the quantities on the recipe page. These two should be linked. 

# User Profile
Create a SQLite database for storing user accounts. Passwords are not required. Sign in should fail if the username does not exist.

# Main page
We should make it so the grocery list button only appears if a user is signed in. There should be a sign in button in the main menu bar. 

We should store a SQLite database for the current value of meal quantities for the particular user. Meals with no quantity can be removed from the database. This quantity is shared between the recipe page and the main page if the user is signed in. Otherwise, on recipe pages, the meal quantity is set only within the javascript for the particular instance. 

# Small Bugs

Resetting all quantities doesn't change the quantities in the original meal page. It should. 

Changing the quantities in the meal page (or on the recipe pages) should automatically add meals to the grocery list and the ingredient sets. In addition, we need to fix the checkboxes for recipe markdown files. I cannot click or unclick them. They just appear greyed out. I want them interactive.

We should make it so the quantity button does not appear if the user is not signed in for the meal tiles. It should still appear in the recipes though.

The grocery list should be stored per-user in the database. When I click on a checkbox, the entry should crossed out and greyed. There should be an up-down arrow icon at the end of each ingredient entry allowing the position of the entry on the screen to be updated. If i sign in on another machine or phone, the grocery list should appear exactly the same on each device.

 Remove the arrows from each entry in the grocery list ingredients section. I see no dragging events being triggered when I attempt click and drag. The entry should be snapped  to the cursor as I am dragging. As I'm dragging, list entries should move up or down depending on the insertion point. 

Create a simple docker container for this repo. The image should clone the repo https://github.com/lukemartinlogan/foods.git. Running the container should do git pull and then npm run. Also create bash script to build the container and upload to dockerhub. My dockerhub username is lukemartinlogan