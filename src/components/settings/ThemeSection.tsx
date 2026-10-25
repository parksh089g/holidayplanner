import { useId } from 'react';
import type { ThemeMode } from '../../core/types';
import { useTheme } from '../../hooks/useTheme';
import { THEME_LABEL } from '../../lib/theme';
import { choiceClass } from '../../lib/ui';
import { Card } from '../Card';

/** SPEC §8.6 테마: 시스템 / 밝게 / 어둡게 (프로필에 저장) */
export function ThemeSection() {
  const id = useId();
  const { theme, setTheme } = useTheme();
  return (
    <Card title="테마">
      <fieldset>
        <legend className="sr-only">테마</legend>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(THEME_LABEL) as ThemeMode[]).map((mode) => (
            <label key={mode} className={choiceClass}>
              <input
                type="radio"
                name={`${id}-theme`}
                className="sr-only"
                checked={theme === mode}
                onChange={() => setTheme(mode)}
              />
              {THEME_LABEL[mode]}
            </label>
          ))}
        </div>
      </fieldset>
    </Card>
  );
}
