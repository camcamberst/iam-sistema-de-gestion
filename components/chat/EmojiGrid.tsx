import React, { useMemo } from 'react';
import { emojiData } from '@/lib/chat/emojis';

interface EmojiGridProps {
  emojiSearchQuery: string;
  onEmojiSelect: (char: string) => void;
  themeConfig: any;
  categoryRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  buttonClassName?: string;
}

const EmojiGrid = React.memo(({
  emojiSearchQuery,
  onEmojiSelect,
  themeConfig,
  categoryRefs,
  buttonClassName = "w-8 h-8 text-xl"
}: EmojiGridProps) => {

  // Memoize el filtro de búsqueda para evitar recalcular innecesariamente
  const filteredEmojis = useMemo(() => {
    const searchLower = emojiSearchQuery.trim().toLowerCase();
    if (!searchLower) return null;
    
    return emojiData.flatMap(cat => cat.emojis).filter(e => 
      e.keywords.some(k => k.toLowerCase().includes(searchLower))
    );
  }, [emojiSearchQuery]);

  return (
    <>
      {emojiSearchQuery.trim() ? (
        // Modo búsqueda
        (() => {
          if (!filteredEmojis || filteredEmojis.length === 0) {
            return <div className="text-center text-xs text-gray-500 py-4">No se encontraron emojis</div>;
          }
          
          return (
            <div className="grid grid-cols-7 gap-1">
              {filteredEmojis.map((emojiObj, idx) => (
                <button
                  key={idx}
                  onClick={() => onEmojiSelect(emojiObj.char)}
                  className={`${buttonClassName} flex items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${themeConfig.emojiHover}`}
                  aria-label={emojiObj.keywords[0]}
                >
                  {emojiObj.char}
                </button>
              ))}
            </div>
          );
        })()
      ) : (
        // Modo normal
        emojiData.map(category => (
          <div 
            key={category.id} 
            className="space-y-1"
            ref={el => { categoryRefs.current[category.id] = el; }}
          >
            <p className={`text-[10px] uppercase tracking-wider px-1 ${themeConfig.emojiCategoryTitle}`}>
              {category.title}
            </p>
            <div className="grid grid-cols-7 gap-1">
              {category.emojis.map((emojiObj, index) => (
                <button
                  key={index}
                  onClick={() => onEmojiSelect(emojiObj.char)}
                  className={`${buttonClassName} flex items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${themeConfig.emojiHover}`}
                  aria-label={emojiObj.keywords[0]}
                >
                  {emojiObj.char}
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </>
  );
});

EmojiGrid.displayName = 'EmojiGrid';

export default EmojiGrid;

