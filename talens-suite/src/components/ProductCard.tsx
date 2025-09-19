"use client";
import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import clsx from 'clsx';

interface ProductCardProps {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    image: string;
    tint?: string;
    onClick?: () => void;
    children?: ReactNode;
}

export function ProductCard({ id, title, subtitle, description, image, tint = 'from-slate-50 to-slate-100', onClick }: ProductCardProps) {
    return (
        <motion.article
            layoutId={id}
            whileHover={{ y: -6 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={onClick}
            className={clsx('panel-card group cursor-pointer overflow-hidden relative flex flex-col', 'bg-gradient-to-b', tint)}
            aria-labelledby={`${id}-title`}
        >
            <div className="p-8 flex flex-col gap-4 flex-1">
                <header>
                    <h3 id={`${id}-title`} className="text-3xl font-semibold tracking-tight gradient-text mb-2">{title}</h3>
                    <p className="text-base text-ink/70 font-medium">{subtitle}</p>
                </header>
                <p className="text-sm leading-relaxed text-ink/60 flex-1">{description}</p>
                <button className="mt-2 self-start rounded-full bg-ink text-white text-sm px-5 py-2 font-medium tracking-wide hover:bg-ink/90 focus:outline-none focus-visible:ring focus-visible:ring-ink/40 transition">Explore</button>
            </div>
            <div className="relative h-72 w-full">
                <img src={image} alt={title} className="absolute inset-0 w-full h-full object-cover object-center transition duration-500 group-hover:scale-[1.04]" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-white/20 to-transparent pointer-events-none" />
            </div>
        </motion.article>
    );
}
