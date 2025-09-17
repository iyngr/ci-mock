// Simple interaction enhancements for Talens Suite
(function () {
    'use strict';

    // Add subtle hover effects for product sections
    const productSections = document.querySelectorAll('.product-section');

    productSections.forEach(section => {
        // Add gentle hover animation
        section.addEventListener('mouseenter', function () {
            this.style.transition = 'all 0.3s ease';
        });

        section.addEventListener('mouseleave', function () {
            this.style.transition = 'all 0.3s ease';
        });
    });

    // Ensure responsive behavior
    const handleResize = () => {
        // Simple responsive adjustments if needed
        const viewport = window.innerWidth;

        if (viewport < 480) {
            document.body.classList.add('mobile-view');
        } else {
            document.body.classList.remove('mobile-view');
        }
    };

    // Initialize
    window.addEventListener('resize', handleResize);
    handleResize(); // Call on load

    console.log('Talens Suite - Simple layout initialized');
})();