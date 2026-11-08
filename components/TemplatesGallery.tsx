import React, { useState, useRef, useEffect } from 'react';
import { Template } from '../types';
import { templates } from '../data/templates';
import { LoyaltyCard } from './LoyaltyCard';
import { LayoutGrid } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../lib/i18n';

const CATEGORIES = ["All", "Food & Drink", "Beauty & Wellness", "Services", "Retail"];

const TEMPLATE_CATEGORIES: Record<string, string> = {
  'cookie-classic': 'Food & Drink',
  'midnight-brew': 'Food & Drink',
  'pizza-party': 'Food & Drink',
  'sweet-scoops': 'Food & Drink',
  'massage-bliss': 'Beauty & Wellness',
  'laundry-fresh': 'Services',
  'sharp-cuts': 'Beauty & Wellness',
  'boba-time': 'Food & Drink',
  'burger-joint': 'Food & Drink'
};

interface ResponsiveCardPreviewProps {
  template: Template;
  onSelect: (id: string) => void;
}

const ResponsiveCardPreview: React.FC<ResponsiveCardPreviewProps> = ({ template, onSelect }) => {
    const { t } = useI18n();
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    const BASE_WIDTH = 380;
    const BASE_HEIGHT = 750;

    useEffect(() => {
        const observer = new ResizeObserver((entries) => {
            if (entries[0]) {
                 const width = entries[0].contentRect.width;
                 setScale(width / BASE_WIDTH);
            }
        });

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, []);

    return (
        <div
            className="group flex flex-col items-center gap-6 cursor-pointer w-full max-w-[380px] mx-auto"
            onClick={() => onSelect(template.id)}
        >
             <div
                ref={containerRef}
                className="relative w-full aspect-[380/750] rounded-[2.5rem] shadow-2xl border border-gray-100 bg-white group-hover:scale-[1.02] transition-all duration-300 overflow-hidden ring-1 ring-black/5"
            >
                <div
                    className="origin-top-left absolute top-0 left-0 will-change-transform"
                    style={{
                        width: `${BASE_WIDTH}px`,
                        height: `${BASE_HEIGHT}px`,
                        transform: `scale(${scale})`
                    }}
                >
                    <LoyaltyCard
                        template={template}
                        mode="active"
                        className="w-full h-full pointer-events-none"
                    />
                </div>

                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none z-10" />
            </div>

            <div className="text-center space-y-2 w-full px-2">
                <h3 className="font-bold text-2xl text-foreground tracking-tight group-hover:text-primary transition-colors truncate">
                    {template.name}
                </h3>
                 <div className="flex items-center justify-center gap-2 flex-wrap">
                    <span className={cn(
                        "text-xs px-2.5 py-1 rounded-full font-semibold bg-secondary text-secondary-foreground border"
                    )}>
                        {t('{count} Stamps', { count: template.totalStamps })}
                    </span>
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={template.rewardName}>
                       {template.rewardName}
                    </span>
                </div>
            </div>
        </div>
    )
}

export const TemplatesGallery: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [activeCategory, setActiveCategory] = useState("All");

  const filteredTemplates = templates.filter(template => {
    if (activeCategory === "All") return true;
    return TEMPLATE_CATEGORIES[template.id] === activeCategory;
  });

  const handleSelect = (id: string) => {
      navigate(`/preview/${id}`);
  };

  return (
    <div className="p-4 md:p-8 space-y-8 animate-fade-in h-full overflow-y-auto bg-gray-50/50">
      <header className="flex flex-col gap-6 border-b pb-6">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-primary text-primary-foreground rounded-xl shadow-md">
                <LayoutGrid size={24} />
            </div>
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('Templates')}</h1>
                <p className="text-muted-foreground">{t('Select a design to start your customer loyalty program.')}</p>
            </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
            {CATEGORIES.map((category) => (
                <Button
                    key={t(category)}
                    variant={activeCategory === category ? "default" : "outline"}
                    onClick={() => setActiveCategory(category)}
                    className={cn(
                        "rounded-full px-4 h-8 text-xs font-medium transition-all",
                        activeCategory === category
                            ? "shadow-md hover:opacity-90"
                            : "bg-white hover:bg-gray-100 border-gray-200 text-gray-600"
                    )}
                >
                    {t(category)}
                </Button>
            ))}
        </div>
      </header>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-10 pb-12 px-2 md:px-4">
        {filteredTemplates.map((template) => (
          <ResponsiveCardPreview
            key={template.id}
            template={template}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </div>
  );
};