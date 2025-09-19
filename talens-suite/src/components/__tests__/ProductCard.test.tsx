import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProductCard } from '../ProductCard.tsx';

describe('ProductCard', () => {
    it('renders title and subtitle', () => {
        render(
            <ProductCard
                id="talens"
                title="Talens"
                subtitle="Faceless Real-Time Interview"
                description="Multi-agent orchestration."
                image="/test.jpg"
            />
        );
        // Use simple assertions without relying on screen namespace to avoid type friction
        const { container } = render(
            <ProductCard
                id="talens2"
                title="Talens"
                subtitle="Faceless Real-Time Interview"
                description="Multi-agent orchestration."
                image="/test.jpg"
            />
        );
        expect(container.textContent).toContain('Talens');
        expect(container.textContent).toContain('Faceless Real-Time Interview');
    });
});
