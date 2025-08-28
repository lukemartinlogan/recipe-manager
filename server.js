const express = require('express');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');

// Configure marked for GitHub-flavored markdown with checkboxes
marked.setOptions({
  gfm: true,
  breaks: true,
});

const app = express();
const PORT = process.env.PORT || 3001;

// Session configuration
app.use(session({
  secret: 'recipe-app-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize SQLite database
const db = new sqlite3.Database('recipes.db');

// Create tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Meal quantities table
  db.run(`CREATE TABLE IF NOT EXISTS meal_quantities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    recipe_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    UNIQUE(user_id, recipe_id)
  )`);
});

// Recipe parser with variable substitution
class RecipeParser {
  static parseRecipe(markdown) {
    // Extract variables from ingredients section
    const variables = {};
    const ingredientRegex = /\$([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([^$]+)\$/g;
    
    let match;
    while ((match = ingredientRegex.exec(markdown)) !== null) {
      const [fullMatch, varName, value] = match;
      variables[varName] = value.trim();
    }
    
    return { variables, originalMarkdown: markdown };
  }

  static substituteVariables(markdown, variables, multiplier = 1, availableCups = []) {
    let processed = markdown;
    
    // Replace variable definitions with clean ingredient list
    Object.entries(variables).forEach(([varName, value]) => {
      const definitionRegex = new RegExp(`\\$${varName}\\s*=\\s*[^$]+\\$`, 'g');
      const scaledValue = this.scaleIngredient(value, multiplier, availableCups);
      const ingredientName = varName.replace(/_/g, ' ');
      processed = processed.replace(definitionRegex, `${scaledValue} of ${ingredientName}`);
    });
    
    // Replace variable references with actual values
    Object.entries(variables).forEach(([varName, value]) => {
      const referenceRegex = new RegExp(`\\$${varName}\\$`, 'g');
      const scaledValue = this.scaleIngredient(value, multiplier, availableCups);
      const ingredientName = varName.replace(/_/g, ' ');
      processed = processed.replace(referenceRegex, `${scaledValue} of ${ingredientName}`);
    });
    
    return processed;
  }

  static scaleIngredient(ingredient, multiplier, availableCups = []) {
    if (multiplier === 1) return ingredient;
    
    // Parse the ingredient for amount and unit
    const measurementMatch = ingredient.match(/(\d*\.?\d+(?:\/\d+)?)\s*([a-zA-Z]+)/);
    if (!measurementMatch) {
      // No measurement found, just scale numbers
      const numberMatch = ingredient.match(/(\d*\.?\d+)/);
      if (numberMatch) {
        const number = parseFloat(numberMatch[1]);
        const scaledNumber = number * multiplier;
        return ingredient.replace(/\d*\.?\d+/, scaledNumber.toString());
      }
      return ingredient;
    }
    
    const [, amountStr, unit] = measurementMatch;
    let amount = this.parseFraction(amountStr);
    const scaledAmount = amount * multiplier;
    
    // Convert to best available measuring cups
    const optimized = this.optimizeMeasurement(scaledAmount, unit, availableCups);
    
    return ingredient.replace(/\d*\.?\d+(?:\/\d+)?\s*[a-zA-Z]+/, optimized);
  }
  
  static parseFraction(str) {
    if (str.includes('/')) {
      const [num, den] = str.split('/');
      return parseFloat(num) / parseFloat(den);
    }
    return parseFloat(str);
  }
  
  static optimizeMeasurement(amount, unit, availableCups) {
    const conversions = {
      'tsp': 1, 'tbsp': 3, 'cup': 48,
      'oz': 1, 'lb': 16
    };
    
    // Define measurement hierarchy for volume (tsp base)
    const volumeMeasurements = [
      { name: '1cup', value: 48, display: '1cup' },
      { name: '1/2cup', value: 24, display: '½cup' },
      { name: '1/3cup', value: 16, display: '⅓cup' },
      { name: '1/4cup', value: 12, display: '¼cup' },
      { name: '1/8cup', value: 6, display: '⅛cup' },
      { name: '1.5tbsp', value: 4.5, display: '1½tbsp' },
      { name: '1tbsp', value: 3, display: '1tbsp' },
      { name: '1tsp', value: 1, display: '1tsp' },
      { name: '1/2tsp', value: 0.5, display: '½tsp' },
      { name: '1/4tsp', value: 0.25, display: '¼tsp' }
    ];
    
    // Weight measurements (oz base)
    const weightMeasurements = [
      { name: '1lb', value: 16, display: '1lb' },
      { name: '1oz', value: 1, display: '1oz' }
    ];
    
    // Determine if this is volume or weight
    const isVolume = ['tsp', 'tbsp', 'cup'].includes(unit);
    const isWeight = ['oz', 'lb'].includes(unit);
    
    if (isVolume) {
      // Convert to base tsp
      const totalTsp = amount * (conversions[unit] || 1);
      return this.findBestCombination(totalTsp, volumeMeasurements, availableCups);
    } else if (isWeight) {
      // Convert to base oz
      const totalOz = amount * (conversions[unit] || 1);
      return this.findBestCombination(totalOz, weightMeasurements, availableCups);
    } else {
      // Unknown unit, just scale the number
      return `${amount}${unit}`;
    }
  }
  
  static findBestCombination(totalAmount, measurements, availableCups) {
    // Filter measurements to only available cups
    const available = measurements.filter(m => 
      availableCups.includes(m.name) || m.name.includes('lb') || m.name.includes('oz')
    );
    
    if (available.length === 0) {
      // No available measurements, return decimal
      return `${totalAmount.toFixed(2)}${measurements[measurements.length - 1].name.replace(/^[\d\/\.]+/, '')}`;
    }
    
    // Try to find exact matches first
    for (const measure of available) {
      if (Math.abs(totalAmount - measure.value) < 0.001) {
        return measure.display;
      }
    }
    
    // Find best combination using greedy algorithm
    let remaining = totalAmount;
    const result = [];
    
    for (const measure of available) {
      if (remaining >= measure.value - 0.001) {
        const count = Math.floor(remaining / measure.value + 0.001);
        remaining -= count * measure.value;
        
        if (count === 1) {
          result.push(measure.display);
        } else {
          result.push(`${count} ${measure.display}`);
        }
      }
    }
    
    // Handle any remaining fractional amount
    if (remaining > 0.001) {
      const smallestUnit = available[available.length - 1];
      const fraction = this.decimalToFraction(remaining / smallestUnit.value);
      const unitName = smallestUnit.name.replace(/^[\d\/\.]+/, '');
      result.push(`${fraction}${unitName}`);
    }
    
    return result.join(' + ') || `${totalAmount}${measurements[measurements.length - 1].name.replace(/^[\d\/\.]+/, '')}`;
  }
  
  static decimalToFraction(decimal) {
    // Convert decimal to common fractions
    const commonFractions = [
      [0.25, '¼'], [0.333, '⅓'], [0.5, '½'], [0.666, '⅔'], [0.75, '¾']
    ];
    
    for (const [value, fraction] of commonFractions) {
      if (Math.abs(decimal - value) < 0.05) {
        return fraction;
      }
    }
    
    // If not a common fraction, return as decimal
    return decimal.toFixed(2);
  }
}

// Get all recipe files
function getRecipes() {
  const recipesDir = path.join(__dirname, 'recipes');
  if (!fs.existsSync(recipesDir)) {
    fs.mkdirSync(recipesDir);
    return [];
  }
  
  const files = fs.readdirSync(recipesDir);
  return files.filter(file => file.endsWith('.md')).map(file => {
    const filePath = path.join(recipesDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const { variables } = RecipeParser.parseRecipe(content);
    
    // Extract title from first line
    const titleMatch = content.match(/^#\s*(.+)$/m);
    const title = titleMatch ? titleMatch[1] : file.replace('.md', '');
    
    return {
      id: file.replace('.md', ''),
      title,
      filename: file,
      variables
    };
  });
}

// Authentication routes
app.post('/auth/signin', (req, res) => {
  const { username } = req.body;
  
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }
  
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Username does not exist' });
    }
    
    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ success: true, username: user.username });
  });
});

app.post('/auth/signup', (req, res) => {
  const { username } = req.body;
  
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }
  
  db.run('INSERT INTO users (username) VALUES (?)', [username], function(err) {
    if (err) {
      if (err.code === 'SQLITE_CONSTRAINT') {
        return res.status(409).json({ error: 'Username already exists' });
      }
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    req.session.userId = this.lastID;
    req.session.username = username;
    res.json({ success: true, username });
  });
});

app.post('/auth/signout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/auth/status', (req, res) => {
  if (req.session.userId) {
    res.json({ signedIn: true, username: req.session.username });
  } else {
    res.json({ signedIn: false });
  }
});

// Routes
app.get('/', (req, res) => {
  console.log('Main page request received from:', req.ip);
  
  try {
    const recipes = getRecipes();
    console.log('Recipes loaded:', recipes.length);
    const isSignedIn = !!req.session.userId;
    console.log('User signed in:', isSignedIn);
    console.log('About to send response');
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recipe Collection</title>
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <nav class="menu-bar">
        <div class="nav-content">
            <div class="search-container">
                <input type="text" id="searchInput" placeholder="Search recipes...">
            </div>
            <div class="auth-controls">
                ${isSignedIn ? `
                    <span class="username-display">Hello, ${req.session.username}!</span>
                    <a href="/grocery-list" class="grocery-list-btn">📝 Grocery List</a>
                    <button class="sign-out-btn" onclick="signOut()">Sign Out</button>
                ` : `
                    <button class="sign-in-btn" onclick="showSignInModal()">Sign In</button>
                `}
            </div>
        </div>
    </nav>
    
    <div class="main-content">
        <h1>Recipe Collection</h1>
        <div class="recipe-grid" id="recipeGrid">
            ${recipes.map(recipe => `
                <div class="recipe-tile" data-recipe-id="${recipe.id}">
                    <div class="recipe-image">
                        <img src="/images/${recipe.id}.jpg" alt="${recipe.title}">
                    </div>
                    <div class="recipe-info">
                        <h3 class="recipe-title">${recipe.title}</h3>
                        ${isSignedIn ? `
                        <div class="quantity-control">
                            <label>Qty:</label>
                            <input type="number" class="meal-quantity" data-recipe-id="${recipe.id}" value="0" min="0" step="1">
                        </div>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
    
    <!-- Sign-in Modal -->
    <div id="signInModal" class="modal" style="display: none;">
        <div class="modal-content">
            <span class="close" onclick="closeSignInModal()">&times;</span>
            <h2>Sign In</h2>
            <form id="signInForm">
                <input type="text" id="usernameInput" placeholder="Username" required>
                <div class="modal-buttons">
                    <button type="submit">Sign In</button>
                    <button type="button" onclick="signUp()">Create Account</button>
                </div>
            </form>
            <div id="authError" class="error-message"></div>
        </div>
    </div>
    
    <script>
        const isSignedIn = ${isSignedIn};
        const currentUser = ${isSignedIn ? `"${req.session.username}"` : 'null'};
    </script>
    <script src="/script-minimal.js"></script>
</body>
</html>
  `);
    console.log('Response sent successfully');
  } catch (error) {
    console.error('Error in main route:', error);
    res.status(500).send('Server error');
  }
});

app.get('/recipe/:id', (req, res) => {
  const recipeId = req.params.id;
  const quantity = parseFloat(req.query.quantity) || 1;
  const recipePath = path.join(__dirname, 'recipes', `${recipeId}.md`);
  
  if (!fs.existsSync(recipePath)) {
    return res.status(404).send('Recipe not found');
  }
  
  const content = fs.readFileSync(recipePath, 'utf8');
  const { variables } = RecipeParser.parseRecipe(content);
  
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recipe: ${recipeId}</title>
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <nav class="menu-bar">
        <div class="nav-content">
            <a href="/" class="home-btn">← Back to Recipes</a>
        </div>
    </nav>
    
    <div class="main-content recipe-content">
        <div class="recipe-controls">
            <div class="controls-section">
                <div class="multiplier-control">
                    <label>Servings: </label>
                    <input type="number" id="multiplier" value="${quantity}" min="0.25" step="0.25" onchange="updateRecipe()">
                </div>
                <div class="measuring-cups-control">
                    <label>Available Measuring Cups:</label>
                    <div class="cups-checkboxes">
                        <label><input type="checkbox" value="1/4tsp" checked> ¼tsp</label>
                        <label><input type="checkbox" value="1/2tsp" checked> ½tsp</label>
                        <label><input type="checkbox" value="1tsp" checked> 1tsp</label>
                        <label><input type="checkbox" value="1tbsp" checked> 1tbsp</label>
                        <label><input type="checkbox" value="1.5tbsp" checked> 1½tbsp</label>
                        <label><input type="checkbox" value="1/8cup" checked> ⅛cup</label>
                        <label><input type="checkbox" value="1/4cup" checked> ¼cup</label>
                        <label><input type="checkbox" value="1/3cup" checked> ⅓cup</label>
                        <label><input type="checkbox" value="1/2cup" checked> ½cup</label>
                        <label><input type="checkbox" value="1cup" checked> 1cup</label>
                    </div>
                </div>
            </div>
        </div>
        <div id="recipeDisplay"></div>
    </div>
    
    <script>
        const originalMarkdown = \`${content.replace(/`/g, '\\`')}\`;
        const variables = ${JSON.stringify(variables)};
        
        function updateRecipe() {
            const multiplier = parseFloat(document.getElementById('multiplier').value) || 1;
            const selectedCups = Array.from(document.querySelectorAll('.cups-checkboxes input[type="checkbox"]:checked'))
                .map(cb => cb.value);
            
            // Save quantity if user is signed in
            if (${!!req.session.userId}) {
                fetch('/api/meal-quantity', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        recipeId: '${recipeId}', 
                        quantity: multiplier 
                    })
                }).catch(error => console.error('Error saving quantity:', error));
            }
            
            fetch('/api/process-recipe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    markdown: originalMarkdown, 
                    variables, 
                    multiplier, 
                    availableCups: selectedCups 
                })
            })
            .then(response => response.json())
            .then(data => {
                document.getElementById('recipeDisplay').innerHTML = data.html;
            });
        }
        
        // Add event listeners to checkboxes
        document.addEventListener('DOMContentLoaded', function() {
            document.querySelectorAll('.cups-checkboxes input[type="checkbox"]').forEach(cb => {
                cb.addEventListener('change', updateRecipe);
            });
        });
        
        updateRecipe(); // Initial load
    </script>
</body>
</html>
  `);
});

app.post('/api/process-recipe', (req, res) => {
  const { markdown, variables, multiplier, availableCups = [] } = req.body;
  const processedMarkdown = RecipeParser.substituteVariables(markdown, variables, multiplier, availableCups);
  let html = marked(processedMarkdown);
  
  // Remove disabled attribute from checkboxes to make them interactive
  html = html.replace(/<input disabled="" type="checkbox">/g, '<input type="checkbox" class="task-list-item-checkbox">');
  
  res.json({ html });
});

app.get('/grocery-list', (req, res) => {
  const recipes = getRecipes();
  
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Grocery List</title>
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <nav class="menu-bar">
        <div class="nav-content">
            <a href="/" class="home-btn">← Back to Recipes</a>
            <h2 style="margin: 0; color: #2c3e50;">Grocery List</h2>
        </div>
    </nav>
    
    <div class="main-content">
        <div class="grocery-content">
            <div class="ingredients-section">
                <h2>Ingredients</h2>
                <ul id="ingredientsList" class="grocery-ingredients">
                    <!-- Will be populated by JavaScript -->
                </ul>
            </div>
            
            <div class="meals-section">
                <h2>Meals</h2>
                <div id="mealsList" class="meal-tiles-small">
                    <!-- Will be populated by JavaScript -->
                </div>
                
                <button id="purchasedBtn" class="purchased-btn" onclick="markPurchased()">
                    ✓ Purchased - Reset All Quantities
                </button>
            </div>
        </div>
    </div>
    
    <script>
        const recipes = ${JSON.stringify(recipes)};
        let mealQuantities = JSON.parse(localStorage.getItem('mealQuantities') || '{}');
        
        function loadGroceryList() {
            const ingredientsList = document.getElementById('ingredientsList');
            const mealsList = document.getElementById('mealsList');
            
            // Reload quantities from server if signed in
            if (${!!req.session.userId}) {
                fetch('/api/meal-quantities')
                    .then(response => response.json())
                    .then(data => {
                        mealQuantities = data;
                        updateGroceryDisplay();
                    })
                    .catch(error => {
                        console.error('Error loading quantities:', error);
                        updateGroceryDisplay();
                    });
            } else {
                // Load from localStorage for non-signed-in users
                try {
                    mealQuantities = JSON.parse(localStorage.getItem('mealQuantities') || '{}');
                } catch (e) {
                    console.error('Error loading from localStorage:', e);
                    mealQuantities = {};
                }
                updateGroceryDisplay();
            }
            
            function updateGroceryDisplay() {
                // Get all unique ingredients from selected meals
                const allIngredients = new Set();
                const selectedMeals = [];
                
                Object.entries(mealQuantities).forEach(([recipeId, quantity]) => {
                    if (quantity > 0) {
                        const recipe = recipes.find(r => r.id === recipeId);
                        if (recipe) {
                            selectedMeals.push({ ...recipe, quantity });
                            
                            // Add ingredients (just names, not quantities)
                            Object.keys(recipe.variables || {}).forEach(ingredient => {
                                const ingredientName = ingredient.replace(/_/g, ' ');
                                allIngredients.add(ingredientName);
                            });
                        }
                    }
                });
                
                // Populate ingredients list
                ingredientsList.innerHTML = Array.from(allIngredients)
                    .sort()
                    .map(ingredient => \`<li><label><input type="checkbox" class="grocery-checkbox"> \${ingredient}</label></li>\`)
                    .join('');
                
                // Populate meals list
                mealsList.innerHTML = selectedMeals
                    .map(meal => \`
                        <div class="meal-tile-small">
                            <img src="/images/\${meal.id}.jpg" alt="\${meal.title}">
                            <div class="meal-info">
                                <h4>\${meal.title}</h4>
                                <span class="meal-quantity">Qty: \${meal.quantity}</span>
                            </div>
                        </div>
                    \`)
                    .join('');
            }
        }
        
        function markPurchased() {
            if (confirm('Mark all items as purchased and reset meal quantities?')) {
                // Clear localStorage for non-signed-in users
                localStorage.setItem('mealQuantities', JSON.stringify({}));
                
                // If user is signed in, also clear database quantities
                if (${!!req.session.userId}) {
                    fetch('/api/meal-quantities/reset', {
                        method: 'POST'
                    }).then(() => {
                        window.location.href = '/';
                    }).catch(error => {
                        console.error('Error resetting quantities:', error);
                        // Still redirect even if reset fails
                        window.location.href = '/';
                    });
                } else {
                    window.location.href = '/';
                }
            }
        }
        
        document.addEventListener('DOMContentLoaded', loadGroceryList);
    </script>
</body>
</html>
  `);
});

// Meal quantity API endpoints
app.get('/api/meal-quantities', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  db.all('SELECT recipe_id, quantity FROM meal_quantities WHERE user_id = ?', 
    [req.session.userId], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    const quantities = {};
    rows.forEach(row => {
      quantities[row.recipe_id] = row.quantity;
    });
    
    res.json(quantities);
  });
});

app.post('/api/meal-quantity', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const { recipeId, quantity } = req.body;
  const qty = parseInt(quantity) || 0;
  
  if (qty === 0) {
    // Remove from database if quantity is 0
    db.run('DELETE FROM meal_quantities WHERE user_id = ? AND recipe_id = ?',
      [req.session.userId, recipeId], (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ success: true });
    });
  } else {
    // Insert or update quantity
    db.run(`INSERT OR REPLACE INTO meal_quantities 
            (user_id, recipe_id, quantity, updated_at) 
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [req.session.userId, recipeId, qty], (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ success: true });
    });
  }
});

app.post('/api/meal-quantities/reset', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  // Delete all meal quantities for this user
  db.run('DELETE FROM meal_quantities WHERE user_id = ?', 
    [req.session.userId], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ success: true });
  });
});

app.get('/api/search/:query', (req, res) => {
  const query = req.params.query.toLowerCase();
  const recipes = getRecipes();
  const filtered = recipes.filter(recipe => 
    recipe.title.toLowerCase().includes(query)
  );
  res.json(filtered);
});

app.listen(PORT, () => {
  console.log(`Recipe server running on http://localhost:${PORT}`);
});