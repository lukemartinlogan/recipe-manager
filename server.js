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

// Debug middleware for static file requests
app.use((req, res, next) => {
  if (req.path.match(/\.(css|js|png|jpg|jpeg)$/)) {
    console.log(`Static file request: ${req.path}`);
  }
  next();
});

// Configure express.static with explicit MIME type options
app.use(express.static('public', {
  setHeaders: (res, path) => {
    console.log(`Setting headers for: ${path}`);
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
      console.log('Set CSS content type');
    } else if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
      console.log('Set JS content type');
    } else if (path.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    }
  }
}));
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
  
  // Grocery list items table
  db.run(`CREATE TABLE IF NOT EXISTS grocery_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ingredient_name TEXT NOT NULL,
    is_checked BOOLEAN DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    UNIQUE(user_id, ingredient_name)
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
    
    // Extract labels from labels section
    const labels = this.extractLabels(markdown);
    
    // Extract recipe icon link
    const recipeIcon = this.extractRecipeIcon(markdown);
    
    return { variables, labels, recipeIcon, originalMarkdown: markdown };
  }

  static extractLabels(markdown) {
    const labels = [];
    
    // Look for a ## Labels section
    const labelsMatch = markdown.match(/^##\s*Labels?\s*$(.*?)(?=^##|\s*$)/mis);
    if (labelsMatch) {
      const labelsContent = labelsMatch[1];
      
      // Extract markdown list items (- item or * item)
      const labelMatches = labelsContent.match(/^[\s]*[-*]\s*(.+)$/gm);
      if (labelMatches) {
        labelMatches.forEach(labelMatch => {
          const label = labelMatch.replace(/^[\s]*[-*]\s*/, '').trim();
          if (label) {
            labels.push(label.toLowerCase());
          }
        });
      }
    }
    
    return labels;
  }

  static extractRecipeIcon(markdown) {
    // Look for [recipe_icon](path/to/image.jpg) anywhere in the markdown
    const iconMatch = markdown.match(/\[recipe_icon\]\(([^)]+)\)/);
    if (iconMatch) {
      return iconMatch[1].trim(); // Return the path/URL
    }
    return null; // No recipe icon found
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
    
    // Use top two units: largest unit as integer, next smaller unit as fractional
    let remaining = totalAmount;
    const result = [];
    
    // Find the largest unit that fits at least once
    let primaryUnit = null;
    let secondaryUnit = null;
    
    for (let i = 0; i < available.length; i++) {
      if (remaining >= available[i].value - 0.001) {
        primaryUnit = available[i];
        // Find the next smaller unit for fractional part
        for (let j = i + 1; j < available.length; j++) {
          secondaryUnit = available[j];
          break;
        }
        break;
      }
    }
    
    if (!primaryUnit) {
      // Amount is smaller than smallest available unit, use fractional
      const smallestUnit = available[available.length - 1];
      const fraction = this.decimalToFraction(totalAmount / smallestUnit.value);
      const unitName = smallestUnit.name.replace(/^[\d\/\.]+/, '');
      return `${fraction}${unitName}`;
    }
    
    // Calculate integer count of primary unit
    const primaryCount = Math.floor(remaining / primaryUnit.value + 0.001);
    remaining -= primaryCount * primaryUnit.value;
    
    // Add primary unit to result
    if (primaryCount === 1) {
      result.push(primaryUnit.display);
    } else {
      result.push(`${primaryCount} ${primaryUnit.display}`);
    }
    
    // Handle remaining amount with secondary unit as fraction
    if (remaining > 0.001 && secondaryUnit) {
      const secondaryAmount = remaining / secondaryUnit.value;
      const fraction = this.decimalToFraction(secondaryAmount);
      const unitName = secondaryUnit.name.replace(/^[\d\/\.]+/, '');
      
      if (fraction !== '0' && fraction !== '') {
        result.push(`${fraction}${unitName}`);
      }
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

// Get all recipe files recursively from subdirectories
function getRecipes() {
  const recipesDir = path.join(__dirname, 'recipes');
  if (!fs.existsSync(recipesDir)) {
    fs.mkdirSync(recipesDir);
    return [];
  }
  
  function scanDirectory(dir, relativePath = '') {
    const items = fs.readdirSync(dir);
    const recipes = [];
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Recursively scan subdirectory
        const subPath = relativePath ? `${relativePath}/${item}` : item;
        recipes.push(...scanDirectory(fullPath, subPath));
      } else if (item.endsWith('.md')) {
        // Process markdown file
        const content = fs.readFileSync(fullPath, 'utf8');
        const { variables, labels, recipeIcon } = RecipeParser.parseRecipe(content);
        
        // Extract title from first line
        const titleMatch = content.match(/^#\s*(.+)$/m);
        const title = titleMatch ? titleMatch[1] : item.replace('.md', '');
        
        // Create unique ID that includes subdirectory path
        const recipeId = relativePath 
          ? `${relativePath}/${item.replace('.md', '')}`
          : item.replace('.md', '');
        
        // Combine explicit labels with automatic directory label
        const allLabels = [...labels];
        if (relativePath) {
          // Add parent directory name as automatic label
          const directoryLabel = relativePath.split('/').pop().toLowerCase();
          if (!allLabels.includes(directoryLabel)) {
            allLabels.unshift(directoryLabel); // Add as first label
          }
        }
        
        // Process recipe icon path if it exists
        let processedRecipeIcon = null;
        if (recipeIcon) {
          // If it's a relative path, make it relative to the recipe file's directory
          if (!recipeIcon.startsWith('http') && !recipeIcon.startsWith('/')) {
            // Make the path relative to the recipe's directory
            const recipeDir = path.dirname(fullPath);
            const iconPath = path.resolve(recipeDir, recipeIcon);
            // Convert to a path relative to the public directory
            const publicDir = path.join(__dirname, 'public');
            try {
              processedRecipeIcon = path.relative(publicDir, iconPath).replace(/\\/g, '/');
              // Ensure it starts with / for web serving
              if (!processedRecipeIcon.startsWith('/')) {
                processedRecipeIcon = '/' + processedRecipeIcon;
              }
            } catch (e) {
              // If path resolution fails, just use the original path
              processedRecipeIcon = recipeIcon;
            }
          } else {
            processedRecipeIcon = recipeIcon;
          }
        }
        
        recipes.push({
          id: recipeId,
          title,
          filename: item,
          relativePath,
          fullPath: fullPath,
          variables,
          labels: allLabels,
          recipeIcon: processedRecipeIcon
        });
      }
    }
    
    return recipes;
  }
  
  return scanDirectory(recipesDir);
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
    
    // Collect all unique labels
    const allLabels = [...new Set(recipes.flatMap(recipe => recipe.labels || []))].sort();
    
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
        
        <!-- Labels Section -->
        <div class="labels-section">
            <h2>Filter by Labels</h2>
            <div class="labels-checkboxes" id="labelsCheckboxes">
                ${allLabels.map(label => `
                    <label class="label-checkbox">
                        <input type="checkbox" value="${label}" class="label-filter-checkbox">
                        <span class="label-text">${label}</span>
                    </label>
                `).join('')}
            </div>
            <button id="clearAllLabels" class="clear-labels-btn">Clear All</button>
        </div>
        
        <div class="recipe-grid" id="recipeGrid">
            ${recipes.map(recipe => `
                <div class="recipe-tile" data-recipe-id="${recipe.id}">
                    <div class="recipe-image">
                        ${recipe.recipeIcon 
                          ? `<img src="${recipe.recipeIcon}" alt="${recipe.title}">`
                          : `<div class="recipe-placeholder" style="background: linear-gradient(135deg, #${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}, #${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}); height: 200px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 1.2rem;">${recipe.title.charAt(0).toUpperCase()}</div>`
                        }
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
        const allRecipes = ${JSON.stringify(recipes.map(r => ({
          id: r.id,
          title: r.title,
          labels: r.labels || []
        })))};
        const allLabels = ${JSON.stringify(allLabels)};
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

app.get('/recipe/*', (req, res) => {
  const recipeId = req.params[0]; // Get the full path after /recipe/
  const quantity = parseFloat(req.query.quantity) || 1;
  
  // Find the recipe in our recipes list
  const recipes = getRecipes();
  const recipe = recipes.find(r => r.id === recipeId);
  
  if (!recipe) {
    return res.status(404).send('Recipe not found');
  }
  
  const content = fs.readFileSync(recipe.fullPath, 'utf8');
  const { variables } = RecipeParser.parseRecipe(content);
  
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recipe: ${recipe.title}</title>
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
                
                <button id="purchasedBtn" class="purchased-btn">
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
            
            // Load meal quantities and sync grocery list
            if (${!!req.session.userId}) {
                fetch('/api/meal-quantities')
                    .then(response => response.json())
                    .then(data => {
                        mealQuantities = data;
                        return syncGroceryList();
                    })
                    .then(() => loadGroceryItems())
                    .catch(error => {
                        console.error('Error loading quantities:', error);
                        loadGroceryItems();
                    });
            } else {
                // Non-signed-in users don't have persistent grocery lists
                updateGroceryDisplayForNonSignedIn();
            }
            
            function calculateIngredientQuantity(ingredientValue, multiplier) {
                // Extract numerical quantity and unit from ingredient string
                const match = ingredientValue.match(/^(\\d*\\.?\\d+(?:\\/\\d+)?)\\s*(\\S*)?\\s*(.*)/);
                if (match) {
                    let [, quantityStr, unit, rest] = match;
                    
                    // Handle fractions
                    let quantity;
                    if (quantityStr.includes('/')) {
                        const [num, den] = quantityStr.split('/');
                        quantity = parseFloat(num) / parseFloat(den);
                    } else {
                        quantity = parseFloat(quantityStr);
                    }
                    
                    const scaledQuantity = quantity * multiplier;
                    
                    // Format the scaled quantity with unit
                    if (unit) {
                        return formatQuantityWithUnit(scaledQuantity, unit);
                    } else {
                        return formatQuantity(scaledQuantity);
                    }
                }
                
                // If no clear quantity found, return the ingredient as-is or default to "1"
                return ingredientValue.includes(' ') ? ingredientValue : '1';
            }
            
            function normalizeUnit(unit) {
                // Normalize synonymous units to a standard form
                const unitMap = {
                    // Volume measurements
                    'tablespoon': 'tbsp',
                    'tablespoons': 'tbsp',
                    'teaspoon': 'tsp',
                    'teaspoons': 'tsp',
                    'cup': 'cup',
                    'cups': 'cup',
                    'ounce': 'oz',
                    'ounces': 'oz',
                    'fluid ounce': 'fl oz',
                    'fluid ounces': 'fl oz',
                    'pint': 'pt',
                    'pints': 'pt',
                    'quart': 'qt',
                    'quarts': 'qt',
                    'gallon': 'gal',
                    'gallons': 'gal',
                    'liter': 'l',
                    'liters': 'l',
                    'milliliter': 'ml',
                    'milliliters': 'ml',
                    
                    // Weight measurements
                    'pound': 'lb',
                    'pounds': 'lb',
                    'gram': 'g',
                    'grams': 'g',
                    'kilogram': 'kg',
                    'kilograms': 'kg',
                    
                    // Count/pieces
                    'piece': 'piece',
                    'pieces': 'piece',
                    'item': 'item',
                    'items': 'item',
                    'can': 'can',
                    'cans': 'can',
                    'package': 'package',
                    'packages': 'package'
                };
                
                const normalized = unitMap[unit?.toLowerCase()] || unit?.toLowerCase() || '';
                return normalized;
            }
            
            function formatQuantityWithUnit(quantity, unit) {
                // Format quantity nicely with units
                let formattedQuantity;
                
                if (quantity === Math.floor(quantity)) {
                    formattedQuantity = quantity.toString();
                } else if (quantity < 1) {
                    // Handle common fractions
                    const common = [
                        [0.25, '¼'], [0.333, '⅓'], [0.5, '½'], 
                        [0.666, '⅔'], [0.75, '¾']
                    ];
                    let found = false;
                    for (const [value, fraction] of common) {
                        if (Math.abs(quantity - value) < 0.05) {
                            formattedQuantity = fraction;
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        formattedQuantity = quantity.toFixed(2);
                    }
                } else {
                    // Handle mixed numbers like 1.5 -> 1½
                    const whole = Math.floor(quantity);
                    const fraction = quantity - whole;
                    if (Math.abs(fraction - 0.5) < 0.05) {
                        formattedQuantity = whole + '½';
                    } else if (Math.abs(fraction - 0.25) < 0.05) {
                        formattedQuantity = whole + '¼';
                    } else if (Math.abs(fraction - 0.75) < 0.05) {
                        formattedQuantity = whole + '¾';
                    } else if (Math.abs(fraction - 0.333) < 0.05) {
                        formattedQuantity = whole + '⅓';
                    } else if (Math.abs(fraction - 0.666) < 0.05) {
                        formattedQuantity = whole + '⅔';
                    } else {
                        formattedQuantity = quantity.toFixed(1);
                    }
                }
                
                return \`\${formattedQuantity} \${unit}\`;
            }
            
            function calculateIngredientQuantityWithUnit(ingredientValue, multiplier) {
                // Handle comma-separated multiple units (e.g., "1 can, 15oz")
                const parts = ingredientValue.split(',').map(part => part.trim());
                
                if (parts.length > 1) {
                    // Multiple units found - try to parse each part
                    const parsedParts = parts.map(part => {
                        const match = part.match(/^(\\d*\\.?\\d+(?:\\/\\d+)?)\\s*(\\S*)?\\s*(.*)/);
                        if (match) {
                            let [, quantityStr, unit, rest] = match;
                            
                            // Handle fractions
                            let quantity;
                            if (quantityStr.includes('/')) {
                                const [num, den] = quantityStr.split('/');
                                quantity = parseFloat(num) / parseFloat(den);
                            } else {
                                quantity = parseFloat(quantityStr);
                            }
                            
                            return {
                                quantity: quantity * multiplier,
                                unit: unit,
                                rest: rest,
                                originalPart: part
                            };
                        }
                        return { originalPart: part, quantity: null, unit: null, rest: part };
                    });
                    
                    // Find the best unit to use for display (prefer weight/volume over count)
                    const weightVolumeUnits = ['oz', 'lb', 'g', 'kg', 'cups', 'cup', 'tbsp', 'tsp', 'ml', 'l'];
                    let bestPart = parsedParts.find(p => p.unit && weightVolumeUnits.includes(p.unit.toLowerCase()));
                    
                    if (!bestPart) {
                        // If no weight/volume unit found, use the first valid parsed part
                        bestPart = parsedParts.find(p => p.quantity !== null) || parsedParts[0];
                    }
                    
                    if (bestPart && bestPart.quantity !== null) {
                        const normalizedUnit = normalizeUnit(bestPart.unit);
                        return {
                            quantity: bestPart.quantity,
                            unit: bestPart.unit,
                            normalizedUnit: normalizedUnit,
                            displayText: null,
                            allParts: parsedParts // Store all parts for potential future use
                        };
                    }
                    
                    // Fallback: return combined display text
                    return {
                        quantity: 1 * multiplier,
                        unit: null,
                        normalizedUnit: '',
                        displayText: ingredientValue,
                        allParts: parsedParts
                    };
                }
                
                // Single unit - original logic
                const match = ingredientValue.match(/^(\\d*\\.?\\d+(?:\\/\\d+)?)\\s*(\\S*)?\\s*(.*)/);
                if (match) {
                    let [, quantityStr, unit, rest] = match;
                    
                    // Handle fractions
                    let quantity;
                    if (quantityStr.includes('/')) {
                        const [num, den] = quantityStr.split('/');
                        quantity = parseFloat(num) / parseFloat(den);
                    } else {
                        quantity = parseFloat(quantityStr);
                    }
                    
                    const scaledQuantity = quantity * multiplier;
                    const normalizedUnit = normalizeUnit(unit);
                    
                    return {
                        quantity: scaledQuantity,
                        unit: unit,
                        normalizedUnit: normalizedUnit,
                        displayText: null
                    };
                }
                
                // If no clear quantity found, return as-is
                return {
                    quantity: 1 * multiplier,
                    unit: null,
                    normalizedUnit: '',
                    displayText: ingredientValue.includes(' ') ? ingredientValue : '1'
                };
            }
            
            function syncGroceryList() {
                // Calculate ingredient quantities from current meal quantities
                const ingredientQuantities = {};
                const ingredientQuantitiesByUnit = {}; // Track by normalized unit
                
                Object.entries(mealQuantities).forEach(([recipeId, mealQty]) => {
                    if (mealQty > 0) {
                        const recipe = recipes.find(r => r.id === recipeId);
                        if (recipe) {
                            Object.entries(recipe.variables || {}).forEach(([ingredient, value]) => {
                                const ingredientName = ingredient.replace(/_/g, ' ');
                                const result = calculateIngredientQuantityWithUnit(value, mealQty);
                                
                                // Create a unique key for this ingredient + unit combination
                                const key = \`\${ingredientName}|\${result.normalizedUnit}\`;
                                
                                if (ingredientQuantitiesByUnit[key]) {
                                    ingredientQuantitiesByUnit[key].quantity += result.quantity;
                                } else {
                                    ingredientQuantitiesByUnit[key] = {
                                        ingredientName,
                                        quantity: result.quantity,
                                        unit: result.unit,
                                        normalizedUnit: result.normalizedUnit,
                                        displayText: result.displayText
                                    };
                                }
                            });
                        }
                    }
                });
                
                // Convert back to simple format for display
                Object.values(ingredientQuantitiesByUnit).forEach(item => {
                    if (item.unit) {
                        ingredientQuantities[item.ingredientName] = formatQuantityWithUnit(item.quantity, item.unit);
                    } else if (item.displayText) {
                        ingredientQuantities[item.ingredientName] = item.displayText;
                    } else {
                        ingredientQuantities[item.ingredientName] = item.quantity.toString();
                    }
                });
                
                // Store quantities for later use
                window.currentIngredientQuantities = ingredientQuantities;
                
                // Sync with database
                return fetch('/api/grocery-items/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        ingredients: Object.keys(ingredientQuantities)
                    })
                });
            }
            
            function loadGroceryItems() {
                // Load grocery items from database with their states
                fetch('/api/grocery-items')
                    .then(response => response.json())
                    .then(items => {
                        displayGroceryItems(items);
                        updateMealsList();
                    })
                    .catch(error => {
                        console.error('Error loading grocery items:', error);
                    });
            }
            
            function formatQuantity(quantity) {
                // Round to reasonable precision and format nicely
                if (quantity === Math.floor(quantity)) {
                    return quantity.toString();
                } else if (quantity < 1) {
                    // Handle fractions
                    const common = [
                        [0.25, '¼'], [0.333, '⅓'], [0.5, '½'], 
                        [0.666, '⅔'], [0.75, '¾']
                    ];
                    for (const [value, fraction] of common) {
                        if (Math.abs(quantity - value) < 0.05) {
                            return fraction;
                        }
                    }
                    return quantity.toFixed(2);
                } else {
                    return quantity.toFixed(1);
                }
            }
            
            function displayGroceryItems(items) {
                // Sort items so unchecked items come first, then checked items
                const sortedItems = items.sort((a, b) => {
                    if (a.is_checked && !b.is_checked) return 1;
                    if (!a.is_checked && b.is_checked) return -1;
                    return a.sort_order - b.sort_order;
                });
                
                const ingredientQuantities = window.currentIngredientQuantities || {};
                
                ingredientsList.innerHTML = sortedItems
                    .map(item => {
                        const quantity = ingredientQuantities[item.ingredient_name];
                        const quantityDisplay = quantity || '1';
                        
                        return \`
                        <li class="grocery-item \${item.is_checked ? 'checked' : ''}" 
                            data-ingredient="\${item.ingredient_name}">
                            <div class="drag-handle">≡</div>
                            <label>
                                <input type="checkbox" class="grocery-checkbox" 
                                       data-ingredient="\${item.ingredient_name}" 
                                       \${item.is_checked ? 'checked' : ''}>
                                <div class="ingredient-info">
                                    <span class="ingredient-text">\${item.ingredient_name}</span>
                                    <span class="ingredient-quantity">\${quantityDisplay}</span>
                                </div>
                            </label>
                        </li>
                        \`;
                    })
                    .join('');
                
                initializeDragAndDrop();
            }
            
            function initializeDragAndDrop() {
                const groceryItems = ingredientsList.querySelectorAll('.grocery-item');
                
                groceryItems.forEach(item => {
                    const dragHandle = item.querySelector('.drag-handle');
                    
                    // Mouse events for desktop
                    dragHandle.addEventListener('mousedown', function(e) {
                        e.preventDefault();
                        startDrag(item, e);
                    });
                    
                    // Touch events for mobile
                    dragHandle.addEventListener('touchstart', function(e) {
                        e.preventDefault();
                        const touch = e.touches[0];
                        startDrag(item, touch);
                    }, { passive: false });
                });
            }
            
            let draggedElement = null;
            let placeholder = null;
            let isDragging = false;
            
            function startDrag(item, e) {
                console.log('Starting drag for:', item.dataset.ingredient);
                draggedElement = item;
                isDragging = true;
                
                // Create placeholder
                placeholder = document.createElement('li');
                placeholder.className = 'drag-placeholder';
                placeholder.innerHTML = '<div class="placeholder-line"></div>';
                
                // Style the dragged item
                item.style.position = 'fixed';
                item.style.zIndex = '1000';
                item.style.pointerEvents = 'none';
                item.style.transform = 'rotate(3deg) scale(1.05)';
                item.style.opacity = '0.9';
                item.style.width = item.offsetWidth + 'px';
                item.style.boxShadow = '0 8px 16px rgba(0,0,0,0.3)';
                item.classList.add('dragging');
                
                // Insert placeholder
                item.parentNode.insertBefore(placeholder, item.nextSibling);
                
                // Move item with mouse/touch
                updateDragPosition(e);
                
                // Add global mouse and touch events
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', endDrag);
                document.addEventListener('touchmove', handleMouseMove, { passive: false });
                document.addEventListener('touchend', endDrag);
            }
            
            function handleMouseMove(e) {
                if (!isDragging || !draggedElement) return;
                
                // Handle both mouse and touch events
                const clientY = e.clientY || (e.touches && e.touches[0].clientY);
                const clientX = e.clientX || (e.touches && e.touches[0].clientX);
                
                updateDragPosition({ clientX, clientY });
                
                // Find the element to insert before based on mouse position
                const insertBeforeElement = getDragAfterElement(ingredientsList, clientY);
                
                if (insertBeforeElement === null) {
                    // Insert at the end of the list
                    ingredientsList.appendChild(placeholder);
                } else {
                    // Insert before the target element
                    ingredientsList.insertBefore(placeholder, insertBeforeElement);
                }
            }
            
            function updateDragPosition(e) {
                if (!draggedElement) return;
                
                const clientX = e.clientX || e.clientX;
                const clientY = e.clientY || e.clientY;
                
                draggedElement.style.left = (clientX - draggedElement.offsetWidth / 2) + 'px';
                draggedElement.style.top = (clientY - 20) + 'px';
            }
            
            function getDragAfterElement(container, y) {
                const draggableElements = [...container.querySelectorAll('.grocery-item:not(.dragging)')];
                
                // Find the element that the mouse is currently over or should be inserted after
                let targetElement = null;
                
                for (const child of draggableElements) {
                    const box = child.getBoundingClientRect();
                    const childCenterY = box.top + box.height / 2;
                    
                    // If mouse is above the center of this element, insert before it
                    if (y < childCenterY) {
                        targetElement = child;
                        break;
                    }
                }
                
                // If no element found (mouse is below all elements), return null to append at end
                return targetElement;
            }
            
            function endDrag(e) {
                if (!isDragging || !draggedElement) return;
                
                console.log('Ending drag');
                isDragging = false;
                
                // Reset dragged element styles
                draggedElement.style.position = '';
                draggedElement.style.zIndex = '';
                draggedElement.style.pointerEvents = '';
                draggedElement.style.transform = '';
                draggedElement.style.opacity = '';
                draggedElement.style.width = '';
                draggedElement.style.left = '';
                draggedElement.style.top = '';
                draggedElement.style.boxShadow = '';
                draggedElement.classList.remove('dragging');
                
                // Insert the item before the placeholder
                if (placeholder.parentNode) {
                    placeholder.parentNode.insertBefore(draggedElement, placeholder);
                    placeholder.remove();
                    
                    // Update order in database
                    updateItemOrder();
                }
                
                draggedElement = null;
                placeholder = null;
                
                // Remove global mouse and touch events
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', endDrag);
                document.removeEventListener('touchmove', handleMouseMove);
                document.removeEventListener('touchend', endDrag);
            }
            
            function updateItemOrder() {
                const items = [...ingredientsList.querySelectorAll('.grocery-item')];
                const orderedIngredients = items.map(item => item.dataset.ingredient);
                
                if (${!!req.session.userId}) {
                    fetch('/api/grocery-items/reorder-all', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ orderedIngredients })
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (!data.success) {
                            console.error('Failed to update order');
                            loadGroceryList(); // Reload on failure
                        }
                    })
                    .catch(error => {
                        console.error('Error updating order:', error);
                        loadGroceryList(); // Reload on error
                    });
                }
            }
            
            function updateMealsList() {
                const selectedMeals = [];
                Object.entries(mealQuantities).forEach(([recipeId, quantity]) => {
                    if (quantity > 0) {
                        const recipe = recipes.find(r => r.id === recipeId);
                        if (recipe) {
                            selectedMeals.push({ ...recipe, quantity });
                        }
                    }
                });
                
                mealsList.innerHTML = selectedMeals
                    .map(meal => \`
                        <div class="meal-tile-small clickable-meal" data-recipe-id="\${meal.id}">
                            \${meal.recipeIcon 
                              ? \`<img src="\${meal.recipeIcon}" alt="\${meal.title}">\`
                              : \`<div class="recipe-placeholder-small" style="width: 60px; height: 60px; background: linear-gradient(135deg, #\${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}, #\${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}); border-radius: 5px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 1rem;">\${meal.title.charAt(0).toUpperCase()}</div>\`
                            }
                            <div class="meal-info">
                                <h4>\${meal.title}</h4>
                                <div class="meal-quantity-control">
                                    <label>Qty:</label>
                                    <input type="number" class="grocery-meal-quantity" 
                                           data-recipe-id="\${meal.id}" 
                                           value="\${meal.quantity}" 
                                           min="0" step="0.25">
                                </div>
                            </div>
                        </div>
                    \`)
                    .join('');
            }
            
            function updateGroceryDisplayForNonSignedIn() {
                // For non-signed-in users, show simple list without persistence
                const ingredientQuantities = {};
                const ingredientQuantitiesByUnit = {}; // Track by normalized unit
                const selectedMeals = [];
                
                try {
                    mealQuantities = JSON.parse(localStorage.getItem('mealQuantities') || '{}');
                } catch (e) {
                    mealQuantities = {};
                }
                
                Object.entries(mealQuantities).forEach(([recipeId, mealQty]) => {
                    if (mealQty > 0) {
                        const recipe = recipes.find(r => r.id === recipeId);
                        if (recipe) {
                            selectedMeals.push({ ...recipe, quantity: mealQty });
                            Object.entries(recipe.variables || {}).forEach(([ingredient, value]) => {
                                const ingredientName = ingredient.replace(/_/g, ' ');
                                const result = calculateIngredientQuantityWithUnit(value, mealQty);
                                
                                // Create a unique key for this ingredient + unit combination
                                const key = \`\${ingredientName}|\${result.normalizedUnit}\`;
                                
                                if (ingredientQuantitiesByUnit[key]) {
                                    ingredientQuantitiesByUnit[key].quantity += result.quantity;
                                } else {
                                    ingredientQuantitiesByUnit[key] = {
                                        ingredientName,
                                        quantity: result.quantity,
                                        unit: result.unit,
                                        normalizedUnit: result.normalizedUnit,
                                        displayText: result.displayText
                                    };
                                }
                            });
                        }
                    }
                });
                
                // Convert back to simple format for display
                Object.values(ingredientQuantitiesByUnit).forEach(item => {
                    if (item.unit) {
                        ingredientQuantities[item.ingredientName] = formatQuantityWithUnit(item.quantity, item.unit);
                    } else if (item.displayText) {
                        ingredientQuantities[item.ingredientName] = item.displayText;
                    } else {
                        ingredientQuantities[item.ingredientName] = item.quantity.toString();
                    }
                });
                
                window.currentIngredientQuantities = ingredientQuantities;
                
                ingredientsList.innerHTML = Object.keys(ingredientQuantities)
                    .sort()
                    .map(ingredient => {
                        const quantity = ingredientQuantities[ingredient];
                        const quantityDisplay = quantity || '1';
                        
                        return \`
                        <li class="grocery-item" data-ingredient="\${ingredient}">
                            <div class="drag-handle">≡</div>
                            <label>
                                <input type="checkbox" class="grocery-checkbox" data-ingredient="\${ingredient}">
                                <div class="ingredient-info">
                                    <span class="ingredient-text">\${ingredient}</span>
                                    <span class="ingredient-quantity">\${quantityDisplay}</span>
                                </div>
                            </label>
                        </li>
                        \`;
                    })
                    .join('');
                
                // Initialize drag and drop for non-signed-in users too
                initializeDragAndDrop();
                
                // Add event delegation for non-signed-in users to move checked items
                ingredientsList.addEventListener('change', function(e) {
                    if (e.target.classList.contains('grocery-checkbox')) {
                        const listItem = e.target.closest('.grocery-item');
                        const is_checked = e.target.checked;
                        
                        if (listItem) {
                            listItem.classList.toggle('checked', is_checked);
                            
                            if (is_checked) {
                                // Move to bottom
                                ingredientsList.appendChild(listItem);
                            } else {
                                // Move to top before first checked item
                                const firstCheckedItem = ingredientsList.querySelector('.grocery-item.checked');
                                if (firstCheckedItem) {
                                    ingredientsList.insertBefore(listItem, firstCheckedItem);
                                } else {
                                    ingredientsList.insertBefore(listItem, ingredientsList.firstChild);
                                }
                            }
                        }
                    }
                });
                    
                mealsList.innerHTML = selectedMeals
                    .map(meal => \`
                        <div class="meal-tile-small clickable-meal" data-recipe-id="\${meal.id}">
                            \${meal.recipeIcon 
                              ? \`<img src="\${meal.recipeIcon}" alt="\${meal.title}">\`
                              : \`<div class="recipe-placeholder-small" style="width: 60px; height: 60px; background: linear-gradient(135deg, #\${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}, #\${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}); border-radius: 5px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 1rem;">\${meal.title.charAt(0).toUpperCase()}</div>\`
                            }
                            <div class="meal-info">
                                <h4>\${meal.title}</h4>
                                <div class="meal-quantity-control">
                                    <label>Qty:</label>
                                    <input type="number" class="grocery-meal-quantity" 
                                           data-recipe-id="\${meal.id}" 
                                           value="\${meal.quantity}" 
                                           min="0" step="0.25">
                                </div>
                            </div>
                        </div>
                    \`)
                    .join('');
            }
        }
        
        function toggleGroceryItem(ingredient_name, is_checked) {
            if (${!!req.session.userId}) {
                fetch('/api/grocery-items/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ingredient_name, is_checked })
                }).catch(error => console.error('Error updating item:', error));
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
        
        function updateItemOrderAfterCheck() {
            const ingredientsList = document.getElementById('ingredientsList');
            const items = [...ingredientsList.querySelectorAll('.grocery-item')];
            const orderedIngredients = items.map(item => item.dataset.ingredient);
            
            if (${!!req.session.userId}) {
                fetch('/api/grocery-items/reorder-all', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderedIngredients })
                })
                .then(response => response.json())
                .then(data => {
                    if (!data.success) {
                        console.error('Failed to update order after check');
                    }
                })
                .catch(error => {
                    console.error('Error updating order after check:', error);
                });
            }
        }
        
        // Add event listener for checkbox changes
        document.addEventListener('change', function(e) {
            if (e.target.classList.contains('grocery-checkbox')) {
                e.stopPropagation(); // Prevent interfering with drag events
                const ingredient_name = e.target.getAttribute('data-ingredient');
                const is_checked = e.target.checked;
                
                // Update visual state immediately
                const listItem = e.target.closest('.grocery-item');
                if (listItem) {
                    listItem.classList.toggle('checked', is_checked);
                    
                    // Move checked items to bottom, unchecked items to top
                    const ingredientsList = document.getElementById('ingredientsList');
                    if (is_checked) {
                        // Move to bottom - append to end of list
                        ingredientsList.appendChild(listItem);
                    } else {
                        // Move to top - find first checked item and insert before it
                        const firstCheckedItem = ingredientsList.querySelector('.grocery-item.checked');
                        if (firstCheckedItem) {
                            ingredientsList.insertBefore(listItem, firstCheckedItem);
                        } else {
                            // No checked items, just move to top
                            ingredientsList.insertBefore(listItem, ingredientsList.firstChild);
                        }
                    }
                    
                    // Update order in database after moving
                    updateItemOrderAfterCheck();
                }
                
                // Save to database
                toggleGroceryItem(ingredient_name, is_checked);
            }
        });
        
        // Add event listener for grocery meal quantity changes
        document.addEventListener('change', function(e) {
            if (e.target.classList.contains('grocery-meal-quantity')) {
                const recipeId = e.target.getAttribute('data-recipe-id');
                const newQuantity = parseFloat(e.target.value) || 0;
                
                // Update meal quantities
                mealQuantities[recipeId] = newQuantity;
                
                if (${!!req.session.userId}) {
                    // Save to database for signed-in users
                    fetch('/api/meal-quantity', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ recipeId, quantity: newQuantity })
                    })
                    .then(() => {
                        // Reload the grocery list to reflect changes
                        loadGroceryList();
                    })
                    .catch(error => console.error('Error updating meal quantity:', error));
                } else {
                    // Update localStorage for non-signed-in users
                    localStorage.setItem('mealQuantities', JSON.stringify(mealQuantities));
                    // Reload the grocery display
                    updateGroceryDisplayForNonSignedIn();
                }
            }
        });
        
        // Add event listener for meal tile clicks
        document.addEventListener('click', function(e) {
            const mealTile = e.target.closest('.clickable-meal');
            if (mealTile) {
                // Don't navigate if clicking on the quantity input or its label
                if (e.target.classList.contains('grocery-meal-quantity') || 
                    e.target.closest('.meal-quantity-control')) {
                    return;
                }
                
                const recipeId = mealTile.getAttribute('data-recipe-id');
                if (recipeId) {
                    const quantity = mealQuantities[recipeId] || 1;
                    window.location.href = \`/recipe/\${recipeId}?quantity=\${quantity}\`;
                }
            }
        });
        
        // Add event listener for purchased button
        document.addEventListener('click', function(e) {
            if (e.target.id === 'purchasedBtn') {
                markPurchased();
            }
        });
        
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

// Grocery list API endpoints
app.get('/api/grocery-items', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  db.all(`SELECT ingredient_name, is_checked, sort_order 
          FROM grocery_items 
          WHERE user_id = ? 
          ORDER BY sort_order ASC, ingredient_name ASC`, 
    [req.session.userId], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

app.post('/api/grocery-items/sync', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const { ingredients } = req.body; // Array of ingredient names from current meal quantities
  
  if (!ingredients || !Array.isArray(ingredients)) {
    return res.status(400).json({ error: 'Invalid ingredients array' });
  }
  
  // First, get the maximum sort_order for proper ordering of new items
  db.get('SELECT MAX(sort_order) as max_order FROM grocery_items WHERE user_id = ?', 
    [req.session.userId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    let nextOrder = (result?.max_order || 0) + 1;
    
    // Insert new ingredients that don't exist yet
    const insertPromises = ingredients.map(ingredient => {
      return new Promise((resolve, reject) => {
        db.run(`INSERT OR IGNORE INTO grocery_items 
                (user_id, ingredient_name, sort_order) 
                VALUES (?, ?, ?)`,
          [req.session.userId, ingredient, nextOrder++], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
    
    Promise.all(insertPromises)
      .then(() => {
        // Remove ingredients that are no longer needed (not in current meal quantities)
        db.run(`DELETE FROM grocery_items 
                WHERE user_id = ? AND ingredient_name NOT IN (${ingredients.map(() => '?').join(',')})`,
          [req.session.userId, ...ingredients], (err) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
          }
          res.json({ success: true });
        });
      })
      .catch(error => {
        console.error(error);
        res.status(500).json({ error: 'Database error' });
      });
  });
});

app.post('/api/grocery-items/check', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const { ingredient_name, is_checked } = req.body;
  
  db.run(`UPDATE grocery_items 
          SET is_checked = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE user_id = ? AND ingredient_name = ?`,
    [is_checked, req.session.userId, ingredient_name], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ success: true });
  });
});

app.post('/api/grocery-items/reorder-all', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const { orderedIngredients } = req.body;
  
  if (!Array.isArray(orderedIngredients)) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  
  // Update sort_order for all items based on their position in the array
  const updates = orderedIngredients.map((ingredient_name, index) => 
    new Promise((resolve, reject) => {
      db.run(`UPDATE grocery_items 
              SET sort_order = ?, updated_at = CURRENT_TIMESTAMP 
              WHERE user_id = ? AND ingredient_name = ?`,
        [index, req.session.userId, ingredient_name], (err) => {
        if (err) reject(err);
        else resolve();
      });
    })
  );
  
  Promise.all(updates)
    .then(() => res.json({ success: true }))
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
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

// API endpoint for getting all labels
app.get('/api/labels', (req, res) => {
  try {
    const recipes = getRecipes();
    const allLabels = [...new Set(recipes.flatMap(recipe => recipe.labels || []))].sort();
    res.json({ labels: allLabels });
  } catch (error) {
    console.error('Error getting labels:', error);
    res.status(500).json({ error: 'Failed to get labels' });
  }
});

// API endpoint to generate labels.md file
app.post('/api/generate-labels', (req, res) => {
  try {
    const recipes = getRecipes();
    const labelsByCategory = {};
    
    // Group labels by category and track which recipes use them
    recipes.forEach(recipe => {
      const labels = recipe.labels || [];
      labels.forEach(label => {
        if (!labelsByCategory[label]) {
          labelsByCategory[label] = [];
        }
        labelsByCategory[label].push(recipe.title);
      });
    });
    
    // Generate markdown content
    let markdownContent = `# Recipe Labels\n\n`;
    markdownContent += `This file contains all labels used across the recipe collection.\n\n`;
    markdownContent += `Generated on: ${new Date().toLocaleDateString()}\n\n`;
    markdownContent += `## All Labels (${Object.keys(labelsByCategory).length})\n\n`;
    
    // Sort labels alphabetically
    const sortedLabels = Object.keys(labelsByCategory).sort();
    
    sortedLabels.forEach(label => {
      const recipes = labelsByCategory[label];
      markdownContent += `### ${label}\n`;
      markdownContent += `Used in ${recipes.length} recipe${recipes.length > 1 ? 's' : ''}:\n`;
      recipes.forEach(recipeTitle => {
        markdownContent += `- ${recipeTitle}\n`;
      });
      markdownContent += `\n`;
    });
    
    // Write the file
    const labelsPath = path.join(__dirname, 'labels.md');
    fs.writeFileSync(labelsPath, markdownContent);
    
    res.json({ 
      success: true, 
      message: 'Labels file generated successfully',
      labelCount: sortedLabels.length,
      recipeCount: recipes.length 
    });
  } catch (error) {
    console.error('Error generating labels file:', error);
    res.status(500).json({ error: 'Failed to generate labels file' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Recipe server running on http://0.0.0.0:${PORT}`);
  console.log(`Access from host: http://localhost:${PORT}`);
});