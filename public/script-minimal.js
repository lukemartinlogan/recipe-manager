// Script with authentication and database support
console.log('Script loaded successfully');

let mealQuantities = {};

// Authentication functions
function showSignInModal() {
    document.getElementById('signInModal').style.display = 'block';
}

function closeSignInModal() {
    document.getElementById('signInModal').style.display = 'none';
    document.getElementById('authError').textContent = '';
}

function signIn(username) {
    fetch('/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Don't reload, just redirect to current page to refresh server-side state
            window.location.href = window.location.href;
        } else {
            document.getElementById('authError').textContent = data.error;
        }
    })
    .catch(error => {
        console.error('Sign in error:', error);
        document.getElementById('authError').textContent = 'Sign in failed';
    });
}

function signUp() {
    const username = document.getElementById('usernameInput').value.trim();
    if (!username) {
        document.getElementById('authError').textContent = 'Please enter a username';
        return;
    }
    
    // Clear any existing error
    document.getElementById('authError').textContent = '';
    
    fetch('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Redirect to refresh server-side state
            window.location.href = window.location.href;
        } else {
            document.getElementById('authError').textContent = data.error;
        }
    })
    .catch(error => {
        console.error('Sign up error:', error);
        document.getElementById('authError').textContent = 'Sign up failed';
    });
}

function signOut() {
    fetch('/auth/signout', { method: 'POST' })
    .then(() => {
        // Redirect to refresh server-side state
        window.location.href = window.location.href;
    })
    .catch(error => console.error('Sign out error:', error));
}

// Meal quantity functions
function updateMealQuantity(recipeId, quantity) {
    console.log('Updating quantity:', recipeId, quantity);
    const qty = parseInt(quantity) || 0;
    mealQuantities[recipeId] = qty;
    
    if (isSignedIn) {
        // Save to database
        fetch('/api/meal-quantity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipeId, quantity: qty })
        }).catch(error => console.error('Error saving quantity:', error));
    }
}

function goToRecipe(recipeId) {
    console.log('Going to recipe:', recipeId);
    const quantity = mealQuantities[recipeId] || 1;
    window.location.href = `/recipe/${recipeId}?quantity=${quantity}`;
}

// Load meal quantities
function loadMealQuantities() {
    if (isSignedIn) {
        fetch('/api/meal-quantities')
            .then(response => response.json())
            .then(data => {
                mealQuantities = data;
                updateQuantityInputs();
            })
            .catch(error => console.error('Error loading quantities:', error));
    } else {
        // Use localStorage for non-signed-in users
        try {
            mealQuantities = JSON.parse(localStorage.getItem('mealQuantities') || '{}');
            updateQuantityInputs();
        } catch (e) {
            console.error('Error loading from localStorage:', e);
        }
    }
}

function updateQuantityInputs() {
    document.querySelectorAll('.meal-quantity').forEach(input => {
        const recipeId = input.getAttribute('data-recipe-id');
        const savedQuantity = mealQuantities[recipeId] || 0;
        input.value = savedQuantity;
    });
}

// Event delegation and initialization
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded - with auth support');
    
    // Load meal quantities first
    loadMealQuantities();
    
    // Sign in form submission
    const signInForm = document.getElementById('signInForm');
    if (signInForm) {
        signInForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const username = document.getElementById('usernameInput').value;
            signIn(username);
        });
    }
    
    // Recipe clicks - entire tile is clickable except quantity input
    document.body.addEventListener('click', function(e) {
        // Don't trigger if clicking on quantity input or its label
        if (e.target.classList.contains('meal-quantity') || 
            e.target.closest('.quantity-control')) {
            return;
        }
        
        // Check if clicking on a recipe tile
        const recipeTile = e.target.closest('.recipe-tile');
        if (recipeTile) {
            const recipeId = recipeTile.getAttribute('data-recipe-id');
            if (recipeId) {
                goToRecipe(recipeId);
            }
        }
    });
    
    // Quantity changes
    document.body.addEventListener('change', function(e) {
        if (e.target.classList && e.target.classList.contains('meal-quantity')) {
            const recipeId = e.target.getAttribute('data-recipe-id');
            updateMealQuantity(recipeId, e.target.value);
            
            // Update localStorage for non-signed-in users
            if (!isSignedIn) {
                localStorage.setItem('mealQuantities', JSON.stringify(mealQuantities));
            }
        }
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', function(e) {
        const modal = document.getElementById('signInModal');
        if (e.target === modal) {
            closeSignInModal();
        }
    });
    
    console.log('Event listeners attached');
});