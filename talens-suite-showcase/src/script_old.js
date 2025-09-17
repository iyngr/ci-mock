// Talens Suite Interactive Features
(function () {
    'use strict';

    // DOM Elements
    const hero = document.querySelector('.hero');
    const productCards = document.querySelectorAll('.product-card');
    const techItems = document.querySelectorAll('.tech-item');
    const scrollIndicator = document.querySelector('.scroll-indicator');

    // Utility functions
    const debounce = (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

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

    // Intersection Observer for animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');

                // Add staggered animation for product cards
                if (entry.target.classList.contains('product-card')) {
                    const delay = Array.from(productCards).indexOf(entry.target) * 150;
                    entry.target.style.animationDelay = `${delay}ms`;
                }

                // Add staggered animation for tech items
                if (entry.target.classList.contains('tech-item')) {
                    const delay = Array.from(techItems).indexOf(entry.target) * 100;
                    entry.target.style.animationDelay = `${delay}ms`;
                }
            }
        });
    }, observerOptions);

    // Mouse movement parallax effect
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = throttle((e) => {
        mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        mouseY = (e.clientY / window.innerHeight) * 2 - 1;
    }, 16);

    const updateParallax = () => {
        targetX += (mouseX - targetX) * 0.1;
        targetY += (mouseY - targetY) * 0.1;

        // Apply parallax to stars
        const stars = document.querySelectorAll('.stars, .stars2, .stars3');
        stars.forEach((star, index) => {
            const speed = (index + 1) * 0.5;
            star.style.transform = `translate(${targetX * speed}px, ${targetY * speed}px)`;
        });

        requestAnimationFrame(updateParallax);
    };

    // Product card interactions
    const initProductCards = () => {
        productCards.forEach(card => {
            const hoverEffect = card.querySelector('.product-hover-effect');
            const icon = card.querySelector('.icon-container');

            card.addEventListener('mouseenter', () => {
                // Add glow effect
                card.style.boxShadow = '0 20px 80px rgba(102, 126, 234, 0.3)';

                // Animate icon
                if (icon) {
                    icon.style.transform = 'scale(1.1) rotate(5deg)';
                }

                // Add ripple effect
                createRipple(card);
            });

            card.addEventListener('mouseleave', () => {
                card.style.boxShadow = '';

                if (icon) {
                    icon.style.transform = '';
                }
            });

            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const centerX = rect.width / 2;
                const centerY = rect.height / 2;

                const rotateX = (y - centerY) / 10;
                const rotateY = (centerX - x) / 10;

                card.style.transform = `translateY(-8px) perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = '';
            });
        });
    };

    // Create ripple effect
    const createRipple = (element) => {
        const ripple = document.createElement('div');
        ripple.style.cssText = `
            position: absolute;
            border-radius: 50%;
            background: rgba(102, 126, 234, 0.3);
            transform: scale(0);
            animation: rippleEffect 0.6s linear;
            pointer-events: none;
            z-index: 1;
        `;

        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = '50%';
        ripple.style.top = '50%';
        ripple.style.marginLeft = ripple.style.marginTop = -(size / 2) + 'px';

        element.appendChild(ripple);

        setTimeout(() => {
            if (ripple.parentNode) {
                ripple.parentNode.removeChild(ripple);
            }
        }, 600);
    };

    // Smooth scrolling for scroll indicator
    const initScrollIndicator = () => {
        if (scrollIndicator) {
            scrollIndicator.addEventListener('click', (e) => {
                e.preventDefault();
                const productsSection = document.getElementById('products');
                if (productsSection) {
                    productsSection.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });

            // Hide scroll indicator when scrolled
            const handleScroll = throttle(() => {
                const scrolled = window.pageYOffset > window.innerHeight * 0.1;
                scrollIndicator.style.opacity = scrolled ? '0' : '1';
                scrollIndicator.style.pointerEvents = scrolled ? 'none' : 'auto';
            }, 16);

            window.addEventListener('scroll', handleScroll);
        }
    };

    // Animated counter for stats
    const animateCounters = () => {
        const statNumbers = document.querySelectorAll('.stat-number');

        statNumbers.forEach(stat => {
            const text = stat.textContent;
            if (text === '∞') return; // Skip infinity symbol

            const target = parseInt(text) || 0;
            let current = 0;
            const increment = target / 50;
            const timer = setInterval(() => {
                current += increment;
                if (current >= target) {
                    current = target;
                    clearInterval(timer);
                }
                stat.textContent = Math.floor(current) + (text.includes('%') ? '%' : '');
            }, 40);
        });
    };

    // Tech items hover effect
    const initTechItems = () => {
        techItems.forEach(item => {
            const icon = item.querySelector('.tech-icon');

            item.addEventListener('mouseenter', () => {
                if (icon) {
                    icon.style.transform = 'scale(1.2) rotate(5deg)';
                    icon.style.filter = 'brightness(1.3)';
                }
            });

            item.addEventListener('mouseleave', () => {
                if (icon) {
                    icon.style.transform = '';
                    icon.style.filter = '';
                }
            });
        });
    };

    // Loading animation
    const initLoadingAnimation = () => {
        // Create loading overlay
        const loadingOverlay = document.createElement('div');
        loadingOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            transition: opacity 0.5s ease-out;
        `;

        const loadingContent = document.createElement('div');
        loadingContent.style.cssText = `
            text-align: center;
            color: white;
        `;

        loadingContent.innerHTML = `
            <div style="font-size: 2rem; margin-bottom: 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-weight: 700;">Talens Suite</div>
            <div style="width: 40px; height: 40px; border: 3px solid rgba(102, 126, 234, 0.3); border-top: 3px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
        `;

        loadingOverlay.appendChild(loadingContent);
        document.body.appendChild(loadingOverlay);

        // Remove loading overlay after page load
        window.addEventListener('load', () => {
            setTimeout(() => {
                loadingOverlay.style.opacity = '0';
                setTimeout(() => {
                    if (loadingOverlay.parentNode) {
                        loadingOverlay.parentNode.removeChild(loadingOverlay);
                    }
                }, 500);
            }, 1000);
        });
    };

    // Dynamic gradient animation
    const initDynamicGradients = () => {
        const gradientElements = document.querySelectorAll('.gradient-text');
        let hue = 250;

        const animateGradients = () => {
            hue = (hue + 0.5) % 360;
            const gradient = `linear-gradient(135deg, hsl(${hue}, 70%, 60%) 0%, hsl(${(hue + 60) % 360}, 70%, 60%) 100%)`;

            gradientElements.forEach(element => {
                element.style.background = gradient;
                element.style.webkitBackgroundClip = 'text';
                element.style.backgroundClip = 'text';
            });

            requestAnimationFrame(animateGradients);
        };

        // Only animate if user prefers motion
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            animateGradients();
        }
    };

    // Performance monitoring
    const initPerformanceMonitoring = () => {
        // Monitor FPS
        let lastTime = performance.now();
        let frameCount = 0;

        const measureFPS = (currentTime) => {
            frameCount++;
            if (currentTime - lastTime >= 1000) {
                const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                if (fps < 30) {
                    // Reduce animations if FPS is low
                    document.body.classList.add('reduced-motion');
                }
                frameCount = 0;
                lastTime = currentTime;
            }
            requestAnimationFrame(measureFPS);
        };

        requestAnimationFrame(measureFPS);
    };

    // Add CSS keyframes dynamically
    const addCustomKeyframes = () => {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes rippleEffect {
                to {
                    transform: scale(4);
                    opacity: 0;
                }
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            @keyframes animate-in {
                from {
                    opacity: 0;
                    transform: translateY(30px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .animate-in {
                animation: animate-in 0.8s cubic-bezier(0.25, 1, 0.5, 1) forwards;
            }
            
            .reduced-motion *,
            .reduced-motion *::before,
            .reduced-motion *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        `;
        document.head.appendChild(style);
    };

    // Initialize everything
    const init = () => {
        // Add custom keyframes
        addCustomKeyframes();

        // Initialize loading animation
        initLoadingAnimation();

        // Initialize components
        initProductCards();
        initScrollIndicator();
        initTechItems();

        // Start observers
        [...productCards, ...techItems].forEach(element => {
            observer.observe(element);
        });

        // Start mouse tracking for parallax
        document.addEventListener('mousemove', handleMouseMove);
        updateParallax();

        // Initialize dynamic effects
        initDynamicGradients();
        initPerformanceMonitoring();

        // Animate counters when hero is in view
        const heroObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCounters();
                    heroObserver.disconnect();
                }
            });
        });

        if (hero) {
            heroObserver.observe(hero);
        }

        // Add resize handler
        const handleResize = debounce(() => {
            // Recalculate any size-dependent animations
            productCards.forEach(card => {
                card.style.transform = '';
            });
        }, 250);

        window.addEventListener('resize', handleResize);

        console.log('🎯 Talens Suite initialized successfully!');
    };

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();