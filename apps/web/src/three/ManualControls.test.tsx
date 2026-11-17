import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ManualControls } from './ManualControls';

describe('manual controls availability', () => {
  it('shows the takeoff reason and disables the manual action on the ground', () => {
    const html = renderToStaticMarkup(
      <ManualControls enabled={false} disabledReason="Take off first" onEnable={() => undefined} onControl={() => undefined} onStop={() => undefined} />,
    );
    expect(html).toContain('Take off first');
    expect(html).toContain('disabled');
    expect(html).toContain('aria-disabled="true"');
  });

  it('renders an explicit stop control for airborne manual flight', () => {
    const html = renderToStaticMarkup(
      <ManualControls enabled={true} onEnable={() => undefined} onControl={() => undefined} onStop={() => undefined} />,
    );
    expect(html).toContain('Stop / hover');
  });
});
