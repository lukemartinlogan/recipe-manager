function searchRecipes() {
    const searchInput = document.getElementById('searchInput');
    const query = searchInput.value.toLowerCase().trim();
    const recipeGrid = document.getElementById('recipeGrid');
    
    if (query === '') {
        // Show all recipes
        const tiles = recipeGrid.querySelectorAll('.recipe-tile');
        tiles.forEach(tile => {
            tile.style.display = 'block';
            // Remove highlighting
            const title = tile.querySelector('h3');
            title.innerHTML = title.textContent;
        });
        return;
    }
    
    // Filter recipes
    fetch(`/api/search/${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(filteredRecipes => {
            const tiles = recipeGrid.querySelectorAll('.recipe-tile');
            
            tiles.forEach(tile => {
                const recipeId = tile.querySelector('.meal-quantity').getAttribute('data-recipe-id');
                const matchingRecipe = filteredRecipes.find(recipe => recipe.id === recipeId);
                
                if (matchingRecipe) {
                    tile.style.display = 'block';
                    // Highlight matching text
                    const title = tile.querySelector('h3');
                    const highlightedTitle = highlightText(matchingRecipe.title, query);
                    title.innerHTML = highlightedTitle;
                } else {
                    tile.style.display = 'none';
                }
            });
        })
        .catch(error => {
            console.error('Search error:', error);
        });
}

function highlightText(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Meal quantity management
let mealQuantities = {};
try {
    mealQuantities = JSON.parse(localStorage.getItem('mealQuantities') || '{}');
} catch (e) {
    console.error('Error parsing mealQuantities from localStorage:', e);
    localStorage.removeItem('mealQuantities');
}

function updateMealQuantity(recipeId, quantity, event) {
    if (event) {
        event.stopPropagation(); // Prevent event bubbling
        event.preventDefault(); // Prevent default form behavior
    }
    mealQuantities[recipeId] = parseInt(quantity) || 0;
    localStorage.setItem('mealQuantities', JSON.stringify(mealQuantities));
}

function goToRecipe(recipeId) {
    const quantity = mealQuantities[recipeId] || 1;
    window.location.href = `/recipe/${recipeId}?quantity=${quantity}`;
}

// Add search functionality with debouncing to prevent infinite loops
let searchTimeout;

function debounceSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(searchRecipes, 300);
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, setting up event listeners...');
    
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounceSearch);
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                clearTimeout(searchTimeout);
                searchRecipes();
            }
        });
    }
    
    // Recipe navigation clicks
    document.addEventListener('click', function(e) {
        if (e.target.closest('.recipe-image') || e.target.closest('.recipe-title')) {
            const recipeId = e.target.closest('[data-recipe-id]').getAttribute('data-recipe-id');
            if (recipeId) {
                goToRecipe(recipeId);
            }
        }
    });
    
    // Meal quantity changes
    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('meal-quantity')) {
            const recipeId = e.target.getAttribute('data-recipe-id');
            const quantity = e.target.value;
            if (recipeId) {
                updateMealQuantity(recipeId, quantity, e);
            }
        }
    });
    
    // Load saved meal quantities
    try {
        document.querySelectorAll('.meal-quantity').forEach(input => {
            const recipeId = input.getAttribute('data-recipe-id');
            const savedQuantity = mealQuantities[recipeId] || 0;
            input.value = savedQuantity;
        });
        console.log('Meal quantities loaded successfully');
    } catch (e) {
        console.error('Error loading meal quantities:', e);
    }
});