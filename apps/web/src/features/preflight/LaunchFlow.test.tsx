import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { FlightEvent } from '@droneverse/shared';
import { canConfirmLaunch, LaunchFlow } from './LaunchFlow';

const missionId = '11111111-1111-4111-8111-111111111111';

describe('launch flow', () => {
  it('requires area, regulations, and simulated acknowledgements', () => {
    expect(canConfirmLaunch(false, true, true, true)).toBe(false);
    expect(canConfirmLaunch(true, false, true, true)).toBe(false);
    expect(canConfirmLaunch(true, true, true, false)).toBe(false);
    expect(canConfirmLaunch(true, true, true, true)).toBe(true);
  });

  it('shows the controller stop reason and always-visible safety actions', () => {
    const stopped: FlightEvent = {
      type: 'sequence',
      status: 'aborted',
      reason: 'A pre-flight check changed: GPS lock: 2 satellites (need 10)',
      at: 1,
    };
    const html = renderToStaticMarkup(
      <LaunchFlow
        preflightPassed
        missionId={missionId}
        simulated
        events={[stopped]}
        commandLog={[]}
        onCommand={() => true}
      />,
    );
    expect(html).toContain('A pre-flight check changed: GPS lock');
    expect(html).toContain('Return to home');
    expect(html).toContain('Abort');
    expect(html).toContain('Command log');
  });
});
