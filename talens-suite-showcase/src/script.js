// Enhanced Talens Suite Interactive Features
(function () {
    'use strict';

    // DOM Elements
    const productSections = document.querySelectorAll('.product-section');
    const logoIcon = document.querySelector('.logo-icon');
    const siteTitle = document.querySelector('.site-title');

    // Utility functions
    const throttle = (func, limit) => {
        let lastFunc;
        let lastRan;
        return function () {
            const context = this;
            const args = arguments;
            if (!lastRan) {
                func.apply(context, args);
                lastRan = Date.now();
            } else {
                clearTimeout(lastFunc);
                lastFunc = setTimeout(function () {
                    if ((Date.now() - lastRan) >= limit) {
                        func.apply(context, args);
                        lastRan = Date.now();
                    }
                }, limit - (Date.now() - lastRan));
            }
        };
    };

    // Mouse tracking for parallax effects
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = throttle((e) => {
        mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        mouseY = (e.clientY / window.innerHeight) * 2 - 1;
    }, 16);

    // Subtle parallax animation loop
    const updateParallax = () => {
        targetX += (mouseX - targetX) * 0.02;
        targetY += (mouseY - targetY) * 0.02;

        // Apply subtle parallax to background elements
        const bgCircles = document.querySelectorAll('.bg-circle');
        bgCircles.forEach((circle, index) => {
            const speed = (index + 1) * 0.3;
            circle.style.transform = `translate(${targetX * speed}px, ${targetY * speed}px)`;
        });

        requestAnimationFrame(updateParallax);
    };

    // Enhanced product card interactions
    const initProductCards = () => {
        productSections.forEach((card, index) => {
            const icon = card.querySelector('.icon-background');

            // Enhanced hover effects
            card.addEventListener('mouseenter', () => {
                // Animate icon with stagger
                if (icon) {
                    setTimeout(() => {
                        icon.style.transform = 'scale(1.15) rotate(8deg)';
                    }, 50);
                }

                // Add subtle vibration effect
                card.classList.add('vibrate');
                setTimeout(() => card.classList.remove('vibrate'), 300);
            });

            card.addEventListener('mouseleave', () => {
                if (icon) {
                    icon.style.transform = '';
                }
            });

            // 3D tilt effect on mouse move
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const centerX = rect.width / 2;
                const centerY = rect.height / 2;

                const rotateX = (y - centerY) / 8;
                const rotateY = (centerX - x) / 8;

                card.style.transform = `translateY(-8px) scale(1.02) perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = '';
            });

            // Add click ripple effect
            card.addEventListener('click', (e) => {
                createRipple(card, e);
            });
        });
    };

    // Create ripple effect
    const createRipple = (element, event) => {
        const ripple = document.createElement('div');
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);

        ripple.style.cssText = `
            position: absolute;
            border-radius: 50%;
            background: rgba(102, 126, 234, 0.3);
            transform: scale(0);
            animation: rippleEffect 0.8s ease-out;
            pointer-events: none;
            z-index: 10;
            width: ${size}px;
            height: ${size}px;
            left: ${event.clientX - rect.left - size / 2}px;
            top: ${event.clientY - rect.top - size / 2}px;
        `;

        element.appendChild(ripple);

        setTimeout(() => {
            ripple.remove();
        }, 800);
    };

    // Logo interaction
    const initLogoInteraction = () => {
        if (logoIcon) {
            logoIcon.addEventListener('click', () => {
                logoIcon.style.animation = 'none';
                logoIcon.offsetHeight; // Trigger reflow
                logoIcon.style.animation = 'logoSpin 1s ease-in-out';

                setTimeout(() => {
                    logoIcon.style.animation = 'pulse 2s ease-in-out infinite';
                }, 1000);
            });
        }

        if (siteTitle) {
            siteTitle.addEventListener('mouseenter', () => {
                siteTitle.style.transform = 'scale(1.02)';
                siteTitle.style.transition = 'transform 0.3s ease';
            });

            siteTitle.addEventListener('mouseleave', () => {
                siteTitle.style.transform = '';
            });
        }
    };

    // Add custom CSS animations
    const addCustomStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes rippleEffect {
                to {
                    transform: scale(4);
                    opacity: 0;
                }
            }
            
            @keyframes logoSpin {
                0% { transform: rotate(0deg) scale(1); }
                50% { transform: rotate(180deg) scale(1.1); }
                100% { transform: rotate(360deg) scale(1); }
            }
            
            @keyframes vibrate {
                0%, 100% { transform: translateY(-8px) scale(1.02) rotate(0deg); }
                25% { transform: translateY(-8px) scale(1.02) rotate(0.5deg); }
                75% { transform: translateY(-8px) scale(1.02) rotate(-0.5deg); }
            }
            
            .vibrate {
                animation: vibrate 0.3s ease-in-out;
            }
        `;
        document.head.appendChild(style);
    };

    // Responsive behavior
    const handleResize = () => {
        const viewport = window.innerWidth;

        if (viewport < 480) {
            document.body.classList.add('mobile-view');
        } else {
            document.body.classList.remove('mobile-view');
        }
    };

    // Initialize everything
    const init = () => {
        console.log('🎯 Initializing Enhanced Talens Suite...');

        // Add custom styles
        addCustomStyles();

        // Initialize all features
        initProductCards();
        initLogoInteraction();

        // Start animations
        document.addEventListener('mousemove', handleMouseMove);
        updateParallax();

        // Handle responsive behavior
        window.addEventListener('resize', handleResize);
        handleResize(); // Call on load

        console.log('✨ Enhanced Talens Suite initialized successfully!');
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();