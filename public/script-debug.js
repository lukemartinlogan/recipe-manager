console.log('Script loaded - debug version');

// Absolute minimal functionality
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded');
    
    // Just log clicks, don't do anything else
    document.body.addEventListener('click', function(e) {
        console.log('Clicked:', e.target);
        
        if (e.target.closest('.recipe-title')) {
            console.log('Would navigate to recipe');
            // Don't actually navigate
            e.preventDefault();
        }
    });
    
    console.log('Event listeners attached');
});