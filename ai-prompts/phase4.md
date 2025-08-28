It still seems to either not be fully loading or infinitely refreshing. 

In addition, the quantity on the meal tiles do not match the quantities on the recipe page. These two should be linked. 

# User Profile
Create a SQLite database for storing user accounts. Passwords are not required. Sign in should fail if the username does not exist.

# Main page
We should make it so the grocery list button only appears if a user is signed in. There should be a sign in button in the main menu bar. 

We should store a SQLite database for the current value of meal quantities for the particular user. Meals with no quantity can be removed from the database. This quantity is shared between the recipe page and the main page if the user is signed in. Otherwise, on recipe pages, the meal quantity is set only within the javascript for the particular instance. 