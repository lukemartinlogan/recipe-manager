const express = require('express');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

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

  static substituteVariables(markdown, variables, multiplier = 1) {
    let processed = markdown;
    
    // Replace variable definitions with clean ingredient list
    Object.entries(variables).forEach(([varName, value]) => {
      const definitionRegex = new RegExp(`\\$${varName}\\s*=\\s*[^$]+\\$`, 'g');
      const scaledValue = this.scaleIngredient(value, multiplier);
      const ingredientName = varName.replace(/_/g, ' ');
      processed = processed.replace(definitionRegex, `${scaledValue} of ${ingredientName}`);
    });
    
    // Replace variable references with actual values
    Object.entries(variables).forEach(([varName, value]) => {
      const referenceRegex = new RegExp(`\\$${varName}\\$`, 'g');
      const scaledValue = this.scaleIngredient(value, multiplier);
      const ingredientName = varName.replace(/_/g, ' ');
      processed = processed.replace(referenceRegex, `${scaledValue} of ${ingredientName}`);
    });
    
    return processed;
  }

  static scaleIngredient(ingredient, multiplier) {
    if (multiplier === 1) return ingredient;
    
    // Simple fraction scaling (works for basic fractions like 1/4, 1/2, etc.)
    const fractionMatch = ingredient.match(/(\d+)\/(\d+)/);
    if (fractionMatch) {
      const [, numerator, denominator] = fractionMatch;
      const scaledNum = parseInt(numerator) * multiplier;
      return ingredient.replace(/\d+\/\d+/, `${scaledNum}/${denominator}`);
    }
    
    // Decimal/integer scaling
    const numberMatch = ingredient.match(/(\d*\.?\d+)/);
    if (numberMatch) {
      const number = parseFloat(numberMatch[1]);
      const scaledNumber = number * multiplier;
      return ingredient.replace(/\d*\.?\d+/, scaledNumber.toString());
    }
    
    return ingredient;
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

// Routes
app.get('/', (req, res) => {
  const recipes = getRecipes();
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
        <div class="search-container">
            <input type="text" id="searchInput" placeholder="Search recipes..." onkeyup="searchRecipes()">
        </div>
    </nav>
    
    <div class="main-content">
        <h1>Recipe Collection</h1>
        <div class="recipe-grid" id="recipeGrid">
            ${recipes.map(recipe => `
                <div class="recipe-tile" onclick="window.location.href='/recipe/${recipe.id}'">
                    <img src="/images/${recipe.id}.jpg" alt="${recipe.title}" onerror="this.src='/images/default.jpg'">
                    <h3>${recipe.title}</h3>
                </div>
            `).join('')}
        </div>
    </div>
    
    <script src="/script.js"></script>
</body>
</html>
  `);
});

app.get('/recipe/:id', (req, res) => {
  const recipeId = req.params.id;
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
            <div class="multiplier-control">
                <label>Servings: </label>
                <input type="number" id="multiplier" value="1" min="0.25" step="0.25" onchange="updateRecipe()">
            </div>
        </div>
    </nav>
    
    <div class="main-content recipe-content">
        <div id="recipeDisplay"></div>
    </div>
    
    <script>
        const originalMarkdown = \`${content.replace(/`/g, '\\`')}\`;
        const variables = ${JSON.stringify(variables)};
        
        function updateRecipe() {
            const multiplier = parseFloat(document.getElementById('multiplier').value) || 1;
            fetch('/api/process-recipe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markdown: originalMarkdown, variables, multiplier })
            })
            .then(response => response.json())
            .then(data => {
                document.getElementById('recipeDisplay').innerHTML = data.html;
            });
        }
        
        updateRecipe(); // Initial load
    </script>
</body>
</html>
  `);
});

app.post('/api/process-recipe', (req, res) => {
  const { markdown, variables, multiplier } = req.body;
  const processedMarkdown = RecipeParser.substituteVariables(markdown, variables, multiplier);
  const html = marked(processedMarkdown);
  res.json({ html });
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