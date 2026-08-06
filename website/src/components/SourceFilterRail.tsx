import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SourceMaterialType } from '../types';
import { SOURCE_MATERIALS } from '../utils/sourceMaterials';

type SourceFilterRailProps = {
  selected: SourceMaterialType | null;
  onSelect: (value: SourceMaterialType | null) => void;
  includeAll?: boolean;
  variant: 'admin' | 'content';
};

export function SourceFilterRail({
  selected,
  onSelect,
  includeAll = false,
  variant,
}: SourceFilterRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    setCanScrollLeft(rail.scrollLeft > 2);
    setCanScrollRight(rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 2);
  }, []);

  useEffect(() => {
    updateScrollState();
    window.addEventListener('resize', updateScrollState);
    return () => window.removeEventListener('resize', updateScrollState);
  }, [updateScrollState]);

  const scroll = (direction: -1 | 1) => {
    railRef.current?.scrollBy({ left: direction * 320, behavior: 'smooth' });
  };

  return (
    <div className={`source-scroll-shell is-${variant}`}>
      <button
        type="button"
        className="source-scroll-arrow"
        onClick={() => scroll(-1)}
        disabled={!canScrollLeft}
        aria-label="Show previous categories"
      >
        <ChevronLeft size={17} />
      </button>

      <div
        ref={railRef}
        className={variant === 'admin' ? 'intake-source-rail' : 'content-filter-rail'}
        onScroll={updateScrollState}
        aria-label="Filter content by source"
      >
        {includeAll ? (
          <button
            type="button"
            className={selected === null ? 'is-active' : ''}
            onClick={() => onSelect(null)}
          >
            All
          </button>
        ) : null}

        {SOURCE_MATERIALS.map((option) => {
          const Icon = option.icon;
          const isSelected = selected === option.value;
          return (
            <button
              type="button"
              key={option.value}
              className={variant === 'admin'
                ? `intake-source-filter source-${option.value} ${isSelected ? 'is-selected' : ''}`
                : `source-${option.value} ${isSelected ? 'is-active' : ''}`}
              onClick={() => onSelect(isSelected && !includeAll ? null : option.value)}
              aria-pressed={isSelected}
            >
              {variant === 'admin' ? <Icon size={17} /> : null}
              {variant === 'content' ? <i className="source-category-dot" aria-hidden="true" /> : null}
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="source-scroll-arrow"
        onClick={() => scroll(1)}
        disabled={!canScrollRight}
        aria-label="Show more categories"
      >
        <ChevronRight size={17} />
      </button>
    </div>
  );
}
